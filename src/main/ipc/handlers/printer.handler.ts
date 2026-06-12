import { ipcMain } from 'electron'
import { z } from 'zod'
import { IPC } from '../channels'
import { print, printRaw, preview } from '../../services/printer.service'
import { getPrintJobs } from '../../services/db.service'

const PrintArgsSchema = z.object({
  template: z.enum(['IX', 'OX', 'UX']),
  durationHrs: z.number().min(0.25).max(720),
  qty: z.number().int().min(1).max(100),
  expiryIso: z.string().optional(),
})

const PrintZplArgsSchema = z.object({
  zpl: z.string().min(1),
  qty: z.number().int().min(1).max(100),
})

const PreviewArgsSchema = z.object({
  template: z.enum(['IX', 'OX', 'UX']),
  durationHrs: z.number().min(0.25).max(720),
})

export function registerPrinterHandlers(): void {
  ipcMain.handle(IPC.PRINTER_PRINT, (_event, args: unknown) => {
    const parsed = PrintArgsSchema.safeParse(args)
    if (!parsed.success) {
      return { success: false, error: parsed.error.message }
    }
    return print(parsed.data)
  })

  ipcMain.handle(IPC.PRINTER_PRINT_ZPL, (_event, args: unknown) => {
    const parsed = PrintZplArgsSchema.safeParse(args)
    if (!parsed.success) {
      return { success: false, error: parsed.error.message }
    }
    return printRaw(parsed.data)
  })

  ipcMain.handle(IPC.PRINTER_PREVIEW, (_event, args: unknown) => {
    const parsed = PreviewArgsSchema.safeParse(args)
    if (!parsed.success) {
      return { success: false, error: parsed.error.message }
    }
    return preview(parsed.data)
  })

  ipcMain.handle(IPC.PRINTER_HISTORY, (_event, limit = 50, offset = 0) => {
    return getPrintJobs(limit, offset)
  })
}
