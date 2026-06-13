import { useNavigate, useSearchParams } from 'react-router-dom'
import PageLayout from '../../components/PageLayout'
import GeneralTab from './tabs/GeneralTab'
import PrinterTab from './tabs/PrinterTab'
import CalibrationTab from './tabs/CalibrationTab'
import NetworkTab from './tabs/NetworkTab'
import DateTimeTab from './tabs/DateTimeTab'
import LabelsTab from './tabs/LabelsTab'
import UpdatesTab from './tabs/UpdatesTab'

type TabKey = 'general' | 'printer' | 'calibration' | 'network' | 'datetime' | 'labels' | 'updates'

// Tab registry — add a new entry here to add a settings category. The sidebar and
// content area are both driven off this list, so no other wiring is needed.
const TABS: { key: TabKey; title: string; icon: string; Component: React.ComponentType }[] = [
  { key: 'general',     title: 'General',     icon: '🗂',  Component: GeneralTab },
  { key: 'printer',     title: 'Printer',     icon: '🖨',  Component: PrinterTab },
  { key: 'calibration', title: 'Calibration', icon: '🎯', Component: CalibrationTab },
  { key: 'network',     title: 'Network',     icon: '📶', Component: NetworkTab },
  { key: 'datetime',    title: 'Date & Time', icon: '🕐', Component: DateTimeTab },
  { key: 'labels',      title: 'Labels',      icon: '🏷', Component: LabelsTab  },
  { key: 'updates',     title: 'Updates',     icon: '⬆', Component: UpdatesTab },
]

// External pages reachable from the settings sidebar (kept as their own routes).
const LINKS: { title: string; icon: string; path: string }[] = [
  { title: 'Reports',     icon: '📊', path: '/reports' },
  { title: 'Diagnostics', icon: '🛠', path: '/debug' },
]

const classes = {
  layout:    'flex h-full min-h-0',
  sidebar:   'w-56 shrink-0 border-r border-[#30363d] bg-[#0d1117] overflow-y-auto scrollbar-dark flex flex-col py-3',
  navItem: (active: boolean) =>
    `flex items-center gap-3 mx-2 px-3 py-[10px] rounded-lg text-sm font-semibold cursor-pointer text-left transition-colors ${
      active ? 'bg-[#161b22] text-white border border-[#30363d]' : 'text-[#adbac7] border border-transparent hover:bg-[#161b22] hover:text-white'
    }`,
  navIcon:    'text-base leading-none w-5 text-center',
  groupLabel: 'px-5 pt-4 pb-1 text-[10px] font-bold uppercase tracking-widest text-[#6e7681]',
  content:    'flex-1 min-w-0 overflow-y-auto scrollbar-dark p-5 bg-[#0d1117]',
}

export default function Settings() {
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const paramTab = params.get('tab') as TabKey | null
  const active: TabKey = TABS.some(t => t.key === paramTab) ? paramTab! : 'general'
  const Active = TABS.find(t => t.key === active)!.Component

  return (
    <PageLayout title="Settings" back="/" noPad>
      <div className={classes.layout}>

        {/* ── Sidebar ── */}
        <nav className={classes.sidebar}>
          {TABS.map(t => (
            <button
              key={t.key}
              onClick={() => setParams({ tab: t.key }, { replace: true })}
              className={classes.navItem(active === t.key)}
            >
              <span className={classes.navIcon}>{t.icon}</span>
              {t.title}
            </button>
          ))}

          <div className={classes.groupLabel}>More</div>
          {LINKS.map(l => (
            <button key={l.path} onClick={() => navigate(l.path)} className={classes.navItem(false)}>
              <span className={classes.navIcon}>{l.icon}</span>
              {l.title}
            </button>
          ))}
        </nav>

        {/* ── Content ── */}
        <div className={classes.content}>
          <Active />
        </div>

      </div>
    </PageLayout>
  )
}
