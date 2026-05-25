interface PermissionModalProps {
  agentId: string
  agentName: string
  requestId: string
  tool: string
  target: string
  reason: string
  onResolve: (decision: 'allow' | 'deny') => void
}

export function PermissionModal({ agentName, requestId, tool, target, reason, onResolve }: PermissionModalProps) {
  const resolve = async (decision: 'allow' | 'deny') => {
    await fetch(`/api/permissions/${requestId}/resolve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ decision }),
    })
    onResolve(decision)
  }

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50">
      <div className="bg-[#1a1d24] border border-[#ffaa00] rounded-lg p-6 max-w-lg w-full mx-4">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-[#ffaa00] text-lg">⚠</span>
          <span className="text-[#e8eaf0] font-mono">{agentName} needs permission</span>
        </div>
        <div className="space-y-2 mb-6 font-mono text-sm">
          <div>
            <span className="text-[#4a5066]">tool:</span>{' '}
            <span className="text-[#4488ff]">{tool}</span>
          </div>
          <div>
            <span className="text-[#4a5066]">target:</span>{' '}
            <span className="text-[#e8eaf0]">{target}</span>
          </div>
          {reason && (
            <div>
              <span className="text-[#4a5066]">reason:</span>{' '}
              <span className="text-[#7a8099]">{reason}</span>
            </div>
          )}
        </div>
        <div className="flex gap-3 justify-end">
          <button
            onClick={() => resolve('deny')}
            className="px-4 py-2 text-sm border border-[#ff3355] text-[#ff3355] rounded hover:bg-[#ff3355]/10"
          >
            Deny
          </button>
          <button
            onClick={() => resolve('allow')}
            className="px-4 py-2 text-sm bg-[#00ff88] text-[#0a0b0d] rounded font-mono hover:bg-[#00cc6a]"
          >
            Allow
          </button>
        </div>
      </div>
    </div>
  )
}
