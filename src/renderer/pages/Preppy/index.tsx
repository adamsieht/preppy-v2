import { useState, useEffect, useMemo, useRef } from 'react'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import type { DragEndEvent } from '@dnd-kit/core'
import {
  arrayMove,
  SortableContext,
  rectSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
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

interface DisplayPreset {
  id: string        // "d-{hrs}" for defaults, custom id for user-created
  label: string
  hrs: number
  isDefault: boolean
}

const TEMPLATES: LabelTemplate[] = ['IX', 'OX', 'UX']

const DEFAULT_PRESETS = [
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

const DEFAULT_DURATIONS = [
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

const ITEMS_KEY          = 'preppy-quick-items'
const PRESETS_KEY        = 'preppy-custom-presets'
const WIDTH_KEY          = 'preppy-left-width'
const PRESET_ORDER_KEY   = 'preppy-preset-order'
const HIDDEN_PRESETS_KEY = 'preppy-hidden-presets'

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
  newBtn:    'px-3 py-3 min-h-[52px] text-sm font-bold text-[#28a745] border-b-2 border-[#28a745] bg-transparent cursor-pointer shrink-0 hover:bg-[#28a745]/10 transition-colors',
  sortSelect:'px-3 py-3 min-h-[52px] text-sm font-bold text-[#6e7681] border-b-2 border-[#30363d] bg-[#0d1117] cursor-pointer shrink-0 outline-none hover:text-white transition-colors',
  editBtn:   (active: boolean) => active
    ? 'px-4 py-3 min-h-[52px] text-sm font-bold text-white border-b-2 border-[#28a745] bg-[#28a745] cursor-pointer shrink-0'
    : 'px-4 py-3 min-h-[52px] text-sm font-bold text-[#6e7681] border-b-2 border-[#30363d] hover:text-white hover:border-[#6e7681] bg-transparent cursor-pointer transition-colors shrink-0',
  cardsRow:  'grid grid-flow-col grid-rows-[auto] tall:grid-rows-[auto_auto] xtall:grid-rows-[auto_auto_auto] [grid-auto-columns:220px] content-center overflow-x-auto overflow-y-hidden flex-1 min-h-0 gap-3 px-3 pt-3 pb-3 scrollbar-dark',
  editRow:   'grid grid-flow-col grid-rows-[auto] tall:grid-rows-[auto_auto] xtall:grid-rows-[auto_auto_auto] [grid-auto-columns:220px] content-center overflow-x-auto overflow-y-hidden flex-1 min-h-0 gap-3 px-3 pt-3 pb-3 scrollbar-dark',
  card:      'relative h-[210px] bg-[#0d1117] border border-[#30363d] rounded-lg overflow-hidden flex flex-col',
  cardHead:  'text-center py-[6px] px-3 border-b border-[#30363d] text-white text-base font-bold tracking-wide shrink-0',
  cardBody:  'bg-[#090c10] p-3 flex flex-col gap-2 flex-1 min-h-0',
  btnRow:    'flex gap-2',
  btn5:      'flex-1 min-h-[44px] border border-[#30363d] rounded-lg bg-[#161b22] text-white text-sm font-bold disabled:opacity-60',
  btnX:      'flex-1 min-h-[44px] border border-[#28a745] rounded-lg bg-[#28a745] text-white text-sm font-bold disabled:opacity-60',
  delBtn:    'w-8 h-8 shrink-0 rounded bg-[#f85149] hover:bg-[#da3633] border-0 text-white cursor-pointer flex items-center justify-center transition-colors',

  // Drag divider
  divider:    'hidden xl:flex w-[8px] shrink-0 cursor-col-resize touch-none items-center justify-center hover:bg-[#28a745]/10 select-none transition-colors',
  dividerBar: 'w-[2px] h-12 rounded-full bg-[#30363d]',

  // Quick Items panel
  panel:      'hidden xl:flex flex-col flex-1 border-l border-[#30363d] min-w-0',
  panelHead:  'flex items-center justify-between px-4 py-3 border-b border-[#30363d] shrink-0',
  panelTitle: 'text-white font-bold text-base',
  panelCount: 'text-[#6e7681] text-xs',
  panelList:  'flex-1 min-h-0 overflow-y-auto scrollbar-dark',
  emptyState: 'flex flex-col items-center justify-center h-full gap-2 text-[#6e7681] text-sm text-center px-6',
  itemRow:    'flex items-center gap-2 px-3 py-3 border-b border-[#30363d] group hover:bg-[#161b22] transition-colors',
  itemInfo:   'flex-1 min-w-0',
  itemName:   'text-white text-sm font-medium leading-snug truncate',
  itemDur:    'text-[#6e7681] text-xs mt-[2px]',
  itemBtn:    (green: boolean) =>
    `shrink-0 px-3 py-[6px] text-xs font-bold rounded border cursor-pointer disabled:opacity-60 ${
      green ? 'border-[#28a745] bg-[#28a745] text-white' : 'border-[#30363d] bg-[#0d1117] text-white'
    }`,
  itemDelBtn: 'shrink-0 bg-transparent border-0 cursor-pointer text-[#6e7681] hover:text-[#f85149] text-base leading-none px-1 opacity-0 group-hover:opacity-100 transition-opacity',
  addForm:    'shrink-0 border-t border-[#30363d] p-3 flex flex-col gap-[6px]',
  addLabel:   'text-[#6e7681] text-[10px] font-semibold uppercase tracking-widest mb-1',
  addInput:   'w-full bg-[#0d1117] border border-[#30363d] rounded px-3 py-[8px] text-white text-sm placeholder:text-[#484f58] outline-none focus:border-[#28a745]',
  addSelect:  'w-full bg-[#0d1117] border border-[#30363d] rounded px-3 py-[8px] text-white text-sm outline-none focus:border-[#28a745] cursor-pointer',
  addBtn:     'w-full py-2 border-0 rounded bg-[#28a745] text-white text-sm font-bold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed',
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

// ── Trash icon SVG ──────────────────────────────────────────────────────────
function TrashIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="3 6 5 6 21 6" />
      <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6" />
      <line x1="10" y1="11" x2="10" y2="17" />
      <line x1="14" y1="11" x2="14" y2="17" />
      <path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2" />
    </svg>
  )
}

// ── Sortable card — used in edit mode on the main page ──────────────────────
interface SortableCardProps {
  preset:   DisplayPreset
  template: LabelTemplate
  onDelete: (id: string) => void
}

function SortablePresetCard({ preset, template, onDelete }: SortableCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: preset.id })

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`relative w-[220px] h-[210px] bg-[#0d1117] border rounded-lg overflow-hidden flex flex-col cursor-grab active:cursor-grabbing select-none touch-none ${
        isDragging ? 'border-[#28a745] opacity-50 shadow-[0_0_0_2px_#28a745]' : 'border-[#30363d]'
      }`}
      {...attributes}
      {...listeners}
    >
      {/* Header row — label centred, trash button sits inside the bar */}
      <div className="flex items-center border-b border-[#30363d] shrink-0">
        <div className="w-8 shrink-0" />
        <div className="flex-1 text-center py-[6px] text-white text-base font-bold tracking-wide">
          {preset.label}
        </div>
        <button
          onClick={e => { e.stopPropagation(); onDelete(preset.id) }}
          onPointerDown={e => e.stopPropagation()}
          className={classes.delBtn}
          title="Remove preset"
        >
          <TrashIcon />
        </button>
      </div>
      <div className="bg-[#090c10] p-3 flex-1 min-h-0 overflow-hidden">
        <Label durationHrs={preset.hrs} type={template} />
      </div>
    </div>
  )
}

// ── Add Preset full-screen numpad page ──────────────────────────────────────
interface AddPresetPageProps {
  template: LabelTemplate
  onAdd:    (hrs: number) => void
  onClose:  () => void
}

const NUMPAD_KEYS = ['7','8','9','4','5','6','1','2','3','⌫','0','✓'] as const

function AddPresetPage({ template, onAdd, onClose }: AddPresetPageProps) {
  const [input, setInput] = useState('')
  const [unit,  setUnit]  = useState<'hours' | 'days'>('hours')

  const numValue = parseInt(input, 10) || 0
  const hrs      = unit === 'hours' ? numValue : numValue * 24
  const maxVal   = unit === 'hours' ? 720 : 365

  function pressDigit(d: string) {
    setInput(prev => {
      const candidate = prev + d
      const val = parseInt(candidate, 10)
      if (isNaN(val) || val > maxVal) return prev
      return String(val)   // strips any leading zeros
    })
  }

  function pressBack() {
    setInput(prev => prev.slice(0, -1))
  }

  function switchUnit(u: 'hours' | 'days') {
    setUnit(u)
    setInput('')
  }

  function handleConfirm() {
    if (hrs < 1) return
    onAdd(hrs)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-[300] bg-[#0d1117] flex flex-col">

      {/* Header */}
      <div className="flex items-center px-4 py-3 border-b border-[#30363d] shrink-0">
        <button
          onClick={onClose}
          className="px-3 py-1 text-sm font-bold text-[#6e7681] hover:text-white bg-transparent border border-[#30363d] hover:border-[#6e7681] rounded cursor-pointer transition-colors"
        >
          ← Cancel
        </button>
        <span className="flex-1 text-center text-white font-bold text-lg">New Preset</span>
        {/* Right spacer mirrors the Cancel button so title stays centred */}
        <div className="w-[72px]" />
      </div>

      {/* Body — vertically distributed */}
      <div className="flex-1 flex flex-col items-center justify-around px-6 py-4 max-w-sm mx-auto w-full min-h-0">

        {/* Hours / Days toggle */}
        <div className="flex gap-3 shrink-0">
          {(['hours', 'days'] as const).map(u => (
            <button
              key={u}
              onClick={() => switchUnit(u)}
              className={`px-8 py-2 rounded-full font-bold text-sm border transition-colors cursor-pointer ${
                unit === u
                  ? 'bg-[#28a745] border-[#28a745] text-white'
                  : 'bg-transparent border-[#30363d] text-[#6e7681] hover:border-[#6e7681] hover:text-white'
              }`}
            >
              {u.toUpperCase()}
            </button>
          ))}
        </div>

        {/* Value display + label preview */}
        <div className="flex flex-col items-center gap-2 shrink-0">
          <div className="text-6xl font-bold text-white tracking-tight min-h-[72px] flex items-center justify-center">
            {input ? input : <span className="text-[#484f58]">0</span>}
          </div>
          <div className="text-[#6e7681] text-sm">
            {unit} &nbsp;·&nbsp; max {maxVal}
          </div>
          {hrs > 0 && (
            <div className="mt-2">
              <Label durationHrs={hrs} type={template} />
            </div>
          )}
        </div>

        {/* 3×4 numpad */}
        <div className="grid grid-cols-3 gap-2 w-full shrink-0">
          {NUMPAD_KEYS.map(key => {
            if (key === '⌫') {
              return (
                <button
                  key="back"
                  onClick={pressBack}
                  disabled={input.length === 0}
                  className="h-16 rounded-xl bg-[#161b22] border border-[#30363d] text-white text-xl hover:bg-[#21262d] hover:border-[#6e7681] transition-colors disabled:opacity-30 cursor-pointer flex items-center justify-center"
                >⌫</button>
              )
            }
            if (key === '✓') {
              return (
                <button
                  key="confirm"
                  onClick={handleConfirm}
                  disabled={hrs < 1}
                  className="h-16 rounded-xl bg-[#28a745] border-0 text-white text-lg font-bold hover:bg-[#2ea043] active:bg-[#238636] transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                >✓ Add</button>
              )
            }
            return (
              <button
                key={key}
                onClick={() => pressDigit(key)}
                className="h-16 rounded-xl bg-[#161b22] border border-[#30363d] text-white text-2xl font-bold hover:bg-[#21262d] hover:border-[#6e7681] active:bg-[#28a745]/20 transition-colors cursor-pointer"
              >{key}</button>
            )
          })}
        </div>

      </div>
    </div>
  )
}

// ── Print quantity numpad page ──────────────────────────────────────────────
interface PrintQtyPageProps {
  durationHrs: number
  label:       string
  template:    LabelTemplate
  onPrint:     (qty: number) => void
  onClose:     () => void
}

function PrintQtyPage({ durationHrs, label, template, onPrint, onClose }: PrintQtyPageProps) {
  const [input, setInput] = useState('')

  const qty = parseInt(input, 10) || 0

  function pressDigit(d: string) {
    setInput(prev => {
      const candidate = prev + d
      const val = parseInt(candidate, 10)
      if (isNaN(val) || val > 500) return prev
      return String(val)
    })
  }

  function pressBack() {
    setInput(prev => prev.slice(0, -1))
  }

  function handleConfirm() {
    if (qty < 1) return
    onPrint(qty)
  }

  return (
    <div className="fixed inset-0 z-[300] bg-[#0d1117] flex flex-col">
      <div className="flex items-center px-4 py-3 border-b border-[#30363d] shrink-0">
        <button
          onClick={onClose}
          className="px-3 py-1 text-sm font-bold text-[#6e7681] hover:text-white bg-transparent border border-[#30363d] hover:border-[#6e7681] rounded cursor-pointer transition-colors"
        >← Cancel</button>
        <span className="flex-1 text-center text-white font-bold text-lg">Print {label}</span>
        <div className="w-[72px]" />
      </div>

      <div className="flex-1 flex flex-col items-center justify-around px-6 py-4 max-w-sm mx-auto w-full min-h-0">

        {/* Label preview */}
        <div className="shrink-0">
          <Label durationHrs={durationHrs} type={template} />
        </div>

        {/* Quantity display */}
        <div className="flex flex-col items-center gap-2 shrink-0">
          <div className="text-[#6e7681] text-sm font-medium">How many labels?</div>
          <div className="text-6xl font-bold text-white tracking-tight min-h-[72px] flex items-center justify-center">
            {input ? input : <span className="text-[#484f58]">0</span>}
          </div>
          <div className="text-[#6e7681] text-sm">max 500</div>
        </div>

        {/* Numpad */}
        <div className="grid grid-cols-3 gap-2 w-full shrink-0">
          {NUMPAD_KEYS.map(key => {
            if (key === '⌫') {
              return (
                <button key="back" onClick={pressBack} disabled={input.length === 0}
                  className="h-16 rounded-xl bg-[#161b22] border border-[#30363d] text-white text-xl hover:bg-[#21262d] hover:border-[#6e7681] transition-colors disabled:opacity-30 cursor-pointer flex items-center justify-center"
                >⌫</button>
              )
            }
            if (key === '✓') {
              return (
                <button key="confirm" onClick={handleConfirm} disabled={qty < 1}
                  className="h-16 rounded-xl bg-[#28a745] border-0 text-white text-lg font-bold hover:bg-[#2ea043] active:bg-[#238636] transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                >✓ Print</button>
              )
            }
            return (
              <button key={key} onClick={() => pressDigit(key)}
                className="h-16 rounded-xl bg-[#161b22] border border-[#30363d] text-white text-2xl font-bold hover:bg-[#21262d] hover:border-[#6e7681] active:bg-[#28a745]/20 transition-colors cursor-pointer"
              >{key}</button>
            )
          })}
        </div>

      </div>
    </div>
  )
}

// ── Main page ───────────────────────────────────────────────────────────────
export default function Preppy() {
  const [template,      setTemplate]      = useState<LabelTemplate>('IX')
  const [status,        setStatus]        = useState<{ ok: boolean; msg: string } | null>(null)
  const [printing,      setPrinting]      = useState(false)
  const [customPresets, setCustomPresets] = useState<CustomPreset[]>(() => loadStored(PRESETS_KEY))
  const [presetOrder,   setPresetOrder]   = useState<string[]>(() => loadStored(PRESET_ORDER_KEY))
  const [hiddenPresets, setHiddenPresets] = useState<string[]>(() => loadStored(HIDDEN_PRESETS_KEY))
  const [editMode,       setEditMode]       = useState(false)
  const [dndKey,         setDndKey]         = useState(0)
  const [showAddPreset,  setShowAddPreset]  = useState(false)
  const [editSort,       setEditSort]       = useState('')
  const [popularityMap,  setPopularityMap]  = useState<Map<number, number>>(new Map())
  const [printQtyTarget, setPrintQtyTarget] = useState<{ durationHrs: number; label: string } | null>(null)
  const [leftWidth,     setLeftWidth]     = useState(() => {
    const saved = parseInt(localStorage.getItem(WIDTH_KEY) ?? '800', 10)
    return isNaN(saved) ? 800 : Math.max(440, Math.min(saved, 1600))
  })
  const [isLargeScreen, setIsLargeScreen] = useState(() => window.innerWidth >= 1280)
  const divDragRef = useRef<{ startX: number; startW: number } | null>(null)
  const errorMsg   = useErrorMsg()

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  )

  useEffect(() => {
    const handler = () => setIsLargeScreen(window.innerWidth >= 1280)
    window.addEventListener('resize', handler)
    return () => window.removeEventListener('resize', handler)
  }, [])

  useEffect(() => {
    if (!editMode) return
    window.electronAPI.getPopularityMap().then(counts => {
      setPopularityMap(new Map(counts.map(c => [c.duration_hrs, c.total_qty])))
    }).catch(() => {})
  }, [editMode])

  // Merge defaults + custom presets, apply custom order and hidden filter
  const allPresets = useMemo<DisplayPreset[]>(() => {
    const hiddenSet  = new Set(hiddenPresets)
    const defaultHrs = new Set(DEFAULT_PRESETS.map(p => p.hrs))

    const defaults: DisplayPreset[] = DEFAULT_PRESETS
      .filter(p => !hiddenSet.has(`d-${p.hrs}`))
      .map(p => ({ id: `d-${p.hrs}`, label: p.label, hrs: p.hrs, isDefault: true }))

    const customs: DisplayPreset[] = customPresets
      .filter(p => !hiddenSet.has(p.id) && !defaultHrs.has(p.hrs))
      .map(p => ({ id: p.id, label: p.label, hrs: p.hrs, isDefault: false }))

    const all = [...defaults, ...customs]

    if (presetOrder.length === 0) {
      return all.sort((a, b) => a.hrs - b.hrs)
    }

    const orderMap = new Map(presetOrder.map((id, i) => [id, i]))
    return all.sort((a, b) => {
      const ai = orderMap.get(a.id) ?? Infinity
      const bi = orderMap.get(b.id) ?? Infinity
      if (ai === Infinity && bi === Infinity) return a.hrs - b.hrs
      return ai - bi
    })
  }, [customPresets, hiddenPresets, presetOrder])

  // Duration options for QuickItemsPanel
  const allDurations = useMemo(() => {
    const defaultHrs = new Set(DEFAULT_DURATIONS.map(o => o.hrs))
    const extra = customPresets
      .filter(p => !defaultHrs.has(p.hrs))
      .map(p => ({ label: p.label.toLowerCase(), hrs: p.hrs }))
    return [...DEFAULT_DURATIONS, ...extra].sort((a, b) => a.hrs - b.hrs)
  }, [customPresets])

  // ── Drag divider (xl+ panel resize) ──────────────────────────────────────
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

  // ── Preset management ─────────────────────────────────────────────────────
  function addCustomPreset(hrs: number) {
    if (hrs < 1) return
    const id    = `${Date.now()}-${Math.random().toString(36).slice(2)}`
    const label = autoLabel(hrs)
    const next  = [...customPresets, { id, label, hrs }]
    setCustomPresets(next)
    persist(PRESETS_KEY, next)
    if (presetOrder.length > 0) {
      const nextOrder = [...presetOrder, id]
      setPresetOrder(nextOrder)
      persist(PRESET_ORDER_KEY, nextOrder)
    }
  }

  function deletePreset(id: string) {
    if (id.startsWith('d-')) {
      const next = [...hiddenPresets, id]
      setHiddenPresets(next)
      persist(HIDDEN_PRESETS_KEY, next)
    } else {
      const next = customPresets.filter(p => p.id !== id)
      setCustomPresets(next)
      persist(PRESETS_KEY, next)
    }
    if (presetOrder.length > 0) {
      const nextOrder = presetOrder.filter(k => k !== id)
      setPresetOrder(nextOrder)
      persist(PRESET_ORDER_KEY, nextOrder)
    }
    // bump key so DndContext remounts with clean transform state
    setDndKey(k => k + 1)
  }

  function reorderPresets(ids: string[]) {
    setPresetOrder(ids)
    persist(PRESET_ORDER_KEY, ids)
  }

  function restoreDefaults() {
    const restoredIds = DEFAULT_PRESETS
      .filter(p => hiddenPresets.includes(`d-${p.hrs}`))
      .map(p => `d-${p.hrs}`)
    if (restoredIds.length === 0) return

    const nextHidden = hiddenPresets.filter(id => !restoredIds.includes(id))
    setHiddenPresets(nextHidden)
    persist(HIDDEN_PRESETS_KEY, nextHidden)

    // Restored defaults go to the front; existing visible presets keep their relative order
    const existingOrder = presetOrder.length > 0 ? presetOrder : allPresets.map(p => p.id)
    const nextOrder = [...restoredIds, ...existingOrder.filter(id => !restoredIds.includes(id))]
    setPresetOrder(nextOrder)
    persist(PRESET_ORDER_KEY, nextOrder)
  }

  function handleSort(sort: string) {
    if (!sort) return
    const sorted = [...allPresets]
    if (sort === 'asc')     sorted.sort((a, b) => a.hrs - b.hrs)
    if (sort === 'desc')    sorted.sort((a, b) => b.hrs - a.hrs)
    if (sort === 'popular') sorted.sort((a, b) => (popularityMap.get(b.hrs) ?? 0) - (popularityMap.get(a.hrs) ?? 0))
    reorderPresets(sorted.map(p => p.id))
    setEditSort('')
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = allPresets.findIndex(p => p.id === String(active.id))
    const newIndex = allPresets.findIndex(p => p.id === String(over.id))
    if (oldIndex === -1 || newIndex === -1) return
    reorderPresets(arrayMove(allPresets, oldIndex, newIndex).map(p => p.id))
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
    setPrintQtyTarget({ durationHrs, label: presetLabel })
  }

  return (
    <PageLayout title="Print Labels" noPad>
      <div className={classes.page}>

        {/* ── Left: template selector + preset cards ── */}
        <div
          className={classes.leftCol}
          style={isLargeScreen
            ? editMode
              ? { flexGrow: 1, flexShrink: 1, width: '100%' }
              : { width: leftWidth, flexShrink: 0, flexGrow: 0 }
            : undefined}
        >
          {status && (
            <div className={classes.alertWrap}>
              <AutoDismissAlert
                variant={status.ok ? 'success' : 'danger'}
                msg={status.msg}
                onDismiss={() => setStatus(null)}
              />
            </div>
          )}

          {/* IX / OX / UX tabs + optional "+ New" + Edit/Done */}
          <div className={classes.selector}>
            {TEMPLATES.map((id) => (
              <button
                key={id}
                onClick={() => setTemplate(id)}
                disabled={printing || editMode}
                className={classes.tmplBtn(template === id)}
              >
                {id}
              </button>
            ))}
            {editMode && (
              <button
                onClick={restoreDefaults}
                className="px-3 py-3 min-h-[52px] text-sm font-bold text-[#6e7681] border-b-2 border-[#30363d] hover:text-white hover:border-[#6e7681] bg-transparent cursor-pointer shrink-0 transition-colors"
              >
                ↩ Restore
              </button>
            )}
            {editMode && (
              <select
                value={editSort}
                onChange={e => handleSort(e.target.value)}
                className={classes.sortSelect}
              >
                <option value="">Sort…</option>
                <option value="asc">Time ↑</option>
                <option value="desc">Time ↓</option>
                <option value="popular">Popular</option>
              </select>
            )}
            {editMode && (
              <button
                onClick={() => setShowAddPreset(true)}
                className={classes.newBtn}
              >
                + New
              </button>
            )}
            <button
              onClick={() => setEditMode(m => !m)}
              className={classes.editBtn(editMode)}
            >
              {editMode ? 'Done' : 'Edit'}
            </button>
          </div>

          {/* Preset cards — normal view or edit/drag view */}
          {editMode ? (
            <div className={classes.editRow}>
              <DndContext
                key={dndKey}
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext items={allPresets.map(p => p.id)} strategy={rectSortingStrategy}>
                  {allPresets.map(preset => (
                    <SortablePresetCard
                      key={preset.id}
                      preset={preset}
                      template={template}
                      onDelete={deletePreset}
                    />
                  ))}
                </SortableContext>
              </DndContext>
            </div>
          ) : (
            <div className={classes.cardsRow}>
              {allPresets.map(({ id, label, hrs }) => (
                <div key={id} className={classes.card}>
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
            </div>
          )}
        </div>

        {/* ── Drag divider + Quick Items panel (hidden in edit mode) ── */}
        {!editMode && (
          <>
            <div
              className={classes.divider}
              onPointerDown={onDividerPointerDown}
              onPointerMove={onDividerPointerMove}
              onPointerUp={onDividerPointerUp}
            >
              <div className={classes.dividerBar} />
            </div>

            <QuickItemsPanel
              onPrint={handlePrint}
              printing={printing}
              durationOptions={allDurations}
            />
          </>
        )}

      </div>

      {/* ── Print quantity numpad page ── */}
      {printQtyTarget && (
        <PrintQtyPage
          durationHrs={printQtyTarget.durationHrs}
          label={printQtyTarget.label}
          template={template}
          onPrint={qty => { void handlePrint(printQtyTarget.durationHrs, qty); setPrintQtyTarget(null) }}
          onClose={() => setPrintQtyTarget(null)}
        />
      )}

      {/* ── Add Preset numpad page (full-screen overlay) ── */}
      {showAddPreset && (
        <AddPresetPage
          template={template}
          onAdd={addCustomPreset}
          onClose={() => setShowAddPreset(false)}
        />
      )}
    </PageLayout>
  )
}
