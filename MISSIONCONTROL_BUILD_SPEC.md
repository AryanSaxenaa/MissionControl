# MissionControl — Full Build Specification
### Version 3.0 | Grilled & Finalized | Soul: HydraDB + node-pty + Git Worktrees

> **What changed from v2:** Full terminal multiplexer built into the browser (not a monitoring layer on top of terminals). node-pty is core v1. xterm.js is core v1. Two WebSocket channels per agent. Git worktrees are enforced, not optional. Port registry added. HTTP hooks replace command hooks. OpenCode gets a dedicated npm plugin. The browser is the ONE interface — no separate terminal windows ever.

---

## 0. What You're Building

MissionControl is a **browser-based OS for parallel AI coding agents**. It is NASA Mission Control for your codebase.

One browser window. Multiple agents running in parallel. Each agent gets an isolated git worktree, an embedded terminal pane, and a port assignment. You see everything — terminal output, conflicts, decisions, memory — without switching windows. When an agent needs input, a modal appears. When an agent finishes, a diff + context review panel appears before merge.

**Three layers:**
1. **HydraDB Brain** — persistent shared memory. Every agent reads and writes here.
2. **Server OS Kernel** — spawns agents via node-pty, manages worktrees, detects conflicts, handles hooks.
3. **Browser Dashboard** — the only interface. Embedded xterm.js terminals + coordination panels.

**What it is not:**
- Not a monitoring layer on top of terminals you open yourself
- Not a chat interface
- Not macOS-only (unlike cmux)
- Not hook-only coordination (every agent type is supported)

---

## 1. Tech Stack

### Backend
- **Runtime:** Node.js 20+ with TypeScript
- **Framework:** Fastify
- **Terminal spawning:** `node-pty` — allocates real PTY, required for interactive CLIs (Claude Code, Codex, OpenCode all call `isatty()`)
- **Database / Memory Bus:** HydraDB via `@hydradb/sdk`
- **Real-time:** `ws` library — two WebSocket server instances (PTY channel + events channel)
- **Git operations:** `simple-git` — worktree lifecycle, diff, merge
- **Schema validation:** Zod
- **Environment injection:** `dotenv` — write `.env` into each worktree before spawn

### Frontend
- **Framework:** React 18 + Vite
- **Styling:** Tailwind CSS v3
- **Terminal rendering:** `xterm.js` + `xterm-addon-fit` + `xterm-addon-web-links`
- **Graphs:** D3.js (force-directed memory graph)
- **Charts:** Recharts (agent health, activity timeline)
- **State:** Zustand
- **Real-time:** Native WebSocket (two connections per agent)

### Packages
- **`@missioncontrol/opencode-plugin`** — OpenCode plugin (npm-installable, hooks into OpenCode's plugin system)

### Dev / Infra
- **Monorepo:** pnpm workspaces
- **Packages:** `packages/types`, `packages/sdk`, `packages/server`, `packages/dashboard`, `packages/cli`, `packages/opencode-plugin`

---

## 2. Repository Structure

```
missioncontrol/
├── packages/
│   ├── types/                          # Shared TypeScript interfaces — ALL packages import from here
│   │   ├── src/
│   │   │   └── index.ts                # AgentRecord, IntentRecord, ConflictResult, GraphData, DecisionItem, FailureItem
│   │   └── package.json
│   │
│   ├── server/
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── hydra.ts                    # HydraDB operations
│   │   │   ├── state.ts                    # In-memory agents + intents
│   │   │   ├── ws-events.ts                # Structured events WebSocket (/ws)
│   │   │   ├── ws-pty.ts                   # PTY byte-stream WebSocket (/pty/:agentId)
│   │   │   ├── routes/
│   │   │   │   ├── agents.ts               # Spawn, heartbeat, list
│   │   │   │   ├── context.ts
│   │   │   │   ├── intents.ts
│   │   │   │   ├── conflicts.ts
│   │   │   │   ├── failures.ts
│   │   │   │   ├── decisions.ts
│   │   │   │   ├── hooks.ts                # POST /hooks/* — receives from Claude Code + Codex
│   │   │   │   └── merge.ts                # GET /api/agents/:id/diff, POST /api/agents/:id/merge
│   │   │   └── services/
│   │   │       ├── pty-spawner.ts          # node-pty lifecycle
│   │   │       ├── worktree-manager.ts     # git worktree create/lock/diff/merge/delete
│   │   │       ├── port-registry.ts        # Port assignment + .env injection
│   │   │       ├── conflict-detector.ts
│   │   │       ├── graph-traversal.ts
│   │   │       └── agent-health.ts
│   │   └── package.json
│   │
│   ├── dashboard/
│   │   ├── src/
│   │   │   ├── main.tsx
│   │   │   ├── App.tsx
│   │   │   ├── store/
│   │   │   │   └── useStore.ts
│   │   │   ├── views/
│   │   │   │   ├── AgentFleet.tsx          # Grid of agent panes (terminals + status)
│   │   │   │   ├── MemoryGraph.tsx         # D3 graph of HydraDB supernodes
│   │   │   │   ├── DecisionLog.tsx
│   │   │   │   ├── ConflictFeed.tsx
│   │   │   │   └── FailureMemory.tsx
│   │   │   ├── components/
│   │   │   │   ├── AgentPane.tsx           # xterm.js terminal + status bar for one agent
│   │   │   │   ├── PermissionModal.tsx     # Approve/Deny modal for PermissionRequest hooks
│   │   │   │   ├── MergeReview.tsx         # Diff view + HydraDB context + Merge button
│   │   │   │   ├── NewAgentDialog.tsx      # Form: type + task → spawns agent
│   │   │   │   ├── ConflictAlert.tsx
│   │   │   │   ├── IntentBadge.tsx
│   │   │   │   └── HealthRing.tsx
│   │   │   └── hooks/
│   │   │       ├── useEventSocket.ts       # /ws — structured events
│   │   │       └── usePtySocket.ts         # /pty/:agentId — terminal bytes per agent
│   │   └── package.json
│   │
│   ├── opencode-plugin/                    # npm: @missioncontrol/opencode-plugin
│   │   ├── src/
│   │   │   └── index.ts                    # OpenCode plugin — hooks into tool.execute.before/after, permission.asked
│   │   └── package.json
│   │
│   ├── sdk/
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── agent.ts
│   │   │   ├── context.ts
│   │   │   ├── intent.ts
│   │   │   └── failure.ts
│   │   └── package.json
│   │
│   └── cli/
│       ├── src/
│       │   ├── index.ts
│       │   └── commands/
│       │       ├── init.ts
│       │       ├── start.ts
│       │       ├── agent.ts
│       │       ├── why.ts
│       │       ├── status.ts
│       │       └── conflicts.ts
│       └── package.json
│
├── .env.example
├── pnpm-workspace.yaml
└── package.json
```

---

## 3. Agent Lifecycle — Full Flow

This is the single most important section. Every other implementation decision follows from this.

```
User clicks "New Agent" in dashboard
    → NewAgentDialog: selects kind (claude-code|codex|opencode), enters task description
    → POST /api/agents/spawn { kind, task, name, parentAgentId? }

Server (POST /api/agents/spawn):
    1. agentId = "agent-{uuid}"
    2. WorktreeManager.create(agentId, taskName)
       → git worktree add -b agent/{agentId} .trees/{agentId} origin/main
       → git worktree lock .trees/{agentId}
    3. PortRegistry.assign(agentId)
       → finds next free port starting at 3100
       → writes PORT={port} into .trees/{agentId}/.env
    4. HookInstaller.install(agentId, kind, worktreePath)
       → for claude-code/codex: writes HTTP hook config into worktree's .claude/settings.json or .codex/hooks.json
       → for opencode: writes opencode.json with @missioncontrol/opencode-plugin dependency
    5. If parentAgentId: recallParentContext(parentAgentId) → inheritedContext
       → writes inheritedContext into .trees/{agentId}/.mc_context
    6. PtySpawner.spawn(agentId, kind, worktreePath, task, port)
       → spawns agent CLI via node-pty inside worktreePath
       → waits 1.5s for prompt to appear
       → injects task via PTY stdin
    7. agents.set(agentId, record)
    8. broadcast({ type: 'agent:spawned', agent })
    → returns { agentId, assignedPort }

Dashboard receives agent:spawned event:
    → creates AgentPane component
    → opens ws://server/pty/{agentId} → xterm.js starts rendering
    → opens ws://server/ws for structured events (shared connection, filters by agentId)
```

---

## 4. WebSocket Architecture — Two Channels

### Channel 1: PTY Byte Stream (`/pty/:agentId`)

One WebSocket connection per agent. Raw terminal bytes only. No JSON parsing.

**CRITICAL: Do NOT use `new WebSocketServer({ server, path })` for two servers on the same HTTP server — this does not route correctly in ws v8. Use `noServer: true` + manual `upgrade` event routing.**

```typescript
// packages/server/src/ws-pty.ts

import { WebSocketServer, WebSocket } from 'ws'
import type { Server } from 'http'
import { ptyInstances } from './services/pty-spawner.js'

const ptyWss = new WebSocketServer({ noServer: true })

export function attachPtyWebSocketServer(httpServer: Server) {
  // PTY upgrade handled in the shared upgrade listener in index.ts
  ptyWss.on('connection', (ws: WebSocket, agentId: string) => {
    const pty = ptyInstances.get(agentId)
    if (!pty) { ws.close(); return }

    // Server → client: terminal output bytes
    const disposable = pty.onData((data: string) => {
      if (ws.readyState === WebSocket.OPEN) ws.send(data)
    })

    // Client → server: keystrokes from xterm.js
    ws.on('message', (data) => {
      pty.write(data.toString())
    })

    ws.on('close', () => disposable.dispose())  // dispose the onData listener
    ws.on('error', () => disposable.dispose())
  })
}

export function handlePtyUpgrade(
  request: import('http').IncomingMessage,
  socket: import('stream').Duplex,
  head: Buffer
) {
  const agentId = request.url?.split('/pty/')[1]
  if (!agentId) { socket.destroy(); return }

  ptyWss.handleUpgrade(request, socket, head, (ws) => {
    ptyWss.emit('connection', ws, agentId)
  })
}
```

In `packages/server/src/index.ts`, route upgrades manually:

```typescript
// AFTER fastify.listen():
import { attachWebSocketServer, handleEventsUpgrade } from './ws-events.js'
import { handlePtyUpgrade } from './ws-pty.js'

fastify.server.on('upgrade', (request, socket, head) => {
  const { pathname } = new URL(request.url!, `http://localhost`)
  if (pathname === '/ws') {
    handleEventsUpgrade(request, socket, head)
  } else if (pathname.startsWith('/pty/')) {
    handlePtyUpgrade(request, socket, head)
  } else {
    socket.destroy()
  }
})
```

### Channel 2: Structured Events (`/ws`)

Shared broadcast channel. All agents, all event types.

```typescript
// packages/server/src/ws-events.ts — replaces ws.ts from v0.1.0

import { WebSocketServer, WebSocket } from 'ws'
import type { Server } from 'http'

// ... WSEvent union type (same as listed below) ...

const clients = new Set<WebSocket>()
const eventsWss = new WebSocketServer({ noServer: true })

eventsWss.on('connection', (ws: WebSocket) => {
  clients.add(ws)
  ws.on('close', () => clients.delete(ws))
  ws.on('error', () => clients.delete(ws))
})

export function handleEventsUpgrade(
  request: import('http').IncomingMessage,
  socket: import('stream').Duplex,
  head: Buffer
) {
  eventsWss.handleUpgrade(request, socket, head, (ws) => {
    eventsWss.emit('connection', ws)
  })
}

export function broadcast(event: WSEvent) {
  const payload = JSON.stringify(event)
  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) {
      try { client.send(payload) } catch { clients.delete(client) }
    }
  }
}
```

```typescript
export type WSEvent =
  | { type: 'agent:spawned'; agent: AgentRecord }
  | { type: 'agent:heartbeat'; agentId: string; status: string; task?: string }
  | { type: 'agent:died'; agentId: string }
  | { type: 'agent:completed'; agentId: string }          // agent process exited cleanly
  | { type: 'agent:ready-to-merge'; agentId: string }     // triggers MergeReview panel
  | { type: 'permission:requested'; agentId: string; requestId: string; tool: string; target: string; reason: string }
  | { type: 'permission:resolved'; agentId: string; requestId: string; decision: 'allow' | 'deny' }
  | { type: 'intent:declared'; intent: IntentRecord }
  | { type: 'intent:updated'; intentId: string; status: IntentRecord['status'] }
  | { type: 'conflict:detected'; conflict: ConflictResult }
  | { type: 'conflict:resolved'; conflictId: string; resolution: string }
  | { type: 'context:ingested'; sourceId: string; agentId: string; scope: string }
  | { type: 'decision:recorded'; sourceId: string; agentId: string; summary: string }
  | { type: 'failure:recorded'; sourceId: string; agentId: string; target: string; errorType: string }
  | { type: 'graph:snapshot'; superNodes: any[] }
```

---

## 5. Services

### 5.1 PTY Spawner (`packages/server/src/services/pty-spawner.ts`)

```typescript
import * as pty from 'node-pty'
import { broadcast } from '../ws-events.js'

// Maps agentId → pty instance
export const ptyInstances = new Map<string, pty.IPty>()

// CLI commands per agent kind
const CLI_COMMANDS: Record<AgentKind, { cmd: string; args: string[] }> = {
  'claude-code': { cmd: 'claude', args: [] },
  'codex':       { cmd: 'codex', args: [] },
  'opencode':    { cmd: 'opencode', args: [] },
  'custom':      { cmd: 'bash', args: [] },
}

export async function spawnAgent(
  agentId: string,
  kind: AgentKind,
  worktreePath: string,
  task: string,
  port: number
): Promise<void> {
  const { cmd, args } = CLI_COMMANDS[kind]

  const instance = pty.spawn(cmd, args, {
    name: 'xterm-256color',
    cols: 220,
    rows: 50,
    cwd: worktreePath,
    env: {
      ...process.env,
      PORT: String(port),
      MC_AGENT_ID: agentId,
      MC_SERVER_URL: `http://localhost:${process.env.MC_SERVER_PORT ?? 3000}`,
    },
  })

  ptyInstances.set(agentId, instance)

  // Wait for initial prompt, then inject task
  await waitForPrompt(instance)
  await injectTask(instance, task)

  // Monitor for process exit
  instance.onExit(({ exitCode }) => {
    ptyInstances.delete(agentId)
    if (exitCode === 0) {
      broadcast({ type: 'agent:completed', agentId })
      broadcast({ type: 'agent:ready-to-merge', agentId })
    } else {
      broadcast({ type: 'agent:died', agentId })
    }
  })
}

// Wait up to 3s for a shell prompt character
function waitForPrompt(instance: pty.IPty): Promise<void> {
  return new Promise((resolve) => {
    const timeout = setTimeout(resolve, 3000)
    // onData returns IDisposable — call .dispose() to remove listener (offData does NOT exist)
    const disposable = instance.onData((data: string) => {
      if (data.includes('$') || data.includes('>') || data.includes('%')) {
        clearTimeout(timeout)
        disposable.dispose()
        resolve()
      }
    })
  })
}

// Inject task as if the user typed it
async function injectTask(instance: pty.IPty, task: string): Promise<void> {
  // Small delay so the terminal is fully ready
  await new Promise(r => setTimeout(r, 200))
  instance.write(task + '\r')
}

export function killAgent(agentId: string): void {
  const instance = ptyInstances.get(agentId)
  if (instance) {
    instance.kill()
    ptyInstances.delete(agentId)
  }
}

export function writeToAgent(agentId: string, data: string): void {
  ptyInstances.get(agentId)?.write(data)
}
```

### 5.2 Worktree Manager (`packages/server/src/services/worktree-manager.ts`)

```typescript
import simpleGit from 'simple-git'
import path from 'path'
import fs from 'fs/promises'

const git = simpleGit(process.cwd())
const TREES_DIR = '.trees'

export async function createWorktree(agentId: string, taskName: string): Promise<string> {
  const safeName = taskName.toLowerCase().replace(/[^a-z0-9-]/g, '-').slice(0, 40)
  const branchName = `agent/${agentId}-${safeName}`
  const worktreePath = path.join(process.cwd(), TREES_DIR, agentId)

  await git.raw(['worktree', 'add', '-b', branchName, worktreePath, 'HEAD'])
  await git.raw(['worktree', 'lock', '--reason', `MissionControl agent ${agentId}`, worktreePath])

  return worktreePath
}

export async function getWorktreeDiff(agentId: string): Promise<string> {
  const worktreePath = path.join(process.cwd(), TREES_DIR, agentId)
  const worktreeGit = simpleGit(worktreePath)

  // Stage all changes to get a full diff
  await worktreeGit.add('.')
  const diff = await worktreeGit.diff(['--cached', 'HEAD'])
  // Unstage — user hasn't approved merge yet
  await worktreeGit.reset(['HEAD'])
  return diff
}

export async function mergeWorktree(agentId: string, commitMessage: string): Promise<void> {
  const worktreePath = path.join(process.cwd(), TREES_DIR, agentId)
  const worktreeGit = simpleGit(worktreePath)
  const branchName = `agent/${agentId}`

  // Commit in worktree
  await worktreeGit.add('.')
  await worktreeGit.commit(commitMessage)

  // Merge into main from the main worktree
  await git.merge([branchName, '--no-ff', '-m', `merge: ${commitMessage}`])

  await deleteWorktree(agentId)
}

export async function deleteWorktree(agentId: string): Promise<void> {
  const worktreePath = path.join(process.cwd(), TREES_DIR, agentId)
  await git.raw(['worktree', 'unlock', worktreePath]).catch(() => {})
  await git.raw(['worktree', 'remove', '--force', worktreePath]).catch(() => {})
  await git.raw(['branch', '-D', `agent/${agentId}`]).catch(() => {})
}
```

### 5.3 Port Registry (`packages/server/src/services/port-registry.ts`)

```typescript
import path from 'path'
import fs from 'fs/promises'

const PORT_START = 3100
const portMap = new Map<string, number>()
const usedPorts = new Set<number>()

export function assignPort(agentId: string): number {
  let port = PORT_START
  while (usedPorts.has(port)) port++
  portMap.set(agentId, port)
  usedPorts.add(port)
  return port
}

export function releasePort(agentId: string): void {
  const port = portMap.get(agentId)
  if (port) {
    usedPorts.delete(port)
    portMap.delete(agentId)
  }
}

// Write PORT into worktree .env so any dev server the agent starts uses the assigned port
export async function injectPortEnv(worktreePath: string, port: number): Promise<void> {
  const envPath = path.join(worktreePath, '.env')
  let existing = ''
  try { existing = await fs.readFile(envPath, 'utf8') } catch {}

  // Replace or append PORT line
  const lines = existing.split('\n').filter(l => !l.startsWith('PORT='))
  lines.push(`PORT=${port}`)
  await fs.writeFile(envPath, lines.join('\n'))
}
```

### 5.4 HTTP Hook Handler (`packages/server/src/routes/hooks.ts`)

Claude Code and Codex CLI both POST to these endpoints on every tool event. The JSON schema is identical between them.

```typescript
import { FastifyInstance } from 'fastify'
import { detectConflicts } from '../services/conflict-detector.js'
import { broadcast } from '../ws-events.js'
import { activeIntents, agents } from '../state.js'
import { preflightCheck } from '../services/agent-health.js'
import { ingestContext } from '../hydra.js'

// In-flight permission requests: requestId → resolve function
const pendingPermissions = new Map<string, (decision: 'allow' | 'deny') => void>()

export async function hooksRoutes(app: FastifyInstance) {

  // PreToolUse — runs before every Write/Edit/Bash tool call
  app.post('/hooks/pre-tool-use', async (req, reply) => {
    const body = req.body as HookPayload
    const { tool_name, tool_input, session_id } = body

    const WRITE_TOOLS = ['Write', 'Edit', 'MultiEdit', 'Bash']
    if (!WRITE_TOOLS.includes(tool_name)) {
      return reply.send({}) // allow, no action
    }

    const agentId = sessionToAgent.get(session_id)
    if (!agentId) return reply.send({})

    const target = tool_input.file_path || tool_input.path || tool_input.command || 'unknown'

    // Step 1: preflight failure check
    const preflight = await preflightCheck(target, agentId)
    if (preflight.failures.length > 0) {
      broadcast({ type: 'failure:recorded', sourceId: '', agentId, target, errorType: 'known-risk' })
    }

    // Step 2: declare intent + run conflict detection
    const intentId = `intent-${Date.now()}`
    const intent = {
      id: intentId, agentId,
      action: 'write' as const,
      target,
      description: tool_input.description ?? `${tool_name} on ${target}`,
      status: 'in-progress' as const,
      startedAt: Date.now(),
    }
    activeIntents.set(intentId, intent)
    broadcast({ type: 'intent:declared', intent })

    const conflicts = await detectConflicts(intent)
    for (const c of conflicts) broadcast({ type: 'conflict:detected', conflict: c })

    const criticalConflict = conflicts.find(c => c.severity === 'critical')
    if (criticalConflict) {
      activeIntents.delete(intentId)
      return reply.send({
        hookSpecificOutput: {
          hookEventName: 'PreToolUse',
          permissionDecision: 'deny',
          permissionDecisionReason: `[MissionControl CONFLICT] ${criticalConflict.description}`,
        },
      })
    }

    // Store intentId in session map for PostToolUse to resolve
    sessionIntents.set(session_id, intentId)
    return reply.send({}) // allow
  })

  // PostToolUse — runs after every Write/Edit/Bash
  app.post('/hooks/post-tool-use', async (req, reply) => {
    const body = req.body as HookPayload
    const { tool_name, tool_input, session_id } = body

    const WRITE_TOOLS = ['Write', 'Edit', 'MultiEdit', 'Bash']
    if (!WRITE_TOOLS.includes(tool_name)) return reply.send({})

    const agentId = sessionToAgent.get(session_id)
    if (!agentId) return reply.send({})

    // Complete the intent
    const intentId = sessionIntents.get(session_id)
    if (intentId) {
      const intent = activeIntents.get(intentId)
      if (intent) {
        activeIntents.set(intentId, { ...intent, status: 'completed' })
        broadcast({ type: 'intent:updated', intentId, status: 'completed' })
        setTimeout(() => activeIntents.delete(intentId), 60_000)
      }
      sessionIntents.delete(session_id)
    }

    // Ingest context about what was changed
    const target = tool_input.file_path || tool_input.path || 'unknown'
    await ingestContext({
      agentId,
      content: `Modified ${target}: ${tool_input.description ?? tool_name + ' operation'}`,
      scope: target,
      tags: ['modification', tool_name.toLowerCase()],
      confidence: 0.9,
    })

    return reply.send({})
  })

  // PermissionRequest — agent needs user approval; dashboard shows modal
  // This suspends the agent until the user responds
  app.post('/hooks/permission-request', async (req, reply) => {
    const body = req.body as HookPayload
    const { session_id, tool_name, tool_input } = body

    const agentId = sessionToAgent.get(session_id)
    if (!agentId) return reply.send({ hookSpecificOutput: { permissionDecision: 'allow' } })

    const requestId = `perm-${Date.now()}`
    const target = tool_input.file_path || tool_input.path || tool_input.command || 'unknown'

    // Push to dashboard — this will show the PermissionModal
    broadcast({
      type: 'permission:requested',
      agentId,
      requestId,
      tool: tool_name,
      target,
      reason: tool_input.description ?? '',
    })

    // Wait for user decision (up to 5 minutes, then default allow)
    const decision = await new Promise<'allow' | 'deny'>((resolve) => {
      pendingPermissions.set(requestId, resolve)
      setTimeout(() => {
        pendingPermissions.delete(requestId)
        resolve('allow') // default: allow on timeout
      }, 300_000)
    })

    broadcast({ type: 'permission:resolved', agentId, requestId, decision })
    return reply.send({
      hookSpecificOutput: {
        hookEventName: 'PermissionRequest',
        permissionDecision: decision,
      },
    })
  })

  // Dashboard calls this to resolve a pending permission request
  app.post('/api/permissions/:requestId/resolve', async (req, reply) => {
    const { requestId } = req.params as { requestId: string }
    const { decision } = req.body as { decision: 'allow' | 'deny' }

    const resolve = pendingPermissions.get(requestId)
    if (resolve) {
      pendingPermissions.delete(requestId)
      resolve(decision)
    }
    return reply.send({ ok: true })
  })
}

// Maintained by POST /api/agents/spawn and SessionStart hook
const sessionToAgent = new Map<string, string>() // sessionId → agentId
const sessionIntents = new Map<string, string>()  // sessionId → intentId

export { sessionToAgent }
```

### 5.5 Merge Review Routes (`packages/server/src/routes/merge.ts`)

```typescript
import { FastifyInstance } from 'fastify'
import { getWorktreeDiff, mergeWorktree, deleteWorktree } from '../services/worktree-manager.js'
import { whyQuery, recallContext } from '../hydra.js'
import { releasePort } from '../services/port-registry.js'
import { agents } from '../state.js'

export async function mergeRoutes(app: FastifyInstance) {

  // Returns git diff + HydraDB context for the merge review panel
  app.get('/api/agents/:id/diff', async (req, reply) => {
    const { id } = req.params as { id: string }
    const agent = agents.get(id)
    if (!agent) return reply.code(404).send({ error: 'agent not found' })

    const [diff, context] = await Promise.all([
      getWorktreeDiff(id),
      recallContext(`what did agent ${id} work on`, `agent-${id}`),
    ])

    return reply.send({
      diff,
      agentName: agent.name,
      task: agent.currentTask,
      contextSummary: context.chunks?.map((c: any) => c.chunk_content).join('\n') ?? '',
    })
  })

  // Merge the worktree into main
  app.post('/api/agents/:id/merge', async (req, reply) => {
    const { id } = req.params as { id: string }
    const { commitMessage } = req.body as { commitMessage: string }

    await mergeWorktree(id, commitMessage)
    releasePort(id)
    agents.delete(id)

    return reply.send({ ok: true })
  })

  // Discard the worktree without merging
  app.post('/api/agents/:id/discard', async (req, reply) => {
    const { id } = req.params as { id: string }

    await deleteWorktree(id)
    releasePort(id)
    agents.delete(id)

    return reply.send({ ok: true })
  })
}
```

---

## 6. Hook Installation

Before spawning, MissionControl writes hook configuration into the worktree.

### Claude Code (`~/.claude/settings.json` in the worktree)

```typescript
// packages/server/src/services/hook-installer.ts

export function buildClaudeHookConfig(serverUrl: string): object {
  return {
    hooks: {
      PreToolUse: [{
        matcher: 'Write|Edit|MultiEdit|Bash',
        hooks: [{ type: 'http', url: `${serverUrl}/hooks/pre-tool-use` }],
      }],
      PostToolUse: [{
        matcher: 'Write|Edit|MultiEdit|Bash',
        hooks: [{ type: 'http', url: `${serverUrl}/hooks/post-tool-use` }],
      }],
      PermissionRequest: [{
        matcher: '.*',
        hooks: [{ type: 'http', url: `${serverUrl}/hooks/permission-request` }],
      }],
      SessionStart: [{
        matcher: '.*',
        hooks: [{ type: 'http', url: `${serverUrl}/hooks/session-start` }],
      }],
    },
  }
}
```

**Note:** HTTP hook type is used (not `command`). The hook POSTs the event JSON to the MissionControl server synchronously. The server's response controls whether the tool is allowed, denied, or modified.

### Codex CLI (`.codex/hooks.json` in the worktree)

Identical JSON schema — same HTTP endpoints work for both.

```typescript
export function buildCodexHookConfig(serverUrl: string): object {
  return {
    hooks: {
      PreToolUse: [{ type: 'http', url: `${serverUrl}/hooks/pre-tool-use` }],
      PostToolUse: [{ type: 'http', url: `${serverUrl}/hooks/post-tool-use` }],
      PermissionRequest: [{ type: 'http', url: `${serverUrl}/hooks/permission-request` }],
      SessionStart: [{ type: 'http', url: `${serverUrl}/hooks/session-start` }],
    },
  }
}
```

### OpenCode (`opencode.json` in the worktree)

OpenCode requires an npm plugin — HTTP hook config alone is insufficient.

```json
{
  "plugins": ["@missioncontrol/opencode-plugin"],
  "env": {
    "MC_SERVER_URL": "http://localhost:3000",
    "MC_AGENT_ID": "{agentId}"
  }
}
```

---

## 7. OpenCode Plugin (`packages/opencode-plugin/src/index.ts`)

```typescript
import type { Plugin } from '@opencode-ai/plugin'  // package: @opencode-ai/plugin, NOT 'opencode-ai'

export const MissionControlPlugin: Plugin = async ({ client, project }) => {
  const serverUrl = process.env.MC_SERVER_URL!
  const agentId = process.env.MC_AGENT_ID!

  // Register this session with MissionControl
  await fetch(`${serverUrl}/hooks/session-start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ agentId, session_id: project.id }),
  }).catch(() => {})

  return {
    hooks: {
      'tool.execute.before': async ({ tool, input }) => {
        const WRITE_TOOLS = ['write', 'edit', 'bash']
        if (!WRITE_TOOLS.includes(tool.toLowerCase())) return

        const resp = await fetch(`${serverUrl}/hooks/pre-tool-use`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tool_name: tool,
            tool_input: input,
            session_id: project.id,
          }),
        })
        const data = await resp.json()
        if (data?.hookSpecificOutput?.permissionDecision === 'deny') {
          throw new Error(data.hookSpecificOutput.permissionDecisionReason ?? 'Blocked by MissionControl')
        }
      },

      'tool.execute.after': async ({ tool, input, output }) => {
        const WRITE_TOOLS = ['write', 'edit', 'bash']
        if (!WRITE_TOOLS.includes(tool.toLowerCase())) return

        await fetch(`${serverUrl}/hooks/post-tool-use`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tool_name: tool, tool_input: input, tool_output: output, session_id: project.id }),
        }).catch(() => {})
      },

      'permission.ask': async ({ tool, input, requestId }) => {  // event is 'permission.ask', NOT 'permission.asked'
        const resp = await fetch(`${serverUrl}/hooks/permission-request`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ tool_name: tool, tool_input: input, session_id: project.id }),
        })
        const data = await resp.json()
        return data?.hookSpecificOutput?.permissionDecision ?? 'allow'
      },

      'session.idle': async () => {
        // Agent has stopped working — signal completion
        await fetch(`${serverUrl}/hooks/session-idle`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ session_id: project.id, agentId }),
        }).catch(() => {})
      },
    },
  }
}
```

---

## 8. Dashboard

### 8.1 Design

**Aesthetic:** Terminal-dark OS control room. NASA meets dev tooling.

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
```

**Typography:** `"JetBrains Mono"` for terminal panes and code. `"IBM Plex Sans"` for UI text. Load via Bunny Fonts CDN.

**Layout:**
```
┌─────────────────────────────── MissionControl ──────────────────────────────┐
│ STATUS BAR: [● 2 agents active] [⚠ 1 conflict] [◈ 42 memory nodes] [+ New] │
├─────────────┬───────────────────────────────────────────────────────────────┤
│  SIDEBAR    │  MAIN CONTENT AREA                                             │
│  (220px)    │                                                                │
│             │                                                                │
│  Fleet      │                                                                │
│  Memory     │                                                                │
│  Conflicts  │                                                                │
│  Decisions  │                                                                │
│  Failures   │                                                                │
│             │                                                                │
└─────────────┴───────────────────────────────────────────────────────────────┘
```

### 8.2 AgentPane Component

Each agent gets one pane containing: xterm.js terminal + status bar + action buttons.

```tsx
// packages/dashboard/src/components/AgentPane.tsx
import { useEffect, useRef } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'

interface AgentPaneProps {
  agentId: string
  agentName: string
  status: string
  assignedPort: number
  onMergeClick: () => void
}

export function AgentPane({ agentId, agentName, status, assignedPort, onMergeClick }: AgentPaneProps) {
  const termRef = useRef<HTMLDivElement>(null)
  const xtermRef = useRef<Terminal | null>(null)
  const wsRef = useRef<WebSocket | null>(null)

  useEffect(() => {
    const term = new Terminal({
      theme: { background: '#0a0b0d', foreground: '#e8eaf0', cursor: '#00ff88' },
      fontFamily: '"JetBrains Mono", monospace',
      fontSize: 13,
      cursorBlink: true,
    })
    const fitAddon = new FitAddon()
    term.loadAddon(fitAddon)
    term.open(termRef.current!)
    fitAddon.fit()
    xtermRef.current = term

    // Connect to PTY channel for this agent
    const serverUrl = new URL(window.location.href)
    serverUrl.protocol = serverUrl.protocol === 'https:' ? 'wss:' : 'ws:'
    serverUrl.pathname = `/pty/${agentId}`
    const ws = new WebSocket(serverUrl.toString())
    wsRef.current = ws

    ws.onmessage = (e) => term.write(e.data)
    term.onData((data) => {
      if (ws.readyState === WebSocket.OPEN) ws.send(data)
    })

    return () => {
      ws.close()
      term.dispose()
    }
  }, [agentId])

  const statusColor = {
    active: 'text-accent-green',
    idle: 'text-accent-amber',
    failed: 'text-accent-red',
    completed: 'text-accent-blue',
  }[status] ?? 'text-text-secondary'

  return (
    <div className="flex flex-col bg-bg-surface border border-border rounded-lg overflow-hidden">
      {/* Status bar */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-bg-elevated border-b border-border">
        <div className="flex items-center gap-2">
          <HealthRing status={status} />
          <span className="text-text-primary text-sm font-mono">{agentName}</span>
          <span className={`text-xs ${statusColor}`}>{status}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-text-muted text-xs">:{assignedPort}</span>
          {status === 'completed' && (
            <button
              onClick={onMergeClick}
              className="px-2 py-0.5 text-xs bg-accent-green text-bg-base rounded font-mono"
            >
              Review & Merge
            </button>
          )}
        </div>
      </div>

      {/* Terminal */}
      <div ref={termRef} className="flex-1 min-h-0 p-1" />
    </div>
  )
}
```

### 8.3 PermissionModal Component

Appears when `permission:requested` event arrives via the events WebSocket.

```tsx
// packages/dashboard/src/components/PermissionModal.tsx

interface PermissionModalProps {
  agentId: string
  agentName: string
  requestId: string
  tool: string
  target: string
  reason: string
  onResolve: (decision: 'allow' | 'deny') => void
}

export function PermissionModal({ agentId, agentName, requestId, tool, target, reason, onResolve }: PermissionModalProps) {
  const resolve = async (decision: 'allow' | 'deny') => {
    await fetch(`/api/permissions/${requestId}/resolve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ decision }),
    })
    onResolve(decision)
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-bg-elevated border border-accent-amber rounded-lg p-6 max-w-lg w-full mx-4">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-accent-amber text-lg">⚠</span>
          <span className="text-text-primary font-mono">{agentName} needs permission</span>
        </div>
        <div className="space-y-2 mb-6 font-mono text-sm">
          <div><span className="text-text-muted">tool:</span> <span className="text-accent-blue">{tool}</span></div>
          <div><span className="text-text-muted">target:</span> <span className="text-text-primary">{target}</span></div>
          {reason && <div><span className="text-text-muted">reason:</span> <span className="text-text-secondary">{reason}</span></div>}
        </div>
        <div className="flex gap-3 justify-end">
          <button onClick={() => resolve('deny')} className="px-4 py-2 text-sm border border-accent-red text-accent-red rounded hover:bg-accent-red/10">
            Deny
          </button>
          <button onClick={() => resolve('allow')} className="px-4 py-2 text-sm bg-accent-green text-bg-base rounded font-mono">
            Allow
          </button>
        </div>
      </div>
    </div>
  )
}
```

### 8.4 MergeReview Component

Appears when `agent:ready-to-merge` event arrives. Shows diff + HydraDB context side by side.

```tsx
// packages/dashboard/src/components/MergeReview.tsx

export function MergeReview({ agentId, onClose }: { agentId: string; onClose: () => void }) {
  const [data, setData] = useState<{ diff: string; contextSummary: string; task: string } | null>(null)
  const [commitMessage, setCommitMessage] = useState('')

  useEffect(() => {
    fetch(`/api/agents/${agentId}/diff`).then(r => r.json()).then(setData)
  }, [agentId])

  const merge = async () => {
    await fetch(`/api/agents/${agentId}/merge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ commitMessage: commitMessage || data?.task }),
    })
    onClose()
  }

  const discard = async () => {
    await fetch(`/api/agents/${agentId}/discard`, { method: 'POST' })
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-bg-surface border border-border rounded-lg w-full max-w-5xl mx-4 max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-border">
          <span className="text-text-primary font-mono">Review & Merge — {data?.task}</span>
          <button onClick={onClose} className="text-text-muted hover:text-text-primary">✕</button>
        </div>

        <div className="flex flex-1 min-h-0 divide-x divide-border">
          {/* Diff panel */}
          <div className="flex-1 overflow-auto p-4">
            <div className="text-text-muted text-xs mb-2 font-mono">CHANGES</div>
            <pre className="text-xs font-mono whitespace-pre-wrap text-text-secondary">
              {data?.diff || 'Loading...'}
            </pre>
          </div>

          {/* HydraDB context panel */}
          <div className="w-80 overflow-auto p-4">
            <div className="text-text-muted text-xs mb-2 font-mono">WHY (from memory)</div>
            <p className="text-sm text-text-secondary">{data?.contextSummary || 'Loading context...'}</p>
          </div>
        </div>

        <div className="p-4 border-t border-border flex items-center gap-3">
          <input
            value={commitMessage}
            onChange={e => setCommitMessage(e.target.value)}
            placeholder={data?.task ?? 'Commit message...'}
            className="flex-1 bg-bg-elevated border border-border rounded px-3 py-1.5 text-sm font-mono text-text-primary"
          />
          <button onClick={discard} className="px-4 py-2 text-sm border border-border text-text-secondary rounded">
            Discard
          </button>
          <button onClick={merge} className="px-4 py-2 text-sm bg-accent-green text-bg-base rounded font-mono">
            Merge
          </button>
        </div>
      </div>
    </div>
  )
}
```

### 8.5 Zustand Store

```typescript
// packages/dashboard/src/store/useStore.ts

import { create } from 'zustand'

export interface AgentRecord {
  id: string
  name: string
  kind: 'claude-code' | 'codex' | 'opencode' | 'custom'
  status: 'active' | 'idle' | 'failed' | 'completed'
  currentTask?: string
  assignedPort: number
  contextRichness: number
  parentAgentId?: string
  lastHeartbeat: number
}

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
  updateAgentStatus: (id: string, status: string, task?: string) => void
  markAgentDead: (id: string) => void
  markAgentCompleted: (id: string) => void

  // Permission requests (shows PermissionModal)
  pendingPermissions: PermissionRequest[]
  addPermissionRequest: (r: PermissionRequest) => void
  removePermissionRequest: (requestId: string) => void

  // Merge review (shows MergeReview panel)
  agentsPendingMerge: string[]
  addAgentPendingMerge: (agentId: string) => void
  removeAgentPendingMerge: (agentId: string) => void

  // Intents (keyed by intentId)
  activeIntents: Map<string, any>
  upsertIntent: (intent: any) => void
  updateIntentStatus: (intentId: string, status: string) => void

  // Conflicts
  activeConflicts: any[]
  resolvedConflicts: any[]
  addConflict: (c: any) => void
  resolveConflict: (id: string, resolution: string) => Promise<void>

  // Decisions
  decisions: any[]
  addDecision: (d: any) => void

  // Failures
  failures: any[]
  addFailure: (f: any) => void

  // Graph
  graphData: any | null
  setGraphData: (data: any) => void

  // UI
  activeView: 'fleet' | 'graph' | 'decisions' | 'conflicts' | 'failures'
  setView: (v: MissionControlStore['activeView']) => void
  selectedNodeId: string | null
  setSelectedNode: (id: string | null) => void
}

export const useMissionControlStore = create<MissionControlStore>((set, get) => ({
  eventsConnected: false,
  setEventsConnected: (v) => set({ eventsConnected: v }),

  agents: new Map(),
  upsertAgent: (agent) => set(s => { const m = new Map(s.agents); m.set(agent.id, agent); return { agents: m } }),
  updateAgentStatus: (id, status, task) => set(s => {
    const m = new Map(s.agents); const a = m.get(id)
    if (a) m.set(id, { ...a, status, currentTask: task ?? a.currentTask, lastHeartbeat: Date.now() })
    return { agents: m }
  }),
  markAgentDead: (id) => set(s => {
    const m = new Map(s.agents); const a = m.get(id)
    if (a) m.set(id, { ...a, status: 'failed' }); return { agents: m }
  }),
  markAgentCompleted: (id) => set(s => {
    const m = new Map(s.agents); const a = m.get(id)
    if (a) m.set(id, { ...a, status: 'completed' }); return { agents: m }
  }),

  pendingPermissions: [],
  addPermissionRequest: (r) => set(s => ({ pendingPermissions: [...s.pendingPermissions, r] })),
  removePermissionRequest: (requestId) => set(s => ({
    pendingPermissions: s.pendingPermissions.filter(r => r.requestId !== requestId)
  })),

  agentsPendingMerge: [],
  addAgentPendingMerge: (id) => set(s => ({ agentsPendingMerge: [...s.agentsPendingMerge, id] })),
  removeAgentPendingMerge: (id) => set(s => ({ agentsPendingMerge: s.agentsPendingMerge.filter(a => a !== id) })),

  activeIntents: new Map(),
  upsertIntent: (intent) => set(s => { const m = new Map(s.activeIntents); m.set(intent.id, intent); return { activeIntents: m } }),
  updateIntentStatus: (intentId, status) => set(s => {
    const m = new Map(s.activeIntents); const i = m.get(intentId)
    if (i) m.set(intentId, { ...i, status }); return { activeIntents: m }
  }),

  activeConflicts: [],
  resolvedConflicts: [],
  addConflict: (c) => set(s => ({ activeConflicts: [c, ...s.activeConflicts] })),
  resolveConflict: async (id, resolution) => {
    await fetch(`/api/conflicts/${id}/resolve`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ resolution }),
    })
    set(s => ({
      activeConflicts: s.activeConflicts.filter(c => c.id !== id),
      resolvedConflicts: [{ ...s.activeConflicts.find(c => c.id === id)!, resolution }, ...s.resolvedConflicts],
    }))
  },

  decisions: [],
  addDecision: (d) => set(s => ({ decisions: [d, ...s.decisions].slice(0, 200) })),

  failures: [],
  addFailure: (f) => set(s => ({ failures: [f, ...s.failures].slice(0, 500) })),

  graphData: null,
  setGraphData: (data) => set({ graphData: data }),

  activeView: 'fleet',
  setView: (v) => set({ activeView: v }),
  selectedNodeId: null,
  setSelectedNode: (id) => set({ selectedNodeId: id }),
}))
```

### 8.6 Events WebSocket Hook

```typescript
// packages/dashboard/src/hooks/useEventSocket.ts

import { useEffect, useRef } from 'react'
import { useMissionControlStore } from '../store/useStore'

export function useEventSocket(serverUrl: string) {
  const store = useMissionControlStore()
  const wsRef = useRef<WebSocket | null>(null)
  const backoffRef = useRef(1000)

  function buildWsUrl(url: string): string {
    const u = new URL(url)
    u.protocol = u.protocol === 'https:' ? 'wss:' : 'ws:'
    u.pathname = '/ws'
    return u.toString()
  }

  function connect() {
    const ws = new WebSocket(buildWsUrl(serverUrl))
    wsRef.current = ws

    ws.onopen = () => { store.setEventsConnected(true); backoffRef.current = 1000 }
    ws.onclose = () => {
      store.setEventsConnected(false)
      setTimeout(connect, backoffRef.current)
      backoffRef.current = Math.min(backoffRef.current * 2, 30000)
    }
    ws.onerror = () => ws.close()

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data)
        switch (msg.type) {
          case 'agent:spawned':        store.upsertAgent(msg.agent); break
          case 'agent:heartbeat':      store.updateAgentStatus(msg.agentId, msg.status, msg.task); break
          case 'agent:died':           store.markAgentDead(msg.agentId); break
          case 'agent:completed':      store.markAgentCompleted(msg.agentId); break
          case 'agent:ready-to-merge': store.addAgentPendingMerge(msg.agentId); break
          case 'permission:requested': store.addPermissionRequest(msg); break
          case 'permission:resolved':  store.removePermissionRequest(msg.requestId); break
          case 'intent:declared':      store.upsertIntent(msg.intent); break
          case 'intent:updated':       store.updateIntentStatus(msg.intentId, msg.status); break
          case 'conflict:detected':    store.addConflict(msg.conflict); break
          case 'conflict:resolved':    store.resolveConflict(msg.conflictId, msg.resolution); break
          case 'decision:recorded':    store.addDecision(msg); break
          case 'failure:recorded':     store.addFailure(msg); break
          case 'graph:snapshot':       store.setGraphData(msg); break
          case 'context:ingested':
            fetch('/api/graph').then(r => r.json()).then(d => store.setGraphData(d))
            break
        }
      } catch (e) { console.error('[WS] parse error', e) }
    }
  }

  useEffect(() => {
    connect()
    return () => wsRef.current?.close()
  }, [serverUrl])
}
```

---

## 9. HydraDB — Memory Schema

> HydraDB is a cloud SaaS. Not Docker. Not Neo4j. The package is `@hydradb/sdk`. Auth uses `token` field (not `apiKey`).

**CRITICAL: The following is the ground-truth implementation verified against the working v0.1.0 codebase. Do not deviate from these field names.**

```typescript
// packages/server/src/hydra.ts

import { HydraDBClient } from '@hydradb/sdk'
import type { HydraDB } from '@hydradb/sdk'

// LAZY INIT — do not export a module-level client, it crashes if env var missing at import time
let _hydra: HydraDBClient | null = null
function getHydra(): HydraDBClient {
  if (!_hydra) {
    _hydra = new HydraDBClient({
      token: process.env.HYDRA_API_KEY!,  // field is 'token', NOT 'apiKey'
    })
  }
  return _hydra
}

function tenantId(): string {
  return process.env.HYDRA_TENANT_ID!
}

export const SUB_TENANTS = {
  SHARED: 'shared',
  DECISIONS: 'decisions',
  FAILURES: 'failures',
  INTENTS: 'intents',
  agentId: (id: string) => `agent-${id}`,
} as const

// Always wrap HydraDB calls with this — network calls can hang indefinitely
const HYDRA_TIMEOUT_MS = 15000
function withTimeout<T>(promise: Promise<T>, ms = HYDRA_TIMEOUT_MS): Promise<T> {
  let timer: ReturnType<typeof setTimeout>
  const timed = new Promise<T>((_, reject) => {
    timer = setTimeout(() => reject(new Error(`HydraDB call timed out after ${ms}ms`)), ms)
  })
  return Promise.race([promise, timed]).finally(() => {
    clearTimeout(timer!)
    promise.catch(() => {})
  })
}

// Internal helper — all ingestion goes through this
async function doIngest(params: {
  subTenant: string
  text: string
  infer: boolean
  metadata: Record<string, unknown>
  additionalMetadata?: Record<string, unknown>
}): Promise<string> {
  const result = await withTimeout(getHydra().ingestionPipeline.ingestMemory({
    tenant_id: tenantId(),
    sub_tenant_id: params.subTenant,
    text: params.text,
    infer: params.infer,
    metadata: params.metadata,                    // plain object, NOT JSON.stringify
    additional_metadata: params.additionalMetadata, // plain object, NOT JSON.stringify
    // DO NOT pass source_id — SDK auto-assigns and returns doc_id
  }))
  return result.doc_id   // SDK returns doc_id, not source_id
}

export async function ingestContext(params: {
  agentId: string
  content: string
  scope: string
  tags: string[]
  confidence: number
}): Promise<string> {
  return doIngest({
    subTenant: SUB_TENANTS.SHARED,
    text: `[CONTEXT] scope:${params.scope} tags:${params.tags.join(',')}\n${params.content}`,
    infer: true,
    metadata: {
      type: 'context',
      agent_id: params.agentId,
      scope: params.scope,
      tags: params.tags,
      confidence: params.confidence,
      created_at: Date.now(),
    },
    additionalMetadata: { type: 'context', scope: params.scope },
  })
}

export async function ingestDecision(params: {
  agentId: string
  summary: string
  reasoning: string
  alternativesConsidered: string[]
  affectedFiles: string[]
  tags: string[]
}): Promise<string> {
  return doIngest({
    subTenant: SUB_TENANTS.DECISIONS,
    text: `[DECISION] ${params.summary}\nAgent: ${params.agentId}\nAffected files: ${params.affectedFiles.join(', ')}\nAlternatives considered: ${params.alternativesConsidered.join('; ')}\nReasoning: ${params.reasoning}\nTags: ${params.tags.join(', ')}`,
    infer: true,
    metadata: {
      type: 'decision',
      agent_id: params.agentId,
      affected_files: params.affectedFiles,
      tags: params.tags,
      created_at: Date.now(),
    },
    additionalMetadata: { type: 'decision' },
  })
}

export async function ingestFailure(params: {
  agentId: string
  task: string
  target: string
  errorType: string
  errorMessage: string
  context: string
  stackTrace?: string
}): Promise<string> {
  return doIngest({
    subTenant: SUB_TENANTS.FAILURES,
    text: `[FAILURE] target:${params.target} errorType:${params.errorType}\nTask attempted: ${params.task}\nError: ${params.errorMessage}\nContext at failure: ${params.context}\nAgent: ${params.agentId}\n${params.stackTrace ? `Stack trace:\n${params.stackTrace}` : ''}`,
    infer: false,
    metadata: {
      type: 'failure',
      agent_id: params.agentId,
      target: params.target,
      error_type: params.errorType,
      created_at: Date.now(),
    },
    additionalMetadata: { type: 'failure', target: params.target },
  })
}

export async function ingestAgentSummary(agentId: string, summary: string): Promise<void> {
  await doIngest({
    subTenant: SUB_TENANTS.agentId(agentId),
    text: summary,
    infer: true,
    metadata: { type: 'agent_summary', agent_id: agentId, created_at: Date.now() },
  })
}

// Recall functions — result is returned directly, NO .body wrapper
export async function recallContext(query: string, subTenant = SUB_TENANTS.SHARED): Promise<HydraDB.RetrievalResult> {
  return withTimeout(getHydra().recall.fullRecall({
    tenant_id: tenantId(),
    sub_tenant_id: subTenant,
    query,
    max_results: 10,
    graph_context: true,
    mode: 'thinking',
  })) as Promise<HydraDB.RetrievalResult>
}

export async function recallFailuresForTarget(target: string): Promise<HydraDB.RetrievalResult> {
  return withTimeout(getHydra().recall.booleanRecall({
    tenant_id: tenantId(),
    sub_tenant_id: SUB_TENANTS.FAILURES,
    query: `target:${target}`,
    max_results: 10,
  })) as Promise<HydraDB.RetrievalResult>
}

export async function recallDecisionsForTarget(target: string): Promise<HydraDB.RetrievalResult> {
  return withTimeout(getHydra().recall.fullRecall({
    tenant_id: tenantId(),
    sub_tenant_id: SUB_TENANTS.DECISIONS,
    query: `decisions affecting ${target}`,
    max_results: 10,
    graph_context: true,
  })) as Promise<HydraDB.RetrievalResult>
}

export async function recallParentContext(parentAgentId: string): Promise<HydraDB.RetrievalResult> {
  return withTimeout(getHydra().recall.fullRecall({
    tenant_id: tenantId(),
    sub_tenant_id: SUB_TENANTS.agentId(parentAgentId),
    query: 'important context decisions patterns failures',
    max_results: 50,
    mode: 'thinking',
  })) as Promise<HydraDB.RetrievalResult>
}

export async function whyQuery(target: string): Promise<HydraDB.QnASearchResponse> {
  return withTimeout(getHydra().recall.qna({
    tenant_id: tenantId(),
    sub_tenant_id: SUB_TENANTS.DECISIONS,
    question: `Why were certain decisions made about ${target}? What reasoning and alternatives were considered?`,
    include_graph_context: true,
  })) as Promise<HydraDB.QnASearchResponse>
}

export async function getGraphSuperNodes(): Promise<HydraDB.SuperNodeResponse> {
  return withTimeout(getHydra().graphHealth.getSuperNodes({
    tenant_id: tenantId(),
    limit: 50,
  })) as Promise<HydraDB.SuperNodeResponse>
}

export async function listSources() {
  return withTimeout(getHydra().fetch.listData({
    tenant_id: tenantId(),
    page_size: 100,
  }))
}
```

**Usage of recall results:**
```typescript
// Correct — access .chunks directly, NO .body wrapper
const result = await recallContext('query')
const text = result.chunks?.map(c => c.chunk_content).join('\n') ?? ''

// Correct — QnA response
const qna = await whyQuery('src/auth/token.ts')
const answer = qna.answer
const sources = qna.sources ?? []
```

---

## 10. Conflict Detection Engine

Unchanged from v2. Three-step detection: file-level (in-memory), semantic (LLM via claude-haiku-4-5-20251001), architectural (HydraDB decisions recall + LLM). See v2 spec §5.1.

---

## 11. Context Richness Score

Unchanged from v2. Computed at heartbeat time, persisted back to agent record. See v2 spec §8.

---

## 12. Environment Variables

```bash
HYDRA_API_KEY=hdb-...              # Bearer token from https://app.hydradb.com
HYDRA_TENANT_ID=mc-yourproject     # Create once per project with mc init
ANTHROPIC_API_KEY=sk-ant-...       # For LLM-based conflict detection (Haiku)
MC_SERVER_PORT=3000
MC_DASHBOARD_PORT=3001
# Port registry starts at 3100 and increments per agent — no env var needed
```

---

## 13. Running Everything

```bash
pnpm install

cp .env.example .env
# Set HYDRA_API_KEY and HYDRA_TENANT_ID

pnpm --filter server run setup   # one-time tenant creation

pnpm --filter server dev         # port 3000
pnpm --filter dashboard dev      # port 3001
```

Open `http://localhost:3001`. Click **+ New Agent**. Select kind, enter task. Agent spawns, worktree created, terminal appears in browser.

---

## 14. Build Order

### Hour 0–4: Foundation
- [ ] Monorepo init, all dependencies installed (`node-pty`, `simple-git`, `@hydradb/sdk`, `@anthropic-ai/sdk`, `ws`, Fastify, Zod)
- [ ] `hydra.ts` — all HydraDB functions working with real API key
- [ ] `state.ts` — in-memory agent + intent maps
- [ ] Basic Fastify server + `/health`
- [ ] Tenant setup script

### Hour 4–10: Core Services
- [ ] `port-registry.ts` — assign, release, inject into .env
- [ ] `worktree-manager.ts` — create, lock, diff, merge, delete
- [ ] `pty-spawner.ts` — spawn agent via node-pty, inject task, monitor exit
- [ ] `hook-installer.ts` — write hook config into worktree for claude-code + codex
- [ ] `POST /api/agents/spawn` — full lifecycle: worktree + port + hooks + pty
- [ ] PTY WebSocket server (`/pty/:agentId`)
- [ ] Events WebSocket server (`/ws`) + broadcast

### Hour 10–18: Hooks + Coordination
- [ ] `POST /hooks/pre-tool-use` + `POST /hooks/post-tool-use`
- [ ] `POST /hooks/permission-request` + `POST /api/permissions/:id/resolve`
- [ ] `conflict-detector.ts` — all 3 steps working
- [ ] `POST /api/intents` with conflict detection
- [ ] `POST /api/decisions` + `GET /api/decisions/why`
- [ ] `POST /api/failures` + `GET /api/failures/check`
- [ ] `GET /api/agents/:id/diff` + `POST /api/agents/:id/merge`

### Hour 18–28: Dashboard Core
- [ ] Vite + React + Tailwind + xterm.js setup
- [ ] Zustand store (all actions defined)
- [ ] `useEventSocket.ts` — events WebSocket + message routing
- [ ] `usePtySocket.ts` — per-agent PTY WebSocket
- [ ] `AgentPane.tsx` — xterm.js rendering + status bar
- [ ] `AgentFleet.tsx` — grid of AgentPane components
- [ ] `NewAgentDialog.tsx` — form + POST /api/agents/spawn
- [ ] `PermissionModal.tsx` — approve/deny flow

### Hour 28–36: Merge + Graph + Polish
- [ ] `MergeReview.tsx` — diff + context + merge button
- [ ] `GET /api/graph` + `MemoryGraph.tsx` (D3 force graph)
- [ ] `DecisionLog.tsx` + "Why?" panel
- [ ] `ConflictFeed.tsx` with resolution buttons
- [ ] `FailureMemory.tsx`
- [ ] Status bar (agent count, conflict count, memory node count)

### Hour 36–42: OpenCode Plugin
- [ ] `packages/opencode-plugin/src/index.ts`
- [ ] Publish or link locally
- [ ] Test OpenCode integration end-to-end

### Hour 42–48: Ship
- [ ] README with 60-second install instructions
- [ ] `mc start` works from clean clone
- [ ] Test: spawn 2 agents, trigger conflict, approve permission, review + merge
- [ ] Record demo GIF

---

## 15. Non-Negotiables

1. **`node-pty` is used for ALL agent spawning.** `child_process.exec` will stall interactive CLIs.
2. **Two WebSocket servers using `noServer: true` + `upgrade` event routing.** Never use `new WebSocketServer({ server, path })` for more than one server on the same HTTP server — it silently breaks in ws v8.
3. **`onData()` returns an `IDisposable` — call `.dispose()` to remove the listener.** `pty.offData()` does not exist.
4. **Git worktree created before agent spawns.** Agent never runs in the main working tree.
5. **Port registry assigns unique ports starting at 3100.** Injected as `PORT=` into worktree `.env`.
6. **HydraDB client initialized as `new HydraDBClient({ token: process.env.HYDRA_API_KEY! })`.** The field is `token`, NOT `apiKey`.
7. **HydraDB `ingestMemory` takes `metadata: {}` and `additional_metadata: {}` as plain objects.** Never `JSON.stringify`. Never pass `source_id` — SDK auto-assigns and returns `doc_id`.
8. **HydraDB recall results are accessed directly: `result.chunks`, `result.answer`.** There is NO `.body` wrapper.
9. **HTTP hooks (`type: 'http'`) for Claude Code. Verify Codex CLI version before assuming same.** Fallback: `command` hook that curls the server.
10. **OpenCode plugin imports from `@opencode-ai/plugin`.** NOT `opencode-ai`.
11. **OpenCode permission event is `'permission.ask'`.** NOT `'permission.asked'`.
12. **All shared types live in `packages/types`.** Never duplicate `AgentRecord`, `IntentRecord`, `ConflictResult`, `HookPayload` in individual packages.
13. **`AgentRecord` has `assignedPort: number` and `worktreePath: string` fields** added in v3. Update the types package.
14. **Task injected via PTY stdin after prompt detection.** Not via CLI flags — works universally for all agent kinds.
15. **Merge review shows git diff AND HydraDB context side by side.** The "why" panel is the differentiator.
16. **The browser is the only interface.** No instructions to open separate terminals. Ever.
17. **WebSocket URL built with `new URL()`, not string replace.**
18. **HydraDB is cloud SaaS with Bearer token.** No Docker, no localhost:7474.
19. **All empty/loading states handled in the dashboard.** No unresolvable spinners.
20. **`activeIntents` in Zustand keyed by intentId, not agentId.**

---

---

## 16. Shared Types Package (`packages/types`)

**All packages import from here. Never duplicate type definitions.**

```typescript
// packages/types/src/index.ts

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
  assignedPort: number       // port assigned by PortRegistry
  worktreePath: string       // absolute path to this agent's git worktree
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
```

```json
// packages/types/package.json
{
  "name": "@missioncontrol/types",
  "version": "0.1.0",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": { ".": { "import": "./dist/index.js", "types": "./dist/index.d.ts" } },
  "scripts": { "build": "tsc" },
  "devDependencies": { "typescript": "^5.0.0" }
}
```

---

## 17. Package Dependencies

Every `package.json` listed here. Install all before writing any code.

### Root `package.json`
```json
{
  "name": "missioncontrol",
  "private": true,
  "scripts": {
    "mc:start": "concurrently \"pnpm --filter server start\" \"pnpm --filter dashboard preview\"",
    "dev": "concurrently \"pnpm --filter server dev\" \"pnpm --filter dashboard dev\""
  },
  "devDependencies": {
    "concurrently": "^8.0.0"
  }
}
```

### `pnpm-workspace.yaml`
```yaml
packages:
  - 'packages/*'
```

### `packages/server/package.json`
```json
{
  "name": "@missioncontrol/server",
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "start": "node dist/index.js",
    "build": "tsc",
    "setup": "tsx src/setup.ts"
  },
  "dependencies": {
    "@anthropic-ai/sdk": "^0.39.0",
    "@fastify/cors": "^9.0.0",
    "@hydradb/sdk": "^0.0.3",
    "@missioncontrol/types": "workspace:*",
    "fastify": "^4.28.0",
    "node-pty": "^1.0.0",
    "simple-git": "^3.27.0",
    "uuid": "^11.0.0",
    "ws": "^8.18.0",
    "zod": "^3.23.0"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "@types/uuid": "^10.0.0",
    "@types/ws": "^8.5.0",
    "tsx": "^4.19.0",
    "typescript": "^5.0.0"
  }
}
```

### `packages/dashboard/package.json`
```json
{
  "name": "@missioncontrol/dashboard",
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite --port 3001",
    "build": "tsc && vite build",
    "preview": "vite preview --port 3001"
  },
  "dependencies": {
    "@missioncontrol/types": "workspace:*",
    "@xterm/addon-fit": "^0.10.0",
    "@xterm/addon-web-links": "^0.11.0",
    "@xterm/xterm": "^5.5.0",
    "d3": "^7.9.0",
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "recharts": "^2.13.0",
    "zustand": "^5.0.0"
  },
  "devDependencies": {
    "@types/d3": "^7.4.0",
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "@vitejs/plugin-react": "^4.3.0",
    "autoprefixer": "^10.4.0",
    "postcss": "^8.4.0",
    "tailwindcss": "^3.4.0",
    "typescript": "^5.0.0",
    "vite": "^5.4.0"
  }
}
```

### `packages/opencode-plugin/package.json`
```json
{
  "name": "@missioncontrol/opencode-plugin",
  "version": "0.1.0",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "scripts": { "build": "tsc" },
  "dependencies": {
    "@missioncontrol/types": "workspace:*"
  },
  "peerDependencies": {
    "@opencode-ai/plugin": "^0.1.0"
  },
  "devDependencies": {
    "@opencode-ai/plugin": "^0.1.0",
    "typescript": "^5.0.0"
  }
}
```

### `packages/sdk/package.json`
```json
{
  "name": "@missioncontrol/sdk",
  "version": "0.1.0",
  "type": "module",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "scripts": { "build": "tsc" },
  "dependencies": {
    "@missioncontrol/types": "workspace:*"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "typescript": "^5.0.0"
  }
}
```

### `packages/cli/package.json`
```json
{
  "name": "@missioncontrol/cli",
  "version": "0.1.0",
  "type": "module",
  "bin": { "mc": "./dist/index.js" },
  "scripts": {
    "build": "tsc",
    "dev": "tsx src/index.ts"
  },
  "dependencies": {
    "@missioncontrol/types": "workspace:*",
    "commander": "^12.0.0"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "tsx": "^4.19.0",
    "typescript": "^5.0.0"
  }
}
```

---

## 18. Codex CLI HTTP Hooks — Important Caveat

The spec states Claude Code and Codex CLI use identical HTTP hook schemas. **This requires verification at build time.**

- **Claude Code**: HTTP hooks (`type: 'http'`) are confirmed and documented
- **Codex CLI**: Primarily uses `type: 'command'` hooks in documented examples; HTTP support may be version-dependent

**Recommended fallback for Codex CLI** if HTTP hooks don't work: generate a shell script that `curl`s the MissionControl server and install it as a `command` hook.

```json
// .codex/hooks.json fallback (command-based)
{
  "hooks": {
    "PreToolUse": [{
      "matcher": "write_file|edit_file|run_terminal_cmd",
      "hooks": [{
        "type": "command",
        "command": "node .codex/hooks/mc_pre.js"
      }]
    }]
  }
}
```

The shell hook script calls `http://localhost:3000/hooks/pre-tool-use` via `fetch` (Node) or `curl` and exits with code 2 + reason on stderr to block.

**Verify first: `codex --version` and check if `type: 'http'` appears in their current docs before using it.**

---

*MissionControl — One browser. Every agent. Full control.*
