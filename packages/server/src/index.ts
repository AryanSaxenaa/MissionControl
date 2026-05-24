import Fastify from 'fastify'
import cors from '@fastify/cors'
import { attachWebSocketServer } from './ws.js'
import { agents, activeIntents } from './state.js'
import { getGraphData } from './services/graph-traversal.js'
import { startHealthMonitor } from './services/health-monitor.js'

import agentRoutes from './routes/agents.js'
import contextRoutes from './routes/context.js'
import intentRoutes from './routes/intents.js'
import decisionRoutes from './routes/decisions.js'
import failureRoutes from './routes/failures.js'
import conflictRoutes from './routes/conflicts.js'

const PORT = parseInt(process.env.MC_SERVER_PORT || '3000')

const fastify = Fastify({ logger: false })

await fastify.register(cors, { origin: true })

fastify.register(agentRoutes, { prefix: '/api/agents' })
fastify.register(contextRoutes, { prefix: '/api/context' })
fastify.register(intentRoutes, { prefix: '/api/intents' })
fastify.register(decisionRoutes, { prefix: '/api/decisions' })
fastify.register(failureRoutes, { prefix: '/api/failures' })
fastify.register(conflictRoutes, { prefix: '/api/conflicts' })

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
attachWebSocketServer(fastify.server)
console.log(`[MissionControl] Server on :${PORT}`)

startHealthMonitor()
