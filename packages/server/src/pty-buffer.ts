// Per-agent rolling output buffer. Capped at MAX_BYTES so new WS connections
// can replay recent terminal output without replaying the entire session.

const MAX_BYTES = 64 * 1024  // 64 KB per agent

const buffers = new Map<string, string>()

export function appendBuffer(agentId: string, data: string): void {
  const current = (buffers.get(agentId) ?? '') + data
  const byteLen = Buffer.byteLength(current, 'utf8')
  if (byteLen > MAX_BYTES) {
    // Strip from the front until we're under the limit
    let trimmed = current
    while (Buffer.byteLength(trimmed, 'utf8') > MAX_BYTES && trimmed.length > 0) {
      trimmed = trimmed.slice(1)
    }
    buffers.set(agentId, trimmed)
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
