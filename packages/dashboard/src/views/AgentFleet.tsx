import { useState } from 'react'
import { useMissionControlStore } from '../store/useStore'
import { AgentPane } from '../components/AgentPane'
import { NewAgentDialog } from '../components/NewAgentDialog'
import { MergeReview } from '../components/MergeReview'

export default function AgentFleet() {
  const agents = [...useMissionControlStore(s => s.agents.values())]
  const agentsPendingMerge = useMissionControlStore(s => s.agentsPendingMerge)
  const addAgentPendingMerge = useMissionControlStore(s => s.addAgentPendingMerge)
  const removeAgentPendingMerge = useMissionControlStore(s => s.removeAgentPendingMerge)
  const [showNewAgent, setShowNewAgent] = useState(false)

  const mergeTarget = agentsPendingMerge[0] ?? null

  return (
    <div className="flex flex-col h-full gap-3">
      {/* Header */}
      <div className="flex items-center justify-between flex-shrink-0">
        <h2 className="text-sm font-semibold text-[#7a8099] uppercase tracking-wider">Agent Fleet</h2>
        <button
          onClick={() => setShowNewAgent(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-[#00ff88] text-[#0a0b0d] rounded font-mono hover:bg-[#00cc6a]"
        >
          + New Agent
        </button>
      </div>

      {/* Empty state */}
      {agents.length === 0 && (
        <div className="flex flex-col items-center justify-center flex-1 gap-4 text-center">
          <p className="text-[#7a8099] text-sm">No agents running.</p>
          <button
            onClick={() => setShowNewAgent(true)}
            className="px-4 py-2 text-sm bg-[#00ff88] text-[#0a0b0d] rounded font-mono hover:bg-[#00cc6a]"
          >
            Spawn first agent
          </button>
        </div>
      )}

      {/* Agent grid */}
      {agents.length > 0 && (
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-3 flex-1 min-h-0 auto-rows-[360px]">
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
