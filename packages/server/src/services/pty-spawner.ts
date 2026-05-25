import * as pty from 'node-pty'
import type { AgentKind } from '@missioncontrol/types'
import { broadcast } from '../ws-events.js'
import { appendBuffer, clearBuffer } from '../pty-buffer.js'

export const ptyInstances = new Map<string, pty.IPty>()

const IS_WINDOWS = process.platform === 'win32'

/**
 * Two spawn modes:
 *
 * WITH task → non-interactive: pass task via CLI flag so the process exits
 *   when done. This triggers onExit → agent:completed → "Review & Merge".
 *   claude-code: `claude -p "<task>"`
 *   codex:       `codex "<task>"`          (positional arg, exits after run)
 *   opencode:    `opencode run "<task>"`   (run subcommand, exits after run)
 *
 * WITHOUT task → interactive TUI: user types freely. Process stays alive.
 *   Status stays `active` until user exits the TUI manually. The
 *   "Review & Merge" button is always visible so the user can trigger
 *   merge whenever they're satisfied.
 *
 * Windows: node-pty ConPTY doesn't resolve PATH — wrap everything in cmd.exe.
 *   /c = run then exit (used for non-interactive task runs)
 *   /k = run then keep alive (used for interactive sessions)
 */
function buildSpawn(kind: AgentKind, task: string): { cmd: string; args: string[] } {
  const hasTask = task.trim().length > 0

  if (IS_WINDOWS) {
    if (!hasTask || kind === 'custom') {
      // Interactive / custom shell — stay alive
      const cli = kind === 'custom' ? '' : kind === 'claude-code' ? 'claude' : kind === 'codex' ? 'codex' : 'opencode'
      return { cmd: 'cmd.exe', args: kind === 'custom' ? ['/k'] : ['/k', cli] }
    }
    // Non-interactive: pass task via CLI flag, process exits when done
    switch (kind) {
      case 'claude-code': return { cmd: 'cmd.exe', args: ['/c', 'claude', '-p', task] }
      case 'codex':       return { cmd: 'cmd.exe', args: ['/c', 'codex',  task] }
      case 'opencode':    return { cmd: 'cmd.exe', args: ['/c', 'opencode', 'run', task] }
    }
  }

  if (!hasTask || kind === 'custom') {
    switch (kind) {
      case 'claude-code': return { cmd: 'claude',   args: [] }
      case 'codex':       return { cmd: 'codex',    args: [] }
      case 'opencode':    return { cmd: 'opencode', args: [] }
      case 'custom':      return { cmd: 'bash',     args: [] }
    }
  }
  // Non-interactive on Linux/Mac
  switch (kind) {
    case 'claude-code': return { cmd: 'claude',   args: ['-p', task] }
    case 'codex':       return { cmd: 'codex',    args: [task] }
    case 'opencode':    return { cmd: 'opencode', args: ['run', task] }
    default:            return { cmd: 'bash',     args: [] }
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
  const { cmd, args }  = buildSpawn(kind, task)

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

  // Interactive custom shells: wait for prompt before injecting nothing
  // (kept so custom agents get their PTY warmed up before user types)
  if (!hasTask && kind === 'custom') {
    await waitForPrompt(instance)
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
