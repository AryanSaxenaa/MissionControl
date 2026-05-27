import { interpolate, useCurrentFrame } from 'remotion'
import { T } from '../theme'
import { FadeUp, GridBg, SectionLabel } from '../components/Atoms'

export function WorktreesSlide() {
  const frame = useCurrentFrame()

  const lineGrow = (start: number) =>
    interpolate(frame, [start, start + 30], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })

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
        <SectionLabel label="Feature 02 — Git Worktrees" />
        <div style={{ fontSize: 42, fontWeight: 700, color: '#fff', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 10 }}>
          Every agent owns<br />
          <span style={{ color: T.orange }}>its own branch.</span>
        </div>
        <div style={{ marginTop: 12, fontSize: 13, color: T.muted, maxWidth: 560, lineHeight: 1.7 }}>
          Agents never touch your working tree. Each spawns an isolated <code style={{ color: T.orange }}>git worktree</code> at
          {' '}<code style={{ color: T.orange }}>{'<project>/.trees/<agentId>'}</code>. Changes stay isolated until you merge.
        </div>
      </FadeUp>

      {/* Branch diagram */}
      <div style={{ display: 'flex', gap: 48, marginTop: 36, flex: 1, alignItems: 'flex-start' }}>

        {/* Left: directory tree */}
        <FadeUp delay={16}>
          <div style={{ border: `1px solid ${T.border2}`, background: T.bg, padding: '20px 24px', minWidth: 320 }}>
            <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.14em', color: T.orange, marginBottom: 16 }}>
              betterui/
            </div>
            {[
              { indent: 0, name: 'src/', color: T.muted },
              { indent: 1, name: 'index.ts', color: T.text },
              { indent: 1, name: 'types.ts', color: T.text },
              { indent: 0, name: '.trees/', color: T.orange },
              { indent: 1, name: 'agent-abc123/ ← Docs', color: T.blue },
              { indent: 2, name: 'USAGE.md  ✏', color: T.blue },
              { indent: 1, name: 'agent-def456/ ← Types', color: T.purple },
              { indent: 2, name: 'src/types.ts  ✏', color: T.purple },
              { indent: 1, name: 'agent-ghi789/ ← Version', color: T.green },
              { indent: 2, name: 'src/index.ts  ✏', color: T.green },
            ].map((item, i) => (
              <div key={i} style={{
                fontSize: 12,
                color: item.color,
                paddingLeft: item.indent * 20,
                lineHeight: 1.9,
                opacity: frame > 20 + i * 4 ? 1 : 0,
              }}>
                {item.indent > 0 ? '  └─ ' : ''}{item.name}
              </div>
            ))}
          </div>
        </FadeUp>

        {/* Right: git branch graph */}
        <FadeUp delay={22}>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.14em', color: T.dim, marginBottom: 20 }}>
              git branch topology
            </div>

            {/* main branch */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
              <div style={{ width: 10, height: 10, borderRadius: '50%', background: T.orange, flexShrink: 0 }} />
              <div style={{ height: 2, background: T.orange, width: `${lineGrow(10) * 300}px`, transition: 'none' }} />
              <div style={{ fontSize: 10, color: T.orange, textTransform: 'uppercase', letterSpacing: '0.1em', whiteSpace: 'nowrap' }}>main (HEAD)</div>
            </div>

            {/* Agent branches */}
            {[
              { label: 'agent/agent-abc123-add-description-to-usagemd', color: T.blue,   delay: 20 },
              { label: 'agent/agent-def456-add-jsdoc-to-srctyp...',     color: T.purple, delay: 30 },
              { label: 'agent/agent-ghi789-add-version-constant',       color: T.green,  delay: 40 },
            ].map((b) => (
              <div key={b.label} style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8, paddingLeft: 22 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: b.color, flexShrink: 0, opacity: lineGrow(b.delay) }} />
                <div style={{ height: 2, background: b.color, width: `${lineGrow(b.delay) * 240}px`, opacity: 0.7, transition: 'none' }} />
                <div style={{ fontSize: 10, color: b.color, fontFamily: T.font, opacity: lineGrow(b.delay), whiteSpace: 'nowrap' }}>
                  {b.label}
                </div>
              </div>
            ))}

            {/* After merge note */}
            <FadeUp delay={55}>
              <div style={{
                marginTop: 24,
                border: `1px solid ${T.green}40`,
                background: `${T.green}08`,
                padding: '12px 16px',
                fontSize: 11,
                color: T.green,
                lineHeight: 1.7,
              }}>
                After merge: worktree removed, branch deleted,<br />
                agent card disappears from fleet — clean state.
              </div>
            </FadeUp>
          </div>
        </FadeUp>
      </div>

      {/* Impl note */}
      <FadeUp delay={65}>
        <div style={{ fontSize: 10, color: T.dim, letterSpacing: '0.1em', borderTop: `1px solid ${T.border}`, paddingTop: 12, marginTop: 16 }}>
          IMPL: simple-git worktree add -b agent/{'<id>'}-{'<task>'} · locked during session · unlock + remove + branch -D on merge/discard
        </div>
      </FadeUp>
    </div>
  )
}
