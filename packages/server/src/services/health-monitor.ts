import type { AgentRecord } from '@missioncontrol/types'
import { broadcast } from '../ws-events.js'
import { agents } from '../state.js'
import { ptyInstances } from './pty-spawner.js'

export function startHealthMonitor() {
  setInterval(() => {
    const now = Date.now()
    for (const [id, agent] of agents) {
      // PTY agents never send heartbeats — skip if their process is still alive
      if (ptyInstances.has(id)) continue
      if (agent.status === 'active' && now - agent.lastHeartbeat > 30000) {
        agents.set(id, { ...agent, status: 'failed' })
        broadcast({ type: 'agent:died', agentId: id })
      }
    }
  }, 5000)
}
