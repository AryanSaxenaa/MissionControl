import { interpolate, useCurrentFrame } from 'remotion'
import { T } from '../theme'
import { FadeUp, GridBg, GlowOrb, SectionLabel, Panel } from '../components/Atoms'

const PROBLEMS = [
  { icon: '⎋', label: 'No visibility',    desc: 'Agents run in separate terminals with no shared state. You have no idea what they\'re doing.' },
  { icon: '⚠', label: 'Merge conflicts', desc: 'Two agents editing the same file — you only find out at git merge when it\'s too late.' },
  { icon: '⌁', label: 'Context lost',    desc: 'Every agent starts from scratch. Prior decisions, failures, and patterns vanish between sessions.' },
  { icon: '⊗', label: 'Manual handoff',  desc: 'Reviewing agent output means reading raw diffs in the terminal with no context about why.' },
]

export function ProblemSlide() {
  const frame = useCurrentFrame()
  const redPulse = interpolate(Math.sin((frame / 8) * Math.PI), [-1, 1], [0.6, 1])

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
      <GlowOrb color={T.red} size={400} opacity={0.04} />

      {/* Header */}
      <FadeUp delay={0}>
        <SectionLabel label="The Problem" />
        <div style={{ fontSize: 48, fontWeight: 700, color: '#fff', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 12 }}>
          Running agents<br />
          <span style={{ color: T.orange }}>is still chaos.</span>
        </div>
        <div style={{ marginTop: 16, fontSize: 15, color: T.muted, maxWidth: 480, lineHeight: 1.7 }}>
          Every AI coding agent runs in isolation. No coordination, no memory, no control plane.
        </div>
      </FadeUp>

      {/* Problem cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 40, flex: 1 }}>
        {PROBLEMS.map((p, i) => (
          <FadeUp key={p.label} delay={16 + i * 12}>
            <Panel style={{ height: '100%', position: 'relative', borderColor: `${T.red}30` }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
                <div style={{
                  fontSize: 22,
                  color: T.red,
                  opacity: redPulse,
                  flexShrink: 0,
                  width: 32,
                  textAlign: 'center',
                }}>
                  {p.icon}
                </div>
                <div>
                  <div style={{ fontSize: 12, textTransform: 'uppercase', letterSpacing: '0.12em', color: T.red, marginBottom: 8 }}>
                    {p.label}
                  </div>
                  <div style={{ fontSize: 13, color: T.muted, lineHeight: 1.65 }}>
                    {p.desc}
                  </div>
                </div>
              </div>
            </Panel>
          </FadeUp>
        ))}
      </div>
    </div>
  )
}
