import { useMissionControlStore } from '../store/useStore'

export default function AgentFleet() {
  const store = useMissionControlStore()
  const agents = [...store.agents.values()]

  const statusColor = (s: string) => {
    if (s === 'active') return 'text-accent-green'
    if (s === 'idle') return 'text-accent-amber'
    if (s === 'failed') return 'text-accent-red'
    return 'text-text-muted'
  }

  return (
    <div className="space-y-3">
      <h2 className="text-sm font-semibold text-text-secondary uppercase tracking-wider">Active Fleet</h2>
      {agents.length === 0 && (
        <div className="text-sm text-text-muted">No agents registered.</div>
      )}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {agents.map(agent => (
          <div key={agent.id} className="bg-surface border border-border rounded p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium truncate">{agent.name}</span>
              <span className={`text-xs font-bold uppercase ${statusColor(agent.status)}`}>{agent.status}</span>
            </div>
            <div className="text-xs text-text-muted space-y-1">
              <div>ID: <span className="font-mono text-text-secondary">{agent.id.slice(0, 16)}...</span></div>
              <div>Kind: {agent.kind}</div>
              <div>Richness: {agent.contextRichness}%</div>
              {agent.currentTask && <div className="text-accent-blue truncate">{agent.currentTask}</div>}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
