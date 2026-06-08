export interface FeedbackMsg { ok: boolean; msg: string }

// ── Tailwind class map ──────────────────────────────────────────────────────
const classes = {
  ok:  'flex items-center gap-2 text-xs text-[#3fb950] mt-1',
  err: 'flex items-center gap-2 text-xs text-[#f85149] mt-1',
}
// ───────────────────────────────────────────────────────────────────────────

/** Inline ✓/✗ feedback line shared by every settings tab. Renders nothing when null. */
export default function Feedback({ fb }: { fb: FeedbackMsg | null }) {
  if (!fb) return null
  return (
    <div className={fb.ok ? classes.ok : classes.err}>
      <span>{fb.ok ? '✓' : '✗'}</span>
      <span>{fb.msg}</span>
    </div>
  )
}
