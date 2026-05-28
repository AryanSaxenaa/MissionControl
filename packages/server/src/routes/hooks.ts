import type { FastifyInstance } from 'fastify'
import type { HookPayload, ConflictResult } from '@missioncontrol/types'
import { detectConflicts } from '../services/conflict-detector.js'
import { broadcast } from '../ws-events.js'
import { activeIntents, getIntentsForTarget, sessionToAgent, sessionIntents, clearSessionsForAgent } from '../state.js'
import { recallFailuresForTarget, ingestContext, ingestDecision, ingestFailure } from '../hydra.js'
import { trackConflict } from './conflicts.js'
import { recentDecisions } from './decisions.js'
import { recentFailures } from './failures.js'
import type { DecisionItem, FailureItem } from '@missioncontrol/types'

const WRITE_TOOLS = ['Write', 'Edit', 'MultiEdit', 'Bash']

function extractTarget(tool_input: Record<string, any>): string {
  return tool_input.file_path || tool_input.path || tool_input.command || 'unknown'
}

// In-flight permission requests: requestId → resolve fn
const pendingPermissions = new Map<string, (decision: 'allow' | 'deny') => void>()

function makePeerAwarenessContext(
  agentId: string,
  target: string,
  intentId: string
): { additionalContext: string; peerConflict: ConflictResult } | null {
  const peers = getIntentsForTarget(target).filter(i => i.agentId !== agentId && i.id !== intentId)
  if (peers.length === 0) return null

  const peerSummary = peers
    .map(p => `  - ${p.agentId}: ${p.description} (started ${new Date(p.startedAt).toISOString()})`)
    .join('\n')
  const additionalContext =
    `[MissionControl] ${peers.length} other agent(s) currently have active intents on this target:\n${peerSummary}\n` +
    `Coordinate or wait if your change might conflict with theirs.`
  const peerConflict: ConflictResult = {
    id: `peer-${intentId}`,
    severity: 'warning',
    kind: 'file',
    description: `${agentId} editing ${target} while ${peers.map(p => p.agentId).join(', ')} also have active intents on it`,
    agentIds: [agentId, ...peers.map(p => p.agentId)],
    intentIds: [intentId, ...peers.map(p => p.id)],
    createdAt: Date.now(),
  }
  return { additionalContext, peerConflict }
}

export { clearSessionsForAgent }

export async function hooksRoutes(app: FastifyInstance) {

  app.post('/hooks/session-start', async (req, reply) => {
    const body         = req.body as { session_id?: string; agentId?: string }
    const agentIdQuery = (req.query as Record<string, string>).agentId
    const agentId      = body.agentId ?? agentIdQuery
    if (body.session_id && agentId) {
      sessionToAgent.set(body.session_id, agentId)
    }
    return reply.send({ ok: true })
  })

  app.post('/hooks/session-idle', async (req, reply) => {
    const body = req.body as { session_id?: string; agentId?: string }
    const agentId = body.agentId ?? (body.session_id ? sessionToAgent.get(body.session_id) : undefined)
    if (agentId) {
      broadcast({ type: 'agent:completed', agentId })
      broadcast({ type: 'agent:ready-to-merge', agentId })
    }
    return reply.send({ ok: true })
  })

  app.post('/hooks/pre-tool-use', async (req, reply) => {
    const body = req.body as HookPayload
    const { tool_name, tool_input, session_id } = body

    if (!WRITE_TOOLS.includes(tool_name)) return reply.send({})

    const agentIdQuery = (req.query as Record<string, string>).agentId
    const agentId = sessionToAgent.get(session_id) ?? agentIdQuery
    if (!agentId) return reply.send({})

    const target = extractTarget(tool_input)

    try {
      const result = await recallFailuresForTarget(target)
      if (result.chunks?.length) {
        broadcast({ type: 'failure:recorded', sourceId: '', agentId, target, errorType: 'known-risk' })
      }
    } catch (e: any) {
      console.error(`[hooks/pre] recallFailuresForTarget(${target}) failed:`, e?.message || e)
    }

    const intentId = `intent-${Date.now()}`
    const intent = {
      id: intentId,
      agentId,
      action: 'write' as const,
      target,
      description: tool_input.description ?? `${tool_name} on ${target}`,
      status: 'in-progress' as const,
      startedAt: Date.now(),
    }
    activeIntents.set(intentId, intent)

    let conflicts: ConflictResult[] = []
    try {
      conflicts = await detectConflicts(intent)
      for (const c of conflicts) { trackConflict(c); broadcast({ type: 'conflict:detected', conflict: c }) }
    } catch (e: any) {
      console.error(`[hooks/pre] detectConflicts failed for ${agentId} → ${target}:`, e?.message || e)
    }

    const criticalConflict = conflicts.find(c => c.severity === 'critical')
    if (criticalConflict) {
      activeIntents.delete(intentId)
      return reply.send({
        hookSpecificOutput: {
          hookEventName: 'PreToolUse',
          permissionDecision: 'deny',
          permissionDecisionReason: `[MissionControl CONFLICT] ${criticalConflict.description}`,
        },
      })
    }

    broadcast({ type: 'intent:declared', intent })

    sessionIntents.set(session_id, intentId)

    const peerWarning = makePeerAwarenessContext(agentId, target, intentId)
    if (peerWarning) {
      trackConflict(peerWarning.peerConflict)
      broadcast({ type: 'conflict:detected', conflict: peerWarning.peerConflict })
      return reply.send({
        hookSpecificOutput: {
          hookEventName: 'PreToolUse',
          additionalContext: peerWarning.additionalContext,
        },
      })
    }

    return reply.send({})
  })

  app.post('/hooks/post-tool-use', async (req, reply) => {
    const body = req.body as HookPayload
    const { tool_name, tool_input, tool_response, session_id } = body

    if (!WRITE_TOOLS.includes(tool_name)) return reply.send({})

    const agentIdQuery = (req.query as Record<string, string>).agentId
    const agentId = sessionToAgent.get(session_id) ?? agentIdQuery
    if (!agentId) return reply.send({})

    const intentId = sessionIntents.get(session_id)
    if (intentId) {
      const intent = activeIntents.get(intentId)
      if (intent) {
        activeIntents.set(intentId, { ...intent, status: 'completed' })
        broadcast({ type: 'intent:updated', intentId, status: 'completed' })
        setTimeout(() => activeIntents.delete(intentId), 60_000)
      }
      sessionIntents.delete(session_id)
    }

    const target = extractTarget(tool_input)
    const description = tool_input.description ?? `${tool_name} on ${target}`

    ingestContext({
      agentId,
      content: `Modified ${target}: ${description}`,
      scope: target,
      tags: ['modification', tool_name.toLowerCase()],
      confidence: 0.9,
    }).then(() => {
      broadcast({ type: 'context:ingested', agentId })
    }).catch((e: any) => {
      console.error(`[hooks/post] ingestContext failed for ${agentId} → ${target}:`, e?.message || e)
    })

    if (tool_name !== 'Bash') {
      const summary = `Agent ${agentId} modified ${target}: ${description}`

      ingestDecision({
        agentId,
        summary,
        reasoning: description,
        alternativesConsidered: [],
        affectedFiles: [target],
        tags: [tool_name.toLowerCase(), 'auto'],
      }).then(sourceId => {
        const item: DecisionItem = { sourceId, agentId, target, summary, createdAt: Date.now() }
        recentDecisions.unshift(item)
        if (recentDecisions.length > 200) recentDecisions.pop()
        broadcast({ type: 'decision:recorded', sourceId, agentId, target, summary })
      }).catch((e: any) => {
        console.error(`[hooks/post] ingestDecision failed for ${agentId} → ${target}:`, e?.message || e)
      })
    }

    if (tool_name === 'Bash' && tool_response?.content) {
      const responseText = typeof tool_response.content === 'string'
        ? tool_response.content
        : JSON.stringify(tool_response.content)
      const isFailure = /exit code [1-9]|error:|Error:|FAILED|failed|exception|Exception/i.test(responseText)
      if (isFailure) {
        const errorSnippet = responseText.slice(0, 400)

        ingestFailure({
          agentId,
          task: description,
          target,
          errorType: 'bash-error',
          errorMessage: errorSnippet,
          context: `Command: ${tool_input.command ?? target}`,
        }).then(sourceId => {
          const item: FailureItem = { sourceId, agentId, target, errorType: 'bash-error', createdAt: Date.now() }
          recentFailures.unshift(item)
          if (recentFailures.length > 500) recentFailures.pop()
          broadcast({ type: 'failure:recorded', sourceId, agentId, target, errorType: 'bash-error' })
        }).catch((e: any) => {
          console.error(`[hooks/post] ingestFailure failed for ${agentId} → ${target}:`, e?.message || e)
        })
      }
    }

    return reply.send({})
  })

  app.post('/hooks/permission-request', async (req, reply) => {
    const body = req.body as HookPayload
    const { session_id, tool_name, tool_input } = body

    const agentIdQuery = (req.query as Record<string, string>).agentId
    const agentId = sessionToAgent.get(session_id) ?? agentIdQuery
    if (!agentId) return reply.send({ hookSpecificOutput: { permissionDecision: 'allow' } })

    const requestId = `perm-${Date.now()}`
    const target = extractTarget(tool_input)

    broadcast({
      type: 'permission:requested',
      agentId,
      requestId,
      tool: tool_name,
      target,
      reason: tool_input.description ?? '',
    })

    const decision = await new Promise<'allow' | 'deny'>((resolve) => {
      pendingPermissions.set(requestId, resolve)
      setTimeout(() => {
        pendingPermissions.delete(requestId)
        resolve('deny')
      }, 300_000)
    })

    broadcast({ type: 'permission:resolved', agentId, requestId, decision })
    return reply.send({
      hookSpecificOutput: {
        hookEventName: 'PermissionRequest',
        permissionDecision: decision,
      },
    })
  })

  app.post('/api/permissions/:requestId/resolve', async (req, reply) => {
    const { requestId } = req.params as { requestId: string }
    const { decision } = req.body as { decision: 'allow' | 'deny' }

    const resolve = pendingPermissions.get(requestId)
    if (resolve) {
      pendingPermissions.delete(requestId)
      resolve(decision)
    }
    return reply.send({ ok: true })
  })
}
