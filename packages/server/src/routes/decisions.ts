import type { FastifyInstance } from 'fastify'
import { broadcast } from '../ws.js'
import { ingestDecision, whyQuery } from '../hydra.js'
import { RecordDecisionSchema, WhyQuerySchema } from '../validators.js'

export default async function decisionRoutes(fastify: FastifyInstance) {
  fastify.post('/', async (req, reply) => {
    const body = RecordDecisionSchema.parse(req.body)

    const sourceId = await ingestDecision({
      agentId: body.agentId,
      summary: body.summary,
      reasoning: body.reasoning,
      alternativesConsidered: body.alternativesConsidered,
      affectedFiles: body.affectedFiles,
      tags: body.tags,
    })

    broadcast({ type: 'decision:recorded', sourceId, agentId: body.agentId, summary: body.summary })
    return { sourceId }
  })

  fastify.get('/why', async (req, reply) => {
    const query = WhyQuerySchema.parse(req.query)
    try {
      const result = await whyQuery(query.target)
      return { answer: result.answer ?? 'No answer available', chunks: result.chunks ?? [] }
    } catch (e) {
      console.error('[decisions:why] query failed:', (e as Error).message)
      return { answer: 'HydraDB is still indexing. Check back soon.', chunks: [] }
    }
  })
}
