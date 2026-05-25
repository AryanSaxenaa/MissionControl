import type { FastifyInstance } from 'fastify'
import { v4 as uuidv4 } from 'uuid'
import { agents } from '../state.js'
import type { AgentRecord, AgentKind } from '@missioncontrol/types'
import { broadcast } from '../ws-events.js'
import { recallContext, recallParentContext, ingestAgentSummary, SUB_TENANTS } from '../hydra.js'
import { computeContextRichness, incrementCounter } from '../services/agent-health.js'
import { RegisterAgentSchema, HeartbeatSchema } from '../validators.js'
import { createWorktree } from '../services/worktree-manager.js'
import { assignPort, injectPortEnv } from '../services/port-registry.js'
import { installHooks } from '../services/hook-installer.js'
import { spawnAgent, killAgent, resizeAgent } from '../services/pty-spawner.js'
import fs from 'fs/promises'
import path from 'path'

// Always injects HydraDB brain context before agent starts.
// Queries shared context + prior decisions using the task as query.
// If parentAgentId provided, also folds in the parent agent's sub-tenant.
// Written to .mc_context in the worktree so the agent can read it at start.
async function injectBrainContext(
  agentId: string,
  task: string,
  worktreePath: string,
  parentAgentId?: string
): Promise<void> {
  const sections: string[] = []

  if (task.trim()) {
    try {
      const [shared, decisions] = await Promise.all([
        recallContext(task, SUB_TENANTS.SHARED),
        recallContext(task, SUB_TENANTS.DECISIONS),
      ])
      const sharedText    = shared.chunks?.map((c: any) => c.chunk_content).join('\n---\n') ?? ''
      const decisionsText = decisions.chunks?.map((c: any) => c.chunk_content).join('\n---\n') ?? ''
      if (sharedText.trim())    sections.push(`=== SHARED CONTEXT ===\n${sharedText}`)
      if (decisionsText.trim()) sections.push(`=== PRIOR DECISIONS ===\n${decisionsText}`)
    } catch { /* non-fatal — HydraDB may be empty on first run */ }
  }

  if (parentAgentId) {
    try {
      const parent     = await recallParentContext(parentAgentId)
      const parentText = parent.chunks?.slice(0, 20).map((c: any) => c.chunk_content).join('\n---\n') ?? ''
      if (parentText.trim()) sections.push(`=== PARENT AGENT CONTEXT (${parentAgentId}) ===\n${parentText}`)
    } catch { /* non-fatal */ }
  }

  if (sections.length === 0) return

  const content = [
    `# MissionControl — Agent Brain Context`,
    `# Agent: ${agentId} | Task: ${task || '(interactive)'}`,
    `# ${new Date().toISOString()}`,
    '',
    ...sections,
  ].join('\n')

  await fs.writeFile(path.join(worktreePath, '.mc_context'), content)
}

// Used only by the legacy v0.1.0 /register compat path (SDK-based agents).
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

  // v3: Spawn an agent — always creates a git worktree in the user's project (spec §3)
  fastify.post('/spawn', async (req, reply) => {
    const { kind, task = '', name, parentAgentId, projectPath } = req.body as {
      kind: AgentKind
      task?: string
      name: string
      parentAgentId?: string
      projectPath: string   // required: absolute path to the user's git repo
    }

    if (!projectPath) {
      return reply.status(400).send({ error: 'projectPath is required' })
    }

    // Validate projectPath exists
    try {
      await fs.access(projectPath)
    } catch {
      return reply.status(400).send({ error: `Project path not found: ${projectPath}` })
    }

    const agentId = `agent-${uuidv4()}`

    // Spec §3: always create a git worktree branched off the user's project repo.
    // The agent works in this isolated worktree — never in the main working tree.
    const wtPath = await createWorktree(agentId, task || 'session', projectPath)

    // Assign port + inject into worktree .env
    const assignedPort = assignPort(agentId)
    await injectPortEnv(wtPath, assignedPort)

    // Install AI hooks into the worktree
    await installHooks(agentId, kind, wtPath)

    // Inject HydraDB brain context for all agents (not just children).
    // Populates .mc_context with relevant shared context + prior decisions.
    try {
      await injectBrainContext(agentId, task, wtPath, parentAgentId)
    } catch { /* non-fatal */ }

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
      worktreePath: wtPath,
      currentTask: task,
      projectPath,
    }
    agents.set(agentId, newAgent)

    // Broadcast before spawn so the dashboard card appears immediately
    broadcast({ type: 'agent:spawned', agent: newAgent })

    // Spawn PTY inside the worktree — agent works on an isolated branch
    spawnAgent(agentId, kind, wtPath, task, assignedPort).catch(err => {
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
      worktreePath: '',  // SDK-registered agents have no worktree
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
