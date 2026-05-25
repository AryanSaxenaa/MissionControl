import { WebSocketServer, WebSocket } from 'ws'
import type { IncomingMessage } from 'http'
import type { Duplex } from 'stream'
import type { AgentRecord, IntentRecord, ConflictResult } from '@missioncontrol/types'

export type WSEvent =
  | { type: 'agent:spawned'; agent: AgentRecord }
  | { type: 'agent:registered'; agent: AgentRecord }
  | { type: 'agent:heartbeat'; agentId: string; status: string; task?: string }
  | { type: 'agent:died'; agentId: string }
  | { type: 'agent:completed'; agentId: string }
  | { type: 'agent:ready-to-merge'; agentId: string }
  | { type: 'permission:requested'; agentId: string; requestId: string; tool: string; target: string; reason: string }
  | { type: 'permission:resolved'; agentId: string; requestId: string; decision: 'allow' | 'deny' }
  | { type: 'intent:declared'; intent: IntentRecord }
  | { type: 'intent:updated'; intentId: string; status: IntentRecord['status'] }
  | { type: 'conflict:detected'; conflict: ConflictResult }
  | { type: 'conflict:resolved'; conflictId: string; resolution: string }
  | { type: 'context:ingested'; sourceId: string; agentId: string; scope: string; summary?: string }
  | { type: 'decision:recorded'; sourceId: string; agentId: string; summary: string }
  | { type: 'failure:recorded'; sourceId: string; agentId: string; target: string; errorType: string }
  | { type: 'graph:snapshot'; superNodes: any[] }

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
