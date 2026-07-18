import { useState, useEffect } from 'react'
import SettingsCard from '../../../components/settings/SettingsCard'
import { ui } from '../../../components/settings/styles'
import type { UpdaterState } from '../../../../main/services/updater.service'

function formatBytes(bytes: number): string {
  if (bytes <= 0) return '0 B'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

function formatDate(iso: string | null): string {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
  } catch {
    return iso
  }
}

/**
 * Updates are automatic: the app checks on launch and every few hours,
 * downloads in the background, and installs on the next quit/restart. This tab
 * shows that status and offers "check now" / "restart & update now" controls.
 */
export default function UpdatesTab() {
  const [state, setState] = useState<UpdaterState | null>(null)
  const [platform, setPlatform] = useState('')
  const [resetMsg, setResetMsg] = useState('')

  useEffect(() => {
    setPlatform(window.electronAPI.getPlatform())
    window.electronAPI.getUpdateState().then(setState)
    return window.electronAPI.onUpdateState(setState)
  }, [])

  async function handleCheck() {
    const s = await window.electronAPI.checkForUpdate()
    setState(s)
  }

  async function handleInstallNow() {
    await window.electronAPI.installUpdate()
  }

  async function handleRerunSetup() {
    await window.electronAPI.resetSetup()
    setResetMsg('Reopening setup wizard…')
    setTimeout(() => window.location.reload(), 600)
  }

  const status = state?.status ?? 'idle'
  const pct = state?.progress ? Math.round(state.progress.percent) : 0

  return (
    <div className="flex flex-col gap-5 max-w-2xl">

      <SettingsCard
        title="Application Version"
        desc="Preppy checks for updates automatically, downloads them in the background, and installs them the next time the app restarts."
      >
        <div className="flex items-center gap-4 flex-wrap">
          <span className={ui.stat}>
            Current version: <span className={ui.statNum}>{state ? `v${state.currentVersion}` : '—'}</span>
          </span>
          <button
            className={ui.primaryBtn}
            onClick={handleCheck}
            disabled={status === 'checking' || status === 'downloading'}
          >
            {status === 'checking' ? 'Checking…' : 'Check Now'}
          </button>
        </div>

        {status === 'up-to-date' && (
          <div className="text-[#3fb950] text-sm mt-1">
            &#10003; Up to date{state?.latestVersion ? ` (v${state.latestVersion})` : ''}
          </div>
        )}

        {status === 'error' && (
          <div className="text-[#f85149] text-sm mt-1">{state?.error}</div>
        )}

        {state && !state.supported && (
          <div className={ui.note}>
            Automatic updates are unavailable in this build (development mode or unsupported platform).
          </div>
        )}
      </SettingsCard>

      {(status === 'available' || status === 'downloading' || status === 'downloaded') && state && (
        <SettingsCard title={status === 'downloaded' ? 'Update Ready' : 'Update Available'}>
          <div className="flex flex-col gap-2">
            <div className="flex gap-4 flex-wrap">
              <span className={ui.stat}>
                New version: <span className={ui.statNum}>v{state.latestVersion}</span>
              </span>
              {state.releaseDate && (
                <span className={ui.stat}>Released: {formatDate(state.releaseDate)}</span>
              )}
            </div>

            {state.releaseNotes && (
              <div className="max-h-48 overflow-y-auto scrollbar-dark bg-[#0d1117] border border-[#30363d] rounded-lg p-3 text-xs text-[#adbac7] whitespace-pre-wrap font-mono">
                {state.releaseNotes}
              </div>
            )}

            {status !== 'downloaded' && (
              <div className="flex flex-col gap-1">
                <div className="text-[#adbac7] text-sm">
                  Downloading automatically…{' '}
                  {state.progress
                    ? `${formatBytes(state.progress.transferredBytes)} / ${formatBytes(state.progress.totalBytes)} (${pct}%)`
                    : ''}
                </div>
                <div className="bg-[#21262d] rounded-full h-2 overflow-hidden">
                  <div className="bg-[#28a745] h-2 rounded-full transition-all" style={{ width: `${pct}%` }} />
                </div>
              </div>
            )}

            {status === 'downloaded' && (
              <div className="flex flex-col gap-2">
                <div className="text-[#3fb950] text-sm font-semibold">
                  &#10003; Downloaded — installs automatically the next time Preppy restarts
                </div>
                <div className={ui.actionRow}>
                  <button className={ui.blueBtn} onClick={handleInstallNow}>
                    Restart &amp; Update Now
                  </button>
                </div>
              </div>
            )}
          </div>
        </SettingsCard>
      )}

      {platform === 'win32' && (
        <SettingsCard
          title="Tablet Setup"
          desc="Re-run the first-time setup wizard to change kiosk settings: Windows Update policy, auto-login, launch at startup, and power/lock-screen hardening."
        >
          <div className={ui.actionRow}>
            <button className={ui.secondaryBtn} onClick={handleRerunSetup}>
              Re-run Setup Wizard
            </button>
            {resetMsg && <span className="text-[#3fb950] text-sm">{resetMsg}</span>}
          </div>
        </SettingsCard>
      )}

    </div>
  )
}
