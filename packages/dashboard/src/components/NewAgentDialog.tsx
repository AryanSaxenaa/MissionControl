import { useState } from 'react'

type AgentKind = 'claude-code' | 'codex' | 'opencode' | 'custom'

interface NewAgentDialogProps {
  onClose: () => void
  onSpawned: (agentId: string, assignedPort: number) => void
}

export function NewAgentDialog({ onClose, onSpawned }: NewAgentDialogProps) {
  const [kind, setKind] = useState<AgentKind>('claude-code')
  const [name, setName] = useState('')
  const [task, setTask] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const spawn = async () => {
    if (!name.trim() || !task.trim()) {
      setError('Name and task required')
      return
    }
    setLoading(true)
    setError('')
    try {
      const resp = await fetch('/api/agents/spawn', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind, name: name.trim(), task: task.trim() }),
      })
      if (!resp.ok) {
        const body = await resp.json().catch(() => ({}))
        setError((body as any).error ?? 'Spawn failed')
        return
      }
      const data = await resp.json()
      onSpawned(data.agentId, data.assignedPort)
      onClose()
    } catch (e: any) {
      setError(e.message ?? 'Network error')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-[#1a1d24] border border-[#1e2330] rounded-lg p-6 w-full max-w-md mx-4">
        <div className="flex items-center justify-between mb-5">
          <span className="text-[#e8eaf0] font-mono text-base">New Agent</span>
          <button onClick={onClose} className="text-[#7a8099] hover:text-[#e8eaf0]">✕</button>
        </div>

        <div className="space-y-4">
          <div>
            <label className="block text-xs text-[#7a8099] font-mono mb-1">KIND</label>
            <select
              value={kind}
              onChange={e => setKind(e.target.value as AgentKind)}
              className="w-full bg-[#111318] border border-[#1e2330] rounded px-3 py-2 text-sm font-mono text-[#e8eaf0] outline-none focus:border-[#4488ff]"
            >
              <option value="claude-code">claude-code</option>
              <option value="codex">codex</option>
              <option value="opencode">opencode</option>
              <option value="custom">custom</option>
            </select>
          </div>

          <div>
            <label className="block text-xs text-[#7a8099] font-mono mb-1">NAME</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. auth-refactor"
              className="w-full bg-[#111318] border border-[#1e2330] rounded px-3 py-2 text-sm font-mono text-[#e8eaf0] outline-none focus:border-[#4488ff]"
            />
          </div>

          <div>
            <label className="block text-xs text-[#7a8099] font-mono mb-1">TASK</label>
            <textarea
              value={task}
              onChange={e => setTask(e.target.value)}
              placeholder="Describe what this agent should do..."
              rows={3}
              className="w-full bg-[#111318] border border-[#1e2330] rounded px-3 py-2 text-sm font-mono text-[#e8eaf0] outline-none focus:border-[#4488ff] resize-none"
            />
          </div>

          {error && (
            <p className="text-xs text-[#ff3355] font-mono">{error}</p>
          )}

          <div className="flex gap-3 justify-end pt-1">
            <button
              onClick={onClose}
              className="px-4 py-2 text-sm border border-[#1e2330] text-[#7a8099] rounded hover:text-[#e8eaf0]"
            >
              Cancel
            </button>
            <button
              onClick={spawn}
              disabled={loading}
              className="px-4 py-2 text-sm bg-[#00ff88] text-[#0a0b0d] rounded font-mono hover:bg-[#00cc6a] disabled:opacity-50"
            >
              {loading ? 'Spawning...' : 'Spawn Agent'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
