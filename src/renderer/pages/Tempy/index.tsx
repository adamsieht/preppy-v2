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
        <button onClick={() => setSelected(null)} style={{ background: 'none', border: '1px solid #ced4da', borderRadius: 8, padding: '8px 16px', fontSize: '1.1rem', minHeight: 48 }}>← All</button>
      }>
        {sensor && (
          <div style={{ textAlign: 'center', padding: '16px 0', marginBottom: 16, background: style.bg, borderRadius: 12, border: `2px solid ${style.border}` }}>
            <div style={{ fontSize: '4rem', fontWeight: 900, color: style.color, lineHeight: 1 }}>
              {sensor.temperature.toFixed(1)}°F
            </div>
            <div style={{ color: style.color, fontSize: '1.1rem', opacity: 0.8 }}>
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
        <p style={{ color: '#6c757d', padding: 16 }}>No sensors detected.</p>
      )}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 10,
        padding: 10,
      }}>
        {sensors.map(s => {
          const style = cardStyle(s.temperature)
          return (
            <button
              key={s.mac}
              onClick={() => setSelected(s.mac)}
              style={{
                minHeight: 120,
                border: `3px solid ${style.border}`,
                borderRadius: 12,
                background: style.bg,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 4,
                cursor: 'pointer',
                padding: 12,
              }}
            >
              <div style={{ fontSize: '2.4rem', fontWeight: 900, color: style.color, lineHeight: 1 }}>
                {s.temperature.toFixed(1)}°
              </div>
              <div style={{ fontSize: '0.9rem', color: style.color, opacity: 0.8 }}>
                {s.humidity.toFixed(0)}% RH
              </div>
              <div style={{ fontSize: '0.7rem', color: style.color, opacity: 0.6, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '100%' }}>
                {s.mac}
              </div>
            </button>
          )
        })}
      </div>
    </PageLayout>
  )
}
