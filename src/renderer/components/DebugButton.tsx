import { useNavigate, useLocation } from 'react-router-dom'

// ── Tailwind class map ──────────────────────────────────────────────────────
const classes = {
  btn: 'fixed bottom-4 right-4 z-[9999] bg-[rgba(220,53,69,0.85)] text-white border-0 rounded-md px-3 py-[6px] text-[0.75rem] font-mono font-bold tracking-[1px] cursor-pointer backdrop-blur-sm shadow-[0_2px_8px_rgba(0,0,0,0.3)] select-none',
}
// ───────────────────────────────────────────────────────────────────────────

export default function DebugButton() {
  const navigate = useNavigate()
  const location = useLocation()

  if (location.pathname === '/debug') return null

  return (
    <button onClick={() => navigate('/debug')} title="Open debug panel" className={classes.btn}>
      DEBUG
    </button>
  )
}
