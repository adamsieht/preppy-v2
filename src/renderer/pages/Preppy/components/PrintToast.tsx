import type { ToastState } from '../types'

export default function PrintToast({ qty, done, state, label, errorMsg, removing, onDismiss }: Omit<ToastState, 'id'> & { onDismiss: () => void }) {
  const fade   = removing ? 'opacity-0 translate-y-2' : 'opacity-100 translate-y-0'
  const pct    = qty > 0 ? Math.round((done / qty) * 100) : 0
  const isDone = state === 'success'

  // Outer shell — transitions background and border color smoothly between states
  const shellBg = state === 'error'   ? 'bg-[#3d1a1a] border-[#f85149]'
                : state === 'success' ? 'bg-[#1a4731] border-[#2ea043]'
                :                       'bg-[#161b22] border-[#30363d]'
  const shell = `pointer-events-auto w-[230px] border rounded-xl px-3 py-[10px] shadow-[0_8px_28px_rgba(0,0,0,0.55)] animate-slide-up transition-[opacity,transform,background-color,border-color] duration-300 ${shellBg} ${fade}`

  if (state === 'error') return (
    <div className={shell}>
      <div className="flex items-center gap-2">
        <span className="text-[#f85149]">✗</span>
        <span className="text-[#ff7b72] text-xs flex-1 truncate">{errorMsg ?? 'Print failed'}</span>
        <button onClick={onDismiss} className="shrink-0 text-[#f85149]/60 hover:text-[#f85149] text-lg leading-none cursor-pointer bg-transparent border-0">×</button>
      </div>
    </div>
  )

  // Printing and success share the same two-row DOM structure — no layout jump on transition
  return (
    <div className={shell} onClick={isDone ? onDismiss : undefined} style={{ cursor: isDone ? 'pointer' : undefined }}>
      <div className="flex items-center gap-[6px] mb-[7px]">
        <span className="text-sm leading-none shrink-0" style={{ color: isDone ? '#3fb950' : '#adbac7' }}>
          {isDone ? '✓' : '🖨'}
        </span>
        <span className="text-xs font-bold tabular-nums shrink-0" style={{ color: isDone ? '#3fb950' : '#ffffff' }}>
          {isDone ? `${qty} label${qty !== 1 ? 's' : ''}` : `${done}`}
          {!isDone && <span style={{ color: '#6e7681', fontWeight: 400 }}>/{qty}</span>}
        </span>
        {label && (
          <span className="text-xs truncate" style={{ color: isDone ? '#2ea043' : '#8b949e' }}>{label}</span>
        )}
      </div>
      <div className="h-[5px] bg-[#21262d] rounded-full overflow-hidden">
        <div
          className={isDone ? '' : 'animate-progress-stripes'}
          style={{
            height: '100%',
            borderRadius: '9999px',
            backgroundColor: isDone ? '#2ea043' : '#28a745',
            width: `${pct}%`,
            transition: 'width 0.95s ease-out, background-color 0.3s ease',
          }}
        />
      </div>
    </div>
  )
}
