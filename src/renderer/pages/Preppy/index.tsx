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
import Label from '../../components/Label'
import { useErrorMsg } from '../../hooks/useErrorMsg'

type LabelTemplate = 'IX' | 'OX' | 'UX'

// ── Quick list types ─────────────────────────────────────────────────────────
interface BundleEntry {
  hrs: number
  qty: number
}

interface QuickSingleItem {
  id: string
  name: string
  type: 'item'
  hrs: number
}

interface QuickBundleItem {
  id: string
  name: string
  type: 'bundle'
  entries: BundleEntry[]
}

type QuickListEntry = QuickSingleItem | QuickBundleItem

interface PrintJob {
  template: string
  duration_hrs: number
  qty: number
  printed_at: string
  success: number
}
// ────────────────────────────────────────────────────────────────────────────

interface CustomPreset {
  id: string
  label: string
  hrs: number
}

interface DisplayPreset {
  id: string
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

const ITEMS_KEY           = 'preppy-quick-items'
const PRESETS_KEY         = 'preppy-custom-presets'
const WIDTH_KEY           = 'preppy-left-width'
const PRESET_ORDER_KEY    = 'preppy-preset-order'
const HIDDEN_PRESETS_KEY  = 'preppy-hidden-presets'
const PANEL_COLLAPSED_KEY = 'preppy-panel-collapsed'

function loadStored<T>(key: string): T[] {
  try { return JSON.parse(localStorage.getItem(key) ?? '[]') }
  catch { return [] }
}
function persist(key: string, value: unknown) {
  localStorage.setItem(key, JSON.stringify(value))
}

function loadItems(): QuickListEntry[] {
  try {
    const raw = JSON.parse(localStorage.getItem(ITEMS_KEY) ?? '[]') as Array<{
      id: string; name: string; type?: string; hrs?: number; entries?: BundleEntry[]
    }>
    return raw.map(item => {
      if (item.type === 'bundle' && Array.isArray(item.entries)) {
        return { id: item.id, name: item.name, type: 'bundle' as const, entries: item.entries }
      }
      return { id: item.id, name: item.name, type: 'item' as const, hrs: item.hrs ?? 4 }
    })
  } catch { return [] }
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

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const min = Math.floor(diff / 60000)
  if (min < 1) return 'just now'
  if (min < 60) return `${min}m ago`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr}h ago`
  return `${Math.floor(hr / 24)}d ago`
}

// ── Tailwind class map ──────────────────────────────────────────────────────
const classes = {
  page:      'flex h-full bg-[#0d1117]',
  leftCol:   'relative flex flex-col flex-1 xl:flex-none min-w-0',
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
  panel:      'hidden xl:flex flex-col flex-1 border-l border-[#30363d] min-w-0 bg-[#0d1117]',
  panelHead:  'flex items-center justify-between px-4 py-[10px] border-b border-[#30363d] shrink-0',
  panelTitle: 'text-white font-bold text-sm',
  panelCount: 'text-[#6e7681] text-xs',

  // Panel collapse strip (shown when panel is collapsed)
  collapseStrip: 'hidden xl:flex flex-col w-9 shrink-0 border-l border-[#30363d] items-center justify-start pt-3 bg-[#0d1117] cursor-pointer hover:bg-[#161b22] transition-colors select-none',

  // Panel tabs
  panelTabBar: 'flex border-b border-[#30363d] shrink-0',
  panelTab:    (active: boolean) => active
    ? 'flex-1 py-[9px] text-xs font-bold text-white border-b-2 border-[#28a745] bg-transparent cursor-pointer transition-colors'
    : 'flex-1 py-[9px] text-xs font-bold text-[#6e7681] border-b-2 border-transparent bg-transparent cursor-pointer hover:text-[#adbac7] transition-colors',

  panelList:  'flex-1 min-h-0 overflow-y-auto scrollbar-dark',
  emptyState: 'flex flex-col items-center justify-center h-full gap-2 text-[#6e7681] text-sm text-center px-6',

  // Item rows
  itemRow:    'flex items-center gap-2 px-3 py-[10px] border-b border-[#30363d] group hover:bg-[#161b22] transition-colors',
  itemInfo:   'flex-1 min-w-0',
  itemName:   'text-white text-sm font-medium leading-snug truncate',
  itemDur:    'text-[#6e7681] text-xs mt-[2px]',
  itemBtn:    (green: boolean) =>
    `shrink-0 px-3 py-[6px] text-xs font-bold rounded border cursor-pointer disabled:opacity-60 ${
      green ? 'border-[#28a745] bg-[#28a745] text-white' : 'border-[#30363d] bg-[#0d1117] text-white'
    }`,
  itemDelBtn: 'shrink-0 bg-transparent border-0 cursor-pointer text-[#6e7681] hover:text-[#f85149] text-base leading-none px-1 opacity-0 group-hover:opacity-100 transition-opacity',

  // Bundle badge
  bundleBadge: 'inline-block shrink-0 px-[5px] py-[1px] rounded text-[9px] font-bold text-[#8b949e] bg-[#21262d] border border-[#30363d] mr-[5px]',

  // Recent tab
  recentRow:    'flex items-center gap-3 px-3 py-[10px] border-b border-[#30363d] group hover:bg-[#161b22] transition-colors',
  recentBadge:  'shrink-0 w-8 h-8 rounded bg-[#21262d] border border-[#30363d] text-white text-[10px] font-bold flex items-center justify-center',
  recentInfo:   'flex-1 min-w-0',
  recentMain:   'text-white text-sm font-medium',
  recentSub:    'text-[#6e7681] text-xs mt-[1px]',
  recentBtn:    'shrink-0 px-2 py-1 text-xs font-bold rounded border border-[#30363d] bg-[#0d1117] text-[#adbac7] cursor-pointer hover:border-[#6e7681] hover:text-white transition-colors disabled:opacity-50 opacity-0 group-hover:opacity-100',

  // Add form
  addForm:     'shrink-0 border-t border-[#30363d] p-3 flex flex-col gap-[6px]',
  addLabel:    'text-[#6e7681] text-[10px] font-semibold uppercase tracking-widest mb-1',
  addInput:    'w-full bg-[#0d1117] border border-[#30363d] rounded px-3 py-[8px] text-white text-sm placeholder:text-[#484f58] outline-none focus:border-[#28a745]',
  addSelect:   'w-full bg-[#0d1117] border border-[#30363d] rounded px-3 py-[8px] text-white text-sm outline-none focus:border-[#28a745] cursor-pointer',
  addBtn:      'flex-1 py-2 border-0 rounded bg-[#28a745] text-white text-sm font-bold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed',
  addBundleBtn:'shrink-0 py-2 px-3 border border-[#30363d] rounded text-[#6e7681] text-sm font-bold cursor-pointer hover:border-[#6e7681] hover:text-white transition-colors whitespace-nowrap',
}
// ───────────────────────────────────────────────────────────────────────────

// ── Add Bundle full-screen page ─────────────────────────────────────────────
interface AddBundlePageProps {
  durationOptions: { label: string; hrs: number }[]
  onAdd:   (name: string, entries: BundleEntry[]) => void
  onClose: () => void
}

function AddBundlePage({ durationOptions, onAdd, onClose }: AddBundlePageProps) {
  const [name,       setName]       = useState('')
  const [entries,    setEntries]    = useState<BundleEntry[]>([])
  const [pendingHrs, setPendingHrs] = useState(durationOptions[2]?.hrs ?? 4)
  const [pendingQty, setPendingQty] = useState(1)

  function addEntry() {
    setEntries(prev => [...prev, { hrs: pendingHrs, qty: pendingQty }])
    setPendingQty(1)
  }

  function removeEntry(i: number) {
    setEntries(prev => prev.filter((_, idx) => idx !== i))
  }

  function updateQty(i: number, qty: number) {
    setEntries(prev => prev.map((e, idx) => idx === i ? { ...e, qty } : e))
  }

  function handleSave() {
    if (!name.trim() || entries.length === 0) return
    onAdd(name.trim(), entries)
    onClose()
  }

  const totalLabels = entries.reduce((s, e) => s + e.qty, 0)

  return (
    <div className="fixed inset-0 z-[300] bg-[#0d1117] flex flex-col">
      {/* Header */}
      <div className="flex items-center px-4 py-3 border-b border-[#30363d] shrink-0">
        <button
          onClick={onClose}
          className="px-3 py-1 text-sm font-bold text-[#6e7681] hover:text-white bg-transparent border border-[#30363d] hover:border-[#6e7681] rounded cursor-pointer transition-colors"
        >← Cancel</button>
        <span className="flex-1 text-center text-white font-bold text-lg">New Bundle</span>
        <button
          onClick={handleSave}
          disabled={!name.trim() || entries.length === 0}
          className="px-4 py-1 text-sm font-bold text-white bg-[#28a745] border-0 rounded cursor-pointer hover:bg-[#2ea043] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >Save</button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="px-4 py-5 flex flex-col gap-5 max-w-lg mx-auto w-full">

          {/* Bundle name */}
          <div>
            <div className="text-[#6e7681] text-[10px] font-semibold uppercase tracking-widest mb-2">Bundle Name</div>
            <input
              autoFocus
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="e.g. Chicken Prep"
              className="w-full bg-[#161b22] border border-[#30363d] rounded-lg px-4 py-3 text-white text-base placeholder:text-[#484f58] outline-none focus:border-[#28a745]"
            />
          </div>

          {/* Current entries */}
          {entries.length > 0 && (
            <div>
              <div className="text-[#6e7681] text-[10px] font-semibold uppercase tracking-widest mb-2">
                Labels in this bundle
                <span className="ml-2 text-[#484f58] normal-case font-normal">{totalLabels} per print</span>
              </div>
              <div className="flex flex-col gap-2">
                {entries.map((entry, i) => (
                  <div key={i} className="flex items-center gap-3 bg-[#161b22] border border-[#30363d] rounded-lg px-4 py-3">
                    <span className="flex-1 text-white font-medium text-sm">{fmtDuration(entry.hrs)}</span>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => updateQty(i, Math.max(1, entry.qty - 1))}
                        className="w-8 h-8 rounded bg-[#21262d] border border-[#30363d] text-white font-bold cursor-pointer hover:border-[#6e7681] transition-colors flex items-center justify-center"
                      >−</button>
                      <span className="text-white text-sm font-mono w-6 text-center tabular-nums">{entry.qty}</span>
                      <button
                        onClick={() => updateQty(i, Math.min(99, entry.qty + 1))}
                        className="w-8 h-8 rounded bg-[#21262d] border border-[#30363d] text-white font-bold cursor-pointer hover:border-[#6e7681] transition-colors flex items-center justify-center"
                      >+</button>
                    </div>
                    <button
                      onClick={() => removeEntry(i)}
                      className="w-8 h-8 rounded text-[#6e7681] hover:text-[#f85149] cursor-pointer bg-transparent border-0 text-base flex items-center justify-center transition-colors"
                    >✕</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Add entry form */}
          <div>
            <div className="text-[#6e7681] text-[10px] font-semibold uppercase tracking-widest mb-2">
              {entries.length === 0 ? 'Add First Label' : 'Add Another Label'}
            </div>
            <div className="bg-[#161b22] border border-[#30363d] rounded-lg p-3 flex flex-col gap-2">
              <select
                value={pendingHrs}
                onChange={e => setPendingHrs(Number(e.target.value))}
                className="w-full bg-[#0d1117] border border-[#30363d] rounded px-3 py-2 text-white text-sm outline-none focus:border-[#28a745] cursor-pointer"
              >
                {durationOptions.map(o => (
                  <option key={o.hrs} value={o.hrs}>{o.label}</option>
                ))}
              </select>
              <div className="flex items-center gap-3">
                <span className="text-[#6e7681] text-xs">Qty</span>
                <button
                  onClick={() => setPendingQty(q => Math.max(1, q - 1))}
                  className="w-8 h-8 rounded bg-[#21262d] border border-[#30363d] text-white font-bold cursor-pointer hover:border-[#6e7681] transition-colors flex items-center justify-center"
                >−</button>
                <span className="text-white text-sm font-mono w-6 text-center tabular-nums">{pendingQty}</span>
                <button
                  onClick={() => setPendingQty(q => Math.min(99, q + 1))}
                  className="w-8 h-8 rounded bg-[#21262d] border border-[#30363d] text-white font-bold cursor-pointer hover:border-[#6e7681] transition-colors flex items-center justify-center"
                >+</button>
                <button
                  onClick={addEntry}
                  className="ml-auto px-5 py-[6px] rounded bg-[#28a745] border-0 text-white text-sm font-bold cursor-pointer hover:bg-[#2ea043] transition-colors"
                >+ Add</button>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}

// ── Quick Items panel ────────────────────────────────────────────────────────
interface PanelProps {
  onPrint:         (hrs: number, qty: number) => void
  onPrintBundle:   (entries: BundleEntry[], multiplier: number) => void
  durationOptions: { label: string; hrs: number }[]
  collapsed:       boolean
  onToggleCollapse:() => void
}

function QuickItemsPanel({ onPrint, onPrintBundle, durationOptions, collapsed, onToggleCollapse }: PanelProps) {
  const [items,         setItems]         = useState<QuickListEntry[]>(() => loadItems())
  const [name,          setName]          = useState('')
  const [hrs,           setHrs]           = useState(durationOptions[2]?.hrs ?? 4)
  const [tab,           setTab]           = useState<'items' | 'recent'>('items')
  const [recentJobs,    setRecentJobs]    = useState<PrintJob[]>([])
  const [recentLoading, setRecentLoading] = useState(false)
  const [showAddBundle, setShowAddBundle] = useState(false)

  useEffect(() => {
    setHrs(prev => durationOptions.some(o => o.hrs === prev) ? prev : (durationOptions[0]?.hrs ?? 4))
  }, [durationOptions])

  useEffect(() => {
    if (tab !== 'recent') return
    setRecentLoading(true)
    window.electronAPI.getPrintHistory(30)
      .then(jobs => setRecentJobs((jobs as unknown as PrintJob[]).filter(j => j.success === 1)))
      .catch(() => {})
      .finally(() => setRecentLoading(false))
  }, [tab])

  function addItem() {
    if (!name.trim()) return
    const id   = `${Date.now()}-${Math.random().toString(36).slice(2)}`
    const next: QuickListEntry[] = [...items, { id, name: name.trim(), type: 'item', hrs }]
    setItems(next)
    persist(ITEMS_KEY, next)
    setName('')
  }

  function addBundle(bundleName: string, entries: BundleEntry[]) {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2)}`
    const next: QuickListEntry[] = [...items, { id, name: bundleName, type: 'bundle', entries }]
    setItems(next)
    persist(ITEMS_KEY, next)
  }

  function removeItem(id: string) {
    const next = items.filter(i => i.id !== id)
    setItems(next)
    persist(ITEMS_KEY, next)
  }

  // Collapsed: render a narrow strip with an expand button
  if (collapsed) {
    return (
      <div
        className={classes.collapseStrip}
        onClick={onToggleCollapse}
        title="Expand Quick Items"
      >
        <span className="text-[#6e7681] text-[18px] leading-none select-none">›</span>
      </div>
    )
  }

  return (
    <>
      <div className={classes.panel}>
        {/* Header */}
        <div className={classes.panelHead}>
          <span className={classes.panelTitle}>Quick Items</span>
          <div className="flex items-center gap-2">
            <span className={classes.panelCount}>
              {items.length} item{items.length !== 1 ? 's' : ''}
            </span>
            <button
              onClick={onToggleCollapse}
              title="Collapse panel"
              className="w-7 h-7 flex items-center justify-center rounded text-[#6e7681] hover:text-white hover:bg-[#21262d] cursor-pointer bg-transparent border-0 transition-colors text-[16px] leading-none"
            >‹</button>
          </div>
        </div>

        {/* Tabs */}
        <div className={classes.panelTabBar}>
          <button className={classes.panelTab(tab === 'items')}  onClick={() => setTab('items')}>Items</button>
          <button className={classes.panelTab(tab === 'recent')} onClick={() => setTab('recent')}>Recent</button>
        </div>

        {/* ── Items tab ── */}
        {tab === 'items' && (
          <>
            <div className={classes.panelList}>
              {items.length === 0 ? (
                <div className={classes.emptyState}>
                  <span className="text-white font-medium">No items yet</span>
                  <span>Add commonly prepped items below to print their labels in one tap</span>
                </div>
              ) : (
                items.map(item => {
                  if (item.type === 'bundle') {
                    const total   = item.entries.reduce((s, e) => s + e.qty, 0)
                    const summary = item.entries.map(e => fmtDuration(e.hrs)).join(' + ')
                    return (
                      <div key={item.id} className={classes.itemRow}>
                        <div className={classes.itemInfo}>
                          <div className="flex items-center">
                            <span className={classes.bundleBadge}>BUNDLE</span>
                            <span className={`${classes.itemName} flex-1`}>{item.name}</span>
                          </div>
                          <div className={classes.itemDur}>{total} label{total !== 1 ? 's' : ''} · {summary}</div>
                        </div>
                        <button onClick={() => onPrintBundle(item.entries, 1)} className={classes.itemBtn(false)}>×1</button>
                        <button onClick={() => onPrintBundle(item.entries, 5)} className={classes.itemBtn(true)}>×5</button>
                        <button onClick={() => removeItem(item.id)} className={classes.itemDelBtn} title="Remove">✕</button>
                      </div>
                    )
                  }
                  return (
                    <div key={item.id} className={classes.itemRow}>
                      <div className={classes.itemInfo}>
                        <div className={classes.itemName}>{item.name}</div>
                        <div className={classes.itemDur}>{fmtDuration(item.hrs)}</div>
                      </div>
                      <button onClick={() => onPrint(item.hrs, 1)} className={classes.itemBtn(false)}>×1</button>
                      <button onClick={() => onPrint(item.hrs, 5)} className={classes.itemBtn(true)}>×5</button>
                      <button onClick={() => removeItem(item.id)} className={classes.itemDelBtn} title="Remove">✕</button>
                    </div>
                  )
                })
              )}
            </div>

            {/* Add form */}
            <div className={classes.addForm}>
              <div className={classes.addLabel}>Add to Quick List</div>
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
              <div className="flex gap-2">
                <button onClick={addItem} disabled={!name.trim()} className={classes.addBtn}>
                  + Add Item
                </button>
                <button onClick={() => setShowAddBundle(true)} className={classes.addBundleBtn}>
                  + Bundle
                </button>
              </div>
            </div>
          </>
        )}

        {/* ── Recent tab ── */}
        {tab === 'recent' && (
          <div className={classes.panelList}>
            {recentLoading ? (
              <div className="flex items-center justify-center h-full text-[#6e7681] text-sm">Loading…</div>
            ) : recentJobs.length === 0 ? (
              <div className={classes.emptyState}>
                <span className="text-white font-medium">No print history</span>
                <span>Successful print jobs will appear here</span>
              </div>
            ) : (
              recentJobs.map((job, i) => (
                <div key={i} className={classes.recentRow}>
                  <div className={classes.recentBadge}>{job.template}</div>
                  <div className={classes.recentInfo}>
                    <div className={classes.recentMain}>{fmtDuration(job.duration_hrs)} · ×{job.qty}</div>
                    <div className={classes.recentSub}>{timeAgo(job.printed_at)}</div>
                  </div>
                  <button
                    onClick={() => onPrint(job.duration_hrs, job.qty)}
                    className={classes.recentBtn}
                  >Reprint</button>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {showAddBundle && (
        <AddBundlePage
          durationOptions={durationOptions}
          onAdd={addBundle}
          onClose={() => setShowAddBundle(false)}
        />
      )}
    </>
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
      return String(val)
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
      <div className="flex items-center px-4 py-3 border-b border-[#30363d] shrink-0">
        <button
          onClick={onClose}
          className="px-3 py-1 text-sm font-bold text-[#6e7681] hover:text-white bg-transparent border border-[#30363d] hover:border-[#6e7681] rounded cursor-pointer transition-colors"
        >
          ← Cancel
        </button>
        <span className="flex-1 text-center text-white font-bold text-lg">New Preset</span>
        <div className="w-[72px]" />
      </div>

      <div className="flex-1 flex flex-col items-center justify-around px-6 py-4 max-w-sm mx-auto w-full min-h-0">

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

        <div className="shrink-0">
          <Label durationHrs={durationHrs} type={template} />
        </div>

        <div className="flex flex-col items-center gap-2 shrink-0">
          <div className="text-[#6e7681] text-sm font-medium">How many labels?</div>
          <div className="text-6xl font-bold text-white tracking-tight min-h-[72px] flex items-center justify-center">
            {input ? input : <span className="text-[#484f58]">0</span>}
          </div>
          <div className="text-[#6e7681] text-sm">max 500</div>
        </div>

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

// ── Print toast (bottom overlay) ────────────────────────────────────────────
interface ToastState {
  id:        string
  qty:       number
  done:      number
  state:     'printing' | 'success' | 'error'
  label?:    string
  errorMsg?: string
  removing?: boolean
}

function PrintToast({ qty, done, state, label, errorMsg, removing, onDismiss }: Omit<ToastState, 'id'> & { onDismiss: () => void }) {
  const fade   = removing ? 'opacity-0 translate-y-2' : 'opacity-100 translate-y-0'
  const pct    = qty > 0 ? Math.round((done / qty) * 100) : 0
  const isDone = state === 'success'

  // Outer shell — transitions background and border color smoothly between states
  const shellBg = state === 'error'   ? 'bg-[#3d1a1a] border-[#f85149]'
                : state === 'success' ? 'bg-[#1a4731] border-[#2ea043]'
                :                       'bg-[#161b22] border-[#30363d]'
  const shell = `pointer-events-auto w-[230px] border rounded-xl px-3 py-[10px] shadow-[0_8px_28px_rgba(0,0,0,0.55)] animate-slide-up transition-[opacity,transform,background-color,border-color] duration-300 ${shellBg} ${fade}`

  if (state === 'error') return (
    <div className={shell}>
      <div className="flex items-center gap-2">
        <span className="text-[#f85149]">✗</span>
        <span className="text-[#ff7b72] text-xs flex-1 truncate">{errorMsg ?? 'Print failed'}</span>
        <button onClick={onDismiss} className="shrink-0 text-[#f85149]/60 hover:text-[#f85149] text-lg leading-none cursor-pointer bg-transparent border-0">×</button>
      </div>
    </div>
  )

  // Printing and success share the same two-row DOM structure — no layout jump on transition
  return (
    <div className={shell} onClick={isDone ? onDismiss : undefined} style={{ cursor: isDone ? 'pointer' : undefined }}>
      <div className="flex items-center gap-[6px] mb-[7px]">
        <span className="text-sm leading-none shrink-0" style={{ color: isDone ? '#3fb950' : '#adbac7' }}>
          {isDone ? '✓' : '🖨'}
        </span>
        <span className="text-xs font-bold tabular-nums shrink-0" style={{ color: isDone ? '#3fb950' : '#ffffff' }}>
          {isDone ? `${qty} label${qty !== 1 ? 's' : ''}` : `${done}`}
          {!isDone && <span style={{ color: '#6e7681', fontWeight: 400 }}>/{qty}</span>}
        </span>
        {label && (
          <span className="text-xs truncate" style={{ color: isDone ? '#2ea043' : '#8b949e' }}>{label}</span>
        )}
      </div>
      <div className="h-[5px] bg-[#21262d] rounded-full overflow-hidden">
        <div
          className={isDone ? '' : 'animate-progress-stripes'}
          style={{
            height: '100%',
            borderRadius: '9999px',
            backgroundColor: isDone ? '#2ea043' : '#28a745',
            width: `${pct}%`,
            transition: 'width 0.95s ease-out, background-color 0.3s ease',
          }}
        />
      </div>
    </div>
  )
}
// ───────────────────────────────────────────────────────────────────────────

// ── Main page ───────────────────────────────────────────────────────────────
export default function Preppy() {
  const [template,        setTemplate]        = useState<LabelTemplate>('IX')
  const [toasts,          setToasts]          = useState<ToastState[]>([])
  const animQueueRef   = useRef<Array<() => Promise<void>>>([])
  const animRunningRef = useRef(false)
  const [customPresets,   setCustomPresets]   = useState<CustomPreset[]>(() => loadStored(PRESETS_KEY))
  const [presetOrder,     setPresetOrder]     = useState<string[]>(() => loadStored(PRESET_ORDER_KEY))
  const [hiddenPresets,   setHiddenPresets]   = useState<string[]>(() => loadStored(HIDDEN_PRESETS_KEY))
  const [editMode,        setEditMode]        = useState(false)
  const [dndKey,          setDndKey]          = useState(0)
  const [showAddPreset,   setShowAddPreset]   = useState(false)
  const [editSort,        setEditSort]        = useState('')
  const [popularityMap,   setPopularityMap]   = useState<Map<number, number>>(new Map())
  const [printQtyTarget,  setPrintQtyTarget]  = useState<{ durationHrs: number; label: string } | null>(null)
  const [panelCollapsed,  setPanelCollapsed]  = useState(() =>
    localStorage.getItem(PANEL_COLLAPSED_KEY) === 'true'
  )
  const [leftWidth, setLeftWidth] = useState(() => {
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

  function togglePanelCollapsed() {
    const next = !panelCollapsed
    setPanelCollapsed(next)
    localStorage.setItem(PANEL_COLLAPSED_KEY, String(next))
  }

  // ── Toast helpers ─────────────────────────────────────────────────────────
  function removeToast(id: string) {
    setToasts(prev => prev.filter(t => t.id !== id))
  }
  function startFadeOut(id: string, delayMs = 0) {
    setTimeout(() => {
      setToasts(prev => prev.map(t => t.id === id ? { ...t, removing: true } : t))
      setTimeout(() => removeToast(id), 500)
    }, delayMs)
  }

  // Animation queue — animations play one at a time; API calls are independent and concurrent
  async function drainAnimQueue() {
    if (animRunningRef.current) return
    animRunningRef.current = true
    while (animQueueRef.current.length > 0) {
      const next = animQueueRef.current.shift()!
      await next()
    }
    animRunningRef.current = false
  }
  function enqueueAnimation(fn: () => Promise<void>): Promise<void> {
    return new Promise(resolve => {
      animQueueRef.current.push(async () => { await fn(); resolve() })
      void drainAnimQueue()
    })
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
    const id  = `${Date.now()}-${Math.random().toString(36).slice(2)}`
    const lbl = `${template} ${fmtDuration(durationHrs)}`

    // Toast starts locked at 0/qty until it reaches the front of the animation queue
    setToasts(prev => [...prev, { id, qty, done: 0, state: 'printing', label: lbl }])

    let cancelled = false

    // Enqueue animation — plays sequentially, one job at a time
    // Starts at done=1 immediately (bar visible right away), then ticks every ~1s
    const animDone = enqueueAnimation(async () => {
      for (let count = 1; count <= qty; count++) {
        if (cancelled) break
        setToasts(prev => prev.map(t =>
          t.id === id && t.state === 'printing' ? { ...t, done: count } : t
        ))
        // Always hold each tick for ~1s, including the last — lets the filled bar show before success
        await new Promise<void>(r => setTimeout(r, 950))
      }
    })

    try {
      const result = await window.electronAPI.print({ template, durationHrs, qty })
      if (result.success) {
        await animDone   // wait for animation to finish before showing checkmark
        setToasts(prev => prev.map(t => t.id === id ? { ...t, done: qty, state: 'success' } : t))
        startFadeOut(id, 3000)
      } else {
        cancelled = true
        setToasts(prev => prev.map(t => t.id === id ? { ...t, state: 'error', errorMsg: result.error ?? 'Print failed' } : t))
      }
    } catch (err) {
      cancelled = true
      setToasts(prev => prev.map(t => t.id === id ? { ...t, state: 'error', errorMsg: errorMsg(err, 'Print failed') } : t))
    }
  }

  async function handlePrintBundle(entries: BundleEntry[], multiplier: number) {
    const id       = `${Date.now()}-${Math.random().toString(36).slice(2)}`
    const totalQty = entries.reduce((sum, e) => sum + e.qty * multiplier, 0)

    setToasts(prev => [...prev, { id, qty: totalQty, done: 0, state: 'printing', label: `${template} Bundle` }])

    let done = 0
    for (const entry of entries) {
      const qty = entry.qty * multiplier
      try {
        const result = await window.electronAPI.print({ template, durationHrs: entry.hrs, qty })
        if (!result.success) {
          setToasts(prev => prev.map(t => t.id === id ? { ...t, state: 'error', errorMsg: result.error ?? 'Print failed' } : t))
          return
        }
        done += qty
        setToasts(prev => prev.map(t => t.id === id && t.state === 'printing' ? { ...t, done } : t))
      } catch (err) {
        setToasts(prev => prev.map(t => t.id === id ? { ...t, state: 'error', errorMsg: errorMsg(err, 'Print failed') } : t))
        return
      }
    }

    setToasts(prev => prev.map(t => t.id === id ? { ...t, done: totalQty, state: 'success' } : t))
    startFadeOut(id, 3000)
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
            ? (editMode || panelCollapsed)
              ? { flexGrow: 1, flexShrink: 1 }
              : { width: leftWidth, flexShrink: 0, flexGrow: 0 }
            : undefined}
        >
          {/* IX / OX / UX tabs + optional edit mode controls */}
          <div className={classes.selector}>
            {TEMPLATES.map((id) => (
              <button
                key={id}
                onClick={() => setTemplate(id)}
                disabled={editMode}
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

          {/* Preset cards */}
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
                    <div onClick={() => void handlePrint(hrs, 1)} style={{ cursor: 'pointer' }}>
                      <Label durationHrs={hrs} type={template} />
                    </div>
                    <div className={classes.btnRow}>
                      <button onClick={() => void handlePrint(hrs, 5)} className={classes.btn5}>🖨 5</button>
                      <button onClick={() => handleCustomPrint(hrs, label)} className={classes.btnX}>🖨 ×</button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ── Print toasts — anchored inside left column, left of panel ── */}
          {toasts.length > 0 && (
            <div className="absolute bottom-4 right-4 z-[250] flex flex-row gap-3 items-end pointer-events-none">
              {toasts.map(t => (
                <PrintToast key={t.id} {...t} onDismiss={() => removeToast(t.id)} />
              ))}
            </div>
          )}
        </div>

        {/* ── Drag divider + Quick Items panel (hidden in edit mode) ── */}
        {!editMode && (
          <>
            {!panelCollapsed && (
              <div
                className={classes.divider}
                onPointerDown={onDividerPointerDown}
                onPointerMove={onDividerPointerMove}
                onPointerUp={onDividerPointerUp}
              >
                <div className={classes.dividerBar} />
              </div>
            )}

            <QuickItemsPanel
              onPrint={handlePrint}
              onPrintBundle={handlePrintBundle}
              durationOptions={allDurations}
              collapsed={panelCollapsed}
              onToggleCollapse={togglePanelCollapsed}
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

      {/* ── Add Preset numpad page ── */}
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
