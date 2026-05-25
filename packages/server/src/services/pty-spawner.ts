import * as pty from 'node-pty'
import type { AgentKind } from '@missioncontrol/types'
import { broadcast } from '../ws-events.js'

// Maps agentId → pty instance
export const ptyInstances = new Map<string, pty.IPty>()

const CLI_COMMANDS: Record<AgentKind, { cmd: string; args: string[] }> = {
  'claude-code': { cmd: 'claude', args: [] },
  'codex':       { cmd: 'codex', args: [] },
  'opencode':    { cmd: 'opencode', args: [] },
  'custom':      { cmd: 'bash', args: [] },
}

export async function spawnAgent(
  agentId: string,
  kind: AgentKind,
  worktreePath: string,
  task: string,
  port: number
): Promise<void> {
  const { cmd, args } = CLI_COMMANDS[kind]

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
