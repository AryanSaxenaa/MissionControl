import { useEffect, useRef } from 'react'
import { useMissionControlStore } from '../store/useStore'

export function useEventSocket(serverUrl: string) {
  const store = useMissionControlStore()
  const wsRef = useRef<WebSocket | null>(null)
  const backoffRef = useRef(1000)

  function buildWsUrl(url: string): string {
    const u = new URL(url)
    u.protocol = u.protocol === 'https:' ? 'wss:' : 'ws:'
    u.pathname = '/ws'
    return u.toString()
  }

  function connect() {
    const ws = new WebSocket(buildWsUrl(serverUrl))
    wsRef.current = ws

    ws.onopen = () => {
      store.setEventsConnected(true)
      backoffRef.current = 1000
    }
    ws.onclose = () => {
      store.setEventsConnected(false)
      setTimeout(connect, backoffRef.current)
      backoffRef.current = Math.min(backoffRef.current * 2, 30000)
    }
    ws.onerror = () => ws.close()

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data)

        // Record timeline event for most message types
        if (['agent:spawned','agent:registered','agent:died','agent:completed','agent:heartbeat','intent:declared','decision:recorded','failure:recorded'].includes(msg.type)) {
          store.pushActivityEvent({
            timestamp: Date.now(),
            type: msg.type as any,
            agentId: msg.agentId ?? msg.agent?.id ?? '',
          })
        }

        switch (msg.type) {
          case 'agent:spawned':
          case 'agent:registered':
            store.upsertAgent(msg.agent)
            break
          case 'agent:heartbeat':
            store.updateAgentStatus(msg.agentId, msg.status as import('@missioncontrol/types').AgentRecord['status'], msg.task)
            break
          case 'agent:died':
            store.markAgentDead(msg.agentId)
            break
          case 'agent:spawn-failed':
            store.removeAgent(msg.agentId)
            console.error(`[mc] agent ${msg.agentId} failed to spawn:`, msg.error)
            break
          case 'agent:removed':
            store.removeAgent(msg.agentId)
            break
          case 'agent:completed':
            store.markAgentCompleted(msg.agentId)
            break
          case 'agent:ready-to-merge':
            store.addAgentPendingMerge(msg.agentId)
            break
          case 'permission:requested':
            store.addPermissionRequest({
              requestId: msg.requestId,
              agentId: msg.agentId,
              tool: msg.tool,
              target: msg.target,
              reason: msg.reason,
            })
            break
          case 'permission:resolved':
            store.removePermissionRequest(msg.requestId)
            break
          case 'intent:declared':
            store.upsertIntent(msg.intent)
            break
          case 'intent:updated':
            store.updateIntentStatus(msg.intentId, msg.status)
            break
          case 'conflict:detected':
            store.addConflict(msg.conflict)
            break
          case 'conflict:resolved':
            store.applyConflictResolved(msg.conflictId, msg.resolution)
            break
          case 'decision:recorded':
            store.addDecision({ sourceId: msg.sourceId, agentId: msg.agentId, summary: msg.summary, createdAt: Date.now() })
            break
          case 'failure:recorded':
            store.addFailure({ sourceId: msg.sourceId, agentId: msg.agentId, target: msg.target, errorType: msg.errorType, createdAt: Date.now() })
            break
          case 'graph:snapshot':
            store.setGraphData(msg)
            break
          case 'context:ingested':
            store.bumpContextIngest()
            break
        }
      } catch (e) {
        console.error('[WS] parse error', e)
      }
    }
  }

  useEffect(() => {
    connect()
    return () => wsRef.current?.close()
  }, [serverUrl])
}
