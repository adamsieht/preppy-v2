import { ipcMain } from 'electron'
import { IPC } from '../channels'
import { getPrintJobs, getAllLogs } from '../../services/db.service'

export function registerDbHandlers(): void {
  ipcMain.handle(IPC.REPORT_PRINTS, () => {
    return getPrintJobs(100, 0)
  })
}

export { getAllLogs }
