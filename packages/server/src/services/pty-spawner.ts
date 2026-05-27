import * as pty from 'node-pty'
import type { AgentKind } from '@missioncontrol/types'
import { broadcast } from '../ws-events.js'
import type { WSEvent } from '@missioncontrol/types'
import { appendBuffer, clearBuffer } from '../pty-buffer.js'
import { agents } from '../state.js'

export const ptyInstances = new Map<string, pty.IPty>()

const IS_WINDOWS = process.platform === 'win32'

interface SpawnStrategy {
  cmd: string
  args: string[]
  waitForPrompt: boolean
  exitEvents(exitCode: number, agentId: string): WSEvent[]
}

function exitEventsNonInteractive(exitCode: number, agentId: string): WSEvent[] {
  if (exitCode === 0) return [
    { type: 'agent:completed', agentId },
    { type: 'agent:ready-to-merge', agentId },
  ]
  return [{ type: 'agent:died', agentId }]
}

function exitEventsInteractive(agentId: string): WSEvent[] {
  return [
    { type: 'agent:completed', agentId },
    { type: 'agent:ready-to-merge', agentId },
  ]
}

function exitEventsCustom(exitCode: number, agentId: string): WSEvent[] {
  if (exitCode === 0) return [
    { type: 'agent:completed', agentId },
    { type: 'agent:ready-to-merge', agentId },
  ]
  return [{ type: 'agent:died', agentId }]
}

function getSpawnStrategy(kind: AgentKind, task: string): SpawnStrategy {
  const hasTask = task.trim().length > 0
  return IS_WINDOWS
    ? getWindowsStrategy(kind, hasTask, task)
    : getUnixStrategy(kind, hasTask, task)
}

function getWindowsStrategy(kind: AgentKind, hasTask: boolean, task: string): SpawnStrategy {
  if (!hasTask || kind === 'custom') {
    const cli = kind === 'custom' ? '' : kind === 'claude-code' ? 'claude' : kind === 'codex' ? 'codex' : 'opencode'
    return {
      cmd: 'cmd.exe',
      args: kind === 'custom' ? ['/k'] : ['/k', cli],
      waitForPrompt: kind === 'custom',
      exitEvents: kind === 'custom'
        ? (ec, aid) => exitEventsCustom(ec, aid)
        : (_ec, aid) => exitEventsInteractive(aid),
    }
  }

  const t = task
  switch (kind) {
    case 'claude-code': return { cmd: 'cmd.exe', args: ['/c', 'claude', '-p', t], waitForPrompt: false, exitEvents: exitEventsNonInteractive }
    case 'codex':       return { cmd: 'cmd.exe', args: ['/c', 'codex',  t],    waitForPrompt: false, exitEvents: exitEventsNonInteractive }
    case 'opencode':    return { cmd: 'cmd.exe', args: ['/c', 'opencode', 'run', t], waitForPrompt: false, exitEvents: exitEventsNonInteractive }
  }
}

function getUnixStrategy(kind: AgentKind, hasTask: boolean, task: string): SpawnStrategy {
  if (!hasTask || kind === 'custom') {
    switch (kind) {
      case 'claude-code': return { cmd: 'claude',   args: [], waitForPrompt: false, exitEvents: (_ec, aid) => exitEventsInteractive(aid) }
      case 'codex':       return { cmd: 'codex',    args: [], waitForPrompt: false, exitEvents: (_ec, aid) => exitEventsInteractive(aid) }
      case 'opencode':    return { cmd: 'opencode', args: [], waitForPrompt: false, exitEvents: (_ec, aid) => exitEventsInteractive(aid) }
      case 'custom':      return { cmd: 'bash',     args: [], waitForPrompt: true,  exitEvents: exitEventsCustom }
    }
  }

  const t = task
  switch (kind) {
    case 'claude-code': return { cmd: 'claude',   args: ['-p', t],    waitForPrompt: false, exitEvents: exitEventsNonInteractive }
    case 'codex':       return { cmd: 'codex',    args: [t],          waitForPrompt: false, exitEvents: exitEventsNonInteractive }
    case 'opencode':    return { cmd: 'opencode', args: ['run', t],   waitForPrompt: false, exitEvents: exitEventsNonInteractive }
    default:            return { cmd: 'bash',     args: [],           waitForPrompt: false, exitEvents: (_ec, aid) => exitEventsInteractive(aid) }
  }
}

export async function spawnAgent(
  agentId: string,
  kind: AgentKind,
  worktreePath: string,
  task: string,
  port: number
): Promise<void> {
  const strategy = getSpawnStrategy(kind, task)

  const instance = pty.spawn(strategy.cmd, strategy.args, {
    name: 'xterm-256color',
    cols: 220,
    rows: 50,
    cwd: worktreePath,
    env: {
      ...process.env,
      PORT:          String(port),
      MC_AGENT_ID:   agentId,
      MC_SERVER_URL: `http://localhost:${process.env.MC_SERVER_PORT ?? 3000}`,
    } as Record<string, string>,
  })

  ptyInstances.set(agentId, instance)
  instance.onData((data: string) => appendBuffer(agentId, data))

  if (strategy.waitForPrompt) {
    await waitForPrompt(instance)
  }

  instance.onExit(({ exitCode }) => {
    const agent = agents.get(agentId)
    if (agent) {
      const newStatus = exitCode === 0 ? 'completed' : 'failed'
      agents.set(agentId, { ...agent, status: newStatus })
    }
    ptyInstances.delete(agentId)
    clearBuffer(agentId)
    for (const event of strategy.exitEvents(exitCode, agentId)) {
      broadcast(event)
    }
  })
}

function waitForPrompt(instance: pty.IPty): Promise<void> {
  const promptTimeoutMs = parseInt(process.env.MC_PROMPT_TIMEOUT_MS || '15000')
  return new Promise((resolve) => {
    const timeout    = setTimeout(resolve, promptTimeoutMs)
    const disposable = instance.onData((data: string) => {
      if (data.includes('$') || data.includes('>') || data.includes('%') || data.includes('❯')) {
        clearTimeout(timeout)
        disposable.dispose()
        resolve()
      }
    })
  })
}

export function killAgent(agentId: string): void {
  const instance = ptyInstances.get(agentId)
  if (instance) {
    instance.kill()
    ptyInstances.delete(agentId)
  }
}

export function writeToAgent(agentId: string, data: string): void {
  ptyInstances.get(agentId)?.write(data)
}

export function resizeAgent(agentId: string, cols: number, rows: number): void {
  ptyInstances.get(agentId)?.resize(cols, rows)
}
