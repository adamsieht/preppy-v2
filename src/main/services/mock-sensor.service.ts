import { BrowserWindow } from 'electron'
import { insertLog, upsertSensor } from './db.service'
import { logInfo, logDebug } from '../logger'
import { IPC } from '../ipc/channels'
import { getConfig } from './config.service'

interface MockSensorState {
  mac: string
  temperature: number
  humidity: number
  battery: number
  tickCount: number
}

const INITIAL: MockSensorState[] = [
  { mac: 'AA:BB:CC:DD:EE:01', temperature: 38.2, humidity: 68.0, battery: 87, tickCount: 0 },
  { mac: 'AA:BB:CC:DD:EE:02', temperature: 36.9, humidity: 72.5, battery: 82, tickCount: 0 },
]

const state: MockSensorState[] = INITIAL.map(s => ({ ...s }))

let mockTimer: ReturnType<typeof setInterval> | null = null

function clamp(v: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, v))
}

function drift(current: number, range: number, min: number, max: number): number {
  return clamp(current + (Math.random() - 0.5) * range, min, max)
}

function tick(): void {
  const now = new Date().toISOString()

  for (const s of state) {
    // Drift temp within realistic fridge range — occasional excursion toward boundary
    s.temperature = drift(s.temperature, 0.5, 33.0, 41.0)
    s.humidity = drift(s.humidity, 1.2, 50.0, 90.0)
    s.tickCount++
    if (s.tickCount % 120 === 0 && s.battery > 5) s.battery -= 1

    const record = {
      mac: s.mac,
      time: now,
      temperature: parseFloat(s.temperature.toFixed(1)),
      humidity: parseFloat(s.humidity.toFixed(1)),
      battery: s.battery,
    }

    insertLog(record)
    upsertSensor({ ...record, last_update: now })

    logDebug(`[MOCK] ${s.mac}: ${record.temperature}°F  ${record.humidity}% RH  batt ${record.battery}%`)

    BrowserWindow.getAllWindows().forEach(win => {
      win.webContents.send(IPC.SENSOR_UPDATE, record)
    })
  }
}

export function startMock(): void {
  const config = getConfig()
  logInfo('[MOCK] Starting mock sensor (no real sensor log dir found)')
  tick()
  mockTimer = setInterval(tick, config.sensor.pollIntervalMs)
}

export function stopMock(): void {
  if (mockTimer) {
    clearInterval(mockTimer)
    mockTimer = null
  }
}
