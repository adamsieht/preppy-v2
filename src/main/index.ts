import { app, BrowserWindow } from 'electron'
import path from 'path'
import { logInfo, logError } from './logger'

// Suppress EGL/GPU errors on Linux kiosk hardware (Pi, embedded displays)
app.commandLine.appendSwitch('disable-gpu')
app.commandLine.appendSwitch('disable-software-rasterizer')
app.commandLine.appendSwitch('disable-gpu-compositing')
import { registerPrinterHandlers } from './ipc/handlers/printer.handler'
import { registerPrinterSetupHandlers } from './ipc/handlers/printer-setup.handler'
import { registerSensorHandlers } from './ipc/handlers/sensor.handler'
import { registerWifiHandlers } from './ipc/handlers/wifi.handler'
import { registerDbHandlers } from './ipc/handlers/db.handler'
import { registerDebugHandlers } from './ipc/handlers/debug.handler'
import { registerSystemHandlers } from './ipc/handlers/system.handler'
import { registerUpdaterHandlers } from './ipc/handlers/updater.handler'
import { start as startSensorPolling, stop as stopSensorPolling } from './services/sensor.service'
import { getConfig } from './services/config.service'
import { maybePromptFirstRunSetup } from './services/setup.service'

const isDev = process.env.NODE_ENV === 'development'

// Kiosk mode defaults ON (full-screen, no window chrome — ideal for a dedicated
// tablet). It can be toggled off from Appearance settings (persisted in
// config.local.json), so it no longer depends on a --kiosk launch flag — opening
// from a plain desktop shortcut still starts in kiosk mode. The legacy --kiosk
// flag still forces it on.
function kioskEnabled(): boolean {
  if (isDev) return false
  if (process.argv.includes('--kiosk')) return true
  return getConfig().ui?.kioskMode !== false
}

function createWindow(): BrowserWindow {
  const startKiosk = kioskEnabled()
  const win = new BrowserWindow({
    width: 1024,
    height: 768,
    fullscreen:      startKiosk,
    kiosk:           startKiosk,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  })

  if (isDev) {
    win.loadURL('http://localhost:5173')
    win.webContents.openDevTools()
  } else {
    win.loadFile(path.join(__dirname, '../renderer/index.html'))
  }

  return win
}

app.whenReady().then(() => {
  logInfo('Preppy v2 starting up')

  registerPrinterHandlers()
  registerPrinterSetupHandlers()
  registerSensorHandlers()
  registerWifiHandlers()
  registerDbHandlers()
  registerDebugHandlers()
  registerSystemHandlers()
  registerUpdaterHandlers()

  logInfo('IPC handlers registered')

  const win = createWindow()
  startSensorPolling()

  // First-run setup offer (packaged Windows only — no-op elsewhere)
  void maybePromptFirstRunSetup(win)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  stopSensorPolling()
  logInfo('All windows closed — exiting')
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => {
  stopSensorPolling()
})

process.on('uncaughtException', (err) => {
  logError('Uncaught exception:', err)
})
