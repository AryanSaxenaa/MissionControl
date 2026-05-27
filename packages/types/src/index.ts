export type AgentKind = 'claude-code' | 'codex' | 'opencode' | 'custom'

export interface AgentRecord {
  id: string
  name: string
  kind: AgentKind
  status: 'active' | 'idle' | 'failed' | 'completed'
  pid?: number
  spawnedAt: number
  lastHeartbeat: number
  currentTask?: string
  contextRichness: number
  activeIntentId?: string
  parentAgentId?: string
  // v3 additions:
  assignedPort: number
  worktreePath: string
  projectPath?: string   // user's project directory (overrides cwd for PTY spawn)
}

export interface IntentRecord {
  id: string
  agentId: string
  action: 'read' | 'write' | 'refactor' | 'delete' | 'create' | 'test'
  target: string
  description: string
  status: 'pending' | 'in-progress' | 'completed' | 'cancelled' | 'blocked'
  startedAt: number
  estimatedEndAt?: number
}

export interface ConflictResult {
  id: string
  severity: 'critical' | 'warning' | 'info'
  kind: 'file' | 'semantic' | 'architectural'
  description: string
  agentIds: string[]
  intentIds: string[]
  createdAt: number
  resolvedAt?: number
  resolution?: string
}

export interface GraphData {
  superNodes: unknown[]
  sources: unknown[]
  activeAgents: AgentRecord[]
  activeIntents: IntentRecord[]
}

export interface DecisionItem {
  sourceId: string
  agentId: string
  target: string
  summary: string
  createdAt: number
}

export interface FailureItem {
  sourceId: string
  agentId: string
  target: string
  errorType: string
  createdAt: number
}

export type TimelineEventType = 'agent:spawned' | 'agent:completed' | 'agent:died' | 'agent:heartbeat' | 'intent:declared' | 'decision:recorded' | 'failure:recorded'

export interface TimelineEvent {
  timestamp: number
  type: TimelineEventType
  agentId: string
}

// Hook payload shape for Claude Code and Codex CLI HTTP hooks
export interface HookPayload {
  session_id: string
  hook_event_name: string
  tool_name: string
  tool_input: Record<string, any>
  tool_response?: { content: string }
  cwd?: string
  transcript_path?: string
}

export interface WhyResult {
  answer: string
  chunks: { chunk_content?: string; relevancy_score?: number | null }[]
}

export type WSEvent =
  | { type: 'agent:spawned'; agent: AgentRecord }
  | { type: 'agent:registered'; agent: AgentRecord }
  | { type: 'agent:heartbeat'; agentId: string; status: string; task?: string }
  | { type: 'agent:died'; agentId: string }
  | { type: 'agent:spawn-failed'; agentId: string; error: string }
  | { type: 'agent:removed'; agentId: string }
  | { type: 'agent:completed'; agentId: string }
  | { type: 'agent:ready-to-merge'; agentId: string }
  | { type: 'permission:requested'; agentId: string; requestId: string; tool: string; target: string; reason: string }
  | { type: 'permission:resolved'; agentId: string; requestId: string; decision: 'allow' | 'deny' }
  | { type: 'intent:declared'; intent: IntentRecord }
  | { type: 'intent:updated'; intentId: string; status: IntentRecord['status'] }
  | { type: 'conflict:detected'; conflict: ConflictResult }
  | { type: 'conflict:resolved'; conflictId: string; resolution: string }
  | { type: 'context:ingested'; agentId: string }
  | { type: 'decision:recorded'; sourceId: string; agentId: string; target: string; summary: string }
  | { type: 'failure:recorded'; sourceId: string; agentId: string; target: string; errorType: string }
  | ({ type: 'graph:snapshot' } & GraphData)

export interface PermissionRequest {
  requestId: string
  agentId: string
  tool: string
  target: string
  reason: string
}
