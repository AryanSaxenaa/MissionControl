import * as pty from 'node-pty'
import type { AgentKind } from '@missioncontrol/types'
import { broadcast } from '../ws-events.js'

export const ptyInstances = new Map<string, pty.IPty>()

const IS_WINDOWS = process.platform === 'win32'

/**
 * node-pty on Windows (ConPTY) does NOT resolve PATH — it requires
 * either a full executable path or going through cmd.exe which does
 * resolve PATH. We always use cmd.exe /c on Windows so PATH resolution
 * works for both real .exe files and .cmd/.ps1 wrappers.
 *
 * Task delivery strategy per CLI:
 *   claude-code  →  cmd /c claude  "task"   (task as positional arg)
 *   codex        →  cmd /c codex   "task"   (task as positional arg)
 *   opencode     →  cmd /c opencode run "task"
 *   custom       →  cmd /k          (interactive shell; task injected as keystrokes)
 */
function buildSpawn(
  kind: AgentKind,
  task: string
): { cmd: string; args: string[]; injectTask: boolean } {
  if (IS_WINDOWS) {
    switch (kind) {
      case 'claude-code':
        return { cmd: 'cmd.exe', args: ['/c', 'claude', task],           injectTask: false }
      case 'codex':
        return { cmd: 'cmd.exe', args: ['/c', 'codex', task],            injectTask: false }
      case 'opencode':
        return { cmd: 'cmd.exe', args: ['/c', 'opencode', 'run', task],  injectTask: false }
      case 'custom':
        // /k keeps the shell alive after the injected command runs
        return { cmd: 'cmd.exe', args: ['/k'],                           injectTask: true  }
    }
  }

  // Unix
  switch (kind) {
    case 'claude-code': return { cmd: 'claude',   args: [task],          injectTask: false }
    case 'codex':       return { cmd: 'codex',    args: [task],          injectTask: false }
    case 'opencode':    return { cmd: 'opencode', args: ['run', task],   injectTask: false }
    case 'custom':      return { cmd: 'bash',     args: [],              injectTask: true  }
  }
}

export async function spawnAgent(
  agentId: string,
  kind: AgentKind,
  worktreePath: string,
  task: string,
  port: number
): Promise<void> {
  const { cmd, args, injectTask } = buildSpawn(kind, task)

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

  // Custom interactive shell: wait for a prompt then inject the task as keystrokes
  if (injectTask) {
    await waitForShellPrompt(instance)
    await new Promise(r => setTimeout(r, 200))
    instance.write(task + '\r')
  }

  instance.onExit(({ exitCode }) => {
    ptyInstances.delete(agentId)
    if (exitCode === 0) {
      broadcast({ type: 'agent:completed', agentId })
      broadcast({ type: 'agent:ready-to-merge', agentId })
    } else {
      broadcast({ type: 'agent:died', agentId })
    }
  })
}

/** Wait for a shell prompt ($, >, %) — only used for custom interactive shells. */
function waitForShellPrompt(instance: pty.IPty): Promise<void> {
  return new Promise((resolve) => {
    const timeout    = setTimeout(resolve, 5000)
    const disposable = instance.onData((data: string) => {
      if (data.includes('$') || data.includes('>') || data.includes('%')) {
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
