import { contextBridge, ipcRenderer } from 'electron'
import { IPC } from '../main/ipc/channels'
import type { PrintArgs, LabelTemplate, PreviewResult } from '../main/services/printer.service'
import type { Sensor, SensorLog, PrintJob, WifiCredentials, DurationCount } from '../main/services/db.service'
import type { UsbPrinterDevice } from '../main/services/usb-detection.service'
import type { WifiNetwork } from '../main/services/wifi.service'
import type { UpdaterState } from '../main/services/updater.service'
import type { SetupState, KioskSetupOptions, KioskSetupResult } from '../main/services/setup.service'

export interface ElectronAPI {
  print: (args: { template: LabelTemplate; durationHrs: number; qty: number; expiryIso?: string }) => Promise<{ success: boolean; error?: string }>
  printZpl: (args: { zpl: string; qty: number }) => Promise<{ success: boolean; error?: string; simulated?: boolean; simulatedPath?: string }>
  previewPrint: (args: { template: LabelTemplate; durationHrs: number }) => Promise<PreviewResult>
  getPrintHistory: (limit?: number, offset?: number) => Promise<PrintJob[]>
  listSensors: () => Promise<Sensor[]>
  onSensorUpdate: (cb: (data: SensorLog & { mac: string }) => void) => () => void
  saveWifi: (args: { ssid: string; pass: string }) => Promise<{ success: boolean; error?: string }>
  getWifi: () => Promise<WifiCredentials | null>
  scanWifi: () => Promise<WifiNetwork[]>
  getConfig: () => Promise<unknown>
  onLogLine: (cb: (line: string) => void) => () => void
  getPrintReport: () => Promise<PrintJob[]>
  getPopularityMap: () => Promise<DurationCount[]>
  getTempReport: (mac?: string, limit?: number) => Promise<SensorLog[]>
  getDebugInfo: () => Promise<unknown>
  sendRawZpl: (zpl: string) => Promise<{ success: boolean; error?: string }>
  scanPrinters: () => Promise<UsbPrinterDevice[]>
  setPrinterDevice: (path: string) => Promise<{ success: boolean; device?: string; error?: string }>
  testPrinter: (path: string) => Promise<{ success: boolean; error?: string }>
  runPrinterSetup: () => Promise<{ success: boolean; error?: string }>
  setLabelHome: (x: number, y: number) => Promise<{ success: boolean; x?: number; y?: number; error?: string }>
  setSystemTime: (iso: string) => Promise<{ success: boolean; error?: string }>
  openSystemTimeSettings: () => Promise<{ success: boolean; error?: string }>
  enableNtp: () => Promise<{ success: boolean; error?: string }>
  getPlatform: () => string
  checkForUpdate: () => Promise<UpdaterState>
  getUpdateState: () => Promise<UpdaterState>
  onUpdateState: (cb: (state: UpdaterState) => void) => () => void
  installUpdate: () => Promise<{ success: boolean; error?: string }>
  getSetupState: () => Promise<SetupState>
  runKioskSetup: (opts: KioskSetupOptions) => Promise<KioskSetupResult>
  completeSetup: () => Promise<{ success: boolean }>
  resetSetup: () => Promise<{ success: boolean }>
  getAppVersion: () => Promise<string>
  quitApp: () => Promise<void>
  getKioskMode: () => Promise<boolean>
  setKioskMode: (enabled: boolean) => Promise<{ success: boolean; error?: string }>
}

contextBridge.exposeInMainWorld('electronAPI', {
  print: (args: PrintArgs) => ipcRenderer.invoke(IPC.PRINTER_PRINT, args),

  printZpl: (args: { zpl: string; qty: number }) => ipcRenderer.invoke(IPC.PRINTER_PRINT_ZPL, args),

  previewPrint: (args: { template: LabelTemplate; durationHrs: number }) =>
    ipcRenderer.invoke(IPC.PRINTER_PREVIEW, args),

  getPrintHistory: (limit = 50, offset = 0) =>
    ipcRenderer.invoke(IPC.PRINTER_HISTORY, limit, offset),

  listSensors: () => ipcRenderer.invoke(IPC.SENSOR_LIST),

  onSensorUpdate: (cb: (data: SensorLog & { mac: string }) => void) => {
    const handler = (_: Electron.IpcRendererEvent, data: SensorLog & { mac: string }) => cb(data)
    ipcRenderer.on(IPC.SENSOR_UPDATE, handler)
    return () => ipcRenderer.removeListener(IPC.SENSOR_UPDATE, handler)
  },

  saveWifi: (args: { ssid: string; pass: string }) => ipcRenderer.invoke(IPC.WIFI_SAVE, args),

  getWifi: () => ipcRenderer.invoke(IPC.WIFI_GET),

  scanWifi: () => ipcRenderer.invoke(IPC.WIFI_SCAN),

  getConfig: () => ipcRenderer.invoke(IPC.CONFIG_GET),

  onLogLine: (cb: (line: string) => void) => {
    const handler = (_: Electron.IpcRendererEvent, line: string) => cb(line)
    ipcRenderer.on(IPC.LOGS_TAIL, handler)
    return () => ipcRenderer.removeListener(IPC.LOGS_TAIL, handler)
  },

  getPrintReport: () => ipcRenderer.invoke(IPC.REPORT_PRINTS),

  getPopularityMap: () => ipcRenderer.invoke(IPC.REPORT_POPULARITY),

  getTempReport: (mac?: string, limit = 200) => ipcRenderer.invoke(IPC.REPORT_TEMPS, mac, limit),

  getDebugInfo: () => ipcRenderer.invoke(IPC.DEBUG_INFO),

  sendRawZpl: (zpl: string) => ipcRenderer.invoke(IPC.DEBUG_SEND_ZPL, zpl),

  scanPrinters:     ()       => ipcRenderer.invoke(IPC.PRINTER_SCAN),
  setPrinterDevice: (p: string) => ipcRenderer.invoke(IPC.PRINTER_SET_DEVICE, p),
  testPrinter:      (p: string) => ipcRenderer.invoke(IPC.PRINTER_TEST, p),
  runPrinterSetup:  ()          => ipcRenderer.invoke(IPC.PRINTER_RUN_SETUP),
  setLabelHome:     (x: number, y: number) => ipcRenderer.invoke(IPC.PRINTER_SET_LABEL_HOME, x, y),
  setSystemTime:         (iso: string) => ipcRenderer.invoke(IPC.SYSTEM_SET_TIME, iso),
  openSystemTimeSettings:()            => ipcRenderer.invoke(IPC.SYSTEM_OPEN_TIME_SETTINGS),
  enableNtp:             ()            => ipcRenderer.invoke(IPC.SYSTEM_ENABLE_NTP),
  getPlatform:           ()            => process.platform,
  checkForUpdate: () => ipcRenderer.invoke(IPC.UPDATE_CHECK),
  getUpdateState: () => ipcRenderer.invoke(IPC.UPDATE_GET_STATE),
  onUpdateState: (cb: (state: UpdaterState) => void) => {
    const handler = (_: Electron.IpcRendererEvent, state: UpdaterState) => cb(state)
    ipcRenderer.on(IPC.UPDATE_STATE, handler)
    return () => ipcRenderer.removeListener(IPC.UPDATE_STATE, handler)
  },
  installUpdate: () => ipcRenderer.invoke(IPC.UPDATE_INSTALL),
  getSetupState: () => ipcRenderer.invoke(IPC.SETUP_GET_STATE),
  runKioskSetup: (opts: KioskSetupOptions) => ipcRenderer.invoke(IPC.SETUP_RUN, opts),
  completeSetup: () => ipcRenderer.invoke(IPC.SETUP_COMPLETE),
  resetSetup: () => ipcRenderer.invoke(IPC.SETUP_RESET),
  getAppVersion: () => ipcRenderer.invoke(IPC.APP_VERSION),
  quitApp:       () => ipcRenderer.invoke(IPC.APP_QUIT),
  getKioskMode:  () => ipcRenderer.invoke(IPC.APP_GET_KIOSK),
  setKioskMode:  (enabled: boolean) => ipcRenderer.invoke(IPC.APP_SET_KIOSK, enabled),
} satisfies ElectronAPI)
