import { interpolate, useCurrentFrame } from 'remotion'
import { T } from '../theme'
import { FadeUp, GridBg, SectionLabel } from '../components/Atoms'

const MEMORY_ITEMS = [
  { type: 'decision',  agent: 'agent-abc1', text: 'Modified USAGE.md: Added description paragraph', time: '14:22:01', color: T.orange },
  { type: 'decision',  agent: 'agent-def4', text: 'Modified src/types.ts: Added JSDoc to exports', time: '14:22:14', color: T.orange },
  { type: 'context',   agent: 'agent-abc1', text: 'scope: USAGE.md — file structure analyzed', time: '14:22:03', color: T.blue },
  { type: 'failure',   agent: 'agent-ghi7', text: 'Bash exit code 1: tsc --noEmit failed', time: '14:21:55', color: T.red },
]

export function MemorySlide() {
  const frame = useCurrentFrame()

  const nodeScale = (delay: number) =>
    interpolate(frame, [delay, delay + 12], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })

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
        <SectionLabel label="Feature 04 — HydraDB Memory" />
        <div style={{ fontSize: 42, fontWeight: 700, color: '#fff', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 10 }}>
          Every agent action<br />
          <span style={{ color: T.orange }}>feeds the knowledge graph.</span>
        </div>
        <div style={{ marginTop: 12, fontSize: 13, color: T.muted, maxWidth: 580, lineHeight: 1.7 }}>
          PostToolUse hooks auto-ingest decisions, context, and failures into HydraDB — no SDK instrumentation needed.
          The Why? panel queries decision memory with semantic search.
        </div>
      </FadeUp>

      <div style={{ display: 'flex', gap: 28, marginTop: 28, flex: 1 }}>

        {/* Left: event log */}
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.14em', color: T.dim, marginBottom: 12 }}>
            Auto-ingested this session
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {MEMORY_ITEMS.map((item, i) => (
              <div key={i} style={{
                border: `1px solid ${item.color}30`,
                background: `${item.color}06`,
                padding: '10px 14px',
                opacity: frame > 20 + i * 8 ? 1 : 0,
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.12em', color: item.color }}>{item.type}</span>
                  <span style={{ fontSize: 9, color: T.dim }}>{item.time}</span>
                </div>
                <div style={{ fontSize: 11, color: T.muted }}>{item.text}</div>
                <div style={{ fontSize: 9, color: T.dim, marginTop: 3 }}>{item.agent}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Right: Why? panel + graph nodes */}
        <div style={{ width: 340, display: 'flex', flexDirection: 'column', gap: 16 }}>

          {/* Why? query */}
          <FadeUp delay={40}>
            <div style={{ border: `1px solid ${T.border2}`, background: T.bg, padding: '16px 20px' }}>
              <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.14em', color: T.orange, marginBottom: 12 }}>
                Why? — Query Decision Memory
              </div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
                <div style={{ flex: 1, border: `1px solid ${T.border2}`, background: '#000', padding: '6px 10px', fontSize: 11, color: T.orange, fontFamily: T.font }}>
                  src/index.ts
                </div>
                <div style={{ border: `1px solid ${T.orange}`, color: T.orange, padding: '6px 14px', fontSize: 9, textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                  Ask
                </div>
              </div>
              <div style={{ fontSize: 11, color: T.muted, lineHeight: 1.6, opacity: frame > 52 ? 1 : 0 }}>
                Found 2 decision record(s) for "src/index.ts".
              </div>
              <div style={{ marginTop: 8, border: `1px solid ${T.border}`, background: '#0a0a0a', padding: '8px 10px', fontSize: 10, color: T.dim, lineHeight: 1.6, opacity: frame > 56 ? 1 : 0 }}>
                [DECISION] Agent agent-ghi7 modified src/index.ts: Add VERSION constant...
              </div>
            </div>
          </FadeUp>

          {/* Knowledge graph nodes */}
          <FadeUp delay={48}>
            <div style={{ border: `1px solid ${T.border2}`, background: T.bg, padding: '16px 20px' }}>
              <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.14em', color: T.dim, marginBottom: 14 }}>
                Knowledge Graph — SuperNodes
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                {[
                  { label: 'src/index.ts', size: 32, color: T.orange },
                  { label: 'USAGE.md',     size: 24, color: T.blue },
                  { label: 'src/types.ts', size: 20, color: T.purple },
                  { label: 'VERSION',      size: 16, color: T.green },
                  { label: 'JSDoc',        size: 14, color: T.muted },
                ].map((node, i) => (
                  <div key={node.label} style={{
                    width: node.size, height: node.size, borderRadius: '50%',
                    background: `${node.color}30`,
                    border: `1px solid ${node.color}60`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    transform: `scale(${nodeScale(52 + i * 5)})`,
                  }} title={node.label}>
                    <div style={{ width: node.size * 0.35, height: node.size * 0.35, borderRadius: '50%', background: node.color }} />
                  </div>
                ))}
              </div>
              <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {[
                  { label: 'src/index.ts', color: T.orange },
                  { label: 'USAGE.md',     color: T.blue },
                  { label: 'src/types.ts', color: T.purple },
                ].map((n, i) => (
                  <span key={n.label} style={{ fontSize: 9, color: n.color, opacity: nodeScale(54 + i * 5) }}>
                    {n.label}
                  </span>
                ))}
              </div>
            </div>
          </FadeUp>
        </div>
      </div>

      {/* Impl note */}
      <FadeUp delay={72}>
        <div style={{ fontSize: 10, color: T.dim, letterSpacing: '0.1em', borderTop: `1px solid ${T.border}`, paddingTop: 12, marginTop: 14 }}>
          IMPL: PostToolUse → ingestDecision/ingestContext/ingestFailure → HydraDB sub-tenants: decisions, shared, failures · recall.qna + fullRecall for Why?
        </div>
      </FadeUp>
    </div>
  )
}
