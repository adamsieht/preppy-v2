import { useState, useEffect, useRef } from 'react'
import SettingsCard from '../../../components/settings/SettingsCard'
import Feedback, { type FeedbackMsg } from '../../../components/settings/Feedback'
import { ui } from '../../../components/settings/styles'

const classes = {
  clockWrap: 'flex flex-col items-center py-4',
  clockTime: 'text-white text-5xl font-bold font-mono tracking-tight tabular-nums',
  clockDate: 'text-[#6e7681] text-sm mt-2',
  fieldRow:  'flex gap-3',
  fieldWrap: 'flex flex-col flex-1',
}

function padZ(n: number, len = 2) { return String(n).padStart(len, '0') }
function fmtLocalDate(d: Date) { return `${d.getFullYear()}-${padZ(d.getMonth() + 1)}-${padZ(d.getDate())}` }
function fmtLocalTime(d: Date) { return `${padZ(d.getHours())}:${padZ(d.getMinutes())}:${padZ(d.getSeconds())}` }
function fmtClockDate(d: Date) {
  return d.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
}

export default function DateTimeTab() {
  const platform  = window.electronAPI.getPlatform()
  const isWindows = platform === 'win32'
  const isLinux   = platform === 'linux'

  const [now,     setNow]     = useState(new Date())
  const [date,    setDate]    = useState(() => fmtLocalDate(new Date()))
  const [time,    setTime]    = useState(() => fmtLocalTime(new Date()))
  const [busy,    setBusy]    = useState(false)
  const [ntpBusy, setNtpBusy] = useState(false)
  const [fb,      setFb]      = useState<FeedbackMsg | null>(null)
  const [ntpFb,   setNtpFb]   = useState<FeedbackMsg | null>(null)
  const [openFb,  setOpenFb]  = useState<FeedbackMsg | null>(null)

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  const userEdited = useRef(false)
  useEffect(() => {
    if (userEdited.current) return
    setDate(fmtLocalDate(new Date()))
    setTime(fmtLocalTime(new Date()))
  })

  function syncToNow() {
    userEdited.current = false
    const n = new Date()
    setDate(fmtLocalDate(n))
    setTime(fmtLocalTime(n))
    setFb(null)
  }

  async function handleApply() {
    setBusy(true)
    setFb(null)
    try {
      const result = await window.electronAPI.setSystemTime(`${date}T${time}`)
      setFb(result.success
        ? { ok: true,  msg: 'System time updated.' + (isLinux ? ' NTP sync has been disabled.' : '') }
        : { ok: false, msg: result.error ?? 'Failed to set time.' })
      if (result.success) userEdited.current = false
    } catch (err) {
      setFb({ ok: false, msg: String(err) })
    } finally {
      setBusy(false)
    }
  }

  async function handleOpenSettings() {
    setOpenFb(null)
    const result = await window.electronAPI.openSystemTimeSettings()
    if (!result.success) setOpenFb({ ok: false, msg: result.error ?? 'Could not open time settings.' })
  }

  async function handleEnableNtp() {
    setNtpBusy(true)
    setNtpFb(null)
    try {
      const result = await window.electronAPI.enableNtp()
      setNtpFb(result.success
        ? { ok: true,  msg: 'NTP sync re-enabled. Time will synchronise shortly.' }
        : { ok: false, msg: result.error ?? 'Failed to enable NTP.' })
    } catch (err) {
      setNtpFb({ ok: false, msg: String(err) })
    } finally {
      setNtpBusy(false)
    }
  }

  return (
    <div className="flex flex-col gap-5 max-w-2xl">

      {/* ── Live clock ── */}
      <SettingsCard>
        <div className={classes.clockWrap}>
          <div className={classes.clockTime}>
            {padZ(now.getHours())}:{padZ(now.getMinutes())}:{padZ(now.getSeconds())}
          </div>
          <div className={classes.clockDate}>{fmtClockDate(now)}</div>
        </div>
      </SettingsCard>

      {/* ── Open OS time settings ── */}
      {(isWindows || isLinux) && (
        <SettingsCard
          title={isWindows ? 'Windows Date & Time Settings' : 'System Time Settings'}
          desc={isWindows
            ? 'Open the Windows Settings panel to change the system time and timezone. Administrator privileges are required.'
            : 'Attempt to open a system GUI for date/time (GNOME, KDE, XFCE). On minimal or headless installs this may not be available — use the manual setter below instead.'}
        >
          <button className={`w-full ${ui.blueBtn}`} onClick={() => void handleOpenSettings()}>
            {isWindows ? 'Open Windows Date & Time Settings' : 'Open System Time Settings'}
          </button>
          <Feedback fb={openFb} />
        </SettingsCard>
      )}

      {/* ── Manual time setter ── */}
      <SettingsCard
        title="Set Time Manually"
        desc={isLinux
          ? 'Executed via timedatectl (falls back to date -s). Requires root or sudo access.'
          : isWindows
            ? 'Executed via PowerShell Set-Date. Requires Administrator privileges.'
            : 'Set the system clock directly from this screen.'}
      >
        <div className={classes.fieldRow}>
          <div className={classes.fieldWrap}>
            <div className={ui.fieldLabel}>Date</div>
            <input
              type="date"
              value={date}
              onChange={e => { userEdited.current = true; setDate(e.target.value); setFb(null) }}
              className={`${ui.input} cursor-pointer`}
            />
          </div>
          <div className={classes.fieldWrap}>
            <div className={ui.fieldLabel}>Time</div>
            <input
              type="time"
              step="1"
              value={time}
              onChange={e => { userEdited.current = true; setTime(e.target.value); setFb(null) }}
              className={`${ui.input} cursor-pointer`}
            />
          </div>
        </div>

        <div className={ui.actionRow}>
          <button className={ui.primaryBtn} onClick={() => void handleApply()} disabled={busy || !date || !time}>
            {busy ? 'Applying…' : 'Apply'}
          </button>
          <button className={ui.secondaryBtn} onClick={syncToNow}>Sync to Now</button>
        </div>

        <Feedback fb={fb} />

        {isLinux && (
          <div className={ui.note}>
            Setting time manually disables NTP synchronisation (timedatectl set-ntp false).
            If this device reconnects to a time server, use the button below to re-enable it.
          </div>
        )}
      </SettingsCard>

      {/* ── Re-enable NTP (Linux only) ── */}
      {isLinux && (
        <SettingsCard
          title="Network Time (NTP)"
          desc="Re-enable automatic time synchronisation via timedatectl. Only useful once a network connection with NTP access is available."
        >
          <button className={`self-start ${ui.secondaryBtn}`} onClick={() => void handleEnableNtp()} disabled={ntpBusy}>
            {ntpBusy ? 'Enabling…' : 'Re-enable NTP Sync'}
          </button>
          <Feedback fb={ntpFb} />
        </SettingsCard>
      )}

    </div>
  )
}
