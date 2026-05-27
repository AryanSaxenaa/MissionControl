import { interpolate, useCurrentFrame } from 'remotion'
import { T } from '../theme'
import { FadeUp, GridBg, SectionLabel, GlowOrb } from '../components/Atoms'

const STACK = [
  {
    layer: 'Dashboard',
    color: T.orange,
    items: [
      { name: 'React 18',    role: 'UI framework' },
      { name: 'xterm.js',    role: 'Terminal renderer' },
      { name: 'Zustand',     role: 'State management' },
      { name: 'Vite',        role: 'Build tool' },
      { name: 'Tailwind',    role: 'Styling' },
    ],
  },
  {
    layer: 'Server',
    color: T.blue,
    items: [
      { name: 'Fastify',     role: 'HTTP server' },
      { name: 'node-pty',    role: 'PTY spawner' },
      { name: 'ws',          role: 'WebSocket (dual channel)' },
      { name: 'simple-git',  role: 'Worktree management' },
      { name: 'Zod',         role: 'Schema validation' },
    ],
  },
  {
    layer: 'Memory',
    color: T.purple,
    items: [
      { name: 'HydraDB SDK', role: 'Knowledge graph + recall' },
      { name: 'ingestMemory',role: 'Decisions, context, failures' },
      { name: 'recall.qna',  role: 'Why? semantic Q&A' },
      { name: 'getSuperNodes',role: 'Graph visualization' },
    ],
  },
  {
    layer: 'Agents',
    color: T.green,
    items: [
      { name: 'Claude Code',  role: 'claude -p "task"' },
      { name: 'Codex',        role: 'codex "task"' },
      { name: 'OpenCode',     role: 'opencode run "task"' },
      { name: 'HTTP Hooks',   role: 'PreToolUse / PostToolUse' },
    ],
  },
]

export function TechStackSlide() {
  const frame = useCurrentFrame()

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
      <GlowOrb color={T.orange} size={400} opacity={0.04} />

      {/* Header */}
      <FadeUp delay={0}>
        <SectionLabel label="Architecture" />
        <div style={{ fontSize: 42, fontWeight: 700, color: '#fff', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 10 }}>
          Built on solid<br />
          <span style={{ color: T.orange }}>open-source primitives.</span>
        </div>
      </FadeUp>

      {/* Stack columns */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginTop: 32, flex: 1 }}>
        {STACK.map((col, ci) => (
          <FadeUp key={col.layer} delay={16 + ci * 10}>
            <div style={{
              borderTop: `2px solid ${col.color}`,
              borderLeft: `1px solid ${T.border2}`,
              borderRight: `1px solid ${T.border2}`,
              borderBottom: `1px solid ${T.border2}`,
              padding: '18px 18px',
              background: T.bg,
              height: '100%',
            }}>
              <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.14em', color: col.color, marginBottom: 16 }}>
                {col.layer}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {col.items.map((item, ii) => (
                  <div key={item.name} style={{ opacity: frame > 22 + ci * 10 + ii * 5 ? 1 : 0 }}>
                    <div style={{ fontSize: 12, color: T.text, fontWeight: 600 }}>{item.name}</div>
                    <div style={{ fontSize: 10, color: T.dim, marginTop: 1 }}>{item.role}</div>
                  </div>
                ))}
              </div>
            </div>
          </FadeUp>
        ))}
      </div>

      {/* Stats bar */}
      <FadeUp delay={60}>
        <div style={{
          marginTop: 20,
          display: 'flex', gap: 0,
          border: `1px solid ${T.border2}`,
          overflow: 'hidden',
        }}>
          {[
            { label: 'TypeScript',  value: '100%',  color: T.blue },
            { label: 'Monorepo',    value: '6 pkgs', color: T.muted },
            { label: 'WS Channels', value: '2',      color: T.orange },
            { label: 'Hook types',  value: '4',      color: T.purple },
            { label: 'Sub-tenants', value: '5',      color: T.green },
          ].map((stat, i) => (
            <div key={stat.label} style={{
              flex: 1,
              padding: '12px 16px',
              borderRight: i < 4 ? `1px solid ${T.border2}` : 'none',
              background: T.bg,
            }}>
              <div style={{ fontSize: 18, fontWeight: 700, color: stat.color }}>{stat.value}</div>
              <div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.12em', color: T.dim, marginTop: 2 }}>{stat.label}</div>
            </div>
          ))}
        </div>
      </FadeUp>
    </div>
  )
}
