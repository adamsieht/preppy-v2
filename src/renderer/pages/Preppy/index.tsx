import { useState, useEffect, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import dayjs from 'dayjs'
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
} from '@dnd-kit/sortable'
import PageLayout from '../../components/PageLayout'
import SmartLabelPreview from '../../components/SmartLabelPreview'
import Clock from '../../components/Clock'
import PrinterStatus from '../../components/PrinterStatus'
import { loadActiveLayout } from './labelDefs'
import { BUILTIN_STATIC_PRESETS, loadStaticPresets, buildStaticLayout } from './staticPresets'
import type { StaticPreset } from './staticPresets'
import { generateZpl } from './labelZpl'
import { useErrorMsg } from '../../hooks/useErrorMsg'
import type { LabelTemplate, CustomPreset, DisplayPreset, PrintQtyTarget, BundleEntry, TemplateHrs, ToastState } from './types'
import { TEMPLATES, DEFAULT_PRESETS, DEFAULT_DURATIONS, PRESETS_KEY, PRESET_ORDER_KEY, HIDDEN_PRESETS_KEY, PANEL_COLLAPSED_KEY, LEFT_COLLAPSED_KEY, WIDTH_KEY, STATIC_PRESETS_ENABLED_KEY } from './constants'
import { loadDateCalcSettings, wouldExceedMidnight } from './labelDateCalc'
import { loadStored, persist, autoLabel, fmtDuration } from './utils'
import { classes } from './Preppy.styles'
import AddPresetPage from '../AddPresetPage'
import PrintQtyPage from '../PrintQtyPage'
import PrintToast from '../../components/PrintToast'
import SortablePresetCard from '../../components/SortablePresetCard'
import CalendarPicker from '../../components/CalendarPicker'
import QuickItemsPanel from '../../components/QuickItemsPanel'

// ── Custom header for the main Preppy screen ─────────────────────────────────
function PrepyHeader() {
  const [now, setNow] = useState(dayjs)
  const navigate      = useNavigate()

  useEffect(() => {
    const t = setInterval(() => setNow(dayjs()), 1000)
    return () => clearInterval(t)
  }, [])

  return (
    <>
      {/* Left: recessed dot-grid badge */}
      <span
        style={{
          backgroundColor: 'var(--badge-bg)',
          backgroundImage: [
            'repeating-linear-gradient(-45deg, transparent 0, transparent var(--badge-stripe-gap), var(--badge-stripe) var(--badge-stripe-gap), var(--badge-stripe) var(--badge-stripe-end))',
            'radial-gradient(circle, color-mix(in srgb, var(--c-accent) 60%, transparent) 0 1px, transparent 1px)',
          ].join(', '),
          backgroundSize: 'auto, 6px 6px',
          border: '1.5px solid var(--c-accent)',
          boxShadow: 'inset 0 2px 6px var(--badge-shadow), inset 0 -1px 0 rgba(255,255,255,0.04)',
          color: 'var(--badge-text)',
          textShadow: 'var(--badge-text-shadow)',
        }}
        className="shrink-0 inline-flex items-center px-5 py-[7px] rounded-lg text-2xl font-black tracking-[0.12em] uppercase select-none"
      >
        Preppy
      </span>

      {/* Center: big date — absolutely centered so it doesn't shift with left/right widths */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none">
        <span className="text-xl font-bold text-[#e6edf3]">
          {now.format('dddd, MMMM D')}
        </span>
      </div>

      {/* Right: printer status + settings cog + clock with seconds */}
      <div className="ml-auto flex items-center gap-3 shrink-0">
        <PrinterStatus />
        <button
          onClick={() => navigate('/settings')}
          className="bg-transparent border-0 text-[#768390] text-[1.25rem] leading-none cursor-pointer px-1 rounded hover:text-[#adbac7] transition-colors"
          title="Settings"
        >
          ⚙
        </button>
        <Clock showSeconds timeOnly />
      </div>
    </>
  )
}
// ─────────────────────────────────────────────────────────────────────────────

export default function Preppy() {
  const [template,        setTemplate]        = useState<LabelTemplate>('IX')
  const [toasts,          setToasts]          = useState<ToastState[]>([])
  const animQueueRef   = useRef<Array<() => Promise<void>>>([])
  const animRunningRef = useRef(false)
  const [customPresets,   setCustomPresets]   = useState<CustomPreset[]>(() => loadStored(PRESETS_KEY))
  const [presetOrder,     setPresetOrder]     = useState<string[]>(() => loadStored(PRESET_ORDER_KEY))
  const [hiddenPresets,   setHiddenPresets]   = useState<string[]>(() => loadStored(HIDDEN_PRESETS_KEY))
  const [editMode,        setEditMode]        = useState(false)
  const [leftTab,         setLeftTab]         = useState<'presets' | 'calendar'>('presets')
  const [dndKey,          setDndKey]          = useState(0)
  const [showAddPreset,   setShowAddPreset]   = useState(false)
  const [editSort,        setEditSort]        = useState('')
  const [popularityMap,   setPopularityMap]   = useState<Map<number, number>>(new Map())
  const [printQtyTarget,  setPrintQtyTarget]  = useState<PrintQtyTarget | null>(null)
  const [printSignal,     setPrintSignal]     = useState(0)
  const [panelCollapsed,  setPanelCollapsed]  = useState(() =>
    localStorage.getItem(PANEL_COLLAPSED_KEY) === 'true'
  )
  const [leftCollapsed,   setLeftCollapsed]   = useState(() =>
    localStorage.getItem(LEFT_COLLAPSED_KEY) === 'true'
  )
  const [leftWidth, setLeftWidth] = useState(() => {
    const saved = parseInt(localStorage.getItem(WIDTH_KEY) ?? '800', 10)
    return isNaN(saved) ? 800 : Math.max(440, Math.min(saved, 1600))
  })
  const [isLargeScreen, setIsLargeScreen] = useState(() => window.innerWidth >= 1280)
  const [activeLayout]  = useState(loadActiveLayout)
  const [staticPresets] = useState(() =>
    localStorage.getItem(STATIC_PRESETS_ENABLED_KEY) === 'false' ? [] : loadStaticPresets()
  )
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
      .map(p => ({ kind: 'duration', id: `d-${p.hrs}`, label: p.label, hrs: p.hrs, isDefault: true }))

    const customs: DisplayPreset[] = customPresets
      .filter(p => !hiddenSet.has(p.id) && !defaultHrs.has(p.hrs))
      .map(p => ({ kind: 'duration', id: p.id, label: p.label, hrs: p.hrs, isDefault: false }))

    const statics: DisplayPreset[] = staticPresets
      .map(sp => ({ kind: 'static', id: `s-${sp.id}`, label: sp.name, staticId: sp.id }))

    // Sort key for the natural (no saved order) case: duration presets ordered
    // by hours, static presets appended after.
    const naturalKey = (p: DisplayPreset) => p.kind === 'duration' ? p.hrs : Infinity

    const all = [...defaults, ...customs, ...statics]

    if (presetOrder.length === 0) {
      return all.sort((a, b) => naturalKey(a) - naturalKey(b))
    }

    const orderMap = new Map(presetOrder.map((id, i) => [id, i]))
    return all.sort((a, b) => {
      const ai = orderMap.get(a.id) ?? Infinity
      const bi = orderMap.get(b.id) ?? Infinity
      if (ai === Infinity && bi === Infinity) return naturalKey(a) - naturalKey(b)
      return ai - bi
    })
  }, [customPresets, hiddenPresets, presetOrder, staticPresets])

  const staticById = useMemo(
    () => new Map(staticPresets.map(sp => [sp.id, sp])),
    [staticPresets],
  )

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
    const newW = Math.max(440, Math.min(divDragRef.current.startW + e.clientX - divDragRef.current.startX, window.innerWidth * 0.67))
    setLeftWidth(newW)
  }
  function onDividerPointerUp(e: React.PointerEvent<HTMLDivElement>) {
    if (!divDragRef.current) return
    const newW = Math.max(440, Math.min(divDragRef.current.startW + e.clientX - divDragRef.current.startX, window.innerWidth * 0.67))
    persist(WIDTH_KEY, newW)
    divDragRef.current = null
  }

  function togglePanelCollapsed() {
    if (!panelCollapsed && leftCollapsed) {
      // Right is open, left already collapsed → swap: collapse right, expand left
      setPanelCollapsed(true)
      setLeftCollapsed(false)
      localStorage.setItem(PANEL_COLLAPSED_KEY, 'true')
      localStorage.setItem(LEFT_COLLAPSED_KEY, 'false')
    } else {
      const next = !panelCollapsed
      setPanelCollapsed(next)
      localStorage.setItem(PANEL_COLLAPSED_KEY, String(next))
    }
  }

  function toggleLeftCollapsed() {
    if (!leftCollapsed && panelCollapsed) {
      // Left is open, right already collapsed → swap: collapse left, expand right
      setLeftCollapsed(true)
      setPanelCollapsed(false)
      localStorage.setItem(LEFT_COLLAPSED_KEY, 'true')
      localStorage.setItem(PANEL_COLLAPSED_KEY, 'false')
    } else {
      const next = !leftCollapsed
      setLeftCollapsed(next)
      localStorage.setItem(LEFT_COLLAPSED_KEY, String(next))
    }
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
    // Static presets have no duration/popularity — keep them after duration presets.
    const hrsOf = (p: DisplayPreset) => p.kind === 'duration' ? p.hrs : Infinity
    const popOf = (p: DisplayPreset) => p.kind === 'duration' ? (popularityMap.get(p.hrs) ?? 0) : -1
    const sorted = [...allPresets]
    if (sort === 'asc')     sorted.sort((a, b) => hrsOf(a) - hrsOf(b))
    if (sort === 'desc')    sorted.sort((a, b) => hrsOf(b) - hrsOf(a))
    if (sort === 'popular') sorted.sort((a, b) => popOf(b) - popOf(a))
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
  async function handlePrint(durationHrs: number, qty: number, tpl = template, opts?: { fromCalendar?: boolean }) {
    const baseSettings = loadDateCalcSettings()
    // Calendar prints target the exact date clicked: disable day-first so the
    // expiry isn't shifted back a day, and always render the date (not a same-day time).
    const dateCalcSettings = opts?.fromCalendar
      ? { ...baseSettings, mode: 'standard' as const }
      : baseSettings

    // EOD redirect: same-day label would cross midnight → print the EOD static label.
    // Skipped for calendar prints, where the clicked date is explicit.
    if (!opts?.fromCalendar && wouldExceedMidnight(durationHrs, dateCalcSettings)) {
      const eodPreset = BUILTIN_STATIC_PRESETS.find(sp => sp.id === 'static-eod')
      if (eodPreset) return handlePrintStatic(eodPreset, qty)
    }

    const id  = `${Date.now()}-${Math.random().toString(36).slice(2)}`
    const lbl = `${tpl} ${fmtDuration(durationHrs)}`

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
        // Final tick holds ~1s so the full bar is visible before the success transition.
        // Intermediate ticks are shorter so multi-label prints don't drag.
        await new Promise<void>(r => setTimeout(r, count === qty ? 950 : 400))
      }
    })

    try {
      const zpl = generateZpl(loadActiveLayout(), { template: tpl, durationHrs }, 0, 0, {
        settings: dateCalcSettings,
        forceExpiryDate: opts?.fromCalendar,
      })
      const result = await window.electronAPI.printZpl({ zpl, qty })
      if (result.success) {
        await animDone   // wait for animation to finish before showing checkmark
        setToasts(prev => prev.map(t => t.id === id ? { ...t, done: qty, state: 'success' } : t))
        setPrintSignal(s => s + 1)
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
    const id             = `${Date.now()}-${Math.random().toString(36).slice(2)}`
    const totalQty       = entries.reduce((sum, e) => sum + e.qty * multiplier, 0)

    setToasts(prev => [...prev, { id, qty: totalQty, done: 0, state: 'printing', label: 'Bundle' }])

    let done = 0
    for (const entry of entries) {
      const tpl         = entry.template ?? 'IX'
      const qty         = entry.qty * multiplier
      const entryHrs    = entry.hrs[tpl]
      try {
        const zpl = generateZpl(loadActiveLayout(), { template: tpl, durationHrs: entryHrs })
        const result = await window.electronAPI.printZpl({ zpl, qty })
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
    setPrintSignal(s => s + 1)
    startFadeOut(id, 3000)
  }

  function handleCustomPrint(durationHrs: number, presetLabel: string) {
    setPrintQtyTarget({ kind: 'preset', durationHrs, label: presetLabel })
  }
  function handleCustomItemPrint(templateHrs: TemplateHrs, itemLabel: string) {
    setPrintQtyTarget({ kind: 'item', templateHrs, label: itemLabel })
  }
  function handleCustomPrintStatic(sp: StaticPreset) {
    setPrintQtyTarget({ kind: 'static', staticId: sp.id, label: sp.name })
  }

  // Static presets: generate the ZPL once (no duration — uses "today" for the
  // day-of-week box) and print qty copies of it.
  async function handlePrintStatic(sp: StaticPreset, qty: number) {
    const id  = `${Date.now()}-${Math.random().toString(36).slice(2)}`
    setToasts(prev => [...prev, { id, qty, done: 0, state: 'printing', label: sp.name }])

    let cancelled = false
    const animDone = enqueueAnimation(async () => {
      for (let count = 1; count <= qty; count++) {
        if (cancelled) break
        setToasts(prev => prev.map(t =>
          t.id === id && t.state === 'printing' ? { ...t, done: count } : t
        ))
        await new Promise<void>(r => setTimeout(r, count === qty ? 950 : 400))
      }
    })

    try {
      const zpl = generateZpl(buildStaticLayout(sp), { template, durationHrs: 0 })
      const result = await window.electronAPI.printZpl({ zpl, qty })
      if (result.success) {
        await animDone
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

  return (
    <PageLayout customHeader={<PrepyHeader />} noPad noScroll>
      <div className={classes.page}>

        {/* ── Full-width top: IX / OX / UX template selector + edit controls ── */}
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
          <button
            onClick={() => setEditMode(m => !m)}
            className={classes.editBtn(editMode)}
          >
            {editMode ? 'Done' : 'Edit'}
          </button>
        </div>

        {/* ── Main content row (left column + right panel) ── */}
        <div className={classes.contentRow}>

          {/* ── Left column (or collapse strip) ── */}
          {leftCollapsed && !editMode ? (
            <div
              className={classes.leftCollapseStrip}
              onClick={toggleLeftCollapsed}
              title="Expand presets"
            >
              <span className="text-[#6e7681] text-[18px] leading-none select-none">›</span>
            </div>
          ) : (
          <div
            className={classes.leftCol}
            style={isLargeScreen
              ? panelCollapsed
                ? { flexGrow: 1, flexShrink: 1 }
                : { width: leftWidth, flexShrink: 0, flexGrow: 0 }
              : undefined}
          >
            {/* Tab bar (hidden in edit mode) */}
            {!editMode && (
              <div className={classes.leftTabBar}>
                <button
                  className={classes.leftTab(leftTab === 'presets')}
                  onClick={() => setLeftTab('presets')}
                >
                  Presets
                </button>
                <button
                  className={classes.leftTab(leftTab === 'calendar')}
                  onClick={() => setLeftTab('calendar')}
                >
                  Calendar
                </button>
                <button
                  onClick={toggleLeftCollapsed}
                  title="Collapse panel"
                  className="w-9 shrink-0 flex items-center justify-center text-[#6e7681] hover:text-white hover:bg-[#21262d] cursor-pointer bg-transparent border-0 border-b-2 border-transparent transition-colors text-[16px] leading-none"
                >‹</button>
              </div>
            )}

            {/* Tab content */}
            {(editMode || leftTab === 'presets') ? (
              /* ── Preset cards ── */
              editMode ? (
                <div className={classes.editRow}>
                  <DndContext
                    key={dndKey}
                    sensors={sensors}
                    collisionDetection={closestCenter}
                    onDragEnd={handleDragEnd}
                  >
                    <SortableContext items={allPresets.map(p => p.id)} strategy={rectSortingStrategy}>
                      {allPresets.map(preset => {
                        const sp = preset.kind === 'static' ? staticById.get(preset.staticId) : undefined
                        const previewLayout = sp ? buildStaticLayout(sp) : activeLayout
                        const previewValues = preset.kind === 'static'
                          ? { template, durationHrs: 0 }
                          : { template, durationHrs: preset.hrs }
                        return (
                          <SortablePresetCard
                            key={preset.id}
                            preset={preset}
                            previewLayout={previewLayout}
                            previewValues={previewValues}
                            deletable={preset.kind === 'duration'}
                            onDelete={deletePreset}
                          />
                        )
                      })}
                    </SortableContext>
                  </DndContext>
                </div>
              ) : (
                <div className={classes.cardsRow}>
                  {allPresets.map(preset => {
                    if (preset.kind === 'static') {
                      const sp = staticById.get(preset.staticId)
                      if (!sp) return null
                      const layout = buildStaticLayout(sp)
                      return (
                        <div key={preset.id} className={classes.card}>
                          <div className={classes.cardHead}>{preset.label}</div>
                          <div className={classes.cardBody}>
                            <div onClick={() => void handlePrintStatic(sp, 1)} className="flex-1 min-h-0" style={{ cursor: 'pointer' }}>
                              <SmartLabelPreview layout={layout} values={{ template, durationHrs: 0 }} />
                            </div>
                            <div className={`${classes.btnRow} shrink-0`}>
                              <button onClick={() => void handlePrintStatic(sp, 5)} className={classes.btn5}>🖨 5</button>
                              <button onClick={() => handleCustomPrintStatic(sp)} className={classes.btnX}>🖨 ×</button>
                            </div>
                          </div>
                        </div>
                      )
                    }
                    const { id, label, hrs } = preset
                    return (
                      <div key={id} className={classes.card}>
                        <div className={classes.cardHead}>{label}</div>
                        <div className={classes.cardBody}>
                          <div onClick={() => void handlePrint(hrs, 1)} className="flex-1 min-h-0" style={{ cursor: 'pointer' }}>
                            <SmartLabelPreview layout={activeLayout} values={{ template, durationHrs: hrs }} />
                          </div>
                          <div className={`${classes.btnRow} shrink-0`}>
                            <button onClick={() => void handlePrint(hrs, 5)} className={classes.btn5}>🖨 5</button>
                            <button onClick={() => handleCustomPrint(hrs, label)} className={classes.btnX}>🖨 ×</button>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )
            ) : (
              /* ── Calendar picker ── */
              <CalendarPicker
                template={template}
                onPrint={(hrs, qty) => handlePrint(hrs, qty, template, { fromCalendar: true })}
              />
            )}

            {/* ── Edit mode floating toolbar — bottom-left of preset area ── */}
            {editMode && (
              <div className="absolute bottom-4 left-4 z-[100] flex items-center gap-1 bg-[#161b22] border border-[#30363d] rounded-xl px-3 py-[7px] shadow-[0_4px_20px_rgba(0,0,0,0.5)]">
                <button
                  onClick={restoreDefaults}
                  className="text-sm font-bold text-[#6e7681] hover:text-white bg-transparent border-0 cursor-pointer transition-colors px-2 py-1 rounded hover:bg-[#21262d]"
                >↩ Restore</button>
                <div className="w-px h-4 bg-[#30363d] shrink-0" />
                <select
                  value={editSort}
                  onChange={e => handleSort(e.target.value)}
                  className="text-sm font-bold text-[#6e7681] bg-transparent border-0 cursor-pointer outline-none hover:text-white transition-colors px-1 py-1"
                >
                  <option value="">Sort…</option>
                  <option value="asc">Time ↑</option>
                  <option value="desc">Time ↓</option>
                  <option value="popular">Popular</option>
                </select>
                <div className="w-px h-4 bg-[#30363d] shrink-0" />
                <button
                  onClick={() => setShowAddPreset(true)}
                  className="text-sm font-bold text-[#28a745] bg-transparent border-0 cursor-pointer transition-colors px-2 py-1 rounded hover:bg-[#28a745]/10"
                >+ New</button>
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
          )} {/* end leftCollapsed ternary */}

          {/* ── Drag divider + Quick Items panel ── */}
          {!panelCollapsed && (
            <div className={classes.divider}>
              {/* Invisible wider touch target — extends hit area without layout change */}
              <div
                className="absolute inset-y-0 -left-3 -right-3 touch-none cursor-col-resize"
                onPointerDown={onDividerPointerDown}
                onPointerMove={onDividerPointerMove}
                onPointerUp={onDividerPointerUp}
              />
              <div className={classes.dividerBar} />
            </div>
          )}

          <QuickItemsPanel
            onPrint={handlePrint}
            onPrintBundle={handlePrintBundle}
            onCustomPrint={handleCustomItemPrint}
            template={template}
            durationOptions={allDurations}
            collapsed={panelCollapsed}
            onToggleCollapse={togglePanelCollapsed}
            printSignal={printSignal}
            isEditing={editMode}
          />

        </div>
      </div>

      {/* ── Print quantity numpad page ── */}
      {printQtyTarget && printQtyTarget.kind === 'static' ? (() => {
        const sp = staticById.get(printQtyTarget.staticId)
        if (!sp) return null
        return (
          <PrintQtyPage
            label={printQtyTarget.label}
            initTemplate={template}
            durationHrs={0}
            staticLayout={buildStaticLayout(sp)}
            onPrint={(qty) => { void handlePrintStatic(sp, qty); setPrintQtyTarget(null) }}
            onClose={() => setPrintQtyTarget(null)}
          />
        )
      })() : printQtyTarget && (
        <PrintQtyPage
          label={printQtyTarget.label}
          initTemplate={template}
          templateHrs={printQtyTarget.kind === 'item' ? printQtyTarget.templateHrs : undefined}
          durationHrs={printQtyTarget.kind === 'preset' ? printQtyTarget.durationHrs : printQtyTarget.templateHrs[template]}
          onPrint={(qty, tpl) => {
            const hrs = printQtyTarget.kind === 'item'
              ? printQtyTarget.templateHrs[tpl]
              : printQtyTarget.durationHrs
            setTemplate(tpl)
            void handlePrint(hrs, qty, tpl)
            setPrintQtyTarget(null)
          }}
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
