import { useEffect, useState } from 'react'
import Keyboard from 'react-simple-keyboard'
import 'react-simple-keyboard/build/css/index.css'
import PageLayout from '../../components/PageLayout'
import AutoDismissAlert from '../../components/AutoDismissAlert'
import { useErrorMsg } from '../../hooks/useErrorMsg'
import { useCallback } from 'react'

interface WifiNetwork { ssid: string; signal: number; security: string }

function SignalBars({ signal }: { signal: number }) {
  const bars = signal >= 75 ? 4 : signal >= 50 ? 3 : signal >= 25 ? 2 : 1
  return (
    <span style={{ display: 'inline-flex', alignItems: 'flex-end', gap: 2, height: 20 }}>
      {[1, 2, 3, 4].map(b => (
        <span key={b} style={{ display: 'inline-block', width: 5, height: b * 5, borderRadius: 1, background: b <= bars ? '#198754' : '#dee2e6' }} />
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
    <div style={{ display: 'flex', gap: 8, padding: 12 }}>
      <button
        onClick={handleSave}
        disabled={saving || !ssid || !pass}
        style={{
          flex: 1, minHeight: 64, fontSize: '1.2rem', fontWeight: 700,
          background: (!ssid || !pass) ? '#6c757d' : '#0d6efd',
          color: '#fff', border: 'none', borderRadius: 10,
          opacity: (saving || !ssid || !pass) ? 0.6 : 1,
        }}
      >
        {saving ? 'Saving…' : 'Save & Apply'}
      </button>
    </div>
  ) : null

  return (
    <PageLayout title="WiFi" back noPad footer={footer}>
      {status && (
        <div style={{ padding: '12px 12px 0' }}>
          <AutoDismissAlert variant={status.ok ? 'success' : 'danger'} msg={status.msg} onDismiss={clearStatus} />
        </div>
      )}

      {/* Credential fields */}
      <div style={{ padding: '12px 12px 0', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {[
          { id: 'ssid' as const, label: 'Network', value: ssid },
          { id: 'pass' as const, label: 'Password', value: pass, password: true },
        ].map(({ id, label, value, password }) => (
          <button
            key={id}
            onClick={() => setActiveField(id)}
            style={{
              minHeight: 64, border: activeField === id ? '2px solid #0d6efd' : '1px solid #ced4da',
              borderRadius: 10, background: activeField === id ? '#e7f1ff' : '#f8f9fa',
              display: 'flex', alignItems: 'center', padding: '0 16px', gap: 12,
              textAlign: 'left', cursor: 'pointer',
            }}
          >
            <span style={{ minWidth: 80, color: '#6c757d', fontSize: '0.9rem' }}>{label}</span>
            <span style={{ flex: 1, fontSize: '1.1rem', fontWeight: value ? 600 : 400, color: value ? '#212529' : '#adb5bd' }}>
              {value ? (password ? '•'.repeat(value.length) : value) : `Tap to enter ${label.toLowerCase()}`}
            </span>
            {activeField === id && (
              <span style={{ fontSize: '0.8rem', color: '#0d6efd' }}>editing</span>
            )}
          </button>
        ))}
      </div>

      {/* Keyboard (only when a field is active) */}
      {activeField && (
        <div style={{ padding: '8px 4px' }}>
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
        <div style={{ padding: '12px 12px 0' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontWeight: 600 }}>Available Networks</span>
            <button
              onClick={scan}
              disabled={scanning}
              style={{ minHeight: 40, padding: '0 14px', border: '1px solid #ced4da', borderRadius: 8, background: '#f8f9fa', fontSize: '0.9rem' }}
            >
              {scanning ? 'Scanning…' : '⟳ Scan'}
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {networks.length === 0 && !scanning && (
              <p style={{ color: '#6c757d', fontSize: '0.9rem' }}>No networks found.</p>
            )}
            {networks.map(n => (
              <button
                key={n.ssid}
                onClick={() => selectNetwork(n)}
                style={{
                  minHeight: 64, border: ssid === n.ssid ? '2px solid #0d6efd' : '1px solid #dee2e6',
                  borderRadius: 10, background: ssid === n.ssid ? '#e7f1ff' : '#fff',
                  display: 'flex', alignItems: 'center', padding: '0 16px', gap: 14, cursor: 'pointer',
                }}
              >
                <SignalBars signal={n.signal} />
                <div style={{ flex: 1, textAlign: 'left' }}>
                  <div style={{ fontWeight: 600, fontSize: '1.05rem' }}>{n.ssid}</div>
                  <div style={{ fontSize: '0.8rem', color: '#6c757d' }}>{n.security || 'Open'}</div>
                </div>
                <span style={{ fontSize: '0.85rem', color: '#adb5bd' }}>{n.signal}%</span>
                {n.security && <span>🔒</span>}
              </button>
            ))}
          </div>
        </div>
      )}
    </PageLayout>
  )
}
