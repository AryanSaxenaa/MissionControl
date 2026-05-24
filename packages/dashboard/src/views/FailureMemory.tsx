import { useMissionControlStore } from '../store/useStore'

export default function FailureMemory() {
  const store = useMissionControlStore()

  return (
    <div className="space-y-3">
      <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wider">Failure Memory</h2>
      {store.failures.length === 0 && <div className="text-sm text-text-muted">No failures recorded.</div>}
      <div className="space-y-2">
        {store.failures.map(f => (
          <div key={f.sourceId} className="bg-surface border border-border rounded p-3">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-bold text-accent-red uppercase">{f.errorType}</span>
              <span className="text-xs text-text-muted">{f.target}</span>
            </div>
            <div className="text-xs text-text-muted">Agent: {f.agentId.slice(0, 16)}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
