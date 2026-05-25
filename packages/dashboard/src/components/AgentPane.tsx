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

const AGENT_COLORS = [
  '#f97316',
  '#3b82f6',
  '#a855f7',
  '#10b981',
  '#f59e0b',
  '#06b6d4',
  '#ec4899',
  '#84cc16',
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
    // Track cancellation so async init doesn't use stale closures.
    // React StrictMode (and any unmount/remount) fires cleanup synchronously
    // before init() resolves — without this guard the old WS is never closed,
    // leaving two subscribers on the same PTY so every keystroke reaches both.
    let cancelled = false
    const cleanups: Array<() => void> = []

    async function init() {
      const { Terminal } = await import('@xterm/xterm')
      if (cancelled) return

      const { FitAddon } = await import('@xterm/addon-fit')
      if (cancelled) return

      await import('@xterm/xterm/css/xterm.css')
      if (cancelled) return

      const term = new Terminal({
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
      cleanups.push(() => term.dispose())

      const fitAddon = new FitAddon()
      term.loadAddon(fitAddon)
      xtermRef.current = term
      fitRef.current   = fitAddon

      if (!termRef.current || cancelled) return
      term.open(termRef.current)

      requestAnimationFrame(() => {
        if (cancelled) return
        fitAddon.fit()
        notifyPtyResize(term.cols, term.rows)
      })

      const ro = new ResizeObserver(() => {
        if (cancelled) return
        try { fitAddon.fit(); notifyPtyResize(term.cols, term.rows) } catch { /* ignore */ }
      })
      ro.observe(termRef.current)
      cleanups.push(() => ro.disconnect())

      if (cancelled) return

      const u    = new URL(window.location.href)
      u.protocol = u.protocol === 'https:' ? 'wss:' : 'ws:'
      u.pathname = `/pty/${agentId}`
      const ws   = new WebSocket(u.toString())
      wsRef.current = ws
      cleanups.push(() => {
        wsRef.current = null
        if (ws.readyState !== WebSocket.CLOSED) ws.close()
      })

      ws.binaryType = 'arraybuffer'
      ws.onmessage = (e: MessageEvent) => {
        if (e.data instanceof ArrayBuffer) term.write(new Uint8Array(e.data))
        else term.write(e.data as string)
      }
      ws.onopen = () => notifyPtyResize(term.cols, term.rows)

      term.onData((data: string) => {
        if (!cancelled && ws.readyState === WebSocket.OPEN) ws.send(data)
      })
      term.onResize(({ cols, rows }: { cols: number; rows: number }) => {
        if (!cancelled) notifyPtyResize(cols, rows)
      })
    }

    function notifyPtyResize(cols: number, rows: number) {
      if (cancelled) return
      fetch(`/api/agents/${agentId}/resize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cols, rows }),
      }).catch(() => {})
    }

    init().catch(console.error)

    return () => {
      cancelled = true
      cleanups.forEach(fn => fn())
    }
  }, [agentId])

  const textClass = STATUS_TEXT[status] ?? 'text-[#666]'

  return (
    <div
      className="flex flex-col overflow-hidden h-full bg-[#020202] transition-colors"
      style={{ border: `1px solid ${accentColor}40` }}
    >
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

      <div ref={termRef} className="flex-1 min-h-0 overflow-hidden bg-black" />
    </div>
  )
}
