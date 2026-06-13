import { useState, useEffect } from 'react'
import SettingsCard from '../../../components/settings/SettingsCard'
import { ui } from '../../../components/settings/styles'
import type { UpdateCheckResult, UpdateSettings } from '../../../../main/services/updater.service'

type Phase = 'idle' | 'checking' | 'checked' | 'downloading' | 'ready' | 'error'

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

function formatDate(iso: string): string {
  if (!iso) return ''
  try {
    return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })
  } catch {
    return iso
  }
}

export default function UpdatesTab() {
  const [currentVersion, setCurrentVersion] = useState('')
  const [phase, setPhase] = useState<Phase>('idle')
  const [checkResult, setCheckResult] = useState<UpdateCheckResult | null>(null)
  const [downloadProgress, setDownloadProgress] = useState<{ downloaded: number; total: number } | null>(null)
  const [errorMessage, setErrorMessage] = useState('')
  const [settings, setSettings] = useState<UpdateSettings>({ repoOwner: 'adamsieht', repoName: 'preppy-v2', token: '' })
  const [settingsExpanded, setSettingsExpanded] = useState(false)
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saved'>('idle')

  useEffect(() => {
    window.electronAPI.getAppVersion().then(setCurrentVersion)
    window.electronAPI.getUpdateSettings().then(setSettings)

    const unsub = window.electronAPI.onUpdateProgress((data) => {
      setDownloadProgress(data)
    })
    return unsub
  }, [])

  async function handleCheck() {
    setPhase('checking')
    setCheckResult(null)
    setErrorMessage('')
    const res = await window.electronAPI.checkForUpdate()
    if (res.success && res.result) {
      setCheckResult(res.result)
      setPhase('checked')
    } else {
      setErrorMessage(res.error ?? 'Unknown error')
      setPhase('error')
    }
  }

  async function handleDownload() {
    if (!checkResult?.downloadUrl) return
    setPhase('downloading')
    setDownloadProgress(null)
    const res = await window.electronAPI.downloadUpdate(checkResult.downloadUrl)
    if (res.success) {
      setPhase('ready')
    } else {
      setErrorMessage(res.error ?? 'Download failed')
      setPhase('error')
    }
  }

  async function handleInstall() {
    await window.electronAPI.applyUpdate()
  }

  async function handleSaveSettings() {
    await window.electronAPI.saveUpdateSettings(settings)
    setSaveStatus('saved')
    setTimeout(() => setSaveStatus('idle'), 2000)
  }

  const pct = downloadProgress && downloadProgress.total > 0
    ? Math.round((downloadProgress.downloaded / downloadProgress.total) * 100)
    : 0

  return (
    <div className="flex flex-col gap-5 max-w-2xl">

      <SettingsCard title="Application Version">
        <div className="flex items-center gap-4 flex-wrap">
          <span className={ui.stat}>
            Current version: <span className={ui.statNum}>{currentVersion ? `v${currentVersion}` : '—'}</span>
          </span>
          <button
            className={ui.primaryBtn}
            onClick={handleCheck}
            disabled={phase === 'checking'}
          >
            {phase === 'checking' ? 'Checking…' : 'Check for Updates'}
          </button>
        </div>

        {phase === 'checked' && checkResult && !checkResult.hasUpdate && (
          <div className="text-[#3fb950] text-sm mt-1">
            &#10003; Already up to date (v{checkResult.latestVersion})
          </div>
        )}

        {phase === 'error' && (
          <div className="text-[#f85149] text-sm mt-1">{errorMessage}</div>
        )}
      </SettingsCard>

      {checkResult && (
        <SettingsCard title={phase === 'ready' ? 'Ready to Install' : checkResult.hasUpdate ? 'Update Available' : 'Latest Release'}>
          <div className="flex flex-col gap-2">
            <div className="flex gap-4 flex-wrap">
              <span className={ui.stat}>
                Latest: <span className={ui.statNum}>v{checkResult.latestVersion}</span>
              </span>
              {checkResult.publishedAt && (
                <span className={ui.stat}>Released: {formatDate(checkResult.publishedAt)}</span>
              )}
              {checkResult.fileSize > 0 && (
                <span className={ui.stat}>Size: {formatBytes(checkResult.fileSize)}</span>
              )}
            </div>

            {checkResult.releaseNotes && (
              <div
                className="max-h-48 overflow-y-auto scrollbar-dark bg-[#0d1117] border border-[#30363d] rounded-lg p-3 text-xs text-[#adbac7] whitespace-pre-wrap font-mono"
              >
                {checkResult.releaseNotes}
              </div>
            )}

            {checkResult.hasUpdate && phase !== 'ready' && phase !== 'downloading' && (
              <div className={ui.actionRow}>
                <button className={ui.primaryBtn} onClick={handleDownload}>
                  Download Update
                </button>
              </div>
            )}

            {phase === 'downloading' && (
              <div className="flex flex-col gap-1">
                <div className="text-[#adbac7] text-sm">
                  Downloading… {downloadProgress ? `${formatBytes(downloadProgress.downloaded)} / ${formatBytes(downloadProgress.total)} (${pct}%)` : ''}
                </div>
                <div className="bg-[#21262d] rounded-full h-2 overflow-hidden">
                  <div
                    className="bg-[#28a745] h-2 rounded-full transition-all"
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            )}

            {phase === 'ready' && (
              <div className={ui.actionRow}>
                <span className="text-[#3fb950] text-sm font-semibold">&#10003; Downloaded</span>
                <button className={ui.blueBtn} onClick={handleInstall}>
                  Install &amp; Restart
                </button>
              </div>
            )}

            {!checkResult.hasUpdate && phase !== 'ready' && (
              <div className="text-[#6e7681] text-sm">Already on latest version</div>
            )}
          </div>
        </SettingsCard>
      )}

      <SettingsCard
        title="Update Source"
        right={
          <button
            className={ui.secondaryBtn}
            onClick={() => setSettingsExpanded(v => !v)}
          >
            {settingsExpanded ? 'Collapse' : 'Configure'}
          </button>
        }
      >
        {settingsExpanded && (
          <div className="flex flex-col gap-3 mt-1">
            <div>
              <div className={ui.fieldLabel}>Repo Owner</div>
              <input
                className={ui.input}
                value={settings.repoOwner}
                onChange={e => setSettings(s => ({ ...s, repoOwner: e.target.value }))}
              />
            </div>
            <div>
              <div className={ui.fieldLabel}>Repo Name</div>
              <input
                className={ui.input}
                value={settings.repoName}
                onChange={e => setSettings(s => ({ ...s, repoName: e.target.value }))}
              />
            </div>
            <div>
              <div className={ui.fieldLabel}>GitHub Token</div>
              <input
                type="password"
                className={ui.input}
                value={settings.token}
                placeholder="Optional — required for private repos"
                onChange={e => setSettings(s => ({ ...s, token: e.target.value }))}
              />
            </div>
            <div className={ui.actionRow}>
              <button className={ui.primaryBtn} onClick={handleSaveSettings}>
                {saveStatus === 'saved' ? 'Saved!' : 'Save'}
              </button>
            </div>
            <div className={ui.note}>
              Requires a GitHub token with <code className={ui.mono}>repo</code> scope to check private repositories.
            </div>
          </div>
        )}
      </SettingsCard>

    </div>
  )
}
