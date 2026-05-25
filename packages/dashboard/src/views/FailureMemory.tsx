import { useMissionControlStore } from '../store/useStore'

export default function FailureMemory() {
  const store = useMissionControlStore()

  return (
    <div className="flex flex-col h-full">
      <h2 className="text-[42px] uppercase tracking-[0.18em] font-bold text-white mb-10">
        Failure Memory
      </h2>

      {store.failures.length === 0 ? (
        <div className="flex-1 border border-[#171717] flex items-center justify-center">
          <span className="text-[#555] text-sm uppercase tracking-widest">No failures recorded.</span>
        </div>
      ) : (
        <div className="space-y-2 overflow-auto flex-1">
          {store.failures.map(f => (
            <div key={f.sourceId} className="border border-[#171717] bg-[#020202] p-4 hover:border-[#2a2a2a] transition-colors">
              <div className="flex items-center gap-3 mb-2">
                <span className="text-red-500 text-xs uppercase tracking-widest font-bold">{f.errorType}</span>
                <span className="text-[#444] text-xs">·</span>
                <span className="text-[#888] text-xs">{f.target}</span>
                <span className="text-[#444] text-xs">·</span>
                <span className="text-[#555] text-xs">{f.agentId.slice(0, 16)}</span>
              </div>
              <div className="text-[#555] text-xs">{new Date(f.createdAt).toLocaleTimeString()}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
