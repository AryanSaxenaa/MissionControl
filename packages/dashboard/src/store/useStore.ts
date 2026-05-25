import { create } from 'zustand'
import type { AgentRecord, IntentRecord, ConflictResult, GraphData, DecisionItem, FailureItem } from '@missioncontrol/types'

export interface PermissionRequest {
  requestId: string
  agentId: string
  tool: string
  target: string
  reason: string
}

interface MissionControlStore {
  // Connection
  eventsConnected: boolean
  setEventsConnected: (v: boolean) => void

  // Agents
  agents: Map<string, AgentRecord>
  upsertAgent: (agent: AgentRecord) => void
  updateAgentStatus: (id: string, status: AgentRecord['status'], task?: string) => void
  markAgentDead: (id: string) => void
  markAgentCompleted: (id: string) => void
  removeAgent: (id: string) => void

  // Permission requests
  pendingPermissions: PermissionRequest[]
  addPermissionRequest: (r: PermissionRequest) => void
  removePermissionRequest: (requestId: string) => void

  // Merge queue
  agentsPendingMerge: string[]
  addAgentPendingMerge: (agentId: string) => void
  removeAgentPendingMerge: (agentId: string) => void

  // Intents
  activeIntents: Map<string, IntentRecord>
  upsertIntent: (intent: IntentRecord) => void
  updateIntentStatus: (intentId: string, status: IntentRecord['status']) => void

  // Conflicts
  activeConflicts: ConflictResult[]
  resolvedConflicts: ConflictResult[]
  addConflict: (c: ConflictResult) => void
  resolveConflict: (id: string, resolution: string) => Promise<void>
  applyConflictResolved: (id: string, resolution: string) => void

  // Decisions
  decisions: DecisionItem[]
  addDecision: (d: DecisionItem) => void

  // Failures
  failures: FailureItem[]
  addFailure: (f: FailureItem) => void

  // Graph
  graphData: GraphData | null
  setGraphData: (data: GraphData | null) => void

  // UI
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
  eventsConnected: false,
  setEventsConnected: (v: boolean) => set({ eventsConnected: v }),

  agents: new Map(),
  upsertAgent: (agent: AgentRecord) =>
    set((s) => { const m = new Map(s.agents); m.set(agent.id, agent); return { agents: m } }),
  updateAgentStatus: (id: string, status: AgentRecord['status'], task?: string) =>
    set((s) => {
      const m = new Map(s.agents)
      const a = m.get(id)
      if (a) m.set(id, { ...a, status, ...(task !== undefined && { currentTask: task }), lastHeartbeat: Date.now() })
      return { agents: m }
    }),
  markAgentDead: (id) =>
    set((s) => {
      const m = new Map(s.agents)
      const a = m.get(id)
      if (a) m.set(id, { ...a, status: 'failed' })
      return { agents: m }
    }),
  markAgentCompleted: (id) =>
    set((s) => {
      const m = new Map(s.agents)
      const a = m.get(id)
      if (a) m.set(id, { ...a, status: 'completed' })
      return { agents: m }
    }),
  removeAgent: (id) =>
    set((s) => { const m = new Map(s.agents); m.delete(id); return { agents: m } }),

  pendingPermissions: [],
  addPermissionRequest: (r) => set((s) => ({ pendingPermissions: [...s.pendingPermissions, r] })),
  removePermissionRequest: (requestId) =>
    set((s) => ({ pendingPermissions: s.pendingPermissions.filter(r => r.requestId !== requestId) })),

  agentsPendingMerge: [],
  addAgentPendingMerge: (id) => set((s) => ({ agentsPendingMerge: [...s.agentsPendingMerge, id] })),
  removeAgentPendingMerge: (id) =>
    set((s) => ({ agentsPendingMerge: s.agentsPendingMerge.filter(a => a !== id) })),

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
    try {
      const resp = await fetch(`/api/conflicts/${id}/resolve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resolution }),
      })
      if (!resp.ok) return
      set((s) => _moveConflictToResolved(s, conflict, resolution))
    } catch { /* server unreachable */ }
  },

  decisions: [],
  addDecision: (d) => set((s) => ({ decisions: [d, ...s.decisions].slice(0, 200) })),

  failures: [],
  addFailure: (f) => set((s) => ({ failures: [f, ...s.failures].slice(0, 500) })),

  graphData: null,
  setGraphData: (data) => set({ graphData: data }),

  activeView: 'fleet',
  setView: (v) => set({ activeView: v }),
  selectedNodeId: null,
  setSelectedNode: (id) => set({ selectedNodeId: id }),
}))
