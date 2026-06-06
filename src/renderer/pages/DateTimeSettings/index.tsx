import { useState, useEffect, useRef } from 'react'
import PageLayout from '../../components/PageLayout'

// ── Tailwind class map ──────────────────────────────────────────────────────
const c = {
  section:      'mb-5',
  card:         'bg-[#161b22] border border-[#30363d] rounded-xl p-4',
  title:        'text-[#adbac7] text-sm font-bold mb-[3px]',
  desc:         'text-[#6e7681] text-xs mb-4 leading-relaxed',

  // Live clock
  clockWrap:    'flex flex-col items-center py-4',
  clockTime:    'text-white text-5xl font-bold font-mono tracking-tight tabular-nums',
  clockDate:    'text-[#6e7681] text-sm mt-2',

  // Fields
  fieldRow:     'flex gap-3 mb-3',
  fieldWrap:    'flex flex-col flex-1',
  fieldLabel:   'text-[#6e7681] text-[10px] font-semibold uppercase tracking-widest mb-1',
  fieldInput:   'w-full bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-[9px] text-white text-sm outline-none focus:border-[#28a745] cursor-pointer',

  // Buttons
  actionRow:    'flex gap-2 mt-1',
  primaryBtn:   'px-5 py-2 rounded-lg bg-[#28a745] border-0 text-white text-sm font-bold cursor-pointer hover:bg-[#2ea043] transition-colors disabled:opacity-50 disabled:cursor-not-allowed',
  secondaryBtn: 'px-4 py-2 rounded-lg bg-transparent border border-[#30363d] text-[#adbac7] text-sm font-bold cursor-pointer hover:border-[#6e7681] hover:text-white transition-colors',
  openBtn:      'w-full py-3 rounded-lg bg-[#1f6feb] border-0 text-white text-sm font-bold cursor-pointer hover:bg-[#388bfd] transition-colors disabled:opacity-50',
  ntpBtn:       'px-4 py-2 rounded-lg bg-transparent border border-[#30363d] text-[#6e7681] text-sm font-bold cursor-pointer hover:border-[#6e7681] hover:text-white transition-colors',

  // Feedback
  feedbackOk:   'flex items-center gap-1 text-xs text-[#3fb950] mt-2',
  feedbackErr:  'flex items-center gap-2 text-xs text-[#f85149] mt-2',

  // Info note
  infoNote:     'text-[#6e7681] text-xs leading-relaxed bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2 mt-3',
}
// ───────────────────────────────────────────────────────────────────────────

function padZ(n: number, len = 2) {
  return String(n).padStart(len, '0')
}

function fmtLocalDate(d: Date) {
  return `${d.getFullYear()}-${padZ(d.getMonth() + 1)}-${padZ(d.getDate())}`
}
function fmtLocalTime(d: Date) {
  return `${padZ(d.getHours())}:${padZ(d.getMinutes())}:${padZ(d.getSeconds())}`
}
function fmtClockDate(d: Date) {
  return d.toLocaleDateString(undefined, { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })
}

export default function DateTimeSettings() {
  const platform   = window.electronAPI.getPlatform()
  const isWindows  = platform === 'win32'
  const isLinux    = platform === 'linux'

  const [now,     setNow]     = useState(new Date())
  const [date,    setDate]    = useState(() => fmtLocalDate(new Date()))
  const [time,    setTime]    = useState(() => fmtLocalTime(new Date()))
  const [busy,    setBusy]    = useState(false)
  const [ntpBusy, setNtpBusy] = useState(false)
  const [fb,      setFb]      = useState<{ ok: boolean; msg: string } | null>(null)
  const [ntpFb,   setNtpFb]   = useState<{ ok: boolean; msg: string } | null>(null)
  const [openFb,  setOpenFb]  = useState<{ ok: boolean; msg: string } | null>(null)

  // Tick the live clock
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(t)
  }, [])

  // Keep the inputs in sync with real time as long as the user hasn't changed them
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
      const iso = `${date}T${time}`
      const result = await window.electronAPI.setSystemTime(iso)
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
    if (!result.success) {
      setOpenFb({ ok: false, msg: result.error ?? 'Could not open time settings.' })
    }
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
    <PageLayout title="Date & Time" back="/debug">

      {/* ── Live clock ── */}
      <div className={c.section}>
        <div className={c.card}>
          <div className={c.clockWrap}>
            <div className={c.clockTime}>
              {padZ(now.getHours())}:{padZ(now.getMinutes())}:{padZ(now.getSeconds())}
            </div>
            <div className={c.clockDate}>{fmtClockDate(now)}</div>
          </div>
        </div>
      </div>

      {/* ── Windows: open OS time settings ── */}
      {isWindows && (
        <div className={c.section}>
          <div className={c.card}>
            <div className={c.title}>Windows Date & Time Settings</div>
            <div className={c.desc}>
              Open the Windows Settings panel to change the system time and timezone.
              Administrator privileges are required.
            </div>
            <button className={c.openBtn} onClick={() => void handleOpenSettings()}>
              Open Windows Date &amp; Time Settings
            </button>
            {openFb && (
              <div className={openFb.ok ? c.feedbackOk : c.feedbackErr}>
                <span>{openFb.ok ? '✓' : '✗'}</span><span>{openFb.msg}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Linux: try system GUI ── */}
      {isLinux && (
        <div className={c.section}>
          <div className={c.card}>
            <div className={c.title}>System Time Settings</div>
            <div className={c.desc}>
              Attempt to open a system GUI for date/time (GNOME, KDE, XFCE).
              On minimal or headless installs this may not be available — use the manual setter below instead.
            </div>
            <button className={c.openBtn} onClick={() => void handleOpenSettings()}>
              Open System Time Settings
            </button>
            {openFb && (
              <div className={openFb.ok ? c.feedbackOk : c.feedbackErr}>
                <span>{openFb.ok ? '✓' : '✗'}</span><span>{openFb.msg}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Manual time setter ── */}
      <div className={c.section}>
        <div className={c.card}>
          <div className={c.title}>Set Time Manually</div>
          <div className={c.desc}>
            {isLinux
              ? 'Executed via timedatectl (falls back to date -s). Requires root or sudo access.'
              : isWindows
                ? 'Executed via PowerShell Set-Date. Requires Administrator privileges.'
                : 'Set the system clock directly from this screen.'}
          </div>

          <div className={c.fieldRow}>
            <div className={c.fieldWrap}>
              <div className={c.fieldLabel}>Date</div>
              <input
                type="date"
                value={date}
                onChange={e => { userEdited.current = true; setDate(e.target.value); setFb(null) }}
                className={c.fieldInput}
              />
            </div>
            <div className={c.fieldWrap}>
              <div className={c.fieldLabel}>Time</div>
              <input
                type="time"
                step="1"
                value={time}
                onChange={e => { userEdited.current = true; setTime(e.target.value); setFb(null) }}
                className={c.fieldInput}
              />
            </div>
          </div>

          <div className={c.actionRow}>
            <button className={c.primaryBtn} onClick={() => void handleApply()} disabled={busy || !date || !time}>
              {busy ? 'Applying…' : 'Apply'}
            </button>
            <button className={c.secondaryBtn} onClick={syncToNow}>
              Sync to Now
            </button>
          </div>

          {fb && (
            <div className={fb.ok ? c.feedbackOk : c.feedbackErr}>
              <span>{fb.ok ? '✓' : '✗'}</span>
              <span>{fb.msg}</span>
            </div>
          )}

          {isLinux && (
            <div className={c.infoNote}>
              Setting time manually disables NTP synchronisation (timedatectl set-ntp false).
              If this device reconnects to a time server, use the button below to re-enable it.
            </div>
          )}
        </div>
      </div>

      {/* ── Re-enable NTP (Linux only) ── */}
      {isLinux && (
        <div className={c.section}>
          <div className={c.card}>
            <div className={c.title}>Network Time (NTP)</div>
            <div className={c.desc}>
              Re-enable automatic time synchronisation via timedatectl. Only useful once a network
              connection with NTP access is available.
            </div>
            <button className={c.ntpBtn} onClick={() => void handleEnableNtp()} disabled={ntpBusy}>
              {ntpBusy ? 'Enabling…' : 'Re-enable NTP Sync'}
            </button>
            {ntpFb && (
              <div className={ntpFb.ok ? c.feedbackOk : c.feedbackErr}>
                <span>{ntpFb.ok ? '✓' : '✗'}</span><span>{ntpFb.msg}</span>
              </div>
            )}
          </div>
        </div>
      )}

    </PageLayout>
  )
}
