import { useEffect, useRef } from 'react'

interface AgentPaneProps {
  agentId: string
  agentName: string
  status: string
  assignedPort: number
  onMergeClick: () => void
}

const STATUS_DOT: Record<string, string> = {
  active:    'bg-orange-500 animate-pulse',
  idle:      'bg-yellow-500',
  failed:    'bg-red-500',
  completed: 'bg-green-500',
}
const STATUS_TEXT: Record<string, string> = {
  active:    'text-orange-500',
  idle:      'text-yellow-500',
  failed:    'text-red-500',
  completed: 'text-green-500',
}

export function AgentPane({ agentId, agentName, status, assignedPort, onMergeClick }: AgentPaneProps) {
  const termRef  = useRef<HTMLDivElement>(null)
  const xtermRef = useRef<any>(null)
  const fitRef   = useRef<any>(null)
  const wsRef    = useRef<WebSocket | null>(null)

  useEffect(() => {
    let term: any
    let fitAddon: any
    let ws: WebSocket
    let ro: ResizeObserver | null = null

    async function init() {
      const { Terminal } = await import('@xterm/xterm')
      const { FitAddon } = await import('@xterm/addon-fit')
      await import('@xterm/xterm/css/xterm.css')

      term = new Terminal({
        theme: {
          background:         '#000000',
          foreground:         '#d4d4d4',
          cursor:             '#f97316',
          selectionBackground:'#f9731640',
        },
        fontFamily:     '"JetBrains Mono", "Fira Mono", monospace',
        fontSize:       13,
        cursorBlink:    true,
        scrollback:     5000,
        allowProposedApi: true,
      })

      fitAddon = new FitAddon()
      term.loadAddon(fitAddon)
      xtermRef.current = term
      fitRef.current   = fitAddon

      if (termRef.current) {
        term.open(termRef.current)

        // Initial fit — defer one frame so the DOM has rendered
        requestAnimationFrame(() => {
          fitAddon.fit()
          notifyPtyResize(term.cols, term.rows)
        })

        // Re-fit whenever the container size changes
        ro = new ResizeObserver(() => {
          try {
            fitAddon.fit()
            notifyPtyResize(term.cols, term.rows)
          } catch { /* ignore mid-unmount errors */ }
        })
        ro.observe(termRef.current)
      }

      const u    = new URL(window.location.href)
      u.protocol = u.protocol === 'https:' ? 'wss:' : 'ws:'
      u.pathname = `/pty/${agentId}`
      ws         = new WebSocket(u.toString())
      wsRef.current = ws

      ws.binaryType = 'arraybuffer'
      ws.onmessage = (e: MessageEvent) => {
        if (e.data instanceof ArrayBuffer) term.write(new Uint8Array(e.data))
        else term.write(e.data as string)
      }
      ws.onopen = () => {
        // Sync PTY size with actual terminal once connected
        notifyPtyResize(term.cols, term.rows)
      }

      term.onData((data: string) => {
        if (ws.readyState === WebSocket.OPEN) ws.send(data)
      })

      // When user resizes the terminal, tell PTY server
      term.onResize(({ cols, rows }: { cols: number; rows: number }) => {
        notifyPtyResize(cols, rows)
      })
    }

    function notifyPtyResize(cols: number, rows: number) {
      // POST to server so it can call pty.resize(cols, rows)
      fetch(`/api/agents/${agentId}/resize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cols, rows }),
      }).catch(() => {})
    }

    init().catch(console.error)

    return () => {
      ro?.disconnect()
      ws?.close()
      term?.dispose()
    }
  }, [agentId])

  const dotClass  = STATUS_DOT[status]  ?? 'bg-[#555]'
  const textClass = STATUS_TEXT[status] ?? 'text-[#888]'

  return (
    <div className="flex flex-col border border-[#171717] bg-[#020202] overflow-hidden h-full hover:border-[#2a2a2a] transition-colors">

      {/* Status bar */}
      <div className="flex items-center justify-between px-4 py-2 border-b border-[#171717] flex-shrink-0">
        <div className="flex items-center gap-3">
          <span className={`w-2 h-2 rounded-full ${dotClass}`} />
          <span className="text-white text-sm font-mono">{agentName}</span>
          <span className={`text-xs uppercase tracking-wider ${textClass}`}>{status}</span>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-[#444] text-xs">:{assignedPort}</span>
          {status === 'completed' && (
            <button
              onClick={onMergeClick}
              className="px-3 py-1 text-xs border border-orange-500 text-orange-500 hover:bg-orange-500 hover:text-black uppercase tracking-wider transition-all"
            >
              Review &amp; Merge
            </button>
          )}
        </div>
      </div>

      {/* Terminal — fills remaining height, scroll handled by xterm */}
      <div ref={termRef} className="flex-1 min-h-0 overflow-hidden bg-black" />
    </div>
  )
}
