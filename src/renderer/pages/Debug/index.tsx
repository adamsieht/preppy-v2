import { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useSelector, useDispatch } from 'react-redux'
import type { RootState } from '../../store'
import { setVerboseErrors } from '../../store/slices/devSettings.slice'
import PageLayout from '../../components/PageLayout'

interface HardwareEntry { exists: boolean; writable: boolean }
interface DebugInfo {
  app: Record<string, unknown>
  runtime: Record<string, unknown>
  hardware: Record<string, HardwareEntry>
  database: Record<string, number>
  config: unknown
}

type TabKey = 'system' | 'hardware' | 'database' | 'config' | 'redux' | 'zpl'

const TABS: { key: TabKey; title: string }[] = [
  { key: 'system',   title: 'System'      },
  { key: 'hardware', title: 'Hardware'    },
  { key: 'database', title: 'Database'    },
  { key: 'config',   title: 'Config'      },
  { key: 'redux',    title: 'Redux State' },
  { key: 'zpl',      title: 'Raw ZPL'     },
]

// ── Tailwind class map ──────────────────────────────────────────────────────
const classes = {
  headerRight:   'flex items-center gap-3',
  badge:         'inline-block px-2 py-[2px] rounded text-xs font-bold text-white bg-[#dc3545]',
  toggleLabel:   'flex items-center gap-2 cursor-pointer text-sm select-none',
  refreshBtn:    'border border-[#dee2e6] text-[#6c757d] bg-transparent rounded px-3 py-1 text-sm disabled:opacity-60',
  loadingText:   'text-center py-5 text-[#6c757d]',
  errorBox:      'bg-[#f8d7da] border border-[#f5c2c7] text-[#842029] rounded p-3 mb-3',
  tabsBar:       'flex border-b-2 border-[#dee2e6] shrink-0 overflow-x-auto',
  tabBtn: (active: boolean) =>
    [
      'px-4 min-h-[48px] border-solid border-0 border-b-[3px] text-sm whitespace-nowrap cursor-pointer shrink-0',
      active ? 'border-[#0d6efd] bg-[#e7f1ff] font-semibold text-[#0d6efd]' : 'border-transparent bg-[#f8f9fa] text-[#495057]',
    ].join(' '),
  tabContent:    'p-4 overflow-y-auto flex-1 min-h-0',
  twoCol:        'grid grid-cols-2 gap-6',
  colTitle:      'font-semibold mb-2',
  table:         'w-full text-sm border-collapse',
  th:            'border-b-2 border-[#dee2e6] px-3 py-2 text-left font-semibold text-[#495057] bg-[#f8f9fa]',
  td:            'border-b border-[#dee2e6] px-3 py-2',
  tdMuted:       'border-b border-[#dee2e6] px-3 py-2 text-[#6c757d] w-[40%]',
  statusDot: (ok: boolean) =>
    `inline-block w-[10px] h-[10px] rounded-full mr-[6px] ${ok ? 'bg-[#28a745]' : 'bg-[#dc3545]'}`,
  dbBadge: (ok: boolean) =>
    `inline-block px-2 py-[2px] rounded text-xs font-bold text-white ${ok ? 'bg-[#6c757d]' : 'bg-[#dc3545]'}`,
  jsonBlock:     'bg-[#1e1e1e] text-[#9cdcfe] p-3 rounded text-[0.75rem] overflow-x-auto max-h-[380px] overflow-y-auto',
  hintText:      'text-[#6c757d] text-sm mb-2',
  zplAlert: (ok: boolean) =>
    `flex items-start justify-between gap-3 border rounded px-4 py-3 text-base mb-3 ${ok ? 'bg-[#d1e7dd] border-[#badbcc] text-[#0f5132]' : 'bg-[#f8d7da] border-[#f5c2c7] text-[#842029]'}`,
  textarea:      'w-full border border-[#ced4da] rounded p-3 font-mono text-[0.85rem] resize-none',
  zplActions:    'flex gap-2 mt-3',
  sendBtn:       'border-0 rounded px-4 py-2 bg-[#dc3545] text-white font-bold disabled:opacity-60',
  resetBtn:      'border border-[#dee2e6] text-[#6c757d] bg-transparent rounded px-4 py-2',
}
// ───────────────────────────────────────────────────────────────────────────

function StatusDot({ ok }: { ok: boolean }) {
  return <span className={classes.statusDot(ok)} />
}

function JsonBlock({ value }: { value: unknown }) {
  return (
    <pre className={classes.jsonBlock}>
      {JSON.stringify(value, null, 2)}
    </pre>
  )
}

export default function Debug() {
  const [tab, setTab] = useState<TabKey>('system')
  const [info, setInfo] = useState<DebugInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [rawZpl, setRawZpl] = useState('^XA\n^FO50,50^A0N,28,28^FDHELLO WORLD^FS\n^XZ')
  const [zplStatus, setZplStatus] = useState<{ ok: boolean; msg: string } | null>(null)
  const [sendingZpl, setSendingZpl] = useState(false)
  const navigate = useNavigate()
  const reduxState = useSelector((state: RootState) => state)
  const verboseErrors = useSelector((s: RootState) => s.devSettings.verboseErrors)
  const dispatch = useDispatch()

  const refresh = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      if (!window.electronAPI?.getDebugInfo) {
        throw new Error('electronAPI not available — is this running inside Electron?')
      }
      const data = await window.electronAPI.getDebugInfo()
      setInfo(data as DebugInfo)
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { refresh() }, [refresh])

  async function handleSendZpl() {
    setSendingZpl(true)
    setZplStatus(null)
    try {
      const result = await window.electronAPI.sendRawZpl(rawZpl)
      setZplStatus(result.success ? { ok: true, msg: 'ZPL sent.' } : { ok: false, msg: result.error ?? 'Failed' })
    } catch (err) {
      setZplStatus({ ok: false, msg: err instanceof Error ? err.message : String(err) })
    } finally {
      setSendingZpl(false)
    }
  }

  const headerRight = (
    <div className={classes.headerRight}>
      <span className={classes.badge}>Internal Tool</span>
      <label className={classes.toggleLabel}>
        <input
          type="checkbox"
          checked={verboseErrors}
          onChange={(e) => dispatch(setVerboseErrors(e.target.checked))}
          title="Show full error messages app-wide instead of generic fallbacks"
        />
        Verbose errors
      </label>
      <button onClick={refresh} disabled={loading} className={classes.refreshBtn}>
        {loading ? '···' : 'Refresh'}
      </button>
    </div>
  )

  return (
    <PageLayout title="Settings" back right={headerRight} noPad>
      <div className="flex flex-col h-full">

        {/* Quick navigation */}
        <div className="flex gap-2 px-4 py-3 border-b border-[#dee2e6] bg-[#f8f9fa] shrink-0">
          <button onClick={() => navigate('/printer-setup')} className="border border-[#dee2e6] text-[#495057] bg-white rounded px-4 py-2 text-sm font-medium cursor-pointer hover:bg-[#e9ecef]">
            Printer Setup
          </button>
          <button onClick={() => navigate('/reports')} className="border border-[#dee2e6] text-[#495057] bg-white rounded px-4 py-2 text-sm font-medium cursor-pointer hover:bg-[#e9ecef]">
            Reports
          </button>
          <button onClick={() => navigate('/wifi')} className="border border-[#dee2e6] text-[#495057] bg-white rounded px-4 py-2 text-sm font-medium cursor-pointer hover:bg-[#e9ecef]">
            WiFi
          </button>
          <button onClick={() => navigate('/label-calibration')} className="border border-[#dee2e6] text-[#495057] bg-white rounded px-4 py-2 text-sm font-medium cursor-pointer hover:bg-[#e9ecef]">
            Label Calibration
          </button>
          <button onClick={() => navigate('/datetime-settings')} className="border border-[#dee2e6] text-[#495057] bg-white rounded px-4 py-2 text-sm font-medium cursor-pointer hover:bg-[#e9ecef]">
            Date &amp; Time
          </button>
        </div>

        {loading && <div className={classes.loadingText}>Loading…</div>}

        {!loading && loadError && (
          <div className={classes.errorBox}>
            <strong>Failed to load debug info:</strong> {loadError}
          </div>
        )}

        {info && (
          <div className="flex flex-col flex-1 min-h-0">
            {/* Tab bar */}
            <div className={classes.tabsBar}>
              {TABS.map(t => (
                <button key={t.key} onClick={() => setTab(t.key)} className={classes.tabBtn(tab === t.key)}>
                  {t.title}
                </button>
              ))}
            </div>

            {/* Tab content */}
            <div className={classes.tabContent}>

            {/* ── System ──────────────────────────────────────────────────── */}
            {tab === 'system' && (
              <div className={classes.twoCol}>
                <div>
                  <div className={classes.colTitle}>App</div>
                  <table className={classes.table}>
                    <tbody>
                      {Object.entries(info.app).map(([k, v]) => (
                        <tr key={k}>
                          <td className={classes.tdMuted}>{k}</td>
                          <td className={classes.td}><code>{String(v)}</code></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div>
                  <div className={classes.colTitle}>Runtime</div>
                  <table className={classes.table}>
                    <tbody>
                      {Object.entries(info.runtime).map(([k, v]) => (
                        <tr key={k}>
                          <td className={classes.tdMuted}>{k}</td>
                          <td className={classes.td}><code>{String(v)}</code></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* ── Hardware ─────────────────────────────────────────────────── */}
            {tab === 'hardware' && (
              <table className={classes.table}>
                <thead>
                  <tr>
                    <th className={classes.th}>Path / Device</th>
                    <th className={classes.th}>Exists</th>
                    <th className={classes.th}>Writable</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(info.hardware).map(([key, val]) => (
                    <tr key={key}>
                      <td className={classes.td}><code>{key}</code></td>
                      <td className={classes.td}><StatusDot ok={val.exists} />{val.exists ? 'Yes' : 'No'}</td>
                      <td className={classes.td}><StatusDot ok={val.writable} />{val.writable ? 'Yes' : 'No'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {/* ── Database ─────────────────────────────────────────────────── */}
            {tab === 'database' && (
              <table className={`${classes.table} max-w-[400px]`}>
                <thead>
                  <tr>
                    <th className={classes.th}>Table</th>
                    <th className={classes.th}>Row count</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(info.database).map(([table, count]) => (
                    <tr key={table}>
                      <td className={classes.td}><code>{table}</code></td>
                      <td className={classes.td}>
                        <span className={classes.dbBadge(count >= 0)}>
                          {count < 0 ? 'error' : count}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}

            {/* ── Config ───────────────────────────────────────────────────── */}
            {tab === 'config' && (
              <>
                <div className={classes.hintText}>
                  Merged config (defaults + local overrides). Edit{' '}
                  <code>userData/config.local.json</code> to override.
                </div>
                <JsonBlock value={info.config} />
              </>
            )}

            {/* ── Redux State ───────────────────────────────────────────────── */}
            {tab === 'redux' && (
              <>
                <div className={classes.hintText}>Live snapshot of the Redux store.</div>
                <JsonBlock value={reduxState} />
              </>
            )}

            {/* ── Raw ZPL ───────────────────────────────────────────────────── */}
            {tab === 'zpl' && (
              <>
                <div className={classes.hintText}>
                  Send arbitrary ZPL directly to the printer device. No validation — use carefully.
                </div>
                {zplStatus && (
                  <div className={classes.zplAlert(zplStatus.ok)}>
                    <span>{zplStatus.msg}</span>
                    <button onClick={() => setZplStatus(null)} className="shrink-0 font-bold text-lg leading-none opacity-75">×</button>
                  </div>
                )}
                <textarea
                  rows={10}
                  value={rawZpl}
                  onChange={(e) => setRawZpl(e.target.value)}
                  className={classes.textarea}
                  spellCheck={false}
                />
                <div className={classes.zplActions}>
                  <button
                    disabled={sendingZpl || !rawZpl.trim()}
                    onClick={handleSendZpl}
                    className={classes.sendBtn}
                  >
                    {sendingZpl ? 'Sending…' : 'Send to Printer'}
                  </button>
                  <button
                    onClick={() => setRawZpl('^XA\n^FO50,50^A0N,28,28^FDHELLO WORLD^FS\n^XZ')}
                    className={classes.resetBtn}
                  >
                    Reset to sample
                  </button>
                </div>
              </>
            )}

            </div>
          </div>
        )}

      </div>
    </PageLayout>
  )
}
