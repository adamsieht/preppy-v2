import https from 'https'
import http from 'http'
import fs from 'fs'
import os from 'os'
import path from 'path'
import { spawn } from 'child_process'
import { app } from 'electron'

export interface UpdateSettings {
  repoOwner: string
  repoName: string
  token: string
}

export interface UpdateCheckResult {
  hasUpdate: boolean
  currentVersion: string
  latestVersion: string
  releaseNotes: string
  publishedAt: string
  downloadUrl: string
  fileSize: number
}

const SETTINGS_FILE = 'update-settings.json'

const DEFAULTS: UpdateSettings = {
  repoOwner: 'adamsieht',
  repoName: 'preppy-v2',
  token: '',
}

export function loadUpdateSettings(): UpdateSettings {
  try {
    const filePath = path.join(app.getPath('userData'), SETTINGS_FILE)
    const raw = fs.readFileSync(filePath, 'utf-8')
    const parsed = JSON.parse(raw)
    return {
      repoOwner: typeof parsed.repoOwner === 'string' ? parsed.repoOwner : DEFAULTS.repoOwner,
      repoName: typeof parsed.repoName === 'string' ? parsed.repoName : DEFAULTS.repoName,
      token: typeof parsed.token === 'string' ? parsed.token : DEFAULTS.token,
    }
  } catch {
    return { ...DEFAULTS }
  }
}

export function saveUpdateSettings(s: UpdateSettings): void {
  const filePath = path.join(app.getPath('userData'), SETTINGS_FILE)
  fs.writeFileSync(filePath, JSON.stringify(s, null, 2), 'utf-8')
}

function compareVersions(a: string, b: string): number {
  const partsA = a.replace(/^v/, '').split('.').map(Number)
  const partsB = b.replace(/^v/, '').split('.').map(Number)
  const len = Math.max(partsA.length, partsB.length)
  for (let i = 0; i < len; i++) {
    const numA = partsA[i] ?? 0
    const numB = partsB[i] ?? 0
    if (numA > numB) return 1
    if (numA < numB) return -1
  }
  return 0
}

function httpsGet(url: string, headers: Record<string, string>): Promise<{ statusCode: number; body: string }> {
  return new Promise((resolve, reject) => {
    const makeRequest = (reqUrl: string, reqHeaders: Record<string, string>, redirectCount: number) => {
      if (redirectCount > 10) {
        reject(new Error('Too many redirects'))
        return
      }
      const parsed = new URL(reqUrl)
      const mod = parsed.protocol === 'https:' ? https : http
      const options = {
        hostname: parsed.hostname,
        port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
        path: parsed.pathname + parsed.search,
        method: 'GET',
        headers: reqHeaders,
      }
      const req = (mod as typeof https).request(options, (res) => {
        const code = res.statusCode ?? 0
        if (code >= 300 && code < 400 && res.headers.location) {
          makeRequest(res.headers.location, reqHeaders, redirectCount + 1)
          return
        }
        let body = ''
        res.on('data', (chunk: Buffer) => { body += chunk.toString() })
        res.on('end', () => resolve({ statusCode: code, body }))
      })
      req.on('error', reject)
      req.end()
    }
    makeRequest(url, headers, 0)
  })
}

export async function checkForUpdate(settings: UpdateSettings): Promise<UpdateCheckResult> {
  const currentVersion = app.getVersion()
  const url = `https://api.github.com/repos/${settings.repoOwner}/${settings.repoName}/releases/latest`

  const headers: Record<string, string> = {
    'User-Agent': 'PrepyApp/updater',
    'Accept': 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28',
  }
  if (settings.token) {
    headers['Authorization'] = `Bearer ${settings.token}`
  }

  const { statusCode, body } = await httpsGet(url, headers)

  if (statusCode === 401) throw new Error('Unauthorized — check your GitHub token')
  if (statusCode === 403) throw new Error('Rate limited or forbidden by GitHub API')
  if (statusCode === 404) throw new Error('Repository not found')
  if (statusCode !== 200) throw new Error(`GitHub API returned status ${statusCode}`)

  const data = JSON.parse(body)
  const latestVersion = (data.tag_name as string).replace(/^v/, '')
  const releaseNotes: string = data.body ?? ''
  const publishedAt: string = data.published_at ?? ''

  const assets: Array<{ name: string; browser_download_url: string; size: number }> = data.assets ?? []
  const exeAsset = findPlatformAsset(assets)

  const downloadUrl = exeAsset?.browser_download_url ?? ''
  const fileSize = exeAsset?.size ?? 0

  const hasUpdate = compareVersions(latestVersion, currentVersion) > 0

  return {
    hasUpdate,
    currentVersion,
    latestVersion,
    releaseNotes,
    publishedAt,
    downloadUrl,
    fileSize,
  }
}

function findPlatformAsset(
  assets: Array<{ name: string; browser_download_url: string; size: number }>,
) {
  if (process.platform === 'win32') {
    // Only the portable build artifact is a valid update target. A release can
    // carry other .exe files (e.g. electron-builder's elevate.exe helper, or the
    // raw win-unpacked Preppy.exe), so match the artifact name explicitly and
    // never fall back to an elevate helper.
    const exes = assets.filter(
      a => a.name.toLowerCase().endsWith('.exe') && !a.name.toLowerCase().includes('elevate'),
    )
    return (
      exes.find(a => a.name === 'Preppy-portable.exe') ??
      exes.find(a => a.name.toLowerCase().includes('portable')) ??
      exes[0]
    )
  }
  if (process.platform === 'linux') {
    const arch = process.arch === 'arm64' ? 'arm64' : 'x64'
    return (
      assets.find(a => a.name.endsWith('.AppImage') && a.name.includes(arch)) ??
      assets.find(a => a.name.endsWith('.AppImage'))
    )
  }
  return undefined
}

export function getUpdateFilePath(): string {
  let dir: string
  if (app.isPackaged) {
    if (process.platform === 'linux' && process.env.APPIMAGE) {
      dir = path.dirname(process.env.APPIMAGE)
    } else if (process.platform === 'win32') {
      // For the portable target, process.execPath is the temp-extracted copy;
      // place the update next to the real .exe the user launched.
      dir = path.dirname(windowsTargetExe())
    } else {
      dir = path.dirname(process.execPath)
    }
  } else {
    dir = app.getPath('temp')
  }
  const name = process.platform === 'win32'
    ? 'Preppy-portable-update.exe'
    : 'Preppy-update.AppImage'
  return path.join(dir, name)
}

export function hasDownloadedUpdate(): boolean {
  return fs.existsSync(getUpdateFilePath())
}

export function downloadUpdate(
  url: string,
  token: string,
  onProgress: (downloaded: number, total: number) => void,
): Promise<string> {
  return new Promise((resolve, reject) => {
    const destPath = getUpdateFilePath()

    const headers: Record<string, string> = {
      'User-Agent': 'PrepyApp/updater',
    }

    const makeRequest = (reqUrl: string, reqHeaders: Record<string, string>, redirectCount: number) => {
      if (redirectCount > 10) {
        reject(new Error('Too many redirects'))
        return
      }

      const parsed = new URL(reqUrl)
      const mod = parsed.protocol === 'https:' ? https : http
      const options = {
        hostname: parsed.hostname,
        port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
        path: parsed.pathname + parsed.search,
        method: 'GET',
        headers: reqHeaders,
      }

      const req = (mod as typeof https).request(options, (res) => {
        const code = res.statusCode ?? 0

        if (code >= 300 && code < 400 && res.headers.location) {
          const nextHeaders: Record<string, string> = { 'User-Agent': 'PrepyApp/updater' }
          makeRequest(res.headers.location, nextHeaders, redirectCount + 1)
          return
        }

        if (code !== 200) {
          reject(new Error(`Download failed with status ${code}`))
          return
        }

        const total = parseInt(res.headers['content-length'] ?? '0', 10)
        let downloaded = 0
        const out = fs.createWriteStream(destPath)

        res.on('data', (chunk: Buffer) => {
          downloaded += chunk.length
          out.write(chunk)
          onProgress(downloaded, total)
        })

        res.on('end', () => {
          out.end()
          resolve(destPath)
        })

        res.on('error', (err: Error) => {
          out.destroy()
          reject(err)
        })
      })

      req.on('error', reject)
      req.end()
    }

    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }

    makeRequest(url, headers, 0)
  })
}

export function applyUpdate(): void {
  if (!app.isPackaged) throw new Error('applyUpdate is only available in packaged builds')
  if (process.platform === 'win32') return applyUpdateWindows()
  if (process.platform === 'linux')  return applyUpdateLinux()
  throw new Error(`Auto-update is not supported on ${process.platform}`)
}

// The portable target runs from a temp-extracted copy (process.execPath);
// PORTABLE_EXECUTABLE_FILE is the actual .exe the user double-clicked, which is
// what we must replace for the update to persist.
function windowsTargetExe(): string {
  return process.env.PORTABLE_EXECUTABLE_FILE || process.execPath
}

function applyUpdateWindows(): void {
  const currentExe = windowsTargetExe()
  const updateExe  = getUpdateFilePath()
  const psPath     = path.join(os.tmpdir(), '_preppy_update.ps1')
  const logPath    = path.join(os.tmpdir(), 'preppy-update.log')
  const q = (s: string) => s.replace(/'/g, "''")

  // PowerShell is more reliable than a .bat here: it waits for the running exe to
  // release its lock (the portable launcher takes a moment to exit), retries the
  // replace, logs each step to %TEMP%\preppy-update.log, then relaunches.
  const ps = `
$ErrorActionPreference = 'Continue'
$log = '${q(logPath)}'
$src = '${q(updateExe)}'
$dst = '${q(currentExe)}'
function Log($m) { "$(Get-Date -Format o)  $m" | Out-File -FilePath $log -Append -Encoding utf8 }
Log "update start  src=$src  dst=$dst"
if (-not (Test-Path -LiteralPath $src)) { Log "ERROR: downloaded update not found"; exit 1 }
$moved = $false
for ($i = 0; $i -lt 60; $i++) {
  try {
    Move-Item -LiteralPath $src -Destination $dst -Force -ErrorAction Stop
    $moved = $true
    Log "replaced target after $i retries"
    break
  } catch {
    Start-Sleep -Milliseconds 500
  }
}
if (-not $moved) { Log "ERROR: could not replace $dst (still locked after 30s)" }
try {
  Start-Process -FilePath $dst -WorkingDirectory (Split-Path -Parent $dst)
  Log "relaunched $dst"
} catch {
  Log "ERROR relaunching: $_"
}
Remove-Item -LiteralPath '${q(psPath)}' -Force -ErrorAction SilentlyContinue
`.trim()

  fs.writeFileSync(psPath, ps, 'utf-8')
  spawn('powershell.exe', [
    '-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', psPath,
  ], { detached: true, windowsHide: true, stdio: 'ignore' }).unref()
  app.quit()
}

function applyUpdateLinux(): void {
  const appImage = process.env.APPIMAGE
  if (!appImage) throw new Error('Not running as AppImage — cannot auto-update')

  const updatePath = getUpdateFilePath()
  const scriptPath = path.join(path.dirname(appImage), '_preppy_update.sh')
  const extraArgs  = process.argv.filter(a => a.startsWith('--')).join(' ')

  const script = [
    '#!/bin/bash',
    'sleep 2',
    `mv -f "${updatePath}" "${appImage}"`,
    `chmod +x "${appImage}"`,
    `"${appImage}"${extraArgs ? ' ' + extraArgs : ''} &`,
    'rm -f "$0"',
  ].join('\n')

  fs.writeFileSync(scriptPath, script, 'utf-8')
  fs.chmodSync(scriptPath, '755')
  spawn('/bin/bash', [scriptPath], { detached: true, stdio: 'ignore' }).unref()
  app.quit()
}
