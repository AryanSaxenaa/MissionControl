import { useMissionControlStore } from '../store/useStore'

export default function ConflictFeed() {
  const store = useMissionControlStore()

  const severityColor = (s: string) => {
    if (s === 'critical') return 'border-accent-red text-accent-red'
    if (s === 'warning') return 'border-accent-amber text-accent-amber'
    return 'border-accent-blue text-accent-blue'
  }

  return (
    <div className="space-y-3">
      <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wider">Active Conflicts</h2>
      {store.activeConflicts.length === 0 && <div className="text-sm text-text-muted">No active conflicts.</div>}
      <div className="space-y-2">
        {store.activeConflicts.map(c => (
          <div key={c.id} className={`bg-surface border-l-4 rounded p-3 ${severityColor(c.severity)}`}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-bold uppercase">{c.severity} · {c.kind}</span>
              <button
                onClick={() => store.resolveConflict(c.id, 'manual')}
                className="text-xs px-2 py-1 bg-elevated hover:bg-border rounded text-text-secondary"
              >
                Resolve
              </button>
            </div>
            <div className="text-sm text-text-primary">{c.description}</div>
            <div className="text-xs text-text-muted mt-1">Agents: {c.agentIds.join(', ')}</div>
          </div>
        ))}
      </div>
    </div>
  )
}
