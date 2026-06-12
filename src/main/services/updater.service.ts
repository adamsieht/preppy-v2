import https from 'https'
import http from 'http'
import fs from 'fs'
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
  const exeAsset = assets.find(a => a.name.endsWith('.exe'))

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

export function getUpdateFilePath(): string {
  const dir = app.isPackaged ? path.dirname(process.execPath) : app.getPath('temp')
  return path.join(dir, 'Preppy-portable-update.exe')
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
  if (!app.isPackaged) {
    throw new Error('applyUpdate is only available in packaged builds')
  }

  const currentExe = process.execPath
  const updateExe = getUpdateFilePath()
  const batchPath = path.join(path.dirname(currentExe), '_preppy_update.bat')

  const batch = [
    '@echo off',
    'timeout /t 2 /nobreak >nul',
    `move /y "${updateExe}" "${currentExe}"`,
    `start "" "${currentExe}"`,
    'del /f "%~f0"',
  ].join('\r\n')

  fs.writeFileSync(batchPath, batch, 'utf-8')

  spawn('cmd.exe', ['/c', batchPath], {
    detached: true,
    windowsHide: true,
    stdio: 'ignore',
  }).unref()

  app.quit()
}
