import { ipcMain } from 'electron'
import { IPC } from '../channels'
import { getPrintJobs, getDurationCounts, getAllLogs } from '../../services/db.service'

export function registerDbHandlers(): void {
  ipcMain.handle(IPC.REPORT_PRINTS, () => {
    return getPrintJobs(100, 0)
  })

  ipcMain.handle(IPC.REPORT_POPULARITY, () => {
    return getDurationCounts()
  })
}

export { getAllLogs }
