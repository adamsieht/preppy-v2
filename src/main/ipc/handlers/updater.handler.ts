import { ipcMain, app } from 'electron'
import { IPC } from '../channels'
import {
  checkForUpdates,
  getUpdaterState,
  installUpdateNow,
} from '../../services/updater.service'

export function registerUpdaterHandlers(): void {
  ipcMain.handle(IPC.UPDATE_CHECK, async () => {
    return checkForUpdates()
  })

  ipcMain.handle(IPC.UPDATE_GET_STATE, async () => {
    return getUpdaterState()
  })

  ipcMain.handle(IPC.UPDATE_INSTALL, async () => {
    try {
      installUpdateNow()
      return { success: true }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) }
    }
  })

  ipcMain.handle(IPC.APP_VERSION, async () => {
    return app.getVersion()
  })
}
