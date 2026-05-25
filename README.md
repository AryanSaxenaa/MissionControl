# MissionControl

> **Run a fleet of AI coding agents — in parallel, in real terminals, without collisions.**

[![TypeScript](https://img.shields.io/badge/TypeScript-5.4-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-20+-green.svg)](https://nodejs.org/)
[![pnpm](https://img.shields.io/badge/pnpm-9.0+-orange.svg)](https://pnpm.io/)
[![License](https://img.shields.io/badge/license-PolyForm_Noncommercial-blue.svg)](LICENSE)

MissionControl is a browser-based control plane for parallel AI coding agents. Spawn Claude Code, Codex, and OpenCode agents simultaneously — each working in its own isolated git branch, each visible as a live interactive terminal, all sharing a persistent memory that prevents them from contradicting each other.

---

## Why MissionControl

Running one agent at a time is a bottleneck. Running several at once creates a different problem: they step on each other's files, make conflicting architectural decisions, and each one starts from zero while the others carry context it will never see.

MissionControl solves both. Every agent gets an isolated git worktree so their changes never conflict at the filesystem level. Before every file write, a three-step conflict pipeline checks for file, semantic, and architectural collisions — and blocks the ones that matter. Every write is ingested into a shared HydraDB knowledge graph so the next agent you spawn already knows what every previous one did, decided, and failed at.

---

## Features

**Real terminals, not simulations**
Every agent card is a fully interactive [xterm.js](https://xtermjs.org/) terminal connected via WebSocket to a [node-pty](https://github.com/microsoft/node-pty) process. Type, send keystrokes, and interact directly from the browser. Output history is preserved across page reloads.

**Git worktree isolation per agent**
Each agent gets its own `git worktree` on a fresh branch at `yourproject/.trees/agent-{id}`. Your main working tree is never touched until you explicitly merge.

**Three-step conflict prevention**
Before every tool call, MissionControl runs:
1. **File conflict** — two agents writing the same file. Detected in-memory, no network call. Blocked immediately.
2. **Semantic conflict** — two agents' intents contradict each other across different files. OpenRouter `owl-alpha` checks, advisory warning.
3. **Architectural conflict** — current intent contradicts past decisions stored in HydraDB. Checked against the knowledge graph, advisory warning.

**Shared brain via HydraDB**
Before a new agent starts, MissionControl queries HydraDB and writes a `.mc_context` file into its worktree: relevant prior context, architectural decisions, and recorded failures from every agent that came before. During the session, every file write is automatically ingested — no agent instrumentation required.

**Permission control**
When an agent's `PermissionRequest` hook fires, the agent suspends and a modal appears in the dashboard. Click Allow or Deny. The agent resumes immediately. No timeouts while you are actively reviewing.

**Review and merge**
When an agent exits, a Review & Merge panel opens showing the full git diff, a HydraDB context summary of what was worked on and why, and a commit message field. One click commits, merges with `--no-ff` into your main branch, and removes the worktree. Or discard cleanly.

**Dashboard views**
- **Agent Fleet** — live terminal grid with activity timeline (active agent count, tool calls, failures over the last 10 minutes)
- **Context Graph** — D3 force-directed visualization of the HydraDB knowledge graph
- **Decision Log** — every architectural decision made by every agent, auto-populated from writes
- **Conflict Feed** — active and resolved conflicts with one-click resolution
- **Failure Memory** — bash errors across all agents, indexed by target path

---

## Architecture

```
┌────────────────────────────────────────────────────────────────┐
│                        Browser Dashboard                        │
│                    http://localhost:3001                        │
│                                                                 │
│  ┌──────────────┐  ┌──────────┐  ┌──────────┐  ┌──────────┐  │
│  │ Agent Fleet  │  │ Context  │  │ Decision │  │ Conflict │  │
│  │ (xterm.js)   │  │  Graph   │  │   Log    │  │   Feed   │  │
│  └──────┬───────┘  └─────┬────┘  └────┬─────┘  └────┬─────┘  │
└─────────┼────────────────┼────────────┼──────────────┼─────────┘
          │ WS /pty/:id (raw terminal bytes)            │
          │ WS /ws      (structured JSON events)        │
┌─────────▼────────────────▼────────────▼──────────────▼─────────┐
│                     Fastify Server :3000                        │
│                                                                 │
│  ┌────────────┐  ┌──────────────┐  ┌───────────────────────┐  │
│  │  node-pty  │  │  HTTP Hooks  │  │   Conflict Detector   │  │
│  │ (per agent)│  │  pre/post/   │  │   file → semantic →   │  │
│  │            │  │  permission/ │  │   architectural       │  │
│  └────────────┘  │  session     │  └───────────────────────┘  │
│                  └──────────────┘                              │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              Git Worktree Manager                         │  │
│  │  yourproject/.trees/agent-{id}  →  branch agent/{id}-…  │  │
│  └──────────────────────────────────────────────────────────┘  │
└──────────────────────────────────┬─────────────────────────────┘
                                   │ @hydradb/sdk
┌──────────────────────────────────▼─────────────────────────────┐
│                         HydraDB Brain                           │
│                   (Cloud Agentic Memory)                        │
│                                                                 │
│  ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌───────────┐  │
│  │  shared   │  │ decisions │  │ failures  │  │ agent-{id}│  │
│  └───────────┘  └───────────┘  └───────────┘  └───────────┘  │
│           Knowledge Graph + Semantic Search                     │
└─────────────────────────────────────────────────────────────────┘
```

Two WebSocket channels run on the same HTTP server:
- `/ws` — structured JSON events (agent lifecycle, conflicts, decisions, permissions)
- `/pty/:agentId` — raw binary bytes, bidirectional between xterm.js and node-pty

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend runtime | Node.js 20+ / TypeScript ESM |
| HTTP framework | Fastify 4 |
| Terminal processes | node-pty (ConPTY on Windows) |
| WebSockets | `ws` library, `noServer: true`, manual upgrade routing |
| Memory / Knowledge | HydraDB via `@hydradb/sdk` |
| Conflict LLM | OpenRouter `owl-alpha` |
| Frontend framework | React 18 + Vite |
| Styling | Tailwind CSS v3 |
| State management | Zustand |
| Graph visualization | D3.js force simulation |
| Activity charts | Recharts |
| Terminal renderer | xterm.js + FitAddon |
| Git operations | simple-git |
| Schema validation | Zod |

---

## Prerequisites

- **Node.js 20+**
- **pnpm 9+** — `npm install -g pnpm`
- **Git 2.15+** with worktree support
- **HydraDB account** — API key and tenant ID from [hydradb.io](https://hydradb.io)
- **At least one AI coding CLI** installed globally:
  - Claude Code: `npm install -g @anthropic-ai/claude-code`
  - Codex: `npm install -g @openai/codex`
  - OpenCode: `npm install -g opencode-ai`
- **OpenRouter API key** *(optional)* — enables semantic and architectural conflict detection. Without it, only file-level conflicts are caught. Get one at [openrouter.ai](https://openrouter.ai).

---

## Getting Started

### 1. Clone and install

```bash
git clone https://github.com/AryanSaxenaa/MissionControl.git
cd MissionControl
pnpm install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Edit `.env`:

```env
# HydraDB — required for shared memory and context injection
HYDRA_DB_API_KEY=hdb-your-api-key
HYDRA_DB_TENANT_ID=your-tenant-id
HYDRA_DB_SUB_TENANT_ID=missioncontrol

HYDRA_API_KEY=hdb-your-api-key
HYDRA_TENANT_ID=your-tenant-id

HYDRADB_TENANT_ID=your-tenant-id
HYDRADB_OUTPUT=human

# OpenRouter — optional, enables semantic + architectural conflict detection
OPENROUTER_API_KEY=sk-or-your-key

# Server port
MC_SERVER_PORT=3000
```

### 3. Start the server

```bash
pnpm dev
```

Server starts at `http://localhost:3000`.

### 4. Start the dashboard

In a second terminal:

```bash
pnpm dev:dashboard
```

Dashboard available at **http://localhost:3001**.

---

## Spawning an Agent

Click **New Agent** in the top-right corner. Three fields:

- **AI** — `Claude Code`, `Codex`, `OpenCode`, or `Custom Shell`
- **Project Path** — absolute path to a git repository on your machine (e.g. `C:\Users\you\my-project`)
- **Task** — what the agent should do. Leave blank for interactive mode.

Click **Launch**. MissionControl:

1. Creates a git worktree at `yourproject/.trees/agent-{id}` on a new branch
2. Assigns a unique port (3100+)
3. Writes hook configuration into the worktree (`.claude/settings.json` for Claude Code, `.codex/hooks.json` for Codex, `opencode.json` + plugin install for OpenCode)
4. Queries HydraDB and writes relevant prior context to `.mc_context` in the worktree
5. Spawns the agent CLI process via node-pty
6. If a task was provided, types it into the terminal after the prompt appears

The agent card appears immediately with a live terminal.

---

## Hook Configuration

MissionControl automatically writes HTTP hooks into each worktree. No manual configuration required.

**Claude Code** — written to `.claude/settings.json`:

```json
{
  "hooks": {
    "PreToolUse":  [{ "matcher": "Write|Edit|MultiEdit|Bash", "hooks": [{ "type": "http", "url": "http://localhost:3000/hooks/pre-tool-use?agentId=agent-xxx" }] }],
    "PostToolUse": [{ "matcher": "Write|Edit|MultiEdit|Bash", "hooks": [{ "type": "http", "url": "http://localhost:3000/hooks/post-tool-use?agentId=agent-xxx" }] }],
    "PermissionRequest": [{ "matcher": ".*", "hooks": [{ "type": "http", "url": "http://localhost:3000/hooks/permission-request?agentId=agent-xxx" }] }],
    "SessionStart": [{ "matcher": ".*", "hooks": [{ "type": "http", "url": "http://localhost:3000/hooks/session-start?agentId=agent-xxx" }] }]
  }
}
```

**Codex** — written to `.codex/hooks.json`. Same four events, same URLs.

**OpenCode** — written to `opencode.json`. Uses `@missioncontrol/opencode-plugin`, installed automatically into the worktree during spawn.

---

## API Reference

### Agent Management

| Method | Endpoint | Body | Description |
|--------|----------|------|-------------|
| `POST` | `/api/agents/spawn` | `{ kind, name, task, projectPath }` | Create worktree, install hooks, start PTY |
| `POST` | `/api/agents/:id/kill` | — | Kill agent process |
| `POST` | `/api/agents/:id/resize` | `{ cols, rows }` | Resize PTY |
| `GET` | `/api/agents` | — | List all agents |

### Merge Workflow

| Method | Endpoint | Body | Description |
|--------|----------|------|-------------|
| `GET` | `/api/agents/:id/diff` | — | Git diff + HydraDB context summary |
| `POST` | `/api/agents/:id/merge` | `{ commitMessage }` | Commit, merge to main, clean up |
| `POST` | `/api/agents/:id/discard` | — | Remove worktree and branch |

### Hook Endpoints

Called by agent CLIs. The `?agentId=` parameter is embedded in the hook URLs automatically.

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/hooks/session-start?agentId=` | Map CLI session ID to agent record |
| `POST` | `/hooks/pre-tool-use?agentId=` | Run conflict check, declare intent |
| `POST` | `/hooks/post-tool-use?agentId=` | Ingest context and decision into HydraDB |
| `POST` | `/hooks/permission-request?agentId=` | Suspend agent, await Allow/Deny |
| `POST` | `/hooks/session-idle` | OpenCode plugin idle notification |

### Memory and Graph

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/context` | Ingest context into HydraDB |
| `GET` | `/api/context/query?scope=&tags=` | Query context by scope and tags |
| `POST` | `/api/decisions` | Record a decision |
| `GET` | `/api/decisions/why?target=` | Why decisions were made about a file |
| `POST` | `/api/failures` | Record a failure |
| `GET` | `/api/failures/check?target=` | Check known failures for a path |
| `GET` | `/api/graph` | Full graph: agents + HydraDB super nodes + sources |
| `GET` | `/api/memory/stats` | HydraDB source count by sub-tenant |

### Permissions

| Method | Endpoint | Body | Description |
|--------|----------|------|-------------|
| `POST` | `/api/permissions/:requestId/resolve` | `{ decision: "allow" \| "deny" }` | Resolve a pending permission request |

### System

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/status` | Agent count, intent count, uptime |
| `GET` | `/api/server-info` | Server working directory and platform |

### WebSocket

| URL | Protocol | Purpose |
|-----|----------|---------|
| `ws://localhost:3000/ws` | JSON | Structured events: agent lifecycle, conflicts, decisions, permissions |
| `ws://localhost:3000/pty/:agentId` | Binary | Raw terminal bytes, bidirectional |

---

## Repository Structure

```
MissionControl/
├── packages/
│   ├── types/                       # Shared TypeScript types
│   │   └── src/index.ts             # AgentRecord, IntentRecord, ConflictResult, WSEvent
│   │
│   ├── server/                      # Fastify backend — :3000
│   │   └── src/
│   │       ├── index.ts
│   │       ├── hydra.ts             # HydraDB SDK calls
│   │       ├── state.ts             # In-memory agents and activeIntents
│   │       ├── ws-events.ts         # /ws broadcaster
│   │       ├── ws-pty.ts            # PTY WebSocket server + output buffer
│   │       ├── pty-buffer.ts        # 64 KB rolling output buffer per agent
│   │       └── routes/
│   │           ├── agents.ts
│   │           ├── hooks.ts
│   │           ├── merge.ts
│   │           ├── decisions.ts
│   │           ├── failures.ts
│   │           ├── conflicts.ts
│   │           └── context.ts
│   │       └── services/
│   │           ├── pty-spawner.ts
│   │           ├── worktree-manager.ts
│   │           ├── hook-installer.ts
│   │           ├── conflict-detector.ts
│   │           ├── port-registry.ts
│   │           ├── health-monitor.ts
│   │           └── graph-traversal.ts
│   │
│   ├── dashboard/                   # React + Vite — :3001
│   │   └── src/
│   │       ├── views/
│   │       │   ├── AgentFleet.tsx
│   │       │   ├── ContextGraph.tsx
│   │       │   ├── DecisionLog.tsx
│   │       │   ├── ConflictFeed.tsx
│   │       │   └── FailureMemory.tsx
│   │       ├── components/
│   │       │   ├── AgentPane.tsx
│   │       │   ├── AgentTimeline.tsx
│   │       │   ├── NewAgentDialog.tsx
│   │       │   ├── MergeReview.tsx
│   │       │   └── HealthRing.tsx
│   │       ├── hooks/useEventSocket.ts
│   │       └── store/useStore.ts
│   │
│   ├── sdk/                         # @missioncontrol/sdk
│   ├── cli/                         # mc CLI
│   └── opencode-plugin/             # @missioncontrol/opencode-plugin
│
├── scripts/cleanup.mjs              # Remove orphaned .trees/ worktrees
├── .env.example
├── pnpm-workspace.yaml
└── package.json
```

---

## Development

```bash
# Build all packages
pnpm build

# Backend with hot reload
pnpm dev

# Dashboard with Vite HMR
pnpm dev:dashboard

# Remove orphaned worktrees from crashed sessions
pnpm cleanup
```

---

## License

[PolyForm Noncommercial License 1.0.0](LICENSE)

Free for personal, educational, and non-commercial use. Commercial use requires explicit permission from the maintainers.
