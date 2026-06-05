import { useNavigate, useLocation } from 'react-router-dom'
import Clock from './Clock'

interface Props {
  title: string
  back?: boolean | string       // true = '/', string = path
  right?: React.ReactNode
  children: React.ReactNode
  footer?: React.ReactNode      // sticky bottom bar
  noPad?: boolean               // opt out of content padding
}

// ── Tailwind class map ──────────────────────────────────────────────────────
const classes = {
  wrapper:  'flex flex-col h-full overflow-hidden',
  header:   'flex items-center min-h-[64px] px-4 border-b border-[#dee2e6] bg-white shrink-0 gap-3',
  backBtn:  'bg-transparent border border-[#ced4da] rounded-lg px-4 py-2 text-[1.1rem] min-h-[48px] text-[#495057]',
  title:    'text-[1.3rem] font-bold grow',
  cogBtn:   'bg-transparent border-0 text-[#6c757d] text-[1.4rem] leading-none cursor-pointer px-1 rounded shrink-0 hover:text-[#212529]',
  content:  (noPad?: boolean) => `flex-1 min-h-0 overflow-x-hidden overflow-y-auto${noPad ? '' : ' p-4'}`,
  footer:   'border-t border-[#dee2e6] bg-white shrink-0',
}
// ───────────────────────────────────────────────────────────────────────────

export default function PageLayout({ title, back, right, children, footer, noPad }: Props) {
  const navigate = useNavigate()
  const location = useLocation()
  const backPath = back === true ? '/' : (back ?? null)

  return (
    <div className={classes.wrapper}>
      {/* Header */}
      <div className={classes.header}>
        {backPath && (
          <button onClick={() => navigate(backPath)} className={classes.backBtn}>
            ←
          </button>
        )}
        <span className={classes.title}>{title}</span>
        {location.pathname !== '/debug' && (
          <button onClick={() => navigate('/debug')} className={classes.cogBtn} title="Debug">
            ⚙
          </button>
        )}
        <Clock />
        {right}
      </div>

      {/* Scrollable content */}
      <div className={classes.content(noPad)}>
        {children}
      </div>

      {/* Sticky footer */}
      {footer && (
        <div className={classes.footer}>
          {footer}
        </div>
      )}
    </div>
  )
}
