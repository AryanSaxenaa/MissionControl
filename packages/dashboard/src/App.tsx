import { useWebSocket } from './hooks/useWebSocket'
import { useMissionControlStore } from './store/useStore'
import AgentFleet from './views/AgentFleet'
import ContextGraph from './views/ContextGraph'
import DecisionLog from './views/DecisionLog'
import ConflictFeed from './views/ConflictFeed'
import FailureMemory from './views/FailureMemory'

const SERVER_URL = import.meta.env.VITE_MC_SERVER_URL || 'http://localhost:3000'

export default function App() {
  useWebSocket(SERVER_URL)
  const store = useMissionControlStore()

  const agents = [...store.agents.values()]
  const active = agents.filter(a => a.status === 'active').length
  const conflicts = store.activeConflicts.length

  return (
    <div className="flex h-screen w-screen bg-base text-text-primary overflow-hidden">
      <aside className="w-[220px] flex-shrink-0 bg-surface border-r border-border flex flex-col">
        <div className="px-4 py-5 border-b border-border">
          <h1 className="text-lg font-semibold tracking-tight text-accent-green">MissionControl</h1>
          <div className="flex items-center gap-2 mt-2 text-xs text-text-muted">
            <span className={`w-2 h-2 rounded-full ${store.wsConnected ? 'bg-accent-green' : 'bg-accent-red'}`} />
            {store.wsConnected ? 'Live' : 'Reconnecting'}
          </div>
        </div>
        <nav className="flex-1 py-2">
          {([
            { key: 'fleet', label: 'Agent Fleet' },
            { key: 'graph', label: 'Context Graph' },
            { key: 'decisions', label: 'Decision Log' },
            { key: 'conflicts', label: 'Conflicts' },
            { key: 'failures', label: 'Failure Memory' },
          ] as const).map(item => (
            <button
              key={item.key}
              onClick={() => store.setView(item.key)}
              className={`w-full text-left px-4 py-2 text-sm font-medium transition-colors ${
                store.activeView === item.key
                  ? 'bg-elevated text-accent-blue'
                  : 'text-text-secondary hover:text-text-primary hover:bg-elevated/50'
              }`}
            >
              {item.label}
            </button>
          ))}
        </nav>
      </aside>

      <main className="flex-1 flex flex-col min-w-0">
        <header className="h-12 bg-surface border-b border-border flex items-center px-4 gap-6 text-xs text-text-secondary">
          <span>Agents: <strong className="text-text-primary">{active}/{agents.length}</strong></span>
          <span>Conflicts: <strong className={conflicts > 0 ? 'text-accent-red' : 'text-text-primary'}>{conflicts}</strong></span>
          <span>Intents: <strong className="text-text-primary">{store.activeIntents.size}</strong></span>
          <span>Decisions: <strong className="text-text-primary">{store.decisions.length}</strong></span>
        </header>

        <div className="flex-1 overflow-auto p-4">
          {store.activeView === 'fleet' && <AgentFleet />}
          {store.activeView === 'graph' && <ContextGraph />}
          {store.activeView === 'decisions' && <DecisionLog />}
          {store.activeView === 'conflicts' && <ConflictFeed />}
          {store.activeView === 'failures' && <FailureMemory />}
        </div>
      </main>
    </div>
  )
}
