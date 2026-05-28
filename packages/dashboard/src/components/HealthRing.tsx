/**
 * HealthRing — animated status indicator for an agent.

 */

interface HealthRingProps {
  status: string
  size?: number
}

const RING_COLORS: Record<string, { fill: string; ring: string; pulse: boolean }> = {
  active:    { fill: '#f97316', ring: 'rgba(249,115,22,0.25)', pulse: true  },
  idle:      { fill: '#eab308', ring: 'rgba(234,179,8,0.2)',   pulse: false },
  failed:    { fill: '#ef4444', ring: 'rgba(239,68,68,0.2)',   pulse: false },
  completed: { fill: '#22c55e', ring: 'rgba(34,197,94,0.2)',   pulse: false },
}

export function HealthRing({ status, size = 20 }: HealthRingProps) {
  const colors = RING_COLORS[status] ?? { fill: '#555', ring: 'rgba(85,85,85,0.2)', pulse: false }
  const r = size / 2

  return (
    <div
      style={{ width: size, height: size, flexShrink: 0, position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
    >
      <span
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: '50%',
          background: colors.ring,
          animation: colors.pulse ? 'mc-pulse 2s ease-in-out infinite' : undefined,
        }}
      />
      <span
        style={{
          position: 'absolute',
          width: r,
          height: r,
          borderRadius: '50%',
          background: colors.fill,
        }}
      />
      <style>{`
        @keyframes mc-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50%       { opacity: 0.5; transform: scale(1.3); }
        }
      `}</style>
    </div>
  )
}
