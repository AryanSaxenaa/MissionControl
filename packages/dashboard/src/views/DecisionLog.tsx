import { useState } from 'react'
import { useMissionControlStore } from '../store/useStore'

interface WhyResult {
  answer: string
  chunks: { chunk_content?: string; relevancy_score?: number }[]
  recentDecisions: { sourceId: string; agentId: string; summary: string; createdAt: number }[]
}

// Extract the logical file path from an auto-generated summary like:
// "Agent agent-bc36... modified C:\..\.trees\agent-bc36...\src\index.ts: Edit"
function extractPathFromSummary(summary: string): string {
  const match = summary.match(/modified (.+?)(?::\s*\w+\s*)?$/)
  if (match) {
    const raw = match[1].trim()
    // Strip worktree prefix: anything up to and including \.trees\<agentId>\
    const stripped = raw.replace(/.*[/\\]\.trees[/\\][^/\\]+[/\\]/i, '')
    return stripped.replace(/\\/g, '/') || raw
  }
  return summary
}

export default function DecisionLog() {
  const store = useMissionControlStore()
  const [whyTarget, setWhyTarget] = useState('')
  const [whyResult, setWhyResult] = useState<WhyResult | null>(null)
  const [whyLoading, setWhyLoading] = useState(false)

  const queryWhy = async () => {
    if (!whyTarget.trim()) return
    setWhyLoading(true); setWhyResult(null)
    try {
      const r = await fetch(`/api/decisions/why?target=${encodeURIComponent(whyTarget.trim())}`)
      const data = await r.json()
      setWhyResult(data)
    } catch {
      setWhyResult({ answer: 'Failed to query memory.', chunks: [], recentDecisions: [] })
    } finally {
      setWhyLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-full gap-4">
      <h2 className="text-[18px] uppercase tracking-[0.12em] font-bold text-white">
        Decision Log
      </h2>

      {/* Why? panel */}
      <div className="border border-[#171717] bg-[#020202] p-5 flex-shrink-0">
        <div className="text-xs text-orange-500 uppercase tracking-widest mb-3">Why? — Query Decision Memory</div>
        <div className="flex gap-2">
          <input
            value={whyTarget}
            onChange={e => setWhyTarget(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && queryWhy()}
            placeholder="e.g. src/index.ts or auth module"
            className="flex-1 bg-black border border-[#2a2a2a] text-[#d4d4d4] text-sm font-mono px-3 py-2 outline-none focus:border-orange-500 placeholder-[#444]"
          />
          <button
            onClick={queryWhy}
            disabled={whyLoading || !whyTarget.trim()}
            className="px-5 py-2 border border-orange-500 text-orange-500 text-xs uppercase tracking-wider hover:bg-orange-500 hover:text-black disabled:opacity-40 transition-all"
          >
            {whyLoading ? '...' : 'Ask'}
          </button>
        </div>

        {whyResult && (
          <div className="mt-3 border-t border-[#171717] pt-3 space-y-3">
            <p className="text-sm text-[#d4d4d4] font-mono leading-relaxed">{whyResult.answer}</p>

            {/* HydraDB semantic matches */}
            {whyResult.chunks.length > 0 && (
              <div className="space-y-2">
                <div className="text-[10px] text-[#555] uppercase tracking-widest">HydraDB matches</div>
                {whyResult.chunks.slice(0, 5).map((c, i) => (
                  <div key={i} className="bg-[#0a0a0a] border border-[#1a1a1a] p-3 text-xs text-[#999] font-mono leading-relaxed">
                    {c.chunk_content ?? ''}
                  </div>
                ))}
              </div>
            )}

            {/* In-memory fallback when HydraDB hasn't indexed yet */}
            {whyResult.chunks.length === 0 && whyResult.recentDecisions.length > 0 && (
              <div className="space-y-2">
                <div className="text-[10px] text-[#555] uppercase tracking-widest">This session</div>
                {whyResult.recentDecisions.map(d => (
                  <div key={d.sourceId} className="bg-[#0a0a0a] border border-[#1a1a1a] p-3 text-xs text-[#999] font-mono leading-relaxed">
                    <span className="text-[#555]">{d.agentId.slice(0, 14)} · </span>
                    {d.summary}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Decision list */}
      {store.decisions.length === 0 ? (
        <div className="flex-1 border border-[#171717] flex items-center justify-center">
          <span className="text-[#555] text-sm uppercase tracking-widest">No decisions recorded.</span>
        </div>
      ) : (
        <div className="space-y-2 overflow-auto flex-1">
          {store.decisions.map(d => (
            <div
              key={d.sourceId}
              className="border border-[#171717] bg-[#020202] p-4 hover:border-[#2a2a2a] transition-colors cursor-pointer"
              onClick={() => setWhyTarget(extractPathFromSummary(d.summary))}
              title="Click to query Why? for this decision"
            >
              <div className="flex items-center gap-3 mb-2">
                <span className="text-orange-500 text-xs uppercase tracking-widest">decision</span>
                <span className="text-[#444] text-xs">·</span>
                <span className="text-[#555] text-xs">{d.agentId.slice(0, 14)}</span>
                <span className="text-[#444] text-xs">·</span>
                <span className="text-[#555] text-xs">{new Date(d.createdAt).toLocaleTimeString()}</span>
              </div>
              <div className="text-[#d4d4d4] text-sm leading-relaxed">{d.summary}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
