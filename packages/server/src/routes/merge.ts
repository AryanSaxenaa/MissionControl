import type { FastifyInstance } from 'fastify'
import { getWorktreeDiff, mergeWorktree, deleteWorktree } from '../services/worktree-manager.js'
import { recallContext } from '../hydra.js'
import { releasePort } from '../services/port-registry.js'
import { agents } from '../state.js'
import { broadcast } from '../ws-events.js'

export async function mergeRoutes(app: FastifyInstance) {

  // Returns git diff + HydraDB context for merge review panel
  app.get('/api/agents/:id/diff', async (req, reply) => {
    const { id } = req.params as { id: string }
    const agent = agents.get(id)
    if (!agent) return reply.code(404).send({ error: 'agent not found' })

    const [diff, context] = await Promise.all([
      getWorktreeDiff(id).catch(() => ''),
      recallContext(`what did agent ${id} work on`, `agent-${id}`).catch(() => ({ chunks: [] })),
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

    await mergeWorktree(id, commitMessage)
    releasePort(id)
    agents.delete(id)
    broadcast({ type: 'agent:removed', agentId: id })

    return reply.send({ ok: true })
  })

  // Discard worktree without merging
  app.post('/api/agents/:id/discard', async (req, reply) => {
    const { id } = req.params as { id: string }

    await deleteWorktree(id)
    releasePort(id)
    agents.delete(id)
    broadcast({ type: 'agent:removed', agentId: id })

    return reply.send({ ok: true })
  })
}
