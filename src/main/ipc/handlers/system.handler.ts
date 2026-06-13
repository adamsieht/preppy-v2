import { ipcMain, app, BrowserWindow } from 'electron'
import { IPC } from '../channels'
import { setSystemTime, openSystemTimeSettings, enableNtp } from '../../services/system.service'
import { setKioskMode, getConfig } from '../../services/config.service'
import { logInfo } from '../../logger'

// Apply kiosk state to every open window so the toggle takes effect immediately
// without requiring a restart.
function applyKiosk(enabled: boolean): void {
  for (const win of BrowserWindow.getAllWindows()) {
    win.setKiosk(enabled)
    win.setFullScreen(enabled)
    win.setMenuBarVisibility(!enabled)
    win.setAutoHideMenuBar(enabled)
  }
}

export function registerSystemHandlers(): void {
  ipcMain.handle(IPC.APP_QUIT, () => {
    logInfo('Quit requested via settings')
    app.quit()
  })

  ipcMain.handle(IPC.APP_GET_KIOSK, () => getConfig().ui?.kioskMode !== false)

  ipcMain.handle(IPC.APP_SET_KIOSK, (_event, enabled: unknown) => {
    if (typeof enabled !== 'boolean') return { success: false, error: 'Expected a boolean' }
    try {
      setKioskMode(enabled)
      applyKiosk(enabled)
      logInfo(`Kiosk mode ${enabled ? 'enabled' : 'disabled'}`)
      return { success: true }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })
  ipcMain.handle(IPC.SYSTEM_SET_TIME, async (_event, iso: unknown) => {
    if (typeof iso !== 'string') return { success: false, error: 'Expected an ISO date string' }
    logInfo(`Setting system time to: ${iso}`)
    return setSystemTime(iso)
  })

  ipcMain.handle(IPC.SYSTEM_OPEN_TIME_SETTINGS, async () => {
    logInfo('Opening system time settings')
    return openSystemTimeSettings()
  })

  ipcMain.handle(IPC.SYSTEM_ENABLE_NTP, async () => {
    logInfo('Re-enabling NTP synchronisation')
    return enableNtp()
  })
}
