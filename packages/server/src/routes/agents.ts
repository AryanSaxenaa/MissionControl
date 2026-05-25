import type { FastifyInstance } from 'fastify'
import { v4 as uuidv4 } from 'uuid'
import { agents } from '../state.js'
import type { AgentRecord, AgentKind } from '@missioncontrol/types'
import { broadcast } from '../ws-events.js'
import { recallParentContext, ingestAgentSummary } from '../hydra.js'
import { computeContextRichness, incrementCounter } from '../services/agent-health.js'
import { RegisterAgentSchema, HeartbeatSchema } from '../validators.js'
import { createWorktree } from '../services/worktree-manager.js'
import { assignPort, injectPortEnv } from '../services/port-registry.js'
import { installHooks } from '../services/hook-installer.js'
import { spawnAgent, killAgent, resizeAgent } from '../services/pty-spawner.js'
import fs from 'fs/promises'
import path from 'path'

async function inheritParentContext(
  agentId: string,
  parentAgentId: string,
  writePath?: string
): Promise<string> {
  const recalled = await recallParentContext(parentAgentId)
  if (!recalled.chunks?.length) return ''
  const text = recalled.chunks.slice(0, 20).map((c: any) => c.chunk_content).join('\n---\n')
  if (writePath) await fs.writeFile(writePath, text)
  return text
}

export default async function agentRoutes(fastify: FastifyInstance) {

  // v3: Spawn an agent (creates worktree + PTY)
  fastify.post('/spawn', async (req, reply) => {
    const { kind, task = '', name, parentAgentId, projectPath } = req.body as {
      kind: AgentKind
      task?: string
      name: string
      parentAgentId?: string
      projectPath?: string   // absolute path to the user's project; defaults to repo root
    }

    // Validate projectPath if provided
    if (projectPath) {
      try {
        await fs.access(projectPath)
      } catch {
        return reply.status(400).send({ error: `Project path not found: ${projectPath}` })
      }
    }

    const agentId = `agent-${uuidv4()}`

    // Two modes:
    //
    // A) projectPath provided → agent works directly in the user's project.
    //    No git worktree needed. Hooks installed into projectPath.
    //    spawnCwd = projectPath.
    //
    // B) no projectPath → git-isolated mode. Worktree branched off MC repo.
    //    Hooks installed into worktree. spawnCwd = worktreePath.
    //    (Legacy/advanced usage — useful for working on the MC repo itself.)

    let worktreePath: string
    let spawnCwd: string

    if (projectPath) {
      // Mode A — direct project mode, no worktree
      worktreePath = projectPath   // stored for record-keeping; no git worktree created
      spawnCwd     = projectPath
    } else {
      // Mode B — git worktree isolation
      worktreePath = await createWorktree(agentId, task || 'session')
      spawnCwd     = worktreePath
    }

    // Assign port + inject into project .env
    const assignedPort = assignPort(agentId)
    await injectPortEnv(spawnCwd, assignedPort)

    // Install AI hooks into the directory the agent will work in
    await installHooks(agentId, kind, spawnCwd)

    // Inherit parent context if applicable
    if (parentAgentId) {
      try {
        await inheritParentContext(agentId, parentAgentId, path.join(spawnCwd, '.mc_context'))
      } catch { /* non-fatal */ }
    }

    // Create agent record
    const newAgent: AgentRecord = {
      id: agentId,
      name,
      kind,
      status: 'active',
      spawnedAt: Date.now(),
      lastHeartbeat: Date.now(),
      contextRichness: 0,
      parentAgentId,
      assignedPort,
      worktreePath,
      currentTask: task,
      projectPath,
    }
    agents.set(agentId, newAgent)

    // Broadcast before spawn so dashboard shows the card immediately
    broadcast({ type: 'agent:spawned', agent: newAgent })

    // Spawn PTY in the correct directory
    spawnAgent(agentId, kind, spawnCwd, task, assignedPort, !!projectPath).catch(err => {
      console.error(`[spawn] PTY failed for ${agentId}:`, err.message)
      broadcast({ type: 'agent:died', agentId })
    })

    return reply.send({ agentId, assignedPort })
  })

  // Kill an agent
  fastify.post('/:id/kill', async (req, reply) => {
    const { id } = req.params as { id: string }
    killAgent(id)
    return reply.send({ ok: true })
  })

  // Resize PTY to match xterm.js dimensions
  fastify.post('/:id/resize', async (req, reply) => {
    const { id }         = req.params as { id: string }
    const { cols, rows } = req.body as { cols: number; rows: number }
    resizeAgent(id, cols, rows)
    return reply.send({ ok: true })
  })

  // List all agents
  fastify.get('/', async () => {
    return [...agents.values()]
  })

  // v0.1.0 compat: register (SDK-based agents call this)
  fastify.post('/register', async (req, reply) => {
    const body = RegisterAgentSchema.parse(req.body)

    const agentId = `agent-${uuidv4()}`
    let inheritedContext = ''

    const newAgent: AgentRecord = {
      id: agentId,
      name: body.name,
      kind: body.kind,
      pid: body.pid,
      status: 'active',
      spawnedAt: Date.now(),
      lastHeartbeat: Date.now(),
      contextRichness: 0,
      parentAgentId: body.parentAgentId,
      assignedPort: 0,
      worktreePath: process.cwd(),
    }

    agents.set(agentId, newAgent)

    if (body.parentAgentId) {
      try {
        inheritedContext = await inheritParentContext(agentId, body.parentAgentId)
        if (inheritedContext) {
          incrementCounter(agentId, 'inherited', inheritedContext.split('\n---\n').length)
          ingestAgentSummary(agentId, `Inherited context from parent agent ${body.parentAgentId}:\n${inheritedContext}`).catch(() => {})
        }
      } catch { /* non-fatal */ }
    }

    broadcast({ type: 'agent:registered', agent: agents.get(agentId)! })
    return { agentId, inheritedContext }
  })

  fastify.post('/:id/heartbeat', async (req, reply) => {
    const { id } = req.params as Record<string, string>
    const body = HeartbeatSchema.parse(req.body)

    const agent = agents.get(id)
    if (!agent) return reply.status(404).send({ error: 'Agent not found' })

    agent.status = body.status
    agent.currentTask = body.currentTask
    agent.lastHeartbeat = Date.now()
    agent.contextRichness = await computeContextRichness(id)

    broadcast({ type: 'agent:heartbeat', agentId: id, status: body.status, task: body.currentTask })
    return { ok: true }
  })
}
