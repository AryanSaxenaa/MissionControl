import { useEffect, useState } from 'react'
import { X, GitMerge, Trash2 } from 'lucide-react'

interface MergeReviewProps {
  agentId: string
  onClose: () => void
}

interface DiffData {
  diff: string
  agentName: string
  task: string
  contextSummary: string
}

export function MergeReview({ agentId, onClose }: MergeReviewProps) {
  const [data,          setData]          = useState<DiffData | null>(null)
  const [commitMessage, setCommitMessage] = useState('')
  const [loading,       setLoading]       = useState(false)

  useEffect(() => {
    fetch(`/api/agents/${agentId}/diff`)
      .then(r => r.json())
      .then(setData)
      .catch(() => {})
  }, [agentId])

  const merge = async () => {
    setLoading(true)
    await fetch(`/api/agents/${agentId}/merge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ commitMessage: commitMessage || data?.task }),
    })
    setLoading(false)
    onClose()
  }

  const discard = async () => {
    setLoading(true)
    await fetch(`/api/agents/${agentId}/discard`, { method: 'POST' })
    setLoading(false)
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 backdrop-blur-sm">
      <div className="bg-[#020202] border border-[#2a2a2a] w-full max-w-5xl mx-4 max-h-[90vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-7 py-5 border-b border-[#171717]">
          <div className="flex items-center gap-3">
            <GitMerge size={16} className="text-orange-500" />
            <span className="text-white font-mono uppercase tracking-wider text-sm">
              Review &amp; Merge — {data?.task ?? agentId}
            </span>
          </div>
          <button onClick={onClose} className="text-[#555] hover:text-white transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="flex flex-1 min-h-0 divide-x divide-[#171717]">

          {/* Diff */}
          <div className="flex-1 overflow-auto p-6">
            <div className="text-[#555] text-xs uppercase tracking-widest mb-3">Changes</div>
            <pre className="text-xs font-mono whitespace-pre-wrap text-[#888] leading-relaxed">
              {data?.diff || 'Loading diff...'}
            </pre>
          </div>

          {/* Context */}
          <div className="w-80 overflow-auto p-6 flex-shrink-0">
            <div className="text-[#555] text-xs uppercase tracking-widest mb-3">Why (from memory)</div>
            <p className="text-sm text-[#888] leading-relaxed font-mono">
              {data?.contextSummary || 'Loading context...'}
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="px-7 py-5 border-t border-[#171717] flex items-center gap-3">
          <input
            value={commitMessage}
            onChange={e => setCommitMessage(e.target.value)}
            placeholder={data?.task ?? 'Commit message...'}
            className="flex-1 bg-black border border-[#2a2a2a] text-[#d4d4d4] text-sm font-mono px-3 py-2 outline-none focus:border-orange-500 placeholder-[#444] transition-colors"
          />
          <button
            onClick={discard}
            disabled={loading}
            className="h-10 px-4 border border-[#2a2a2a] text-[#666] text-sm uppercase tracking-wider hover:border-red-500/50 hover:text-red-500 disabled:opacity-40 transition-colors flex items-center gap-2"
          >
            <Trash2 size={14} />
            Discard
          </button>
          <button
            onClick={merge}
            disabled={loading}
            className="h-10 px-6 bg-orange-500 text-black text-sm uppercase tracking-wider font-semibold hover:bg-orange-400 disabled:opacity-40 transition-colors shadow-[0_0_20px_rgba(249,115,22,0.2)] flex items-center gap-2"
          >
            <GitMerge size={14} />
            Merge
          </button>
        </div>
      </div>
    </div>
  )
}
