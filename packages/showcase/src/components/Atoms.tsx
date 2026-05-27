import { interpolate, useCurrentFrame, useVideoConfig } from 'remotion'
import { T } from '../theme'

// Fade + slide-up entrance. delay in frames.
export function FadeUp({
  children,
  delay = 0,
  duration = 20,
  distance = 24,
}: {
  children: React.ReactNode
  delay?: number
  duration?: number
  distance?: number
}) {
  const frame = useCurrentFrame()
  const opacity = interpolate(frame, [delay, delay + duration], [0, 1], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  const y      = interpolate(frame, [delay, delay + duration], [distance, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  return <div style={{ opacity, transform: `translateY(${y}px)` }}>{children}</div>
}

// Scan-line that slides across a box (left → right)
export function ScanLine({ delay = 0, color = T.orange }: { delay?: number; color?: string }) {
  const frame = useCurrentFrame()
  const x = interpolate(frame, [delay, delay + 60], [0, 100], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })
  return (
    <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, overflow: 'hidden', pointerEvents: 'none' }}>
      <div style={{ position: 'absolute', top: 0, bottom: 0, width: 2, left: `${x}%`, background: color, opacity: 0.4, boxShadow: `0 0 12px ${color}` }} />
    </div>
  )
}

// Blinking cursor
export function Cursor({ color = T.orange }: { color?: string }) {
  const { fps } = useVideoConfig()
  const frame = useCurrentFrame()
  const on = Math.floor(frame / (fps / 2)) % 2 === 0
  return <span style={{ display: 'inline-block', width: 10, height: '1em', background: on ? color : 'transparent', verticalAlign: 'text-bottom', marginLeft: 2 }} />
}

// Typewriter text reveal
export function TypeWriter({ text, delay = 0, speed = 2 }: { text: string; delay?: number; speed?: number }) {
  const frame = useCurrentFrame()
  const chars = Math.floor(Math.max(0, frame - delay) / speed)
  return <span>{text.slice(0, chars)}</span>
}

// Orange pill tag
export function Tag({ label }: { label: string }) {
  return (
    <span style={{
      fontFamily: T.font,
      fontSize: 10,
      textTransform: 'uppercase',
      letterSpacing: '0.12em',
      color: T.orange,
      border: `1px solid ${T.orange}60`,
      padding: '2px 8px',
      display: 'inline-block',
    }}>
      {label}
    </span>
  )
}

// Section header — thin orange top bar + label
export function SectionLabel({ label }: { label: string }) {
  return (
    <div style={{ fontFamily: T.font, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.16em', color: T.orange }}>
      {label}
    </div>
  )
}

// Card / panel box
export function Panel({
  children,
  style,
}: {
  children: React.ReactNode
  style?: React.CSSProperties
}) {
  return (
    <div style={{
      border: `1px solid ${T.border2}`,
      background: T.bg,
      padding: 24,
      ...style,
    }}>
      {children}
    </div>
  )
}

// Horizontal divider
export function Divider({ color = T.border2 }: { color?: string }) {
  return <div style={{ height: 1, background: color, width: '100%' }} />
}

// Grid dot background
export function GridBg({ opacity = 0.07 }: { opacity?: number }) {
  return (
    <div style={{
      position: 'absolute', inset: 0, opacity,
      backgroundImage: `radial-gradient(${T.dimmer} 1px, transparent 1px)`,
      backgroundSize: '32px 32px',
    }} />
  )
}

// Glowing orb behind content
export function GlowOrb({ color = T.orange, size = 400, opacity = 0.06 }: { color?: string; size?: number; opacity?: number }) {
  return (
    <div style={{
      position: 'absolute',
      width: size,
      height: size,
      borderRadius: '50%',
      background: color,
      filter: `blur(${size / 2}px)`,
      opacity,
      pointerEvents: 'none',
    }} />
  )
}
