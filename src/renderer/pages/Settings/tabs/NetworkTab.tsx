import { useEffect, useState, useCallback } from 'react'
import Keyboard from 'react-simple-keyboard'
import 'react-simple-keyboard/build/css/index.css'
import SettingsCard from '../../../components/settings/SettingsCard'
import { ui } from '../../../components/settings/styles'
import { useErrorMsg } from '../../../hooks/useErrorMsg'

interface WifiNetwork { ssid: string; signal: number; security: string }

const c = {
  fieldBtn: (active: boolean) =>
    `min-h-[60px] rounded-xl flex items-center px-4 gap-3 text-left cursor-pointer transition-colors ${
      active ? 'border-2 border-[#28a745] bg-[#0d2818]' : 'border border-[#30363d] bg-[#0d1117] hover:border-[#6e7681]'
    }`,
  fieldLabel: 'min-w-[80px] text-[#6e7681] text-sm',
  fieldValue: (hasValue: boolean) => `flex-1 text-base ${hasValue ? 'font-semibold text-white' : 'font-normal text-[#484f58]'}`,
  networkBtn: (selected: boolean) =>
    `min-h-[60px] rounded-xl flex items-center px-4 gap-[14px] cursor-pointer transition-colors ${
      selected ? 'border-2 border-[#28a745] bg-[#0d2818]' : 'border border-[#30363d] bg-[#0d1117] hover:border-[#6e7681]'
    }`,
  signalBars: 'inline-flex items-end gap-[2px] h-5',
  signalBar: (active: boolean) => `inline-block w-[5px] rounded-[1px] ${active ? 'bg-[#3fb950]' : 'bg-[#30363d]'}`,
  status: (ok: boolean) =>
    `flex items-center gap-2 text-sm rounded-lg px-4 py-3 border ${ok ? 'bg-[#0d2818] border-[#238636] text-[#3fb950]' : 'bg-[#3d1a1a] border-[#f85149] text-[#f85149]'}`,
}

function SignalBars({ signal }: { signal: number }) {
  const bars = signal >= 75 ? 4 : signal >= 50 ? 3 : signal >= 25 ? 2 : 1
  return (
    <span className={c.signalBars}>
      {[1, 2, 3, 4].map(b => (
        <span key={b} className={c.signalBar(b <= bars)} style={{ height: b * 5 }} />
      ))}
    </span>
  )
}

export default function NetworkTab() {
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

  return (
    <div className="flex flex-col gap-5 max-w-2xl">

      {status && (
        <div className={c.status(status.ok)}>
          <span className="flex-1">{status.ok ? '✓ ' : '✗ '}{status.msg}</span>
          <button onClick={clearStatus} className="shrink-0 font-bold text-lg leading-none opacity-75">×</button>
        </div>
      )}

      {/* ── Credentials ── */}
      <SettingsCard
        title="WiFi Credentials"
        desc="Tap a field to type with the on-screen keyboard, or pick a detected network below."
      >
        <div className="flex flex-col gap-2">
          {[
            { id: 'ssid' as const, label: 'Network',  value: ssid },
            { id: 'pass' as const, label: 'Password', value: pass, password: true },
          ].map(({ id, label, value, password }) => (
            <button key={id} onClick={() => setActiveField(id)} className={c.fieldBtn(activeField === id)}>
              <span className={c.fieldLabel}>{label}</span>
              <span className={c.fieldValue(!!value)}>
                {value ? (password ? '•'.repeat(value.length) : value) : `Tap to enter ${label.toLowerCase()}`}
              </span>
              {activeField === id && <span className="text-xs text-[#3fb950]">editing</span>}
            </button>
          ))}
        </div>

        {activeField && (
          <div className="settings-keyboard pt-2">
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

        <button
          onClick={handleSave}
          disabled={saving || !ssid || !pass}
          className={`mt-1 ${ui.primaryBtn}`}
        >
          {saving ? 'Saving…' : 'Save & Apply'}
        </button>
      </SettingsCard>

      {/* ── Networks ── */}
      <SettingsCard
        title="Available Networks"
        right={
          <button onClick={scan} disabled={scanning} className={ui.neutralBtn}>
            {scanning ? 'Scanning…' : '⟳ Scan'}
          </button>
        }
      >
        <div className="flex flex-col gap-[6px]">
          {networks.length === 0 && !scanning && (
            <p className="text-[#6e7681] text-sm">No networks found.</p>
          )}
          {networks.map(n => (
            <button key={n.ssid} onClick={() => selectNetwork(n)} className={c.networkBtn(ssid === n.ssid)}>
              <SignalBars signal={n.signal} />
              <div className="flex-1 text-left">
                <div className="font-semibold text-white text-[1.05rem]">{n.ssid}</div>
                <div className="text-xs text-[#6e7681]">{n.security || 'Open'}</div>
              </div>
              <span className="text-sm text-[#6e7681]">{n.signal}%</span>
              {n.security && <span>🔒</span>}
            </button>
          ))}
        </div>
      </SettingsCard>

    </div>
  )
}
