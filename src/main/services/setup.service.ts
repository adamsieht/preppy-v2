import fs from 'fs'
import os from 'os'
import path from 'path'
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

// ─── First-run setup wizard ──────────────────────────────────────────────────

const SETUP_STATE_FILE = 'setup-state.json'

export interface SetupState {
  /** True when the in-app wizard should be shown (packaged Windows, not yet completed). */
  needsSetup: boolean
  completed: boolean
  completedAt: string | null
}

export interface KioskSetupOptions {
  /** 'no-reboot' = allow Windows updates but never auto-restart; 'disable' = no auto updates at all. */
  windowsUpdatePolicy: 'no-reboot' | 'disable'
  autoLogin: boolean
  autoLoginUser: string
  autoLoginPassword: string
  /** Launch Preppy automatically at login (per-user, no admin needed). */
  autoStart: boolean
}

export interface KioskSetupResult {
  success: boolean
  error?: string
  /** Tail of the hardening script's log, for display in the wizard. */
  log?: string
}

function setupStatePath(): string {
  return path.join(app.getPath('userData'), SETUP_STATE_FILE)
}

export function getSetupState(): SetupState {
  let completedAt: string | null = null
  try {
    const raw = JSON.parse(fs.readFileSync(setupStatePath(), 'utf-8'))
    if (typeof raw.completedAt === 'string') completedAt = raw.completedAt
  } catch { /* first run — no state file yet */ }
  const completed = completedAt !== null
  return {
    needsSetup: process.platform === 'win32' && app.isPackaged && !completed,
    completed,
    completedAt,
  }
}

/** Mark the wizard as done (also used by "Skip" so it never nags again). */
export function markSetupComplete(): void {
  fs.writeFileSync(setupStatePath(), JSON.stringify({ completedAt: new Date().toISOString() }, null, 2), 'utf-8')
}

/** Clear the flag so the wizard shows again on next app load (Settings → re-run). */
export function resetSetupState(): void {
  try { fs.unlinkSync(setupStatePath()) } catch { /* already absent */ }
}

/** Enable/disable launch-at-login for the installed app. Per-user, no elevation. */
export function setAutoStart(enabled: boolean): void {
  if (process.platform !== 'win32' || !app.isPackaged) return
  app.setLoginItemSettings({ openAtLogin: enabled })
  logInfo(`Auto-start at login ${enabled ? 'enabled' : 'disabled'}`)
}

/**
 * Run the elevated kiosk-hardening script (scripts/setup-kiosk.ps1) and wait for
 * it to finish. Options are handed over via a temp JSON file so credentials never
 * appear on a command line; the script deletes the file as soon as it's read.
 * Elevation happens via a non-elevated PowerShell bootstrap that Start-Process
 * -Verb RunAs -Wait's the real script, so we get a UAC prompt exactly once and a
 * real exit code back.
 */
export function runKioskSetup(options: KioskSetupOptions): Promise<KioskSetupResult> {
  if (process.platform !== 'win32') {
    return Promise.resolve({ success: false, error: 'Kiosk setup is only available on Windows.' })
  }
  const script = resourcePath('scripts', 'setup-kiosk.ps1')
  if (!fs.existsSync(script)) {
    return Promise.resolve({ success: false, error: `Setup script not found at ${script}` })
  }

  // Auto-start needs no elevation — handle it directly.
  setAutoStart(options.autoStart)

  const optionsFile = path.join(os.tmpdir(), `preppy-setup-options-${Date.now()}.json`)
  const logFile = path.join(os.tmpdir(), 'preppy-kiosk-setup.log')
  fs.writeFileSync(optionsFile, JSON.stringify({
    windowsUpdatePolicy: options.windowsUpdatePolicy,
    autoLogin: options.autoLogin,
    autoLoginUser: options.autoLoginUser,
    autoLoginPassword: options.autoLoginPassword,
  }), 'utf-8')

  const q = (s: string) => s.replace(/'/g, "''")
  const bootstrap = [
    `$p = Start-Process powershell -Verb RunAs -Wait -PassThru -WindowStyle Hidden -ArgumentList @(`,
    `'-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass',`,
    `'-File','${q(script)}','-OptionsFile','${q(optionsFile)}','-LogFile','${q(logFile)}')`,
    `exit $p.ExitCode`,
  ].join(' ')

  logInfo('Launching elevated kiosk setup script')
  return new Promise<KioskSetupResult>((resolve) => {
    const child = spawn('powershell.exe', [
      '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-Command', bootstrap,
    ], { windowsHide: true, stdio: 'ignore' })

    const finish = (result: KioskSetupResult) => {
      try { fs.unlinkSync(optionsFile) } catch { /* script already deleted it */ }
      resolve(result)
    }

    child.on('error', (err) => {
      logError(`Kiosk setup failed to launch: ${String(err)}`)
      finish({ success: false, error: `Failed to launch setup: ${String(err)}` })
    })

    child.on('close', (code) => {
      let log = ''
      try { log = fs.readFileSync(logFile, 'utf-8').split('\n').slice(-60).join('\n') } catch { /* no log written */ }
      if (code === 0) {
        logInfo('Kiosk setup completed successfully')
        finish({ success: true, log })
      } else {
        // A cancelled UAC prompt makes Start-Process throw → non-zero exit.
        logWarn(`Kiosk setup exited with code ${code}`)
        finish({
          success: false,
          error: `Setup script exited with code ${code}. If you cancelled the administrator prompt, run setup again and choose Yes.`,
          log,
        })
      }
    })
  })
}
