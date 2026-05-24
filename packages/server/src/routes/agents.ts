import type { FastifyInstance } from 'fastify'
import { v4 as uuidv4 } from 'uuid'
import { agents, type AgentRecord } from '../state.js'
import { broadcast } from '../ws.js'
import { recallParentContext, ingestAgentSummary } from '../hydra.js'
import { computeContextRichness, incrementCounter } from '../services/agent-health.js'
import { RegisterAgentSchema, HeartbeatSchema } from '../validators.js'

export default async function agentRoutes(fastify: FastifyInstance) {
  fastify.post('/register', async (req, reply) => {
    const body = RegisterAgentSchema.parse(req.body)

    const agentId = `agent-${uuidv4()}`
    let inheritedContext = ''

    const newAgent: AgentRecord = {
      id: agentId,
      name: body.name,
      kind: body.kind,
      pid: body.pid,
      status: 'active',
      spawnedAt: Date.now(),
      lastHeartbeat: Date.now(),
      contextRichness: 0,
      parentAgentId: body.parentAgentId,
    }

    agents.set(agentId, newAgent)

    if (body.parentAgentId) {
      const recalled = await recallParentContext(body.parentAgentId)
      if (recalled.chunks?.length) {
        inheritedContext = recalled.chunks
          .slice(0, 20)
          .map((c: any) => c.chunk_content)
          .join('\n---\n')

        await ingestAgentSummary(
          agentId,
          `Inherited context from parent agent ${body.parentAgentId}:\n${inheritedContext}`
        )

        incrementCounter(agentId, 'inherited', recalled.chunks.length)
      }

      broadcast({ type: 'agent:registered', agent: { ...agents.get(agentId)!, parentAgentId: body.parentAgentId } })
    } else {
      broadcast({ type: 'agent:registered', agent: newAgent })
    }

    return { agentId, inheritedContext }
  })

  fastify.post('/:id/heartbeat', async (req, reply) => {
    const { id } = req.params as Record<string, string>
    const body = HeartbeatSchema.parse(req.body)

    const agent = agents.get(id)
    if (!agent) return reply.status(404).send({ error: 'Agent not found' })

    agent.status = body.status
    agent.currentTask = body.currentTask
    agent.lastHeartbeat = Date.now()
    agent.contextRichness = await computeContextRichness(id)

    broadcast({ type: 'agent:heartbeat', agentId: id, status: body.status, task: body.currentTask })
    return { ok: true }
  })
}
