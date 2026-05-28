import type { FastifyInstance } from 'fastify'
import { getWorktreeDiff, mergeWorktree, deleteWorktree } from '../services/worktree-manager.js'
import { recallContext } from '../hydra.js'
import { agents } from '../state.js'
import { destroyAgent } from '../services/agent-cleanup.js'

const inProgressOps = new Set<string>()

async function withMergeGuard(
  id: string,
  fn: () => Promise<void>
): Promise<{ ok: true } | { error: string; status: number }> {
  if (inProgressOps.has(id)) return { error: 'merge/discard already in progress', status: 409 }
  inProgressOps.add(id)
  try { await fn(); return { ok: true } }
  catch (err: any) { return { error: err?.message || String(err), status: 500 } }
  finally { inProgressOps.delete(id) }
}

export async function mergeRoutes(app: FastifyInstance) {

  app.get('/api/agents/:id/diff', async (req, reply) => {
    const { id } = req.params as { id: string }
    const agent = agents.get(id)
    if (!agent) return reply.code(404).send({ error: 'agent not found' })
    if (!agent.projectPath) return reply.code(400).send({ error: 'agent has no projectPath' })

    const projectRoot = agent.projectPath

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

  app.post('/api/agents/:id/merge', async (req, reply) => {
    const { id } = req.params as { id: string }
    const { commitMessage } = req.body as { commitMessage: string }
    const agent = agents.get(id)
    if (!agent) return reply.code(404).send({ error: 'agent not found' })
    if (!agent.projectPath) return reply.code(400).send({ error: 'agent has no projectPath' })

    const result = await withMergeGuard(id, async () => {
      await mergeWorktree(id, commitMessage, agent.projectPath!)
      destroyAgent(id)
    })
    if ('error' in result) return reply.code(result.status).send({ error: result.error })
    return reply.send({ ok: true })
  })

  app.post('/api/agents/:id/discard', async (req, reply) => {
    const { id } = req.params as { id: string }
    const agent = agents.get(id)
    if (!agent) return reply.code(404).send({ error: 'agent not found' })
    if (!agent.projectPath) return reply.code(400).send({ error: 'agent has no projectPath' })

    const result = await withMergeGuard(id, async () => {
      await deleteWorktree(id, agent.projectPath!)
      destroyAgent(id)
    })
    if ('error' in result) return reply.code(result.status).send({ error: result.error })
    return reply.send({ ok: true })
  })
}
