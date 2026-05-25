import type { AgentRecord } from '@missioncontrol/types'
import { broadcast } from '../ws-events.js'
import { agents } from '../state.js'

export function startHealthMonitor() {
  setInterval(() => {
    const now = Date.now()
    for (const [id, agent] of agents) {
      if (agent.status === 'active' && now - agent.lastHeartbeat > 30000) {
        agents.set(id, { ...agent, status: 'failed' })
        broadcast({ type: 'agent:died', agentId: id })
      }
    }
  }, 5000)
}
