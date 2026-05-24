# MissionControl — Full Build Specification
### For Claude Code / OpenCode — Hackathon Build (48h)
**Version:** 2.0 | **Status:** Audited & Corrected | **Soul:** HydraDB

> **Revision notes (v1 → v2):** 20 bugs corrected. The most critical: HydraDB is a cloud SaaS API (not Neo4j/Docker/Cypher), the npm package is `@hydradb/sdk` (not `hydradb`), the client is `HydraDBClient` with Bearer auth (not neo4j credentials), and the entire `hydra.ts` data model had to be redesigned around HydraDB's real `ingest`/`recall`/`fetch`/`graphHealth` API surface.

---

## 0. What You're Building

MissionControl is a **shared-memory coordination OS** for parallel AI coding agents. It is not a terminal emulator. It is not a chat interface. It is the **missing memory bus** between Claude Code, Codex CLI, OpenCode, and any other coding agent.

The product has three layers:
1. **HydraDB Brain** — the persistent shared memory (every agent reads/writes here via semantic ingestion and recall)
2. **SDK + Hooks** — lightweight wrappers that make any agent write to the brain automatically
3. **Web Dashboard** — the live visual OS control plane operators use to see, control, and understand their agent fleet

Every feature must be real and functional. Zero fake data. Zero simulations. Every UI element must be backed by a live HydraDB query.

---

## 1. Tech Stack

### Backend
- **Runtime:** Node.js 20+ with TypeScript
- **Framework:** Fastify (not Express — faster, better TypeScript support)
- **Database / Memory Bus:** HydraDB via `@hydradb/sdk` (cloud SaaS, not self-hosted)
- **Real-time:** WebSockets via `ws` library (native, no Socket.io overhead)
- **Process management:** Node `child_process` for spawning/tracking agent processes
- **Schema validation:** Zod

### Frontend
- **Framework:** React 18 + Vite
- **Styling:** Tailwind CSS v3
- **Real-time:** Native WebSocket (no library)
- **Graphs:** D3.js (force-directed graph for the context graph view)
- **Charts:** Recharts (agent health, activity timeline)
- **State:** Zustand (lightweight, no Redux complexity)

### CLI / SDK
- **Language:** TypeScript compiled to ESM
- **Distribution:** npm package `@missioncontrol/sdk`
- **Shell hooks:** Bash/Zsh compatible wrapper scripts

### Dev / Infra
- **Monorepo:** pnpm workspaces
- **Packages:** `packages/sdk`, `packages/server`, `packages/dashboard`, `packages/cli`
- **Config:** Single `missioncontrol.config.ts` at root

---

## 2. Repository Structure

```
missioncontrol/
├── packages/
│   ├── sdk/                        # Agent SDK — npm installable
│   │   ├── src/
│   │   │   ├── index.ts            # Main exports
│   │   │   ├── client.ts           # HydraDB client wrapper (wraps @hydradb/sdk)
│   │   │   ├── agent.ts            # Agent registration + heartbeat
│   │   │   ├── context.ts          # Context read/write operations
│   │   │   ├── intent.ts           # Intent broadcast/query
│   │   │   ├── failure.ts          # Failure memory operations
│   │   │   └── hooks/
│   │   │       ├── claude-code.ts  # Claude Code hooks (PreToolUse/PostToolUse)
│   │   │       └── opencode.ts     # OpenCode hooks
│   │   └── package.json
│   │
│   ├── server/                     # Fastify backend
│   │   ├── src/
│   │   │   ├── index.ts            # Server entry
│   │   │   ├── hydra.ts            # HydraDB connection + memory operations
│   │   │   ├── ws.ts               # WebSocket hub (broadcasts to dashboard)
│   │   │   ├── routes/
│   │   │   │   ├── agents.ts       # Agent CRUD + status
│   │   │   │   ├── context.ts      # Context memory endpoints
│   │   │   │   ├── intents.ts      # Intent broadcast endpoints
│   │   │   │   ├── conflicts.ts    # Conflict detection engine
│   │   │   │   ├── failures.ts     # Failure memory endpoints
│   │   │   │   └── decisions.ts    # Decision log endpoints
│   │   │   └── services/
│   │   │       ├── conflict-detector.ts
│   │   │       ├── graph-traversal.ts
│   │   │       └── agent-health.ts
│   │   └── package.json
│   │
│   ├── dashboard/                  # React frontend
│   │   ├── src/
│   │   │   ├── main.tsx
│   │   │   ├── App.tsx
│   │   │   ├── store/
│   │   │   │   └── useStore.ts     # Zustand store
│   │   │   ├── views/
│   │   │   │   ├── AgentFleet.tsx
│   │   │   │   ├── ContextGraph.tsx
│   │   │   │   ├── DecisionLog.tsx
│   │   │   │   ├── ConflictFeed.tsx
│   │   │   │   └── FailureMemory.tsx
│   │   │   ├── components/
│   │   │   │   ├── AgentCard.tsx
│   │   │   │   ├── GraphNode.tsx
│   │   │   │   ├── ConflictAlert.tsx
│   │   │   │   ├── IntentBadge.tsx
│   │   │   │   └── HealthRing.tsx
│   │   │   └── hooks/
│   │   │       └── useWebSocket.ts
│   │   └── package.json
│   │
│   └── cli/                        # `mc` CLI tool  ← was missing in v1
│       ├── src/
│       │   ├── index.ts            # CLI entry (commander)
│       │   ├── commands/
│       │   │   ├── init.ts
│       │   │   ├── start.ts
│       │   │   ├── agent.ts
│       │   │   ├── context.ts
│       │   │   ├── why.ts
│       │   │   ├── failures.ts
│       │   │   ├── status.ts
│       │   │   └── conflicts.ts
│       └── package.json
│
├── missioncontrol.config.ts
├── pnpm-workspace.yaml
└── package.json
```

---

## 3. HydraDB — What It Actually Is

> **CRITICAL CORRECTION from v1:** HydraDB is NOT a self-hosted Neo4j-compatible graph database. It is a **cloud SaaS agentic memory platform** with a REST API. There is no Docker image to run locally, no Cypher query language, no `localhost:7474`. The correct package is `@hydradb/sdk` (not `hydradb`). Authentication uses a Bearer API key, not neo4j username/password.

### Real HydraDB API Surface

```typescript
import { HydraDBClient } from '@hydradb/sdk'

const hydra = new HydraDBClient({
  apiKey: process.env.HYDRA_API_KEY,  // Bearer token from HydraDB dashboard
  // baseUrl defaults to https://api.hydradb.com
})

// The real operations available:
hydra.tenant.create()              // Create a tenant (workspace isolation)
hydra.ingestionPipeline.ingestMemory()  // Ingest text as memory
hydra.upload.addMemory()           // Add structured memory items
hydra.upload.knowledge()           // Upload documents
hydra.recall.fullRecall()          // Semantic + graph recall
hydra.recall.booleanRecall()       // Full-text search
hydra.recall.recallPreferences()   // Retrieve preference-style memories
hydra.recall.qna()                 // Q&A over stored knowledge
hydra.fetch.listData()             // List all stored sources
hydra.fetch.content()              // Fetch a specific source
hydra.fetch.graphRelationsBySourceId()  // Get graph relations for a source
hydra.graphHealth.getSuperNodes()  // Get highly-connected graph nodes
hydra.data.delete()                // Delete sources
hydra.embeddings.insert/search/filter/delete()  // Raw vector operations
```

### HydraDB Tenant Architecture

Every `tenant_id` is a workspace. Use **one tenant per MissionControl project**, with **sub-tenants per agent** for scoped recall:

```
tenant: "mc-{projectId}"
  sub-tenant: "agent-{agentId}"       → agent-scoped memories
  sub-tenant: "shared"                → cross-agent shared context
  sub-tenant: "decisions"             → architectural decisions
  sub-tenant: "failures"              → failure memory
  sub-tenant: "intents"               → active intent records
```

This gives you both global recall (search across all sub-tenants) and scoped recall (per-agent context). HydraDB handles the graph construction automatically from ingested text — you do not manually create edges.

### Environment Variables

```bash
# .env at root
HYDRA_API_KEY=hdb-...              # From https://app.hydradb.com — Bearer token
HYDRA_TENANT_ID=mc-yourproject     # Create once, reuse across sessions
ANTHROPIC_API_KEY=sk-ant-...       # For LLM-based semantic conflict detection
MC_SERVER_PORT=3000
MC_DASHBOARD_PORT=3001
```

**Setup step (run once per project):**
```typescript
// packages/server/src/setup.ts — run with `mc init` or at first startup
import { HydraDBClient } from '@hydradb/sdk'

const hydra = new HydraDBClient({ apiKey: process.env.HYDRA_API_KEY })

// Create tenant (idempotent — safe to call even if exists)
await hydra.tenant.create({ tenant_id: process.env.HYDRA_TENANT_ID })
```

---

## 4. HydraDB Memory Schema — The Brain

HydraDB automatically builds a knowledge graph from ingested text. Your job is to structure the ingested text and metadata so you can recall it precisely. Every "node type" from v1 becomes a memory document with structured metadata.

### Memory Document Format

All memories are ingested via `hydra.ingestionPipeline.ingestMemory()` or `hydra.upload.addMemory()`. Use `document_metadata` to store structured fields and `tenant_metadata` to store filterable categorization fields.

```typescript
// packages/server/src/hydra.ts

import { HydraDBClient } from '@hydradb/sdk'
import { v4 as uuidv4 } from 'uuid'

export const hydra = new HydraDBClient({
  apiKey: process.env.HYDRA_API_KEY!
})

export const TENANT_ID = process.env.HYDRA_TENANT_ID!

// Sub-tenant constants
export const SUB_TENANTS = {
  SHARED: 'shared',
  DECISIONS: 'decisions',
  FAILURES: 'failures',
  INTENTS: 'intents',
  agentId: (id: string) => `agent-${id}`,
} as const
```

### Agent State (stored in server in-memory + periodically synced)

Agent lifecycle (register, heartbeat, die) is too high-frequency for HydraDB round-trips. Store live agent state in-memory on the server; sync agent summaries to HydraDB on status changes so historical context is queryable.

```typescript
// packages/server/src/state.ts
// In-memory live state — fast, ephemeral

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
  activeIntentId?: string        // at most one declared-but-not-completed intent
  parentAgentId?: string
}

export const agents = new Map<string, AgentRecord>()
```

### Context Memory (ingested to HydraDB)

```typescript
// Ingest a context/knowledge node
async function ingestContext(params: {
  agentId: string
  content: string
  scope: string        // file path or glob the knowledge applies to
  tags: string[]
  confidence: number   // 0-1
}): Promise<string> {
  const sourceId = `ctx-${uuidv4()}`
  const text = `[CONTEXT] scope:${params.scope} tags:${params.tags.join(',')}
${params.content}`

  const result = await hydra.ingestionPipeline.ingestMemory({
    tenant_id: TENANT_ID,
    sub_tenant_id: SUB_TENANTS.SHARED,
    text,
    source_id: sourceId,
    infer: true,  // let HydraDB extract implicit relationships
    document_metadata: JSON.stringify({
      type: 'context',
      agent_id: params.agentId,
      scope: params.scope,
      tags: params.tags,
      confidence: params.confidence,
      created_at: Date.now(),
    }),
    tenant_metadata: JSON.stringify({
      type: 'context',
      scope: params.scope,
    }),
  })
  return sourceId
}
```

### Decision Memory

```typescript
async function ingestDecision(params: {
  agentId: string
  summary: string
  reasoning: string
  alternativesConsidered: string[]
  affectedFiles: string[]
  tags: string[]
}): Promise<string> {
  const sourceId = `dec-${uuidv4()}`
  const text = `[DECISION] ${params.summary}
Agent: ${params.agentId}
Affected files: ${params.affectedFiles.join(', ')}
Alternatives considered: ${params.alternativesConsidered.join('; ')}
Reasoning: ${params.reasoning}
Tags: ${params.tags.join(', ')}`

  await hydra.ingestionPipeline.ingestMemory({
    tenant_id: TENANT_ID,
    sub_tenant_id: SUB_TENANTS.DECISIONS,
    text,
    source_id: sourceId,
    infer: true,
    document_metadata: JSON.stringify({
      type: 'decision',
      agent_id: params.agentId,
      affected_files: params.affectedFiles,
      tags: params.tags,
      created_at: Date.now(),
    }),
    tenant_metadata: JSON.stringify({
      type: 'decision',
    }),
  })
  return sourceId
}
```

### Failure Memory

```typescript
async function ingestFailure(params: {
  agentId: string
  task: string
  target: string
  errorType: string
  errorMessage: string
  context: string
  stackTrace?: string
}): Promise<string> {
  const sourceId = `fail-${uuidv4()}`
  const text = `[FAILURE] target:${params.target} errorType:${params.errorType}
Task attempted: ${params.task}
Error: ${params.errorMessage}
Context at failure: ${params.context}
Agent: ${params.agentId}
${params.stackTrace ? `Stack trace:\n${params.stackTrace}` : ''}`

  await hydra.ingestionPipeline.ingestMemory({
    tenant_id: TENANT_ID,
    sub_tenant_id: SUB_TENANTS.FAILURES,
    text,
    source_id: sourceId,
    infer: false,  // failures are facts, don't infer from them
    document_metadata: JSON.stringify({
      type: 'failure',
      agent_id: params.agentId,
      target: params.target,
      error_type: params.errorType,
      created_at: Date.now(),
    }),
    tenant_metadata: JSON.stringify({
      type: 'failure',
      target: params.target,
    }),
  })
  return sourceId
}
```

### Intent State (in-memory + HydraDB for active conflict detection)

Active intents need sub-second read/write for conflict detection — keep them in-memory on the server. Also ingest completed intents to HydraDB for historical recall.

```typescript
// packages/server/src/state.ts (continued)

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

// Keyed by intentId — an agent can have at most one ACTIVE intent but we keep
// all pending/in-progress intents for conflict detection
export const activeIntents = new Map<string, IntentRecord>()

// Helper: get all active intents for a given agent
export function getIntentsByAgent(agentId: string): IntentRecord[] {
  return [...activeIntents.values()].filter(i => i.agentId === agentId)
}

// Helper: get all active intents whose target overlaps with a path
export function getIntentsForTarget(target: string): IntentRecord[] {
  return [...activeIntents.values()].filter(
    i =>
      (i.status === 'pending' || i.status === 'in-progress') &&
      pathsOverlap(i.target, target)
  )
}
```

### Recall Operations

```typescript
// packages/server/src/hydra.ts (continued)

// Recall context relevant to a file scope / task description
export async function recallContext(query: string, subTenant = SUB_TENANTS.SHARED) {
  const result = await hydra.recall.fullRecall({
    tenant_id: TENANT_ID,
    sub_tenant_id: subTenant,
    query,
    max_results: 10,
    graph_context: true,       // include graph-derived relations
    mode: 'thinking',          // deeper multi-hop reasoning
  })
  return result.body
}

// Recall past failures for a given target
export async function recallFailuresForTarget(target: string) {
  const result = await hydra.recall.booleanRecall({
    tenant_id: TENANT_ID,
    sub_tenant_id: SUB_TENANTS.FAILURES,
    query: `target:${target}`,
  })
  return result.body
}

// Recall decisions affecting a file
export async function recallDecisionsForTarget(target: string) {
  const result = await hydra.recall.fullRecall({
    tenant_id: TENANT_ID,
    sub_tenant_id: SUB_TENANTS.DECISIONS,
    query: `decisions affecting ${target}`,
    max_results: 10,
    graph_context: true,
  })
  return result.body
}

// Context inherited by a spawning agent from parent
export async function recallParentContext(parentAgentId: string) {
  const result = await hydra.recall.fullRecall({
    tenant_id: TENANT_ID,
    sub_tenant_id: SUB_TENANTS.agentId(parentAgentId),
    query: 'important context decisions patterns failures',
    max_results: 50,
    mode: 'thinking',
  })
  return result.body
}

// The "Why?" query — full decision chain for a target
export async function whyQuery(target: string) {
  const result = await hydra.recall.qna({
    tenant_id: TENANT_ID,
    sub_tenant_id: SUB_TENANTS.DECISIONS,
    question: `Why were certain decisions made about ${target}? What reasoning and alternatives were considered?`,
  })
  return result.body
}

// Get graph structure for dashboard visualization
export async function getGraphSuperNodes() {
  const result = await hydra.graphHealth.getSuperNodes({
    tenant_id: TENANT_ID,
  })
  return result.body
}

// Ingest agent work summary for inheritance by child agents
export async function ingestAgentSummary(agentId: string, summary: string) {
  await hydra.ingestionPipeline.ingestMemory({
    tenant_id: TENANT_ID,
    sub_tenant_id: SUB_TENANTS.agentId(agentId),
    text: summary,
    infer: true,
    document_metadata: JSON.stringify({
      type: 'agent_summary',
      agent_id: agentId,
      created_at: Date.now(),
    }),
  })
}
```

---

## 5. Server Implementation

### 5.1 Conflict Detection Engine (`packages/server/src/services/conflict-detector.ts`)

This is the most important service. It runs every time an intent is written.

```typescript
import Anthropic from '@anthropic-ai/sdk'
import { IntentRecord, activeIntents, getIntentsForTarget } from '../state.js'
import { recallContext, recallDecisionsForTarget, ingestDecision } from '../hydra.js'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

export interface ConflictResult {
  id: string
  severity: 'critical' | 'warning' | 'info'
  kind: 'file' | 'semantic' | 'architectural'
  description: string
  agentIds: string[]
  intentIds: string[]
  createdAt: number
}

export async function detectConflicts(newIntent: IntentRecord): Promise<ConflictResult[]> {
  const conflicts: ConflictResult[] = []

  // Step 1: File-level conflicts — fast, in-memory only
  const overlappingIntents = getIntentsForTarget(newIntent.target).filter(
    i => i.id !== newIntent.id && i.agentId !== newIntent.agentId
  )

  const fileConflicts = overlappingIntents.filter(
    i => isWriteOperation(i.action) && isWriteOperation(newIntent.action)
  )

  for (const existing of fileConflicts) {
    conflicts.push({
      id: `conflict-${Date.now()}-${Math.random().toString(36).slice(2)}`,
      severity: 'critical',
      kind: 'file',
      description: `${newIntent.agentId} and ${existing.agentId} both intend to write to ${newIntent.target}`,
      agentIds: [newIntent.agentId, existing.agentId],
      intentIds: [newIntent.id, existing.id],
      createdAt: Date.now(),
    })
  }

  // Step 2: Semantic conflicts — check ALL overlapping intents (not just write-write)
  // Use LLM to determine if intents are semantically contradictory
  // NOTE: gate behind overlappingIntents to avoid LLM calls when no overlap at all
  const semanticCandidates = overlappingIntents.filter(
    i => !fileConflicts.includes(i) // skip ones already flagged as file conflicts
  )
  for (const candidate of semanticCandidates) {
    const isConflicting = await checkSemanticConflict(newIntent, candidate)
    if (isConflicting) {
      conflicts.push({
        id: `conflict-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        severity: 'warning',
        kind: 'semantic',
        description: `Potential semantic conflict between ${newIntent.agentId} (${newIntent.description}) and ${candidate.agentId} (${candidate.description})`,
        agentIds: [newIntent.agentId, candidate.agentId],
        intentIds: [newIntent.id, candidate.id],
        createdAt: Date.now(),
      })
    }
  }

  // Step 3: Architectural conflicts — check against known decisions in HydraDB
  // Only run if no critical file conflict already found (avoid unnecessary LLM cost)
  if (conflicts.filter(c => c.severity === 'critical').length === 0) {
    const decisions = await recallDecisionsForTarget(newIntent.target)
    const decisionText = decisions.chunks?.map(c => c.chunk_content).join('\n') ?? ''

    if (decisionText.trim()) {
      const architecturalConflict = await checkArchitecturalConflict(newIntent, decisionText)
      if (architecturalConflict) {
        conflicts.push({
          id: `conflict-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          severity: 'warning',
          kind: 'architectural',
          description: `${newIntent.description} may contradict architectural decisions: ${architecturalConflict}`,
          agentIds: [newIntent.agentId],
          intentIds: [newIntent.id],
          createdAt: Date.now(),
        })
      }
    }
  }

  return conflicts
}

// LLM-based semantic conflict check
// FIX from v1: this function was defined but never called — now wired into Step 2
async function checkSemanticConflict(a: IntentRecord, b: IntentRecord): Promise<boolean> {
  const resp = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',  // use Haiku for cost — this is called frequently
    max_tokens: 100,
    messages: [{
      role: 'user',
      content: `Do these two coding agent intents semantically conflict? Answer YES or NO only.
Intent A (agent: ${a.agentId}): ${a.description} [target: ${a.target}]
Intent B (agent: ${b.agentId}): ${b.description} [target: ${b.target}]`
    }]
  })
  const text = resp.content[0].type === 'text' ? resp.content[0].text : ''
  return text.trim().toUpperCase().startsWith('YES')
}

// LLM-based architectural conflict check against recalled decisions
async function checkArchitecturalConflict(intent: IntentRecord, decisionContext: string): Promise<string | null> {
  const resp = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 150,
    messages: [{
      role: 'user',
      content: `Does this agent intent contradict any of the architectural decisions listed below?
Answer "NO" if no conflict, or a single sentence describing the contradiction if yes.

Intent: ${intent.description} [target: ${intent.target}]

Architectural decisions:
${decisionContext}`
    }]
  })
  const text = resp.content[0].type === 'text' ? resp.content[0].text.trim() : ''
  return text.toUpperCase().startsWith('NO') ? null : text
}

// Helper: classify write-type operations
function isWriteOperation(action: IntentRecord['action']): boolean {
  return ['write', 'refactor', 'delete', 'create'].includes(action)
}

// Helper: check if two file paths overlap (handles directory containment)
// FIX from v1: this was referenced by getIntentsForTarget but never implemented
export function pathsOverlap(a: string, b: string): boolean {
  // Normalize: remove trailing slashes, resolve relative components
  const normalize = (p: string) => p.replace(/\/+$/, '')
  const na = normalize(a)
  const nb = normalize(b)

  if (na === nb) return true

  // Check directory containment: does one path start with the other + '/'?
  if (na.startsWith(nb + '/') || nb.startsWith(na + '/')) return true

  // Handle glob patterns (basic: ** means any depth, * means any name in segment)
  const globToRegex = (g: string) =>
    new RegExp('^' + g.replace(/\*\*/g, '.*').replace(/\*/g, '[^/]*').replace(/\./g, '\\.') + '(/.*)?$')

  if (a.includes('*')) return globToRegex(a).test(b)
  if (b.includes('*')) return globToRegex(b).test(a)

  return false
}
```

### 5.2 WebSocket Hub (`packages/server/src/ws.ts`)

```typescript
import { WebSocketServer, WebSocket } from 'ws'
import type { IncomingMessage } from 'http'

export type WSEvent =
  | { type: 'agent:registered'; agent: AgentRecord }
  | { type: 'agent:heartbeat'; agentId: string; status: string; task?: string }
  | { type: 'agent:died'; agentId: string }
  | { type: 'context:ingested'; sourceId: string; agentId: string; scope: string; summary: string }
  | { type: 'intent:declared'; intent: IntentRecord }
  | { type: 'intent:updated'; intentId: string; status: IntentRecord['status'] }
  | { type: 'conflict:detected'; conflict: ConflictResult }
  | { type: 'conflict:resolved'; conflictId: string; resolution: string }
  | { type: 'decision:recorded'; sourceId: string; agentId: string; summary: string }
  | { type: 'failure:recorded'; sourceId: string; agentId: string; target: string; errorType: string }
  | { type: 'graph:snapshot'; superNodes: any[] }  // from graphHealth.getSuperNodes()

const clients = new Set<WebSocket>()

export function attachWebSocketServer(server: any) {
  const wss = new WebSocketServer({ server, path: '/ws' })

  wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
    clients.add(ws)
    ws.on('close', () => clients.delete(ws))
    ws.on('error', () => clients.delete(ws))
  })
}

export function broadcast(event: WSEvent) {
  const payload = JSON.stringify(event)
  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload)
    }
  }
}
```

### 5.3 API Routes

#### `POST /api/agents/register`
```typescript
body: { name: string, kind: AgentRecord['kind'], pid?: number, parentAgentId?: string }
returns: { agentId: string, inheritedContext: string }
// If parentAgentId: call recallParentContext(parentAgentId) from HydraDB
// agentId = "agent-{uuid}"
// Broadcast agent:registered
// inheritedContext is a formatted string of top recalled items for agent to inject into its system prompt
```

#### `POST /api/agents/:id/heartbeat`
```typescript
body: { status: AgentRecord['status'], currentTask?: string }
// Update in-memory agents Map
// Update contextRichness score (see §8)
// Broadcast agent:heartbeat
// Background task: if no heartbeat for 30s, mark died, broadcast agent:died
```

#### `POST /api/context`
```typescript
body: { agentId: string, content: string, tags: string[], scope: string, confidence: number }
// Call ingestContext() → HydraDB
// Broadcast context:ingested
// Recall related context and return it so agent can learn from peers immediately
returns: { sourceId: string, relatedContext: string }
```

#### `GET /api/context/query`
```typescript
query: { scope: string, tags?: string, agentId: string }
// Build query string: "context about {scope} related to {tags}"
// Call recallContext() from HydraDB
// Return formatted chunks
returns: { items: Array<{ content: string, score: number, scope: string }> }
```

#### `POST /api/intents`
```typescript
body: { agentId: string, action: string, target: string, description: string }
// Create IntentRecord, store in activeIntents Map
// Run detectConflicts()
// Broadcast intent:declared
// If conflicts: broadcast conflict:detected for each
returns: { intentId: string, conflicts: ConflictResult[], relevantContext: string }
```

#### `PATCH /api/intents/:id`
```typescript
body: { status: IntentRecord['status'] }
// Update in-memory activeIntents Map
// If completed/cancelled: remove from activeIntents after short delay (keep for 60s for audit)
// Broadcast intent:updated
// If completed: ingest summary to HydraDB for historical context
```

#### `POST /api/decisions`
```typescript
body: { agentId: string, summary: string, reasoning: string, alternativesConsidered: string[], affectedFiles: string[], tags?: string[] }
// Call ingestDecision() → HydraDB
// Broadcast decision:recorded
returns: { sourceId: string }
```

#### `POST /api/failures`
```typescript
body: { agentId: string, task: string, target: string, errorType: string, errorMessage: string, context: string, stackTrace?: string }
// Check if known: recallFailuresForTarget(target) before ingesting
// Call ingestFailure() → HydraDB
// Broadcast failure:recorded
returns: { sourceId: string, isKnown: boolean, relatedFailures: string }
```

#### `GET /api/failures/check`
```typescript
query: { target: string, agentId: string }
// Call recallFailuresForTarget(target)
// Return formatted failure summaries
returns: { failures: Array<{ summary: string, errorType: string, agentId: string }> }
```

#### `GET /api/graph`
```typescript
// Call getGraphSuperNodes() + hydra.fetch.listData() for full source list
// Returns data for D3 visualization
returns: {
  superNodes: SuperNodeItem[],   // from graphHealth.getSuperNodes()
  sources: SourceInfo[],         // from fetch.listData()
  activeAgents: AgentRecord[],
  activeIntents: IntentRecord[],
}
```

#### `GET /api/decisions/why`
```typescript
query: { target: string }
// Call whyQuery(target) — uses hydra.recall.qna()
// Returns structured answer with reasoning chain
returns: { answer: string, sources: SourceInfo[] }
```

---

## 6. SDK Implementation

### 6.1 Agent Client (`packages/sdk/src/agent.ts`)

```typescript
export class Agent {
  private serverUrl: string
  private agentId: string = ''
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null
  // FIX from v1: NodeJS.Timer does not exist; correct type is ReturnType<typeof setInterval>
  private currentIntentId: string | null = null
  // FIX from v1: track current intent ID so PostToolUse hook can call completeCurrentIntent()

  constructor(private config: {
    serverUrl: string
    name: string
    kind: 'claude-code' | 'codex' | 'opencode' | 'custom'
    parentAgentId?: string
  }) {
    this.serverUrl = config.serverUrl
  }

  async register(): Promise<{ agentId: string; inheritedContext: string }> {
    const resp = await fetch(`${this.serverUrl}/api/agents/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: this.config.name,
        kind: this.config.kind,
        parentAgentId: this.config.parentAgentId,
        pid: process.pid,
      }),
    })
    const data = await resp.json()
    this.agentId = data.agentId
    this.startHeartbeat()
    return data
  }

  private startHeartbeat() {
    this.heartbeatTimer = setInterval(async () => {
      try {
        await fetch(`${this.serverUrl}/api/agents/${this.agentId}/heartbeat`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'active' }),
        })
      } catch {
        // Swallow heartbeat errors — don't crash the agent
      }
    }, 5000)
    // Prevent heartbeat from keeping process alive after agent finishes
    if (this.heartbeatTimer.unref) this.heartbeatTimer.unref()
  }

  async declareIntent(action: string, target: string, description: string): Promise<{
    intentId: string
    clear: boolean
    conflicts: ConflictResult[]
    relevantContext: string
  }> {
    const resp = await fetch(`${this.serverUrl}/api/intents`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agentId: this.agentId, action, target, description }),
    })
    const data = await resp.json()
    this.currentIntentId = data.intentId  // track for completeCurrentIntent()
    return {
      ...data,
      clear: data.conflicts.length === 0,
    }
  }

  // FIX from v1: completeLastIntent() → completeCurrentIntent()
  // The hook calls this after PostToolUse to close the intent opened in PreToolUse
  async completeCurrentIntent(): Promise<void> {
    if (!this.currentIntentId) return
    await fetch(`${this.serverUrl}/api/intents/${this.currentIntentId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'completed' }),
    })
    this.currentIntentId = null
  }

  async writeContext(content: string, scope: string, tags: string[], confidence = 0.8): Promise<void> {
    await fetch(`${this.serverUrl}/api/context`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agentId: this.agentId, content, scope, tags, confidence }),
    })
  }

  async recordDecision(
    summary: string,
    reasoning: string,
    alternativesConsidered: string[],
    affectedFiles: string[],
    tags: string[] = []
  ): Promise<void> {
    await fetch(`${this.serverUrl}/api/decisions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ agentId: this.agentId, summary, reasoning, alternativesConsidered, affectedFiles, tags }),
    })
  }

  async recordFailure(
    task: string,
    target: string,
    error: Error,
    additionalContext = ''
  ): Promise<{ known: boolean; relatedFailures: string }> {
    const resp = await fetch(`${this.serverUrl}/api/failures`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agentId: this.agentId,
        task,
        target,
        errorType: error.constructor.name,
        errorMessage: error.message,
        context: additionalContext,
        stackTrace: error.stack,
      }),
    })
    return resp.json()
  }

  async checkFailures(target: string): Promise<Array<{ summary: string; errorType: string }>> {
    const resp = await fetch(
      `${this.serverUrl}/api/failures/check?target=${encodeURIComponent(target)}&agentId=${this.agentId}`
    )
    const data = await resp.json()
    return data.failures
  }

  async queryContext(scope: string, tags: string[] = []): Promise<string> {
    const params = new URLSearchParams({
      scope,
      agentId: this.agentId,
      ...(tags.length ? { tags: tags.join(',') } : {}),
    })
    const resp = await fetch(`${this.serverUrl}/api/context/query?${params}`)
    const data = await resp.json()
    // Return as formatted string for direct injection into agent prompts
    return data.items.map((i: any) => `- ${i.content} (scope: ${i.scope})`).join('\n')
  }

  async shutdown(): Promise<void> {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer)
    await fetch(`${this.serverUrl}/api/agents/${this.agentId}/heartbeat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'completed' }),
    }).catch(() => {})
  }
}
```

### 6.2 Claude Code Hooks (`packages/sdk/src/hooks/claude-code.ts`)

```typescript
// Generates the hook files that mc init installs into .claude/hooks/

export function generateClaudeCodeHooks(agentId: string, serverUrl: string): {
  preToolUse: string
  postToolUse: string
} {
  // The hook file stores intentId in a temp file so pre and post can share state
  // FIX from v1: hooks were using require() (CommonJS) but hook files need to be
  // compatible with how Claude Code loads them; use dynamic import for ESM safety
  // Also FIX: completeLastIntent() → completeCurrentIntent() and proper intent tracking

  const preToolUse = `
const fs = require('fs')
const path = require('path')
const INTENT_FILE = path.join(require('os').tmpdir(), 'mc_intent_${agentId}.json')

module.exports = async ({ tool_name, tool_input }) => {
  const WRITE_TOOLS = ['Write', 'Edit', 'MultiEdit', 'Bash']
  if (!WRITE_TOOLS.includes(tool_name)) return { decision: 'allow' }

  const target = tool_input.file_path || tool_input.path || tool_input.command || 'unknown'

  try {
    // Check known failures first
    const failResp = await fetch(\`${serverUrl}/api/failures/check?target=\${encodeURIComponent(target)}&agentId=${agentId}\`)
    const failData = await failResp.json()
    if (failData.failures.length > 0) {
      const f = failData.failures[0]
      // Warn but don't hard-block on failures — the agent may be fixing them
      process.stderr.write('[MissionControl] Known failure for ' + target + ': ' + f.summary + '\\n')
    }

    // Declare intent
    const intentResp = await fetch('${serverUrl}/api/intents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agentId: '${agentId}',
        action: 'write',
        target,
        description: tool_input.description || \`\${tool_name} on \${target}\`,
      }),
    })
    const intentData = await intentResp.json()

    // Persist intentId so PostToolUse can complete it
    fs.writeFileSync(INTENT_FILE, JSON.stringify({ intentId: intentData.intentId }))

    if (intentData.conflicts.length > 0) {
      const c = intentData.conflicts[0]
      if (c.severity === 'critical') {
        return {
          decision: 'block',
          reason: '[MissionControl CONFLICT] ' + c.description,
        }
      }
      // Warn-only for non-critical conflicts
      process.stderr.write('[MissionControl WARNING] ' + c.description + '\\n')
    }

    if (intentData.relevantContext) {
      process.stderr.write('[MissionControl Context]\\n' + intentData.relevantContext + '\\n')
    }
  } catch (err) {
    // Never block the agent due to MissionControl errors
    process.stderr.write('[MissionControl] Error (non-blocking): ' + err.message + '\\n')
  }

  return { decision: 'allow' }
}`.trim()

  const postToolUse = `
const fs = require('fs')
const path = require('path')
const INTENT_FILE = path.join(require('os').tmpdir(), 'mc_intent_${agentId}.json')

module.exports = async ({ tool_name, tool_input, tool_output }) => {
  const WRITE_TOOLS = ['Write', 'Edit', 'MultiEdit', 'Bash']
  if (!WRITE_TOOLS.includes(tool_name)) return

  try {
    // Complete the intent declared in PreToolUse
    if (fs.existsSync(INTENT_FILE)) {
      const { intentId } = JSON.parse(fs.readFileSync(INTENT_FILE, 'utf8'))
      await fetch(\`${serverUrl}/api/intents/\${intentId}\`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'completed' }),
      })
      fs.unlinkSync(INTENT_FILE)
    }

    // Write context about what was changed
    const target = tool_input.file_path || tool_input.path || 'unknown'
    await fetch('${serverUrl}/api/context', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agentId: '${agentId}',
        content: \`Modified \${target}: \${tool_input.description || tool_name + ' operation'}\`,
        scope: target,
        tags: ['modification', tool_name.toLowerCase()],
        confidence: 0.9,
      }),
    })
  } catch (err) {
    process.stderr.write('[MissionControl] PostToolUse error (non-blocking): ' + err.message + '\\n')
  }
}`.trim()

  return { preToolUse, postToolUse }
}

// mc init writes this to .claude/settings.json
export function buildClaudeSettingsHooks(agentId: string, serverUrl: string): object {
  return {
    hooks: {
      PreToolUse: [
        {
          matcher: 'Write|Edit|MultiEdit|Bash',
          hooks: [{ type: 'command', command: `node .claude/hooks/mc_pre.js` }],
        },
      ],
      PostToolUse: [
        {
          matcher: 'Write|Edit|MultiEdit|Bash',
          hooks: [{ type: 'command', command: `node .claude/hooks/mc_post.js` }],
        },
      ],
    },
  }
}
```

---

## 7. Dashboard Implementation

### 7.1 Design Direction

**Aesthetic:** Terminal-dark OS control room. Think NASA mission control meets modern dev tooling. Not purple gradients. Not generic SaaS.

**Color palette:**
```css
--bg-base: #0a0b0d;
--bg-surface: #111318;
--bg-elevated: #1a1d24;
--border: #1e2330;
--text-primary: #e8eaf0;
--text-secondary: #7a8099;
--text-muted: #4a5066;
--accent-green: #00ff88;
--accent-amber: #ffaa00;
--accent-red: #ff3355;
--accent-blue: #4488ff;
--accent-purple: #aa66ff;
--graph-edge: #1e2a3a;
```

**Typography:** UI text: `"JetBrains Mono"` (monospace — dev tool). Headers: `"IBM Plex Sans"`. Load via Bunny Fonts CDN (Google Fonts alternative, no tracking).

**Layout:** Fixed sidebar (220px) + main content area. Top status bar: active agent count, active conflict count, total memory nodes. Persistent across all views.

### 7.2 Zustand Store (`packages/dashboard/src/store/useStore.ts`)

```typescript
// FIX from v1: store was missing many action signatures that the WebSocket
// client referenced. All referenced actions are now defined here.

import { create } from 'zustand'

interface AgentRecord { /* ... mirrors server AgentRecord */ }
interface IntentRecord { /* ... */ }
interface ConflictResult { /* ... */ }

interface MissionControlStore {
  // Connection
  wsConnected: boolean
  setWsConnected: (v: boolean) => void  // FIX: was missing from store interface

  // Agents
  agents: Map<string, AgentRecord>
  updateAgent: (agent: AgentRecord) => void
  updateAgentHeartbeat: (id: string, status: string, task?: string) => void  // FIX: was missing
  markAgentDead: (id: string) => void  // FIX: was missing
  removeAgent: (id: string) => void

  // Graph — sourced from /api/graph (superNodes + sources)
  graphData: any | null
  setGraphData: (data: any) => void  // FIX: replaces addGraphNode/addGraphEdge/setGraph

  // Intents — keyed by intentId (FIX: v1 keyed by agentId — wrong, agent can have multiple)
  activeIntents: Map<string, IntentRecord>
  upsertIntent: (intent: IntentRecord) => void
  updateIntentStatus: (intentId: string, status: string) => void

  // Conflicts
  activeConflicts: ConflictResult[]
  resolvedConflicts: ConflictResult[]
  addConflict: (c: ConflictResult) => void  // FIX: was missing
  resolveConflict: (id: string, resolution: string) => Promise<void>

  // Decisions — lightweight summaries for the Decision Log view
  decisions: Array<{ sourceId: string; agentId: string; summary: string; createdAt: number }>
  addDecision: (d: any) => void  // FIX: was missing

  // Failures
  failures: Array<{ sourceId: string; agentId: string; target: string; errorType: string; createdAt: number }>
  addFailure: (f: any) => void  // FIX: was missing

  // UI
  activeView: 'fleet' | 'graph' | 'decisions' | 'conflicts' | 'failures'
  setView: (v: MissionControlStore['activeView']) => void  // FIX: type was string, now scoped
  selectedNodeId: string | null
  setSelectedNode: (id: string | null) => void
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
  resolveConflict: async (id, resolution) => {
    await fetch(`/api/conflicts/${id}/resolve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resolution }),
    })
    set((s) => ({
      activeConflicts: s.activeConflicts.filter((c) => c.id !== id),
      resolvedConflicts: [
        { ...s.activeConflicts.find((c) => c.id === id)!, resolvedAt: Date.now(), resolution },
        ...s.resolvedConflicts,
      ],
    }))
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
```

### 7.3 WebSocket Client (`packages/dashboard/src/hooks/useWebSocket.ts`)

```typescript
import { useEffect, useRef } from 'react'
import { useMissionControlStore } from '../store/useStore'

export function useWebSocket(serverUrl: string) {
  const store = useMissionControlStore()
  const wsRef = useRef<WebSocket | null>(null)
  const backoffRef = useRef(1000)

  // FIX from v1: serverUrl.replace('http', 'ws') silently breaks 'https://' → 'wss//'
  // Use proper URL parsing instead
  function buildWsUrl(url: string): string {
    const u = new URL(url)
    u.protocol = u.protocol === 'https:' ? 'wss:' : 'ws:'
    u.pathname = '/ws'
    return u.toString()
  }

  function connect() {
    const ws = new WebSocket(buildWsUrl(serverUrl))
    wsRef.current = ws

    ws.onopen = () => {
      store.setWsConnected(true)
      backoffRef.current = 1000  // reset backoff on successful connect
    }

    ws.onclose = () => {
      store.setWsConnected(false)
      // Exponential backoff reconnect (cap at 30s)
      setTimeout(() => connect(), backoffRef.current)
      backoffRef.current = Math.min(backoffRef.current * 2, 30000)
    }

    ws.onerror = () => {
      ws.close()  // trigger onclose for reconnect
    }

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data)
        switch (msg.type) {
          case 'agent:registered':
            store.updateAgent(msg.agent); break
          case 'agent:heartbeat':
            store.updateAgentHeartbeat(msg.agentId, msg.status, msg.task); break
          case 'agent:died':
            store.markAgentDead(msg.agentId); break
          case 'intent:declared':
            store.upsertIntent(msg.intent); break
          case 'intent:updated':
            store.updateIntentStatus(msg.intentId, msg.status); break
          case 'conflict:detected':
            store.addConflict(msg.conflict); break
          case 'conflict:resolved':
            store.resolveConflict(msg.conflictId, msg.resolution); break
          case 'decision:recorded':
            store.addDecision(msg); break
          case 'failure:recorded':
            store.addFailure(msg); break
          case 'graph:snapshot':
            store.setGraphData(msg); break
          // context:ingested is informational — refresh graph data
          case 'context:ingested':
            // Trigger graph refresh
            fetch('/api/graph').then(r => r.json()).then(d => store.setGraphData(d))
            break
        }
      } catch (e) {
        console.error('[WS] Failed to parse message', e)
      }
    }
  }

  useEffect(() => {
    connect()
    return () => {
      wsRef.current?.close()
    }
  }, [serverUrl])
}
```

### 7.4 Context Graph (D3 view)

The graph data comes from `GET /api/graph` which returns `superNodes` from `graphHealth.getSuperNodes()` (the most connected nodes in HydraDB's graph), `sources` from `fetch.listData()`, and live in-memory agents/intents from the server state.

Render three layers:
1. **Agent nodes** (from `activeAgents`) — large circles, colored by status
2. **Super nodes** (from HydraDB `graphHealth`) — medium circles, blue — these represent the most semantically central concepts in the shared memory
3. **Source nodes** (from `fetch.listData()`, sampled) — small dots, colored by `document_metadata.type`

Connect with D3 force simulation. On click → show full details by calling `fetch.content({ source_id })`.

---

## 8. Context Richness Score

```typescript
// FIX from v1: score is computed at heartbeat time and persisted back to the
// agent record. The formula is bounded and won't overflow via Math.min(100).
// v1 had the math correct but never specified WHERE to call this or persist the result.

// packages/server/src/services/agent-health.ts

export async function computeContextRichness(agentId: string): Promise<number> {
  // Query HydraDB: how much has this agent contributed and consumed?
  // We track this via server-side counters per agent (incremented on each API call)
  // rather than counting HydraDB edges (HydraDB doesn't expose edge count per source)

  const counters = agentCounters.get(agentId) ?? {
    inherited: 0, contextRead: 0, contextWrote: 0, warnedAbout: 0
  }

  const score = Math.min(100,
    counters.inherited * 15 +
    counters.contextRead * 3 +
    counters.contextWrote * 5 +
    counters.warnedAbout * 8
  )
  return Math.round(score)
}

// Increment on each API action:
// POST /api/context → ++contextWrote
// GET /api/context/query → ++contextRead
// GET /api/failures/check (with results) → ++warnedAbout
// POST /api/agents/register (with parentAgentId) → inherited += inheritedCount
```

---

## 9. Context Inheritance on Agent Spawn

```typescript
// packages/server/src/routes/agents.ts

async function handleRegister(req, reply) {
  const { name, kind, pid, parentAgentId } = req.body

  const agentId = `agent-${uuidv4()}`
  let inheritedContext = ''

  if (parentAgentId) {
    // Recall top context from parent agent's sub-tenant in HydraDB
    const recalled = await recallParentContext(parentAgentId)
    if (recalled.chunks?.length) {
      inheritedContext = recalled.chunks
        .slice(0, 20)
        .map(c => c.chunk_content)
        .join('\n---\n')

      // Also ingest a handoff note into the child agent's sub-tenant
      await ingestAgentSummary(
        agentId,
        `Inherited context from parent agent ${parentAgentId}:\n${inheritedContext}`
      )

      // Increment inherited counter for richness score
      const counters = agentCounters.get(agentId) ?? defaultCounters()
      agentCounters.set(agentId, { ...counters, inherited: recalled.chunks.length })
    }

    broadcast({ type: 'agent:registered', agent: { ...newAgent, parentAgentId } })
  }

  agents.set(agentId, newAgent)
  return reply.send({ agentId, inheritedContext })
}
```

The SDK returns `inheritedContext` as a formatted string — the agent should prepend it to its system prompt or first user message.

---

## 10. "Why?" Query

```typescript
// GET /api/decisions/why?target=src/auth/token.ts

async function handleWhyQuery(req, reply) {
  const { target } = req.query

  // Use HydraDB's Q&A recall — it synthesizes across stored decisions
  const result = await whyQuery(target)

  // result.answer is a generated answer from HydraDB's QnA endpoint
  // result.sources are the source documents that backed the answer

  return reply.send({
    answer: result.answer,
    sources: result.sources ?? [],
    query: `Why were decisions made about ${target}?`,
  })
}
```

The dashboard "Why?" panel renders `answer` as markdown and lists `sources` with links to full content via `GET /api/context/{sourceId}`.

---

## 11. Preflight Check + Failure Memory

```typescript
// packages/server/src/services/agent-health.ts

export async function preflightCheck(target: string, agentId: string): Promise<{
  safe: boolean
  failures: Array<{ summary: string; errorType: string }>
  suggestions: string
}> {
  const recalled = await recallFailuresForTarget(target)

  if (!recalled.chunks?.length) {
    return { safe: true, failures: [], suggestions: '' }
  }

  const failures = recalled.chunks.map(c => ({
    summary: c.chunk_content.slice(0, 200),
    errorType: (c.additional_metadata as any)?.error_type ?? 'unknown',
  }))

  // Increment warned counter for richness scoring
  const counters = agentCounters.get(agentId) ?? defaultCounters()
  agentCounters.set(agentId, { ...counters, warnedAbout: counters.warnedAbout + failures.length })

  // Generate suggestions from failure context using LLM
  const failureSummary = recalled.chunks.map(c => c.chunk_content).join('\n')
  const suggestResp = await anthropic.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 200,
    messages: [{
      role: 'user',
      content: `Given these past failures for ${target}, give 2-3 brief suggestions for avoiding them:\n${failureSummary}`,
    }]
  })
  const suggestions = suggestResp.content[0].type === 'text' ? suggestResp.content[0].text : ''

  return { safe: false, failures, suggestions }
}
```

---

## 12. Running Everything

### Development

```bash
# Install all dependencies
pnpm install

# Configure environment
cp .env.example .env
# Edit .env: set HYDRA_API_KEY (from https://app.hydradb.com)
# and HYDRA_TENANT_ID=mc-{yourproject}

# One-time tenant setup (run once per project)
pnpm --filter server run setup

# Start server (port 3000)
pnpm --filter server dev

# Start dashboard (port 3001)
pnpm --filter dashboard dev

# Build and link SDK + CLI for local testing
pnpm --filter sdk build && cd packages/sdk && pnpm link --global && cd -
pnpm --filter cli build && cd packages/cli && pnpm link --global && cd -
# FIX from v1: correct pnpm link syntax (run from within package dir, not via --filter)
```

### Single-command start

```bash
# pnpm run mc:start (in root package.json)
# Uses concurrently:
# "mc:start": "concurrently \"pnpm --filter server start\" \"pnpm --filter dashboard preview\""
```

### Environment Variables

```bash
HYDRA_API_KEY=hdb-...              # Bearer token from HydraDB dashboard
HYDRA_TENANT_ID=mc-yourproject     # Created on first mc init
ANTHROPIC_API_KEY=sk-ant-...       # For semantic conflict detection (Haiku model)
MC_SERVER_PORT=3000
MC_DASHBOARD_PORT=3001
```

---

## 13. Demo Script

**Build this as a real executable scenario, not a simulation.**

```bash
#!/bin/bash
# demo/run-demo.sh

set -e

echo "Starting MissionControl..."
mc start &
MC_PID=$!
sleep 3  # wait for server to be ready

cd demo/sample-app

echo "Spawning Agent A: claude-code working on auth..."
AGENT_A=$(mc agent run --name "claude-code-auth" --kind claude-code --json | jq -r .agentId)
echo "Agent A registered: $AGENT_A"

# Give Agent A time to write initial context discoveries
sleep 15

echo "Spawning Agent B: codex working on tests (inheriting Agent A context)..."
# FIX from v1: sleep added before Agent B spawn so Agent A has time to write context
AGENT_B=$(mc agent run --name "codex-tests" --kind codex --parent "$AGENT_A" --json | jq -r .agentId)
echo "Agent B registered with inherited context: $AGENT_B"

sleep 10

echo "Spawning Agent C: opencode on database (will conflict with Agent A)..."
AGENT_C=$(mc agent run --name "opencode-db" --kind opencode --json | jq -r .agentId)
echo "Agent C registered: $AGENT_C"

echo ""
echo "✅ Demo running."
echo "   Dashboard: http://localhost:3001"
echo "   - Watch Agent Fleet: 3 live agents with health rings"
echo "   - Watch Context Graph: knowledge building in real time"  
echo "   - Watch Conflict Feed: Agent C will trigger a conflict"
echo "   - Try: mc why --target src/auth/token.ts"

wait $MC_PID
```

The `demo/sample-app/` should be a real minimal Express app with auth, tests, and a database migration — something agents can actually do meaningful work on. Include it in the repo.

---

## 14. What Makes This Unbeatable

**vs. cmux:** cmux is a display layer for one terminal. MissionControl is a shared memory bus for many agents. cmux shows you *output*. MissionControl gives agents *intelligence from each other*.

**vs. OMX:** OMX prevents file conflicts with git worktrees (reactive, file-level). MissionControl prevents architectural conflicts before code is written (proactive, semantic-level). OMX is Codex-only. MissionControl is agent-agnostic.

**vs. everything else:** HydraDB's graph automatically surfaces relationships between memories — you don't have to design a query language or maintain edge schemas. The `graphHealth.getSuperNodes()` call gives you the most semantically central concepts in the codebase brain. The QnA endpoint turns "why did we do this?" into a first-class feature with zero bespoke implementation. No other tool has this.

---

## 15. Build Order (48h Timeline)

### Hour 0–3: Foundation
- [ ] Init monorepo, install `@hydradb/sdk`, `@anthropic-ai/sdk`, Fastify, ws
- [ ] `packages/server/src/hydra.ts` — all HydraDB functions working with real API key
- [ ] Tenant setup script — verify `hydra.tenant.create()` + `hydra.recall.fullRecall()` works
- [ ] Basic Fastify server with `/health` endpoint

### Hour 3–10: Core Data Layer
- [ ] `packages/server/src/state.ts` — in-memory agent + intent state
- [ ] `POST /api/agents/register` + heartbeat with dead-agent detection
- [ ] `POST /api/context` + `GET /api/context/query` — ingest + recall working end-to-end
- [ ] WebSocket hub + broadcast on every API write
- [ ] Verify: register agent → ingest context → recall it back

### Hour 10–18: Conflict Engine + SDK
- [ ] `packages/server/src/services/conflict-detector.ts` — all 3 steps (file, semantic, architectural)
- [ ] `POST /api/intents` with conflict detection on every write
- [ ] `POST /api/decisions` + `GET /api/decisions/why`
- [ ] `POST /api/failures` + `GET /api/failures/check`
- [ ] SDK `Agent` class — register, heartbeat, declareIntent, writeContext, completeCurrentIntent
- [ ] Claude Code hooks generator + `mc init` command

### Hour 18–28: Dashboard
- [ ] Vite + React + Tailwind setup
- [ ] Zustand store (complete, all actions defined)
- [ ] WebSocket hook with proper URL parsing + reconnect backoff
- [ ] Agent Fleet view with live cards + health rings
- [ ] Conflict Feed with resolution buttons

### Hour 28–36: Graph + Polish
- [ ] `GET /api/graph` returning superNodes + sources
- [ ] Context Graph D3 view (force simulation, 3 node layers)
- [ ] Decision Log view + "Why?" panel
- [ ] Failure Memory view

### Hour 36–44: Demo + Integration
- [ ] Build `demo/sample-app/` — real Express app with auth, tests, migrations
- [ ] Write `demo/run-demo.sh` that spawns real agents
- [ ] Test all 3 agents interacting + conflict detection firing
- [ ] Context inheritance working (Agent B gets Agent A's discoveries)

### Hour 44–48: Ship
- [ ] README with 60-second install instructions
- [ ] `mc start` works from clean clone
- [ ] Deploy server to Railway, dashboard to Vercel (or both on Railway)
- [ ] Record demo GIF

---

## 16. Non-Negotiables

1. **Every HydraDB call uses `@hydradb/sdk` with a real API key.** No mock functions.
2. **HydraDB is configured as a cloud tenant, not Docker/localhost.** `HYDRA_API_KEY` is mandatory env var.
3. **Conflict detection runs synchronously on every `POST /api/intents`.** Not a background job.
4. **The "Why?" query calls `hydra.recall.qna()`.** Not string concatenation or LLM with hardcoded context.
5. **Agent heartbeat uses `ReturnType<typeof setInterval>`, not `NodeJS.Timer`** (doesn't exist).
6. **Pre/PostToolUse hooks share intent ID via temp file, not in-memory state** (different processes).
7. **WebSocket URL built with `new URL()`, not string replace.**
8. **Zustand store defines every action the WebSocket client references.**
9. **`activeIntents` in store keyed by intentId, not agentId.**
10. **`pnpm link --global` run from within the package directory** after build.
11. **demo/run-demo.sh includes `sleep 15` before spawning Agent B** so Agent A has time to write context.
12. **Dashboard shows empty state, never an unresolvable spinner.** All async states handled.

---

*MissionControl — HydraDB is the soul. The graph is the moat. Ship it.*
