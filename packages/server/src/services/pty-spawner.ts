import * as pty from 'node-pty'
import type { AgentKind } from '@missioncontrol/types'
import { broadcast } from '../ws-events.js'
import { appendBuffer, clearBuffer } from '../pty-buffer.js'

export const ptyInstances = new Map<string, pty.IPty>()

const IS_WINDOWS = process.platform === 'win32'

/**
 * Spec Non-Negotiable #14: Task injected via PTY stdin after prompt detection.
 * Not via CLI flags. Works universally for all agent kinds.
 *
 * Windows: node-pty ConPTY doesn't resolve PATH. We go through cmd.exe.
 *   WITH task:    cmd /c <cli>  — cli runs, task injected via stdin, exits.
 *   WITHOUT task: cmd /k <cli>  — keeps cmd alive for free-form interactive use.
 *   custom:       cmd /k always (interactive shell).
 *
 * There is ONE mode now. Every agent always has a git worktree. The agent
 * works in the worktree. When it exits, Review & Merge is offered.
 */
function buildSpawn(kind: AgentKind, hasTask: boolean): { cmd: string; args: string[] } {
  if (IS_WINDOWS) {
    const flag = (!hasTask || kind === 'custom') ? '/k' : '/c'
    switch (kind) {
      case 'claude-code': return { cmd: 'cmd.exe', args: [flag, 'claude']   }
      case 'codex':       return { cmd: 'cmd.exe', args: [flag, 'codex']    }
      case 'opencode':    return { cmd: 'cmd.exe', args: [flag, 'opencode'] }
      case 'custom':      return { cmd: 'cmd.exe', args: ['/k']             }
    }
  }
  switch (kind) {
    case 'claude-code': return { cmd: 'claude',   args: [] }
    case 'codex':       return { cmd: 'codex',    args: [] }
    case 'opencode':    return { cmd: 'opencode', args: [] }
    case 'custom':      return { cmd: 'bash',     args: [] }
  }
}

export async function spawnAgent(
  agentId: string,
  kind: AgentKind,
  worktreePath: string,
  task: string,
  port: number
): Promise<void> {
  const hasTask        = task.trim().length > 0
  const { cmd, args }  = buildSpawn(kind, hasTask)

  const instance = pty.spawn(cmd, args, {
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

  // Buffer all output for playback when a new WebSocket connects mid-session
  instance.onData((data: string) => appendBuffer(agentId, data))

  // Spec NNeg #14: inject task via PTY stdin after prompt detection.
  if (hasTask || kind === 'custom') {
    await waitForPrompt(instance)
    if (hasTask) {
      await new Promise(r => setTimeout(r, 200))
      instance.write(task + '\r')
    }
  }

  instance.onExit(({ exitCode }) => {
    ptyInstances.delete(agentId)
    clearBuffer(agentId)

    if (kind === 'custom') {
      // Shell scripts: exit 0 = success, non-zero = error.
      if (exitCode === 0) {
        broadcast({ type: 'agent:completed', agentId })
        broadcast({ type: 'agent:ready-to-merge', agentId })
      } else {
        broadcast({ type: 'agent:died', agentId })
      }
    } else {
      // AI TUIs always exit non-zero. Any exit = session closed by user.
      // Always offer Review & Merge — the worktree has the agent's changes.
      broadcast({ type: 'agent:completed', agentId })
      broadcast({ type: 'agent:ready-to-merge', agentId })
    }
  })
}

/**
 * Wait up to 5s for a prompt character to appear.
 * Spec §3: "waits for prompt to appear" before injecting task.
 */
function waitForPrompt(instance: pty.IPty): Promise<void> {
  return new Promise((resolve) => {
    const timeout    = setTimeout(resolve, 5000)
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
