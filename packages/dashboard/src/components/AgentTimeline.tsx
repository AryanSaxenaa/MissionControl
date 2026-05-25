import { useMemo } from 'react'
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { useMissionControlStore } from '../store/useStore'
import type { TimelineEvent } from '@missioncontrol/types'

const WINDOW_MS = 10 * 60 * 1000
const BUCKET_MS = 30 * 1000

function bucketEvents(events: TimelineEvent[]) {
  const now = Date.now()
  const cutoff = now - WINDOW_MS
  const buckets: Record<number, { active: number; toolCalls: number; failures: number }> = {}

  let activeCount = 0
  const activeAgents = new Set<string>()

  const relevant = events.filter(e => e.timestamp >= cutoff)
  relevant.sort((a, b) => a.timestamp - b.timestamp)

  for (const e of relevant) {
    const b = Math.floor(e.timestamp / BUCKET_MS) * BUCKET_MS
    if (!buckets[b]) buckets[b] = { active: 0, toolCalls: 0, failures: 0 }

    if (e.type === 'agent:spawned') { activeAgents.add(e.agentId); activeCount = activeAgents.size }
    else if (e.type === 'agent:died' || e.type === 'agent:completed') { activeAgents.delete(e.agentId); activeCount = activeAgents.size }
    else if (e.type === 'agent:heartbeat') { activeAgents.add(e.agentId); activeCount = activeAgents.size }
    else if (e.type === 'intent:declared') buckets[b].toolCalls++
    else if (e.type === 'failure:recorded') buckets[b].failures++

    buckets[b].active = activeCount
  }

  const sorted = Object.entries(buckets)
    .sort(([a], [b]) => Number(a) - Number(b))
    .map(([ts, v]) => ({ time: Number(ts), ...v }))

  // Fill gaps with zeroes
  if (sorted.length > 0) {
    const first = sorted[0].time
    const last = sorted[sorted.length - 1].time
    const result: typeof sorted = []
    for (let t = first; t <= last; t += BUCKET_MS) {
      const existing = sorted.find(s => s.time === t)
      result.push(existing ?? { time: t, active: 0, toolCalls: 0, failures: 0 })
    }
    return result
  }

  return sorted
}

function formatTime(ts: number) {
  const d = new Date(ts)
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}:${d.getSeconds().toString().padStart(2, '0')}`
}

export default function AgentTimeline() {
  const events = useMissionControlStore(s => s.activityEvents)

  const data = useMemo(() => bucketEvents(events), [events])

  if (data.length === 0) return null

  return (
    <div className="border border-[#171717] bg-[#020202] p-4 mb-3">
      <div className="text-[10px] text-orange-500 uppercase tracking-widest mb-3">
        Agent Activity (last 10 min)
      </div>
      <div className="h-[140px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
            <defs>
              <linearGradient id="activeGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#f97316" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#f97316" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="toolGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="failGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#ef4444" stopOpacity={0.3} />
                <stop offset="100%" stopColor="#ef4444" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="#1a1a1a" strokeDasharray="3 3" />
            <XAxis
              dataKey="time"
              tickFormatter={formatTime}
              stroke="#333"
              tick={{ fill: '#555', fontSize: 9, fontFamily: 'monospace' }}
              interval="preserveStartEnd"
              minTickGap={60}
            />
            <YAxis allowDecimals={false} stroke="#333" tick={{ fill: '#555', fontSize: 9, fontFamily: 'monospace' }} />
            <Tooltip
              contentStyle={{ background: '#0a0a0a', border: '1px solid #171717', borderRadius: 0, fontSize: 11, fontFamily: 'monospace' }}
              labelFormatter={formatTime}
              itemStyle={{ color: '#ccc' }}
            />
            <Area type="monotone" dataKey="active" name="Active Agents" stroke="#f97316" fill="url(#activeGrad)" strokeWidth={1.5} dot={false} />
            <Area type="monotone" dataKey="toolCalls" name="Tool Calls" stroke="#3b82f6" fill="url(#toolGrad)" strokeWidth={1.5} dot={false} />
            <Area type="monotone" dataKey="failures" name="Failures" stroke="#ef4444" fill="url(#failGrad)" strokeWidth={1.5} dot={false} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  )
}
