import { useEffect, useRef } from 'react'
import { useMissionControlStore } from '../store/useStore'

export function useWebSocket(serverUrl: string) {
  const store = useMissionControlStore()
  const wsRef = useRef<WebSocket | null>(null)
  const backoffRef = useRef(1000)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const urlRef = useRef(serverUrl)
  urlRef.current = serverUrl

  function buildWsUrl(url: string): string | null {
    try {
      const u = new URL(url)
      u.protocol = u.protocol === 'https:' ? 'wss:' : 'ws:'
      u.pathname = '/ws'
      return u.toString()
    } catch {
      console.error('[WS] Invalid server URL:', url)
      return null
    }
  }

  function connect() {
    const wsUrl = buildWsUrl(urlRef.current)
    if (!wsUrl) return
    const ws = new WebSocket(wsUrl)
    wsRef.current = ws

    ws.onopen = () => {
      store.setWsConnected(true)
      backoffRef.current = 1000
    }

    ws.onclose = () => {
      store.setWsConnected(false)
      timerRef.current = setTimeout(() => connect(), backoffRef.current)
      backoffRef.current = Math.min(backoffRef.current * 2, 30000)
    }

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data)
        switch (msg.type) {
          case 'agent:registered':
            store.updateAgent(msg.agent); break
          case 'agent:heartbeat':
            store.updateAgentHeartbeat(msg.agentId, msg.status, msg.task); break
          case 'agent:died':
            store.markAgentDead(msg.agentId); break
          case 'intent:declared':
            store.upsertIntent(msg.intent); break
          case 'intent:updated':
            store.updateIntentStatus(msg.intentId, msg.status); break
          case 'conflict:detected':
            store.addConflict(msg.conflict); break
          case 'conflict:resolved':
            store.applyConflictResolved(msg.conflictId, msg.resolution); break
          case 'decision:recorded':
            store.addDecision(msg); break
          case 'failure:recorded':
            store.addFailure(msg); break
          case 'graph:snapshot':
            store.setGraphData(msg); break
          case 'context:ingested':
            fetch('/api/graph').then(r => r.json()).then(d => store.setGraphData(d))
            break
        }
      } catch (e) {
        console.error('[WS] Failed to parse message', e)
      }
    }
  }

  useEffect(() => {
    connect()
    return () => {
      wsRef.current?.close()
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [serverUrl])
}
