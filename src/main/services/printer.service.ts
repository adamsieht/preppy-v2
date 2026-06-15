import fs from 'fs'
import path from 'path'
import { Worker } from 'worker_threads'
import dayjs from 'dayjs'
import { getConfig, resourcePath } from './config.service'
import { insertPrintJob } from './db.service'
import { logInfo, logWarn, logError, logDebug } from '../logger'

// On Windows, device config is a printer queue name (e.g. "Zebra ZPL") rather than a
// device path. Detect by absence of path separators or drive letter.
function isWindowsPrinterName(device: string): boolean {
  if (process.platform !== 'win32') return false
  return !device.includes('\\') && !device.includes('/') && !/^[A-Za-z]:/.test(device)
}

// --- Windows raw printing via a persistent FFI worker ------------------------
// Raw ZPL goes to the Windows print queue through the Win32 spooler API
// (winspool.drv, RAW datatype — no driver rendering). The actual FFI calls run in
// a long-lived worker thread (see printerWorker.ts) instead of spawning
// powershell.exe and compiling C# on every print, which cost ~300-500ms each.
//
// Keeping it off the main thread, with a per-job timeout that recycles a wedged
// worker, guarantees a stuck spooler can never freeze the UI or block later prints.
const WORKER_PATH    = path.join(__dirname, 'printerWorker.js')
const PRINT_TIMEOUT_MS = 15_000

interface PendingPrint {
  resolve: () => void
  reject: (err: Error) => void
  timer: ReturnType<typeof setTimeout>
}

let printWorker: Worker | null = null
let nextJobId = 1
const pendingPrints = new Map<number, PendingPrint>()

// Reject every in-flight print and drop the worker so the next print starts fresh.
function failAllPrints(err: Error): void {
  for (const job of pendingPrints.values()) {
    clearTimeout(job.timer)
    job.reject(err)
  }
  pendingPrints.clear()
  if (printWorker) {
    void printWorker.terminate().catch(() => { /* already gone */ })
    printWorker = null
  }
}

function getPrintWorker(): Worker {
  if (printWorker) return printWorker

  const worker = new Worker(WORKER_PATH)
  worker.on('message', (msg: { id: number; ok: boolean; error?: string }) => {
    const job = pendingPrints.get(msg.id)
    if (!job) return
    clearTimeout(job.timer)
    pendingPrints.delete(msg.id)
    if (msg.ok) job.resolve()
    else job.reject(new Error(msg.error || 'Raw print failed'))
  })
  worker.on('error', (err) => {
    logError(`Printer worker error: ${String(err)}`)
    failAllPrints(err instanceof Error ? err : new Error(String(err)))
  })
  worker.on('exit', (code) => {
    if (printWorker === worker) printWorker = null
    if (code !== 0) failAllPrints(new Error(`Printer worker exited with code ${code}`))
  })
  // Don't let the worker keep the process alive on quit.
  worker.unref()

  printWorker = worker
  return worker
}

// Send raw ZPL bytes to a Windows print queue. Resolves once the spooler has
// accepted the data (which it does even when the printer is offline), rejects with
// the Win32 error on failure, or rejects + recycles the worker on timeout.
function sendWindowsRaw(printerName: string, zplData: string): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    let worker: Worker
    try {
      worker = getPrintWorker()
    } catch (err) {
      reject(new Error(`Could not start printer worker: ${String(err)}`))
      return
    }

    const id = nextJobId++
    const timer = setTimeout(() => {
      pendingPrints.delete(id)
      // A wedged call must not block future prints — tear the worker down.
      failAllPrints(new Error('Printer worker timed out'))
      reject(new Error(`Raw print to "${printerName}" timed out — no spooler response in ${PRINT_TIMEOUT_MS / 1000}s`))
    }, PRINT_TIMEOUT_MS)

    pendingPrints.set(id, { resolve, reject, timer })
    worker.postMessage({ id, printerName, data: zplData })
  })
}

// Write the payload to the configured printer using the platform-aware path:
// Windows print queue via the FFI worker, or a Linux/Unix device file.
async function sendToDevice(payload: string, device: string, winPrinter: boolean): Promise<void> {
  if (winPrinter) await sendWindowsRaw(device, payload)
  else fs.writeFileSync(device, payload)
}

export type LabelTemplate = 'IX' | 'OX' | 'UX'

export interface PrintArgs {
  template: LabelTemplate
  durationHrs: number
  qty: number
  expiryIso?: string
}

export interface PrintResult {
  success: boolean
  simulated?: boolean
  simulatedPath?: string
  error?: string
}

function injectLabelHome(zpl: string, x: number, y: number): string {
  // Insert ^LH immediately after ^XA so it applies to the whole label
  return zpl.replace(/(\^XA\r?\n?)/, `$1^LH${x},${y}\n`)
}

function fillTemplate(raw: string, durationHrs: number, expiryIso?: string): string {
  const now    = dayjs()
  const expiry = expiryIso ? dayjs(expiryIso) : now.add(durationHrs, 'hour')
  return raw
    .replace(/\{\{DATE\}\}/g, now.format('MM/DD/YY'))
    .replace(/\{\{TIME\}\}/g, now.format('hh:mm A'))
    .replace(/\{\{EXPIRY_DATE\}\}/g, expiry.format('MM/DD/YY'))
    .replace(/\{\{EXPIRY_TIME\}\}/g, expiry.format('hh:mm A'))
    .replace(/\{\{DURATION\}\}/g, String(durationHrs))
}

export interface PreviewResult {
  success: boolean
  zpl?: string
  fields?: {
    template: LabelTemplate
    durationHrs: number
    printDate: string
    printTime: string
    expiryDate: string
    expiryTime: string
  }
  error?: string
}

export function preview(args: Omit<PrintArgs, 'qty'>): PreviewResult {
  const config = getConfig()
  const templatePath = resourcePath(config.printer.zplTemplateDir, `${args.template}.zpl`)

  let raw: string
  try {
    raw = fs.readFileSync(templatePath, 'utf-8')
  } catch (err) {
    return { success: false, error: `Failed to read ZPL template: ${String(err)}` }
  }

  const now    = dayjs()
  const expiry = args.expiryIso ? dayjs(args.expiryIso) : now.add(args.durationHrs, 'hour')
  const zpl = injectLabelHome(
    fillTemplate(raw, args.durationHrs, args.expiryIso),
    config.printer.labelhomeX ?? 0,
    config.printer.labelhomeY ?? 0,
  )

  return {
    success: true,
    zpl,
    fields: {
      template: args.template,
      durationHrs: args.durationHrs,
      printDate: now.format('MM/DD/YY'),
      printTime: now.format('hh:mm A'),
      expiryDate: expiry.format('MM/DD/YY'),
      expiryTime: expiry.format('hh:mm A'),
    },
  }
}

export async function print(args: PrintArgs): Promise<PrintResult> {
  const config = getConfig()
  const templatePath = resourcePath(config.printer.zplTemplateDir, `${args.template}.zpl`)

  let raw: string
  try {
    raw = fs.readFileSync(templatePath, 'utf-8')
  } catch (err) {
    const error = `Failed to read ZPL template ${templatePath}: ${String(err)}`
    logError(error)
    insertPrintJob({
      template: args.template,
      duration_hrs: args.durationHrs,
      qty: args.qty,
      printed_at: dayjs().toISOString(),
      success: 0,
      error_msg: error,
    })
    return { success: false, error }
  }

  const filled = injectLabelHome(
    fillTemplate(raw, args.durationHrs, args.expiryIso),
    config.printer.labelhomeX ?? 0,
    config.printer.labelhomeY ?? 0,
  )

  const winPrinter = isWindowsPrinterName(config.printer.device)
  const deviceExists = winPrinter || fs.existsSync(config.printer.device)
  const simulating = config.printer.simulate || !deviceExists

  if (simulating && !config.printer.simulate) {
    logWarn(`Printer device ${config.printer.device} not found — falling back to simulate mode`)
  }

  const simDir = path.join(process.cwd(), 'simulated-labels')
  if (simulating) fs.mkdirSync(simDir, { recursive: true })

  const timestamp = dayjs().format('YYYY-MM-DD_HH-mm-ss')
  let lastSimPath = ''

  logInfo(`${simulating ? '[SIMULATE] ' : ''}Printing ${args.qty}x ${args.template} label (${args.durationHrs}h)`)

  try {
    if (simulating) {
      for (let i = 0; i < args.qty; i++) {
        const outPath = path.join(simDir, `${timestamp}_${args.template}_${i + 1}of${args.qty}.zpl`)
        fs.writeFileSync(outPath, filled)
        lastSimPath = outPath
        logDebug(`[SIMULATE] Label ${i + 1}/${args.qty} written to ${outPath}`)
      }
    } else {
      // All copies go out as one spooler job / device write — no per-label overhead.
      await sendToDevice(filled.repeat(args.qty), config.printer.device, winPrinter)
      logDebug(`${args.qty}x ${args.template} label sent to ${config.printer.device}`)
    }
  } catch (err) {
    const error = `Failed to print ${args.template} label: ${String(err)}`
    logError(error)
    insertPrintJob({
      template: args.template,
      duration_hrs: args.durationHrs,
      qty: args.qty,
      printed_at: dayjs().toISOString(),
      success: 0,
      error_msg: error,
    })
    return { success: false, error }
  }

  insertPrintJob({
    template: args.template,
    duration_hrs: args.durationHrs,
    qty: args.qty,
    printed_at: dayjs().toISOString(),
    success: 1,
    error_msg: null,
  })

  logInfo(`${simulating ? '[SIMULATE] ' : ''}Print job complete: ${args.qty}x ${args.template}`)
  return { success: true, simulated: simulating, simulatedPath: lastSimPath || undefined }
}

export interface PrintRawArgs {
  zpl: string
  qty: number
}

/**
 * Print a pre-generated ZPL document (used by static presets). Applies the
 * configured label-home offset and honours simulate mode, but does NOT run
 * fillTemplate (the ZPL is already complete) and does NOT log to the print-job
 * history (static jobs carry no template/duration).
 */
export async function printRaw(args: PrintRawArgs): Promise<PrintResult> {
  const config = getConfig()
  const filled = injectLabelHome(
    args.zpl,
    config.printer.labelhomeX ?? 0,
    config.printer.labelhomeY ?? 0,
  )

  const winPrinter = isWindowsPrinterName(config.printer.device)
  const deviceExists = winPrinter || fs.existsSync(config.printer.device)
  const simulating = config.printer.simulate || !deviceExists
  if (simulating && !config.printer.simulate) {
    logWarn(`Printer device ${config.printer.device} not found — falling back to simulate mode`)
  }

  const simDir = path.join(process.cwd(), 'simulated-labels')
  if (simulating) fs.mkdirSync(simDir, { recursive: true })

  const timestamp = dayjs().format('YYYY-MM-DD_HH-mm-ss')
  let lastSimPath = ''

  logInfo(`${simulating ? '[SIMULATE] ' : ''}Printing ${args.qty}x static label`)

  try {
    if (simulating) {
      for (let i = 0; i < args.qty; i++) {
        const outPath = path.join(simDir, `${timestamp}_STATIC_${i + 1}of${args.qty}.zpl`)
        fs.writeFileSync(outPath, filled)
        lastSimPath = outPath
        logDebug(`[SIMULATE] Static label ${i + 1}/${args.qty} written to ${outPath}`)
      }
    } else {
      // All copies go out as one spooler job / device write — no per-label overhead.
      await sendToDevice(filled.repeat(args.qty), config.printer.device, winPrinter)
      logDebug(`${args.qty}x static label sent to ${config.printer.device}`)
    }
  } catch (err) {
    const error = `Failed to print static label: ${String(err)}`
    logError(error)
    return { success: false, error }
  }

  logInfo(`${simulating ? '[SIMULATE] ' : ''}Static print job complete: ${args.qty}x`)
  return { success: true, simulated: simulating, simulatedPath: lastSimPath || undefined }
}

/**
 * Send arbitrary bytes to the configured printer using the platform-aware path
 * (Windows print queue via the raw spooler API, or a Linux device file). No
 * template filling, label-home offset, or history logging — used for raw ZPL
 * debugging and printer calibration commands (e.g. ~JC).
 */
export async function sendRawToDevice(data: string): Promise<{ success: boolean; simulated?: boolean; error?: string }> {
  const config = getConfig()
  const winPrinter = isWindowsPrinterName(config.printer.device)
  const deviceExists = winPrinter || fs.existsSync(config.printer.device)
  const simulating = config.printer.simulate || !deviceExists

  if (simulating) {
    const simDir = path.join(process.cwd(), 'simulated-labels')
    try {
      fs.mkdirSync(simDir, { recursive: true })
      const outPath = path.join(simDir, `${dayjs().format('YYYY-MM-DD_HH-mm-ss')}_RAW.zpl`)
      fs.writeFileSync(outPath, data)
      logInfo(`[SIMULATE] Raw data written to ${outPath}`)
      return { success: true, simulated: true }
    } catch (err) {
      return { success: false, error: String(err) }
    }
  }

  try {
    await sendToDevice(data, config.printer.device, winPrinter)
    logInfo(`Raw data (${data.length} bytes) sent to ${config.printer.device}`)
    return { success: true }
  } catch (err) {
    const error = `Failed to send raw data to ${config.printer.device}: ${String(err)}`
    logError(error)
    return { success: false, error }
  }
}
