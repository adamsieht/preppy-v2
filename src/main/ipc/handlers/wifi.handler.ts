import { ipcMain } from 'electron'
import { z } from 'zod'
import { IPC } from '../channels'
import { saveWifi, getWifi, scanNetworks } from '../../services/wifi.service'

const WifiArgsSchema = z.object({
  ssid: z.string().min(1).max(64),
  pass: z.string().min(8).max(63),
})

export function registerWifiHandlers(): void {
  ipcMain.handle(IPC.WIFI_SAVE, async (_event, args: unknown) => {
    const parsed = WifiArgsSchema.safeParse(args)
    if (!parsed.success) {
      return { success: false, error: parsed.error.message }
    }
    return saveWifi(parsed.data.ssid, parsed.data.pass)
  })

  ipcMain.handle(IPC.WIFI_GET, () => {
    return getWifi()
  })

  ipcMain.handle(IPC.WIFI_SCAN, () => {
    return scanNetworks()
  })
}
