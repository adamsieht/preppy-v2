import { useEffect, useState, useCallback } from 'react'
import Keyboard from 'react-simple-keyboard'
import 'react-simple-keyboard/build/css/index.css'
import PageLayout from '../../components/PageLayout'
import AutoDismissAlert from '../../components/AutoDismissAlert'
import { useErrorMsg } from '../../hooks/useErrorMsg'

interface WifiNetwork { ssid: string; signal: number; security: string }

// ── Tailwind class map ──────────────────────────────────────────────────────
const classes = {
  alertWrapper:    'px-3 pt-3',
  fieldsWrapper:   'px-3 pt-3 flex flex-col gap-2',
  fieldBtn: (active: boolean) =>
    [
      'min-h-[64px] rounded-xl flex items-center px-4 gap-3 text-left cursor-pointer',
      active ? 'border-2 border-[#0d6efd] bg-[#e7f1ff]' : 'border border-[#ced4da] bg-[#f8f9fa]',
    ].join(' '),
  fieldLabel:      'min-w-[80px] text-[#6c757d] text-[0.9rem]',
  fieldValue: (hasValue: boolean) =>
    `flex-1 text-[1.1rem] ${hasValue ? 'font-semibold text-[#212529]' : 'font-normal text-[#adb5bd]'}`,
  fieldEditing:    'text-[0.8rem] text-[#0d6efd]',
  keyboardWrapper: 'px-1 py-2',
  networkSection:  'px-3 pt-3',
  networkHeader:   'flex justify-between items-center mb-2',
  networkLabel:    'font-semibold',
  scanBtn:         'min-h-[40px] px-[14px] border border-[#ced4da] rounded-lg bg-[#f8f9fa] text-[0.9rem] disabled:opacity-60',
  networkList:     'flex flex-col gap-[6px]',
  noNetworks:      'text-[#6c757d] text-[0.9rem]',
  networkBtn: (selected: boolean) =>
    [
      'min-h-[64px] rounded-xl flex items-center px-4 gap-[14px] cursor-pointer',
      selected ? 'border-2 border-[#0d6efd] bg-[#e7f1ff]' : 'border border-[#dee2e6] bg-white',
    ].join(' '),
  networkInfo:     'flex-1 text-left',
  networkSsid:     'font-semibold text-[1.05rem]',
  networkSec:      'text-[0.8rem] text-[#6c757d]',
  networkSignal:   'text-[0.85rem] text-[#adb5bd]',
  footer:          'flex gap-2 p-3',
  saveBtn: (canSave: boolean) =>
    [
      'flex-1 min-h-[64px] text-[1.2rem] font-bold text-white border-0 rounded-xl disabled:opacity-60',
      canSave ? 'bg-[#0d6efd]' : 'bg-[#6c757d]',
    ].join(' '),
  // SignalBars
  signalBars:      'inline-flex items-end gap-[2px] h-5',
  signalBar: (active: boolean) =>
    `inline-block w-[5px] rounded-[1px] ${active ? 'bg-[#198754]' : 'bg-[#dee2e6]'}`,
}
// ───────────────────────────────────────────────────────────────────────────

function SignalBars({ signal }: { signal: number }) {
  const bars = signal >= 75 ? 4 : signal >= 50 ? 3 : signal >= 25 ? 2 : 1
  return (
    <span className={classes.signalBars}>
      {[1, 2, 3, 4].map(b => (
        <span key={b} className={classes.signalBar(b <= bars)} style={{ height: b * 5 }} />
      ))}
    </span>
  )
}

export default function WiFi() {
  const [ssid, setSsid] = useState('')
  const [pass, setPass] = useState('')
  const [activeField, setActiveField] = useState<'ssid' | 'pass' | null>(null)
  const [status, setStatus] = useState<{ ok: boolean; msg: string } | null>(null)
  const [saving, setSaving] = useState(false)
  const [networks, setNetworks] = useState<WifiNetwork[]>([])
  const [scanning, setScanning] = useState(false)
  const errorMsg = useErrorMsg()
  const clearStatus = useCallback(() => setStatus(null), [])

  useEffect(() => {
    window.electronAPI.getWifi().then(creds => {
      if (creds) { setSsid(creds.ssid); setPass(creds.pass) }
    })
    scan()
  }, [])

  async function scan() {
    setScanning(true)
    try {
      const found = await window.electronAPI.scanWifi()
      setNetworks(found)
    } catch (err) {
      setStatus({ ok: false, msg: errorMsg(err, 'Scan failed') })
    } finally {
      setScanning(false)
    }
  }

  function selectNetwork(n: WifiNetwork) {
    setSsid(n.ssid)
    setActiveField('pass')
  }

  function onKeyPress(btn: string) {
    if (!activeField) return
    const setter = activeField === 'ssid' ? setSsid : setPass
    setter(prev => {
      if (btn === '{bksp}') return prev.slice(0, -1)
      if (btn === '{space}') return prev + ' '
      if (btn === '{enter}') { setActiveField(null); return prev }
      return prev + btn
    })
  }

  async function handleSave() {
    setSaving(true)
    setStatus(null)
    setActiveField(null)
    try {
      const result = await window.electronAPI.saveWifi({ ssid, pass })
      setStatus(result.success
        ? { ok: true, msg: 'WiFi saved and applied.' }
        : { ok: false, msg: result.error ?? 'Save failed' })
    } catch (err) {
      setStatus({ ok: false, msg: errorMsg(err, 'Save failed') })
    } finally {
      setSaving(false)
    }
  }

  const footer = activeField === null ? (
    <div className={classes.footer}>
      <button
        onClick={handleSave}
        disabled={saving || !ssid || !pass}
        className={classes.saveBtn(!!ssid && !!pass)}
      >
        {saving ? 'Saving…' : 'Save & Apply'}
      </button>
    </div>
  ) : null

  return (
    <PageLayout title="WiFi" back noPad footer={footer}>
      {status && (
        <div className={classes.alertWrapper}>
          <AutoDismissAlert variant={status.ok ? 'success' : 'danger'} msg={status.msg} onDismiss={clearStatus} />
        </div>
      )}

      {/* Credential fields */}
      <div className={classes.fieldsWrapper}>
        {[
          { id: 'ssid' as const, label: 'Network',  value: ssid },
          { id: 'pass' as const, label: 'Password', value: pass, password: true },
        ].map(({ id, label, value, password }) => (
          <button key={id} onClick={() => setActiveField(id)} className={classes.fieldBtn(activeField === id)}>
            <span className={classes.fieldLabel}>{label}</span>
            <span className={classes.fieldValue(!!value)}>
              {value ? (password ? '•'.repeat(value.length) : value) : `Tap to enter ${label.toLowerCase()}`}
            </span>
            {activeField === id && <span className={classes.fieldEditing}>editing</span>}
          </button>
        ))}
      </div>

      {/* Keyboard (only when a field is active) */}
      {activeField && (
        <div className={classes.keyboardWrapper}>
          <Keyboard
            onKeyPress={onKeyPress}
            layout={{
              default: [
                '` 1 2 3 4 5 6 7 8 9 0 - = {bksp}',
                'q w e r t y u i o p [ ] \\',
                "a s d f g h j k l ; '",
                'z x c v b n m , . /',
                '{space} {enter}',
              ],
              shift: [
                '~ ! @ # $ % ^ & * ( ) _ + {bksp}',
                'Q W E R T Y U I O P { } |',
                'A S D F G H J K L : "',
                'Z X C V B N M < > ?',
                '{space} {enter}',
              ],
            }}
            mergeDisplay
            display={{ '{bksp}': '⌫', '{space}': 'Space', '{enter}': 'Done ↵' }}
          />
        </div>
      )}

      {/* Network list (hidden while keyboard is open) */}
      {!activeField && (
        <div className={classes.networkSection}>
          <div className={classes.networkHeader}>
            <span className={classes.networkLabel}>Available Networks</span>
            <button onClick={scan} disabled={scanning} className={classes.scanBtn}>
              {scanning ? 'Scanning…' : '⟳ Scan'}
            </button>
          </div>
          <div className={classes.networkList}>
            {networks.length === 0 && !scanning && (
              <p className={classes.noNetworks}>No networks found.</p>
            )}
            {networks.map(n => (
              <button key={n.ssid} onClick={() => selectNetwork(n)} className={classes.networkBtn(ssid === n.ssid)}>
                <SignalBars signal={n.signal} />
                <div className={classes.networkInfo}>
                  <div className={classes.networkSsid}>{n.ssid}</div>
                  <div className={classes.networkSec}>{n.security || 'Open'}</div>
                </div>
                <span className={classes.networkSignal}>{n.signal}%</span>
                {n.security && <span>🔒</span>}
              </button>
            ))}
          </div>
        </div>
      )}
    </PageLayout>
  )
}
