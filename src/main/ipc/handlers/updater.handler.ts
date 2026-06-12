import { ipcMain, app } from 'electron'
import { IPC } from '../channels'
import {
  loadUpdateSettings,
  saveUpdateSettings,
  checkForUpdate,
  downloadUpdate,
  applyUpdate,
} from '../../services/updater.service'
import type { UpdateSettings } from '../../services/updater.service'

function isUpdateSettings(v: unknown): v is UpdateSettings {
  if (typeof v !== 'object' || v === null) return false
  const o = v as Record<string, unknown>
  return typeof o.repoOwner === 'string' && typeof o.repoName === 'string' && typeof o.token === 'string'
}

export function registerUpdaterHandlers(): void {
  ipcMain.handle(IPC.UPDATE_CHECK, async () => {
    try {
      const settings = loadUpdateSettings()
      const result = await checkForUpdate(settings)
      return { success: true, result }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) }
    }
  })

  ipcMain.handle(IPC.UPDATE_DOWNLOAD, async (event, arg: unknown) => {
    if (typeof arg !== 'object' || arg === null || typeof (arg as Record<string, unknown>).url !== 'string') {
      return { success: false, error: 'Expected { url: string }' }
    }
    const { url } = arg as { url: string }
    const settings = loadUpdateSettings()
    try {
      await downloadUpdate(url, settings.token, (downloaded, total) => {
        if (!event.sender.isDestroyed()) {
          event.sender.send(IPC.UPDATE_PROGRESS, { downloaded, total })
        }
      })
      return { success: true }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) }
    }
  })

  ipcMain.handle(IPC.UPDATE_APPLY, async () => {
    try {
      applyUpdate()
      return { success: true }
    } catch (err) {
      return { success: false, error: err instanceof Error ? err.message : String(err) }
    }
  })

  ipcMain.handle(IPC.UPDATE_GET_SETTINGS, async () => {
    return loadUpdateSettings()
  })

  ipcMain.handle(IPC.UPDATE_SAVE_SETTINGS, async (_event, arg: unknown) => {
    if (!isUpdateSettings(arg)) {
      return { success: false, error: 'Invalid settings object' }
    }
    saveUpdateSettings(arg)
    return { success: true }
  })

  ipcMain.handle(IPC.APP_VERSION, async () => {
    return app.getVersion()
  })
}
