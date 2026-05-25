import fs from 'fs'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { getConfig } from './config.service'
import { getWifi, upsertWifi } from './db.service'
import { logInfo, logWarn, logError } from '../logger'

const execFileAsync = promisify(execFile)

export const SSID_RE = /^[\w\s\-\.@]{1,64}$/
export const PASS_RE = /^[\x20-\x7E]{8,63}$/

export interface WifiResult {
  success: boolean
  error?: string
}

export interface WifiNetwork {
  ssid: string
  signal: number   // 0–100
  security: string // e.g. "WPA2", "WPA1 WPA2", "" for open
}

export async function scanNetworks(): Promise<WifiNetwork[]> {
  try {
    // Trigger a fresh scan first (best-effort, ignore errors)
    const config = getConfig()
    await execFileAsync('nmcli', ['device', 'wifi', 'rescan', 'ifname', config.wifi.interface]).catch(() => null)

    const { stdout } = await execFileAsync('nmcli', [
      '-t', '-f', 'SSID,SIGNAL,SECURITY',
      'device', 'wifi', 'list',
      'ifname', config.wifi.interface,
    ])

    const seen = new Set<string>()
    const networks: WifiNetwork[] = []

    for (const line of stdout.split('\n')) {
      if (!line.trim()) continue
      // nmcli -t escapes colons inside values as \:
      const parts = line.split(/(?<!\\):/)
      if (parts.length < 2) continue
      const ssid = parts[0].replace(/\\:/g, ':').trim()
      const signal = parseInt(parts[1], 10)
      const security = parts.slice(2).join(':').replace(/\\:/g, ':').trim()
      if (!ssid || isNaN(signal) || seen.has(ssid)) continue
      seen.add(ssid)
      networks.push({ ssid, signal, security })
    }

    networks.sort((a, b) => b.signal - a.signal)
    logInfo(`WiFi scan found ${networks.length} networks`)
    return networks
  } catch (err: unknown) {
    const code = (err as NodeJS.ErrnoException).code
    if (code === 'ENOENT') {
      logWarn('nmcli not found — WiFi scanning is only supported on Linux. Returning empty list.')
    } else {
      logError(`WiFi scan failed: ${String(err)}`)
    }
    return []
  }
}

export { getWifi }

export async function saveWifi(ssid: string, pass: string): Promise<WifiResult> {
  if (!SSID_RE.test(ssid)) {
    return { success: false, error: 'Invalid SSID: only alphanumeric, spaces, hyphens, dots, and @ are allowed.' }
  }
  if (!PASS_RE.test(pass)) {
    return { success: false, error: 'Invalid password: must be 8–63 printable ASCII characters.' }
  }

  const config = getConfig()
  const supplicantConf = `ctrl_interface=DIR=/var/run/wpa_supplicant GROUP=netdev
update_config=1
country=US

network={
\tssid="${ssid}"
\tpsk="${pass}"
\tkey_mgmt=WPA-PSK
}
`

  try {
    fs.writeFileSync(config.wifi.supplicantPath, supplicantConf, { mode: 0o600 })
    logWarn(`WiFi credentials updated for SSID: ${ssid} (password not logged)`)
  } catch (err) {
    const error = `Failed to write wpa_supplicant.conf: ${String(err)}`
    logError(error)
    return { success: false, error }
  }

  upsertWifi(ssid, pass)

  try {
    const { stdout } = await execFileAsync('wpa_cli', ['-i', config.wifi.interface, 'reconfigure'])
    logInfo(`wpa_cli reconfigure: ${stdout.trim()}`)
  } catch (err: unknown) {
    const code = (err as NodeJS.ErrnoException).code
    if (code === 'ENOENT') {
      logWarn('wpa_cli not found — credentials saved to DB but network not reconfigured (Linux only)')
    } else {
      const error = `wpa_cli reconfigure failed: ${String(err)}`
      logError(error)
      return { success: false, error }
    }
  }

  return { success: true }
}
