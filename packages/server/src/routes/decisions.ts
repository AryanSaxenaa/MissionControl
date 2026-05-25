import type { FastifyInstance } from 'fastify'
import { broadcast } from '../ws-events.js'
import { ingestDecision, recallDecisionsForTarget, whyQuery } from '../hydra.js'
import { RecordDecisionSchema, WhyQuerySchema } from '../validators.js'
import type { DecisionItem } from '@missioncontrol/types'

// In-memory ring buffer — last 200 decisions this session
export const recentDecisions: DecisionItem[] = []

export default async function decisionRoutes(fastify: FastifyInstance) {
  fastify.get('/', async () => {
    return recentDecisions
  })

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

    const item: DecisionItem = { sourceId, agentId: body.agentId, summary: body.summary, createdAt: Date.now() }
    recentDecisions.unshift(item)
    if (recentDecisions.length > 200) recentDecisions.pop()
    broadcast({ type: 'decision:recorded', sourceId, agentId: body.agentId, summary: body.summary })
    return { sourceId }
  })

  fastify.get('/why', async (req, reply) => {
    const query = WhyQuerySchema.parse(req.query)
    const target = query.target

    // Check in-memory ring buffer first — HydraDB indexing is async, this is immediate
    const lowerTarget = target.toLowerCase()
    const inMemoryMatches = recentDecisions
      .filter(d => d.summary.toLowerCase().includes(lowerTarget))
      .slice(0, 10)

    let answer = ''
    let chunks: any[] = []

    try {
      // Semantic search is more reliable than QnA for our auto-ingested format
      const recalled = await recallDecisionsForTarget(target)
      chunks = recalled.chunks ?? []

      if (chunks.length > 0) {
        // Try QnA for a synthesized answer — discard if it's the "couldn't find" boilerplate
        try {
          const qna = await whyQuery(target)
          const isBoilerplate = !qna.answer ||
            qna.answer.toLowerCase().includes("couldn't find") ||
            qna.answer.toLowerCase().includes("no relevant") ||
            qna.answer.toLowerCase().includes("not enough")
          answer = isBoilerplate
            ? `Found ${chunks.length} decision record(s) for "${target}".`
            : (qna.answer ?? '')
        } catch {
          answer = `Found ${chunks.length} decision record(s) for "${target}".`
        }
      } else if (inMemoryMatches.length > 0) {
        answer = `Found ${inMemoryMatches.length} recent decision(s) — HydraDB is still indexing this session's data.`
      } else {
        answer = `No decisions recorded for "${target}" yet. Decisions are logged automatically when agents write files.`
      }
    } catch (e) {
      console.error('[decisions:why] recall failed:', (e as Error).message)
      answer = inMemoryMatches.length > 0
        ? `Found ${inMemoryMatches.length} recent decision(s) (HydraDB unavailable).`
        : 'Failed to query decision memory.'
    }

    return { answer, chunks, recentDecisions: inMemoryMatches }
  })
}
