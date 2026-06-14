import { useState, useEffect } from 'react'
import SettingsCard from '../../../components/settings/SettingsCard'
import { ui } from '../../../components/settings/styles'

interface UsbPrinterDevice {
  path: string
  displayName: string
  manufacturer: string
  model: string
  vendorId: string
  productId: string
  connection: 'usb' | 'bluetooth' | 'network'
  isZebra: boolean
  writable: boolean
  isCurrent: boolean
}

interface FeedbackState { path: string; ok: boolean; msg: string }

const TEST_PRINT_KEY    = 'preppy_test_printed'
const CHECKLIST_DISMISS = 'preppy_setup_dismissed'

const c = {
  pill: (ok: boolean) =>
    `inline-flex items-center gap-1 px-2 py-[3px] rounded-full text-xs font-semibold ${ok ? 'bg-[#1a4731] text-[#3fb950]' : 'bg-[#3d1a1a] text-[#f85149]'}`,
  dot: (ok: boolean) => `w-[7px] h-[7px] rounded-full ${ok ? 'bg-[#3fb950]' : 'bg-[#f85149]'}`,
  deviceCard: (current: boolean) =>
    `bg-[#0d1117] border rounded-xl p-4 flex flex-col gap-3 ${current ? 'border-[#2ea043]' : 'border-[#30363d]'}`,
  metaChip: (color: string) => `inline-flex items-center gap-1 px-2 py-[2px] rounded text-[11px] font-medium ${color}`,
  devicePath: 'font-mono text-[#6e7681] text-xs',
  emptyState: 'flex flex-col items-center justify-center py-10 gap-2 text-center',
  emptyTitle: 'text-[#adbac7] font-semibold text-sm',
  emptyBody:  'text-[#6e7681] text-xs max-w-[280px] leading-relaxed',
  feedbackRow: (ok: boolean) => `flex items-center gap-2 text-xs ${ok ? 'text-[#3fb950]' : 'text-[#f85149]'}`,
  checkRow: (done: boolean) => `flex items-center gap-2 text-sm ${done ? 'text-[#3fb950]' : 'text-[#adbac7]'}`,
}

function ConnectionBadge({ type }: { type: 'usb' | 'bluetooth' | 'network' }) {
  const map = {
    usb:       { label: 'USB',       bg: 'bg-[#1c2a3a] text-[#58a6ff]' },
    bluetooth: { label: 'Bluetooth', bg: 'bg-[#2d1a3a] text-[#d2a8ff]' },
    network:   { label: 'Network',   bg: 'bg-[#1a2a1a] text-[#3fb950]' },
  }
  const { label, bg } = map[type]
  return <span className={c.metaChip(bg)}>{label}</span>
}

function generateTestZpl(): string {
  const now  = new Date()
  const date = now.toLocaleDateString('en-US', { month: '2-digit', day: '2-digit', year: '2-digit' })
  const time = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })
  return [
    '^XA',
    '^CI28',
    '^FO30,20^A0N,36,26^FDPreppy Test Print^FS',
    `^FO30,68^A0N,22,16^FD${date}  ${time}^FS`,
    '^FO30,100^A0N,18,14^FDPrinter setup OK^FS',
    '^XZ',
  ].join('\n')
}

export default function PrinterTab() {
  const [currentDevice, setCurrentDevice]     = useState<string>('')
  const [currentWritable, setCurrentWritable] = useState<boolean | null>(null)
  const [devices, setDevices]   = useState<UsbPrinterDevice[]>([])
  const [scanning, setScanning] = useState(false)
  const [scanned, setScanned]   = useState(false)
  const [feedback, setFeedback] = useState<FeedbackState | null>(null)
  const [manualPath, setManualPath] = useState('')
  const [working, setWorking]   = useState<string | null>(null)
  const [testPrintSent, setTestPrintSent] = useState(() => localStorage.getItem(TEST_PRINT_KEY) === '1')
  const [checklistDismissed, setChecklistDismissed] = useState(() => localStorage.getItem(CHECKLIST_DISMISS) === '1')
  const [settingUp, setSettingUp] = useState(false)
  const [setupMsg, setSetupMsg] = useState<{ ok: boolean; msg: string } | null>(null)

  useEffect(() => {
    window.electronAPI.getConfig().then((cfg: unknown) => {
      const dev = (cfg as { printer?: { device?: string } })?.printer?.device ?? ''
      setCurrentDevice(dev)
      setManualPath(dev)
    }).catch(() => {})
    // Auto-scan on first open
    handleScan()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!currentDevice) { setCurrentWritable(null); return }
    window.electronAPI.testPrinter(currentDevice).then(r => setCurrentWritable(r.success)).catch(() => setCurrentWritable(false))
  }, [currentDevice])

  async function handleScan() {
    setScanning(true)
    setFeedback(null)
    try {
      const found = await window.electronAPI.scanPrinters()
      setDevices(found)
      setScanned(true)
      // Auto-select: if no device is currently active and a printer was found, pick the best one
      if (!found.some(d => d.isCurrent) && found.length > 0) {
        const best = found.find(d => d.isZebra) ?? found[0]
        await handleUse(best.path, found)
      }
    } catch (err) {
      setFeedback({ path: '', ok: false, msg: `Scan failed: ${err instanceof Error ? err.message : String(err)}` })
    } finally {
      setScanning(false)
    }
  }

  async function handlePrinterSetup() {
    setSettingUp(true)
    setSetupMsg(null)
    try {
      const r = await window.electronAPI.runPrinterSetup()
      if (r.success) {
        setSetupMsg({ ok: true, msg: 'Approve the Windows admin prompt if it appears, then this list will refresh.' })
        setTimeout(() => { void handleScan() }, 6000)
      } else {
        setSetupMsg({ ok: false, msg: r.error ?? 'Could not start printer setup.' })
      }
    } catch (err) {
      setSetupMsg({ ok: false, msg: err instanceof Error ? err.message : String(err) })
    } finally {
      setSettingUp(false)
    }
  }

  async function handleUse(devPath: string, currentDevices?: UsbPrinterDevice[]) {
    setWorking(devPath)
    setFeedback(null)
    try {
      const result = await window.electronAPI.setPrinterDevice(devPath)
      if (result.success) {
        setCurrentDevice(devPath)
        setDevices(prev => (currentDevices ?? prev).map(d => ({ ...d, isCurrent: d.path === devPath })))
        setFeedback({ path: devPath, ok: true, msg: 'Device saved as active printer.' })
      } else {
        setFeedback({ path: devPath, ok: false, msg: result.error ?? 'Failed to save device.' })
      }
    } catch (err) {
      setFeedback({ path: devPath, ok: false, msg: String(err) })
    } finally {
      setWorking(null)
    }
  }

  async function handleTest(devPath: string) {
    setWorking(devPath + ':test')
    setFeedback(null)
    try {
      const result = await window.electronAPI.testPrinter(devPath)
      setFeedback({
        path: devPath,
        ok: result.success,
        msg: result.success ? 'Device is accessible.' : (result.error ?? 'Device not accessible.'),
      })
    } catch (err) {
      setFeedback({ path: devPath, ok: false, msg: String(err) })
    } finally {
      setWorking(null)
    }
  }

  async function handleTestPrint() {
    setWorking('testprint')
    setFeedback(null)
    try {
      const result = await window.electronAPI.printZpl({ zpl: generateTestZpl(), qty: 1 })
      if (result.success) {
        localStorage.setItem(TEST_PRINT_KEY, '1')
        setTestPrintSent(true)
        setFeedback({ path: '', ok: true, msg: 'Test label sent — check the printer.' })
      } else {
        setFeedback({ path: '', ok: false, msg: result.error ?? 'Test print failed.' })
      }
    } catch (err) {
      setFeedback({ path: '', ok: false, msg: String(err) })
    } finally {
      setWorking(null)
    }
  }

  async function handleManualSet() {
    if (!manualPath.trim()) return
    await handleUse(manualPath.trim())
    setManualPath(manualPath.trim())
  }

  function dismissChecklist() {
    localStorage.setItem(CHECKLIST_DISMISS, '1')
    setChecklistDismissed(true)
  }

  const isLinux = navigator.userAgent.toLowerCase().includes('linux')
  const isWindows = navigator.userAgent.toLowerCase().includes('windows')
  const setupComplete = !!currentDevice && testPrintSent
  const showChecklist = !checklistDismissed || !setupComplete

  return (
    <div className="flex flex-col gap-5 max-w-2xl">

      {/* ── Setup checklist ── */}
      {showChecklist && (
        <SettingsCard
          title="Setup Checklist"
          right={
            setupComplete
              ? <button onClick={dismissChecklist} className={ui.neutralBtn}>Dismiss</button>
              : undefined
          }
        >
          <div className="flex flex-col gap-2">
            <div className={c.checkRow(!!currentDevice)}>
              <span className="text-base leading-none">{currentDevice ? '✓' : '○'}</span>
              <span>Printer configured{currentDevice ? ` — ${currentDevice}` : ''}</span>
            </div>
            <div className={c.checkRow(testPrintSent)}>
              <span className="text-base leading-none">{testPrintSent ? '✓' : '○'}</span>
              <span>Test print sent</span>
            </div>
          </div>
          {setupComplete && (
            <div className="text-xs text-[#3fb950]">Setup complete — printer is ready.</div>
          )}
          {!setupComplete && (
            <div className="text-xs text-[#6e7681]">
              {!currentDevice ? 'Scan for printers below, then send a test print to confirm everything is working.' : 'Send a test print to confirm the printer is working.'}
            </div>
          )}
        </SettingsCard>
      )}

      {/* ── Current device ── */}
      <SettingsCard
        title="Current Device"
        right={
          <button onClick={handleScan} disabled={scanning} className={ui.neutralBtn}>
            {scanning ? 'Scanning…' : 'Scan Devices'}
          </button>
        }
      >
        <div className="flex items-center gap-3 bg-[#0d1117] border border-[#30363d] rounded-xl px-4 py-3">
          <span className="font-mono text-white text-sm flex-1 truncate">
            {currentDevice || <span className="text-[#484f58]">Not configured</span>}
          </span>
          {currentDevice && currentWritable !== null && (
            <span className={c.pill(currentWritable)}>
              <span className={c.dot(currentWritable)} />
              {currentWritable ? 'Ready' : 'Not accessible'}
            </span>
          )}
        </div>

        {currentDevice && (
          <div className="flex gap-2">
            <button
              onClick={handleTestPrint}
              disabled={!!working || !currentDevice}
              className={ui.primaryBtn}
            >
              {working === 'testprint' ? 'Printing…' : 'Send Test Print'}
            </button>
            {feedback?.path === '' && (
              <div className={`flex items-center gap-2 text-xs ${feedback.ok ? 'text-[#3fb950]' : 'text-[#f85149]'}`}>
                <span>{feedback.ok ? '✓' : '✗'}</span>
                <span>{feedback.msg}</span>
              </div>
            )}
          </div>
        )}
      </SettingsCard>

      {/* ── Windows printer setup ── */}
      {isWindows && (
        <SettingsCard
          title="Windows Printer Setup"
          desc="Installs the print driver and creates the Zebra ZPL queue (one-time Windows admin approval). This runs automatically on launch — use this if no printer is detected."
        >
          <button onClick={handlePrinterSetup} disabled={settingUp} className={`self-start ${ui.primaryBtn}`}>
            {settingUp ? 'Starting…' : 'Install printer driver & queue'}
          </button>
          {setupMsg && (
            <div className={c.feedbackRow(setupMsg.ok)}>
              <span>{setupMsg.ok ? '✓' : '✗'}</span>
              <span>{setupMsg.msg}</span>
            </div>
          )}
        </SettingsCard>
      )}

      {/* ── Device list ── */}
      <SettingsCard title="Detected Devices">
        {!scanned && !scanning && (
          <div className={c.emptyState}>
            <div className={c.emptyTitle}>Scanning for printers…</div>
            <div className={c.emptyBody}>Checking for connected USB label printers.</div>
          </div>
        )}

        {scanning && (
          <div className={c.emptyState}>
            <div className={c.emptyTitle}>Scanning…</div>
            <div className={c.emptyBody}>Checking USB ports and system devices.</div>
          </div>
        )}

        {scanned && !scanning && devices.length === 0 && (
          <div className={c.emptyState}>
            <div className={c.emptyTitle}>No printers detected</div>
            <div className={c.emptyBody}>
              No USB label printers were found. Check that the printer is powered on
              and the USB cable is connected, then scan again.
            </div>
            {isLinux && (
              <div className={`${ui.note} mt-2`}>
                <strong className="text-[#adbac7]">Permission issue?</strong> On Ubuntu the printer device
                may require group membership. Run:<br />
                <span className={ui.mono}>sudo usermod -aG lp $USER</span><br />
                then log out and back in.
              </div>
            )}
          </div>
        )}

        {scanned && !scanning && devices.length > 0 && (
          <div className="flex flex-col gap-3">
            {devices.map(dev => {
              const isBusy = working === dev.path || working === dev.path + ':test'
              const thisFeedback = feedback?.path === dev.path ? feedback : null
              return (
                <div key={dev.path} className={c.deviceCard(dev.isCurrent)}>
                  <div className="flex items-start gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="text-white font-semibold text-sm leading-snug">{dev.displayName}</div>
                      <div className="flex items-center gap-2 flex-wrap mt-1">
                        <ConnectionBadge type={dev.connection} />
                        {dev.isZebra && <span className={c.metaChip('bg-[#1a2233] text-[#58a6ff] border border-[#1f4080]')}>Zebra</span>}
                        {dev.isCurrent && <span className={c.metaChip('bg-[#1a4731] text-[#3fb950]')}>Active</span>}
                        {!dev.writable && <span className={c.metaChip('bg-[#3d1a1a] text-[#f85149]')}>Not writable</span>}
                        {dev.vendorId && (
                          <span className="text-[#484f58] text-[10px] font-mono">{dev.vendorId}:{dev.productId}</span>
                        )}
                      </div>
                      <div className={`${c.devicePath} mt-1`}>{dev.path}</div>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button onClick={() => handleUse(dev.path)} disabled={isBusy || dev.isCurrent} className={ui.primaryBtn}>
                      {dev.isCurrent ? 'Active' : 'Use This Printer'}
                    </button>
                    <button onClick={() => handleTest(dev.path)} disabled={isBusy} className={ui.secondaryBtn}>
                      {working === dev.path + ':test' ? 'Testing…' : 'Test'}
                    </button>
                  </div>

                  {thisFeedback && (
                    <div className={c.feedbackRow(thisFeedback.ok)}>
                      <span>{thisFeedback.ok ? '✓' : '✗'}</span>
                      <span>{thisFeedback.msg}</span>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </SettingsCard>

      {/* ── Manual entry ── */}
      <SettingsCard title="Manual Path">
        <div className="flex gap-2">
          <input
            value={manualPath}
            onChange={e => setManualPath(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') void handleManualSet() }}
            placeholder={isLinux ? '/dev/usb/lp0' : 'Zebra ZPL'}
            className={`${ui.input} font-mono`}
            spellCheck={false}
          />
          <button onClick={() => void handleManualSet()} disabled={!manualPath.trim() || !!working} className={ui.neutralBtn}>
            Set
          </button>
        </div>
        <div className="text-[#6e7681] text-xs leading-relaxed">
          {isLinux
            ? 'Linux: USB printers appear at /dev/usb/lp0, /dev/usb/lp1 … Bluetooth via /dev/rfcomm0.'
            : 'Windows: Enter the print queue name shown in the Detected Devices list above (e.g. Zebra ZPL). Scanning auto-creates the queue when a printer is connected.'}
        </div>
        {feedback && feedback.path === manualPath.trim() && (
          <div className={c.feedbackRow(feedback.ok)}>
            <span>{feedback.ok ? '✓' : '✗'}</span>
            <span>{feedback.msg}</span>
          </div>
        )}
      </SettingsCard>

      {/* ── Platform notes ── */}
      <SettingsCard title="Notes">
        <div className="text-xs text-[#6e7681] leading-relaxed flex flex-col gap-2">
          <p>
            <span className="text-[#adbac7] font-semibold">Windows</span> — Scanning auto-creates a
            {' '}<span className={ui.mono}>Zebra ZPL</span> print queue using the Generic Text Only driver,
            which passes raw ZPL bytes straight to the printer without rendering. No Zebra drivers needed.
            If the printer is moved to a different USB port, scanning again reassigns the queue automatically.
          </p>
          <p>
            <span className="text-[#adbac7] font-semibold">Linux</span> — USB printers are exposed as
            raw character devices at <span className={ui.mono}>/dev/usb/lp0</span> with no driver required.
            If the device is not writable, run{' '}
            <span className={ui.mono}>sudo usermod -aG lp $USER</span> and log out.
          </p>
        </div>
      </SettingsCard>

    </div>
  )
}
