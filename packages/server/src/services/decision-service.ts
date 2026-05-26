import { recallDecisionsForTarget, whyQuery } from '../hydra.js'
import type { DecisionItem } from '@missioncontrol/types'

export interface WhyResult {
  answer: string
  chunks: any[]
  recentDecisions: DecisionItem[]
}

/**
 * Tiered fallback for explaining why a file was changed:
 * 1. Semantic search via recallDecisionsForTarget (most reliable for auto-ingested format)
 * 2. QnA via whyQuery (discarded if LLM returns boilerplate "couldn't find")
 * 3. In-memory ring buffer fallback for this session
 * 4. Graceful empty answer
 */
export async function explainWhy(
  target: string,
  recentDecisions: DecisionItem[]
): Promise<WhyResult> {
  const lowerTarget = target.toLowerCase()
  const inMemoryMatches = recentDecisions
    .filter(d => d.summary.toLowerCase().includes(lowerTarget))
    .slice(0, 10)

  let answer = ''
  let chunks: any[] = []

  try {
    const recalled = await recallDecisionsForTarget(target)
    chunks = recalled.chunks ?? []

    if (chunks.length > 0) {
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
    console.error('[decision-service] recall failed:', (e as Error).message)
    answer = inMemoryMatches.length > 0
      ? `Found ${inMemoryMatches.length} recent decision(s) (HydraDB unavailable).`
      : 'Failed to query decision memory.'
  }

  return { answer, chunks, recentDecisions: inMemoryMatches }
}
