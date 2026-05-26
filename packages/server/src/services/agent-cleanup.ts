import { agents, clearIntentsForAgent, clearSessionsForAgent } from '../state.js'
import { releasePort } from '../services/port-registry.js'
import { broadcast } from '../ws-events.js'

/**
 * Single canonical cleanup for removing an agent from all subsystems.
 * Called from kill, merge, and discard paths — no more copy-paste.
 */
export function destroyAgent(agentId: string) {
  releasePort(agentId)
  agents.delete(agentId)
  clearIntentsForAgent(agentId)
  clearSessionsForAgent(agentId)
  broadcast({ type: 'agent:removed', agentId })
}
