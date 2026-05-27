import { useState, useEffect } from 'react'
import { X } from 'lucide-react'
import type { AgentKind } from '@missioncontrol/types'

const KIND_LABELS: Record<AgentKind, string> = {
  'claude-code': 'Claude Code',
  'codex':       'Codex',
  'opencode':    'OpenCode',
  'custom':      'Custom Shell',
}

interface NewAgentDialogProps {
  onClose: () => void
  onSpawned: (agentId?: string, assignedPort?: number) => void
}

export function NewAgentDialog({ onClose, onSpawned }: NewAgentDialogProps) {
  const [kind,        setKind]        = useState<AgentKind>('claude-code')
  const [task,        setTask]        = useState('')
  const [projectPath, setProjectPath] = useState('')
  const [loading,     setLoading]     = useState(false)
  const [error,       setError]       = useState('')

  // Prefill projectPath with the server's cwd so first-time users don't get a 400.
  useEffect(() => {
    fetch('/api/server-info')
      .then(r => r.json())
      .then((info: { cwd: string }) => {
        setProjectPath(prev => prev || info.cwd)
      })
      .catch(() => {})
  }, [])

  const spawn = async () => {
    if (!projectPath.trim()) { setError('Project path is required'); return }
    setLoading(true); setError('')
    try {
      const name = `${kind}-${Date.now().toString(36)}`
      const resp = await fetch('/api/agents/spawn', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          kind,
          name,
          task:        task.trim(),
          projectPath: projectPath.trim(),
        }),
      })
      if (!resp.ok) {
        const body = await resp.json().catch(() => ({}))
        const msg = (body as any).error ?? 'Spawn failed'
        setError(msg)
        return
      }
      const data = await resp.json()
      onSpawned(data.agentId, data.assignedPort)
      onClose()
    } catch (e: any) {
      setError(`Cannot reach server — ${e.message ?? 'network error'}`)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 backdrop-blur-sm">
      <div className="bg-[#020202] border border-[#2a2a2a] w-full max-w-sm mx-4">

        {/* Header */}
        <div className="flex items-center justify-between px-7 py-5 border-b border-[#171717]">
          <span className="text-white font-mono uppercase tracking-wider text-sm">Spawn Agent</span>
          <button onClick={onClose} className="text-[#555] hover:text-white transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="px-7 py-6 space-y-5">

          {/* Kind picker */}
          <div>
            <label className="block text-xs text-[#666] uppercase tracking-widest mb-3">AI</label>
            <div className="grid grid-cols-2 gap-2">
              {(Object.keys(KIND_LABELS) as AgentKind[]).map(k => (
                <button
                  key={k}
                  onClick={() => setKind(k)}
                  className={`py-3 px-4 text-sm font-mono border transition-all text-left ${
                    kind === k
                      ? 'border-orange-500 text-orange-500 bg-orange-500/5'
                      : 'border-[#2a2a2a] text-[#666] hover:border-[#444] hover:text-[#aaa]'
                  }`}
                >
                  {KIND_LABELS[k]}
                </button>
              ))}
            </div>
          </div>

          {/* Project path */}
          <div>
            <label className="block text-xs text-[#666] uppercase tracking-widest mb-2">
              Project Path
            </label>
            <input
              value={projectPath}
              onChange={e => setProjectPath(e.target.value)}
              placeholder="C:\Users\you\your-project"
              className="w-full bg-black border border-[#2a2a2a] text-[#d4d4d4] text-sm font-mono px-3 py-2 outline-none focus:border-orange-500 placeholder-[#444] transition-colors"
            />
            <p className="text-[#444] text-xs mt-1">Absolute path to the project the AI will work in</p>
          </div>

          {/* Task description */}
          <div>
            <label className="block text-xs text-[#666] uppercase tracking-widest mb-2">
              Task
              <span className="text-[#444] ml-2 normal-case tracking-normal text-[10px]">optional — leave blank for interactive mode</span>
            </label>
            <textarea
              value={task}
              onChange={e => setTask(e.target.value)}
              placeholder="e.g. Fix all TypeScript errors in src/"
              rows={2}
              className="w-full bg-black border border-[#2a2a2a] text-[#d4d4d4] text-sm font-mono px-3 py-2 outline-none focus:border-orange-500 placeholder-[#444] resize-none transition-colors"
            />
          </div>

          {error && <p className="text-xs text-red-500 font-mono">{error}</p>}
        </div>

        {/* Footer */}
        <div className="px-7 py-5 border-t border-[#171717]">
          <button
            onClick={spawn}
            disabled={loading}
            className="w-full h-11 bg-orange-500 text-black text-sm uppercase tracking-[0.15em] font-semibold hover:bg-orange-400 disabled:opacity-40 transition-colors shadow-[0_0_20px_rgba(249,115,22,0.2)]"
          >
            {loading ? 'Launching...' : `Launch ${KIND_LABELS[kind]}`}
          </button>
        </div>
      </div>
    </div>
  )
}
