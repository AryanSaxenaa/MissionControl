import path from 'path'
import fs from 'fs/promises'

const PORT_START = 3100
const PORT_MAX   = 49151
const portMap = new Map<string, number>()
const usedPorts = new Set<number>()

export function assignPort(agentId: string): number {
  let port = PORT_START
  while (usedPorts.has(port) && port < PORT_MAX) port++
  if (port >= PORT_MAX) {
    throw new Error(`port registry exhausted: reached ${PORT_MAX}. Too many concurrent agents.`)
  }
  portMap.set(agentId, port)
  usedPorts.add(port)
  return port
}

export function releasePort(agentId: string): void {
  const port = portMap.get(agentId)
  if (port) {
    usedPorts.delete(port)
    portMap.delete(agentId)
  }
}

export async function injectPortEnv(worktreePath: string, port: number): Promise<void> {
  const envPath = path.join(worktreePath, '.env')
  let existing = ''
  try { existing = await fs.readFile(envPath, 'utf8') } catch {}

  const lines = existing.split('\n').filter(l => !l.startsWith('PORT='))
  lines.push(`PORT=${port}`)
  await fs.writeFile(envPath, lines.join('\n'))
}
