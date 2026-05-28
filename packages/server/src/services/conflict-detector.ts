/**
 * Conflict detector pipeline:
 *
 * Step 1 (file): in-memory, synchronous.
 * Step 2 (semantic): OpenRouter owl-alpha.
 * Step 3 (architectural): HydraDB recall + OpenRouter owl-alpha.
 */

import { IntentRecord, activeIntents, getIntentsForTarget, pathsOverlap } from '../state.js'
import { recallDecisionsForTarget, whyQuery } from '../hydra.js'
import type { ConflictResult } from '@missioncontrol/types'

export { ConflictResult, pathsOverlap }

const OPENROUTER_BASE = 'https://openrouter.ai/api/v1'
const OPENROUTER_MODEL = 'openrouter/owl-alpha'

interface OpenRouterResponse {
  choices?: { message?: { content?: string } }[]
}

class OpenRouterError extends Error {
  constructor(message: string, public cause?: string) {
    super(`[OpenRouter] ${message}`)
    this.name = 'OpenRouterError'
  }
}

async function openRouterChat(prompt: string, maxTokens = 150): Promise<string> {
  const key = process.env.OPENROUTER_API_KEY
  if (!key) throw new OpenRouterError('OPENROUTER_API_KEY not set — semantic/architectural conflict detection skipped')
  let resp: Response
  try {
    resp = await fetch(`${OPENROUTER_BASE}/chat/completions`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://github.com/missioncontrol',
        'X-Title': 'MissionControl Conflict Detector',
      },
      body: JSON.stringify({
        model: OPENROUTER_MODEL,
        max_tokens: maxTokens,
        messages: [{ role: 'user', content: prompt }],
      }),
      signal: AbortSignal.timeout(10_000),
    })
  } catch (err: any) {
    const cause = err?.name === 'AbortError' ? 'timeout' : err?.message ?? 'unknown'
    throw new OpenRouterError(`network failure: ${cause}`, cause)
  }
  if (!resp.ok) {
    throw new OpenRouterError(`HTTP ${resp.status}: ${resp.statusText}`)
  }
  const data = await resp.json() as OpenRouterResponse
  return data.choices?.[0]?.message?.content?.trim() ?? ''
}

export async function detectConflicts(newIntent: IntentRecord): Promise<ConflictResult[]> {
  const conflicts: ConflictResult[] = []

  const overlappingIntents = getIntentsForTarget(newIntent.target).filter(
    i => i.id !== newIntent.id && i.agentId !== newIntent.agentId
  )

  // Step 1 — file-level: two agents writing to the same target = critical
  const fileConflicts = overlappingIntents.filter(
    i => isWriteOperation(i.action) && isWriteOperation(newIntent.action)
  )

  for (const existing of fileConflicts) {
    conflicts.push({
      id: `conflict-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      severity: 'critical',
      kind: 'file',
      description: `${newIntent.agentId} and ${existing.agentId} both intend to write to ${newIntent.target}`,
      agentIds: [newIntent.agentId, existing.agentId],
      intentIds: [newIntent.id, existing.id],
      createdAt: Date.now(),
    })
  }

  // Step 2 — semantic: use OpenRouter owl-alpha
  const semanticCandidates = overlappingIntents.filter(i => !fileConflicts.includes(i))
  const semanticChecks = await Promise.allSettled(
    semanticCandidates.map(async (candidate) => {
      const answer = await openRouterChat(
        `Do these two coding agent intents semantically conflict? Answer YES or NO only.\n` +
        `Intent A (agent: ${newIntent.agentId}): ${newIntent.description} [target: ${newIntent.target}]\n` +
        `Intent B (agent: ${candidate.agentId}): ${candidate.description} [target: ${candidate.target}]`,
        50
      )
      return answer.toUpperCase().startsWith('YES') ? candidate : null
    })
  )

  for (const result of semanticChecks) {
    if (result.status === 'rejected') {
      console.error(`[conflict-detector] semantic check failed:`, (result.reason as any)?.message || result.reason)
      continue
    }
    const candidate = result.value
    if (!candidate) continue
    conflicts.push({
      id: `conflict-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      severity: 'warning',
      kind: 'semantic',
      description: `Potential semantic conflict between ${newIntent.agentId} (${newIntent.description}) and ${candidate!.agentId} (${candidate!.description})`,
      agentIds: [newIntent.agentId, candidate!.agentId],
      intentIds: [newIntent.id, candidate!.id],
      createdAt: Date.now(),
    })
  }

  // Step 3 — architectural: HydraDB recall + OpenRouter owl-alpha
  // HydraDB already has graph-enriched decision memory.
  // We query it first, then let owl-alpha reason about the contradiction.
  if (conflicts.filter(c => c.severity === 'critical').length === 0) {
    try {
      const decisions = await recallDecisionsForTarget(newIntent.target)
      const decisionText = decisions.chunks?.map((c: any) => c.chunk_content).join('\n') ?? ''

      if (decisionText.trim()) {
        const answer = await openRouterChat(
          `Does this agent intent contradict any of the architectural decisions below?\n` +
          `Answer "NO" if no conflict, or one sentence describing the contradiction.\n\n` +
          `Intent: ${newIntent.description} [target: ${newIntent.target}]\n\n` +
          `Architectural decisions from HydraDB memory:\n${decisionText}`,
          150
        )
        if (answer && !answer.toUpperCase().startsWith('NO')) {
          conflicts.push({
            id: `conflict-${Date.now()}-${Math.random().toString(36).slice(2)}`,
            severity: 'warning',
            kind: 'architectural',
            description: `${newIntent.description} may contradict architectural decisions: ${answer}`,
            agentIds: [newIntent.agentId],
            intentIds: [newIntent.id],
            createdAt: Date.now(),
          })
        }
      }
    } catch (err: any) {
      console.error(`[conflict-detector] architectural check failed:`, err?.message || err)
    }
  }

  return conflicts
}

function isWriteOperation(action: IntentRecord['action']): boolean {
  return ['write', 'refactor', 'delete', 'create'].includes(action)
}
