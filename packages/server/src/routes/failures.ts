import type { FastifyInstance } from 'fastify'
import { broadcast } from '../ws-events.js'
import { ingestFailure, recallFailuresForTarget } from '../hydra.js'
import { incrementCounter } from '../services/agent-health.js'
import { RecordFailureSchema, CheckFailuresSchema } from '../validators.js'
import type { FailureItem } from '@missioncontrol/types'

// In-memory ring buffer — last 500 failures this session
export const recentFailures: FailureItem[] = []

export default async function failureRoutes(fastify: FastifyInstance) {
  fastify.get('/', async () => {
    return recentFailures
  })

  fastify.post('/', async (req, reply) => {
    const body = RecordFailureSchema.parse(req.body)

    const [recallResult, sourceId] = await Promise.all([
      recallFailuresForTarget(body.target).catch(() => null),
      ingestFailure({
        agentId: body.agentId,
        task: body.task,
        target: body.target,
        errorType: body.errorType,
        errorMessage: body.errorMessage,
        context: body.context,
        stackTrace: body.stackTrace,
      }),
    ])

    const relatedChunks = recallResult?.chunks ?? []
    const isKnown = relatedChunks.length > 0

    const item: FailureItem = { sourceId, agentId: body.agentId, target: body.target, errorType: body.errorType, createdAt: Date.now() }
    recentFailures.unshift(item)
    if (recentFailures.length > 500) recentFailures.pop()
    broadcast({ type: 'failure:recorded', sourceId, agentId: body.agentId, target: body.target, errorType: body.errorType })

    return {
      sourceId,
      isKnown,
      relatedFailures: relatedChunks.map((c: any) => c.chunk_content).join('\n'),
    }
  })

  fastify.get('/check', async (req, reply) => {
    const query = CheckFailuresSchema.parse(req.query)

    try {
      const result = await recallFailuresForTarget(query.target)
      const failures = (result.chunks ?? []).map((c) => ({
        summary: c.chunk_content.slice(0, 300),
        errorType: (c.additional_metadata as any)?.error_type ?? 'unknown',
        agentId: (c.additional_metadata as any)?.agent_id ?? 'unknown',
      }))
      if (failures.length > 0) incrementCounter(query.agentId, 'warnedAbout')
      return { failures }
    } catch (e) {
      console.error('[failures:check] recall failed:', (e as Error).message)
      return { failures: [] }
    }
  })
}
