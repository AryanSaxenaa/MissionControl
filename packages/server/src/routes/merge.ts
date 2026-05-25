import type { FastifyInstance } from 'fastify'
import { getWorktreeDiff, mergeWorktree, deleteWorktree } from '../services/worktree-manager.js'
import { recallContext } from '../hydra.js'
import { releasePort } from '../services/port-registry.js'
import { agents } from '../state.js'
import { broadcast } from '../ws-events.js'
import { clearIntentsForAgent } from '../state.js'
import { clearSessionsForAgent } from './hooks.js'

// Guard against concurrent merge/discard on the same agent
const inProgressOps = new Set<string>()

export async function mergeRoutes(app: FastifyInstance) {

  // Returns git diff + HydraDB context for merge review panel
  app.get('/api/agents/:id/diff', async (req, reply) => {
    const { id } = req.params as { id: string }
    const agent = agents.get(id)
    if (!agent) return reply.code(404).send({ error: 'agent not found' })

    const projectRoot = agent.projectPath!

    const [diff, context] = await Promise.all([
      getWorktreeDiff(id, projectRoot).catch(() => ''),
      recallContext(agent.currentTask || `agent ${id}`, 'shared').catch(() => ({ chunks: [] })),
    ])

    return reply.send({
      diff,
      agentName: agent.name,
      task: agent.currentTask,
      contextSummary: (context as any).chunks?.map((c: any) => c.chunk_content).join('\n') ?? '',
    })
  })

  // Merge worktree into main
  app.post('/api/agents/:id/merge', async (req, reply) => {
    const { id } = req.params as { id: string }
    const { commitMessage } = req.body as { commitMessage: string }
    const agent = agents.get(id)
    if (!agent) return reply.code(404).send({ error: 'agent not found' })
    if (inProgressOps.has(id)) return reply.code(409).send({ error: 'merge already in progress' })

    inProgressOps.add(id)
    try {
      await mergeWorktree(id, commitMessage, agent.projectPath!)
      releasePort(id)
      agents.delete(id)
      clearIntentsForAgent(id)
      clearSessionsForAgent(id)
      broadcast({ type: 'agent:removed', agentId: id })
      return reply.send({ ok: true })
    } catch (err: any) {
      const msg = err?.message || String(err)
      console.error(`[merge] mergeWorktree failed for ${id}:`, msg)
      return reply.code(500).send({ error: `Merge failed: ${msg}` })
    } finally {
      inProgressOps.delete(id)
    }
  })

  // Discard worktree without merging
  app.post('/api/agents/:id/discard', async (req, reply) => {
    const { id } = req.params as { id: string }
    const agent = agents.get(id)
    if (!agent) return reply.code(404).send({ error: 'agent not found' })
    if (inProgressOps.has(id)) return reply.code(409).send({ error: 'discard already in progress' })

    inProgressOps.add(id)
    try {
      await deleteWorktree(id, agent.projectPath!)
      releasePort(id)
      agents.delete(id)
      clearIntentsForAgent(id)
      clearSessionsForAgent(id)
      broadcast({ type: 'agent:removed', agentId: id })
      return reply.send({ ok: true })
    } catch (err: any) {
      const msg = err?.message || String(err)
      console.error(`[merge] deleteWorktree failed for ${id}:`, msg)
      return reply.code(500).send({ error: `Discard failed: ${msg}` })
    } finally {
      inProgressOps.delete(id)
    }
  })
}
