import { useMissionControlStore } from '../store/useStore'

export default function DecisionLog() {
  const store = useMissionControlStore()

  return (
    <div className="space-y-3">
      <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wider">Decision Log</h2>
      {store.decisions.length === 0 && <div className="text-sm text-text-muted">No decisions recorded.</div>}
      <div className="space-y-2">
        {store.decisions.map(d => (
          <div key={d.sourceId} className="bg-surface border border-border rounded p-3">
            <div className="text-xs text-text-muted mb-1">{new Date(d.createdAt).toLocaleString()} · {d.agentId.slice(0, 12)}</div>
            <div className="text-sm text-text-primary">{d.summary}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
