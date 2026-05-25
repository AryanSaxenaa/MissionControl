import { WebSocketServer, WebSocket } from 'ws'
import type { IncomingMessage } from 'http'
import type { Duplex } from 'stream'
import { ptyInstances } from './services/pty-spawner.js'

const ptyWss = new WebSocketServer({ noServer: true })

ptyWss.on('connection', (ws: WebSocket, agentId: string) => {
  const pty = ptyInstances.get(agentId)
  if (!pty) { ws.close(); return }

  // Server → client: terminal output bytes
  const disposable = pty.onData((data: string) => {
    if (ws.readyState === WebSocket.OPEN) ws.send(data)
  })

  // Client → server: keystrokes from xterm.js
  ws.on('message', (data) => {
    pty.write(data.toString())
  })

  ws.on('close', () => disposable.dispose())
  ws.on('error', () => disposable.dispose())
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
