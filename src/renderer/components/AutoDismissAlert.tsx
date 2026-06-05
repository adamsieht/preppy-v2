import { useEffect } from 'react'

interface Props {
  variant: 'success' | 'danger' | 'warning' | 'info'
  msg: string
  onDismiss: () => void
  /** ms before auto-dismiss; success=2500 danger=0 (manual only) */
  delay?: number
}

// ── Tailwind class map ──────────────────────────────────────────────────────
const variantClasses: Record<Props['variant'], string> = {
  success: 'bg-[#d1e7dd] border-[#badbcc] text-[#0f5132]',
  danger:  'bg-[#f8d7da] border-[#f5c2c7] text-[#842029]',
  warning: 'bg-[#fff3cd] border-[#ffecb5] text-[#664d03]',
  info:    'bg-[#cff4fc] border-[#b6effb] text-[#055160]',
}
// ───────────────────────────────────────────────────────────────────────────

export default function AutoDismissAlert({ variant, msg, onDismiss, delay }: Props) {
  const ms = delay ?? (variant === 'success' ? 2500 : 0)

  useEffect(() => {
    if (!ms) return
    const t = setTimeout(onDismiss, ms)
    return () => clearTimeout(t)
  }, [ms, onDismiss])

  return (
    <div className={`flex items-start justify-between gap-3 border rounded px-4 py-3 text-base mb-3 ${variantClasses[variant]}`}>
      <span>{msg}</span>
      <button
        onClick={onDismiss}
        aria-label="Close"
        className="shrink-0 font-bold text-lg leading-none opacity-75 hover:opacity-100"
      >
        ×
      </button>
    </div>
  )
}
