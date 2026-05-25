import { useEffect, useRef } from 'react'

// Terminal type imported lazily to avoid circular dep issues before xterm is installed
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function usePtySocket(agentId: string, term: any | null, serverUrl: string) {
  const wsRef = useRef<WebSocket | null>(null)

  useEffect(() => {
    if (!term) return

    const u = new URL(serverUrl)
    u.protocol = u.protocol === 'https:' ? 'wss:' : 'ws:'
    u.pathname = `/pty/${agentId}`
    const ws = new WebSocket(u.toString())
    wsRef.current = ws

    ws.onmessage = (e: MessageEvent) => {
      if (e.data instanceof ArrayBuffer) {
        term.write(new Uint8Array(e.data))
      } else {
        term.write(e.data as string)
      }
    }

    const dataDispose = term.onData((data: string) => {
      if (ws.readyState === WebSocket.OPEN) ws.send(data)
    })

    return () => {
      ws.close()
      dataDispose.dispose()
    }
  }, [agentId, term, serverUrl])

  return wsRef
}
