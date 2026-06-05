import { useState, useCallback, useEffect, useMemo, useRef } from 'react'
import PageLayout from '../../components/PageLayout'
import AutoDismissAlert from '../../components/AutoDismissAlert'
import Label from '../../components/Label'
import { useErrorMsg } from '../../hooks/useErrorMsg'

type LabelTemplate = 'IX' | 'OX' | 'UX'

interface QuickItem {
  id: string
  name: string
  hrs: number
}

interface CustomPreset {
  id: string
  label: string
  hrs: number
}

// Preset as rendered — defaults have no id, custom presets have one for deletion
interface Preset {
  label: string
  hrs: number
  customId?: string
}

const TEMPLATES: LabelTemplate[] = ['IX', 'OX', 'UX']

const DEFAULT_PRESETS: Preset[] = [
  { label: '4 HR',   hrs: 4   },
  { label: '8 HR',   hrs: 8   },
  { label: '12 HR',  hrs: 12  },
  { label: '1 DAY',  hrs: 24  },
  { label: '2 DAY',  hrs: 48  },
  { label: '3 DAY',  hrs: 72  },
  { label: '7 DAY',  hrs: 168 },
  { label: '14 DAY', hrs: 336 },
  { label: '30 DAY', hrs: 720 },
]

const DEFAULT_DURATIONS: { label: string; hrs: number }[] = [
  { label: '1 hour',   hrs: 1   },
  { label: '2 hours',  hrs: 2   },
  { label: '4 hours',  hrs: 4   },
  { label: '6 hours',  hrs: 6   },
  { label: '8 hours',  hrs: 8   },
  { label: '12 hours', hrs: 12  },
  { label: '1 day',    hrs: 24  },
  { label: '2 days',   hrs: 48  },
  { label: '3 days',   hrs: 72  },
  { label: '5 days',   hrs: 120 },
  { label: '7 days',   hrs: 168 },
  { label: '14 days',  hrs: 336 },
  { label: '30 days',  hrs: 720 },
]

const ITEMS_KEY   = 'preppy-quick-items'
const PRESETS_KEY = 'preppy-custom-presets'
const WIDTH_KEY   = 'preppy-left-width'

function loadStored<T>(key: string): T[] {
  try { return JSON.parse(localStorage.getItem(key) ?? '[]') }
  catch { return [] }
}
function persist(key: string, value: unknown) {
  localStorage.setItem(key, JSON.stringify(value))
}

function fmtDuration(hrs: number): string {
  if (hrs < 24) return `${hrs} hr`
  const d = hrs / 24
  return `${d} day${d !== 1 ? 's' : ''}`
}

function autoLabel(hrs: number): string {
  if (hrs < 24) return `${hrs} HR`
  const d = hrs / 24
  return Number.isInteger(d) ? `${d} DAY` : `${hrs} HR`
}

// ── Tailwind class map ──────────────────────────────────────────────────────
const classes = {
  page:      'flex h-full bg-[#0d1117]',
  leftCol:   'flex flex-col flex-1 xl:flex-none min-w-0',
  alertWrap: 'px-3 pt-3 shrink-0',
  selector:  'flex shrink-0',
  tmplBtn:   (active: boolean) => {
    const fill = active ? 'bg-[#28a745] text-white' : 'bg-transparent text-[#28a745]'
    return `flex-1 py-3 min-h-[52px] text-[1.05rem] font-bold border-b-2 border-[#28a745] cursor-pointer disabled:opacity-60 ${fill}`
  },
  cardsRow:  'grid grid-flow-col grid-rows-[auto] tall:grid-rows-[auto_auto] xtall:grid-rows-[auto_auto_auto] [grid-auto-columns:220px] content-center overflow-x-auto overflow-y-hidden flex-1 min-h-0 gap-3 px-3 pt-3 pb-3 scrollbar-dark',
  card:      'relative h-[210px] bg-[#0d1117] border border-[#30363d] rounded-lg overflow-hidden flex flex-col',
  cardHead:  'text-center py-[6px] px-3 border-b border-[#30363d] text-white text-base font-bold tracking-wide shrink-0',
  cardBody:  'bg-[#090c10] p-3 flex flex-col gap-2 flex-1 min-h-0',
  btnRow:    'flex gap-2',
  btn5:      'flex-1 min-h-[44px] border border-[#30363d] rounded-lg bg-[#161b22] text-white text-sm font-bold disabled:opacity-60',
  btnX:      'flex-1 min-h-[44px] border border-[#28a745] rounded-lg bg-[#28a745] text-white text-sm font-bold disabled:opacity-60',
  cardDelBtn:'absolute top-1 left-1 bg-transparent border-0 text-[#30363d] hover:text-[#f85149] cursor-pointer text-xs leading-none px-[2px] transition-colors',

  // Add-preset button (dashed card)
  addPresetBtn:     'h-[210px] border-2 border-dashed border-[#30363d] hover:border-[#28a745] hover:text-[#28a745] rounded-lg flex flex-col items-center justify-center gap-1 text-[#484f58] bg-transparent cursor-pointer transition-colors',
  // Add-preset form (inline in a card)
  addPresetPreview: 'text-center text-white font-bold text-lg leading-none',
  presetCountRow:   'flex items-center',
  presetCountBtn:   'w-12 h-12 border border-[#30363d] rounded-lg bg-transparent text-white text-3xl cursor-pointer hover:border-[#28a745] active:bg-[#28a745]/20 flex-none select-none flex items-center justify-center',
  presetCountVal:   'flex-1 text-center text-white font-bold text-xl',
  addPresetOk:      'flex-1 min-h-[34px] border-0 rounded-lg bg-[#28a745] text-white text-sm font-bold cursor-pointer disabled:opacity-50',
  addPresetCancel:  'flex-1 min-h-[34px] border border-[#30363d] rounded-lg bg-transparent text-[#6e7681] text-sm cursor-pointer',

  // Drag divider
  divider:    'hidden xl:flex w-[8px] shrink-0 cursor-col-resize touch-none items-center justify-center hover:bg-[#28a745]/10 select-none transition-colors',
  dividerBar: 'w-[2px] h-12 rounded-full bg-[#30363d]',

  // Quick Items panel
  panel:        'hidden xl:flex flex-col flex-1 border-l border-[#30363d] min-w-0',
  panelHead:    'flex items-center justify-between px-4 py-3 border-b border-[#30363d] shrink-0',
  panelTitle:   'text-white font-bold text-base',
  panelCount:   'text-[#6e7681] text-xs',
  panelList:    'flex-1 min-h-0 overflow-y-auto scrollbar-dark',
  emptyState:   'flex flex-col items-center justify-center h-full gap-2 text-[#6e7681] text-sm text-center px-6',
  itemRow:      'flex items-center gap-2 px-3 py-3 border-b border-[#30363d] group hover:bg-[#161b22] transition-colors',
  itemInfo:     'flex-1 min-w-0',
  itemName:     'text-white text-sm font-medium leading-snug truncate',
  itemDur:      'text-[#6e7681] text-xs mt-[2px]',
  itemBtn:      (green: boolean) =>
    `shrink-0 px-3 py-[6px] text-xs font-bold rounded border cursor-pointer disabled:opacity-60 ${
      green ? 'border-[#28a745] bg-[#28a745] text-white' : 'border-[#30363d] bg-[#0d1117] text-white'
    }`,
  itemDelBtn:   'shrink-0 bg-transparent border-0 cursor-pointer text-[#6e7681] hover:text-[#f85149] text-base leading-none px-1 opacity-0 group-hover:opacity-100 transition-opacity',
  addForm:      'shrink-0 border-t border-[#30363d] p-3 flex flex-col gap-[6px]',
  addLabel:     'text-[#6e7681] text-[10px] font-semibold uppercase tracking-widest mb-1',
  addInput:     'w-full bg-[#0d1117] border border-[#30363d] rounded px-3 py-[8px] text-white text-sm placeholder:text-[#484f58] outline-none focus:border-[#28a745]',
  addSelect:    'w-full bg-[#0d1117] border border-[#30363d] rounded px-3 py-[8px] text-white text-sm outline-none focus:border-[#28a745] cursor-pointer',
  addBtn:       'w-full py-2 border-0 rounded bg-[#28a745] text-white text-sm font-bold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed',
}
// ───────────────────────────────────────────────────────────────────────────

interface PanelProps {
  onPrint:         (hrs: number, qty: number) => void
  printing:        boolean
  durationOptions: { label: string; hrs: number }[]
}

function QuickItemsPanel({ onPrint, printing, durationOptions }: PanelProps) {
  const [items, setItems] = useState<QuickItem[]>(() => loadStored(ITEMS_KEY))
  const [name,  setName]  = useState('')
  const [hrs,   setHrs]   = useState(durationOptions[2]?.hrs ?? 4)

  // Keep default hrs in sync if durationOptions change
  useEffect(() => {
    setHrs(prev => durationOptions.some(o => o.hrs === prev) ? prev : (durationOptions[0]?.hrs ?? 4))
  }, [durationOptions])

  function addItem() {
    if (!name.trim()) return
    const id   = `${Date.now()}-${Math.random().toString(36).slice(2)}`
    const next = [...items, { id, name: name.trim(), hrs }]
    setItems(next)
    persist(ITEMS_KEY, next)
    setName('')
  }

  function removeItem(id: string) {
    const next = items.filter(i => i.id !== id)
    setItems(next)
    persist(ITEMS_KEY, next)
  }

  return (
    <div className={classes.panel}>
      <div className={classes.panelHead}>
        <span className={classes.panelTitle}>Quick Items</span>
        <span className={classes.panelCount}>{items.length} item{items.length !== 1 ? 's' : ''}</span>
      </div>

      <div className={classes.panelList}>
        {items.length === 0 ? (
          <div className={classes.emptyState}>
            <span className="text-white font-medium">No items yet</span>
            <span>Add commonly prepped items below to print their labels in one tap</span>
          </div>
        ) : (
          items.map(item => (
            <div key={item.id} className={classes.itemRow}>
              <div className={classes.itemInfo}>
                <div className={classes.itemName}>{item.name}</div>
                <div className={classes.itemDur}>{fmtDuration(item.hrs)}</div>
              </div>
              <button onClick={() => onPrint(item.hrs, 1)} disabled={printing} className={classes.itemBtn(false)}>×1</button>
              <button onClick={() => onPrint(item.hrs, 5)} disabled={printing} className={classes.itemBtn(true)}>×5</button>
              <button onClick={() => removeItem(item.id)} className={classes.itemDelBtn} title="Remove">✕</button>
            </div>
          ))
        )}
      </div>

      <div className={classes.addForm}>
        <div className={classes.addLabel}>Add Item</div>
        <input
          value={name}
          onChange={e => setName(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') addItem() }}
          placeholder="e.g. Chicken Wings"
          className={classes.addInput}
        />
        <select value={hrs} onChange={e => setHrs(Number(e.target.value))} className={classes.addSelect}>
          {durationOptions.map(o => (
            <option key={o.hrs} value={o.hrs}>{o.label}</option>
          ))}
        </select>
        <button onClick={addItem} disabled={!name.trim() || printing} className={classes.addBtn}>
          + Add to Quick Items
        </button>
      </div>
    </div>
  )
}

export default function Preppy() {
  const [template,       setTemplate]       = useState<LabelTemplate>('IX')
  const [status,         setStatus]         = useState<{ ok: boolean; msg: string } | null>(null)
  const [printing,       setPrinting]       = useState(false)
  const [customPresets,  setCustomPresets]  = useState<CustomPreset[]>(() => loadStored(PRESETS_KEY))
  const [leftWidth,      setLeftWidth]      = useState(() => {
    const saved = parseInt(localStorage.getItem(WIDTH_KEY) ?? '800', 10)
    return isNaN(saved) ? 800 : Math.max(440, Math.min(saved, 1600))
  })
  const [isLargeScreen,  setIsLargeScreen]  = useState(() => window.innerWidth >= 1280)
  const [showAddPreset,  setShowAddPreset]  = useState(false)
  const [newPresetValue, setNewPresetValue] = useState(0)
  const [newPresetUnit,  setNewPresetUnit]  = useState<'hours' | 'days'>('hours')
  const divDragRef = useRef<{ startX: number; startW: number } | null>(null)
  const errorMsg    = useErrorMsg()
  const clearStatus = useCallback(() => setStatus(null), [])

  useEffect(() => {
    const handler = () => setIsLargeScreen(window.innerWidth >= 1280)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])

  // Merge defaults + custom presets, deduplicated and sorted by hours
  const allPresets = useMemo<Preset[]>(() => {
    const defaultHrs = new Set(DEFAULT_PRESETS.map(p => p.hrs))
    return [
      ...DEFAULT_PRESETS,
      ...customPresets.filter(p => !defaultHrs.has(p.hrs)).map(p => ({ label: p.label, hrs: p.hrs, customId: p.id })),
    ].sort((a, b) => a.hrs - b.hrs)
  }, [customPresets])

  // Merge duration options with custom presets, deduplicated and sorted
  const allDurations = useMemo(() => {
    const defaultHrs = new Set(DEFAULT_DURATIONS.map(o => o.hrs))
    const extra = customPresets
      .filter(p => !defaultHrs.has(p.hrs))
      .map(p => ({ label: p.label.toLowerCase(), hrs: p.hrs }))
    return [...DEFAULT_DURATIONS, ...extra].sort((a, b) => a.hrs - b.hrs)
  }, [customPresets])

  // ── Drag divider (pointer events = mouse + touch) ────────────────────────
  function onDividerPointerDown(e: React.PointerEvent<HTMLDivElement>) {
    e.currentTarget.setPointerCapture(e.pointerId)
    divDragRef.current = { startX: e.clientX, startW: leftWidth }
  }
  function onDividerPointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!divDragRef.current) return
    const newW = Math.max(440, Math.min(divDragRef.current.startW + e.clientX - divDragRef.current.startX, window.innerWidth - 320))
    setLeftWidth(newW)
  }
  function onDividerPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    if (!divDragRef.current) return
    const newW = Math.max(440, Math.min(divDragRef.current.startW + e.clientX - divDragRef.current.startX, window.innerWidth - 320))
    persist(WIDTH_KEY, newW)
    divDragRef.current = null
  }

  // ── Custom presets ────────────────────────────────────────────────────────
  function switchPresetUnit(unit: 'hours' | 'days') {
    if (unit === newPresetUnit) return
    setNewPresetValue(0)
    setNewPresetUnit(unit)
  }

  function addCustomPreset() {
    const hrs = newPresetUnit === 'hours' ? newPresetValue : newPresetValue * 24
    if (hrs < 1) return
    const id   = `${Date.now()}-${Math.random().toString(36).slice(2)}`
    const next = [...customPresets, { id, label: autoLabel(hrs), hrs }].sort((a, b) => a.hrs - b.hrs)
    setCustomPresets(next)
    persist(PRESETS_KEY, next)
    setNewPresetValue(0)
    setNewPresetUnit('hours')
    setShowAddPreset(false)
  }

  function removeCustomPreset(id: string) {
    const next = customPresets.filter(p => p.id !== id)
    setCustomPresets(next)
    persist(PRESETS_KEY, next)
  }

  // ── Print handlers ────────────────────────────────────────────────────────
  async function handlePrint(durationHrs: number, qty: number) {
    setPrinting(true)
    try {
      const result = await window.electronAPI.print({ template, durationHrs, qty })
      setStatus(result.success
        ? { ok: true, msg: result.simulated
            ? `Simulated ×${qty} → ${result.simulatedPath ?? 'simulated-labels/'}`
            : `Printed ×${qty}` }
        : { ok: false, msg: result.error ?? 'Print failed' })
    } catch (err) {
      setStatus({ ok: false, msg: errorMsg(err, 'Print failed') })
    } finally {
      setPrinting(false)
    }
  }

  function handleCustomPrint(durationHrs: number, presetLabel: string) {
    const raw = window.prompt(`Print how many labels for ${presetLabel}?`, '10')
    if (raw == null) return
    const qty = Number.parseInt(raw.trim(), 10)
    if (!Number.isInteger(qty) || qty < 1 || qty > 500) {
      setStatus({ ok: false, msg: 'Enter a whole number between 1 and 500.' })
      return
    }
    void handlePrint(durationHrs, qty)
  }

  const presetMaxVal = newPresetUnit === 'hours' ? 720 : 365

  return (
    <PageLayout title="Print Labels" back noPad>
      <div className={classes.page}>

        {/* ── Left: template selector + scrollable preset cards ── */}
        <div
          className={classes.leftCol}
          style={isLargeScreen ? { width: leftWidth, flexShrink: 0, flexGrow: 0 } : undefined}
        >
          {status && (
            <div className={classes.alertWrap}>
              <AutoDismissAlert variant={status.ok ? 'success' : 'danger'} msg={status.msg} onDismiss={clearStatus} />
            </div>
          )}

          <div className={classes.selector}>
            {TEMPLATES.map((id) => (
              <button
                key={id}
                onClick={() => setTemplate(id)}
                disabled={printing}
                className={classes.tmplBtn(template === id)}
              >
                {id}
              </button>
            ))}
          </div>

          <div className={classes.cardsRow}>
            {/* Preset cards */}
            {allPresets.map(({ label, hrs, customId }) => (
              <div key={hrs} className={classes.card}>
                {customId && (
                  <button
                    onClick={() => removeCustomPreset(customId)}
                    className={classes.cardDelBtn}
                    title="Remove preset"
                  >
                    ✕
                  </button>
                )}
                <div className={classes.cardHead}>{label}</div>
                <div className={classes.cardBody}>
                  <Label durationHrs={hrs} type={template} />
                  <div className={classes.btnRow}>
                    <button onClick={() => handlePrint(hrs, 5)} disabled={printing} className={classes.btn5}>🖨 5</button>
                    <button onClick={() => handleCustomPrint(hrs, label)} disabled={printing} className={classes.btnX}>🖨 ×</button>
                  </div>
                </div>
              </div>
            ))}

            {/* Add preset — button or inline form */}
            {showAddPreset ? (
              <div className={classes.card}>
                <div className={classes.cardHead}>New Preset</div>
                <div className="bg-[#090c10] p-[5px] flex flex-col gap-[5px] flex-1 min-h-0 overflow-hidden">
                  {/* Live label preview */}
                  <div className={classes.addPresetPreview}>
                    {newPresetValue > 0 ? autoLabel(newPresetUnit === 'hours' ? newPresetValue : newPresetValue * 24) : '—'}
                  </div>

                  {/* Hours / Days toggle — pure inline styles; boxShadow avoids border eating into height */}
                  <div style={{ display: 'flex', height: 24, borderRadius: 4, overflow: 'hidden', flexShrink: 0, boxShadow: '0 0 0 1px #30363d' }}>
                    <button
                      onClick={() => switchPresetUnit('hours')}
                      style={{ flex: 1, padding: 0, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 12, lineHeight: '24px', textAlign: 'center', background: newPresetUnit === 'hours' ? '#28a745' : 'transparent', color: newPresetUnit === 'hours' ? '#fff' : '#6e7681' }}
                    >Hours</button>
                    <div style={{ width: 1, flexShrink: 0, background: '#30363d' }} />
                    <button
                      onClick={() => switchPresetUnit('days')}
                      style={{ flex: 1, padding: 0, border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: 12, lineHeight: '24px', textAlign: 'center', background: newPresetUnit === 'days' ? '#28a745' : 'transparent', color: newPresetUnit === 'days' ? '#fff' : '#6e7681' }}
                    >Days</button>
                  </div>

                  {/* −  value  + */}
                  <div className={classes.presetCountRow}>
                    <button
                      onClick={() => setNewPresetValue(v => Math.max(0, v - 1))}
                      className={classes.presetCountBtn}
                    >−</button>
                    <div className={classes.presetCountVal}>{newPresetValue}</div>
                    <button
                      onClick={() => setNewPresetValue(v => Math.min(presetMaxVal, v + 1))}
                      className={classes.presetCountBtn}
                    >+</button>
                  </div>

                  {/* Add / Cancel */}
                  <div className={classes.btnRow}>
                    <button onClick={addCustomPreset} disabled={newPresetValue < 1} className={classes.addPresetOk}>Add</button>
                    <button
                      onClick={() => { setShowAddPreset(false); setNewPresetValue(0); setNewPresetUnit('hours') }}
                      className={classes.addPresetCancel}
                    >Cancel</button>
                  </div>
                </div>
              </div>
            ) : (
              <button onClick={() => setShowAddPreset(true)} className={classes.addPresetBtn}>
                <span className="text-3xl leading-none">+</span>
                <span className="text-xs">Add Preset</span>
              </button>
            )}
          </div>
        </div>

        {/* ── Drag divider (xl+ only) ── */}
        <div
          className={classes.divider}
          onPointerDown={onDividerPointerDown}
          onPointerMove={onDividerPointerMove}
          onPointerUp={onDividerPointerUp}
        >
          <div className={classes.dividerBar} />
        </div>

        {/* ── Right: quick items panel (xl+ only) ── */}
        <QuickItemsPanel
          onPrint={handlePrint}
          printing={printing}
          durationOptions={allDurations}
        />

      </div>
    </PageLayout>
  )
}
