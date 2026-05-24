export interface AgentRecord {
  id: string
  name: string
  kind: 'claude-code' | 'codex' | 'opencode' | 'custom'
  status: 'active' | 'idle' | 'failed' | 'completed'
  pid?: number
  spawnedAt: number
  lastHeartbeat: number
  currentTask?: string
  contextRichness: number
  activeIntentId?: string
  parentAgentId?: string
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
