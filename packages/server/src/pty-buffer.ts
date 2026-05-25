// Per-agent rolling output buffer. Capped at MAX_BYTES so new WS connections
// can replay recent terminal output without replaying the entire session.

const MAX_BYTES = 64 * 1024  // 64 KB per agent

const buffers = new Map<string, string>()

export function appendBuffer(agentId: string, data: string): void {
  const current = (buffers.get(agentId) ?? '') + data
  if (current.length > MAX_BYTES) {
    buffers.set(agentId, current.slice(current.length - MAX_BYTES))
  } else {
    buffers.set(agentId, current)
  }
}

export function getBuffer(agentId: string): string {
  return buffers.get(agentId) ?? ''
}

export function clearBuffer(agentId: string): void {
  buffers.delete(agentId)
}
