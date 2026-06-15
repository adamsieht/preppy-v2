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
  ui: {
    kioskMode: boolean
  }
}

// Built-in defaults — mirror resources/config.json. Used as a safety net so the
// app keeps working (printer scan, printing, etc.) even if the bundled
// config.json is missing or corrupt, instead of hard-crashing on read.
const FALLBACK_CONFIG: AppConfig = {
  temperature: { dangerLow: 31, dangerHigh: 41, warningLow: 37, units: 'F' },
  printer: { device: '/dev/usb/lp0', zplTemplateDir: 'resources/zpl', simulate: false, labelhomeX: 0, labelhomeY: 0 },
  sensor: { pollIntervalMs: 10000, logDir: '/templogs' },
  wifi: { interface: 'wlan0', supplicantPath: '/etc/wpa_supplicant/wpa_supplicant.conf' },
  logging: { retentionDays: 30, maxFileSizeMb: 10 },
  ui: { kioskMode: true },
}

// Overrides may be nested (e.g. { printer: { simulate: true } }), which the
// implementation merges recursively — so the parameter is a deep partial.
type DeepPartial<T> = { [K in keyof T]?: T[K] extends object ? DeepPartial<T[K]> : T[K] }

export function deepMerge<T extends object>(base: T, overrides: DeepPartial<T>): T {
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

  // Packaged builds copy resources/ into <resourcesPath>/resources via
  // electron-builder's extraResources; dev reads straight from the repo.
  const defaultsPath = app.isPackaged
    ? path.join(process.resourcesPath, 'resources', 'config.json')
    : path.join(process.cwd(), 'resources', 'config.json')

  let defaults: AppConfig
  try {
    const parsed = JSON.parse(fs.readFileSync(defaultsPath, 'utf-8')) as Partial<AppConfig>
    // Merge over FALLBACK_CONFIG so newer keys (e.g. ui.kioskMode) are present
    // even if an older bundled config.json predates them.
    defaults = deepMerge(FALLBACK_CONFIG, parsed)
  } catch {
    defaults = FALLBACK_CONFIG
  }

  const localPath = path.join(app.getPath('userData'), 'config.local.json')
  if (fs.existsSync(localPath)) {
    try {
      const local: Partial<AppConfig> = JSON.parse(fs.readFileSync(localPath, 'utf-8'))
      _config = deepMerge(defaults, local)
    } catch {
      _config = defaults
    }
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

/** Persist the kiosk-mode preference to config.local.json and invalidate the cache. */
export function setKioskMode(enabled: boolean): void {
  const localPath = path.join(app.getPath('userData'), 'config.local.json')
  let local: Partial<AppConfig> = {}
  try { local = JSON.parse(fs.readFileSync(localPath, 'utf-8')) } catch { /* no local file yet */ }
  const updated = deepMerge(local as AppConfig, { ui: { kioskMode: enabled } } as Partial<AppConfig>)
  fs.writeFileSync(localPath, JSON.stringify(updated, null, 2), 'utf-8')
  _config = null
}
