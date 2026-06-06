import fs from 'fs'
import path from 'path'
import { app } from 'electron'

export interface AppConfig {
  temperature: {
    dangerLow: number
    dangerHigh: number
    warningLow: number
    units: 'F' | 'C'
  }
  printer: {
    device: string
    zplTemplateDir: string
    simulate: boolean
    labelhomeX: number
    labelhomeY: number
  }
  sensor: {
    pollIntervalMs: number
    logDir: string
  }
  wifi: {
    interface: string
    supplicantPath: string
  }
  logging: {
    retentionDays: number
    maxFileSizeMb: number
  }
}

export function deepMerge<T extends object>(base: T, overrides: Partial<T>): T {
  const result = { ...base }
  for (const key of Object.keys(overrides) as (keyof T)[]) {
    const baseVal = base[key]
    const overrideVal = overrides[key]
    if (
      overrideVal !== null &&
      typeof overrideVal === 'object' &&
      !Array.isArray(overrideVal) &&
      typeof baseVal === 'object' &&
      baseVal !== null
    ) {
      result[key] = deepMerge(baseVal as object, overrideVal as object) as T[keyof T]
    } else if (overrideVal !== undefined) {
      result[key] = overrideVal as T[keyof T]
    }
  }
  return result
}

let _config: AppConfig | null = null

/** Resolves a path that is relative to the app's resources directory. */
export function resourcePath(...segments: string[]): string {
  const base = app.isPackaged ? process.resourcesPath : process.cwd()
  return path.join(base, ...segments)
}

export function getConfig(): AppConfig {
  if (_config) return _config

  const defaultsPath = app.isPackaged
    ? path.join(process.resourcesPath, 'config.json')
    : path.join(process.cwd(), 'resources', 'config.json')
  const defaults: AppConfig = JSON.parse(fs.readFileSync(defaultsPath, 'utf-8'))

  const localPath = path.join(app.getPath('userData'), 'config.local.json')
  if (fs.existsSync(localPath)) {
    const local: Partial<AppConfig> = JSON.parse(fs.readFileSync(localPath, 'utf-8'))
    _config = deepMerge(defaults, local)
  } else {
    _config = defaults
  }

  return _config
}

/** Persist label home offsets (^LH x,y) to config.local.json and invalidate the cache. */
export function setLabelHome(x: number, y: number): void {
  const localPath = path.join(app.getPath('userData'), 'config.local.json')
  let local: Partial<AppConfig> = {}
  try { local = JSON.parse(fs.readFileSync(localPath, 'utf-8')) } catch { /* no local file yet */ }
  const updated = deepMerge(local as AppConfig, { printer: { labelhomeX: x, labelhomeY: y } } as Partial<AppConfig>)
  fs.writeFileSync(localPath, JSON.stringify(updated, null, 2), 'utf-8')
  _config = null
}

/** Persist a new printer device path to config.local.json and invalidate the cache. */
export function setPrinterDevice(device: string): void {
  const localPath = path.join(app.getPath('userData'), 'config.local.json')
  let local: Partial<AppConfig> = {}
  try { local = JSON.parse(fs.readFileSync(localPath, 'utf-8')) } catch { /* no local file yet */ }
  const updated = deepMerge(local as AppConfig, { printer: { device } } as Partial<AppConfig>)
  fs.writeFileSync(localPath, JSON.stringify(updated, null, 2), 'utf-8')
  _config = null   // force re-read on next getConfig()
}
