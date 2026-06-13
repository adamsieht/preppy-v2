import fs from 'fs'
import path from 'path'
import { spawn } from 'child_process'
import { app } from 'electron'
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

// Send raw ZPL bytes to a Windows print queue using the Win32 print spooler API via
// an inline-compiled C# helper. Avoids driver rendering entirely — bytes go straight
// through ("RAW" data type). Requires the queue to use Generic / Text Only driver.
async function sendWindowsRaw(printerName: string, zplData: string): Promise<void> {
  const ts      = Date.now()
  const tempDir = app.getPath('temp')
  const zplFile = path.join(tempDir, `preppy_${ts}.zpl`)
  const psFile  = path.join(tempDir, `preppy_${ts}.ps1`)

  fs.writeFileSync(zplFile, zplData, 'utf-8')

  // In PowerShell single-quoted strings backslashes are literal; only ' needs escaping
  const psZplPath     = zplFile.replace(/'/g, "''")
  const psPrinterName = printerName.replace(/'/g, "''")

  const psScript = `
$ErrorActionPreference = 'Stop'
function Err { return [System.Runtime.InteropServices.Marshal]::GetLastWin32Error() }
$bytes = [System.IO.File]::ReadAllBytes('${psZplPath}')
$src = @"
using System;
using System.Runtime.InteropServices;
public class RawPrint {
  [DllImport("winspool.drv", CharSet=CharSet.Ansi, SetLastError=true)]
  public static extern bool OpenPrinter(string n, ref IntPtr h, IntPtr d);
  [DllImport("winspool.drv", SetLastError=true)]
  public static extern bool ClosePrinter(IntPtr h);
  [DllImport("winspool.drv", CharSet=CharSet.Ansi, SetLastError=true)]
  public static extern int StartDocPrinter(IntPtr h, int l, ref DocInfo d);
  [DllImport("winspool.drv", SetLastError=true)]
  public static extern bool StartPagePrinter(IntPtr h);
  [DllImport("winspool.drv", SetLastError=true)]
  public static extern bool WritePrinter(IntPtr h, byte[] b, int n, ref int w);
  [DllImport("winspool.drv", SetLastError=true)]
  public static extern bool EndPagePrinter(IntPtr h);
  [DllImport("winspool.drv", SetLastError=true)]
  public static extern bool EndDocPrinter(IntPtr h);
  [StructLayout(LayoutKind.Sequential, CharSet=CharSet.Ansi)]
  public struct DocInfo { public string pDocName; public string pOutputFile; public string pDataType; }
}
"@
Add-Type -TypeDefinition $src -ErrorAction SilentlyContinue
$h = [IntPtr]::Zero
if (-not [RawPrint]::OpenPrinter('${psPrinterName}', [ref]$h, [IntPtr]::Zero)) {
  throw "OpenPrinter failed for printer '${psPrinterName}' (Win32 error $(Err)). Is the print queue installed?"
}
try {
  $di = New-Object RawPrint+DocInfo
  $di.pDocName  = 'Preppy ZPL'
  $di.pDataType = 'RAW'
  $job = [RawPrint]::StartDocPrinter($h, 1, [ref]$di)
  if ($job -eq 0) { throw "StartDocPrinter failed (Win32 error $(Err)). The queue may not allow RAW data." }
  if (-not [RawPrint]::StartPagePrinter($h)) { throw "StartPagePrinter failed (Win32 error $(Err))" }
  $w = 0
  if (-not [RawPrint]::WritePrinter($h, $bytes, $bytes.Length, [ref]$w)) {
    throw "WritePrinter failed (Win32 error $(Err))"
  }
  if ($w -ne $bytes.Length) { throw "WritePrinter only wrote $w of $($bytes.Length) bytes" }
  [RawPrint]::EndPagePrinter($h) | Out-Null
  [RawPrint]::EndDocPrinter($h) | Out-Null
} finally {
  [RawPrint]::ClosePrinter($h) | Out-Null
}
Write-Output "OK: wrote $w bytes to '${psPrinterName}'"
`.trim()

  fs.writeFileSync(psFile, psScript, 'utf-8')

  return new Promise((resolve, reject) => {
    const ps = spawn('powershell.exe', [
      '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', psFile,
    ], { windowsHide: true })

    let stdout = ''
    let stderr = ''
    ps.stdout?.on('data', (d: Buffer) => { stdout += d.toString() })
    ps.stderr?.on('data', (d: Buffer) => { stderr += d.toString() })

    ps.on('error', (err) => {
      for (const f of [zplFile, psFile]) { try { fs.unlinkSync(f) } catch { /* already gone */ } }
      reject(new Error(`Could not launch PowerShell: ${String(err)}`))
    })

    ps.on('close', (code) => {
      for (const f of [zplFile, psFile]) { try { fs.unlinkSync(f) } catch { /* already gone */ } }
      if (code === 0) { resolve(); return }
      const detail = [stderr.trim(), stdout.trim()].filter(Boolean).join(' | ')
      reject(new Error(detail || `PowerShell raw print failed (exit ${code})`))
    })
  })
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

  for (let i = 0; i < args.qty; i++) {
    try {
      if (simulating) {
        const outPath = path.join(simDir, `${timestamp}_${args.template}_${i + 1}of${args.qty}.zpl`)
        fs.writeFileSync(outPath, filled)
        lastSimPath = outPath
        logDebug(`[SIMULATE] Label ${i + 1}/${args.qty} written to ${outPath}`)
      } else if (winPrinter) {
        await sendWindowsRaw(config.printer.device, filled)
        logDebug(`Label ${i + 1}/${args.qty} sent to Windows printer "${config.printer.device}"`)
      } else {
        fs.writeFileSync(config.printer.device, filled)
        logDebug(`Label ${i + 1}/${args.qty} sent to ${config.printer.device}`)
      }
    } catch (err) {
      const error = `Failed to write label ${i + 1}: ${String(err)}`
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

  for (let i = 0; i < args.qty; i++) {
    try {
      if (simulating) {
        const outPath = path.join(simDir, `${timestamp}_STATIC_${i + 1}of${args.qty}.zpl`)
        fs.writeFileSync(outPath, filled)
        lastSimPath = outPath
        logDebug(`[SIMULATE] Static label ${i + 1}/${args.qty} written to ${outPath}`)
      } else if (winPrinter) {
        await sendWindowsRaw(config.printer.device, filled)
        logDebug(`Static label ${i + 1}/${args.qty} sent to Windows printer "${config.printer.device}"`)
      } else {
        fs.writeFileSync(config.printer.device, filled)
        logDebug(`Static label ${i + 1}/${args.qty} sent to ${config.printer.device}`)
      }
    } catch (err) {
      const error = `Failed to write static label ${i + 1}: ${String(err)}`
      logError(error)
      return { success: false, error }
    }
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
    if (winPrinter) await sendWindowsRaw(config.printer.device, data)
    else fs.writeFileSync(config.printer.device, data)
    logInfo(`Raw data (${data.length} bytes) sent to ${config.printer.device}`)
    return { success: true }
  } catch (err) {
    const error = `Failed to send raw data to ${config.printer.device}: ${String(err)}`
    logError(error)
    return { success: false, error }
  }
}
