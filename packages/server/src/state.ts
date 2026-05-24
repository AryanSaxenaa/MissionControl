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

export function pathsOverlap(a: string, b: string): boolean {
  const normalize = (p: string) => p.replace(/\/+$/, '')
  const na = normalize(a)
  const nb = normalize(b)

  if (na === nb) return true
  if (na.startsWith(nb + '/') || nb.startsWith(na + '/')) return true

  const escapeRegex = (s: string) => s.replace(/[.+^${}()|[\]\\]/g, '\\$&')
  const globToRegex = (g: string) =>
    new RegExp('^' + escapeRegex(g).replace(/\*\*/g, '.*').replace(/\*/g, '[^/]*') + '(/.*)?$')

  if (a.includes('*')) return globToRegex(a).test(b)
  if (b.includes('*')) return globToRegex(b).test(a)

  return false
}
