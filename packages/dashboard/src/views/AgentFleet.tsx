import { useState } from 'react'
import { Plus } from 'lucide-react'
import { useMissionControlStore } from '../store/useStore'
import { AgentPane } from '../components/AgentPane'
import { NewAgentDialog } from '../components/NewAgentDialog'
import { MergeReview } from '../components/MergeReview'

// 7×7 pixel icon for empty state
const EMPTY_CELLS = [3,9,10,11,15,16,17,21,22,23,24,25,29,30,31,37,38,39,45]

export default function AgentFleet() {
  const store               = useMissionControlStore()
  const agents              = [...store.agents.values()]
  const agentsPendingMerge  = store.agentsPendingMerge
  const addAgentPendingMerge    = store.addAgentPendingMerge
  const removeAgentPendingMerge = store.removeAgentPendingMerge
  const [showNewAgent, setShowNewAgent] = useState(false)

  const mergeTarget = agentsPendingMerge[0] ?? null

  return (
    <div className="flex flex-col h-full gap-0">

      {/* Header */}
      <div className="flex items-center justify-between mb-10">
        <h2 className="text-[42px] uppercase tracking-[0.18em] font-bold text-white">
          Agent Fleet
        </h2>
        <button
          onClick={() => setShowNewAgent(true)}
          className="h-11 px-6 border border-orange-500 text-orange-500 hover:bg-orange-500 hover:text-black transition-all duration-200 flex items-center gap-2 text-sm uppercase tracking-wider"
        >
          <Plus size={16} />
          New Agent
        </button>
      </div>

      {/* Empty state */}
      {agents.length === 0 && (
        <div className="flex-1 border border-[#171717] relative flex items-center justify-center">
          <div className="absolute w-[280px] h-[280px] bg-orange-500/5 blur-3xl rounded-full" />
          <div className="flex flex-col items-center relative z-10">
            <div
              className="mb-8 grid gap-[2px]"
              style={{ gridTemplateColumns: 'repeat(7,1fr)', width: 64, height: 64 }}
            >
              {Array.from({ length: 49 }).map((_, i) => (
                <div key={i} className={EMPTY_CELLS.includes(i) ? 'bg-orange-500' : 'bg-transparent'} />
              ))}
            </div>
            <div className="text-[#b1b1b1] text-[20px] mb-8 tracking-wide">No agents running.</div>
            <button
              onClick={() => setShowNewAgent(true)}
              className="px-8 h-14 bg-orange-500 text-black hover:bg-orange-400 transition-all text-[15px] uppercase tracking-[0.18em] font-semibold shadow-[0_0_30px_rgba(249,115,22,0.3)]"
            >
              Spawn first agent
            </button>
          </div>
        </div>
      )}

      {/* Agent grid */}
      {agents.length > 0 && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 flex-1 min-h-0 auto-rows-[360px]">
          {agents.map(agent => (
            <AgentPane
              key={agent.id}
              agentId={agent.id}
              agentName={agent.name}
              status={agent.status}
              assignedPort={agent.assignedPort ?? 0}
              onMergeClick={() => {
                if (!agentsPendingMerge.includes(agent.id)) addAgentPendingMerge(agent.id)
              }}
            />
          ))}
        </div>
      )}

      {showNewAgent && (
        <NewAgentDialog
          onClose={() => setShowNewAgent(false)}
          onSpawned={() => setShowNewAgent(false)}
        />
      )}

      {mergeTarget && (
        <MergeReview
          agentId={mergeTarget}
          onClose={() => removeAgentPendingMerge(mergeTarget)}
        />
      )}
    </div>
  )
}
