import { useEffect, useRef, useState } from 'react'
import { Line, Bar } from 'react-chartjs-2'
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Tooltip,
  Legend,
} from 'chart.js'
import dayjs from 'dayjs'
import PageLayout from '../../components/PageLayout'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, BarElement, Tooltip, Legend)

interface PrintJob {
  id: number
  template: string
  duration_hrs: number
  qty: number
  printed_at: string
  success: number
  error_msg: string | null
}

interface SensorLog {
  mac: string
  time: string
  temperature: number
  humidity?: number
  battery?: number
}

type LogLevel = 'all' | 'warn' | 'error'
type TabKey = 'summary' | 'printstats' | 'tempstats' | 'prints' | 'temps' | 'logs'

const TABS: { key: TabKey; title: string }[] = [
  { key: 'summary',    title: 'Summary'       },
  { key: 'printstats', title: 'Print Stats'   },
  { key: 'tempstats',  title: 'Temp Stats'    },
  { key: 'prints',     title: 'Print History' },
  { key: 'temps',      title: 'Temperature'   },
  { key: 'logs',       title: 'System Logs'   },
]

const DANGER_LOW = 31
const DANGER_HIGH = 41

const DURATION_LABELS: Record<number, string> = {
  4: '4 HR', 8: '8 HR', 12: '12 HR', 24: '1 DAY',
  48: '2 DAY', 72: '3 DAY', 168: '7 DAY', 336: '14 DAY', 720: '30 DAY',
}

// ── Tailwind class map ──────────────────────────────────────────────────────
const classes = {
  tabsBar:      'flex border-b-2 border-[#dee2e6] shrink-0 overflow-x-auto',
  tabBtn: (active: boolean) =>
    [
      'px-4 min-h-[48px] border-solid border-0 border-b-[3px] text-sm whitespace-nowrap cursor-pointer shrink-0',
      active ? 'border-[#0d6efd] bg-[#e7f1ff] font-semibold text-[#0d6efd]' : 'border-transparent bg-[#f8f9fa] text-[#495057]',
    ].join(' '),
  tabContent:   'p-4 overflow-y-auto flex-1 min-h-0',
  statsRow:     'flex flex-wrap gap-3 mb-6',
  sectionTitle: 'text-[#6c757d] text-sm font-semibold mb-2',
  table:        'w-full text-sm border-collapse',
  th:           'border-b-2 border-[#dee2e6] px-3 py-2 text-left font-semibold text-[#495057]',
  td:           'border-b border-[#dee2e6] px-3 py-2',
  tdMuted:      'border-b border-[#dee2e6] px-3 py-2 text-[#6c757d]',
  tdCenter:     'border-b border-[#dee2e6] px-3 py-2 text-center text-[#6c757d]',
  tdMono:       'border-b border-[#dee2e6] px-3 py-2 font-mono text-[0.8rem]',
  badge: (ok: boolean, _label?: string) =>
    [`inline-block px-2 py-[2px] rounded text-xs font-bold text-white`, ok ? 'bg-[#198754]' : 'bg-[#dc3545]'].join(' '),
  chartSection: 'flex flex-col gap-8',
  chartSm:      'max-w-[400px]',
  chartMd:      'max-w-[600px]',
  actionsRow:   'flex justify-end mb-2',
  exportBtn:    'border border-[#dee2e6] text-[#6c757d] bg-transparent rounded px-3 py-1 text-sm',
  emptyText:    'text-[#6c757d] mt-3',
  logBar:       'flex gap-2 mb-2',
  logFilterBtn: (active: boolean) =>
    [
      'border rounded px-3 py-1 text-sm font-bold',
      active ? 'bg-[#212529] text-white border-[#212529]' : 'bg-transparent text-[#212529] border-[#212529]',
    ].join(' '),
  copyAllBtn:   'ml-auto border border-[#dee2e6] text-[#6c757d] bg-transparent rounded px-3 py-1 text-sm',
  logViewer:    'h-[400px] overflow-y-auto font-mono text-[0.75rem] bg-[#1e1e1e] text-[#d4d4d4] p-3 rounded',
  twoCol:       'grid grid-cols-2 gap-6',
  colTitle:     'font-semibold mb-2',
}
// ───────────────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div
      className="bg-white border border-[#dee2e6] rounded-xl px-5 py-4 flex-1 min-w-[140px]"
      style={{ borderLeft: `4px solid ${color ?? '#0d6efd'}` }}
    >
      <div className="text-[0.75rem] text-[#6c757d] uppercase tracking-[1px] mb-1">{label}</div>
      <div className="text-[2rem] font-extrabold leading-none" style={{ color: color ?? '#212529' }}>{value}</div>
      {sub && <div className="text-[0.75rem] text-[#6c757d] mt-1">{sub}</div>}
    </div>
  )
}

function StatusBadge({ ok, label }: { ok: boolean; label?: string }) {
  return (
    <span className={classes.badge(ok)}>
      {label ?? (ok ? 'OK' : 'FAIL')}
    </span>
  )
}

export default function Reports() {
  const [tab, setTab] = useState<TabKey>('summary')
  const [prints, setPrints] = useState<PrintJob[]>([])
  const [tempLogs, setTempLogs] = useState<SensorLog[]>([])
  const [logLines, setLogLines] = useState<string[]>([])
  const [logFilter, setLogFilter] = useState<LogLevel>('all')
  const logRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    window.electronAPI.getPrintReport().then((data) => setPrints(data as PrintJob[]))
    window.electronAPI.getTempReport(undefined, 500).then((data) => setTempLogs(data as SensorLog[]))
    const cleanup = window.electronAPI.onLogLine((line) => {
      setLogLines((prev) => [...prev.slice(-500), line])
      setTimeout(() => logRef.current?.scrollTo(0, logRef.current.scrollHeight), 50)
    })
    return cleanup
  }, [])

  // ── Derived: Print stats ─────────────────────────────────────────────────
  const today = dayjs().format('YYYY-MM-DD')
  const printsToday = prints.filter(p => p.printed_at.startsWith(today))
  const labelsToday = printsToday.reduce((n, p) => n + p.qty, 0)
  const labelsTotal = prints.reduce((n, p) => n + p.qty, 0)
  const successRate = prints.length === 0 ? 100 : Math.round((prints.filter(p => p.success).length / prints.length) * 100)

  const byTemplate: Record<string, number> = {}
  for (const p of prints) byTemplate[p.template] = (byTemplate[p.template] ?? 0) + p.qty
  const templateLabels = Object.keys(byTemplate).sort()

  const byDuration: Record<string, number> = {}
  for (const p of prints) {
    const lbl = DURATION_LABELS[p.duration_hrs] ?? `${p.duration_hrs}h`
    byDuration[lbl] = (byDuration[lbl] ?? 0) + p.qty
  }
  const durationOrder = ['4 HR','8 HR','12 HR','1 DAY','2 DAY','3 DAY','7 DAY','14 DAY','30 DAY']
  const durationLabels = durationOrder.filter(l => byDuration[l])

  const byHour: number[] = Array(24).fill(0)
  for (const p of prints) { byHour[new Date(p.printed_at).getHours()] += p.qty }
  const hourLabels = Array.from({ length: 24 }, (_, i) => `${i}:00`)

  // ── Derived: Temp stats ──────────────────────────────────────────────────
  const macs = [...new Set(tempLogs.map(l => l.mac))]
  const sensorStats = macs.map(mac => {
    const entries = tempLogs.filter(l => l.mac === mac)
    const temps = entries.map(l => l.temperature)
    const outOfRange = entries.filter(l => l.temperature < DANGER_LOW || l.temperature > DANGER_HIGH).length
    const latest = entries[0]
    return {
      mac,
      min: Math.min(...temps).toFixed(1),
      max: Math.max(...temps).toFixed(1),
      avg: (temps.reduce((a, b) => a + b, 0) / temps.length).toFixed(1),
      outOfRange,
      readings: entries.length,
      humidity: latest?.humidity,
      battery: latest?.battery,
    }
  })
  const totalOutOfRange = sensorStats.reduce((n, s) => n + s.outOfRange, 0)

  // ── Chart data ───────────────────────────────────────────────────────────
  const colors = ['rgb(75,192,192)', 'rgb(255,99,132)', 'rgb(54,162,235)', 'rgb(255,205,86)']
  const allTimes = [...new Set(tempLogs.map(l => l.time))].sort().slice(-50)
  const tempChartData = {
    labels: allTimes,
    datasets: macs.map((mac, i) => {
      const byTime = new Map(tempLogs.filter(l => l.mac === mac).map(l => [l.time, l.temperature]))
      return { label: mac, data: allTimes.map(t => byTime.get(t) ?? null), borderColor: colors[i % colors.length], tension: 0.2, spanGaps: true }
    }),
  }

  const filteredLogs = logLines.filter(line => {
    if (logFilter === 'warn')  return line.includes('[warn]')  || line.includes('[error]')
    if (logFilter === 'error') return line.includes('[error]')
    return true
  })

  function exportCsv() {
    const headers = 'id,template,duration_hrs,qty,printed_at,success,error\n'
    const rows = prints.map(p =>
      [p.id, p.template, p.duration_hrs, p.qty, p.printed_at, p.success, p.error_msg ?? ''].join(',')
    ).join('\n')
    const blob = new Blob([headers + rows], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = 'print-history.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  const barOpts = { responsive: true, plugins: { legend: { display: false } } }

  return (
    <PageLayout title="Reports" back noPad>
      {/* Tab bar */}
      <div className={classes.tabsBar}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} className={classes.tabBtn(tab === t.key)}>
            {t.title}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className={classes.tabContent}>

        {/* ── Summary ──────────────────────────────────────────────────────── */}
        {tab === 'summary' && (
          <>
            <div className={classes.statsRow}>
              <StatCard label="Labels Today"       value={labelsToday}      sub={`${printsToday.length} print job${printsToday.length !== 1 ? 's' : ''}`} color="#0d6efd" />
              <StatCard label="Labels All-Time"    value={labelsTotal}      sub={`${prints.length} total jobs`} color="#6610f2" />
              <StatCard label="Success Rate"       value={`${successRate}%`} sub={`${prints.filter(p => !p.success).length} failures`} color={successRate === 100 ? '#198754' : '#dc3545'} />
              <StatCard label="Sensors"            value={macs.length}      sub={`${tempLogs.length} readings stored`} color="#0dcaf0" />
              <StatCard label="Out-of-Range Events" value={totalOutOfRange}  sub="temp < 31°F or > 41°F" color={totalOutOfRange > 0 ? '#dc3545' : '#198754'} />
            </div>
            <div className={classes.sectionTitle}>Recent Print Jobs</div>
            <table className={classes.table}>
              <thead>
                <tr>
                  <th className={classes.th}>Template</th>
                  <th className={classes.th}>Duration</th>
                  <th className={classes.th}>Qty</th>
                  <th className={classes.th}>Printed At</th>
                  <th className={classes.th}>Status</th>
                </tr>
              </thead>
              <tbody>
                {prints.slice(0, 10).map(p => (
                  <tr key={p.id}>
                    <td className={classes.td}>{p.template}</td>
                    <td className={classes.td}>{DURATION_LABELS[p.duration_hrs] ?? `${p.duration_hrs}h`}</td>
                    <td className={classes.td}>{p.qty}</td>
                    <td className={classes.td}>{dayjs(p.printed_at).format('MM/DD HH:mm')}</td>
                    <td className={classes.td}><StatusBadge ok={!!p.success} /></td>
                  </tr>
                ))}
                {prints.length === 0 && (
                  <tr><td colSpan={5} className={classes.tdCenter}>No print jobs recorded.</td></tr>
                )}
              </tbody>
            </table>
          </>
        )}

        {/* ── Print Stats ───────────────────────────────────────────────────── */}
        {tab === 'printstats' && (
          prints.length === 0 ? <p className={classes.emptyText}>No print data yet.</p> : (
            <div className={classes.chartSection}>
              <div>
                <div className={classes.sectionTitle}>Labels by Template</div>
                <div className={classes.chartSm}>
                  <Bar data={{ labels: templateLabels, datasets: [{ data: templateLabels.map(t => byTemplate[t]), backgroundColor: ['#0d6efd','#198754','#ffc107'] }] }} options={barOpts} />
                </div>
              </div>
              <div>
                <div className={classes.sectionTitle}>Labels by Duration Preset</div>
                <div className={classes.chartMd}>
                  <Bar data={{ labels: durationLabels, datasets: [{ data: durationLabels.map(l => byDuration[l]), backgroundColor: '#6610f2' }] }} options={barOpts} />
                </div>
              </div>
              <div>
                <div className={classes.sectionTitle}>Labels by Hour of Day</div>
                <Bar data={{ labels: hourLabels, datasets: [{ data: byHour, backgroundColor: '#0dcaf0' }] }} options={barOpts} />
              </div>
            </div>
          )
        )}

        {/* ── Temp Stats ────────────────────────────────────────────────────── */}
        {tab === 'tempstats' && (
          sensorStats.length === 0 ? <p className={classes.emptyText}>No temperature data available.</p> : (
            <table className={classes.table}>
              <thead>
                <tr>
                  <th className={classes.th}>Sensor</th>
                  <th className={classes.th}>Min °F</th>
                  <th className={classes.th}>Avg °F</th>
                  <th className={classes.th}>Max °F</th>
                  <th className={classes.th}>Humidity</th>
                  <th className={classes.th}>Battery</th>
                  <th className={classes.th}>Readings</th>
                  <th className={classes.th}>Out-of-Range</th>
                </tr>
              </thead>
              <tbody>
                {sensorStats.map(s => (
                  <tr key={s.mac}>
                    <td className={classes.tdMono}>{s.mac}</td>
                    <td className={classes.td} style={{ color: Number(s.min) < DANGER_LOW ? '#dc3545' : undefined }}>{s.min}°</td>
                    <td className={classes.td}>{s.avg}°</td>
                    <td className={classes.td} style={{ color: Number(s.max) > DANGER_HIGH ? '#dc3545' : undefined }}>{s.max}°</td>
                    <td className={classes.td}>{s.humidity != null ? `${Number(s.humidity).toFixed(0)}%` : '—'}</td>
                    <td className={classes.td}>{s.battery != null ? `${s.battery}%` : '—'}</td>
                    <td className={classes.td}>{s.readings}</td>
                    <td className={classes.td}><StatusBadge ok={s.outOfRange === 0} label={String(s.outOfRange)} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        )}

        {/* ── Print History ─────────────────────────────────────────────────── */}
        {tab === 'prints' && (
          <>
            <div className={classes.actionsRow}>
              <button onClick={exportCsv} className={classes.exportBtn}>Export CSV</button>
            </div>
            <table className={classes.table}>
              <thead>
                <tr>
                  <th className={classes.th}>#</th>
                  <th className={classes.th}>Template</th>
                  <th className={classes.th}>Duration</th>
                  <th className={classes.th}>Qty</th>
                  <th className={classes.th}>Printed At</th>
                  <th className={classes.th}>Status</th>
                </tr>
              </thead>
              <tbody>
                {prints.map(p => (
                  <tr key={p.id}>
                    <td className={classes.td}>{p.id}</td>
                    <td className={classes.td}>{p.template}</td>
                    <td className={classes.td}>{DURATION_LABELS[p.duration_hrs] ?? `${p.duration_hrs}h`}</td>
                    <td className={classes.td}>{p.qty}</td>
                    <td className={classes.td}>{dayjs(p.printed_at).format('MM/DD/YYYY HH:mm')}</td>
                    <td className={classes.td}><StatusBadge ok={!!p.success} /></td>
                  </tr>
                ))}
                {prints.length === 0 && (
                  <tr><td colSpan={6} className={classes.tdCenter}>No print jobs recorded.</td></tr>
                )}
              </tbody>
            </table>
          </>
        )}

        {/* ── Temperature chart ─────────────────────────────────────────────── */}
        {tab === 'temps' && (
          macs.length === 0 ? <p className={classes.emptyText}>No temperature data available.</p> : (
            <Line data={tempChartData} options={{ responsive: true, plugins: { legend: { position: 'top' } } }} />
          )
        )}

        {/* ── System Logs ───────────────────────────────────────────────────── */}
        {tab === 'logs' && (
          <>
            <div className={classes.logBar}>
              {(['all', 'warn', 'error'] as LogLevel[]).map(lvl => (
                <button key={lvl} onClick={() => setLogFilter(lvl)} className={classes.logFilterBtn(logFilter === lvl)}>
                  {lvl.toUpperCase()}
                </button>
              ))}
              <button onClick={() => navigator.clipboard.writeText(filteredLogs.join('\n'))} className={classes.copyAllBtn}>
                Copy All
              </button>
            </div>
            <div ref={logRef} className={classes.logViewer}>
              {filteredLogs.map((line, i) => (
                <div key={i} style={{ color: line.includes('[error]') ? '#f48771' : line.includes('[warn]') ? '#dcdcaa' : '#d4d4d4' }}>
                  {line}
                </div>
              ))}
              {filteredLogs.length === 0 && <div className="text-[#6c757d]">No log entries yet.</div>}
            </div>
          </>
        )}

      </div>
    </PageLayout>
  )
}
