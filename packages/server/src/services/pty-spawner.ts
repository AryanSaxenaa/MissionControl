import * as pty from 'node-pty'
import type { AgentKind } from '@missioncontrol/types'
import { broadcast } from '../ws-events.js'

// Maps agentId → pty instance
export const ptyInstances = new Map<string, pty.IPty>()

const IS_WINDOWS = process.platform === 'win32'

// On Windows, npm-installed CLIs are .cmd wrapper scripts and cannot be spawned
// directly by node-pty. We must invoke them via cmd.exe.
function resolveSpawn(cmd: string, args: string[]): { cmd: string; args: string[] } {
  if (IS_WINDOWS) {
    return { cmd: 'cmd.exe', args: ['/c', cmd, ...args] }
  }
  return { cmd, args }
}

// Raw command names — resolveSpawn is applied once at spawn time
const CLI_COMMANDS: Record<AgentKind, { cmd: string; args: string[] }> = {
  'claude-code': { cmd: 'claude',   args: [] },
  'codex':       { cmd: 'codex',    args: [] },
  'opencode':    { cmd: 'opencode', args: [] },
  'custom':      { cmd: IS_WINDOWS ? 'cmd.exe' : 'bash', args: [] },
}

export async function spawnAgent(
  agentId: string,
  kind: AgentKind,
  worktreePath: string,
  task: string,
  port: number
): Promise<void> {
  // custom kind already resolves to the shell directly; others need wrapping on Windows
  const raw = CLI_COMMANDS[kind]
  const { cmd, args } = (kind === 'custom') ? raw : resolveSpawn(raw.cmd, raw.args)

  const instance = pty.spawn(cmd, args, {
    name: 'xterm-256color',
    cols: 220,
    rows: 50,
    cwd: worktreePath,
    env: {
      ...process.env,
      PORT: String(port),
      MC_AGENT_ID: agentId,
      MC_SERVER_URL: `http://localhost:${process.env.MC_SERVER_PORT ?? 3000}`,
    } as Record<string, string>,
  })

  ptyInstances.set(agentId, instance)

  await waitForPrompt(instance)
  await injectTask(instance, task)

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

function waitForPrompt(instance: pty.IPty): Promise<void> {
  return new Promise((resolve) => {
    const timeout = setTimeout(resolve, 3000)
    const disposable = instance.onData((data: string) => {
      if (data.includes('$') || data.includes('>') || data.includes('%')) {
        clearTimeout(timeout)
        disposable.dispose()
        resolve()
      }
    })
  })
}

async function injectTask(instance: pty.IPty, task: string): Promise<void> {
  await new Promise(r => setTimeout(r, 200))
  instance.write(task + '\r')
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
