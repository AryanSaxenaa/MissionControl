import type { AgentRecord, IntentRecord } from '@missioncontrol/types'

export type { AgentRecord, IntentRecord }

export const agents = new Map<string, AgentRecord>()
export const activeIntents = new Map<string, IntentRecord>()

// sessionId → agentId (populated by session-start hook)
export const sessionToAgent = new Map<string, string>()
// sessionId → intentId
export const sessionIntents = new Map<string, string>()

export function clearSessionsForAgent(agentId: string): void {
  for (const [sessionId, aId] of sessionToAgent.entries()) {
    if (aId === agentId) {
      const intentId = sessionIntents.get(sessionId)
      if (intentId) sessionIntents.delete(sessionId)
      sessionToAgent.delete(sessionId)
    }
  }
}

export function getIntentsByAgent(agentId: string): IntentRecord[] {
  return [...activeIntents.values()].filter(i => i.agentId === agentId)
}

export function getIntentsForTarget(target: string): IntentRecord[] {
  return [...activeIntents.values()].filter(
    i =>
      (i.status === 'pending' || i.status === 'in-progress') &&
      pathsOverlap(i.target, target)
  )
}

// Collapse backslashes (Windows) to forward slashes, lowercases drive letters,
// and strips trailing slashes so cross-shell paths compare equally.
export function normalizePathSeparators(p: string): string {
  let s = p.replace(/\\/g, '/').replace(/\/+$/, '')
  return s.replace(/^([a-zA-Z]):\//, (_m, d) => d.toLowerCase() + ':/')
}

// Strips the per-agent worktree prefix so two agents writing to the same logical
// file collide even though their absolute paths differ. Two agents working on the
// same project repo will see paths like:
//   <project>/.trees/agent-AAA/README.md
//   <project>/.trees/agent-BBB/README.md
// Both must normalize to <project>/README.md for conflict detection to fire.
export function stripWorktreePrefix(p: string): string {
  return p.replace(/(^|.*?\/)\.trees\/[^/]+\/(.*)$/, '$1$2')
}

export function normalizeTarget(p: string): string {
  return stripWorktreePrefix(normalizePathSeparators(p))
}

export function clearIntentsForAgent(agentId: string): void {
  for (const [id, intent] of activeIntents.entries()) {
    if (intent.agentId === agentId) activeIntents.delete(id)
  }
}

function pathsOverlapExactOrPrefix(a: string, b: string): boolean {
  if (a === b) return true
  return a.startsWith(b + '/') || b.startsWith(a + '/')
}

function pathsOverlapTailMatch(a: string, b: string): boolean {
  return a.endsWith('/' + b) || b.endsWith('/' + a)
}

function pathsOverlapGlob(a: string, b: string): boolean {
  const escapeRegex = (s: string) => s.replace(/[.+^${}()|[\]\\]/g, '\\$&')
  const globToRegex = (g: string) => {
    const escaped = escapeRegex(g)
    const regexStr = escaped.replace(/\*+/g, (match) => {
      return match.length >= 2 ? '.*' : '[^/]*'
    })
    return new RegExp('^' + regexStr + '(/.*)?$')
  }

  if (a.includes('*')) return globToRegex(a).test(b)
  if (b.includes('*')) return globToRegex(b).test(a)
  return false
}

export function pathsOverlap(a: string, b: string): boolean {
  const na = normalizeTarget(a)
  const nb = normalizeTarget(b)

  return pathsOverlapExactOrPrefix(na, nb)
    || pathsOverlapTailMatch(na, nb)
    || pathsOverlapGlob(na, nb)
}
