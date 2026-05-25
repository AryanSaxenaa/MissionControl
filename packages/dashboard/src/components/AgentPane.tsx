import { useEffect, useRef } from 'react'
import { HealthRing } from './HealthRing'

interface AgentPaneProps {
  agentId: string
  agentName: string
  status: string
  assignedPort: number
  colorIndex?: number
  onMergeClick: () => void
}

// Distinct accent colors per agent — cycles through the palette
const AGENT_COLORS = [
  '#f97316', // orange
  '#3b82f6', // blue
  '#a855f7', // purple
  '#10b981', // emerald
  '#f59e0b', // amber
  '#06b6d4', // cyan
  '#ec4899', // pink
  '#84cc16', // lime
] as const

const STATUS_TEXT: Record<string, string> = {
  active:    'text-orange-400',
  idle:      'text-yellow-400',
  failed:    'text-red-400',
  completed: 'text-green-400',
}

export function AgentPane({ agentId, agentName, status, assignedPort, colorIndex = 0, onMergeClick }: AgentPaneProps) {
  const termRef  = useRef<HTMLDivElement>(null)
  const xtermRef = useRef<any>(null)
  const fitRef   = useRef<any>(null)
  const wsRef    = useRef<WebSocket | null>(null)

  const accentColor = AGENT_COLORS[colorIndex % AGENT_COLORS.length]

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
          background:          '#000000',
          foreground:          '#d4d4d4',
          cursor:              accentColor,
          selectionBackground: `${accentColor}30`,
        },
        fontFamily:      '"JetBrains Mono", "Fira Mono", monospace',
        fontSize:        12,
        cursorBlink:     true,
        scrollback:      5000,
        allowProposedApi: true,
      })

      fitAddon = new FitAddon()
      term.loadAddon(fitAddon)
      xtermRef.current = term
      fitRef.current   = fitAddon

      if (termRef.current) {
        term.open(termRef.current)
        requestAnimationFrame(() => {
          fitAddon.fit()
          notifyPtyResize(term.cols, term.rows)
        })
        ro = new ResizeObserver(() => {
          try { fitAddon.fit(); notifyPtyResize(term.cols, term.rows) } catch { /* ignore */ }
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
      ws.onopen = () => notifyPtyResize(term.cols, term.rows)

      term.onData((data: string) => {
        if (ws.readyState === WebSocket.OPEN) ws.send(data)
      })
      term.onResize(({ cols, rows }: { cols: number; rows: number }) => {
        notifyPtyResize(cols, rows)
      })
    }

    function notifyPtyResize(cols: number, rows: number) {
      fetch(`/api/agents/${agentId}/resize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cols, rows }),
      }).catch(() => {})
    }

    init().catch(console.error)
    return () => { ro?.disconnect(); ws?.close(); term?.dispose() }
  }, [agentId])

  const textClass = STATUS_TEXT[status] ?? 'text-[#666]'

  return (
    <div
      className="flex flex-col overflow-hidden h-full bg-[#020202] transition-colors"
      style={{ border: `1px solid ${accentColor}40` }}
    >
      {/* Status bar — accent-colored top border */}
      <div
        className="flex items-center justify-between px-3 py-1.5 flex-shrink-0"
        style={{
          borderBottom: `1px solid ${accentColor}30`,
          background: `${accentColor}08`,
        }}
      >
        <div className="flex items-center gap-2">
          <HealthRing status={status} size={14} />
          <span
            className="text-xs font-mono font-medium truncate max-w-[140px]"
            style={{ color: accentColor }}
            title={agentName}
          >
            {agentName}
          </span>
          <span className={`text-[10px] uppercase tracking-wider ${textClass}`}>{status}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[#444] text-[10px] font-mono">:{assignedPort}</span>
          {(status === 'completed' || status === 'active') && (
            <button
              onClick={onMergeClick}
              className="px-2 py-0.5 text-[10px] uppercase tracking-wider transition-all"
              style={{
                border: `1px solid ${accentColor}`,
                color: accentColor,
                opacity: status === 'active' ? 0.6 : 1,
              }}
              onMouseEnter={e => { (e.target as HTMLElement).style.background = accentColor; (e.target as HTMLElement).style.color = '#000'; (e.target as HTMLElement).style.opacity = '1' }}
              onMouseLeave={e => { (e.target as HTMLElement).style.background = ''; (e.target as HTMLElement).style.color = accentColor; (e.target as HTMLElement).style.opacity = status === 'active' ? '0.6' : '1' }}
            >
              Review &amp; Merge
            </button>
          )}
        </div>
      </div>

      {/* Terminal */}
      <div ref={termRef} className="flex-1 min-h-0 overflow-hidden bg-black" />
    </div>
  )
}
