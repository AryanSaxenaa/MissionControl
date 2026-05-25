import * as pty from 'node-pty'
import type { AgentKind } from '@missioncontrol/types'
import { broadcast } from '../ws-events.js'

export const ptyInstances = new Map<string, pty.IPty>()

// Tracks which agents are in Mode A (direct project, no worktree).
// These should never trigger ready-to-merge.
export const directModeAgents = new Set<string>()

const IS_WINDOWS = process.platform === 'win32'

/**
 * Spec Non-Negotiable #14: Task is injected via PTY stdin after prompt detection.
 * Not via CLI flags. Works universally for all agent kinds.
 *
 * Windows note: node-pty ConPTY does NOT resolve PATH. We spawn through cmd.exe
 * which resolves PATH correctly. cmd.exe /c passes its stdin through to the child
 * process, so writing to the PTY after the CLI prompt appears IS PTY stdin injection.
 *
 * All CLIs: launch → wait for prompt → write task as keystrokes via PTY stdin.
 * custom: same, but uses cmd /k (keep shell alive) instead of cmd /c.
 */
function buildSpawn(kind: AgentKind): { cmd: string; args: string[] } {
  if (IS_WINDOWS) {
    switch (kind) {
      case 'claude-code': return { cmd: 'cmd.exe', args: ['/c', 'claude']   }
      case 'codex':       return { cmd: 'cmd.exe', args: ['/c', 'codex']    }
      case 'opencode':    return { cmd: 'cmd.exe', args: ['/c', 'opencode'] }
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
  port: number,
  isDirectMode = false   // true = Mode A (user's project, no worktree)
): Promise<void> {
  if (isDirectMode) directModeAgents.add(agentId)
  const { cmd, args } = buildSpawn(kind)

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

  // Spec Non-Negotiable #14: inject task via PTY stdin after prompt detection.
  // Applies to all kinds (including claude-code, codex, opencode) when task is non-empty.
  // For custom shell we always wait for prompt (task may be empty = interactive mode).
  const hasTask = task.trim().length > 0
  if (hasTask || kind === 'custom') {
    await waitForPrompt(instance)
    if (hasTask) {
      await new Promise(r => setTimeout(r, 200))
      instance.write(task + '\r')
    }
  }

  instance.onExit(({ exitCode }) => {
    ptyInstances.delete(agentId)
    const isDirect = directModeAgents.has(agentId)
    directModeAgents.delete(agentId)

    // Spec §5.1: exit 0 → completed + ready-to-merge; non-zero → died.
    // Exception: claude-code, codex, opencode on Windows exit via cmd /c which
    // always returns the child's exit code. A non-zero exit on these CLIs means
    // the session genuinely errored (auth failure, crash) — broadcast agent:died.
    if (exitCode === 0) {
      broadcast({ type: 'agent:completed', agentId })
      if (!isDirect) {
        broadcast({ type: 'agent:ready-to-merge', agentId })
      }
    } else {
      broadcast({ type: 'agent:died', agentId })
    }
  })
}

/**
 * Wait up to 3s for a prompt character ($, >, %, ❯) to appear in the PTY output.
 * Used for all CLIs before injecting the task via stdin (spec §3 step 6, NNeg #14).
 */
function waitForPrompt(instance: pty.IPty): Promise<void> {
  return new Promise((resolve) => {
    const timeout    = setTimeout(resolve, 5000)
    const disposable = instance.onData((data: string) => {
      // Standard shells: $ > %   Claude Code: ❯   Codex/OpenCode: > or similar
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
