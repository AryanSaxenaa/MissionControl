import { interpolate, useCurrentFrame } from 'remotion'
import { T } from '../theme'
import { FadeUp, GridBg, SectionLabel, TypeWriter } from '../components/Atoms'

const AGENTS = [
  { name: 'Docs',    color: T.orange,  status: 'active',    port: 4001, lines: ['$ claude -p "Add description to USAGE.md"', '✽ Searching for pattern…', '⎿  USAGE.md', '✻ Reading 1 file…', '✶ Writing changes…'] },
  { name: 'Types',   color: T.blue,    status: 'active',    port: 4002, lines: ['$ claude -p "Add JSDoc to src/types.ts"', '✽ Searching for pattern…', '⎿  src/types.ts', '✻ Reading 1 file…', '✶ Editing file…'] },
  { name: 'Version', color: T.purple,  status: 'completed', port: 4003, lines: ['$ claude -p "Add VERSION constant"', '✽ Searching for pattern…', '⎿  src/index.ts', '✻ Reading 1 file…', '✔ Done. Exit 0.'] },
]

function TerminalPane({ agent, delay }: { agent: typeof AGENTS[0]; delay: number }) {
  const frame = useCurrentFrame()
  const visibleLines = Math.floor(Math.max(0, frame - delay) / 10)

  return (
    <FadeUp delay={delay}>
      <div style={{
        border: `1px solid ${agent.color}40`,
        background: T.bg,
        height: 280,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}>
        {/* Header bar */}
        <div style={{
          padding: '8px 14px',
          borderBottom: `1px solid ${agent.color}30`,
          background: `${agent.color}08`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {/* Health ring */}
            <div style={{
              width: 10, height: 10, borderRadius: '50%',
              background: agent.status === 'completed' ? T.green : T.orange,
              boxShadow: `0 0 6px ${agent.status === 'completed' ? T.green : T.orange}`,
            }} />
            <span style={{ fontSize: 11, fontFamily: T.font, color: agent.color, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              {agent.name}
            </span>
            <span style={{ fontSize: 9, color: agent.status === 'completed' ? T.green : T.orange, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              {agent.status}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 9, color: T.dim, fontFamily: T.font }}>:{agent.port}</span>
            {(agent.status === 'completed' || agent.status === 'active') && (
              <div style={{
                fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.1em',
                border: `1px solid ${agent.color}`,
                color: agent.color,
                padding: '2px 8px',
                opacity: agent.status === 'active' ? 0.5 : 1,
              }}>
                Review &amp; Merge
              </div>
            )}
          </div>
        </div>

        {/* Terminal body */}
        <div style={{ flex: 1, padding: '12px 16px', fontFamily: T.font, fontSize: 11, color: T.text, lineHeight: 1.7, overflow: 'hidden' }}>
          {agent.lines.slice(0, visibleLines).map((line, i) => (
            <div key={i} style={{
              color: line.startsWith('$') ? T.orange : line.startsWith('✔') ? T.green : T.muted,
              marginBottom: 2,
            }}>
              {line}
            </div>
          ))}
        </div>
      </div>
    </FadeUp>
  )
}

export function AgentFleetSlide() {
  return (
    <div style={{
      width: '100%', height: '100%',
      background: T.bgDeep,
      fontFamily: T.font,
      display: 'flex', flexDirection: 'column',
      padding: '48px 72px',
      position: 'relative', overflow: 'hidden',
    }}>
      <GridBg opacity={0.04} />

      {/* Header */}
      <FadeUp delay={0}>
        <SectionLabel label="Feature 01 — Agent Fleet" />
        <div style={{ fontSize: 42, fontWeight: 700, color: '#fff', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 10 }}>
          3 agents.<br />
          <span style={{ color: T.orange }}>One dashboard.</span>
        </div>
        <div style={{ marginTop: 12, fontSize: 13, color: T.muted, maxWidth: 560, lineHeight: 1.7 }}>
          Each agent gets a dedicated git worktree and a live PTY terminal in the browser.
          Spawn with <span style={{ color: T.orange }}>claude -p "task"</span> — exits 0 when done, triggers Review &amp; Merge automatically.
        </div>
      </FadeUp>

      {/* Terminal grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginTop: 28, flex: 1 }}>
        {AGENTS.map((agent, i) => (
          <TerminalPane key={agent.name} agent={agent} delay={18 + i * 14} />
        ))}
      </div>

      {/* Impl note */}
      <FadeUp delay={60}>
        <div style={{ marginTop: 16, fontSize: 10, color: T.dim, letterSpacing: '0.1em', borderTop: `1px solid ${T.border}`, paddingTop: 12 }}>
          IMPL: node-pty → WebSocket /pty/:agentId → xterm.js · PTY output buffered 64KB for replay on reconnect
        </div>
      </FadeUp>
    </div>
  )
}
