import { ipcMain } from 'electron'
import { IPC } from '../channels'
import { setSystemTime, openSystemTimeSettings, enableNtp } from '../../services/system.service'
import { logInfo } from '../../logger'

export function registerSystemHandlers(): void {
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
