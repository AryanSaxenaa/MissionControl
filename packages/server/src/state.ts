import type { AgentRecord, IntentRecord } from '@missioncontrol/types'

export type { AgentRecord, IntentRecord }

export const agents = new Map<string, AgentRecord>()
export const activeIntents = new Map<string, IntentRecord>()

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

// Strips the per-agent worktree prefix so two agents writing to the same logical
// file collide even though their absolute paths differ. Two agents working on the
// same project repo will see paths like:
//   <project>/.trees/agent-AAA/README.md
//   <project>/.trees/agent-BBB/README.md
// Both must normalize to <project>/README.md for conflict detection to fire.
//
// Also collapses backslashes (Windows) to forward slashes and lowercases drive
// letters so cross-shell paths compare equally.
export function normalizeTarget(p: string): string {
  let s = p.replace(/\\/g, '/').replace(/\/+$/, '')
  // Lowercase Windows drive letter: C:/... -> c:/...
  s = s.replace(/^([a-zA-Z]):\//, (_m, d) => d.toLowerCase() + ':/')
  // Strip per-agent worktree segment: .../.trees/<agentId>/<rest> -> .../<rest>
  s = s.replace(/(^|.*?\/)\.trees\/[^/]+\/(.*)$/, '$1$2')
  return s
}

export function clearIntentsForAgent(agentId: string): void {
  for (const [id, intent] of activeIntents.entries()) {
    if (intent.agentId === agentId) activeIntents.delete(id)
  }
}

export function pathsOverlap(a: string, b: string): boolean {
  const na = normalizeTarget(a)
  const nb = normalizeTarget(b)

  if (na === nb) return true
  if (na.startsWith(nb + '/') || nb.startsWith(na + '/')) return true

  // Same basename in two different worktrees is the common multi-agent case:
  // even if the prefix differs (e.g. one path was already absolute, the other
  // relative), matching the trailing path segments catches it.
  const tailA = na.split('/').slice(-2).join('/')
  const tailB = nb.split('/').slice(-2).join('/')
  if (tailA && tailA === tailB) return true

  const escapeRegex = (s: string) => s.replace(/[.+^${}()|[\]\\]/g, '\\$&')
  const globToRegex = (g: string) =>
    new RegExp('^' + escapeRegex(g).replace(/\*\*/g, '.*').replace(/\*/g, '[^/]*') + '(/.*)?$')

  if (a.includes('*')) return globToRegex(a).test(b)
  if (b.includes('*')) return globToRegex(b).test(a)

  return false
}
