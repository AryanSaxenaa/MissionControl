import { create } from 'zustand'
import type { AgentRecord, IntentRecord, ConflictResult, GraphData, DecisionItem, FailureItem } from '@missioncontrol/types'

interface MissionControlStore {
  wsConnected: boolean
  setWsConnected: (v: boolean) => void

  agents: Map<string, AgentRecord>
  updateAgent: (agent: AgentRecord) => void
  updateAgentHeartbeat: (id: string, status: AgentRecord['status'], task?: string) => void
  markAgentDead: (id: string) => void
  removeAgent: (id: string) => void

  graphData: GraphData | null
  setGraphData: (data: GraphData | null) => void

  activeIntents: Map<string, IntentRecord>
  upsertIntent: (intent: IntentRecord) => void
  updateIntentStatus: (intentId: string, status: IntentRecord['status']) => void

  activeConflicts: ConflictResult[]
  resolvedConflicts: ConflictResult[]
  addConflict: (c: ConflictResult) => void
  resolveConflict: (id: string, resolution: string) => Promise<void>
  applyConflictResolved: (id: string, resolution: string) => void

  decisions: DecisionItem[]
  addDecision: (d: DecisionItem) => void

  failures: FailureItem[]
  addFailure: (f: FailureItem) => void

  activeView: 'fleet' | 'graph' | 'decisions' | 'conflicts' | 'failures'
  setView: (v: MissionControlStore['activeView']) => void
  selectedNodeId: string | null
  setSelectedNode: (id: string | null) => void
}

function _moveConflictToResolved(s: MissionControlStore, conflict: ConflictResult, resolution: string) {
  return {
    activeConflicts: s.activeConflicts.filter((c) => c.id !== conflict.id),
    resolvedConflicts: [
      { ...conflict, resolvedAt: Date.now(), resolution },
      ...s.resolvedConflicts,
    ],
  }
}

export const useMissionControlStore = create<MissionControlStore>((set, get) => ({
  wsConnected: false,
  setWsConnected: (v) => set({ wsConnected: v }),

  agents: new Map(),
  updateAgent: (agent) =>
    set((s) => { const m = new Map(s.agents); m.set(agent.id, agent); return { agents: m } }),
  updateAgentHeartbeat: (id, status, task) =>
    set((s) => {
      const m = new Map(s.agents)
      const a = m.get(id)
      if (a) m.set(id, { ...a, status, currentTask: task, lastHeartbeat: Date.now() })
      return { agents: m }
    }),
  markAgentDead: (id) =>
    set((s) => {
      const m = new Map(s.agents)
      const a = m.get(id)
      if (a) m.set(id, { ...a, status: 'failed' })
      return { agents: m }
    }),
  removeAgent: (id) =>
    set((s) => { const m = new Map(s.agents); m.delete(id); return { agents: m } }),

  graphData: null,
  setGraphData: (data) => set({ graphData: data }),

  activeIntents: new Map(),
  upsertIntent: (intent) =>
    set((s) => { const m = new Map(s.activeIntents); m.set(intent.id, intent); return { activeIntents: m } }),
  updateIntentStatus: (intentId, status) =>
    set((s) => {
      const m = new Map(s.activeIntents)
      const i = m.get(intentId)
      if (i) m.set(intentId, { ...i, status })
      return { activeIntents: m }
    }),

  activeConflicts: [],
  resolvedConflicts: [],
  addConflict: (c) => set((s) => ({ activeConflicts: [c, ...s.activeConflicts] })),
  applyConflictResolved: (id, resolution) => {
    const conflict = get().activeConflicts.find((c) => c.id === id)
    if (conflict) set((s) => _moveConflictToResolved(s, conflict, resolution))
  },
  resolveConflict: async (id, resolution) => {
    const conflict = get().activeConflicts.find((c) => c.id === id)
    if (!conflict) return

    await fetch(`/api/conflicts/${id}/resolve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resolution }),
    })

    set((s) => _moveConflictToResolved(s, conflict, resolution))
  },

  decisions: [],
  addDecision: (d) => set((s) => ({ decisions: [d, ...s.decisions].slice(0, 200) })),

  failures: [],
  addFailure: (f) => set((s) => ({ failures: [f, ...s.failures].slice(0, 500) })),

  activeView: 'fleet',
  setView: (v) => set({ activeView: v }),
  selectedNodeId: null,
  setSelectedNode: (id) => set({ selectedNodeId: id }),
}))
