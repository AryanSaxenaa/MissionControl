import type { FastifyInstance } from 'fastify'
import { broadcast } from '../ws.js'
import { ingestFailure, recallFailuresForTarget } from '../hydra.js'
import { incrementCounter } from '../services/agent-health.js'
import { RecordFailureSchema, CheckFailuresSchema } from '../validators.js'

export default async function failureRoutes(fastify: FastifyInstance) {
  fastify.post('/', async (req, reply) => {
    const body = RecordFailureSchema.parse(req.body)

    const related = await recallFailuresForTarget(body.target)
    const isKnown = (related.chunks ?? []).length > 0

    const sourceId = await ingestFailure({
      agentId: body.agentId,
      task: body.task,
      target: body.target,
      errorType: body.errorType,
      errorMessage: body.errorMessage,
      context: body.context,
      stackTrace: body.stackTrace,
    })

    broadcast({ type: 'failure:recorded', sourceId, agentId: body.agentId, target: body.target, errorType: body.errorType })

    return {
      sourceId,
      isKnown,
      relatedFailures: related.chunks?.map((c: any) => c.chunk_content).join('\n') ?? '',
    }
  })

  fastify.get('/check', async (req, reply) => {
    const query = CheckFailuresSchema.parse(req.query)
    const result = await recallFailuresForTarget(query.target)

    const failures = (result.chunks ?? []).map((c: any) => ({
      summary: c.chunk_content.slice(0, 300),
      errorType: c.document_metadata?.error_type ?? 'unknown',
      agentId: c.document_metadata?.agent_id ?? 'unknown',
    }))

    if (failures.length > 0) incrementCounter(query.agentId, 'warnedAbout')
    return { failures }
  })
}
