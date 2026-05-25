# MissionControl

> **NASA Mission Control for your AI coding agents.** Run Claude Code, Codex, and OpenCode in parallel — with real terminals, shared memory, conflict prevention, and one-click merge.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.4-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-20+-green.svg)](https://nodejs.org/)
[![pnpm](https://img.shields.io/badge/pnpm-9.0+-orange.svg)](https://pnpm.io/)
[![License](https://img.shields.io/badge/license-PolyForm_Noncommercial_1.0.0-blue.svg)](LICENSE)

---

## What Is MissionControl?

MissionControl is a **browser-based control plane for parallel AI coding agents**. Instead of running one agent at a time in a terminal, you spawn a fleet — multiple Claude Code sessions, Codex instances, or OpenCode agents — each working in its own isolated git branch, all visible and controllable from a single dashboard.

The problem it solves: when multiple AI agents work on the same codebase simultaneously, they collide. They overwrite each other's files, make contradictory architectural decisions, and repeat the same mistakes because each one starts from zero. MissionControl gives every agent a **shared brain powered by HydraDB** — a live, queryable memory of what every other agent has done, decided, and failed at.

This is not a chat interface. It is not a terminal emulator wrapper. It is an **operating system for agent coordination**.

---

## What It Actually Does

### Real Terminals, Not Simulations

Every agent card in the dashboard is a real, fully interactive terminal rendered by [xterm.js](https://xtermjs.org/), connected over WebSocket to a [node-pty](https://github.com/microsoft/node-pty) process on the server. You can type, send keystrokes, and interact with every agent directly from the browser — exactly like a local terminal window. Output history is preserved so you never miss what happened before you opened a pane.

### Isolated Git Worktrees Per Agent

Every agent gets its own `git worktree` — a separate checkout of your repository on a fresh branch, created automatically at `yourproject/.trees/agent-{id}`. The agent works entirely in that branch. Your main working tree is never touched. When the agent finishes, you review the diff and choose to merge or discard.

### Shared Brain via HydraDB

Before any agent starts, MissionControl queries [HydraDB](https://hydradb.io) and writes a `.mc_context` file into the agent's worktree. This file contains relevant context from previous agents — shared knowledge, prior architectural decisions, parent agent history. The agent reads it and begins with full awareness of what others have done.

As the agent works, every file write is automatically ingested into HydraDB. No agent instrumentation needed. The agent's edits become searchable, graph-enriched memory that future agents and the merge review panel can query.

### Conflict Detection Before It Happens

Three-step pipeline runs before every tool call:

1. **File conflicts — critical, instant.** Two agents writing the same file. Detected in-memory, no network call. The conflicting tool call is blocked immediately.
2. **Semantic conflicts — warning.** OpenRouter `owl-alpha` checks whether two agents' intents contradict each other, even across different files.
3. **Architectural conflicts — warning.** HydraDB retrieves past architectural decisions for the target file, then `owl-alpha` checks whether the current intent contradicts them.

Critical conflicts return a `deny` decision directly to the agent CLI, stopping the write before it happens.

### Permission Modals — You Stay in Control

When an agent's `PermissionRequest` hook fires, the agent is **suspended** and a permission modal appears in the dashboard. You click Allow or Deny. The decision is returned to the agent and it resumes. No timeouts during active review — the agent waits.

### Review and Merge

When an agent finishes and exits, a **Review & Merge** button appears in its card. Clicking it opens a panel showing the full git diff of every change the agent made, plus a HydraDB context panel surfacing what was worked on and why. You write a commit message, click Merge, and MissionControl commits the worktree changes, merges into your main branch with `--no-ff`, and cleans up the worktree and branch. Or click Discard to throw it all away cleanly.

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
          │                │            │              │
          │  WS /pty/:id (raw terminal bytes)          │
          │  WS /ws      (structured JSON events)      │
          │                │            │              │
┌─────────▼────────────────▼────────────▼──────────────▼─────────┐
│                     Fastify Server :3000                        │
│                                                                 │
│  ┌────────────┐  ┌──────────────┐  ┌───────────────────────┐  │
│  │  node-pty  │  │  HTTP Hooks  │  │   Conflict Detector   │  │
│  │ (per agent)│  │  pre/post/   │  │   file → semantic →   │  │
│  │            │  │  permission/ │  │   architectural       │  │
│  └────────────┘  │  session     │  │   (OpenRouter owl-α)  │  │
│                  └──────────────┘  └───────────────────────┘  │
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
│  │ (context) │  │ (arch log)│  │ (errors)  │  │ (private) │  │
│  └───────────┘  └───────────┘  └───────────┘  └───────────┘  │
│           Knowledge Graph + Semantic Search                     │
└─────────────────────────────────────────────────────────────────┘
```

**Two WebSocket channels on the same HTTP server:**
- `/ws` — structured JSON events (agent spawned/died/completed, conflicts, decisions, permissions)
- `/pty/:agentId` — raw binary bytes, bidirectional xterm.js ↔ node-pty

**HTTP hook endpoints** (called by the agent CLIs, not the browser):
- `POST /hooks/session-start?agentId=` — maps the CLI's session ID to the MissionControl agent record
- `POST /hooks/pre-tool-use?agentId=` — runs conflict check and declares intent
- `POST /hooks/post-tool-use?agentId=` — ingests context and decision into HydraDB
- `POST /hooks/permission-request?agentId=` — suspends the agent, waits for your decision in the dashboard

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend runtime | Node.js 20+ / TypeScript ESM |
| HTTP framework | Fastify 4 |
| Terminal processes | node-pty (ConPTY on Windows) |
| WebSockets | `ws` library, `noServer: true`, manual upgrade routing |
| Memory / Knowledge | HydraDB via `@hydradb/sdk` |
| Conflict LLM | OpenRouter `owl-alpha` (no Anthropic dependency) |
| Frontend framework | React 18 + Vite |
| Styling | Tailwind CSS v3 |
| State management | Zustand |
| Graph visualization | D3.js force simulation |
| Activity charts | Recharts area charts |
| Terminal renderer | xterm.js + FitAddon |
| Git operations | simple-git |
| Schema validation | Zod |

---

## Prerequisites

Before you start, make sure you have all of these:

- **Node.js 20+** — check with `node --version`
- **pnpm 9+** — install with `npm install -g pnpm`
- **Git 2.15+** — with `git worktree` support, check with `git --version`
- **HydraDB account and API key** — free tier available at [hydradb.io](https://hydradb.io). You need your API key and tenant ID.
- **At least one AI coding CLI** installed globally on your machine:
  - Claude Code: `npm install -g @anthropic-ai/claude-code`
  - Codex CLI: `npm install -g @openai/codex`
  - OpenCode: `npm install -g opencode-ai`
- **OpenRouter API key** *(optional but recommended)* — enables semantic and architectural conflict detection. Without it only file-level conflicts are caught. Get one free at [openrouter.ai](https://openrouter.ai).

---

## Installation

### 1. Clone and install dependencies

```bash
git clone https://github.com/AryanSaxenaa/MissionControl.git
cd MissionControl
pnpm install
```

### 2. Configure environment variables

```bash
cp .env.example .env
```

Open `.env` in your editor. The file is pre-commented — here is what each variable does:

```env
# ── HydraDB (required) ─────────────────────────────────────────
# Get these from https://hydradb.io after creating a free account.
# The API key, tenant ID, and sub-tenant ID must be set for the
# brain/memory features to work. Without these, MissionControl
# still runs but agents start without any shared context and
# nothing is saved to persistent memory.

HYDRA_DB_API_KEY=hdb-your-api-key        # used by @hydradb/sdk and @hydradb/mcp
HYDRA_DB_TENANT_ID=your-tenant-id        # your HydraDB tenant
HYDRA_DB_SUB_TENANT_ID=missioncontrol    # namespace for this project's memory

HYDRA_API_KEY=hdb-your-api-key           # same key, different prefix used by the SDK
HYDRA_TENANT_ID=your-tenant-id           # same tenant, different prefix used by the SDK

HYDRADB_TENANT_ID=your-tenant-id         # used by the hydradb CLI tool
HYDRADB_OUTPUT=human

# ── Conflict Detection (optional) ──────────────────────────────
# Enables semantic and architectural conflict detection.
# Uses OpenRouter owl-alpha model. Without this key, only
# file-level conflicts (two agents writing the same file) are
# detected. Semantic and architectural checks are silently skipped.
OPENROUTER_API_KEY=sk-or-your-key

# ── Server port (defaults shown, change if port is in use) ─────
MC_SERVER_PORT=3000
```

> **Why are there three HydraDB variable prefixes?** The `@hydradb/sdk`, the `@hydradb/mcp` MCP server, and the `hydradb` CLI each read from slightly different environment variable names. Setting all three ensures every tool works correctly from the same `.env` file.

### 3. Start MissionControl

Open two terminal windows in the project directory.

**Terminal 1 — backend server:**
```bash
pnpm dev
```
This starts the Fastify server on `http://localhost:3000`. You will see:
```
[MissionControl] Server on :3000
```

**Terminal 2 — dashboard:**
```bash
pnpm dev:dashboard
```
This starts the Vite dev server on `http://localhost:3001`. You will see the Vite output with a Local URL.

### 4. Open the dashboard

Navigate to **http://localhost:3001** in your browser.

---

## How to Use MissionControl

### Spawning Your First Agent

Click **Spawn first agent** on the empty fleet screen, or **New Agent** in the top-right corner. A dialog appears with three fields:

**AI** — select the type of agent to spawn:
- `Claude Code` — Anthropic's coding CLI
- `Codex` — OpenAI's coding CLI
- `OpenCode` — open-source coding agent
- `Custom Shell` — any shell command or script

**Project Path** — the **absolute path on your local machine** to the git repository you want the agent to work in. This must be a path on your filesystem — for example `C:\Users\you\my-project` or `/home/you/my-project`. This is **not** a GitHub URL. The field is auto-filled with the server's working directory as a starting point — change it to the path of the project you want the agent to work on.

**Task** — a description of what the agent should do. Leave blank to start in interactive mode where you type instructions directly in the terminal. If you provide a task, it is automatically typed into the agent's terminal after the CLI prompt appears.

Click **Launch**. The following happens before the terminal opens:

1. A git worktree is created at `yourproject/.trees/agent-{id}` on a new branch named `agent/{id}-{task-slug}`
2. A unique port is assigned to the agent (3100, 3101, 3102, … one per agent)
3. Hook configuration is written into the worktree:
   - Claude Code → `.claude/settings.json`
   - Codex → `.codex/hooks.json`
   - OpenCode → `opencode.json` + auto-installs `@missioncontrol/opencode-plugin` via npm
4. HydraDB is queried for shared context and prior decisions relevant to the task. Results are written to `.mc_context` in the worktree so the agent can read them at startup.
5. The agent CLI process is spawned inside the worktree via node-pty
6. If a task was provided, it is typed into the terminal after the prompt is detected

The agent card appears in the dashboard immediately with a live terminal.

### Working With the Fleet

**Live terminals** — Click anywhere in a terminal to focus it and type. The terminal connects directly to the agent process via WebSocket. Everything you type is sent to the process. Everything the process outputs appears in the terminal. There is no buffering delay.

**Agent colors** — Each agent gets a distinct accent color (orange, blue, purple, emerald, amber, cyan, pink, lime) visible on the card border and header. Eight agents are distinctly colored before the palette cycles.

**Status** — The status badge in each card header updates in real time: `active`, `idle`, `failed`, or `completed`. A small health ring in the corner reflects the same state.

**Port** — The `:3101` badge shows which port was assigned to this agent. This is the port injected into the worktree's `.env` file as `PORT=3101`.

**Activity Timeline** — While agents are running, a Recharts area chart appears above the fleet showing the last 10 minutes of activity in 30-second buckets: active agent count (orange), tool calls declared (blue), and failures (red).

### Reviewing and Merging

When an agent finishes and its CLI exits, the status changes to `completed` and a **Review & Merge** button appears in the card header.

Click it to open the merge review panel:
- **Diff view** — every file change the agent made, shown as a git diff
- **Why?** panel — HydraDB is queried with the agent's task and returns the relevant context accumulated during the session: what was modified, what decisions were made, and the reasoning behind them
- **Commit message** field — write a message describing the changes
- **Merge** button — commits the worktree changes, runs `git merge --no-ff` into the main branch, removes the worktree, and deletes the branch
- **Discard** button — removes the worktree and branch without merging

### Handling Permission Requests

When an agent encounters a PermissionRequest (for example, Claude Code asking permission before a destructive operation), the agent is **suspended** — it stops executing and waits. A permission modal appears in the dashboard showing which agent is asking, which tool it wants to use, and why.

Click **Allow** to let the agent proceed, or **Deny** to block the operation. The agent resumes immediately after your decision.

---

## Dashboard Views

Navigate between views using the sidebar.

### Agent Fleet

The main view. Shows all agents as terminal cards. Each card is a live interactive terminal with a status header. The activity timeline chart appears above the fleet when there is recent activity.

### HydraDB Memory Graph

An interactive D3 force-directed graph of the shared memory:

- **Large orange nodes** — active agents
- **Medium blue nodes** — HydraDB super nodes (semantically central concepts extracted automatically by the knowledge graph as memory accumulates)
- **Small nodes** — individual memory entries, colored by sub-tenant:
  - Orange — `shared` context writes
  - Blue — `decisions` records
  - Red — `failures` records

The graph and sidebar re-fetch automatically after every agent file write, driven by `context:ingested` WebSocket events. The sidebar shows a live count of entries per sub-tenant and the 30 most recent entries.

### Decision Log

A live feed of every architectural decision made by any agent, auto-populated from file writes. No agent code instrumentation required — the `PostToolUse` hook records a decision entry for every `Write`, `Edit`, or `MultiEdit` call. Shows the agent, the file, and the description.

### Conflict Feed

Active and resolved conflicts. Red = critical (the write was blocked). Yellow = warning (advisory, agent proceeded). One-click resolution marks a conflict closed.

### Failure Memory

Every bash command that returned a non-zero exit code across all agents, indexed by target and error type. Before each tool call, the `PreToolUse` hook checks this store and warns agents of known-bad targets.

---

## How HydraDB Fits In

HydraDB is not a database you query with SQL. It is a **semantic knowledge graph** that extracts entities and relationships from plain text, builds connections between concepts automatically, and answers queries with graph-enriched context. MissionControl uses it at every stage of an agent's lifecycle:

### Before the Agent Starts

```
Task: "refactor the payment handler"
        ↓
Query HydraDB shared sub-tenant  →  "previous agents modified src/payments.ts,
                                     added Stripe SDK, removed raw fetch calls"
Query HydraDB decisions sub-tenant  →  "decision: use Stripe SDK for webhook
                                        verification, reasoning: reduces custom
                                        crypto code"
        ↓
Write combined result to .mc_context in worktree
        ↓
Agent spawns and reads .mc_context
```

The agent starts knowing what others have already done.

### During Every File Write

`PostToolUse` fires after each `Write`, `Edit`, `MultiEdit`, or `Bash` call:

| What gets stored | Sub-tenant | HydraDB `infer` |
|-----------------|-----------|-----------------|
| `"Agent modified src/payments.ts: added webhook signature check"` | `shared` | `true` — knowledge graph builds automatically |
| Full decision record with reasoning and affected files | `decisions` | `true` |
| Bash error output when exit code is non-zero | `failures` | `false` — stored verbatim |

### During Conflict Detection

Before step 3 of the conflict pipeline, `recallDecisionsForTarget()` queries HydraDB for past decisions affecting the target file. The LLM then checks whether the current intent contradicts those decisions. HydraDB's graph-enriched results surface related decisions even when they don't mention the exact filename.

### In the Merge Review Panel

When you open the Why? panel, `recallContext()` is called with the agent's task as the query string, searching the `shared` sub-tenant. The results show the accumulated history of what the agent worked on across its entire session.

### Sub-tenant Reference

| Sub-tenant | What is stored there | Queried by |
|------------|---------------------|-----------|
| `shared` | Context from every file write | Spawn brain injection, merge review Why? panel |
| `decisions` | Architectural decision records | Spawn brain injection, conflict step 3 |
| `failures` | Bash errors and non-zero exits | PreToolUse preflight check |
| `intents` | Active intent declarations | Conflict detection (in-memory also) |
| `agent-{id}` | Child agent inherits parent's private context | Parent/child spawn inheritance |

---

## How Hook Configuration Works

When you spawn an agent, MissionControl writes hook configuration directly into the worktree so the agent CLI calls MissionControl's HTTP endpoints on every tool use. You do not need to configure this manually.

### Claude Code

Written to `.claude/settings.json` in the worktree:

```json
{
  "hooks": {
    "PreToolUse": [{
      "matcher": "Write|Edit|MultiEdit|Bash",
      "hooks": [{ "type": "http", "url": "http://localhost:3000/hooks/pre-tool-use?agentId=agent-xxx" }]
    }],
    "PostToolUse": [{
      "matcher": "Write|Edit|MultiEdit|Bash",
      "hooks": [{ "type": "http", "url": "http://localhost:3000/hooks/post-tool-use?agentId=agent-xxx" }]
    }],
    "PermissionRequest": [{
      "matcher": ".*",
      "hooks": [{ "type": "http", "url": "http://localhost:3000/hooks/permission-request?agentId=agent-xxx" }]
    }],
    "SessionStart": [{
      "matcher": ".*",
      "hooks": [{ "type": "http", "url": "http://localhost:3000/hooks/session-start?agentId=agent-xxx" }]
    }]
  }
}
```

### Codex CLI

Written to `.codex/hooks.json` in the worktree. Same four events, same URLs.

### OpenCode

Written to `opencode.json` in the worktree. Uses a plugin instead of raw HTTP hooks:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": ["@missioncontrol/opencode-plugin"]
}
```

The `@missioncontrol/opencode-plugin` package is automatically installed into the worktree via `npm install` during spawn. It handles the same four events as Claude Code and Codex.

### Why `?agentId=` Is in Every URL

The agent CLI sends a `session_id` in its hook payloads but does not send the MissionControl `agentId`. Embedding the `agentId` as a query parameter in the hook URLs is how the server knows which agent record to update when a hook fires.

---

## Repository Structure

```
MissionControl/
├── packages/
│   ├── types/                       # Shared TypeScript type definitions
│   │   └── src/index.ts             # AgentRecord, IntentRecord, ConflictResult, WSEvent ...
│   │
│   ├── server/                      # Fastify backend — runs on :3000
│   │   └── src/
│   │       ├── index.ts             # Server entry point, route registration
│   │       ├── hydra.ts             # All HydraDB SDK calls (ingest, recall, graph)
│   │       ├── state.ts             # In-memory agents Map and activeIntents Map
│   │       ├── ws-events.ts         # WebSocket event broadcaster (/ws channel)
│   │       ├── ws-pty.ts            # PTY WebSocket server + output buffer replay
│   │       ├── pty-buffer.ts        # 64 KB rolling output buffer per agent
│   │       ├── routes/
│   │       │   ├── agents.ts        # /spawn, /kill, /resize, /register (compat)
│   │       │   ├── hooks.ts         # /hooks/session-start|pre|post|permission
│   │       │   ├── merge.ts         # /diff, /merge, /discard
│   │       │   ├── decisions.ts     # Decision log endpoints
│   │       │   ├── failures.ts      # Failure memory endpoints
│   │       │   ├── conflicts.ts     # Conflict tracking endpoints
│   │       │   └── context.ts       # Context ingest and query
│   │       └── services/
│   │           ├── pty-spawner.ts   # node-pty process lifecycle
│   │           ├── worktree-manager.ts  # git worktree create/merge/delete
│   │           ├── hook-installer.ts    # Write hook config into each worktree
│   │           ├── conflict-detector.ts # 3-step conflict pipeline
│   │           ├── port-registry.ts     # Per-agent port assignment (3100+)
│   │           ├── health-monitor.ts    # SDK agent heartbeat checking
│   │           └── graph-traversal.ts   # Fetch HydraDB graph data for dashboard
│   │
│   ├── dashboard/                   # React + Vite frontend — runs on :3001
│   │   └── src/
│   │       ├── views/
│   │       │   ├── AgentFleet.tsx       # Main fleet view with spawn dialog
│   │       │   ├── ContextGraph.tsx     # D3 memory graph + HydraDB sidebar
│   │       │   ├── DecisionLog.tsx      # Decision feed
│   │       │   ├── ConflictFeed.tsx     # Conflict feed with resolve controls
│   │       │   └── FailureMemory.tsx    # Failure log
│   │       ├── components/
│   │       │   ├── AgentPane.tsx        # xterm.js terminal card per agent
│   │       │   ├── AgentTimeline.tsx    # Recharts area chart (last 10 min)
│   │       │   ├── NewAgentDialog.tsx   # Spawn form
│   │       │   ├── MergeReview.tsx      # Diff + Why? + merge controls
│   │       │   └── HealthRing.tsx       # Animated status ring
│   │       ├── hooks/useEventSocket.ts  # WebSocket event → Zustand dispatch
│   │       └── store/useStore.ts        # Zustand store for all app state
│   │
│   ├── sdk/                         # @missioncontrol/sdk — programmatic agent API
│   ├── cli/                         # mc CLI — helper commands
│   └── opencode-plugin/             # @missioncontrol/opencode-plugin for OpenCode
│
├── scripts/cleanup.mjs              # Remove orphaned .trees/ worktrees
├── .env.example                     # Environment variable template
├── pnpm-workspace.yaml
└── package.json
```

---

## API Reference

### Agent Management

| Method | Endpoint | Body | Description |
|--------|----------|------|-------------|
| `POST` | `/api/agents/spawn` | `{ kind, name, task, projectPath }` | Spawn agent — creates worktree, installs hooks, starts PTY |
| `POST` | `/api/agents/:id/kill` | — | Kill agent process |
| `POST` | `/api/agents/:id/resize` | `{ cols, rows }` | Resize the PTY to match xterm.js dimensions |
| `GET` | `/api/agents` | — | List all agent records |

### Merge Workflow

| Method | Endpoint | Body | Description |
|--------|----------|------|-------------|
| `GET` | `/api/agents/:id/diff` | — | Git diff of agent's changes + HydraDB context summary |
| `POST` | `/api/agents/:id/merge` | `{ commitMessage }` | Commit + merge worktree into main, clean up |
| `POST` | `/api/agents/:id/discard` | — | Remove worktree and branch without merging |

### Hook Endpoints

These are called by the agent CLIs, not by the browser. The `?agentId=` parameter is embedded in the hook URLs automatically when the agent is spawned.

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/hooks/session-start?agentId=` | Maps CLI session ID to MissionControl agent record |
| `POST` | `/hooks/pre-tool-use?agentId=` | Runs 3-step conflict check, declares intent |
| `POST` | `/hooks/post-tool-use?agentId=` | Ingests context + decision into HydraDB |
| `POST` | `/hooks/permission-request?agentId=` | Suspends agent, waits for user Allow/Deny |
| `POST` | `/hooks/session-idle` | Called by OpenCode plugin when session goes idle |

### Memory and Graph

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/context` | Manually ingest context into HydraDB |
| `GET` | `/api/context/query?scope=&tags=` | Query context by scope and tags |
| `POST` | `/api/decisions` | Manually record a decision |
| `GET` | `/api/decisions/why?target=` | Ask HydraDB why decisions were made about a file |
| `POST` | `/api/failures` | Manually record a failure |
| `GET` | `/api/failures/check?target=` | Check known failures for a target path |
| `GET` | `/api/graph` | Full graph data: agents + HydraDB super nodes + sources |
| `GET` | `/api/memory/stats` | HydraDB source count by sub-tenant |

### Permissions

| Method | Endpoint | Body | Description |
|--------|----------|------|-------------|
| `POST` | `/api/permissions/:requestId/resolve` | `{ decision: "allow" \| "deny" }` | Resolve a pending permission request |

### System

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/status` | Agent count, intent count, server uptime |
| `GET` | `/api/server-info` | Server working directory and platform — used by the spawn dialog to prefill the project path field |

### WebSocket

| URL | Protocol | Purpose |
|-----|----------|---------|
| `ws://localhost:3000/ws` | JSON messages | Structured events: agent lifecycle, conflicts, decisions, failures, permissions |
| `ws://localhost:3000/pty/:agentId` | Binary | Raw terminal bytes, bidirectional between xterm.js and node-pty |

The dashboard automatically connects to both channels on load and reconnects with exponential backoff if the connection drops.

---

## Development

```bash
# Build all packages (types → server + dashboard + sdk + cli)
pnpm build

# Start backend server with hot reload
pnpm dev

# Start dashboard with Vite HMR
pnpm dev:dashboard

# Remove orphaned worktrees from crashed sessions
pnpm cleanup
```

---

## Troubleshooting

**HydraDB features are not working — agents start without context, memory graph is empty**

Check that `HYDRA_API_KEY` and `HYDRA_TENANT_ID` are correctly set in `.env` and that the server was restarted after editing the file. HydraDB calls fail silently — the server continues running but skips all memory operations. To verify connectivity, run `hydradb memories list` in your terminal. If it errors, the credentials are wrong.

**Conflict detection only catches file-level conflicts, not semantic or architectural ones**

`OPENROUTER_API_KEY` is missing from `.env`. Add it and restart the server. File-level conflicts (two agents writing the same file) are always detected in-memory with no API key required.

**git worktree error when spawning an agent**

The Project Path you entered is either not a git repository or has no commits yet. MissionControl calls `git worktree add` to create the isolated branch — this requires a git repo with at least one commit on HEAD. Run `git init && git commit --allow-empty -m "init"` in the target directory if it is a new project.

**OpenCode agent spawns but hooks are not firing**

The `@missioncontrol/opencode-plugin` is installed into the worktree via `npm install` during spawn. If the target project has no `package.json`, or if npm fails due to network or permission issues, the plugin install is skipped and the OpenCode agent runs without hooks. The terminal still works but PostToolUse ingestion and conflict detection are disabled. Check the server console for npm error output during spawn.

**Spawned agent terminal shows the wrong directory**

Each agent works inside its worktree at `yourproject/.trees/agent-{id}`, not in your main project directory. This is by design — it is how agents are isolated from each other. The agent branch is named `agent/{id}-{task-slug}` and is visible in `git branch -a` from your project directory.

---

## License

[PolyForm Noncommercial License 1.0.0](LICENSE)

You may use, modify, and share MissionControl for personal, educational, and non-commercial purposes. Commercial use requires explicit permission from the maintainers.
