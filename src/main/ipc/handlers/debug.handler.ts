import { ipcMain, app } from 'electron'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { IPC } from '../channels'
import { getConfig } from '../../services/config.service'
import { sendRawToDevice } from '../../services/printer.service'
import { getDb } from '../../services/db.service'
import { logInfo, logWarn } from '../../logger'

function tableCount(table: string): number {
  try {
    const row = getDb().prepare(`SELECT COUNT(*) as n FROM ${table}`).get() as { n: number }
    return row.n
  } catch {
    return -1
  }
}

function checkPath(p: string): { exists: boolean; writable: boolean } {
  const exists = fs.existsSync(p)
  let writable = false
  if (exists) {
    try {
      fs.accessSync(p, fs.constants.W_OK)
      writable = true
    } catch { /* not writable */ }
  }
  return { exists, writable }
}

export function registerDebugHandlers(): void {
  ipcMain.handle(IPC.DEBUG_INFO, () => {
    const config = getConfig()
    const userData = app.getPath('userData')
    const logDir = path.join(userData, 'logs')

    const info = {
      app: {
        version: app.getVersion(),
        userData,
        locale: app.getLocale(),
        isPackaged: app.isPackaged,
        isDev: process.env.NODE_ENV === 'development',
      },
      runtime: {
        electronVersion: process.versions.electron,
        nodeVersion: process.versions.node,
        chromeVersion: process.versions.chrome,
        platform: process.platform,
        arch: process.arch,
        pid: process.pid,
        uptime: Math.round(process.uptime()),
        memoryMb: Math.round(process.memoryUsage().rss / 1024 / 1024),
        hostname: os.hostname(),
      },
      hardware: {
        printerDevice: checkPath(config.printer.device),
        sensorLogDir: checkPath(config.sensor.logDir),
        supplicantConf: checkPath(config.wifi.supplicantPath),
        zplTemplateDir: checkPath(config.printer.zplTemplateDir),
        dbFile: checkPath(path.join(userData, 'preppy.db')),
        logDir: checkPath(logDir),
      },
      database: {
        sensors: tableCount('sensors'),
        logs: tableCount('logs'),
        print_jobs: tableCount('print_jobs'),
        alerts: tableCount('alerts'),
        wifi: tableCount('wifi'),
      },
      config,
    }

    logInfo('Debug info requested')
    return info
  })

  ipcMain.handle(IPC.DEBUG_SEND_ZPL, async (_event, rawZpl: unknown) => {
    if (typeof rawZpl !== 'string' || !rawZpl.trim()) {
      return { success: false, error: 'ZPL must be a non-empty string' }
    }
    logWarn(`Raw ZPL sent via debug panel (${rawZpl.length} bytes)`)
    // Route through the platform-aware printer path so this works with Windows
    // print queues (device is a queue name, not a writable file path).
    return sendRawToDevice(rawZpl)
  })
}
