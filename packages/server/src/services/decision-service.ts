import { recallDecisionsForTarget, whyQuery } from '../hydra.js'
import type { DecisionItem } from '@missioncontrol/types'

export interface WhyResult {
  answer: string
  chunks: any[]
}

/**
 * 1. Semantic search via recallDecisionsForTarget (most reliable for auto-ingested format)
 * 2. QnA via whyQuery (discarded if LLM returns boilerplate "couldn't find")
 */
export async function explainWhy(target: string): Promise<WhyResult> {
  let answer = ''
  let chunks: any[] = []

  const recalled = await recallDecisionsForTarget(target)
  chunks = recalled.chunks ?? []

  if (chunks.length > 0) {
    const qna = await whyQuery(target)
    const isBoilerplate = !qna.answer ||
      qna.answer.toLowerCase().includes("couldn't find") ||
      qna.answer.toLowerCase().includes("no relevant") ||
      qna.answer.toLowerCase().includes("not enough")
    answer = isBoilerplate
      ? `Found ${chunks.length} decision record(s) for "${target}".`
      : (qna.answer ?? '')
  } else {
    answer = `No decisions recorded for "${target}" yet. Decisions are logged automatically when agents write files.`
  }

  return { answer, chunks }
}
