import { useMissionControlStore } from '../store/useStore'
import { X, AlertTriangle } from 'lucide-react'

export function ErrorToast() {
  const errors = useMissionControlStore((s) => s.errors)
  const dismiss = useMissionControlStore((s) => s.dismissError)

  if (errors.length === 0) return null

  return (
    <div className="fixed bottom-5 right-5 z-[100] flex flex-col gap-2 max-w-sm w-full pointer-events-none">
      {errors.map((e) => (
        <div
          key={e.id}
          className="pointer-events-auto bg-[#1a0000] border border-red-500/30 text-red-400 rounded px-4 py-3 text-xs font-mono shadow-[0_0_30px_rgba(239,68,68,0.1)] animate-in slide-in-from-right"
        >
          <div className="flex items-start gap-2.5">
            <AlertTriangle size={14} className="flex-shrink-0 mt-0.5 text-red-500" />
            <span className="flex-1 leading-relaxed">{e.message}</span>
            <button
              onClick={() => dismiss(e.id)}
              className="flex-shrink-0 text-red-500/60 hover:text-red-400 transition-colors"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      ))}
    </div>
  )
}
