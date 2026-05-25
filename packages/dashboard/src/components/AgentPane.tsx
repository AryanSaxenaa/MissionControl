import { useEffect, useRef } from 'react'

interface AgentPaneProps {
  agentId: string
  agentName: string
  status: string
  assignedPort: number
  onMergeClick: () => void
}

function HealthRing({ status }: { status: string }) {
  const colors: Record<string, string> = {
    active: '#00ff88',
    idle: '#ffaa00',
    failed: '#ff3355',
    completed: '#4488ff',
  }
  const color = colors[status] ?? '#7a8099'
  return (
    <span
      style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }}
    />
  )
}

export function AgentPane({ agentId, agentName, status, assignedPort, onMergeClick }: AgentPaneProps) {
  const termRef = useRef<HTMLDivElement>(null)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const xtermRef = useRef<any>(null)
  const wsRef = useRef<WebSocket | null>(null)


  useEffect(() => {
    let term: any
    let fitAddon: any
    let ws: WebSocket

    async function init() {
      const { Terminal } = await import('@xterm/xterm')
      const { FitAddon } = await import('@xterm/addon-fit')
      await import('@xterm/xterm/css/xterm.css')

      term = new Terminal({
        theme: { background: '#0a0b0d', foreground: '#e8eaf0', cursor: '#00ff88' },
        fontFamily: '"JetBrains Mono", monospace',
        fontSize: 13,
        cursorBlink: true,
      })
      fitAddon = new FitAddon()
      term.loadAddon(fitAddon)
      if (termRef.current) {
        term.open(termRef.current)
        fitAddon.fit()
      }
      xtermRef.current = term

      const u = new URL(window.location.href)
      u.protocol = u.protocol === 'https:' ? 'wss:' : 'ws:'
      u.pathname = `/pty/${agentId}`
      ws = new WebSocket(u.toString())
      wsRef.current = ws

      ws.binaryType = 'arraybuffer'
      ws.onmessage = (e: MessageEvent) => {
        if (e.data instanceof ArrayBuffer) {
          term.write(new Uint8Array(e.data))
        } else {
          term.write(e.data as string)
        }
      }
      term.onData((data: string) => {
        if (ws.readyState === WebSocket.OPEN) ws.send(data)
      })
    }

    init().catch(console.error)

    return () => {
      ws?.close()
      term?.dispose()
    }
  }, [agentId])

  const statusColor: Record<string, string> = {
    active: 'text-[#00ff88]',
    idle: 'text-[#ffaa00]',
    failed: 'text-[#ff3355]',
    completed: 'text-[#4488ff]',
  }
  const textColor = statusColor[status] ?? 'text-[#7a8099]'

  return (
    <div className="flex flex-col bg-[#111318] border border-[#1e2330] rounded-lg overflow-hidden h-full">
      {/* Status bar */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-[#1a1d24] border-b border-[#1e2330] flex-shrink-0">
        <div className="flex items-center gap-2">
          <HealthRing status={status} />
          <span className="text-[#e8eaf0] text-sm font-mono">{agentName}</span>
          <span className={`text-xs ${textColor}`}>{status}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[#4a5066] text-xs">:{assignedPort}</span>
          {status === 'completed' && (
            <button
              onClick={onMergeClick}
              className="px-2 py-0.5 text-xs bg-[#00ff88] text-[#0a0b0d] rounded font-mono hover:bg-[#00cc6a]"
            >
              Review &amp; Merge
            </button>
          )}
        </div>
      </div>

      {/* Terminal */}
      <div ref={termRef} className="flex-1 min-h-0 p-1 overflow-hidden" />
    </div>
  )
}
