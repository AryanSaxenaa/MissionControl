import { useEffect, useState } from 'react'

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
  const [data, setData] = useState<DiffData | null>(null)
  const [commitMessage, setCommitMessage] = useState('')
  const [loading, setLoading] = useState(false)

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
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
      <div className="bg-[#111318] border border-[#1e2330] rounded-lg w-full max-w-5xl mx-4 max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-[#1e2330]">
          <span className="text-[#e8eaf0] font-mono">Review &amp; Merge — {data?.task ?? agentId}</span>
          <button onClick={onClose} className="text-[#7a8099] hover:text-[#e8eaf0]">✕</button>
        </div>

        <div className="flex flex-1 min-h-0 divide-x divide-[#1e2330]">
          {/* Diff panel */}
          <div className="flex-1 overflow-auto p-4">
            <div className="text-[#4a5066] text-xs mb-2 font-mono">CHANGES</div>
            <pre className="text-xs font-mono whitespace-pre-wrap text-[#7a8099]">
              {data?.diff || 'Loading diff...'}
            </pre>
          </div>

          {/* HydraDB context panel */}
          <div className="w-80 overflow-auto p-4 flex-shrink-0">
            <div className="text-[#4a5066] text-xs mb-2 font-mono">WHY (from memory)</div>
            <p className="text-sm text-[#7a8099]">
              {data?.contextSummary || 'Loading context...'}
            </p>
          </div>
        </div>

        <div className="p-4 border-t border-[#1e2330] flex items-center gap-3">
          <input
            value={commitMessage}
            onChange={e => setCommitMessage(e.target.value)}
            placeholder={data?.task ?? 'Commit message...'}
            className="flex-1 bg-[#1a1d24] border border-[#1e2330] rounded px-3 py-1.5 text-sm font-mono text-[#e8eaf0] outline-none focus:border-[#4488ff]"
          />
          <button
            onClick={discard}
            disabled={loading}
            className="px-4 py-2 text-sm border border-[#1e2330] text-[#7a8099] rounded hover:border-[#ff3355] hover:text-[#ff3355] disabled:opacity-50"
          >
            Discard
          </button>
          <button
            onClick={merge}
            disabled={loading}
            className="px-4 py-2 text-sm bg-[#00ff88] text-[#0a0b0d] rounded font-mono hover:bg-[#00cc6a] disabled:opacity-50"
          >
            Merge
          </button>
        </div>
      </div>
    </div>
  )
}
