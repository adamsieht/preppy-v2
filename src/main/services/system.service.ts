import { exec } from 'child_process'
import { promisify } from 'util'
import { shell } from 'electron'
import dayjs from 'dayjs'

const execAsync = promisify(exec)

export async function setSystemTime(iso: string): Promise<{ success: boolean; error?: string }> {
  const dt = dayjs(iso)
  if (!dt.isValid()) return { success: false, error: 'Invalid date/time value' }

  const formatted = dt.format('YYYY-MM-DD HH:mm:ss')

  try {
    if (process.platform === 'win32') {
      // Requires the process to be running as Administrator
      await execAsync(
        `PowerShell -NonInteractive -NoProfile -Command "Set-Date -Date ([datetime]::Parse('${formatted}'))"`,
        { timeout: 8000 },
      )
    } else {
      // Linux / Raspberry Pi OS — prefer systemd timedatectl, fall back to date -s
      try {
        await execAsync('timedatectl set-ntp false', { timeout: 5000 })
        await execAsync(`timedatectl set-time "${formatted}"`, { timeout: 5000 })
      } catch {
        // Fallback: POSIX date command (requires root)
        await execAsync(`date -s "${formatted}"`, { timeout: 5000 })
      }
    }
    return { success: true }
  } catch (err: unknown) {
    const e = err as { stderr?: string; message?: string }
    const msg = (e?.stderr || e?.message || String(err)).trim()
    return { success: false, error: msg }
  }
}

export async function openSystemTimeSettings(): Promise<{ success: boolean; error?: string }> {
  try {
    if (process.platform === 'win32') {
      await shell.openExternal('ms-settings:dateandtime')
      return { success: true }
    }

    // Linux — try common GUI datetime tools
    const guiCandidates = [
      'gnome-control-center datetime',
      'kcmshell5 clock',
      'xfce4-settings-manager',
    ]
    for (const cmd of guiCandidates) {
      const bin = cmd.split(' ')[0]
      try {
        await execAsync(`which ${bin}`, { timeout: 2000 })
        exec(cmd) // fire-and-forget, detached from promise
        return { success: true }
      } catch {
        // binary not found, try next
      }
    }
    return { success: false, error: 'No system time GUI found on this system' }
  } catch (err) {
    return { success: false, error: String(err) }
  }
}

export async function enableNtp(): Promise<{ success: boolean; error?: string }> {
  try {
    if (process.platform === 'win32') {
      await execAsync('w32tm /config /manualpeerlist:"pool.ntp.org" /syncfromflags:MANUAL /reliable:YES /update', { timeout: 8000 })
      await execAsync('net start w32time', { timeout: 8000 }).catch(() => {}) // already running is OK
      await execAsync('w32tm /resync /force', { timeout: 8000 })
    } else {
      await execAsync('timedatectl set-ntp true', { timeout: 5000 })
    }
    return { success: true }
  } catch (err: unknown) {
    const e = err as { stderr?: string; message?: string }
    const msg = (e?.stderr || e?.message || String(err)).trim()
    return { success: false, error: msg }
  }
}
