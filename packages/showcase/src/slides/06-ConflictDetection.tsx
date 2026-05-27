import { interpolate, useCurrentFrame } from 'remotion'
import { T } from '../theme'
import { FadeUp, GridBg, SectionLabel } from '../components/Atoms'

export function ConflictDetectionSlide() {
  const frame = useCurrentFrame()

  const pulse = interpolate(Math.sin((frame / 6) * Math.PI), [-1, 1], [0.5, 1])
  const arrowAlpha = interpolate(frame, [20, 36], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })

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
        <SectionLabel label="Feature 03 — Conflict Detection" />
        <div style={{ fontSize: 42, fontWeight: 700, color: '#fff', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 10 }}>
          Agents know when<br />
          <span style={{ color: T.orange }}>they're in each other's way.</span>
        </div>
        <div style={{ marginTop: 12, fontSize: 13, color: T.muted, maxWidth: 580, lineHeight: 1.7 }}>
          Every Write/Edit/Bash call fires a <span style={{ color: T.orange }}>PreToolUse</span> HTTP hook. MissionControl declares
          an intent, runs conflict detection, and injects <span style={{ color: T.orange }}>additionalContext</span> back into
          the agent's conversation if a peer is already editing the same file.
        </div>
      </FadeUp>

      {/* Flow diagram */}
      <div style={{ display: 'flex', alignItems: 'stretch', gap: 0, marginTop: 32, flex: 1 }}>

        {/* Agent A */}
        <FadeUp delay={14}>
          <div style={{ border: `1px solid ${T.blue}50`, background: T.bg, padding: '16px 20px', minWidth: 200 }}>
            <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.12em', color: T.blue, marginBottom: 10 }}>
              Agent A
            </div>
            <div style={{ fontSize: 11, color: T.muted, lineHeight: 1.7 }}>
              <div style={{ color: T.blue }}>PreToolUse →</div>
              <div style={{ marginTop: 4 }}>tool: Edit</div>
              <div>file: src/index.ts</div>
            </div>
          </div>
        </FadeUp>

        {/* Arrow → server */}
        <div style={{ display: 'flex', alignItems: 'center', padding: '0 8px', opacity: arrowAlpha }}>
          <div style={{ fontSize: 14, color: T.orange }}>→</div>
        </div>

        {/* Server: intent check */}
        <FadeUp delay={22}>
          <div style={{ border: `1px solid ${T.orange}50`, background: T.bg, padding: '16px 20px', minWidth: 260, flex: 1 }}>
            <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.12em', color: T.orange, marginBottom: 10 }}>
              MissionControl Server
            </div>
            {[
              { step: '1', text: 'normalizeTarget(path)', color: T.muted },
              { step: '2', text: 'activeIntents.set(intentId, intent)', color: T.muted },
              { step: '3', text: 'detectConflicts(intent)', color: T.muted },
              { step: '4', text: 'getIntentsForTarget(target)', color: T.orange },
            ].map((s, i) => (
              <div key={i} style={{
                display: 'flex', gap: 10, marginBottom: 6,
                opacity: frame > 26 + i * 6 ? 1 : 0,
              }}>
                <span style={{ color: T.dim, fontSize: 10 }}>{s.step}.</span>
                <span style={{ fontSize: 11, color: s.color, fontFamily: T.font }}>{s.text}</span>
              </div>
            ))}

            {/* Conflict warning */}
            <div style={{
              marginTop: 12,
              border: `1px solid ${T.orange}60`,
              background: `${T.orange}10`,
              padding: '8px 12px',
              opacity: frame > 52 ? pulse : 0,
            }}>
              <div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.1em', color: T.orange }}>conflict:detected</div>
              <div style={{ fontSize: 10, color: T.muted, marginTop: 4 }}>severity: warning · 2 agents on src/index.ts</div>
            </div>
          </div>
        </FadeUp>

        {/* Arrow → agent */}
        <div style={{ display: 'flex', alignItems: 'center', padding: '0 8px', opacity: arrowAlpha }}>
          <div style={{ fontSize: 14, color: T.orange }}>→</div>
        </div>

        {/* Agent A response */}
        <FadeUp delay={55}>
          <div style={{
            border: `1px solid ${T.orange}50`,
            background: `${T.orange}06`,
            padding: '16px 20px', minWidth: 240,
          }}>
            <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.12em', color: T.orange, marginBottom: 10 }}>
              Injected Context
            </div>
            <div style={{ fontSize: 11, color: T.muted, lineHeight: 1.8, fontFamily: T.font }}>
              <div style={{ color: T.orange }}>[MissionControl]</div>
              <div>1 other agent has an</div>
              <div>active intent on</div>
              <div style={{ color: T.text }}>src/index.ts</div>
              <div style={{ marginTop: 6 }}>Coordinate or wait.</div>
            </div>
          </div>
        </FadeUp>
      </div>

      {/* Impl note */}
      <FadeUp delay={70}>
        <div style={{ fontSize: 10, color: T.dim, letterSpacing: '0.1em', borderTop: `1px solid ${T.border}`, paddingTop: 12, marginTop: 16 }}>
          IMPL: HTTP hook URL injected at spawn · pathsOverlap() normalizes worktree paths · critical conflicts block the tool call · warnings inject additionalContext
        </div>
      </FadeUp>
    </div>
  )
}
