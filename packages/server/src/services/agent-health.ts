import { agents } from '../state.js'

interface AgentCounters {
  inherited: number
  contextRead: number
  contextWrote: number
  warnedAbout: number
}

const agentCounters = new Map<string, AgentCounters>()

function defaultCounters(): AgentCounters {
  return { inherited: 0, contextRead: 0, contextWrote: 0, warnedAbout: 0 }
}

export function incrementCounter(agentId: string, key: keyof AgentCounters, amount = 1) {
  const counters = agentCounters.get(agentId) ?? defaultCounters()
  counters[key] += amount
  agentCounters.set(agentId, counters)
}

export async function computeContextRichness(agentId: string): Promise<number> {
  const counters = agentCounters.get(agentId) ?? defaultCounters()

  const score = Math.min(100,
    counters.inherited * 15 +
    counters.contextRead * 3 +
    counters.contextWrote * 5 +
    counters.warnedAbout * 8
  )
  return Math.round(score)
}
