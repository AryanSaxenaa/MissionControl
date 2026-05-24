import { WebSocketServer, WebSocket } from 'ws'
import type { IncomingMessage } from 'http'
import type { AgentRecord, IntentRecord } from './state.js'
import type { ConflictResult } from './services/conflict-detector.js'

export type WSEvent =
  | { type: 'agent:registered'; agent: AgentRecord }
  | { type: 'agent:heartbeat'; agentId: string; status: string; task?: string }
  | { type: 'agent:died'; agentId: string }
  | { type: 'context:ingested'; sourceId: string; agentId: string; scope: string; summary: string }
  | { type: 'intent:declared'; intent: IntentRecord }
  | { type: 'intent:updated'; intentId: string; status: IntentRecord['status'] }
  | { type: 'conflict:detected'; conflict: ConflictResult }
  | { type: 'conflict:resolved'; conflictId: string; resolution: string }
  | { type: 'decision:recorded'; sourceId: string; agentId: string; summary: string }
  | { type: 'failure:recorded'; sourceId: string; agentId: string; target: string; errorType: string }
  | { type: 'graph:snapshot'; superNodes: any[] }

const clients = new Set<WebSocket>()

export function attachWebSocketServer(server: any) {
  const wss = new WebSocketServer({ server, path: '/ws' })

  wss.on('connection', (ws: WebSocket, req: IncomingMessage) => {
    clients.add(ws)
    ws.on('close', () => clients.delete(ws))
    ws.on('error', () => clients.delete(ws))
  })
}

export function broadcast(event: WSEvent) {
  const payload = JSON.stringify(event)
  for (const client of clients) {
    if (client.readyState === WebSocket.OPEN) {
      try {
        client.send(payload)
      } catch {
        clients.delete(client)
      }
    }
  }
}
