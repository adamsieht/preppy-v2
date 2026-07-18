import { app, BrowserWindow } from 'electron'
import { autoUpdater } from 'electron-updater'
import type { UpdateInfo, ProgressInfo } from 'electron-updater'
import { IPC } from '../ipc/channels'
import { logInfo, logWarn, logError } from '../logger'

export type UpdateStatus =
  | 'idle'          // no check has run yet
  | 'checking'
  | 'up-to-date'
  | 'available'     // found, download starting (autoDownload is on)
  | 'downloading'
  | 'downloaded'    // will install on quit; can also install now
  | 'error'

export interface UpdateProgress {
  percent: number
  transferredBytes: number
  totalBytes: number
  bytesPerSecond: number
}

export interface UpdaterState {
  status: UpdateStatus
  currentVersion: string
  latestVersion: string | null
  releaseNotes: string | null
  releaseDate: string | null
  progress: UpdateProgress | null
  error: string | null
  /** False on platforms/builds where self-update can't work (dev builds, non-AppImage Linux). */
  supported: boolean
}

const CHECK_INTERVAL_MS = 4 * 60 * 60 * 1000 // every 4 hours
const FIRST_CHECK_DELAY_MS = 15 * 1000       // let startup settle first

function updatesSupported(): boolean {
  if (!app.isPackaged) return false
  if (process.platform === 'win32') return true
  if (process.platform === 'linux') return Boolean(process.env.APPIMAGE)
  return false
}

const state: UpdaterState = {
  status: 'idle',
  currentVersion: app.getVersion(),
  latestVersion: null,
  releaseNotes: null,
  releaseDate: null,
  progress: null,
  error: null,
  supported: updatesSupported(),
}

export function getUpdaterState(): UpdaterState {
  return { ...state }
}

function broadcast(): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.webContents.isDestroyed()) {
      win.webContents.send(IPC.UPDATE_STATE, getUpdaterState())
    }
  }
}

function setState(patch: Partial<UpdaterState>): void {
  Object.assign(state, patch)
  broadcast()
}

// GitHub releases return notes as a string; other providers may return an array.
function notesToString(notes: UpdateInfo['releaseNotes']): string | null {
  if (!notes) return null
  if (typeof notes === 'string') return notes
  return notes.map(n => n.note ?? '').filter(Boolean).join('\n\n') || null
}

let initialized = false
let checkTimer: NodeJS.Timeout | null = null

/**
 * Wire up electron-updater: auto-check on launch and every few hours,
 * auto-download in the background, and install silently on quit. The renderer
 * gets pushed the full state on every transition (IPC.UPDATE_STATE).
 */
export function initAutoUpdater(): void {
  if (initialized || !state.supported) {
    if (!state.supported) logInfo('Auto-update not supported in this build/platform — skipping updater init')
    return
  }
  initialized = true

  autoUpdater.autoDownload = true
  autoUpdater.autoInstallOnAppQuit = true
  autoUpdater.logger = {
    info:  (...a: unknown[]) => logInfo('[updater]', ...a),
    warn:  (...a: unknown[]) => logWarn('[updater]', ...a),
    error: (...a: unknown[]) => logError('[updater]', ...a),
    debug: (...a: unknown[]) => logInfo('[updater]', ...a),
  }

  autoUpdater.on('checking-for-update', () => {
    setState({ status: 'checking', error: null })
  })

  autoUpdater.on('update-available', (info: UpdateInfo) => {
    logInfo(`Update available: v${info.version} (current v${state.currentVersion})`)
    setState({
      status: 'available',
      latestVersion: info.version,
      releaseNotes: notesToString(info.releaseNotes),
      releaseDate: info.releaseDate ?? null,
      error: null,
    })
  })

  autoUpdater.on('update-not-available', (info: UpdateInfo) => {
    setState({
      status: 'up-to-date',
      latestVersion: info.version,
      releaseNotes: null,
      releaseDate: info.releaseDate ?? null,
      progress: null,
      error: null,
    })
  })

  autoUpdater.on('download-progress', (p: ProgressInfo) => {
    setState({
      status: 'downloading',
      progress: {
        percent: p.percent,
        transferredBytes: p.transferred,
        totalBytes: p.total,
        bytesPerSecond: p.bytesPerSecond,
      },
    })
  })

  autoUpdater.on('update-downloaded', (info: UpdateInfo) => {
    logInfo(`Update downloaded: v${info.version} — will install on quit`)
    setState({
      status: 'downloaded',
      latestVersion: info.version,
      releaseNotes: notesToString(info.releaseNotes),
      releaseDate: info.releaseDate ?? null,
      progress: null,
      error: null,
    })
  })

  autoUpdater.on('error', (err: Error) => {
    logError('Auto-update error:', err)
    setState({ status: 'error', error: err.message, progress: null })
  })

  setTimeout(() => { void checkForUpdates() }, FIRST_CHECK_DELAY_MS)
  checkTimer = setInterval(() => { void checkForUpdates() }, CHECK_INTERVAL_MS)
}

export function stopAutoUpdater(): void {
  if (checkTimer) {
    clearInterval(checkTimer)
    checkTimer = null
  }
}

/** Trigger a check (manual or scheduled). Errors land in state, not thrown. */
export async function checkForUpdates(): Promise<UpdaterState> {
  if (!state.supported) {
    setState({ status: 'error', error: 'Updates are only available in packaged builds.' })
    return getUpdaterState()
  }
  // Don't restart a check while one is downloading — it would cancel progress.
  if (state.status === 'checking' || state.status === 'downloading') return getUpdaterState()
  try {
    await autoUpdater.checkForUpdates()
  } catch (err) {
    // The 'error' event handler has already recorded this; guard for early failures.
    if (state.status !== 'error') {
      setState({ status: 'error', error: err instanceof Error ? err.message : String(err) })
    }
  }
  return getUpdaterState()
}

/** Quit and install the downloaded update now (silent install, relaunch after). */
export function installUpdateNow(): void {
  if (state.status !== 'downloaded') {
    throw new Error('No update has been downloaded yet.')
  }
  logInfo('Installing update now (quitAndInstall)')
  // isSilent=true: no installer UI; isForceRunAfter=true: relaunch when done.
  autoUpdater.quitAndInstall(true, true)
}
