# MissionControl

> **NASA Mission Control for your AI coding agents.** Run Claude Code, Codex, and OpenCode in parallel — with real terminals, shared memory, conflict prevention, and one-click merge.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.4-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-20+-green.svg)](https://nodejs.org/)
[![pnpm](https://img.shields.io/badge/pnpm-9.0+-orange.svg)](https://pnpm.io/)
[![License](https://img.shields.io/badge/license-PolyForm_Noncommercial_1.0.0-blue.svg)](LICENSE)

---

## What Is MissionControl?

MissionControl is a **browser-based control plane for parallel AI coding agents**. Instead of running one agent at a time in a terminal window, you spawn a fleet — multiple Claude Code sessions, Codex instances, or OpenCode agents — each working in an isolated git branch, all visible and controllable from a single dashboard.

The problem it solves: when multiple AI agents work on the same codebase simultaneously, they collide. They overwrite each other's files, make contradictory architectural decisions, and repeat the same mistakes over and over because they each start from zero. MissionControl gives every agent a **shared brain powered by HydraDB** — a live, queryable memory of what every other agent has done, decided, and failed at.

This is not a chat interface. It is not a terminal emulator wrapper. It is an **OS for agent coordination**.

---

## What It Actually Does

### 1. Spawns Agents With Isolated Git Worktrees

Every agent gets its own `git worktree` branched from the current HEAD of your project. The agent works entirely in its own branch at `yourproject/.trees/agent-{id}`. It never touches your working tree. When it finishes, you review its changes and merge with one click.

Supported agent types:
- **Claude Code** — Anthropic's CLI coding agent
- **Codex CLI** — OpenAI's coding CLI
- **OpenCode** — open-source coding agent
- **Custom Shell** — any interactive shell script or command

### 2. Gives Every Agent a Shared Brain via HydraDB

Before any agent starts working, MissionControl queries [HydraDB](https://hydradb.io) — a cloud agentic memory service — and writes a `.mc_context` file into the agent's worktree. This file contains:
- Shared context from previous agents' work on related files
- Prior architectural decisions that affect the current task
- Parent agent context (for spawned child agents)

During work, every file write the agent makes is automatically ingested into HydraDB via HTTP hooks. The agent's edits become **searchable, graph-enriched memory** that all future agents and the merge review panel can query.

### 3. Detects Conflicts Before They Happen

The three-step conflict detection pipeline runs before every tool call:

1. **File conflicts (critical, instant)** — two agents intending to write the same file are blocked immediately, in-memory, with no LLM call required.
2. **Semantic conflicts (warning)** — OpenRouter `owl-alpha` checks whether two agents' intents contradict each other semantically, even if they target different files.
3. **Architectural conflicts (warning)** — HydraDB retrieves past architectural decisions for the target file, then `owl-alpha` checks whether the current intent contradicts them.

Critical conflicts block the tool call with a `deny` decision returned directly to the agent CLI.

### 4. Live xterm.js Terminals in the Browser

Each agent card in the dashboard contains a real, fully interactive terminal rendered by [xterm.js](https://xtermjs.org/), connected via a dedicated WebSocket to a [node-pty](https://github.com/microsoft/node-pty) process on the server. You can type, interrupt, and interact with every agent directly from the browser. Output is buffered (64 KB rolling window per agent) so you see full history when you open a pane mid-session.

### 5. Permission Modals — Human in the Loop

When an agent requests a sensitive operation, MissionControl's `PermissionRequest` hook suspends the agent and broadcasts a permission modal to the dashboard. You click Allow or Deny. The decision is sent back to the agent in real time. Agents never bypass this — the hook fires before the tool executes.

### 6. Review & Merge Workflow

When an agent finishes, a **Review & Merge** button appears in its card. Clicking it opens a diff view showing every change the agent made, alongside a HydraDB context panel showing what the agent was working on and why. You write a commit message and click Merge — MissionControl commits the worktree, merges into your main branch with `--no-ff`, and cleans up the branch.

Or you discard it. One click removes the worktree and branch entirely.

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
          │ WS /pty/:id    │            │              │
          │ WS /ws (events)│            │              │
┌─────────▼────────────────▼────────────▼──────────────▼─────────┐
│                     Fastify Server :3000                        │
│                                                                 │
│  ┌────────────┐  ┌──────────────┐  ┌───────────────────────┐  │
│  │  node-pty  │  │  HTTP Hooks  │  │   Conflict Detector   │  │
│  │  (per-     │  │  /hooks/     │  │   (3-step pipeline)   │  │
│  │   agent)   │  │  pre/post/   │  │   owl-alpha via       │  │
│  └────────────┘  │  permission  │  │   OpenRouter          │  │
│                  └──────────────┘  └───────────────────────┘  │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                  Git Worktree Manager                     │  │
│  │   yourproject/.trees/agent-{id}  →  agent/{id}-{task}   │  │
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
│                                                                 │
│  Knowledge Graph + Semantic Search + Graph Super Nodes         │
└─────────────────────────────────────────────────────────────────┘
```

**Two WebSocket channels:**
- `/ws` — structured JSON events: agent spawned/died/completed, conflicts, decisions, failures, permissions
- `/pty/:agentId` — raw binary bytes: bidirectional xterm.js ↔ node-pty

**HTTP hook endpoints** (called by agent CLIs, not the browser):
- `POST /hooks/session-start` — maps session ID to agent ID
- `POST /hooks/pre-tool-use` — conflict check + intent declaration
- `POST /hooks/post-tool-use` — HydraDB ingest + decision logging
- `POST /hooks/permission-request` — suspend agent, await user decision

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend runtime | Node.js 20+ / TypeScript ESM |
| HTTP framework | Fastify 4 |
| Terminal processes | node-pty (ConPTY on Windows) |
| WebSockets | ws library, `noServer: true` with manual upgrade routing |
| Memory / Knowledge | HydraDB via `@hydradb/sdk` |
| Conflict LLM | OpenRouter `owl-alpha` (reasoning-optimised, no Anthropic dependency) |
| Frontend | React 18 + Vite |
| Styling | Tailwind CSS v3 |
| State management | Zustand |
| Graph visualization | D3.js force simulation |
| Activity charts | Recharts area charts |
| Terminal renderer | xterm.js + FitAddon |
| Git operations | simple-git |
| Validation | Zod |

---

## Prerequisites

- **Node.js 20+**
- **pnpm 9+** — `npm install -g pnpm`
- **Git** — with `git worktree` support (Git 2.15+)
- **HydraDB account** — get a free API key at [hydradb.io](https://hydradb.io)
- **OpenRouter API key** *(optional)* — enables semantic and architectural conflict detection. Without it, only file-level conflicts are detected. Get one at [openrouter.ai](https://openrouter.ai)
- At least one AI coding CLI installed globally: `claude`, `codex`, or `opencode`

---

## Installation & Setup

### 1. Clone the repository

```bash
git clone https://github.com/yourusername/missioncontrol.git
cd missioncontrol
pnpm install
```

### 2. Configure environment variables

```bash
cp .env.example .env
```

Open `.env` and fill in your values:

```env
# ── HydraDB (required) ──────────────────────────────────────────
# Get these from https://hydradb.io after creating an account.
# These three variable names are required (SDK, MCP, and CLI each read a different prefix).
HYDRA_DB_API_KEY=hdb-your-api-key
HYDRA_DB_TENANT_ID=your-tenant-id
HYDRA_DB_SUB_TENANT_ID=missioncontrol

HYDRA_API_KEY=hdb-your-api-key
HYDRA_TENANT_ID=your-tenant-id

HYDRADB_TENANT_ID=your-tenant-id
HYDRADB_OUTPUT=human

# ── Conflict Detection LLM (optional but recommended) ───────────
# Enables semantic and architectural conflict detection between agents.
# Uses OpenRouter owl-alpha. Without this, only file-level conflicts are caught.
OPENROUTER_API_KEY=sk-or-your-key

# ── Server Ports (defaults shown) ───────────────────────────────
MC_SERVER_PORT=3000
```

> **Why three HydraDB variable prefixes?** The `@hydradb/sdk`, `@hydradb/mcp`, and the `hydradb` CLI each read slightly different env var names. Duplicating the values ensures all three work.

### 3. Start the server

```bash
pnpm dev
```

This starts the Fastify server on port 3000.

### 4. Start the dashboard (separate terminal)

```bash
pnpm dev:dashboard
```

This starts the Vite dev server on port 3001.

### 5. Open the dashboard

Navigate to **http://localhost:3001**

---

## Using MissionControl

### Spawning an Agent

1. Click **New Agent** (or **Spawn first agent** if the fleet is empty)
2. Select the **AI type**: Claude Code, Codex, OpenCode, or Custom Shell
3. Enter the **absolute path** to the git repository you want the agent to work in (auto-filled with the server's current directory)
4. Optionally enter a **task description** — the agent will be started and the task injected via PTY stdin after the prompt appears. Leave blank for interactive mode.
5. Click **Launch**

What happens immediately after you click Launch:
- A new git worktree is created at `yourproject/.trees/agent-{id}` on a fresh branch
- A port is assigned to the agent (starting at 3100, incrementing per agent)
- Hook configuration is written into the worktree:
  - Claude Code: `.claude/settings.json` (PreToolUse, PostToolUse, PermissionRequest, SessionStart hooks)
  - Codex: `.codex/hooks.json`
  - OpenCode: `opencode.json` referencing `@missioncontrol/opencode-plugin`
- HydraDB is queried for relevant context from the `shared` and `decisions` sub-tenants
- The retrieved context is written to `.mc_context` in the worktree so the agent can read it at startup
- The agent CLI is spawned inside the worktree via node-pty
- If a task was provided, it is injected via PTY stdin after prompt detection
- The agent card appears in the dashboard with a live terminal

### Working With Agents

**Live terminals** — Every agent card shows a real interactive terminal. Click in it and type. The terminal connects via WebSocket to the actual PTY process on the server. Previous output is replayed when you open the pane so you never miss what happened before you switched to that card.

**Status indicators** — Each agent shows its current status in real time: `active` (working), `idle`, `failed`, or `completed`. A colored health ring in the top-left of each card reflects status.

**Agent colors** — Each agent gets a distinct accent color (orange, blue, purple, emerald, amber, cyan, pink, lime) so you can tell them apart at a glance.

**Port badge** — The `:3101` badge in each agent's header shows the port assigned to that agent.

### Reviewing and Merging

When an agent finishes and exits, its status becomes `completed` and a **Review & Merge** button appears in the card header.

Clicking it opens a panel showing:
- The full git diff of everything the agent changed
- A **Why?** context panel that queries HydraDB's `shared` sub-tenant using the agent's task, surfacing what the agent worked on and why
- A commit message field
- **Merge** and **Discard** buttons

**Merge** commits the agent's changes, runs `git merge --no-ff` into the main branch, removes the worktree, and deletes the branch.

**Discard** removes the worktree and branch without merging — useful when an agent went the wrong direction.

### Resolving Permission Requests

When an agent encounters an operation that requires permission (the `PermissionRequest` hook fires), the agent is **suspended** and a modal appears in the dashboard. Click **Allow** or **Deny**. The decision is sent back to the agent and it resumes.

---

## Dashboard Views

### Agent Fleet

The main view. Shows all running agents as cards with live terminals, status indicators, and merge controls. Below the fleet, an **Activity Timeline** area chart shows the last 10 minutes of activity in 30-second buckets:
- Active agent count (orange)
- Tool calls / intents declared (blue)
- Failures (red)

### HydraDB Memory Graph

An interactive D3 force-directed graph visualizing the shared memory:
- **Orange nodes** — active agents (large)
- **Blue nodes** — HydraDB super nodes (semantically central concepts extracted by the knowledge graph)
- **Small colored nodes** — individual memory entries, colored by sub-tenant (orange = shared context, blue = decisions, red = failures)

The sidebar shows a live count of memory entries by sub-tenant and lists the 30 most recent entries. The graph re-fetches automatically after every agent write (via `context:ingested` WebSocket events).

### Decision Log

A chronological feed of every architectural decision made by any agent. Auto-populated from every file write (PostToolUse hook) — no agent instrumentation required. Shows which agent made the decision, which file was affected, and the reasoning.

### Conflict Feed

Active and resolved conflicts. Severity is shown with color: red for critical (blocks the agent), yellow for warning (advisory). One-click resolution marks a conflict as resolved.

### Failure Memory

Every bash command that returned a non-zero exit code across all agents, indexed by file target and error type. Agents are warned at the start of each tool call if a target file has a known failure history.

---

## How HydraDB Powers the Brain

HydraDB is not just a log store. It is a **knowledge graph with semantic search** that automatically extracts entities, builds relationships between concepts, and enables context-aware recall. MissionControl uses it at every layer:

### At Spawn: Context Injection

Before the agent CLI starts, `injectBrainContext()` runs:

```
task: "fix the payment webhook handler"
    ↓ query HydraDB shared sub-tenant
    ↓ query HydraDB decisions sub-tenant
    ↓ optionally query parent agent's sub-tenant
    ↓ write combined result to .mc_context in worktree
```

The agent reads this file and starts with full knowledge of what other agents have done.

### During Work: Automatic Ingestion

Every file the agent writes triggers `PostToolUse`:

| Ingest type | Sub-tenant | What gets stored |
|-------------|-----------|-----------------|
| Context | `shared` | "Agent modified `src/auth.ts`: added JWT middleware" |
| Decision | `decisions` | Full decision record with reasoning and affected files |
| Failure | `failures` | Bash error output, exit code, command, target file |

HydraDB's `infer: true` flag tells it to extract insights and build the knowledge graph automatically — no tagging or schema design required.

### At Conflict Detection: Architectural Memory

Before the conflict LLM prompt is sent, `recallDecisionsForTarget()` queries HydraDB for past decisions affecting the target file. The LLM then checks whether the current intent contradicts those decisions. HydraDB's graph-enriched context means it finds related decisions even if they don't mention the exact filename.

### At Merge: Why? Panel

`recallContext()` is called with the agent's task as the query string, searching the `shared` sub-tenant. The result surfaces the agent's actual work history in the merge review panel.

### Sub-tenant Organization

| Sub-tenant | Content | Infer |
|------------|---------|-------|
| `shared` | Cross-agent context from every file write | Yes |
| `decisions` | Architectural decision records | Yes |
| `failures` | Bash error records | No |
| `intents` | Active intents (ephemeral) | No |
| `agent-{id}` | Parent/child context inheritance | Yes |

---

## How Hooks Work

When an agent is spawned, MissionControl writes hook configuration into the worktree. The agent CLI then calls these HTTP endpoints on every tool use.

### Claude Code

```json
// .claude/settings.json (written into worktree)
{
  "hooks": {
    "PreToolUse": [{
      "matcher": "Write|Edit|MultiEdit|Bash",
      "hooks": [{ "type": "http", "url": "http://localhost:3000/hooks/pre-tool-use?agentId=agent-xxx" }]
    }],
    "PostToolUse": [{ ... }],
    "PermissionRequest": [{ ... }],
    "SessionStart": [{ ... }]
  }
}
```

### Codex CLI

```json
// .codex/hooks.json (written into worktree)
{
  "hooks": {
    "PreToolUse": [{ "type": "http", "url": "http://localhost:3000/hooks/pre-tool-use?agentId=agent-xxx" }],
    "PostToolUse": [{ ... }],
    "PermissionRequest": [{ ... }],
    "SessionStart": [{ ... }]
  }
}
```

### OpenCode

```json
// opencode.json (written into worktree)
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": ["@missioncontrol/opencode-plugin"]
}
```

The OpenCode plugin (`packages/opencode-plugin`) is automatically installed into the worktree via `npm install`. It handles all the same hooks as Claude Code and Codex.

The `?agentId=agent-xxx` query parameter in all hook URLs is how the server maps a Claude Code or Codex session to its agent record. The session ID alone is not enough — the `agentId` must be in the URL.

---

## Repository Structure

```
missioncontrol/
├── packages/
│   ├── types/              # Shared TypeScript type definitions
│   │   └── src/index.ts    # AgentRecord, IntentRecord, ConflictResult, WSEvent, ...
│   │
│   ├── server/             # Fastify backend (:3000)
│   │   └── src/
│   │       ├── index.ts                    # Server entry, routes registration
│   │       ├── hydra.ts                    # All HydraDB operations
│   │       ├── state.ts                    # In-memory agents + intents Maps
│   │       ├── ws-events.ts                # WebSocket event broadcaster
│   │       ├── ws-pty.ts                   # PTY WebSocket server + buffer replay
│   │       ├── pty-buffer.ts               # 64KB rolling output buffer per agent
│   │       ├── routes/
│   │       │   ├── agents.ts               # /spawn, /kill, /resize, /register
│   │       │   ├── hooks.ts                # HTTP hook endpoints
│   │       │   ├── merge.ts                # /diff, /merge, /discard
│   │       │   ├── decisions.ts            # Decision log
│   │       │   ├── failures.ts             # Failure memory
│   │       │   ├── conflicts.ts            # Conflict tracking
│   │       │   └── context.ts              # Context ingest + query
│   │       └── services/
│   │           ├── pty-spawner.ts          # node-pty process management
│   │           ├── worktree-manager.ts     # git worktree create/merge/delete
│   │           ├── hook-installer.ts       # Write hook config into worktrees
│   │           ├── conflict-detector.ts    # 3-step conflict pipeline
│   │           ├── port-registry.ts        # Per-agent port assignment
│   │           ├── health-monitor.ts       # SDK agent health checks
│   │           └── graph-traversal.ts      # HydraDB graph data for dashboard
│   │
│   ├── dashboard/          # React + Vite frontend (:3001)
│   │   └── src/
│   │       ├── views/
│   │       │   ├── AgentFleet.tsx          # Main fleet view
│   │       │   ├── ContextGraph.tsx        # D3 memory graph
│   │       │   ├── DecisionLog.tsx         # Decision feed
│   │       │   ├── ConflictFeed.tsx        # Conflict feed
│   │       │   └── FailureMemory.tsx       # Failure log
│   │       ├── components/
│   │       │   ├── AgentPane.tsx           # xterm.js terminal card
│   │       │   ├── AgentTimeline.tsx       # Recharts activity chart
│   │       │   ├── NewAgentDialog.tsx      # Spawn dialog
│   │       │   ├── MergeReview.tsx         # Diff + merge panel
│   │       │   └── HealthRing.tsx          # Agent status indicator
│   │       ├── hooks/useEventSocket.ts     # WebSocket event handler
│   │       └── store/useStore.ts           # Zustand state
│   │
│   ├── sdk/                # @missioncontrol/sdk — programmatic agent API
│   ├── cli/                # mc CLI — `mc start` etc.
│   └── opencode-plugin/    # @missioncontrol/opencode-plugin
│
├── scripts/cleanup.mjs     # Remove leftover worktrees
├── .env.example            # Environment variable template
├── pnpm-workspace.yaml
└── package.json
```

---

## API Reference

### Agent Management

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/agents/spawn` | Spawn a new agent (creates worktree, installs hooks, starts PTY) |
| `POST` | `/api/agents/:id/kill` | Kill agent process |
| `POST` | `/api/agents/:id/resize` | Resize PTY (cols/rows) |
| `GET` | `/api/agents` | List all agents |

### Merge Workflow

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/agents/:id/diff` | Get git diff + HydraDB context summary |
| `POST` | `/api/agents/:id/merge` | Merge worktree into main |
| `POST` | `/api/agents/:id/discard` | Discard worktree without merging |

### Hook Endpoints (called by agent CLIs, not the browser)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/hooks/session-start` | Map session_id → agentId |
| `POST` | `/hooks/pre-tool-use?agentId=` | Conflict check, intent declaration |
| `POST` | `/hooks/post-tool-use?agentId=` | HydraDB ingest, decision logging |
| `POST` | `/hooks/permission-request?agentId=` | Suspend agent, await user decision |

### Memory & Graph

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/context` | Ingest context into HydraDB |
| `GET` | `/api/context/query` | Query context by scope/tags |
| `POST` | `/api/decisions` | Record a decision |
| `GET` | `/api/decisions/why?target=` | Ask why a file was changed |
| `POST` | `/api/failures` | Record a failure |
| `GET` | `/api/failures/check?target=` | Check known failures for a target |
| `GET` | `/api/graph` | Get full graph data (agents + HydraDB nodes) |
| `GET` | `/api/memory/stats` | HydraDB source counts by sub-tenant |

### Permissions

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/permissions/:requestId/resolve` | Resolve a pending permission (allow/deny) |

### System

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/status` | Agent count, intent count, uptime |
| `GET` | `/api/server-info` | Server cwd + platform (used to prefill spawn dialog) |

### WebSocket

| Channel | Protocol | Description |
|---------|----------|-------------|
| `ws://localhost:3000/ws` | JSON | Structured events: agent lifecycle, conflicts, decisions, failures |
| `ws://localhost:3000/pty/:agentId` | Binary | Raw xterm bytes, bidirectional |

---

## Development

```bash
# Type-check all packages
pnpm -r typecheck

# Build all packages
pnpm build

# Run server in dev mode (hot reload)
pnpm dev

# Run dashboard in dev mode (Vite HMR)
pnpm dev:dashboard

# Clean up orphaned worktrees from crashed sessions
pnpm cleanup
```

---

## Troubleshooting

**Agent shows "failed" status after 30 seconds**
Only SDK-registered agents are heartbeat-monitored. PTY agents (spawned via the dashboard) are tracked by their node-pty process — they never show as dead while running. If you see "failed" for a PTY agent, the process actually exited.

**Terminal is blank when I open an agent pane**
Should not happen — output is buffered (64 KB per agent) and replayed on WebSocket connect. If you see a blank terminal, the agent exited before you opened the pane. Check the agent's status badge.

**Hook endpoint returns 200 but nothing appears in HydraDB**
Check that `HYDRA_API_KEY` and `HYDRA_TENANT_ID` are set in `.env`. HydraDB calls are non-fatal (they silently fail if credentials are missing). Run `hydradb memories list` to verify entries are being stored.

**Conflict detection is not running**
Semantic and architectural conflict detection require `OPENROUTER_API_KEY`. File-level conflicts (two agents writing the same file) work without it. Add the key to `.env` and restart the server.

**git worktree errors on spawn**
The `projectPath` you enter must be a git repository with at least one commit. Bare repos and repos without a HEAD commit are not supported. Ensure the path exists and `git status` runs cleanly inside it.

**npm install fails during OpenCode agent spawn**
The `@missioncontrol/opencode-plugin` install into the worktree runs `npm install` in the worktree directory. If this fails (network, permissions, no `package.json`), the plugin is skipped and the OpenCode agent runs without hooks — it will still work as a terminal, but PostToolUse ingestion and conflict detection won't fire.

---

## License

[PolyForm Noncommercial License 1.0.0](LICENSE)

You may use, modify, and share MissionControl for personal, educational, and non-commercial purposes. Commercial use requires explicit permission from the maintainers.
