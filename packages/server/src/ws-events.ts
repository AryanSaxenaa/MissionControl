import { WebSocketServer, WebSocket } from 'ws'
import type { IncomingMessage } from 'http'
import type { Duplex } from 'stream'
import type { AgentRecord, IntentRecord, ConflictResult, WSEvent } from '@missioncontrol/types'

const clients = new Set<WebSocket>()
const eventsWss = new WebSocketServer({ noServer: true })

eventsWss.on('connection', (ws: WebSocket) => {
  clients.add(ws)
  ws.on('close', () => clients.delete(ws))
  ws.on('error', () => clients.delete(ws))
})

export function handleEventsUpgrade(
  request: IncomingMessage,
  socket: Duplex,
  head: Buffer
) {
  eventsWss.handleUpgrade(request, socket, head, (ws) => {
    eventsWss.emit('connection', ws)
  })
}

export function broadcast(event: WSEvent) {
  const payload = JSON.stringify(event)
  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) {
      try { client.send(payload) } catch { clients.delete(client) }
    }
  }
}
