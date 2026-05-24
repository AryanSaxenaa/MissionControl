import Anthropic from '@anthropic-ai/sdk'
import { IntentRecord, activeIntents, getIntentsForTarget, pathsOverlap } from '../state.js'
import { recallDecisionsForTarget } from '../hydra.js'
import type { ConflictResult } from '@missioncontrol/types'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export { ConflictResult, pathsOverlap }

export async function detectConflicts(newIntent: IntentRecord): Promise<ConflictResult[]> {
  const conflicts: ConflictResult[] = []

  const overlappingIntents = getIntentsForTarget(newIntent.target).filter(
    i => i.id !== newIntent.id && i.agentId !== newIntent.agentId
  )

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

  const semanticCandidates = overlappingIntents.filter(
    i => !fileConflicts.includes(i)
  )

  // Parallelize semantic checks
  const semanticChecks = await Promise.all(
    semanticCandidates.map(async (candidate) => {
      const isConflicting = await checkSemanticConflict(newIntent, candidate)
      return isConflicting ? candidate : null
    })
  )

  for (const candidate of semanticChecks.filter(Boolean)) {
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

  if (conflicts.filter(c => c.severity === 'critical').length === 0) {
    try {
      const decisions = await recallDecisionsForTarget(newIntent.target)
      const decisionText = decisions.chunks?.map((c: any) => c.chunk_content).join('\n') ?? ''

      if (decisionText.trim()) {
        const architecturalConflict = await checkArchitecturalConflict(newIntent, decisionText)
        if (architecturalConflict) {
          conflicts.push({
            id: `conflict-${Date.now()}-${Math.random().toString(36).slice(2)}`,
            severity: 'warning',
            kind: 'architectural',
            description: `${newIntent.description} may contradict architectural decisions: ${architecturalConflict}`,
            agentIds: [newIntent.agentId],
            intentIds: [newIntent.id],
            createdAt: Date.now(),
          })
        }
      }
    } catch {
      // architectural check failed (timeout or network) — skip, not critical
    }
  }

  return conflicts
}

async function checkSemanticConflict(a: IntentRecord, b: IntentRecord): Promise<boolean> {
  if (!anthropic.apiKey) return false
  try {
    const resp = await anthropic.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 100,
      messages: [{
        role: 'user',
        content: `Do these two coding agent intents semantically conflict? Answer YES or NO only.\nIntent A (agent: ${a.agentId}): ${a.description} [target: ${a.target}]\nIntent B (agent: ${b.agentId}): ${b.description} [target: ${b.target}]`,
      }],
    })
    const text = resp.content[0].type === 'text' ? resp.content[0].text : ''
    return text.trim().toUpperCase().startsWith('YES')
  } catch {
    return false
  }
}

async function checkArchitecturalConflict(intent: IntentRecord, decisionContext: string): Promise<string | null> {
  if (!anthropic.apiKey) return null
  try {
    const resp = await anthropic.messages.create({
      model: 'claude-3-haiku-20240307',
      max_tokens: 150,
      messages: [{
        role: 'user',
        content: `Does this agent intent contradict any of the architectural decisions listed below?\nAnswer "NO" if no conflict, or a single sentence describing the contradiction if yes.\n\nIntent: ${intent.description} [target: ${intent.target}]\n\nArchitectural decisions:\n${decisionContext}`,
      }],
    })
    const text = resp.content[0].type === 'text' ? resp.content[0].text.trim() : ''
    return text.toUpperCase().startsWith('NO') ? null : text
  } catch {
    return null
  }
}

function isWriteOperation(action: IntentRecord['action']): boolean {
  return ['write', 'refactor', 'delete', 'create'].includes(action)
}
