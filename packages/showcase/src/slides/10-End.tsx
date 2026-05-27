import { interpolate, useCurrentFrame } from 'remotion'
import { T } from '../theme'
import { FadeUp, GridBg, GlowOrb, Cursor } from '../components/Atoms'

export function EndSlide() {
  const frame = useCurrentFrame()

  const orangeLineW = interpolate(frame, [8, 50], [0, 100], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })

  return (
    <div style={{
      width: '100%', height: '100%',
      background: T.bgDeep,
      fontFamily: T.font,
      display: 'flex', flexDirection: 'column',
      justifyContent: 'center', alignItems: 'center',
      position: 'relative', overflow: 'hidden',
    }}>
      <GridBg opacity={0.05} />
      <GlowOrb color={T.orange} size={600} opacity={0.06} />

      {/* Top progress bar */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: T.border2 }}>
        <div style={{ height: '100%', width: `${orangeLineW}%`, background: T.orange }} />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, zIndex: 1, maxWidth: 680, textAlign: 'center' }}>

        <FadeUp delay={8}>
          <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.22em', color: T.orange }}>
            MissionControl
          </div>
        </FadeUp>

        <FadeUp delay={14}>
          <div style={{ fontSize: 56, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: '#fff', lineHeight: 1.1 }}>
            From chaos to<br />
            <span style={{ color: T.orange }}>coordinated.</span>
          </div>
        </FadeUp>

        <FadeUp delay={24}>
          <div style={{ fontSize: 16, color: T.muted, lineHeight: 1.7, maxWidth: 520 }}>
            Spawn parallel AI agents. Watch them coordinate in real time.
            Review their work. Merge with confidence.
          </div>
        </FadeUp>

        {/* Feature checklist */}
        <FadeUp delay={32}>
          <div style={{ display: 'flex', gap: 32, marginTop: 8 }}>
            {[
              ['✓', 'Live PTY terminals'],
              ['✓', 'Git worktrees'],
              ['✓', 'Conflict detection'],
              ['✓', 'HydraDB memory'],
              ['✓', 'Review & Merge'],
            ].map(([check, label]) => (
              <div key={label} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                <span style={{ color: T.green, fontSize: 14 }}>{check}</span>
                <span style={{ fontSize: 9, color: T.dim, textTransform: 'uppercase', letterSpacing: '0.1em', textAlign: 'center' }}>{label}</span>
              </div>
            ))}
          </div>
        </FadeUp>

        <FadeUp delay={44}>
          <div style={{ marginTop: 8, fontSize: 14, color: T.dim, fontFamily: T.font, borderTop: `1px solid ${T.border2}`, paddingTop: 18, width: '100%', textAlign: 'center' }}>
            $ git clone github.com/AryanSaxenaa/MissionControl<Cursor />
          </div>
        </FadeUp>
      </div>

      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 1, background: T.border2 }} />
    </div>
  )
}
