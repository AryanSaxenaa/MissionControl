import { useMissionControlStore } from '../store/useStore'

export default function DecisionLog() {
  const store = useMissionControlStore()

  return (
    <div className="flex flex-col h-full">
      <h2 className="text-[42px] uppercase tracking-[0.18em] font-bold text-white mb-10">
        Decision Log
      </h2>

      {store.decisions.length === 0 ? (
        <div className="flex-1 border border-[#171717] flex items-center justify-center">
          <div className="absolute w-[200px] h-[200px] bg-orange-500/5 blur-3xl rounded-full pointer-events-none" />
          <span className="text-[#555] text-sm uppercase tracking-widest">No decisions recorded.</span>
        </div>
      ) : (
        <div className="space-y-2 overflow-auto flex-1">
          {store.decisions.map(d => (
            <div key={d.sourceId} className="border border-[#171717] bg-[#020202] p-4 hover:border-[#2a2a2a] transition-colors">
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
