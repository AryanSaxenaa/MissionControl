import { useEventSocket } from './hooks/useEventSocket'
import { useMissionControlStore } from './store/useStore'
import { PermissionModal } from './components/PermissionModal'
import AgentFleet from './views/AgentFleet'
import ContextGraph from './views/ContextGraph'
import DecisionLog from './views/DecisionLog'
import ConflictFeed from './views/ConflictFeed'
import FailureMemory from './views/FailureMemory'

const SERVER_URL = import.meta.env.VITE_MC_SERVER_URL || 'http://localhost:3000'

export default function App() {
  useEventSocket(SERVER_URL)

  const eventsConnected = useMissionControlStore(s => s.eventsConnected)
  const agentsMap = useMissionControlStore(s => s.agents)
  const activeConflicts = useMissionControlStore(s => s.activeConflicts)
  const activeIntentsSize = useMissionControlStore(s => s.activeIntents.size)
  const decisionsLength = useMissionControlStore(s => s.decisions.length)
  const activeView = useMissionControlStore(s => s.activeView)
  const setView = useMissionControlStore(s => s.setView)
  const pendingPermissions = useMissionControlStore(s => s.pendingPermissions)
  const removePermissionRequest = useMissionControlStore(s => s.removePermissionRequest)

  const agents = [...agentsMap.values()]
  const active = agents.filter(a => a.status === 'active').length
  const conflicts = activeConflicts.length

  // Show first pending permission request
  const topPermission = pendingPermissions[0]
  const topAgent = topPermission ? agentsMap.get(topPermission.agentId) : undefined

  return (
    <div className="flex h-screen w-screen bg-[#0a0b0d] text-[#e8eaf0] overflow-hidden">
      <aside className="w-[220px] flex-shrink-0 bg-[#111318] border-r border-[#1e2330] flex flex-col">
        <div className="px-4 py-5 border-b border-[#1e2330]">
          <h1 className="text-lg font-semibold tracking-tight text-[#00ff88]">MissionControl</h1>
          <div className="flex items-center gap-2 mt-2 text-xs text-[#4a5066]">
            <span className={`w-2 h-2 rounded-full ${eventsConnected ? 'bg-[#00ff88]' : 'bg-[#ff3355]'}`} />
            {eventsConnected ? 'Live' : 'Reconnecting'}
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
              onClick={() => setView(item.key)}
              className={`w-full text-left px-4 py-2 text-sm font-medium transition-colors ${
                activeView === item.key
                  ? 'bg-[#1a1d24] text-[#4488ff]'
                  : 'text-[#7a8099] hover:text-[#e8eaf0] hover:bg-[#1a1d24]/50'
              }`}
            >
              {item.label}
            </button>
          ))}
        </nav>
      </aside>

      <main className="flex-1 flex flex-col min-w-0">
        <header className="h-12 bg-[#111318] border-b border-[#1e2330] flex items-center px-4 gap-6 text-xs text-[#7a8099] flex-shrink-0">
          <span>
            Agents:{' '}
            <strong className="text-[#e8eaf0]">{active}/{agents.length}</strong>
          </span>
          <span>
            Conflicts:{' '}
            <strong className={conflicts > 0 ? 'text-[#ff3355]' : 'text-[#e8eaf0]'}>{conflicts}</strong>
          </span>
          <span>
            Intents:{' '}
            <strong className="text-[#e8eaf0]">{activeIntentsSize}</strong>
          </span>
          <span>
            Decisions:{' '}
            <strong className="text-[#e8eaf0]">{decisionsLength}</strong>
          </span>
          {pendingPermissions.length > 0 && (
            <span className="text-[#ffaa00] font-mono">
              ⚠ {pendingPermissions.length} permission{pendingPermissions.length > 1 ? 's' : ''} pending
            </span>
          )}
        </header>

        <div className="flex-1 overflow-auto p-4">
          {activeView === 'fleet' && <AgentFleet />}
          {activeView === 'graph' && <ContextGraph />}
          {activeView === 'decisions' && <DecisionLog />}
          {activeView === 'conflicts' && <ConflictFeed />}
          {activeView === 'failures' && <FailureMemory />}
        </div>
      </main>

      {/* Permission modal — shows on top of everything */}
      {topPermission && (
        <PermissionModal
          agentId={topPermission.agentId}
          agentName={topAgent?.name ?? topPermission.agentId}
          requestId={topPermission.requestId}
          tool={topPermission.tool}
          target={topPermission.target}
          reason={topPermission.reason}
          onResolve={() => removePermissionRequest(topPermission.requestId)}
        />
      )}
    </div>
  )
}
