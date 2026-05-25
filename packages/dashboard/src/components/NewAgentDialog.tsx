import { useState } from 'react'
import { X, FolderOpen } from 'lucide-react'

type AgentKind = 'claude-code' | 'codex' | 'opencode' | 'custom'

interface NewAgentDialogProps {
  onClose: () => void
  onSpawned: (agentId?: string, assignedPort?: number) => void
}

export function NewAgentDialog({ onClose, onSpawned }: NewAgentDialogProps) {
  const [kind,        setKind]        = useState<AgentKind>('claude-code')
  const [name,        setName]        = useState('')
  const [task,        setTask]        = useState('')
  const [projectPath, setProjectPath] = useState('')
  const [loading,     setLoading]     = useState(false)
  const [error,       setError]       = useState('')

  const spawn = async () => {
    if (!name.trim() || !task.trim()) { setError('Name and task required'); return }
    setLoading(true); setError('')
    try {
      const resp = await fetch('/api/agents/spawn', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind,
          name:        name.trim(),
          task:        task.trim(),
          projectPath: projectPath.trim() || undefined,
        }),
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
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 backdrop-blur-sm">
      <div className="bg-[#020202] border border-[#2a2a2a] w-full max-w-md mx-4">

        {/* Header */}
        <div className="flex items-center justify-between px-7 py-5 border-b border-[#171717]">
          <span className="text-white font-mono uppercase tracking-wider text-sm">New Agent</span>
          <button onClick={onClose} className="text-[#555] hover:text-white transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="px-7 py-6 space-y-5">
          <div>
            <label className="block text-xs text-[#666] uppercase tracking-widest mb-2">Kind</label>
            <select
              value={kind}
              onChange={e => setKind(e.target.value as AgentKind)}
              className="w-full bg-black border border-[#2a2a2a] text-[#d4d4d4] text-sm font-mono px-3 py-2 outline-none focus:border-orange-500 transition-colors"
            >
              <option value="claude-code">claude-code</option>
              <option value="codex">codex</option>
              <option value="opencode">opencode</option>
              <option value="custom">custom</option>
            </select>
          </div>

          <div>
            <label className="block text-xs text-[#666] uppercase tracking-widest mb-2">Name</label>
            <input
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. auth-refactor"
              className="w-full bg-black border border-[#2a2a2a] text-[#d4d4d4] text-sm font-mono px-3 py-2 outline-none focus:border-orange-500 placeholder-[#444] transition-colors"
            />
          </div>

          <div>
            <label className="block text-xs text-[#666] uppercase tracking-widest mb-2">
              Project Path
              <span className="text-[#444] ml-2 normal-case tracking-normal">(optional — defaults to missioncontrol repo)</span>
            </label>
            <div className="flex gap-2">
              <input
                value={projectPath}
                onChange={e => setProjectPath(e.target.value)}
                placeholder="C:\Users\you\your-project"
                className="flex-1 bg-black border border-[#2a2a2a] text-[#d4d4d4] text-sm font-mono px-3 py-2 outline-none focus:border-orange-500 placeholder-[#444] transition-colors"
              />
              <div className="flex items-center px-3 border border-[#2a2a2a] text-[#555]" title="Enter path manually">
                <FolderOpen size={14} />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs text-[#666] uppercase tracking-widest mb-2">Task</label>
            <textarea
              value={task}
              onChange={e => setTask(e.target.value)}
              placeholder="Describe what this agent should do..."
              rows={3}
              className="w-full bg-black border border-[#2a2a2a] text-[#d4d4d4] text-sm font-mono px-3 py-2 outline-none focus:border-orange-500 placeholder-[#444] resize-none transition-colors"
            />
          </div>

          {error && <p className="text-xs text-red-500 font-mono">{error}</p>}
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-7 py-5 border-t border-[#171717]">
          <button
            onClick={onClose}
            className="flex-1 h-10 border border-[#2a2a2a] text-[#666] text-sm uppercase tracking-wider hover:border-[#444] hover:text-[#aaa] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={spawn}
            disabled={loading}
            className="flex-1 h-10 bg-orange-500 text-black text-sm uppercase tracking-wider font-semibold hover:bg-orange-400 disabled:opacity-40 transition-colors shadow-[0_0_20px_rgba(249,115,22,0.2)]"
          >
            {loading ? 'Spawning...' : 'Spawn Agent'}
          </button>
        </div>
      </div>
    </div>
  )
}
