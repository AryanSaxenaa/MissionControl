import { X } from 'lucide-react'

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
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 backdrop-blur-sm">
      <div className="bg-[#020202] border border-orange-500/50 w-full max-w-lg mx-4 shadow-[0_0_40px_rgba(249,115,22,0.15)]">

        {/* Header */}
        <div className="flex items-center justify-between px-7 py-5 border-b border-[#171717]">
          <div className="flex items-center gap-3">
            <span className="w-2 h-2 rounded-full bg-orange-500 animate-pulse" />
            <span className="text-orange-500 font-mono uppercase tracking-wider text-sm">
              Permission Required
            </span>
          </div>
          <button onClick={() => resolve('deny')} className="text-[#555] hover:text-white transition-colors">
            <X size={16} />
          </button>
        </div>

        {/* Agent */}
        <div className="px-7 pt-5 pb-2">
          <span className="text-[#888] text-xs uppercase tracking-widest">Agent: </span>
          <span className="text-white text-sm font-mono">{agentName}</span>
        </div>

        {/* Details */}
        <div className="px-7 py-4 space-y-3 font-mono text-sm">
          <div className="flex gap-3">
            <span className="text-[#555] uppercase text-xs w-14 pt-0.5">Tool</span>
            <span className="text-orange-400">{tool}</span>
          </div>
          <div className="flex gap-3">
            <span className="text-[#555] uppercase text-xs w-14 pt-0.5">Target</span>
            <span className="text-[#d4d4d4] break-all">{target}</span>
          </div>
          {reason && (
            <div className="flex gap-3">
              <span className="text-[#555] uppercase text-xs w-14 pt-0.5">Reason</span>
              <span className="text-[#888]">{reason}</span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-3 px-7 py-5 border-t border-[#171717]">
          <button
            onClick={() => resolve('deny')}
            className="flex-1 h-10 border border-red-500/50 text-red-500 text-sm uppercase tracking-wider hover:bg-red-500/10 transition-colors"
          >
            Deny
          </button>
          <button
            onClick={() => resolve('allow')}
            className="flex-1 h-10 bg-orange-500 text-black text-sm uppercase tracking-wider font-semibold hover:bg-orange-400 transition-colors shadow-[0_0_20px_rgba(249,115,22,0.2)]"
          >
            Allow
          </button>
        </div>
      </div>
    </div>
  )
}
