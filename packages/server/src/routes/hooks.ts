import type { FastifyInstance } from 'fastify'
import type { HookPayload } from '@missioncontrol/types'
import { detectConflicts } from '../services/conflict-detector.js'
import { broadcast } from '../ws-events.js'
import { activeIntents, getIntentsForTarget } from '../state.js'
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

// sessionId → agentId (populated by session-start hook)
export const sessionToAgent = new Map<string, string>()
// sessionId → intentId
const sessionIntents = new Map<string, string>()

export function clearSessionsForAgent(agentId: string): void {
  for (const [sessionId, aId] of sessionToAgent.entries()) {
    if (aId === agentId) {
      const intentId = sessionIntents.get(sessionId)
      if (intentId) sessionIntents.delete(sessionId)
      sessionToAgent.delete(sessionId)
    }
  }
}

export async function hooksRoutes(app: FastifyInstance) {

  // Register session → agent mapping (called by each agent CLI on startup)
  // agentId comes from body (OpenCode plugin) OR from ?agentId= query param (CC/Codex hook URLs)
  app.post('/hooks/session-start', async (req, reply) => {
    const body         = req.body as { session_id?: string; agentId?: string }
    const agentIdQuery = (req.query as Record<string, string>).agentId
    const agentId      = body.agentId ?? agentIdQuery
    if (body.session_id && agentId) {
      sessionToAgent.set(body.session_id, agentId)
    }
    return reply.send({ ok: true })
  })

  // Called by OpenCode plugin when session goes idle (agent finished)
  app.post('/hooks/session-idle', async (req, reply) => {
    const body = req.body as { session_id?: string; agentId?: string }
    const agentId = body.agentId ?? (body.session_id ? sessionToAgent.get(body.session_id) : undefined)
    if (agentId) {
      broadcast({ type: 'agent:completed', agentId })
      broadcast({ type: 'agent:ready-to-merge', agentId })
    }
    return reply.send({ ok: true })
  })

  // PreToolUse — runs before every Write/Edit/Bash tool call
  app.post('/hooks/pre-tool-use', async (req, reply) => {
    const body = req.body as HookPayload
    const { tool_name, tool_input, session_id } = body

    if (!WRITE_TOOLS.includes(tool_name)) {
      return reply.send({})
    }

    const agentIdQuery = (req.query as Record<string, string>).agentId
    const agentId = sessionToAgent.get(session_id) ?? agentIdQuery
    if (!agentId) return reply.send({})

    const target = extractTarget(tool_input)

    // Preflight failure check
    try {
      const result = await recallFailuresForTarget(target)
      if (result.chunks?.length) {
        broadcast({ type: 'failure:recorded', sourceId: '', agentId, target, errorType: 'known-risk' })
      }
    } catch (e: any) {
      console.error(`[hooks/pre] recallFailuresForTarget(${target}) failed:`, e?.message || e)
    }

    // Declare intent + run conflict detection
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
    broadcast({ type: 'intent:declared', intent })

    let conflicts: import('@missioncontrol/types').ConflictResult[] = []
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

    sessionIntents.set(session_id, intentId)

    // Inform this agent if other agents have active intents on the same target.
    // This is how peer-awareness reaches a running agent — Claude Code injects
    // additionalContext into the conversation so the model can see it before
    // proceeding with the write.
    const peers = getIntentsForTarget(target).filter(i => i.agentId !== agentId && i.id !== intentId)
    if (peers.length > 0) {
      const peerSummary = peers
        .map(p => `  - ${p.agentId}: ${p.description} (started ${new Date(p.startedAt).toISOString()})`)
        .join('\n')
      const additionalContext =
        `[MissionControl] ${peers.length} other agent(s) currently have active intents on this target:\n${peerSummary}\n` +
        `Coordinate or wait if your change might conflict with theirs.`
      const peerConflict = {
        id: `peer-${intentId}`,
        severity: 'warning' as const,
        kind: 'file' as const,
        description: `${agentId} editing ${target} while ${peers.map(p => p.agentId).join(', ')} also have active intents on it`,
        agentIds: [agentId, ...peers.map(p => p.agentId)],
        intentIds: [intentId, ...peers.map(p => p.id)],
        createdAt: Date.now(),
      }
      trackConflict(peerConflict)
      broadcast({ type: 'conflict:detected', conflict: peerConflict })
      return reply.send({
        hookSpecificOutput: {
          hookEventName: 'PreToolUse',
          additionalContext,
        },
      })
    }

    return reply.send({})
  })

  // PostToolUse — runs after every Write/Edit/Bash
  app.post('/hooks/post-tool-use', async (req, reply) => {
    const body = req.body as HookPayload
    const { tool_name, tool_input, tool_response, session_id } = body

    if (!WRITE_TOOLS.includes(tool_name)) return reply.send({})

    const agentIdQuery = (req.query as Record<string, string>).agentId
    const agentId = sessionToAgent.get(session_id) ?? agentIdQuery
    if (!agentId) return reply.send({})

    // Complete the pending intent
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

    // 1. Always ingest context into HydraDB — this is what populates the Knowledge Graph
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

    // 2. Auto-ingest a decision record into HydraDB when a file is written.
    //    This makes the Decision Log and Why? panel populate automatically from
    //    every agent write — no SDK instrumentation required.
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
        const item: DecisionItem = { sourceId, agentId, summary, createdAt: Date.now() }
        recentDecisions.unshift(item)
        if (recentDecisions.length > 200) recentDecisions.pop()
        broadcast({ type: 'decision:recorded', sourceId, agentId, summary })
      }).catch((e: any) => {
        console.error(`[hooks/post] ingestDecision failed for ${agentId} → ${target}:`, e?.message || e)
      })
    }

    // 3. Auto-detect bash failures from tool_response exit codes.
    //    If a Bash command returns non-zero, record it as a failure in HydraDB.
    //    This makes the Failure Memory populate automatically from real command errors.
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

  // PermissionRequest — suspends agent until user responds in dashboard
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

    // Wait for user decision (5 min timeout → default allow)
    const decision = await new Promise<'allow' | 'deny'>((resolve) => {
      pendingPermissions.set(requestId, resolve)
      setTimeout(() => {
        pendingPermissions.delete(requestId)
        resolve('allow')
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

  // Dashboard resolves a pending permission
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
