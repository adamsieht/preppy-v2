import { ipcMain } from 'electron'
import { IPC } from '../channels'
import { scanPrinters, testPrinterDevice } from '../../services/usb-detection.service'
import { setPrinterDevice, setLabelHome, getConfig } from '../../services/config.service'
import { logInfo } from '../../logger'

export function registerPrinterSetupHandlers(): void {
  ipcMain.handle(IPC.PRINTER_SCAN, () => {
    logInfo('Scanning for printer devices')
    return scanPrinters()
  })

  ipcMain.handle(IPC.PRINTER_SET_DEVICE, (_event, devicePath: unknown) => {
    if (typeof devicePath !== 'string' || !devicePath.trim()) {
      return { success: false, error: 'Device path must be a non-empty string' }
    }
    try {
      setPrinterDevice(devicePath.trim())
      logInfo(`Printer device updated to: ${devicePath.trim()}`)
      return { success: true, device: getConfig().printer.device }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })

  ipcMain.handle(IPC.PRINTER_TEST, (_event, devicePath: unknown) => {
    if (typeof devicePath !== 'string' || !devicePath.trim()) {
      return { success: false, error: 'Device path must be a non-empty string' }
    }
    return testPrinterDevice(devicePath.trim())
  })

  ipcMain.handle(IPC.PRINTER_SET_LABEL_HOME, (_event, x: unknown, y: unknown) => {
    const nx = typeof x === 'number' ? Math.round(x) : parseInt(String(x), 10)
    const ny = typeof y === 'number' ? Math.round(y) : parseInt(String(y), 10)
    if (isNaN(nx) || isNaN(ny)) {
      return { success: false, error: 'x and y must be integers' }
    }
    try {
      setLabelHome(nx, ny)
      logInfo(`Label home set to ^LH${nx},${ny}`)
      return { success: true, x: nx, y: ny }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  })
}
