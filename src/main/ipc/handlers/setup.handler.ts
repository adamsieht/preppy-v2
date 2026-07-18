import { ipcMain } from 'electron'
import { IPC } from '../channels'
import {
  getSetupState,
  markSetupComplete,
  resetSetupState,
  runKioskSetup,
} from '../../services/setup.service'
import type { KioskSetupOptions } from '../../services/setup.service'

function isKioskSetupOptions(v: unknown): v is KioskSetupOptions {
  if (typeof v !== 'object' || v === null) return false
  const o = v as Record<string, unknown>
  return (
    (o.windowsUpdatePolicy === 'no-reboot' || o.windowsUpdatePolicy === 'disable') &&
    typeof o.autoLogin === 'boolean' &&
    typeof o.autoLoginUser === 'string' &&
    typeof o.autoLoginPassword === 'string' &&
    typeof o.autoStart === 'boolean'
  )
}

export function registerSetupHandlers(): void {
  ipcMain.handle(IPC.SETUP_GET_STATE, async () => {
    return getSetupState()
  })

  ipcMain.handle(IPC.SETUP_RUN, async (_event, arg: unknown) => {
    if (!isKioskSetupOptions(arg)) {
      return { success: false, error: 'Invalid setup options' }
    }
    return runKioskSetup(arg)
  })

  ipcMain.handle(IPC.SETUP_COMPLETE, async () => {
    markSetupComplete()
    return { success: true }
  })

  ipcMain.handle(IPC.SETUP_RESET, async () => {
    resetSetupState()
    return { success: true }
  })
}
