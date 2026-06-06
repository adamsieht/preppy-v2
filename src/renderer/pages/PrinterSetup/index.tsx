import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import PageLayout from '../../components/PageLayout'

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

// ── Tailwind class map ──────────────────────────────────────────────────────
const c = {
  section:     'mb-6',
  label:       'text-[#6e7681] text-[11px] font-semibold uppercase tracking-widest mb-2',
  currentCard: 'flex items-center gap-3 bg-[#161b22] border border-[#30363d] rounded-xl px-4 py-3',
  currentPath: 'font-mono text-white text-sm flex-1 truncate',
  pill: (ok: boolean) =>
    `inline-flex items-center gap-1 px-2 py-[3px] rounded-full text-xs font-semibold ${
      ok ? 'bg-[#1a4731] text-[#3fb950]' : 'bg-[#3d1a1a] text-[#f85149]'
    }`,
  dot: (ok: boolean) =>
    `w-[7px] h-[7px] rounded-full ${ok ? 'bg-[#3fb950]' : 'bg-[#f85149]'}`,

  scanBtn:   'px-5 py-2 rounded-lg bg-[#21262d] border border-[#30363d] text-[#adbac7] text-sm font-semibold cursor-pointer hover:border-[#6e7681] hover:text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed',

  deviceCard: 'bg-[#161b22] border border-[#30363d] rounded-xl p-4 flex flex-col gap-3',
  deviceCardCurrent: 'bg-[#161b22] border border-[#2ea043] rounded-xl p-4 flex flex-col gap-3',
  deviceHeader: 'flex items-start gap-3',
  deviceName: 'text-white font-semibold text-sm leading-snug flex-1',
  deviceMeta: 'flex items-center gap-2 flex-wrap',
  metaChip: (color: string) =>
    `inline-flex items-center gap-1 px-2 py-[2px] rounded text-[11px] font-medium ${color}`,
  devicePath: 'font-mono text-[#6e7681] text-xs',
  deviceActions: 'flex gap-2',
  useBtn:   'px-4 py-2 rounded-lg bg-[#28a745] border-0 text-white text-sm font-bold cursor-pointer hover:bg-[#2ea043] transition-colors disabled:opacity-50',
  testBtn:  'px-4 py-2 rounded-lg bg-transparent border border-[#30363d] text-[#adbac7] text-sm font-bold cursor-pointer hover:border-[#6e7681] hover:text-white transition-colors',

  manualRow: 'flex gap-2',
  manualInput: 'flex-1 bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2 font-mono text-white text-sm outline-none focus:border-[#28a745] placeholder:text-[#484f58]',
  setBtn: 'px-4 py-2 rounded-lg bg-[#21262d] border border-[#30363d] text-[#adbac7] text-sm font-bold cursor-pointer hover:border-[#6e7681] hover:text-white transition-colors disabled:opacity-50',

  emptyState: 'flex flex-col items-center justify-center py-10 gap-2 text-center',
  emptyTitle: 'text-[#adbac7] font-semibold text-sm',
  emptyBody:  'text-[#6e7681] text-xs max-w-[280px] leading-relaxed',

  permNote: 'mt-4 bg-[#0d1117] border border-[#30363d] rounded-lg px-4 py-3 text-xs text-[#6e7681] leading-relaxed',
  permCode: 'font-mono text-[#adbac7] bg-[#161b22] px-1 py-[1px] rounded text-[11px]',

  feedbackRow: 'flex items-center gap-2 text-xs',
  feedOk:  'text-[#3fb950]',
  feedErr: 'text-[#f85149]',
}
// ───────────────────────────────────────────────────────────────────────────

function ConnectionBadge({ type }: { type: 'usb' | 'bluetooth' | 'network' }) {
  const map = {
    usb:       { label: 'USB',       bg: 'bg-[#1c2a3a] text-[#58a6ff]' },
    bluetooth: { label: 'Bluetooth', bg: 'bg-[#2d1a3a] text-[#d2a8ff]' },
    network:   { label: 'Network',   bg: 'bg-[#1a2a1a] text-[#3fb950]' },
  }
  const { label, bg } = map[type]
  return <span className={c.metaChip(bg)}>{label}</span>
}

function ZebraBadge() {
  return <span className={c.metaChip('bg-[#1a2233] text-[#58a6ff] border border-[#1f4080]')}>Zebra</span>
}

interface FeedbackState {
  path: string
  ok: boolean
  msg: string
}

export default function PrinterSetup() {
  const navigate = useNavigate()
  const [currentDevice, setCurrentDevice] = useState<string>('')
  const [currentWritable, setCurrentWritable] = useState<boolean | null>(null)
  const [devices, setDevices]       = useState<UsbPrinterDevice[]>([])
  const [scanning, setScanning]     = useState(false)
  const [scanned, setScanned]       = useState(false)
  const [feedback, setFeedback]     = useState<FeedbackState | null>(null)
  const [manualPath, setManualPath] = useState('')
  const [working, setWorking]       = useState<string | null>(null)  // path being acted on

  useEffect(() => {
    window.electronAPI.getConfig().then((cfg: unknown) => {
      const config = cfg as { printer?: { device?: string } }
      const dev = config?.printer?.device ?? ''
      setCurrentDevice(dev)
      setManualPath(dev)
    }).catch(() => {})
  }, [])

  // Re-check current device writability whenever currentDevice changes
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
    } catch (err) {
      setFeedback({ path: '', ok: false, msg: `Scan failed: ${err instanceof Error ? err.message : String(err)}` })
    } finally {
      setScanning(false)
    }
  }

  async function handleUse(devPath: string) {
    setWorking(devPath)
    setFeedback(null)
    try {
      const result = await window.electronAPI.setPrinterDevice(devPath)
      if (result.success) {
        setCurrentDevice(devPath)
        setDevices(prev => prev.map(d => ({ ...d, isCurrent: d.path === devPath })))
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
        msg: result.success ? 'Device is accessible and writable.' : (result.error ?? 'Device not accessible.'),
      })
    } catch (err) {
      setFeedback({ path: devPath, ok: false, msg: String(err) })
    } finally {
      setWorking(null)
    }
  }

  async function handleManualSet() {
    if (!manualPath.trim()) return
    await handleUse(manualPath.trim())
    setManualPath(manualPath.trim())
  }

  const isLinux = navigator.userAgent.toLowerCase().includes('linux')
  const headerRight = (
    <button onClick={handleScan} disabled={scanning} className={c.scanBtn}>
      {scanning ? 'Scanning…' : 'Scan Devices'}
    </button>
  )

  return (
    <PageLayout title="Printer Setup" back="/debug" right={headerRight}>

      {/* ── Current device ── */}
      <div className={c.section}>
        <div className={c.label}>Current Device</div>
        <div className={c.currentCard}>
          <span className={c.currentPath}>{currentDevice || <span className="text-[#484f58]">Not configured</span>}</span>
          {currentDevice && currentWritable !== null && (
            <span className={c.pill(currentWritable)}>
              <span className={c.dot(currentWritable)} />
              {currentWritable ? 'Writable' : 'Not writable'}
            </span>
          )}
        </div>
      </div>

      {/* ── Device list ── */}
      <div className={c.section}>
        <div className={c.label}>Detected Devices</div>

        {!scanned && !scanning && (
          <div className={c.emptyState}>
            <div className={c.emptyTitle}>No scan performed yet</div>
            <div className={c.emptyBody}>
              Tap <strong>Scan Devices</strong> to detect connected USB label printers.
              Make sure the printer is powered on and connected before scanning.
            </div>
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
              <div className={c.permNote}>
                <strong className="text-[#adbac7]">Permission issue?</strong> On Ubuntu the printer device
                may require group membership. Run:<br />
                <span className={c.permCode}>sudo usermod -aG lp $USER</span><br />
                then log out and back in, or run:<br />
                <span className={c.permCode}>sudo chmod a+rw /dev/usb/lp0</span>
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
                <div key={dev.path} className={dev.isCurrent ? c.deviceCardCurrent : c.deviceCard}>
                  <div className={c.deviceHeader}>
                    <div className="flex-1 min-w-0">
                      <div className={c.deviceName}>{dev.displayName}</div>
                      <div className={c.deviceMeta}>
                        <ConnectionBadge type={dev.connection} />
                        {dev.isZebra && <ZebraBadge />}
                        {dev.isCurrent && (
                          <span className={c.metaChip('bg-[#1a4731] text-[#3fb950]')}>Active</span>
                        )}
                        {!dev.writable && (
                          <span className={c.metaChip('bg-[#3d1a1a] text-[#f85149]')}>Not writable</span>
                        )}
                        {dev.vendorId && (
                          <span className="text-[#484f58] text-[10px] font-mono">
                            {dev.vendorId}:{dev.productId}
                          </span>
                        )}
                      </div>
                      <div className={`${c.devicePath} mt-1`}>{dev.path}</div>
                    </div>
                  </div>

                  <div className={c.deviceActions}>
                    <button
                      onClick={() => handleUse(dev.path)}
                      disabled={isBusy || dev.isCurrent}
                      className={c.useBtn}
                    >
                      {dev.isCurrent ? 'Active' : 'Use This Printer'}
                    </button>
                    <button
                      onClick={() => handleTest(dev.path)}
                      disabled={isBusy}
                      className={c.testBtn}
                    >
                      {working === dev.path + ':test' ? 'Testing…' : 'Test'}
                    </button>
                  </div>

                  {thisFeedback && (
                    <div className={`${c.feedbackRow} ${thisFeedback.ok ? c.feedOk : c.feedErr}`}>
                      <span>{thisFeedback.ok ? '✓' : '✗'}</span>
                      <span>{thisFeedback.msg}</span>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── Manual entry ── */}
      <div className={c.section}>
        <div className={c.label}>Manual Path</div>
        <div className={c.manualRow}>
          <input
            value={manualPath}
            onChange={e => setManualPath(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') void handleManualSet() }}
            placeholder={isLinux ? '/dev/usb/lp0' : 'USB001'}
            className={c.manualInput}
            spellCheck={false}
          />
          <button
            onClick={() => void handleManualSet()}
            disabled={!manualPath.trim() || !!working}
            className={c.setBtn}
          >
            Set
          </button>
        </div>
        <div className="mt-2 text-[#6e7681] text-xs leading-relaxed">
          {isLinux
            ? 'Linux: USB printers appear at /dev/usb/lp0, /dev/usb/lp1 … Bluetooth via /dev/rfcomm0.'
            : 'Windows: USB printers use port names like USB001. COM ports are also supported.'}
        </div>
        {feedback && feedback.path === manualPath.trim() && (
          <div className={`${c.feedbackRow} mt-2 ${feedback.ok ? c.feedOk : c.feedErr}`}>
            <span>{feedback.ok ? '✓' : '✗'}</span>
            <span>{feedback.msg}</span>
          </div>
        )}
      </div>

      {/* ── Platform notes ── */}
      <div className={c.section}>
        <div className={c.label}>Notes</div>
        <div className="bg-[#0d1117] border border-[#30363d] rounded-xl px-4 py-3 text-xs text-[#6e7681] leading-relaxed flex flex-col gap-2">
          <p>
            <span className="text-[#adbac7] font-semibold">WiFi / Network printers</span> — Zebra network
            printers accept raw ZPL on TCP port 9100. Enter the IP address in the format{' '}
            <span className={c.permCode}>tcp://192.168.1.100:9100</span>. Network print support
            requires a code change to the printer service (currently file-based only).
          </p>
          <p>
            <span className="text-[#adbac7] font-semibold">Windows</span> — Raw USB write paths differ
            from Linux. Set the port name (e.g. <span className={c.permCode}>USB001</span>) found in
            Devices &amp; Printers. The printer service will need updating to use the Windows spooler
            or direct port write for full Windows support.
          </p>
          <button
            onClick={() => navigate('/debug')}
            className="mt-1 self-start text-[#58a6ff] hover:underline cursor-pointer bg-transparent border-0 p-0 text-xs"
          >
            Send test ZPL → Settings / Raw ZPL tab
          </button>
        </div>
      </div>

    </PageLayout>
  )
}
