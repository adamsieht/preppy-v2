import fs from 'fs'
import path from 'path'
import readline from 'readline'
import { BrowserWindow } from 'electron'
import { getConfig } from './config.service'
import { insertLog, upsertSensor } from './db.service'
import { logInfo, logWarn, logDebug, logError } from '../logger'
import { IPC } from '../ipc/channels'
import { startMock, stopMock } from './mock-sensor.service'

interface FileState {
  lastLine: number
}

const fileStates = new Map<string, FileState>()
let pollTimer: ReturnType<typeof setInterval> | null = null

async function processFile(filePath: string): Promise<void> {
  const state = fileStates.get(filePath) ?? { lastLine: 0 }
  let lineCount = 0
  let newData = false

  const stream = fs.createReadStream(filePath)
  const rl = readline.createInterface({ input: stream, crlfDelay: Infinity })

  for await (const line of rl) {
    lineCount++
    if (lineCount <= state.lastLine) continue
    if (!line.trim()) continue

    const parts = line.split('\t')
    if (parts.length < 5) continue

    const [mac, time, tempStr, humStr, batStr] = parts
    const temperature = parseFloat(tempStr)
    const humidity = parseFloat(humStr)
    const battery = parseFloat(batStr)

    if (isNaN(temperature) || isNaN(humidity) || isNaN(battery)) continue

    const record = { mac, time, temperature, humidity, battery }
    insertLog(record)
    upsertSensor({ mac, last_update: time, temperature, humidity, battery })
    newData = true

    logDebug(`Sensor ${mac}: ${temperature}°F, ${humidity}% RH`)

    BrowserWindow.getAllWindows().forEach((win) => {
      win.webContents.send(IPC.SENSOR_UPDATE, record)
    })
  }

  if (newData) {
    fileStates.set(filePath, { lastLine: lineCount })
  }
}

async function poll(): Promise<void> {
  const config = getConfig()
  const logDir = config.sensor.logDir

  if (!fs.existsSync(logDir)) {
    logWarn(`Sensor log directory not found: ${logDir}`)
    return
  }

  let files: string[]
  try {
    files = fs.readdirSync(logDir).filter((f) => f.endsWith('.log'))
  } catch (err) {
    logError(`Failed to read sensor log dir: ${String(err)}`)
    return
  }

  for (const file of files) {
    try {
      await processFile(path.join(logDir, file))
    } catch (err) {
      logError(`Failed to process sensor file ${file}: ${String(err)}`)
    }
  }
}

export function start(): void {
  const config = getConfig()
  if (!fs.existsSync(config.sensor.logDir)) {
    logWarn(`Sensor log dir not found (${config.sensor.logDir}) — using mock sensor`)
    startMock()
    return
  }
  logInfo(`Starting sensor polling every ${config.sensor.pollIntervalMs}ms`)
  poll()
  pollTimer = setInterval(() => { poll() }, config.sensor.pollIntervalMs)
}

export function stop(): void {
  if (pollTimer) {
    clearInterval(pollTimer)
    pollTimer = null
    logInfo('Sensor polling stopped')
  }
  stopMock()
}
