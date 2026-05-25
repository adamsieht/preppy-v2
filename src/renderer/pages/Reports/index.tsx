import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Container, Tab, Tabs, Table, Button, Badge } from 'react-bootstrap'
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

const DANGER_LOW = 31
const DANGER_HIGH = 41

const DURATION_LABELS: Record<number, string> = {
  4: '4 HR', 8: '8 HR', 12: '12 HR', 24: '1 DAY',
  48: '2 DAY', 72: '3 DAY', 168: '7 DAY', 336: '14 DAY', 720: '30 DAY',
}

function StatCard({ label, value, sub, color }: { label: string; value: string | number; sub?: string; color?: string }) {
  return (
    <div style={{
      background: '#fff', border: '1px solid #dee2e6', borderRadius: 10,
      padding: '16px 20px', flex: 1, minWidth: 140,
      borderLeft: `4px solid ${color ?? '#0d6efd'}`,
    }}>
      <div style={{ fontSize: '0.75rem', color: '#6c757d', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: '2rem', fontWeight: 800, color: color ?? '#212529', lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontSize: '0.75rem', color: '#6c757d', marginTop: 4 }}>{sub}</div>}
    </div>
  )
}

export default function Reports() {
  const navigate = useNavigate()
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

  // ── Derived: Print stats ──────────────────────────────────────────────────
  const today = dayjs().format('YYYY-MM-DD')
  const printsToday = prints.filter(p => p.printed_at.startsWith(today))
  const labelsToday = printsToday.reduce((n, p) => n + p.qty, 0)
  const labelsTotal = prints.reduce((n, p) => n + p.qty, 0)
  const successRate = prints.length === 0 ? 100 : Math.round((prints.filter(p => p.success).length / prints.length) * 100)

  // By template
  const byTemplate: Record<string, number> = {}
  for (const p of prints) byTemplate[p.template] = (byTemplate[p.template] ?? 0) + p.qty
  const templateLabels = Object.keys(byTemplate).sort()

  // By duration preset
  const byDuration: Record<string, number> = {}
  for (const p of prints) {
    const lbl = DURATION_LABELS[p.duration_hrs] ?? `${p.duration_hrs}h`
    byDuration[lbl] = (byDuration[lbl] ?? 0) + p.qty
  }
  const durationOrder = ['4 HR','8 HR','12 HR','1 DAY','2 DAY','3 DAY','7 DAY','14 DAY','30 DAY']
  const durationLabels = durationOrder.filter(l => byDuration[l])

  // By hour of day
  const byHour: number[] = Array(24).fill(0)
  for (const p of prints) {
    const hr = new Date(p.printed_at).getHours()
    byHour[hr] += p.qty
  }
  const hourLabels = Array.from({ length: 24 }, (_, i) => `${i}:00`)

  // ── Derived: Temp stats ───────────────────────────────────────────────────
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

  // ── Chart data: temp line ─────────────────────────────────────────────────
  const colors = ['rgb(75,192,192)', 'rgb(255,99,132)', 'rgb(54,162,235)', 'rgb(255,205,86)']
  const allTimes = [...new Set(tempLogs.map(l => l.time))].sort().slice(-50)
  const tempChartData = {
    labels: allTimes,
    datasets: macs.map((mac, i) => {
      const byTime = new Map(tempLogs.filter(l => l.mac === mac).map(l => [l.time, l.temperature]))
      return {
        label: mac,
        data: allTimes.map(t => byTime.get(t) ?? null),
        borderColor: colors[i % colors.length],
        tension: 0.2,
        spanGaps: true,
      }
    }),
  }

  // ── Misc ──────────────────────────────────────────────────────────────────
  const filteredLogs = logLines.filter(line => {
    if (logFilter === 'warn') return line.includes('[warn]') || line.includes('[error]')
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
    <Container fluid className="p-4">
      <div className="d-flex align-items-center mb-4">
        <Button variant="outline-secondary" size="sm" onClick={() => navigate('/')} className="me-3">← Back</Button>
        <h4 className="mb-0">Reports</h4>
      </div>

      <Tabs defaultActiveKey="summary" className="mb-3">

        {/* ── Summary ─────────────────────────────────────────────────────── */}
        <Tab eventKey="summary" title="Summary">
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, marginBottom: 24 }}>
            <StatCard label="Labels Today" value={labelsToday} sub={`${printsToday.length} print job${printsToday.length !== 1 ? 's' : ''}`} color="#0d6efd" />
            <StatCard label="Labels All-Time" value={labelsTotal} sub={`${prints.length} total jobs`} color="#6610f2" />
            <StatCard label="Success Rate" value={`${successRate}%`} sub={`${prints.filter(p => !p.success).length} failures`} color={successRate === 100 ? '#198754' : '#dc3545'} />
            <StatCard label="Sensors" value={macs.length} sub={`${tempLogs.length} readings stored`} color="#0dcaf0" />
            <StatCard label="Out-of-Range Events" value={totalOutOfRange} sub="temp < 31°F or > 41°F" color={totalOutOfRange > 0 ? '#dc3545' : '#198754'} />
          </div>

          <h6 className="text-muted mb-2">Recent Print Jobs</h6>
          <Table hover size="sm" responsive>
            <thead>
              <tr><th>Template</th><th>Duration</th><th>Qty</th><th>Printed At</th><th>Status</th></tr>
            </thead>
            <tbody>
              {prints.slice(0, 10).map(p => (
                <tr key={p.id}>
                  <td>{p.template}</td>
                  <td>{DURATION_LABELS[p.duration_hrs] ?? `${p.duration_hrs}h`}</td>
                  <td>{p.qty}</td>
                  <td>{dayjs(p.printed_at).format('MM/DD HH:mm')}</td>
                  <td><Badge bg={p.success ? 'success' : 'danger'}>{p.success ? 'OK' : 'FAIL'}</Badge></td>
                </tr>
              ))}
              {prints.length === 0 && (
                <tr><td colSpan={5} className="text-center text-muted">No print jobs recorded.</td></tr>
              )}
            </tbody>
          </Table>
        </Tab>

        {/* ── Print Stats ─────────────────────────────────────────────────── */}
        <Tab eventKey="printstats" title="Print Stats">
          {prints.length === 0 ? (
            <p className="text-muted mt-3">No print data yet.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
              <div>
                <h6 className="text-muted mb-2">Labels by Template</h6>
                <div style={{ maxWidth: 400 }}>
                  <Bar
                    data={{
                      labels: templateLabels,
                      datasets: [{ data: templateLabels.map(t => byTemplate[t]), backgroundColor: ['#0d6efd','#198754','#ffc107'] }],
                    }}
                    options={barOpts}
                  />
                </div>
              </div>

              <div>
                <h6 className="text-muted mb-2">Labels by Duration Preset</h6>
                <div style={{ maxWidth: 600 }}>
                  <Bar
                    data={{
                      labels: durationLabels,
                      datasets: [{ data: durationLabels.map(l => byDuration[l]), backgroundColor: '#6610f2' }],
                    }}
                    options={barOpts}
                  />
                </div>
              </div>

              <div>
                <h6 className="text-muted mb-2">Labels by Hour of Day</h6>
                <Bar
                  data={{
                    labels: hourLabels,
                    datasets: [{ data: byHour, backgroundColor: '#0dcaf0' }],
                  }}
                  options={barOpts}
                />
              </div>
            </div>
          )}
        </Tab>

        {/* ── Temp Stats ──────────────────────────────────────────────────── */}
        <Tab eventKey="tempstats" title="Temp Stats">
          {sensorStats.length === 0 ? (
            <p className="text-muted mt-3">No temperature data available.</p>
          ) : (
            <>
              <Table hover size="sm" responsive className="mt-2">
                <thead>
                  <tr>
                    <th>Sensor</th>
                    <th>Min °F</th>
                    <th>Avg °F</th>
                    <th>Max °F</th>
                    <th>Humidity</th>
                    <th>Battery</th>
                    <th>Readings</th>
                    <th>Out-of-Range</th>
                  </tr>
                </thead>
                <tbody>
                  {sensorStats.map(s => (
                    <tr key={s.mac}>
                      <td style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{s.mac}</td>
                      <td style={{ color: Number(s.min) < DANGER_LOW ? '#dc3545' : undefined }}>{s.min}°</td>
                      <td>{s.avg}°</td>
                      <td style={{ color: Number(s.max) > DANGER_HIGH ? '#dc3545' : undefined }}>{s.max}°</td>
                      <td>{s.humidity != null ? `${Number(s.humidity).toFixed(0)}%` : '—'}</td>
                      <td>{s.battery != null ? `${s.battery}%` : '—'}</td>
                      <td>{s.readings}</td>
                      <td>
                        {s.outOfRange > 0
                          ? <Badge bg="danger">{s.outOfRange}</Badge>
                          : <Badge bg="success">0</Badge>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            </>
          )}
        </Tab>

        {/* ── Print History ───────────────────────────────────────────────── */}
        <Tab eventKey="prints" title="Print History">
          <div className="d-flex justify-content-end mb-2">
            <Button variant="outline-secondary" size="sm" onClick={exportCsv}>Export CSV</Button>
          </div>
          <Table hover size="sm" responsive>
            <thead>
              <tr><th>#</th><th>Template</th><th>Duration</th><th>Qty</th><th>Printed At</th><th>Status</th></tr>
            </thead>
            <tbody>
              {prints.map(p => (
                <tr key={p.id}>
                  <td>{p.id}</td>
                  <td>{p.template}</td>
                  <td>{DURATION_LABELS[p.duration_hrs] ?? `${p.duration_hrs}h`}</td>
                  <td>{p.qty}</td>
                  <td>{dayjs(p.printed_at).format('MM/DD/YYYY HH:mm')}</td>
                  <td><Badge bg={p.success ? 'success' : 'danger'}>{p.success ? 'OK' : 'FAIL'}</Badge></td>
                </tr>
              ))}
              {prints.length === 0 && (
                <tr><td colSpan={6} className="text-center text-muted">No print jobs recorded.</td></tr>
              )}
            </tbody>
          </Table>
        </Tab>

        {/* ── Temperature chart ───────────────────────────────────────────── */}
        <Tab eventKey="temps" title="Temperature">
          {macs.length === 0 ? (
            <p className="text-muted mt-3">No temperature data available.</p>
          ) : (
            <Line data={tempChartData} options={{ responsive: true, plugins: { legend: { position: 'top' } } }} />
          )}
        </Tab>

        {/* ── System Logs ─────────────────────────────────────────────────── */}
        <Tab eventKey="logs" title="System Logs">
          <div className="d-flex gap-2 mb-2">
            {(['all', 'warn', 'error'] as LogLevel[]).map(lvl => (
              <Button key={lvl} variant={logFilter === lvl ? 'dark' : 'outline-dark'} size="sm" onClick={() => setLogFilter(lvl)}>
                {lvl.toUpperCase()}
              </Button>
            ))}
            <Button variant="outline-secondary" size="sm" className="ms-auto"
              onClick={() => navigator.clipboard.writeText(filteredLogs.join('\n'))}>
              Copy All
            </Button>
          </div>
          <div ref={logRef} style={{
            height: 400, overflowY: 'auto', fontFamily: 'monospace', fontSize: '0.75rem',
            background: '#1e1e1e', color: '#d4d4d4', padding: 12, borderRadius: 4,
          }}>
            {filteredLogs.map((line, i) => (
              <div key={i} style={{ color: line.includes('[error]') ? '#f48771' : line.includes('[warn]') ? '#dcdcaa' : '#d4d4d4' }}>
                {line}
              </div>
            ))}
            {filteredLogs.length === 0 && <div className="text-muted">No log entries yet.</div>}
          </div>
        </Tab>

      </Tabs>
    </Container>
  )
}
