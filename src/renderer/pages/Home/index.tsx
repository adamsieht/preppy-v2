import { useNavigate } from 'react-router-dom'
import Clock from '../../components/Clock'

const NAV_ITEMS = [
  { label: 'Print Labels', path: '/preppy',  bg: '#0d6efd', color: '#fff'     },
  { label: 'Custom Label', path: '/printx',  bg: '#6c757d', color: '#fff'     },
  { label: 'Temperatures', path: '/tempy',   bg: '#0dcaf0', color: '#000'     },
  { label: 'Prep List',    path: '/tally',   bg: '#ffc107', color: '#000'     },
  { label: 'Reports',      path: '/reports', bg: '#212529', color: '#fff'     },
  { label: 'WiFi',         path: '/wifi',    bg: '#f8f9fa', color: '#212529'  },
]

// ── Tailwind class map ──────────────────────────────────────────────────────
const classes = {
  wrapper:  'flex flex-col h-full p-3 gap-2',
  clockBar: 'px-2 py-1 shrink-0',
  grid:     'grid grid-cols-2 gap-[10px] flex-1',
  navBtn:   'border-0 rounded-xl text-[1.3rem] font-bold cursor-pointer flex items-center justify-center shadow-[0_2px_6px_rgba(0,0,0,0.12)]',
}
// ───────────────────────────────────────────────────────────────────────────

export default function Home() {
  const navigate = useNavigate()

  return (
    <div className={classes.wrapper}>
      <div className={classes.clockBar}>
        <Clock />
      </div>
      <div className={classes.grid}>
        {NAV_ITEMS.map(({ label, path, bg, color }) => (
          <button
            key={path}
            onClick={() => navigate(path)}
            className={classes.navBtn}
            style={{ background: bg, color }}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  )
}
