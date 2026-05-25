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

import agentRoutes from './routes/agents.js'
import contextRoutes from './routes/context.js'
import intentRoutes from './routes/intents.js'
import decisionRoutes from './routes/decisions.js'
import failureRoutes from './routes/failures.js'
import conflictRoutes from './routes/conflicts.js'
import { hooksRoutes } from './routes/hooks.js'
import { mergeRoutes } from './routes/merge.js'

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
  const { superNodes, sources } = await getGraphData()
  return {
    superNodes,
    sources: sources.slice(0, 200),
    activeAgents: [...agents.values()],
    activeIntents: [...activeIntents.values()],
  }
})

fastify.get('/api/status', async () => ({
  agents: agents.size,
  intents: activeIntents.size,
  uptime: process.uptime(),
}))

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
