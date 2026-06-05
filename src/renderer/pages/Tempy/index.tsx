import { useEffect, useState } from 'react'
import { Line } from 'react-chartjs-2'
import {
  Chart as ChartJS, CategoryScale, LinearScale,
  PointElement, LineElement, Tooltip,
} from 'chart.js'
import PageLayout from '../../components/PageLayout'

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Tooltip)

const DANGER_LOW = 31
const DANGER_HIGH = 41
const WARNING_LOW = 37

interface Sensor { mac: string; temperature: number; humidity: number; battery: number; last_update: string }
interface LogEntry { mac: string; time: string; temperature: number }

function cardStyle(temp: number): { bg: string; border: string; color: string } {
  if (temp < DANGER_LOW || temp > DANGER_HIGH) return { bg: '#f8d7da', border: '#dc3545', color: '#842029' }
  if (temp < WARNING_LOW) return { bg: '#fff3cd', border: '#ffc107', color: '#664d03' }
  return { bg: '#d1e7dd', border: '#198754', color: '#0f5132' }
}

// ── Tailwind class map ──────────────────────────────────────────────────────
const classes = {
  noSensors:      'text-[#6c757d] p-4',
  sensorGrid:     'grid grid-cols-2 gap-[10px] p-[10px]',
  sensorBtn:      'min-h-[120px] border-[3px] border-solid rounded-xl flex flex-col items-center justify-center gap-1 cursor-pointer p-3',
  sensorTemp:     'text-[2.4rem] font-black leading-none',
  sensorHumidity: 'text-[0.9rem] opacity-80',
  sensorMac:      'text-[0.7rem] opacity-60 overflow-hidden text-ellipsis whitespace-nowrap max-w-full',
  backBtn:        'bg-transparent border border-[#ced4da] rounded-lg px-4 py-2 text-[1.1rem] min-h-[48px] text-[#495057]',
  detailCard:     'text-center py-4 mb-4 rounded-xl border-2',
  detailTemp:     'text-[4rem] font-black leading-none',
  detailMeta:     'text-[1.1rem] opacity-80',
}
// ───────────────────────────────────────────────────────────────────────────

export default function Tempy() {
  const [sensors, setSensors] = useState<Sensor[]>([])
  const [selected, setSelected] = useState<string | null>(null)
  const [history, setHistory] = useState<LogEntry[]>([])

  useEffect(() => {
    window.electronAPI.listSensors().then(setSensors)
    const cleanup = window.electronAPI.onSensorUpdate((data) => {
      setSensors(prev => {
        const idx = prev.findIndex(s => s.mac === data.mac)
        const updated = { mac: data.mac, temperature: data.temperature, humidity: data.humidity, battery: data.battery, last_update: data.time }
        if (idx >= 0) { const n = [...prev]; n[idx] = updated; return n }
        return [...prev, updated]
      })
    })
    return cleanup
  }, [])

  useEffect(() => {
    if (!selected) return
    window.electronAPI.getTempReport(selected, 100).then(logs => setHistory(logs as LogEntry[]))
  }, [selected])

  if (selected) {
    const reversed = [...history].reverse()
    const chartData = {
      labels: reversed.map(l => l.time),
      datasets: [{ label: '°F', data: reversed.map(l => l.temperature), borderColor: '#0d6efd', tension: 0.2, pointRadius: 2 }],
    }
    const sensor = sensors.find(s => s.mac === selected)
    const style = sensor ? cardStyle(sensor.temperature) : { bg: '#f8f9fa', border: '#dee2e6', color: '#212529' }
    return (
      <PageLayout title={selected} right={
        <button onClick={() => setSelected(null)} className={classes.backBtn}>← All</button>
      }>
        {sensor && (
          <div className={classes.detailCard} style={{ background: style.bg, borderColor: style.border }}>
            <div className={classes.detailTemp} style={{ color: style.color }}>
              {sensor.temperature.toFixed(1)}°F
            </div>
            <div className={classes.detailMeta} style={{ color: style.color }}>
              {sensor.humidity.toFixed(0)}% RH · {sensor.battery}% batt
            </div>
          </div>
        )}
        <Line data={chartData} options={{ responsive: true, plugins: { legend: { display: false } }, scales: { x: { display: false } } }} />
      </PageLayout>
    )
  }

  return (
    <PageLayout title="Temperatures" back="/" noPad>
      {sensors.length === 0 && (
        <p className={classes.noSensors}>No sensors detected.</p>
      )}
      <div className={classes.sensorGrid}>
        {sensors.map(s => {
          const style = cardStyle(s.temperature)
          return (
            <button
              key={s.mac}
              onClick={() => setSelected(s.mac)}
              className={classes.sensorBtn}
              style={{ background: style.bg, borderColor: style.border }}
            >
              <div className={classes.sensorTemp} style={{ color: style.color }}>
                {s.temperature.toFixed(1)}°
              </div>
              <div className={classes.sensorHumidity} style={{ color: style.color }}>
                {s.humidity.toFixed(0)}% RH
              </div>
              <div className={classes.sensorMac} style={{ color: style.color }}>
                {s.mac}
              </div>
            </button>
          )
        })}
      </div>
    </PageLayout>
  )
}
