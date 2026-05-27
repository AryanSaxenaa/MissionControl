import { interpolate, useCurrentFrame } from 'remotion'
import { T } from '../theme'
import { FadeUp, GridBg, GlowOrb, SectionLabel } from '../components/Atoms'

const PILLARS = [
  { color: T.orange, label: 'Agent Fleet',       desc: 'Live PTY terminals\nin the browser' },
  { color: T.blue,   label: 'Git Worktrees',      desc: 'Isolated branches\nper agent' },
  { color: T.purple, label: 'Conflict Detection', desc: 'Real-time intent\ndeclaration' },
  { color: T.green,  label: 'HydraDB Memory',     desc: 'Persistent knowledge\ngraph across sessions' },
]

export function SolutionSlide() {
  const frame = useCurrentFrame()

  const arrowProgress = interpolate(frame, [30, 60], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })

  return (
    <div style={{
      width: '100%', height: '100%',
      background: T.bgDeep,
      fontFamily: T.font,
      display: 'flex', flexDirection: 'column',
      padding: '56px 72px',
      position: 'relative', overflow: 'hidden',
    }}>
      <GridBg opacity={0.04} />
      <GlowOrb color={T.orange} size={500} opacity={0.05} />

      {/* Header */}
      <FadeUp delay={0}>
        <SectionLabel label="The Solution" />
        <div style={{ fontSize: 48, fontWeight: 700, color: '#fff', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 12 }}>
          A control plane for<br />
          <span style={{ color: T.orange }}>every agent you run.</span>
        </div>
      </FadeUp>

      {/* Flow diagram */}
      <FadeUp delay={18}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 0, marginTop: 48 }}>

          {/* Browser box */}
          <div style={{ border: `1px solid ${T.border2}`, padding: '20px 28px', flex: 1, background: T.bg }}>
            <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.14em', color: T.orange, marginBottom: 10 }}>Dashboard</div>
            <div style={{ display: 'flex', gap: 8 }}>
              {['Fleet', 'Graph', 'Decisions', 'Conflicts'].map(v => (
                <span key={v} style={{ fontSize: 9, color: T.dim, border: `1px solid ${T.border}`, padding: '2px 6px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{v}</span>
              ))}
            </div>
          </div>

          {/* Arrow */}
          <div style={{ width: 60, height: 2, background: T.orange, opacity: arrowProgress, position: 'relative', flexShrink: 0 }}>
            <div style={{ position: 'absolute', right: 0, top: -5, fontSize: 12, color: T.orange }}>▶</div>
            <div style={{ position: 'absolute', left: 0, top: -5, fontSize: 12, color: T.orange }}>◀</div>
          </div>

          {/* Server box */}
          <div style={{ border: `1px solid ${T.border2}`, padding: '20px 28px', flex: 1, background: T.bg }}>
            <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.14em', color: T.blue, marginBottom: 10 }}>Server :3000</div>
            <div style={{ display: 'flex', gap: 8 }}>
              {['WS Events', 'WS PTY', 'REST'].map(v => (
                <span key={v} style={{ fontSize: 9, color: T.dim, border: `1px solid ${T.border}`, padding: '2px 6px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{v}</span>
              ))}
            </div>
          </div>

          {/* Arrow */}
          <div style={{ width: 60, height: 2, background: T.purple, opacity: arrowProgress, position: 'relative', flexShrink: 0 }}>
            <div style={{ position: 'absolute', right: 0, top: -5, fontSize: 12, color: T.purple }}>▶</div>
          </div>

          {/* Agents box */}
          <div style={{ border: `1px solid ${T.border2}`, padding: '20px 28px', flex: 1, background: T.bg }}>
            <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.14em', color: T.purple, marginBottom: 10 }}>Agents (node-pty)</div>
            <div style={{ display: 'flex', gap: 8 }}>
              {['claude', 'codex', 'opencode'].map(v => (
                <span key={v} style={{ fontSize: 9, color: T.dim, border: `1px solid ${T.border}`, padding: '2px 6px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>{v}</span>
              ))}
            </div>
          </div>
        </div>
      </FadeUp>

      {/* Four pillars */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginTop: 36 }}>
        {PILLARS.map((p, i) => (
          <FadeUp key={p.label} delay={28 + i * 10}>
            <div style={{
              borderTop: `2px solid ${p.color}`,
              borderLeft: `1px solid ${T.border2}`,
              borderRight: `1px solid ${T.border2}`,
              borderBottom: `1px solid ${T.border2}`,
              padding: '18px 20px',
              background: T.bg,
            }}>
              <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.14em', color: p.color, marginBottom: 10 }}>
                {p.label}
              </div>
              <div style={{ fontSize: 13, color: T.muted, lineHeight: 1.6, whiteSpace: 'pre-line' }}>
                {p.desc}
              </div>
            </div>
          </FadeUp>
        ))}
      </div>
    </div>
  )
}
