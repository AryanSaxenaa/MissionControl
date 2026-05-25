import { useState } from 'react'
import { useMissionControlStore } from '../store/useStore'

export default function DecisionLog() {
  const store = useMissionControlStore()
  const [whyTarget, setWhyTarget] = useState('')
  const [whyAnswer, setWhyAnswer] = useState<string | null>(null)
  const [whyLoading, setWhyLoading] = useState(false)

  const queryWhy = async () => {
    if (!whyTarget.trim()) return
    setWhyLoading(true); setWhyAnswer(null)
    try {
      const r = await fetch(`/api/decisions/why?target=${encodeURIComponent(whyTarget.trim())}`)
      const data = await r.json()
      setWhyAnswer(data.answer ?? 'No answer available.')
    } catch {
      setWhyAnswer('Failed to query memory.')
    } finally {
      setWhyLoading(false)
    }
  }

  return (
    <div className="flex flex-col h-full gap-6">
      <h2 className="text-[42px] uppercase tracking-[0.18em] font-bold text-white">
        Decision Log
      </h2>

      {/* Why? panel — queries HydraDB decision memory */}
      <div className="border border-[#171717] bg-[#020202] p-5 flex-shrink-0">
        <div className="text-xs text-orange-500 uppercase tracking-widest mb-3">Why? — Query Decision Memory</div>
        <div className="flex gap-2">
          <input
            value={whyTarget}
            onChange={e => setWhyTarget(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && queryWhy()}
            placeholder="e.g. src/auth/token.ts"
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
        {whyAnswer !== null && (
          <p className="mt-3 text-sm text-[#d4d4d4] font-mono leading-relaxed border-t border-[#171717] pt-3">
            {whyAnswer}
          </p>
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
              onClick={() => setWhyTarget(d.summary.split(' ').slice(0, 5).join(' '))}
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
