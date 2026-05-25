import { useMissionControlStore } from '../store/useStore'

const SEVERITY_STYLES: Record<string, string> = {
  critical: 'border-l-red-500 text-red-500',
  warning:  'border-l-orange-400 text-orange-400',
  info:     'border-l-[#555] text-[#888]',
}

export default function ConflictFeed() {
  const store = useMissionControlStore()

  return (
    <div className="flex flex-col h-full">
      <h2 className="text-[18px] uppercase tracking-[0.12em] font-bold text-white mb-4">
        Active Conflicts
      </h2>

      {store.activeConflicts.length === 0 ? (
        <div className="flex-1 border border-[#171717] flex items-center justify-center">
          <span className="text-[#555] text-sm uppercase tracking-widest">No active conflicts.</span>
        </div>
      ) : (
        <div className="space-y-2 overflow-auto flex-1">
          {store.activeConflicts.map(c => {
            const style = SEVERITY_STYLES[c.severity] ?? SEVERITY_STYLES.info
            return (
              <div key={c.id} className={`border border-[#171717] border-l-4 bg-[#020202] p-4 ${style} hover:border-[#2a2a2a] transition-colors`}>
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-3">
                    <span className="text-xs uppercase tracking-widest font-bold">{c.severity}</span>
                    <span className="text-[#444] text-xs">·</span>
                    <span className="text-[#888] text-xs uppercase">{c.kind}</span>
                  </div>
                  <button
                    onClick={() => store.resolveConflict(c.id, 'manual')}
                    className="text-xs px-3 py-1 border border-[#2a2a2a] text-[#888] hover:border-orange-500 hover:text-orange-500 uppercase tracking-wider transition-colors"
                  >
                    Resolve
                  </button>
                </div>
                <div className="text-[#d4d4d4] text-sm mb-2">{c.description}</div>
                <div className="text-[#555] text-xs">Agents: {c.agentIds.join(', ')}</div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
