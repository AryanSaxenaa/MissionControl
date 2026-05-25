import { readFileSync, existsSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'
import Fastify from 'fastify'
import cors from '@fastify/cors'
import { handleEventsUpgrade } from './ws-events.js'
import { handlePtyUpgrade } from './ws-pty.js'
import { agents, activeIntents } from './state.js'
import { getGraphData } from './services/graph-traversal.js'
import { startHealthMonitor } from './services/health-monitor.js'
import { listSources } from './hydra.js'
import agentRoutes from './routes/agents.js'
import contextRoutes from './routes/context.js'
import intentRoutes from './routes/intents.js'
import decisionRoutes from './routes/decisions.js'
import failureRoutes from './routes/failures.js'
import conflictRoutes from './routes/conflicts.js'
import { hooksRoutes } from './routes/hooks.js'
import { mergeRoutes } from './routes/merge.js'
import { recentDecisions } from './routes/decisions.js'
import { recentFailures } from './routes/failures.js'

const __dirname = dirname(fileURLToPath(import.meta.url))
const envPath = resolve(__dirname, '../../../.env')
if (existsSync(envPath)) {
  for (const line of readFileSync(envPath, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq === -1) continue
    const key = trimmed.slice(0, eq).trim()
    const val = trimmed.slice(eq + 1).trim()
    if (!process.env[key]) process.env[key] = val
  }
}

// Surfaces which integrations are configured. Returned by /api/env-status and
// logged on boot so missing credentials don't fail silently on every hook call.
type EnvIntegrationStatus = {
  hydraConfigured: boolean
  hydraReachable: boolean | null   // null until ping completes
  hydraError: string | null
  openrouterConfigured: boolean
  envFileFound: boolean
}

const envStatus: EnvIntegrationStatus = {
  hydraConfigured: Boolean(process.env.HYDRA_API_KEY && process.env.HYDRA_TENANT_ID),
  hydraReachable: null,
  hydraError: null,
  openrouterConfigured: Boolean(process.env.OPENROUTER_API_KEY),
  envFileFound: existsSync(envPath),
}

// Boot banner — make missing credentials impossible to miss.
console.log(`[MissionControl] env file: ${envStatus.envFileFound ? envPath : 'NOT FOUND'}`)
if (!envStatus.hydraConfigured) {
  console.error(
    `[MissionControl] FATAL CONFIG: HYDRA_API_KEY and HYDRA_TENANT_ID are required.\n` +
    `  - HYDRA_API_KEY     : ${process.env.HYDRA_API_KEY ? 'set' : 'MISSING'}\n` +
    `  - HYDRA_TENANT_ID   : ${process.env.HYDRA_TENANT_ID ? 'set' : 'MISSING'}\n` +
    `  Add these to ${envPath} before spawning agents. Memory/decisions/conflicts will not work without them.`
  )
} else {
  console.log(`[MissionControl] HydraDB configured (tenant: ${process.env.HYDRA_TENANT_ID})`)
}
console.log(`[MissionControl] OpenRouter (semantic conflict step): ${envStatus.openrouterConfigured ? 'enabled' : 'disabled (no OPENROUTER_API_KEY)'}`)

const PORT = parseInt(process.env.MC_SERVER_PORT || '3000')

const fastify = Fastify({ logger: false })

await fastify.register(cors, { origin: true })

fastify.register(agentRoutes, { prefix: '/api/agents' })
fastify.register(contextRoutes, { prefix: '/api/context' })
fastify.register(intentRoutes, { prefix: '/api/intents' })
fastify.register(decisionRoutes, { prefix: '/api/decisions' })
fastify.register(failureRoutes, { prefix: '/api/failures' })
fastify.register(conflictRoutes, { prefix: '/api/conflicts' })
fastify.register(hooksRoutes)
fastify.register(mergeRoutes)

fastify.get('/api/graph', async (req, reply) => {
  const { superNodes } = await getGraphData()

  // ingestMemory() creates HydraDB memories, not document sources — listData()
  // always returns empty. Synthesize sources from the in-memory ring buffers so
  // the Context Graph sidebar and memory breakdown have data immediately.
  const decisionSources = recentDecisions.map(d => ({
    source_id: d.sourceId || `decision-${d.createdAt}`,
    sub_tenant_id: 'decisions',
    created_at: new Date(d.createdAt).toISOString(),
    metadata: { agent_id: d.agentId, summary: d.summary },
  }))
  const failureSources = recentFailures.map(f => ({
    source_id: f.sourceId || `failure-${f.createdAt}`,
    sub_tenant_id: 'failures',
    created_at: new Date(f.createdAt).toISOString(),
    metadata: { agent_id: f.agentId, target: f.target, error_type: f.errorType },
  }))
  const sources = [...decisionSources, ...failureSources].slice(0, 200)

  return {
    superNodes,
    sources,
    activeAgents: [...agents.values()],
    activeIntents: [...activeIntents.values()],
  }
})

fastify.get('/api/status', async () => ({
  agents: agents.size,
  intents: activeIntents.size,
  uptime: process.uptime(),
  env: envStatus,
}))

// Lets the dashboard show a clear banner when integrations are misconfigured,
// instead of users wondering why Decision Log / Context Graph stay empty.
fastify.get('/api/env-status', async () => envStatus)

// Returns the server's working directory so the dashboard can prefill the projectPath field.
fastify.get('/api/server-info', async () => ({
  cwd: process.cwd(),
  platform: process.platform,
}))

// HydraDB memory stats — surfaced in the dashboard status bar
fastify.get('/api/memory/stats', async (req, reply) => {
  try {
    const sources = await listSources()
    const items = (sources as any).sources ?? (sources as any).items ?? []
    return {
      totalSources: items.length,
      subTenants: [...new Set(items.map((s: any) => s.sub_tenant_id ?? 'shared'))],
    }
  } catch {
    return { totalSources: 0, subTenants: [] }
  }
})

try {
  await fastify.listen({ port: PORT, host: '0.0.0.0' })
} catch (err) {
  console.error(`[MissionControl] Failed to start on port ${PORT}:`, (err as Error).message)
  process.exit(1)
}

// Route WebSocket upgrades manually (required for two WSS on same HTTP server)
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

console.log(`[MissionControl] Server on :${PORT}`)
startHealthMonitor()

// Real HydraDB connectivity ping. Fast (5s timeout via withTimeout in hydra.ts)
// — if this fails, you'll see exactly why instead of every ingest failing later.
if (envStatus.hydraConfigured) {
  listSources()
    .then(() => {
      envStatus.hydraReachable = true
      console.log(`[MissionControl] HydraDB reachable — connectivity verified`)
    })
    .catch((e: any) => {
      envStatus.hydraReachable = false
      envStatus.hydraError = e?.message || String(e)
      console.error(`[MissionControl] HydraDB UNREACHABLE: ${envStatus.hydraError}`)
      console.error(`  All ingestContext/ingestDecision/ingestFailure calls will fail.`)
      console.error(`  Verify HYDRA_API_KEY is valid and your network can reach HydraDB.`)
    })
} else {
  envStatus.hydraReachable = false
  envStatus.hydraError = 'HYDRA_API_KEY or HYDRA_TENANT_ID not set'
}
