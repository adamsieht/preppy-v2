import fs from 'fs'
import path from 'path'
import { spawn, execFileSync } from 'child_process'
import { app, dialog, BrowserWindow } from 'electron'
import { resourcePath } from './config.service'
import { logInfo, logWarn, logError } from '../logger'

const SETUP_STATE_FILE = 'setup-state.json'

interface SetupState { dontAsk?: boolean }

function statePath(): string {
  return path.join(app.getPath('userData'), SETUP_STATE_FILE)
}

function readState(): SetupState {
  try { return JSON.parse(fs.readFileSync(statePath(), 'utf-8')) as SetupState }
  catch { return {} }
}

function writeState(state: SetupState): void {
  try { fs.writeFileSync(statePath(), JSON.stringify(state, null, 2), 'utf-8') }
  catch (err) { logWarn(`Failed to write setup state: ${String(err)}`) }
}

// The installer registers a "Preppy" scheduled task; its presence is our signal
// that setup has already run on this machine.
function scheduledTaskExists(): boolean {
  try {
    execFileSync('schtasks', ['/Query', '/TN', 'Preppy'], { stdio: 'ignore', timeout: 5000 })
    return true
  } catch {
    return false
  }
}

// The portable target runs from a temp-extracted copy; PORTABLE_EXECUTABLE_FILE
// is the actual .exe the user launched, which is what we want the wizard to install.
function currentExe(): string {
  return process.env.PORTABLE_EXECUTABLE_FILE || process.execPath
}

/**
 * Launch the bundled GUI setup wizard. Passes -LocalExe so the wizard installs
 * the copy the user already launched instead of re-downloading it. The wizard
 * self-elevates (its own UAC prompt), so this initial process exits immediately.
 */
export function launchSetupWizard(): { success: boolean; error?: string } {
  const script = resourcePath('scripts', 'install-wizard.ps1')
  if (!fs.existsSync(script)) {
    const error = `Setup wizard not found at ${script}`
    logError(error)
    return { success: false, error }
  }
  try {
    const exe = currentExe()
    logInfo(`Launching setup wizard with local exe: ${exe}`)
    const child = spawn('powershell.exe', [
      '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', script, '-LocalExe', exe,
    ], { detached: true, windowsHide: false, stdio: 'ignore' })
    child.unref()
    return { success: true }
  } catch (err) {
    const error = `Failed to launch setup wizard: ${String(err)}`
    logError(error)
    return { success: false, error }
  }
}

/**
 * On first run (packaged Windows only), if Preppy isn't installed yet and the
 * user hasn't opted out, offer to launch the bundled setup wizard.
 */
export async function maybePromptFirstRunSetup(win: BrowserWindow): Promise<void> {
  if (process.platform !== 'win32' || !app.isPackaged) return
  if (scheduledTaskExists()) return
  if (readState().dontAsk) return

  let response = 1
  let checkboxChecked = false
  try {
    const result = await dialog.showMessageBox(win, {
      type: 'question',
      buttons: ['Set Up Now', 'Not Now'],
      defaultId: 0,
      cancelId: 1,
      title: 'Preppy Setup',
      message: 'Set up Preppy on this tablet?',
      detail:
        'This installs Preppy to your user folder and configures it to launch ' +
        'automatically in kiosk mode, installs the label-printer driver, and ' +
        'adjusts power/sleep settings so the tablet stays on.\n\n' +
        'Windows will show an administrator prompt to allow the changes.',
      checkboxLabel: "Don't ask again",
      checkboxChecked: false,
      noLink: true,
    })
    response = result.response
    checkboxChecked = result.checkboxChecked
  } catch (err) {
    logWarn(`First-run setup prompt failed: ${String(err)}`)
    return
  }

  if (response === 0) {
    launchSetupWizard()
  } else if (checkboxChecked) {
    writeState({ dontAsk: true })
  }
}
