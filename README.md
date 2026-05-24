# MissionControl

> **The missing memory bus for parallel AI coding agents.**

[![TypeScript](https://img.shields.io/badge/TypeScript-5.4-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-20+-green.svg)](https://nodejs.org/)
[![pnpm](https://img.shields.io/badge/pnpm-9.0+-orange.svg)](https://pnpm.io/)
[![License](https://img.shields.io/badge/license-PolyForm_Noncommercial_1.0.0-blue.svg)](LICENSE)

MissionControl is a **shared-memory coordination OS** for parallel AI coding agents. It is not a terminal emulator. It is not a chat interface. It is the persistent memory layer and control plane that lets Claude Code, Codex CLI, OpenCode, and any other coding agent collaborate without stepping on each other.

When you run multiple AI agents on the same codebase, they collide. They overwrite the same files, make contradictory architectural decisions, and repeat the same mistakes. MissionControl solves this by giving every agent a shared brain — a live, queryable memory of who is doing what, what has been decided, and what has already failed.

## Why MissionControl?

Modern development is becoming agent-first. You might have:
- Claude Code refactoring your backend
- Codex CLI generating tests
- OpenCode fixing bugs in parallel

Without coordination, these agents:
- **Collide on files** → lost work, broken builds
- **Contradict architecture** → inconsistent patterns, tech debt
- **Repeat failures** → same bugs, same mistakes
- **Lose context** → every agent starts from zero

MissionControl gives you:
- **Intent Declaration** → agents announce what they're about to do
- **Conflict Detection** → automatic detection of file, semantic, and architectural conflicts
- **Failure Memory** → never repeat the same mistake twice
- **Decision Log** → full audit trail of why every change was made
- **Context Inheritance** → child agents inherit knowledge from parent agents
- **Live Dashboard** → real-time visualization of your agent fleet

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Dashboard                             │
│              (React + D3 + WebSocket)                       │
│         Live fleet view, graph, conflicts, logs             │
└──────────────────────┬──────────────────────────────────────┘
                       │ WebSocket
┌──────────────────────▼──────────────────────────────────────┐
│                      Server                                  │
│            (Fastify + WebSocket Hub)                        │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐      │
│  │  Agents  │ │ Context  │ │ Intents  │ │ Conflicts│      │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘      │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐                   │
│  │Decisions │ │ Failures │ │  Graph   │                   │
│  └──────────┘ └──────────┘ └──────────┘                   │
└──────────────────────┬──────────────────────────────────────┘
                       │ @hydradb/sdk
┌──────────────────────▼──────────────────────────────────────┐
│                     HydraDB Brain                            │
│              (Cloud Agentic Memory)                         │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐      │
│  │  Shared  │ │Decisions │ │ Failures │ │  Intents │      │
│  │ Context  │ │  Memory  │ │  Memory  │ │  Active  │      │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘      │
│              + Agent-scoped sub-tenants                     │
└─────────────────────────────────────────────────────────────┘
```

## Tech Stack

### Backend
- **Runtime:** Node.js 20+ with TypeScript
- **Framework:** Fastify (high-performance, great TS support)
- **Memory Bus:** HydraDB via `@hydradb/sdk` (cloud agentic memory)
- **Real-time:** Native WebSockets (`ws` library)
- **Validation:** Zod (runtime schema validation)
- **LLM Integration:** Anthropic Claude (semantic conflict detection)

### Frontend
- **Framework:** React 18 + Vite
- **Styling:** Tailwind CSS v3
- **State:** Zustand (lightweight, no boilerplate)
- **Graphs:** D3.js (force-directed context graph)
- **Charts:** Recharts (agent health, activity timelines)

### CLI / SDK
- **Language:** TypeScript compiled to ESM
- **Distribution:** npm package `@missioncontrol/sdk`
- **Shell Integration:** Bash/Zsh compatible hooks for Claude Code and OpenCode

## Quick Start

### Prerequisites
- Node.js 20+
- pnpm 9+
- HydraDB API key ([get one here](https://app.hydradb.com))

### 1. Clone and Install

```bash
git clone https://github.com/yourusername/missioncontrol.git
cd missioncontrol
pnpm install
```

### 2. Configure Environment

```bash
cp .env.example .env
# Edit .env with your credentials
```

```env
HYDRA_API_KEY=your_hydradb_api_key
HYDRA_TENANT_ID=mc-yourproject
ANTHROPIC_API_KEY=your_anthropic_key  # Optional, for semantic conflict detection
MC_SERVER_PORT=3000
MC_DASHBOARD_PORT=3001
```

### 3. Start the System

```bash
# Using the CLI
pnpm --filter @missioncontrol/cli dev
mc start

# Or start individually
pnpm --filter @missioncontrol/server dev
pnpm --filter @missioncontrol/dashboard dev
```

### 4. Open the Dashboard

Navigate to `http://localhost:3001` to see your agent fleet in real time.

## Usage

### Register an Agent

```bash
curl -X POST http://localhost:3000/api/agents/register \
  -H "Content-Type: application/json" \
  -d '{"name": "backend-refactor", "kind": "claude-code"}'
```

### Declare an Intent

Before modifying a file, an agent declares its intent:

```bash
curl -X POST http://localhost:3000/api/intents \
  -H "Content-Type: application/json" \
  -d '{
    "agentId": "agent-xxx",
    "action": "write",
    "target": "src/auth.ts",
    "description": "Add JWT validation middleware"
  }'
```

MissionControl checks for conflicts and returns them immediately.

### Write Context

Agents share knowledge by writing context:

```bash
curl -X POST http://localhost:3000/api/context \
  -H "Content-Type: application/json" \
  -d '{
    "agentId": "agent-xxx",
    "content": "Auth middleware should validate Bearer tokens",
    "scope": "src/auth.ts",
    "tags": ["auth", "middleware"],
    "confidence": 0.9
  }'
```

### Record a Decision

Important architectural choices are logged for future reference:

```bash
curl -X POST http://localhost:3000/api/decisions \
  -H "Content-Type: application/json" \
  -d '{
    "agentId": "agent-xxx",
    "summary": "Use JWT for stateless auth",
    "reasoning": "Eliminates session storage complexity",
    "alternativesConsidered": ["Session-based auth"],
    "affectedFiles": ["src/auth.ts"]
  }'
```

### Ask "Why?"

Query the decision history for any file:

```bash
curl "http://localhost:3000/api/decisions/why?target=src/auth.ts"
```

## SDK Integration

### Programmatic Agent

```typescript
import { Agent } from '@missioncontrol/sdk'

const agent = new Agent({
  serverUrl: 'http://localhost:3000',
  name: 'feature-worker-1',
  kind: 'claude-code',
})

await agent.register()

// Check for known failures before starting
const failures = await agent.checkFailures('src/payments.ts')

// Declare intent — returns conflicts if any
const { intentId, clear, conflicts } = await agent.declareIntent(
  'write',
  'src/payments.ts',
  'Implement Stripe webhook handler'
)

if (!clear) {
  console.warn('Conflicts detected:', conflicts)
}

// Do work...

// Share what you learned
await agent.writeContext(
  'Stripe webhooks must verify signatures before processing',
  'src/payments.ts',
  ['stripe', 'webhooks', 'security']
)

// Record the decision
await agent.recordDecision(
  'Use Stripe SDK for webhook verification',
  'Reduces custom crypto code and error surface',
  ['Custom HMAC verification'],
  ['src/payments.ts']
)

await agent.completeCurrentIntent()
await agent.shutdown()
```

### Claude Code Hooks

Install hooks to automatically track every tool use:

```bash
mc init
```

This creates `.claude/hooks/mc_pre.js` and `.claude/hooks/mc_post.js` that:
- Declare intents before file modifications
- Check for known failures
- Block critical conflicts
- Write context after successful edits

## Dashboard Views

### Agent Fleet
Real-time status of all registered agents: active, idle, failed, or completed. Shows current task and context richness score.

### Context Graph
Interactive D3 force-directed graph visualizing:
- **Agent nodes** (large, colored by status)
- **Super nodes** (medium, blue — semantically central concepts)
- **Source nodes** (small, colored by type)

### Decision Log
Chronological list of all architectural decisions with agent attribution, reasoning, and affected files.

### Conflict Feed
Active conflicts with severity indicators (critical/warning/info) and one-click resolution.

### Failure Memory
Searchable database of past failures indexed by target file and error type.

## Conflict Detection

MissionControl detects three classes of conflicts:

1. **File Conflicts (Critical)** — Two agents intend to write the same file
2. **Semantic Conflicts (Warning)** — LLM-powered detection of contradictory intents
3. **Architectural Conflicts (Warning)** — Intent contradicts logged architectural decisions

## HydraDB Memory Schema

HydraDB automatically builds a knowledge graph from ingested text. MissionControl organizes memories into sub-tenants:

| Sub-tenant | Purpose |
|-----------|---------|
| `shared` | Cross-agent context and knowledge |
| `decisions` | Architectural decision records |
| `failures` | Failure memory and post-mortems |
| `intents` | Active and historical intent records |
| `agent-{id}` | Agent-scoped private context |

## Repository Structure

```
missioncontrol/
├── packages/
│   ├── types/           # Shared TypeScript definitions
│   ├── sdk/             # Agent SDK (@missioncontrol/sdk)
│   ├── server/          # Fastify backend
│   ├── dashboard/       # React control plane
│   └── cli/             # mc CLI tool
├── missioncontrol.config.ts
├── pnpm-workspace.yaml
└── package.json
```

## API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/agents/register` | POST | Register a new agent |
| `/api/agents/:id/heartbeat` | POST | Agent heartbeat |
| `/api/context` | POST | Ingest context |
| `/api/context/query` | GET | Query context |
| `/api/intents` | POST | Declare intent |
| `/api/intents/:id` | PATCH | Update intent status |
| `/api/decisions` | POST | Record decision |
| `/api/decisions/why` | GET | Ask why about a target |
| `/api/failures` | POST | Record failure |
| `/api/failures/check` | GET | Check known failures |
| `/api/graph` | GET | Get graph data |
| `/api/status` | GET | Server status |
| `/ws` | WS | Real-time event stream |

## Development

```bash
# Run type checks
pnpm -r typecheck

# Build all packages
pnpm -r build

# Run server in dev mode
pnpm --filter @missioncontrol/server dev

# Run dashboard in dev mode
pnpm --filter @missioncontrol/dashboard dev
```

## Security

- **No secrets in source.** All credentials via environment variables.
- **Zod validation** on every request body, query, and param.
- **No `shell: true`** in process spawning.
- **Input sanitization** via structured schemas, not ad-hoc regex.

## Roadmap

- [ ] Persistent WebSocket connections with reconnection
- [ ] Agent-to-agent messaging
- [ ] GitHub Actions integration
- [ ] VS Code extension
- [ ] Multi-tenant dashboard
- [ ] Advanced conflict resolution workflows

## License

This project is licensed under the [PolyForm Noncommercial License 1.0.0](https://polyformproject.org/licenses/noncommercial/1.0.0).

**You may:**
- Use MissionControl for personal, educational, research, and non-commercial projects
- Modify the code for your own non-commercial use
- Share the software with others for non-commercial purposes

**You may NOT:**
- Use MissionControl for commercial purposes without explicit permission
- Sell MissionControl or derivative works
- Distribute modified versions for profit

For commercial licensing inquiries, please contact the maintainers.
