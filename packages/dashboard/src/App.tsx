import { useEventSocket } from './hooks/useEventSocket'
import { useMissionControlStore } from './store/useStore'
import { PermissionModal } from './components/PermissionModal'
import AgentFleet from './views/AgentFleet'
import ContextGraph from './views/ContextGraph'
import DecisionLog from './views/DecisionLog'
import ConflictFeed from './views/ConflictFeed'
import FailureMemory from './views/FailureMemory'
import { Activity, GitBranch, BrainCircuit, ShieldAlert, Database } from 'lucide-react'
import { useEffect, useState } from 'react'

const SERVER_URL = import.meta.env.VITE_MC_SERVER_URL || window.location.origin

// Pixel logo — 5×5 grid, orange active cells
const LOGO_CELLS = [2,6,7,8,10,11,12,13,14,16,17,18,22]
function PixelLogo({ size = 28 }: { size?: number }) {
  return (
    <div className="grid gap-[2px]" style={{ gridTemplateColumns: 'repeat(5,1fr)', width: size, height: size }}>
      {Array.from({ length: 25 }).map((_, i) => (
        <div key={i} className={LOGO_CELLS.includes(i) ? 'bg-orange-500' : 'bg-transparent'} />
      ))}
    </div>
  )
}

const NAV_ITEMS = [
  { key: 'fleet',     label: 'Agent Fleet',    icon: Activity },
  { key: 'graph',     label: 'Context Graph',  icon: GitBranch },
  { key: 'decisions', label: 'Decision Log',   icon: BrainCircuit },
  { key: 'conflicts', label: 'Conflicts',      icon: ShieldAlert },
  { key: 'failures',  label: 'Failure Memory', icon: Database },
] as const

export default function App() {
  useEventSocket(SERVER_URL)

  const eventsConnected   = useMissionControlStore(s => s.eventsConnected)
  const agentsMap         = useMissionControlStore(s => s.agents)
  const activeConflicts   = useMissionControlStore(s => s.activeConflicts)
  const activeIntentsSize = useMissionControlStore(s => s.activeIntents.size)
  const decisionsLength   = useMissionControlStore(s => s.decisions.length)
  const activeView        = useMissionControlStore(s => s.activeView)
  const setView           = useMissionControlStore(s => s.setView)
  const pendingPermissions      = useMissionControlStore(s => s.pendingPermissions)
  const removePermissionRequest = useMissionControlStore(s => s.removePermissionRequest)

  const agents    = [...agentsMap.values()]
  const active    = agents.filter(a => a.status === 'active').length
  const conflicts = activeConflicts.length

  // HydraDB memory node count — polled every 30s, shown in status bar
  const [memoryNodes, setMemoryNodes] = useState<number>(0)
  useEffect(() => {
    const poll = () => fetch('/api/memory/stats').then(r => r.json()).then(d => setMemoryNodes(d.totalSources ?? 0)).catch(() => {})
    poll()
    const id = setInterval(poll, 30_000)
    return () => clearInterval(id)
  }, [])

  const topPermission = pendingPermissions[0]
  const topAgent      = topPermission ? agentsMap.get(topPermission.agentId) : undefined

  return (
    <div className="flex h-screen w-screen bg-black text-white overflow-hidden font-mono">

      {/* SIDEBAR */}
      <aside className="w-[220px] flex-shrink-0 border-r border-[#171717] bg-[#020202] flex flex-col">

        {/* Logo */}
        <div className="px-5 py-5 border-b border-[#171717]">
          <div className="flex items-center gap-3">
            <PixelLogo size={28} />
            <div>
              <h1 className="text-[15px] font-semibold tracking-tight text-white">MissionControl</h1>
              <div className="flex items-center gap-1.5 mt-1 text-[#a3a3a3] text-[11px]">
                <span className={`w-1.5 h-1.5 rounded-full ${eventsConnected ? 'bg-orange-500 animate-pulse' : 'bg-[#555]'}`} />
                {eventsConnected ? 'Live' : 'Reconnecting'}
              </div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav className="flex-1 py-3">
          {NAV_ITEMS.map(({ key, label, icon: Icon }) => {
            const isActive = activeView === key
            return (
              <button
                key={key}
                onClick={() => setView(key)}
                className={`w-full h-[46px] px-5 flex items-center gap-3 text-xs tracking-wide transition-all duration-200 border-l-2 ${
                  isActive
                    ? 'border-orange-500 bg-[#0b0b0b] text-orange-500'
                    : 'border-transparent text-[#b4b4b4] hover:bg-[#0a0a0a] hover:text-white'
                }`}
              >
                <Icon size={14} />
                <span>{label}</span>
              </button>
            )
          })}
        </nav>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-[#171717] text-[10px] text-[#555]">
          <div className="text-[#666] mb-1">MissionControl Console</div>
          <div>© 2025 MissionControl, Inc.</div>
        </div>
      </aside>

      {/* MAIN */}
      <main className="flex-1 flex flex-col bg-black relative overflow-hidden min-w-0">

        {/* Grid background */}
        <div
          className="absolute inset-0 opacity-[0.18] pointer-events-none"
          style={{
            backgroundImage: `
              linear-gradient(to right, rgba(255,255,255,0.06) 1px, transparent 1px),
              linear-gradient(to bottom, rgba(255,255,255,0.02) 1px, transparent 1px)
            `,
            backgroundSize: '52px 52px',
          }}
        />

        {/* Stats bar */}
        <div className="relative z-10 h-[44px] border-b border-[#171717] flex items-center px-6 gap-8 text-xs tracking-wide flex-shrink-0">
          <TopMetric label="Agents"    value={`${active}/${agents.length}`} warn={false} />
          <TopMetric label="Conflicts" value={String(conflicts)} warn={conflicts > 0} />
          <TopMetric label="Intents"   value={String(activeIntentsSize)} warn={false} />
          <TopMetric label="Decisions" value={String(decisionsLength)} warn={false} />
          <TopMetric label="◈ Memory"  value={String(memoryNodes)} warn={false} />
          {pendingPermissions.length > 0 && (
            <span className="text-orange-400 uppercase tracking-wider text-xs animate-pulse">
              ⚠ {pendingPermissions.length} permission{pendingPermissions.length > 1 ? 's' : ''} pending
            </span>
          )}
        </div>

        {/* View content */}
        <div className="relative z-10 flex-1 overflow-auto px-6 py-5">
          {activeView === 'fleet'     && <AgentFleet />}
          {activeView === 'graph'     && <ContextGraph />}
          {activeView === 'decisions' && <DecisionLog />}
          {activeView === 'conflicts' && <ConflictFeed />}
          {activeView === 'failures'  && <FailureMemory />}
        </div>
      </main>

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

function TopMetric({ label, value, warn }: { label: string; value: string; warn: boolean }) {
  return (
    <div className="flex items-center gap-2 text-[#9e9e9e] uppercase tracking-wider">
      <span>{label}:</span>
      <span className={`font-semibold ${warn ? 'text-red-500' : 'text-orange-500'}`}>{value}</span>
    </div>
  )
}
