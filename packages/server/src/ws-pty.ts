import { WebSocketServer, WebSocket } from 'ws'
import type { IncomingMessage } from 'http'
import type { Duplex } from 'stream'
import { ptyInstances } from './services/pty-spawner.js'
import { getBuffer } from './pty-buffer.js'

const ptyWss = new WebSocketServer({ noServer: true })

ptyWss.on('connection', (ws: WebSocket, agentId: string) => {
  const pty = ptyInstances.get(agentId)
  if (!pty) { ws.close(); return }

  // Replay buffered output so the user sees what happened before this connection
  const buffered = getBuffer(agentId)
  if (buffered && ws.readyState === WebSocket.OPEN) ws.send(buffered)

  // Server → client: terminal output bytes
  const dataDisposable = pty.onData((data: string) => {
    if (ws.readyState === WebSocket.OPEN) ws.send(data)
  })

  // When the PTY process exits, close the WS so xterm.js shows the session ended
  const exitDisposable = pty.onExit(() => {
    dataDisposable.dispose()
    exitDisposable.dispose()
    if (ws.readyState === WebSocket.OPEN) ws.close()
  })

  // Client → server: keystrokes from xterm.js (guard against dead PTY)
  ws.on('message', (data) => {
    if (ptyInstances.has(agentId)) pty.write(data.toString())
  })

  ws.on('close', () => {
    dataDisposable.dispose()
    exitDisposable.dispose()
  })
  ws.on('error', () => {
    dataDisposable.dispose()
    exitDisposable.dispose()
  })
})

export function handlePtyUpgrade(
  request: IncomingMessage,
  socket: Duplex,
  head: Buffer
) {
  const agentId = request.url?.split('/pty/')[1]
  if (!agentId) { socket.destroy(); return }

  ptyWss.handleUpgrade(request, socket, head, (ws) => {
    ptyWss.emit('connection', ws, agentId)
  })
}
