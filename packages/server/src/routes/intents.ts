import type { FastifyInstance } from 'fastify'
import { v4 as uuidv4 } from 'uuid'
import { activeIntents, type IntentRecord, agents } from '../state.js'
import { broadcast } from '../ws-events.js'
import { detectConflicts } from '../services/conflict-detector.js'
import { ingestAgentSummary } from '../hydra.js'
import { DeclareIntentSchema, UpdateIntentSchema } from '../validators.js'
import { trackConflict } from './conflicts.js'

export default async function intentRoutes(fastify: FastifyInstance) {
  fastify.get('/', async () => {
    return [...activeIntents.values()]
  })

  fastify.post('/', async (req, reply) => {
    const body = DeclareIntentSchema.parse(req.body)

    const intent: IntentRecord = {
      id: `intent-${uuidv4()}`,
      agentId: body.agentId,
      action: body.action,
      target: body.target,
      description: body.description,
      status: 'in-progress',
      startedAt: Date.now(),
    }

    activeIntents.set(intent.id, intent)

    const conflicts = await detectConflicts(intent)
    broadcast({ type: 'intent:declared', intent })

    for (const c of conflicts) {
      trackConflict(c)
      broadcast({ type: 'conflict:detected', conflict: c })
    }

    return { intentId: intent.id, conflicts, relevantContext: '' }
  })

  fastify.patch('/:id', async (req, reply) => {
    const { id } = req.params as Record<string, string>
    const body = UpdateIntentSchema.parse(req.body)

    const intent = activeIntents.get(id)
    if (!intent) return reply.status(404).send({ error: 'Intent not found' })

    intent.status = body.status
    broadcast({ type: 'intent:updated', intentId: id, status: body.status })

    if (body.status === 'completed' || body.status === 'cancelled') {
      setTimeout(() => {
        activeIntents.delete(id)
      }, 60000)

      if (body.status === 'completed') {
        await ingestAgentSummary(intent.agentId, `Completed intent: ${intent.description} on ${intent.target}`)
      }
    }

    return { ok: true }
  })
}
