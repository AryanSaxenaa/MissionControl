import { interpolate, useCurrentFrame } from 'remotion'
import { T } from '../theme'
import { FadeUp, GridBg, SectionLabel } from '../components/Atoms'

const DIFF_LINES = [
  { text: '--- a/USAGE.md',                    type: 'header' },
  { text: '+++ b/USAGE.md',                    type: 'header' },
  { text: '@@ -1,3 +1,8 @@',                  type: 'hunk' },
  { text: ' # betterui',                       type: 'context' },
  { text: ' ',                                 type: 'context' },
  { text: '+**betterui** is a design intelligence', type: 'add' },
  { text: '+engine that analyzes your project',      type: 'add' },
  { text: '+and curates beautiful design assets.',   type: 'add' },
  { text: '+',                                       type: 'add' },
  { text: '+## Install',                             type: 'add' },
  { text: '+```bash',                                type: 'add' },
  { text: '+npm install betterui',                   type: 'add' },
  { text: '+```',                                    type: 'add' },
  { text: ' ',                                       type: 'context' },
]

export function MergeReviewSlide() {
  const frame = useCurrentFrame()

  const linesVisible = Math.floor(Math.max(0, frame - 22) / 3)

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
        <SectionLabel label="Feature 05 — Review & Merge" />
        <div style={{ fontSize: 42, fontWeight: 700, color: '#fff', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 10 }}>
          Diff + context<br />
          <span style={{ color: T.orange }}>side by side.</span>
        </div>
      </FadeUp>

      {/* Review modal mock */}
      <FadeUp delay={14}>
        <div style={{
          border: `1px solid ${T.border2}`,
          background: T.bg,
          marginTop: 24,
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}>
          {/* Modal header */}
          <div style={{
            padding: '14px 24px',
            borderBottom: `1px solid ${T.border}`,
            display: 'flex', alignItems: 'center', gap: 12,
          }}>
            <span style={{ fontSize: 16, color: T.orange }}>⎇</span>
            <span style={{ fontSize: 12, color: T.text, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              Review &amp; Merge — Add description to USAGE.md
            </span>
          </div>

          {/* Body */}
          <div style={{ display: 'flex', flex: 1, minHeight: 0, overflow: 'hidden' }}>

            {/* Diff panel */}
            <div style={{ flex: 1, padding: '16px 20px', borderRight: `1px solid ${T.border}`, overflow: 'hidden' }}>
              <div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.14em', color: T.dim, marginBottom: 10 }}>Changes</div>
              {DIFF_LINES.slice(0, linesVisible).map((line, i) => (
                <div key={i} style={{
                  fontSize: 11,
                  fontFamily: T.font,
                  lineHeight: 1.7,
                  color: line.type === 'add' ? T.green
                       : line.type === 'header' ? T.muted
                       : line.type === 'hunk' ? T.blue
                       : T.dim,
                  background: line.type === 'add' ? `${T.green}10` : 'transparent',
                  paddingLeft: 4,
                }}>
                  {line.type === 'add' ? '+ ' : line.type === 'context' ? '  ' : ''}{line.text}
                </div>
              ))}
            </div>

            {/* Context panel */}
            <div style={{ width: 260, padding: '16px 20px', flexShrink: 0, overflow: 'hidden' }}>
              <div style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.14em', color: T.dim, marginBottom: 10 }}>
                Why (from memory)
              </div>
              <div style={{ fontSize: 11, color: T.muted, lineHeight: 1.7, opacity: frame > 40 ? 1 : 0 }}>
                Agent agent-abc123 was tasked with adding a description paragraph to USAGE.md. No prior decisions found for this file. Reasoning: "Add description paragraph."
              </div>

              {/* Stats */}
              <div style={{ marginTop: 16, display: 'flex', flexDirection: 'column', gap: 8, opacity: frame > 46 ? 1 : 0 }}>
                {[
                  { label: '+8 lines', color: T.green },
                  { label: '1 file',   color: T.muted },
                  { label: 'USAGE.md', color: T.orange },
                ].map(s => (
                  <div key={s.label} style={{ fontSize: 11, color: s.color, borderLeft: `2px solid ${s.color}`, paddingLeft: 8 }}>
                    {s.label}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Footer */}
          <div style={{
            padding: '14px 24px',
            borderTop: `1px solid ${T.border}`,
            display: 'flex', alignItems: 'center', gap: 12,
            opacity: frame > 50 ? 1 : 0,
          }}>
            <div style={{ flex: 1, border: `1px solid ${T.border2}`, background: '#000', padding: '8px 12px', fontSize: 11, color: T.dim, fontFamily: T.font }}>
              Add description to USAGE.md
            </div>
            <div style={{ border: `1px solid ${T.border2}`, color: T.dim, padding: '8px 14px', fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              Discard
            </div>
            <div style={{
              background: T.orange, color: '#000', padding: '8px 20px',
              fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.1em', fontWeight: 700,
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              ⎇ Merge
            </div>
          </div>
        </div>
      </FadeUp>

      {/* Impl note */}
      <FadeUp delay={70}>
        <div style={{ fontSize: 10, color: T.dim, letterSpacing: '0.1em', borderTop: `1px solid ${T.border}`, paddingTop: 10, marginTop: 10 }}>
          IMPL: GET /api/agents/:id/diff · git add + diff --cached + reset · mergeWorktree: commit → git merge --no-ff → worktree remove
        </div>
      </FadeUp>
    </div>
  )
}
