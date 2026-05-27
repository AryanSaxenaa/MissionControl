import type { FastifyInstance } from 'fastify'
import { v4 as uuidv4 } from 'uuid'
import { agents } from '../state.js'
import type { AgentRecord, AgentKind } from '@missioncontrol/types'
import { broadcast } from '../ws-events.js'
import { recallContext, recallParentContext, ingestAgentSummary, SUB_TENANTS } from '../hydra.js'
import { computeContextRichness, incrementCounter } from '../services/agent-health.js'
import { RegisterAgentSchema, HeartbeatSchema } from '../validators.js'
import { createWorktree, deleteWorktree } from '../services/worktree-manager.js'
import { assignPort, releasePort, injectPortEnv } from '../services/port-registry.js'
import { installHooks } from '../services/hook-installer.js'
import { spawnAgent, killAgent, resizeAgent } from '../services/pty-spawner.js'
import { destroyAgent } from '../services/agent-cleanup.js'
import { simpleGit } from 'simple-git'
import fs from 'fs/promises'
import path from 'path'

// Pre-flight: projectPath must be a git repo with at least one commit.
// Returns null if OK, or a user-facing error string explaining what's wrong.
async function validateProjectRepo(projectPath: string): Promise<string | null> {
  try {
    await fs.access(projectPath)
  } catch {
    return `Project path not found: ${projectPath}`
  }

  const git = simpleGit(projectPath)
  try {
    await git.raw(['rev-parse', '--git-dir'])
  } catch {
    return `Not a git repository: ${projectPath}. Run "git init" and create at least one commit before spawning an agent here.`
  }

  try {
    await git.raw(['rev-parse', 'HEAD'])
  } catch {
    return `Repository at ${projectPath} has no commits yet. Run "git commit" at least once before spawning an agent here.`
  }

  return null
}

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

    const repoError = await validateProjectRepo(projectPath)
    if (repoError) {
      return reply.status(400).send({ error: repoError })
    }

    const agentId = `agent-${uuidv4()}`

    // Spec §3: always create a git worktree branched off the user's project repo.
    // The agent works in this isolated worktree — never in the main working tree.
    let wtPath: string
    try {
      wtPath = await createWorktree(agentId, task || 'session', projectPath)
    } catch (err: any) {
      const msg = err?.message || String(err)
      console.error(`[spawn] createWorktree failed for ${projectPath}:`, msg)
      return reply.status(500).send({ error: `Failed to create worktree: ${msg}` })
    }

    let assignedPort: number = 0
    let portAssigned = false
    try {
      // Assign port + inject into worktree .env
      assignedPort = assignPort(agentId)
      portAssigned = true
      await injectPortEnv(wtPath, assignedPort)

      // Install AI hooks into the worktree
      await installHooks(agentId, kind, wtPath)
    } catch (err: any) {
      const msg = err?.message || String(err)
      console.error(`[spawn] setup failed for ${agentId}, rolling back:`, msg)

      // Rollback in reverse order. Each step is best-effort and logs but does not throw.
      if (portAssigned) {
        try { releasePort(agentId) }
        catch (e: any) { console.error(`[spawn] rollback releasePort failed:`, e?.message || e) }
      }
      try { await deleteWorktree(agentId, projectPath) }
      catch (e: any) { console.error(`[spawn] rollback deleteWorktree failed:`, e?.message || e) }

      return reply.status(500).send({ error: `Agent setup failed: ${msg}` })
    }

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

    // Spawn PTY inside the worktree — agent works on an isolated branch.
    // If pty.spawn itself throws (binary missing, cmd.exe not found), the agent never
    // existed — fully roll back so the agents map invariant holds: every record
    // corresponds to a process that ran. The dashboard receives spawn-failed with
    // the error so the card it just rendered can show why it disappeared.
    spawnAgent(agentId, kind, wtPath, task, assignedPort).catch(async err => {
      const msg = err?.message || String(err)
      console.error(`[spawn] PTY failed for ${agentId}, rolling back:`, msg)

      agents.delete(agentId)

      try { releasePort(agentId) }
      catch (e: any) { console.error(`[spawn] post-spawn releasePort failed:`, e?.message || e) }
      try { await deleteWorktree(agentId, projectPath) }
      catch (e: any) { console.error(`[spawn] post-spawn deleteWorktree failed:`, e?.message || e) }

      broadcast({ type: 'agent:spawn-failed', agentId, error: msg })
    })

    return reply.send({ agentId, assignedPort })
  })

  // Kill an agent
  fastify.post('/:id/kill', async (req, reply) => {
    const { id } = req.params as { id: string }
    killAgent(id)
    destroyAgent(id)
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
