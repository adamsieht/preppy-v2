import fs from 'fs'
import { spawn, execFile } from 'child_process'
import { promisify } from 'util'
import { app } from 'electron'
import { resourcePath } from './config.service'
import { logInfo, logWarn, logError } from '../logger'

const execFileAsync = promisify(execFile)

const QUEUE_NAME  = 'Zebra ZPL'
const DRIVER_NAME = 'Generic / Text Only'

function scriptPath(): string {
  return resourcePath('scripts', 'setup-printer-windows.ps1')
}

interface PrinterStatus { driver: boolean; queue: boolean; usbPort: boolean }

// Non-elevated probe: does the driver/queue exist, and is a USB printer port present?
// Querying the spooler needs no admin, so we can decide whether elevation is worth it.
async function probe(): Promise<PrinterStatus | null> {
  const command = [
    `$d = [bool](Get-PrinterDriver -Name '${DRIVER_NAME}' -ErrorAction SilentlyContinue)`,
    `$q = [bool](Get-Printer -Name '${QUEUE_NAME}' -ErrorAction SilentlyContinue)`,
    `$u = (@(Get-PrinterPort -ErrorAction SilentlyContinue | Where-Object { $_.Name -match '^USB' }).Count -gt 0)`,
    `Write-Output "$d|$q|$u"`,
  ].join('; ')
  try {
    const { stdout } = await execFileAsync('powershell.exe', [
      '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', command,
    ], { timeout: 15000, windowsHide: true })
    const [d, q, u] = stdout.trim().split('|')
    return { driver: d === 'True', queue: q === 'True', usbPort: u === 'True' }
  } catch (err) {
    logWarn(`Printer probe failed: ${String(err)}`)
    return null
  }
}

// Launch the self-elevating printer-setup script (quiet = hidden, no prompts).
function launch(quiet: boolean): { success: boolean; error?: string } {
  const script = scriptPath()
  if (!fs.existsSync(script)) {
    const error = `Printer setup script not found at ${script}`
    logError(error)
    return { success: false, error }
  }
  try {
    const args = ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', script]
    if (quiet) args.push('-Quiet')
    const child = spawn('powershell.exe', args, {
      detached: true, windowsHide: quiet, stdio: 'ignore',
    })
    child.unref()
    return { success: true }
  } catch (err) {
    const error = `Failed to launch printer setup: ${String(err)}`
    logError(error)
    return { success: false, error }
  }
}

/**
 * On launch (packaged Windows), make sure the Generic/Text Only driver and the
 * Zebra ZPL queue exist so the printer can be detected and printed to. Runs the
 * elevated setup only when something is actually missing (driver absent, or
 * queue absent while a USB printer is connected), so it won't prompt on every
 * launch. Touches only the print spooler — no other Windows settings.
 */
export async function ensurePrinterSetupOnLaunch(): Promise<void> {
  if (process.platform !== 'win32' || !app.isPackaged) return
  const status = await probe()
  if (!status) return
  const needed = !status.driver || (!status.queue && status.usbPort)
  if (!needed) {
    logInfo(`Printer setup OK (driver=${status.driver}, queue=${status.queue})`)
    return
  }
  logInfo(`Printer setup needed (driver=${status.driver}, queue=${status.queue}, usbPort=${status.usbPort}) — launching elevated setup`)
  launch(true)
}

/** Manually (re)run printer setup from Settings — shows a visible result window. */
export function runPrinterSetup(): { success: boolean; error?: string } {
  if (process.platform !== 'win32') {
    return { success: false, error: 'Printer setup is only required on Windows.' }
  }
  logInfo('Manual printer setup requested')
  return launch(false)
}
