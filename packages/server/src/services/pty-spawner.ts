import * as pty from 'node-pty'
import type { AgentKind } from '@missioncontrol/types'
import { broadcast } from '../ws-events.js'

export const ptyInstances = new Map<string, pty.IPty>()

// Tracks which agents are in Mode A (direct project, no worktree).
// These should never trigger ready-to-merge.
export const directModeAgents = new Set<string>()

const IS_WINDOWS = process.platform === 'win32'

/**
 * Spec Non-Negotiable #14: Task injected via PTY stdin after prompt detection.
 *
 * Windows spawning strategy:
 *   WITH task:    cmd /c <cli>  — cli runs, stdin injection works, exits when done.
 *                                 Exit code from cli propagates: 0=completed, else=died.
 *   WITHOUT task: cmd /k <cli>  — cmd stays alive after cli exits so the user can
 *                                 interact freely. When user closes it, cmd /k exits 0.
 *   custom:       cmd /k always — interactive shell, task injected as keystrokes.
 */
function buildSpawn(kind: AgentKind, hasTask: boolean): { cmd: string; args: string[]; keepAlive: boolean } {
  if (IS_WINDOWS) {
    const flag = (!hasTask || kind === 'custom') ? '/k' : '/c'
    const keepAlive = flag === '/k'
    switch (kind) {
      case 'claude-code': return { cmd: 'cmd.exe', args: [flag, 'claude'],   keepAlive }
      case 'codex':       return { cmd: 'cmd.exe', args: [flag, 'codex'],    keepAlive }
      case 'opencode':    return { cmd: 'cmd.exe', args: [flag, 'opencode'], keepAlive }
      case 'custom':      return { cmd: 'cmd.exe', args: ['/k'],             keepAlive: true }
    }
  }
  // Unix — always spawn CLI directly, no wrapper needed
  return {
    cmd:       kind === 'custom' ? 'bash' : kind === 'claude-code' ? 'claude' : kind,
    args:      [],
    keepAlive: !hasTask,   // no task = interactive = any exit is "completed"
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
  const hasTask = task.trim().length > 0
  const { cmd, args, keepAlive } = buildSpawn(kind, hasTask)

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
  // When task is non-empty: wait for prompt then write it as keystrokes.
  // When task is empty and custom shell: wait for prompt (gives user a clean prompt).
  // When task is empty and AI CLI: no injection — CLI is already in interactive mode.
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

    // keepAlive (cmd /k or interactive mode): user closed the session manually.
    // Any exit code is treated as a clean completion — it's a deliberate close.
    //
    // cmd /c with task: spec §5.1 binary — exit 0 = completed, non-zero = died.
    // A non-zero exit from cmd /c means the CLI itself errored (auth, crash, etc).
    const isClean = keepAlive ? true : exitCode === 0
    if (isClean) {
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
