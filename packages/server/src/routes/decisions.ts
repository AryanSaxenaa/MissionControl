import type { FastifyInstance } from 'fastify'
import { broadcast } from '../ws-events.js'
import { ingestDecision } from '../hydra.js'
import { explainWhy } from '../services/decision-service.js'
import { RecordDecisionSchema, WhyQuerySchema } from '../validators.js'
import type { DecisionItem } from '@missioncontrol/types'

export const recentDecisions: DecisionItem[] = []

export default async function decisionRoutes(fastify: FastifyInstance) {
  fastify.get('/', async () => recentDecisions)

  fastify.post('/', async (req, reply) => {
    const body = RecordDecisionSchema.parse(req.body)
    const target = body.affectedFiles?.[0] ?? ''

    const sourceId = await ingestDecision({
      agentId: body.agentId,
      summary: body.summary,
      reasoning: body.reasoning,
      alternativesConsidered: body.alternativesConsidered,
      affectedFiles: body.affectedFiles,
      tags: body.tags,
    })

    const item: DecisionItem = { sourceId, agentId: body.agentId, target, summary: body.summary, createdAt: Date.now() }
    recentDecisions.unshift(item)
    if (recentDecisions.length > 200) recentDecisions.pop()
    broadcast({ type: 'decision:recorded', sourceId, agentId: body.agentId, target, summary: body.summary })
    return { sourceId }
  })

  fastify.get('/why', async (req, reply) => {
    const query = WhyQuerySchema.parse(req.query)
    const result = await explainWhy(query.target)
    return result
  })
}
