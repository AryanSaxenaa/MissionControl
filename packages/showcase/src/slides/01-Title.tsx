import { interpolate, useCurrentFrame } from 'remotion'
import { T } from '../theme'
import { FadeUp, GridBg, GlowOrb, Cursor, Divider } from '../components/Atoms'

export function TitleSlide() {
  const frame = useCurrentFrame()

  const orangeLineW = interpolate(frame, [10, 50], [0, 100], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })

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
      <GlowOrb color={T.orange} size={600} opacity={0.05} />

      {/* Top bar */}
      <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: T.border2 }}>
        <div style={{ height: '100%', width: `${orangeLineW}%`, background: T.orange, transition: 'none' }} />
      </div>

      {/* Corner labels */}
      <FadeUp delay={5}>
        <div style={{ position: 'absolute', top: 24, left: 40, fontSize: 11, color: T.dim, letterSpacing: '0.14em', textTransform: 'uppercase' }}>
          MissionControl · v3
        </div>
      </FadeUp>
      <FadeUp delay={5}>
        <div style={{ position: 'absolute', top: 24, right: 40, fontSize: 11, color: T.dim, letterSpacing: '0.14em' }}>
          2026
        </div>
      </FadeUp>

      {/* Main content */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20, zIndex: 1 }}>

        <FadeUp delay={8}>
          <div style={{ fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.22em', color: T.orange, marginBottom: 8 }}>
            Introducing
          </div>
        </FadeUp>

        <FadeUp delay={14}>
          <div style={{
            fontSize: 88,
            fontWeight: 700,
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            color: '#ffffff',
            lineHeight: 1,
          }}>
            MISSION<span style={{ color: T.orange }}>CONTROL</span>
          </div>
        </FadeUp>

        <FadeUp delay={22}>
          <Divider color={T.border2} />
        </FadeUp>

        <FadeUp delay={28}>
          <div style={{ fontSize: 18, color: T.muted, letterSpacing: '0.06em', textAlign: 'center', maxWidth: 560 }}>
            A browser-based OS for running parallel AI coding agents
          </div>
        </FadeUp>

        <FadeUp delay={36}>
          <div style={{ display: 'flex', gap: 12, marginTop: 8 }}>
            {['node-pty', 'git worktrees', 'HydraDB', 'WebSockets'].map(tag => (
              <span key={tag} style={{
                fontSize: 10,
                textTransform: 'uppercase',
                letterSpacing: '0.12em',
                color: T.dim,
                border: `1px solid ${T.border2}`,
                padding: '4px 10px',
              }}>
                {tag}
              </span>
            ))}
          </div>
        </FadeUp>

        <FadeUp delay={44}>
          <div style={{ marginTop: 4, fontSize: 13, color: T.dim, fontFamily: T.font }}>
            $ spawn agents → coordinate → merge
            <Cursor />
          </div>
        </FadeUp>
      </div>

      {/* Bottom bar */}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 1, background: T.border2 }} />
    </div>
  )
}
