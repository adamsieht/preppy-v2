import { ipcMain } from 'electron'
import { IPC } from '../channels'
import { getSensors, getLogs } from '../../services/db.service'

export function registerSensorHandlers(): void {
  ipcMain.handle(IPC.SENSOR_LIST, () => {
    return getSensors()
  })

  ipcMain.handle(IPC.REPORT_TEMPS, (_event, mac?: string, limit = 200) => {
    if (mac) return getLogs(mac, limit)
    return getSensors()
  })
}
