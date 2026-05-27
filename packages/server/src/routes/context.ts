import type { FastifyInstance } from 'fastify'
import { ingestContext, recallContext } from '../hydra.js'
import { broadcast } from '../ws-events.js'
import { incrementCounter } from '../services/agent-health.js'
import { IngestContextSchema, QueryContextSchema } from '../validators.js'
import { getGraphData } from '../services/graph-traversal.js'
import { recentDecisions } from './decisions.js'
import { recentFailures } from './failures.js'

export default async function contextRoutes(fastify: FastifyInstance) {
  fastify.post('/', async (req, reply) => {
    const body = IngestContextSchema.parse(req.body)

    const sourceId = await ingestContext({
      agentId: body.agentId,
      content: body.content,
      scope: body.scope,
      tags: body.tags,
      confidence: body.confidence,
    })
    incrementCounter(body.agentId, 'contextWrote')

    broadcast({ type: 'context:ingested', agentId: body.agentId })

    getGraphData(recentDecisions, recentFailures).then(data => {
      broadcast({ type: 'graph:snapshot', ...data } as any)
    }).catch((err: any) => {
      console.error('[context] graph snapshot broadcast failed:', err?.message || err)
    })

    return { sourceId, relatedContext: '' }
  })

  fastify.get('/query', async (req, reply) => {
    const query = QueryContextSchema.parse(req.query)
    const q = `context about ${query.scope}${query.tags ? ' related to ' + query.tags : ''}`

    try {
      const result = await recallContext(q)
      const items = (result.chunks ?? []).map((c) => ({
        content: c.chunk_content,
        score: c.relevancy_score ?? 0,
        scope: (c.additional_metadata as any)?.scope ?? 'unknown',
      }))
      incrementCounter(query.agentId, 'contextRead')
      return { items }
    } catch (e) {
      console.error('[context] recall failed:', (e as Error).message)
      return { items: [] }
    }
  })
}
