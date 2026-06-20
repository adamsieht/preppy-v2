import { useState, useEffect, useRef, useMemo } from 'react'
import type { QuickListEntry, QuickSingleItem, QuickBundleItem, BundleEntry, CategoryDef, PrintJob, LabelTemplate, TemplateHrs, ActiveLogEntry } from '../pages/Preppy/types'
import type { LabelLayout } from '../pages/Preppy/labelTypes'
import { ITEM_CATEGORIES, CATS_KEY, HIDDEN_CATS_KEY, ITEMS_KEY, ACTIVE_LOG_KEY, RECENT_CLEARED_KEY, PROMPT_HRS, PRINT_COUNTS_KEY, HOURLY_COUNTS_KEY, FAVORITES_KEY, QUICK_SORT_FIELD_KEY, QUICK_SORT_DIR_KEY, QUICK_CARD_STYLE_KEY } from '../pages/Preppy/constants'
import type { QuickSortField, QuickCardStyle } from '../pages/Preppy/constants'
import { loadItems, loadStored, loadUserCats, persist, fmtDuration, fmtExpiry, timeAgo, getCat } from '../pages/Preppy/utils'
import { loadActiveLayout, buildQuickItemLayout } from '../pages/Preppy/labelDefs'
import { PencilIcon, StarIcon, TrashIcon } from './Icons'
import ScaledLabelPreview from './ScaledLabelPreview'
import AddEditItemPage from '../pages/AddEditItemPage'
import AddBundlePage from '../pages/AddBundlePage'
import DatePromptPage from './DatePromptPage'
import { classes } from './QuickItemsPanel.styles'

type SortField = QuickSortField

const VALID_SORTS: SortField[] = ['name', 'cat', 'recent', 'popular', 'recommended']
function loadSortField(): SortField {
  const v = localStorage.getItem(QUICK_SORT_FIELD_KEY) as SortField | null
  return v && VALID_SORTS.includes(v) ? v : 'cat'
}
function loadSortAsc(): boolean {
  return (localStorage.getItem(QUICK_SORT_DIR_KEY) ?? 'desc') === 'asc'
}
function loadCardStyle(): QuickCardStyle {
  return localStorage.getItem(QUICK_CARD_STYLE_KEY) === 'label' ? 'label' : 'standard'
}

function mergeEntries(entries: ActiveLogEntry[]): ActiveLogEntry[] {
  const groups = new Map<string, ActiveLogEntry[]>()
  for (const entry of entries) {
    const day = entry.printedAt.slice(0, 10)
    const key = `${entry.name ?? ''}\0${entry.template}\0${entry.duration_hrs}\0${day}`
    const g = groups.get(key) ?? []
    g.push(entry)
    groups.set(key, g)
  }
  return Array.from(groups.values()).map(group => {
    if (group.length === 1) return group[0]
    const totalQty = group.reduce((s, e) => s + e.qty, 0)
    const latest = group.reduce((a, b) => a.printedAt > b.printedAt ? a : b)
    return { ...latest, qty: totalQty, id: group.map(e => e.id).join(',') }
  })
}

// ── BundleCard ─────────────────────────────────────────────────────────────
interface BundleCardProps {
  bundle:       QuickBundleItem
  cardStyle:    'standard' | 'label'
  activeLayout: LabelLayout
  onPrint:      (entries: BundleEntry[]) => void
  onDelete:     () => void
  onMoveUp?:    () => void
  onMoveDown?:  () => void
  isEditing:    boolean
}

function BundleCard({ bundle, cardStyle, activeLayout, onPrint, onDelete, onMoveUp, onMoveDown, isEditing }: BundleCardProps) {
  const [localQtys, setLocalQtys] = useState<number[]>(() => bundle.entries.map(e => e.qty))

  const totalLabels = localQtys.reduce((s, q) => s + q, 0)

  function adjustQty(i: number, delta: number) {
    setLocalQtys(prev => prev.map((q, idx) => idx === i ? Math.max(1, Math.min(99, q + delta)) : q))
  }

  function handlePrint() {
    onPrint(bundle.entries.map((e, i) => ({ ...e, qty: localQtys[i] })))
  }

  return (
    <div className={classes.bundleCard}>
      {/* Header — slim: name + reorder arrows + delete (edit mode) */}
      <div className="flex items-center gap-1 px-3 py-[6px] border-b border-[#30363d]">
        <span className="flex-1 text-white font-semibold text-sm truncate min-w-0">{bundle.name}</span>
        {isEditing && (
          <>
            <button onClick={onMoveUp} disabled={!onMoveUp} className={`${classes.gridCardIconBtn} text-[#6e7681] hover:text-white disabled:opacity-30 disabled:cursor-default text-base`} title="Move up">↑</button>
            <button onClick={onMoveDown} disabled={!onMoveDown} className={`${classes.gridCardIconBtn} text-[#6e7681] hover:text-white disabled:opacity-30 disabled:cursor-default text-base`} title="Move down">↓</button>
            <button onClick={onDelete} className={`${classes.gridCardIconBtn} text-[#6e7681] hover:text-[#f85149]`} title="Remove">✕</button>
          </>
        )}
      </div>

      {/* Mini item cards */}
      <div className={classes.bundleCardBody}>
        {bundle.entries.map((entry, i) => {
          const tpl = entry.template ?? 'IX'
          return (
            <div key={i} className={classes.miniCard}>
              {cardStyle === 'label' && (
                <div className={classes.miniCardPreview}>
                  <ScaledLabelPreview
                    layout={activeLayout}
                    values={{ template: tpl, durationHrs: entry.hrs[tpl] }}
                  />
                </div>
              )}
              <div className="px-2 pt-1 pb-0">
                {entry.name && (
                  <div className="text-[11px] text-white font-medium truncate leading-snug">{entry.name}</div>
                )}
                <div className="text-[10px] text-[#6e7681] leading-snug">
                  {tpl} · {fmtDuration(entry.hrs[tpl])}
                </div>
              </div>
              <div className={classes.miniQtyRow}>
                <button onClick={() => adjustQty(i, -1)} className={classes.miniQtyBtn}>−</button>
                <span className="text-white text-sm font-mono w-6 text-center tabular-nums">{localQtys[i]}</span>
                <button onClick={() => adjustQty(i, +1)} className={classes.miniQtyBtn}>+</button>
              </div>
            </div>
          )
        })}
      </div>

      {/* Footer */}
      <div className={classes.bundleCardFoot}>
        <span className="text-[#6e7681] text-xs">{totalLabels} label{totalLabels !== 1 ? 's' : ''}</span>
        <button onClick={handlePrint} className={classes.bundlePrintBtn}>Print</button>
      </div>
    </div>
  )
}
// ───────────────────────────────────────────────────────────────────────────

interface PanelProps {
  onPrint:          (hrs: number, qty: number) => void
  onItemPrint:      (hrs: number, qty: number, itemName: string) => void
  onPrintBundle:    (entries: BundleEntry[], multiplier: number) => void
  onCustomPrint:    (templateHrs: TemplateHrs, label: string) => void
  template:         LabelTemplate
  durationOptions:  { label: string; hrs: number }[]
  collapsed:        boolean
  onToggleCollapse: () => void
  printSignal?:     number
  isEditing?:       boolean
}

export default function QuickItemsPanel({ onPrint, onItemPrint, onPrintBundle, onCustomPrint, template, durationOptions, collapsed, onToggleCollapse, printSignal, isEditing }: PanelProps) {
  const [items,         setItems]         = useState<QuickListEntry[]>(() => loadItems())
  const [userCats,      setUserCats]      = useState<CategoryDef[]>(() => loadUserCats())
  const [hiddenCats,    setHiddenCats]    = useState<string[]>(() => loadStored(HIDDEN_CATS_KEY))
  const [tab,           setTab]           = useState<'items' | 'bundles' | 'recent'>('items')
  const [sortField]     = useState<SortField>(loadSortField)
  const [sortAsc]       = useState(loadSortAsc)
  const [cardStyle]     = useState<QuickCardStyle>(loadCardStyle)
  const [activeLayout]  = useState(loadActiveLayout)
  const quickLayout     = useMemo(() => buildQuickItemLayout(activeLayout), [activeLayout])
  const [filterCat,     setFilterCat]     = useState<string | null>(null)
  const [showFavoritesOnly, setShowFavoritesOnly] = useState(false)
  const [favorites,     setFavorites]     = useState<Set<string>>(() => { try { return new Set<string>(JSON.parse(localStorage.getItem(FAVORITES_KEY) ?? '[]')) } catch { return new Set() } })
  const [printCounts,   setPrintCounts]   = useState<Record<string, number>>(() => { try { return JSON.parse(localStorage.getItem(PRINT_COUNTS_KEY) ?? '{}') } catch { return {} } })
  const [hourlyCounts,  setHourlyCounts]  = useState<Record<string, number[]>>(() => { try { return JSON.parse(localStorage.getItem(HOURLY_COUNTS_KEY) ?? '{}') } catch { return {} } })
  const [recentJobs,      setRecentJobs]      = useState<PrintJob[]>([])
  const [recentLoading,   setRecentLoading]   = useState(false)
  const [activeLog,       setActiveLog]       = useState<ActiveLogEntry[]>(() => loadStored(ACTIVE_LOG_KEY))
  const [recentClearedAt, setRecentClearedAt] = useState<string>(() => localStorage.getItem(RECENT_CLEARED_KEY) ?? '')
  const [showAddBundle, setShowAddBundle] = useState(false)
  const [showAddItem,   setShowAddItem]   = useState(false)
  const [editingItem,   setEditingItem]   = useState<QuickSingleItem | null>(null)
  const [datePromptItem,    setDatePromptItem]    = useState<QuickSingleItem | null>(null)
  const [confirmRemoveAll,  setConfirmRemoveAll]  = useState(false)
  const [isWide,            setIsWide]            = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = panelRef.current
    if (!el) return
    const ro = new ResizeObserver(entries => {
      for (const entry of entries) {
        setIsWide(entry.contentRect.width > window.innerWidth / 3)
      }
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    if (tab !== 'recent') return
    setRecentLoading(true)
    window.electronAPI.getPrintHistory(30)
      .then(jobs => setRecentJobs((jobs as unknown as PrintJob[]).filter(j => j.success === 1)))
      .catch(() => {})
      .finally(() => setRecentLoading(false))
  }, [tab, printSignal])

  const hiddenCatSet = new Set(hiddenCats)
  const allCats     = [...ITEM_CATEGORIES, ...userCats]
    .filter((c, i, a) => a.findIndex(x => x.id === c.id) === i)
    .filter(c => c.id === 'item' || !hiddenCatSet.has(c.id))
  const singleItems = items.filter((i): i is QuickSingleItem => i.type === 'item')
  const bundleItems = items.filter(i => i.type === 'bundle')

  const visibleItems = (() => {
    let list = showFavoritesOnly
      ? singleItems.filter(i => favorites.has(i.id))
      : filterCat
        ? singleItems.filter(i => (i.category ?? 'item') === filterCat)
        : singleItems
    const hour = new Date().getHours()
    return [...list].sort((a, b) => {
      let cmp = 0
      if (sortField === 'name') {
        cmp = a.name.localeCompare(b.name)
      } else if (sortField === 'cat') {
        const order: string[] = ITEM_CATEGORIES.map(c => c.id)
        const ai = order.indexOf(a.category ?? 'item')
        const bi = order.indexOf(b.category ?? 'item')
        cmp = ai !== bi ? ai - bi : a.name.localeCompare(b.name)
      } else if (sortField === 'popular') {
        cmp = (printCounts[a.id] ?? 0) - (printCounts[b.id] ?? 0)
      } else if (sortField === 'recommended') {
        const aH = (hourlyCounts[a.id] ?? [])[hour] ?? 0
        const bH = (hourlyCounts[b.id] ?? [])[hour] ?? 0
        cmp = aH !== bH ? aH - bH : (printCounts[a.id] ?? 0) - (printCounts[b.id] ?? 0)
      } else {
        // recent: sort by timestamp embedded in id (higher = newer)
        const aTime = parseInt(a.id.split('-')[0], 10)
        const bTime = parseInt(b.id.split('-')[0], 10)
        cmp = aTime - bTime
      }
      return sortAsc ? cmp : -cmp
    })
  })()

  function addCategory(cat: CategoryDef) {
    const next = [...userCats, cat]
    setUserCats(next)
    persist(CATS_KEY, next)
  }

  // Remove the currently-selected category. Items in it fall back to 'item'.
  // The built-in 'item' category can never be removed. Custom categories are
  // deleted outright; built-in ones (veggie/meat/sauce) are hidden.
  function removeSelectedCategory() {
    const catId = filterCat
    if (!catId || catId === 'item') return

    const nextItems = items.map(i =>
      i.type === 'item' && (i.category ?? 'item') === catId
        ? { ...i, category: 'item' }
        : i,
    )
    setItems(nextItems)
    persist(ITEMS_KEY, nextItems)

    const nextUserCats = userCats.filter(c => c.id !== catId)
    if (nextUserCats.length !== userCats.length) {
      setUserCats(nextUserCats)
      persist(CATS_KEY, nextUserCats)
    } else {
      const nextHidden = [...hiddenCats, catId]
      setHiddenCats(nextHidden)
      persist(HIDDEN_CATS_KEY, nextHidden)
    }
    setFilterCat(null)
  }

  function addItem(name: string, cat: string, hrs: TemplateHrs) {
    const id   = `${Date.now()}-${Math.random().toString(36).slice(2)}`
    const next: QuickListEntry[] = [...items, { id, name, type: 'item', hrs, category: cat }]
    setItems(next)
    persist(ITEMS_KEY, next)
  }

  function saveEditItem(name: string, cat: string, hrs: TemplateHrs) {
    if (!editingItem) return
    const next = items.map(i =>
      i.id === editingItem.id && i.type === 'item'
        ? { ...i, name, category: cat, hrs }
        : i
    )
    setItems(next)
    persist(ITEMS_KEY, next)
    setEditingItem(null)
  }

  function moveBundle(id: string, dir: -1 | 1) {
    const bundleIdxInAll = items.findIndex(i => i.id === id)
    if (bundleIdxInAll === -1) return
    // Find the adjacent bundle in the same direction within the full items array
    let swapIdx = -1
    if (dir === -1) {
      for (let i = bundleIdxInAll - 1; i >= 0; i--) {
        if (items[i].type === 'bundle') { swapIdx = i; break }
      }
    } else {
      for (let i = bundleIdxInAll + 1; i < items.length; i++) {
        if (items[i].type === 'bundle') { swapIdx = i; break }
      }
    }
    if (swapIdx === -1) return
    const next = [...items]
    ;[next[bundleIdxInAll], next[swapIdx]] = [next[swapIdx], next[bundleIdxInAll]]
    setItems(next)
    persist(ITEMS_KEY, next)
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

  function removeAllSingleItems() {
    const next = items.filter(i => i.type !== 'item')
    setItems(next)
    persist(ITEMS_KEY, next)
    setConfirmRemoveAll(false)
  }

  function logActive(name: string | undefined, category: string | undefined, tpl: LabelTemplate, duration_hrs: number, qty: number, itemId?: string) {
    const entry: ActiveLogEntry = {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      name, category, template: tpl, duration_hrs, qty,
      printedAt: new Date().toISOString(),
    }
    setActiveLog(prev => {
      const next = [...prev, entry]
      persist(ACTIVE_LOG_KEY, next)
      return next
    })
    if (itemId) {
      setPrintCounts(prev => {
        const next = { ...prev, [itemId]: (prev[itemId] ?? 0) + qty }
        persist(PRINT_COUNTS_KEY, next)
        return next
      })
      setHourlyCounts(prev => {
        const hour = new Date().getHours()
        const hours = [...(prev[itemId] ?? Array(24).fill(0))]
        hours[hour] = (hours[hour] ?? 0) + qty
        const next = { ...prev, [itemId]: hours }
        persist(HOURLY_COUNTS_KEY, next)
        return next
      })
    }
  }

  function toggleFavorite(itemId: string) {
    setFavorites(prev => {
      const next = new Set(prev)
      if (next.has(itemId)) next.delete(itemId)
      else next.add(itemId)
      persist(FAVORITES_KEY, [...next])
      return next
    })
  }

  function dismissActiveEntry(id: string) {
    const ids = new Set(id.split(','))
    setActiveLog(prev => {
      const next = prev.filter(e => !ids.has(e.id))
      persist(ACTIVE_LOG_KEY, next)
      return next
    })
  }

  function clearActive() {
    setActiveLog([])
    persist(ACTIVE_LOG_KEY, [])
  }

  function clearHistory() {
    const ts = new Date().toISOString()
    setRecentClearedAt(ts)
    localStorage.setItem(RECENT_CLEARED_KEY, ts)
  }

  const now         = new Date()
  const endOfDay    = new Date(); endOfDay.setHours(23, 59, 59, 999)
  const undismissed    = mergeEntries(activeLog.filter(e => !e.dismissed))
  const expiringToday  = undismissed.filter(e => { const x = new Date(new Date(e.printedAt).getTime() + e.duration_hrs * 3600 * 1000); return x > now && x <= endOfDay })
  const currentlyActive = undismissed.filter(e => { const x = new Date(new Date(e.printedAt).getTime() + e.duration_hrs * 3600 * 1000); return x > endOfDay })
  const filteredHistory = recentClearedAt ? recentJobs.filter(j => j.printed_at > recentClearedAt) : recentJobs

  // Collapsed: render a narrow strip with an expand button
  if (collapsed) {
    return (
      <div
        className={classes.collapseStrip}
        onClick={onToggleCollapse}
        title="Expand Quick Items"
      >
        <span className="text-[#6e7681] text-[18px] leading-none select-none">‹</span>
      </div>
    )
  }

  return (
    <>
      <div className={classes.panel} ref={panelRef}>
        {/* Tabs + collapse button */}
        <div className={classes.panelTabBar}>
          <button className={classes.panelTab(tab === 'items')}   onClick={() => setTab('items')}>Items</button>
          <button className={classes.panelTab(tab === 'bundles')} onClick={() => setTab('bundles')}>Bundles</button>
          <button className={classes.panelTab(tab === 'recent')}  onClick={() => setTab('recent')}>Recent</button>
          <button
            onClick={onToggleCollapse}
            title="Collapse panel"
            className="w-9 shrink-0 flex items-center justify-center text-[#6e7681] hover:text-white hover:bg-[#21262d] cursor-pointer bg-transparent border-0 border-b-2 border-transparent transition-colors text-[16px] leading-none"
          >›</button>
        </div>

        {/* ── Items tab ── */}
        {tab === 'items' && (
          <>
            {/* Filter + sort controls */}
            <div className="flex items-start gap-2 px-3 pt-2 pb-2 border-b border-[#30363d] shrink-0">
              {/* Category filter pills — wrap freely */}
              <div className="flex flex-wrap gap-1 flex-1 min-w-0">
                <button
                  className={classes.filterPill(filterCat === null)}
                  onClick={() => setFilterCat(null)}
                >All</button>
                {allCats.map(cat => {
                  const active = filterCat === cat.id
                  return (
                    <button
                      key={cat.id}
                      className={classes.filterPill(active)}
                      style={active ? {} : { borderColor: cat.color + '55', color: cat.color }}
                      onClick={() => setFilterCat(cat.id)}
                    >{cat.label}</button>
                  )
                })}
              </div>
              {/* Favorites filter + remove-category — fixed to right (sort moved to Settings → General) */}
              <div className="shrink-0 flex items-center gap-1">
                {isEditing && (
                  <button
                    onClick={removeSelectedCategory}
                    disabled={!filterCat || filterCat === 'item'}
                    title={filterCat && filterCat !== 'item' ? 'Remove selected category (items become "Item")' : 'Select a category to remove'}
                    className="w-7 h-7 shrink-0 flex items-center justify-center rounded border border-[#30363d] bg-transparent text-[#6e7681] hover:text-[#f85149] hover:border-[#f85149] cursor-pointer transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:text-[#6e7681] disabled:hover:border-[#30363d]"
                  ><TrashIcon /></button>
                )}
                <button
                  onClick={() => setShowFavoritesOnly(prev => !prev)}
                  title={showFavoritesOnly ? 'Showing favorites — click to show all' : 'Filter to favorites'}
                  className={`w-7 h-7 shrink-0 flex items-center justify-center rounded border cursor-pointer transition-colors ${showFavoritesOnly ? 'border-[#e3b341] bg-[#e3b341] text-white' : 'border-[#30363d] bg-transparent text-[#6e7681] hover:text-[#e3b341] hover:border-[#e3b341]'}`}
                ><StarIcon filled={showFavoritesOnly} /></button>
              </div>
            </div>

            {visibleItems.length === 0 ? (
              <div className={`${classes.panelList} flex`}>
                <div className={classes.emptyState}>
                  <span className="text-white font-medium">{singleItems.length === 0 ? 'No items yet' : 'No items match filter'}</span>
                  <span>{singleItems.length === 0 ? (isEditing ? 'Use the button below to add your first item' : 'Enter Edit mode to add items') : 'Try a different category filter'}</span>
                </div>
              </div>
            ) : cardStyle === 'label' ? (
              /* ── Label-preview card style (mirrors left-column presets) ── */
              <div className="relative flex-1 min-h-0 flex flex-col">
                <div className={classes.panelGridLabel(isEditing ?? false)}>
                  {visibleItems.map(item => {
                    const isPrompt   = item.hrs[template] === PROMPT_HRS
                    const previewHrs = isPrompt ? 24 : item.hrs[template]
                    return (
                      <div key={item.id} className={`${classes.labelCard} group`}>
                        <div className="relative flex-1 min-h-0 bg-[#090c10] p-1.5">
                          <ScaledLabelPreview layout={quickLayout} values={{ template, durationHrs: previewHrs, itemName: item.name }} />
                          {/* Persistent favorite indicator (hidden while hovering to reveal actions) */}
                          {favorites.has(item.id) && (
                            <div className="absolute top-1 right-1 text-[#e3b341] group-hover:opacity-0 transition-opacity pointer-events-none"><StarIcon filled /></div>
                          )}
                          {/* Action icons — revealed on hover so they don't cover the label */}
                          <div className="absolute top-0 right-0 flex items-center gap-[1px] rounded-bl bg-[#0d1117]/85 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button onClick={() => toggleFavorite(item.id)} className={`${classes.gridCardIconBtn} ${favorites.has(item.id) ? 'text-[#e3b341]' : 'text-[#6e7681] hover:text-[#e3b341]'}`} title={favorites.has(item.id) ? 'Remove from favorites' : 'Add to favorites'}><StarIcon filled={favorites.has(item.id)} /></button>
                            {isEditing && <button onClick={() => setEditingItem(item)} className={`${classes.gridCardIconBtn} text-[#6e7681] hover:text-[#58a6ff]`} title="Edit"><PencilIcon /></button>}
                            {isEditing && <button onClick={() => removeItem(item.id)} className={`${classes.gridCardIconBtn} text-[#6e7681] hover:text-[#f85149]`} title="Remove">✕</button>}
                          </div>
                        </div>
                        <div className={classes.gridCardBtns}>
                          {isPrompt ? (
                            <button onClick={() => setDatePromptItem(item)} className={classes.gridCardBtn(true)}>📅 Pick Date</button>
                          ) : (
                            <>
                              <button onClick={() => { logActive(item.name, item.category, template, item.hrs[template], 1, item.id); onItemPrint(item.hrs[template], 1, item.name) }} className={classes.gridCardBtn(false)}>×1</button>
                              <button onClick={() => { logActive(item.name, item.category, template, item.hrs[template], 5, item.id); onItemPrint(item.hrs[template], 5, item.name) }} className={classes.gridCardBtn(false)}>×5</button>
                              <button onClick={() => onCustomPrint(item.hrs, item.name)} className={classes.gridCardBtn(true)}>🖨 ×</button>
                            </>
                          )}
                        </div>
                      </div>
                    )
                  })}
                </div>
                <div className="absolute bottom-2 right-2 text-[#6e7681] text-[10px] font-semibold pointer-events-none select-none bg-[#0d1117]/80 px-1.5 py-0.5 rounded">
                  {singleItems.length} item{singleItems.length !== 1 ? 's' : ''}{bundleItems.length > 0 ? ` · ${bundleItems.length} bundle${bundleItems.length !== 1 ? 's' : ''}` : ''}
                </div>
              </div>
            ) : (
              <div className="relative flex-1 min-h-0 flex flex-col">
                {isWide ? (
                  /* ── Grid mode (panel wider than half the screen) ── */
                  <div className={classes.panelGrid(isEditing ?? false)}>
                    {visibleItems.map(item => {
                      const cat = getCat(item.category ?? 'item', userCats)
                      return (
                        <div key={item.id} className={classes.gridCard}>
                          {/* Top row: category badge (left) · actions + favorite (right) */}
                          <div className="flex items-center justify-between gap-1 pl-2 pr-1 pt-[3px]">
                            <span
                              className={`${classes.catBadge} mr-0`}
                              style={{ color: cat.color, borderColor: cat.color + '66' }}
                            >{cat.label}</span>
                            <div className="flex items-center gap-[1px] shrink-0">
                              {isEditing && <button onClick={() => setEditingItem(item)} className={`${classes.gridCardIconBtnSm} text-[#6e7681] hover:text-[#58a6ff]`} title="Edit"><PencilIcon /></button>}
                              {isEditing && <button onClick={() => removeItem(item.id)} className={`${classes.gridCardIconBtnSm} text-[#6e7681] hover:text-[#f85149]`} title="Remove">✕</button>}
                              <button onClick={() => toggleFavorite(item.id)} className={`${classes.gridCardIconBtnSm} ${favorites.has(item.id) ? 'text-[#e3b341]' : 'text-[#6e7681] hover:text-[#e3b341]'}`} title={favorites.has(item.id) ? 'Remove from favorites' : 'Add to favorites'}><StarIcon filled={favorites.has(item.id)} /></button>
                            </div>
                          </div>
                          {/* Centred item name — fills the middle and wraps when needed.
                              No mt-auto on the buttons below, so this flex-1 actually grows.
                              pb nudges it up so top/bottom whitespace looks even. */}
                          <div className="flex-1 flex items-center justify-center px-2 pb-3 min-h-0 overflow-hidden">
                            <span className="text-white text-sm font-semibold text-center leading-snug break-words line-clamp-3">{item.name}</span>
                          </div>
                          <div className={`${classes.gridCardMeta} text-center`}>
                            IX {fmtDuration(item.hrs.IX)} · OX {fmtDuration(item.hrs.OX)} · UX {fmtDuration(item.hrs.UX)}
                          </div>
                          {/* Print buttons are hidden in edit mode so the name has room */}
                          {!isEditing && (
                            <div className="flex gap-1 px-2 pb-2 pt-1">
                              {item.hrs[template] === PROMPT_HRS ? (
                                <button onClick={() => setDatePromptItem(item)} className={classes.gridCardBtn(true)}>📅 Pick Date</button>
                              ) : (
                                <>
                                  <button onClick={() => { logActive(item.name, item.category, template, item.hrs[template], 1, item.id); onItemPrint(item.hrs[template], 1, item.name) }} className={classes.gridCardBtn(false)}>×1</button>
                                  <button onClick={() => { logActive(item.name, item.category, template, item.hrs[template], 5, item.id); onItemPrint(item.hrs[template], 5, item.name) }} className={classes.gridCardBtn(false)}>×5</button>
                                  <button onClick={() => onCustomPrint(item.hrs, item.name)} className={classes.gridCardBtn(true)}>🖨 ×</button>
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  /* ── List mode ── */
                  <div className={classes.panelList}>
                    {visibleItems.map(item => {
                      const cat = getCat(item.category ?? 'item', userCats)
                      return (
                        <div key={item.id} className={classes.itemRow}>
                          <div className={classes.itemInfo}>
                            <div className="flex items-center">
                              <span
                                className={classes.catBadge}
                                style={{ color: cat.color, borderColor: cat.color + '66' }}
                              >{cat.label}</span>
                              <span className={`${classes.itemName} flex-1`}>{item.name}</span>
                            </div>
                            <div className={classes.itemDur}>
                              IX {fmtDuration(item.hrs.IX)} · OX {fmtDuration(item.hrs.OX)} · UX {fmtDuration(item.hrs.UX)}
                            </div>
                          </div>
                          {item.hrs[template] === PROMPT_HRS ? (
                            <button onClick={() => setDatePromptItem(item)} className={classes.itemBtn(true)}>📅 Date</button>
                          ) : (
                            <>
                              <button onClick={() => { logActive(item.name, item.category, template, item.hrs[template], 1, item.id); onItemPrint(item.hrs[template], 1, item.name) }} className={classes.itemBtn(false)}>×1</button>
                              <button onClick={() => { logActive(item.name, item.category, template, item.hrs[template], 5, item.id); onItemPrint(item.hrs[template], 5, item.name) }} className={classes.itemBtn(false)}>×5</button>
                              <button onClick={() => onCustomPrint(item.hrs, item.name)} className={classes.itemBtn(true)}>🖨 ×</button>
                            </>
                          )}
                          <button onClick={() => toggleFavorite(item.id)} className={`shrink-0 w-7 h-7 flex items-center justify-center rounded bg-transparent border-0 cursor-pointer transition-colors opacity-0 group-hover:opacity-100 ${favorites.has(item.id) ? 'opacity-100 text-[#e3b341]' : 'text-[#6e7681] hover:text-[#e3b341]'}`} title={favorites.has(item.id) ? 'Remove from favorites' : 'Add to favorites'}><StarIcon filled={favorites.has(item.id)} /></button>
                          {isEditing && <button onClick={() => setEditingItem(item)} className={classes.itemEditBtn(true)} title="Edit"><PencilIcon /></button>}
                          {isEditing && <button onClick={() => removeItem(item.id)} className={classes.itemDelBtn(true)} title="Remove">✕</button>}
                        </div>
                      )
                    })}
                  </div>
                )}
                <div className="absolute bottom-2 right-2 text-[#6e7681] text-[10px] font-semibold pointer-events-none select-none bg-[#0d1117]/80 px-1.5 py-0.5 rounded">
                  {singleItems.length} item{singleItems.length !== 1 ? 's' : ''}{bundleItems.length > 0 ? ` · ${bundleItems.length} bundle${bundleItems.length !== 1 ? 's' : ''}` : ''}
                </div>
              </div>
            )}

            {isEditing && (
              <div className="shrink-0 flex items-center justify-between px-3 py-2 border-t border-[#30363d]">
                {confirmRemoveAll ? (
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-[#f85149] font-semibold">Remove all items?</span>
                    <button onClick={removeAllSingleItems} className="px-3 py-1 text-xs font-bold text-white bg-[#f85149] hover:bg-[#da3633] border-0 rounded cursor-pointer transition-colors">Yes</button>
                    <button onClick={() => setConfirmRemoveAll(false)} className="px-3 py-1 text-xs font-bold text-[#6e7681] border border-[#30363d] hover:border-[#6e7681] bg-transparent rounded cursor-pointer transition-colors">No</button>
                  </div>
                ) : (
                  <button onClick={() => setConfirmRemoveAll(true)} disabled={singleItems.length === 0} className="px-3 py-[7px] text-sm font-bold text-[#f85149] hover:text-white bg-transparent hover:bg-[#f85149] border border-[#f85149] rounded-lg cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed transition-colors">Remove All</button>
                )}
                <button onClick={() => setShowAddItem(true)} className="px-4 py-[7px] text-sm font-bold text-white bg-[#28a745] hover:bg-[#2ea043] border-0 rounded-lg cursor-pointer transition-colors">+ Add Item</button>
              </div>
            )}
          </>
        )}

        {/* ── Bundles tab ── */}
        {tab === 'bundles' && (
          <>
            {bundleItems.length === 0 ? (
              <div className={`${classes.panelList} flex`}>
                <div className={classes.emptyState}>
                  <span className="text-white font-medium">No bundles yet</span>
                  <span>Bundles let you print multiple labels at once for a full prep session</span>
                </div>
              </div>
            ) : (
              <div className={classes.bundleList}>
                {bundleItems.map((item, bundleIdx) => {
                  if (item.type !== 'bundle') return null
                  return (
                    <BundleCard
                      key={item.id}
                      bundle={item}
                      cardStyle={cardStyle}
                      activeLayout={activeLayout}
                      onPrint={(entries) => onPrintBundle(entries, 1)}
                      onDelete={() => removeItem(item.id)}
                      onMoveUp={bundleIdx > 0 ? () => moveBundle(item.id, -1) : undefined}
                      onMoveDown={bundleIdx < bundleItems.length - 1 ? () => moveBundle(item.id, 1) : undefined}
                      isEditing={isEditing ?? false}
                    />
                  )
                })}
              </div>
            )}

            {isEditing && (
              <div className={classes.addForm}>
                <button onClick={() => setShowAddBundle(true)} className={classes.addBtn}>
                  + New Bundle
                </button>
              </div>
            )}
          </>
        )}

        {/* ── Recent tab ── */}
        {tab === 'recent' && (
          <div className="flex flex-col flex-1 min-h-0">

            {/* Active items + floating Clear Active */}
            <div className="relative flex flex-col flex-1 min-h-0">

              {recentLoading ? (
                <div className="flex-1 flex items-center justify-center text-[#6e7681] text-sm">Loading…</div>

              ) : isWide ? (
                /* ── Wide mode: sections fill height, each scrolls horizontally ── */
                <div className="flex flex-col flex-1 min-h-0">
                  {/* Empty states */}
                  {expiringToday.length === 0 && currentlyActive.length === 0 && (
                    <div className={classes.emptyState}>
                      {filteredHistory.length === 0
                        ? <><span className="text-white font-medium">No print history</span><span>Successful print jobs will appear here</span></>
                        : <><span className="text-white font-medium">No active items</span><span>Items you print will appear here until they expire</span></>
                      }
                    </div>
                  )}

                  {/* Expiring Today */}
                  {expiringToday.length > 0 && (
                    <div className="flex flex-col flex-1 min-h-0">
                      <div className="px-3 pt-3 pb-1 text-[10px] font-bold text-[#e3b341] uppercase tracking-wider shrink-0">⚠ Expiring Today</div>
                      <div className="grid grid-flow-col [grid-template-rows:repeat(auto-fill,minmax(78px,auto))] [grid-auto-columns:190px] gap-2 px-2 pb-2 overflow-x-auto overflow-y-hidden flex-1 min-h-0 scrollbar-dark">
                        {expiringToday.map(entry => {
                          const cat = entry.category ? getCat(entry.category, userCats) : null
                          return (
                            <div key={entry.id} className={classes.gridCard}>
                              <div className={classes.gridCardHead}>
                                <div className="shrink-0 w-9 h-9 rounded bg-[#21262d] border border-[#e3b341] flex items-center justify-center text-white text-base font-bold">{entry.qty}</div>
                                <div className="flex-1 flex flex-col items-start min-w-0 gap-[2px]">
                                  {cat && <span className={classes.catBadge} style={{ color: cat.color, borderColor: cat.color + '66' }}>{cat.label}</span>}
                                  <span className="text-white text-sm font-medium truncate w-full">{entry.name ?? fmtDuration(entry.duration_hrs)}</span>
                                </div>
                                <button onClick={() => dismissActiveEntry(entry.id)} className={`${classes.gridCardIconBtn} text-[#6e7681] hover:text-[#f85149]`}>✕</button>
                              </div>
                              <div className={classes.gridCardMeta}>{entry.template} · {timeAgo(entry.printedAt)} → exp {fmtExpiry(entry.printedAt, entry.duration_hrs)}</div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {/* Divider between sections */}
                  {expiringToday.length > 0 && currentlyActive.length > 0 && (
                    <div className="shrink-0 border-t border-[#30363d]" />
                  )}

                  {/* Currently Active */}
                  {currentlyActive.length > 0 && (
                    <div className="flex flex-col flex-1 min-h-0">
                      <div className="px-3 pt-3 pb-1 text-[10px] font-bold text-[#3fb950] uppercase tracking-wider shrink-0">● Active</div>
                      <div className="grid grid-flow-col [grid-template-rows:repeat(auto-fill,minmax(78px,auto))] [grid-auto-columns:190px] gap-2 px-2 pb-2 overflow-x-auto overflow-y-hidden flex-1 min-h-0 scrollbar-dark">
                        {currentlyActive.map(entry => {
                          const cat = entry.category ? getCat(entry.category, userCats) : null
                          return (
                            <div key={entry.id} className={classes.gridCard}>
                              <div className={classes.gridCardHead}>
                                <div className="shrink-0 w-9 h-9 rounded bg-[#21262d] border border-[#3fb950] flex items-center justify-center text-white text-base font-bold">{entry.qty}</div>
                                <div className="flex-1 flex flex-col items-start min-w-0 gap-[2px]">
                                  {cat && <span className={classes.catBadge} style={{ color: cat.color, borderColor: cat.color + '66' }}>{cat.label}</span>}
                                  <span className="text-white text-sm font-medium truncate w-full">{entry.name ?? fmtDuration(entry.duration_hrs)}</span>
                                </div>
                                <button onClick={() => dismissActiveEntry(entry.id)} className={`${classes.gridCardIconBtn} text-[#6e7681] hover:text-[#f85149]`}>✕</button>
                              </div>
                              <div className={classes.gridCardMeta}>{entry.template} · {timeAgo(entry.printedAt)} → exp {fmtExpiry(entry.printedAt, entry.duration_hrs)}</div>
                            </div>
                          )
                        })}
                      </div>
                    </div>
                  )}
                </div>

              ) : (
                /* ── Narrow mode: vertical scroll list ── */
                <div className={classes.panelList}>
                  {/* Empty states */}
                  {filteredHistory.length === 0 && expiringToday.length === 0 && currentlyActive.length === 0 && (
                    <div className={classes.emptyState}>
                      <span className="text-white font-medium">No print history</span>
                      <span>Successful print jobs will appear here</span>
                    </div>
                  )}
                  {expiringToday.length === 0 && currentlyActive.length === 0 && filteredHistory.length > 0 && (
                    <div className={classes.emptyState}>
                      <span className="text-white font-medium">No active items</span>
                      <span>Items you print will appear here until they expire</span>
                    </div>
                  )}

                  {/* Expiring Today */}
                  {expiringToday.length > 0 && (
                    <>
                      <div className="px-3 pt-3 pb-1 text-[10px] font-bold text-[#e3b341] uppercase tracking-wider">⚠ Expiring Today</div>
                      {expiringToday.map(entry => {
                        const cat = entry.category ? getCat(entry.category, userCats) : null
                        return (
                          <div key={entry.id} className="flex items-center gap-3 px-3 py-[10px] border-b border-[#30363d] hover:bg-[#161b22] transition-colors">
                            <div className="shrink-0 w-10 h-10 rounded-lg bg-[#21262d] border border-[#e3b341] flex items-center justify-center text-white text-lg font-bold">{entry.qty}</div>
                            <div className="flex-1 min-w-0">
                              {cat && <span className={classes.catBadge} style={{ color: cat.color, borderColor: cat.color + '66' }}>{cat.label}</span>}
                              <div className="text-white text-sm font-medium truncate">{entry.name ?? fmtDuration(entry.duration_hrs)}</div>
                              <div className="text-[#6e7681] text-xs mt-[1px]">{entry.template} · {timeAgo(entry.printedAt)} → exp {fmtExpiry(entry.printedAt, entry.duration_hrs)}</div>
                            </div>
                            <button onClick={() => dismissActiveEntry(entry.id)} className="shrink-0 w-7 h-7 flex items-center justify-center rounded bg-transparent border-0 cursor-pointer text-[#6e7681] hover:text-[#f85149] transition-colors text-base leading-none">✕</button>
                          </div>
                        )
                      })}
                    </>
                  )}

                  {/* Currently Active */}
                  {currentlyActive.length > 0 && (
                    <>
                      <div className="px-3 pt-3 pb-1 text-[10px] font-bold text-[#3fb950] uppercase tracking-wider">● Active</div>
                      {currentlyActive.map(entry => {
                        const cat = entry.category ? getCat(entry.category, userCats) : null
                        return (
                          <div key={entry.id} className="flex items-center gap-3 px-3 py-[10px] border-b border-[#30363d] hover:bg-[#161b22] transition-colors">
                            <div className="shrink-0 w-10 h-10 rounded-lg bg-[#21262d] border border-[#3fb950] flex items-center justify-center text-white text-lg font-bold">{entry.qty}</div>
                            <div className="flex-1 min-w-0">
                              {cat && <span className={classes.catBadge} style={{ color: cat.color, borderColor: cat.color + '66' }}>{cat.label}</span>}
                              <div className="text-white text-sm font-medium truncate">{entry.name ?? fmtDuration(entry.duration_hrs)}</div>
                              <div className="text-[#6e7681] text-xs mt-[1px]">{entry.template} · {timeAgo(entry.printedAt)} → exp {fmtExpiry(entry.printedAt, entry.duration_hrs)}</div>
                            </div>
                            <button onClick={() => dismissActiveEntry(entry.id)} className="shrink-0 w-7 h-7 flex items-center justify-center rounded bg-transparent border-0 cursor-pointer text-[#6e7681] hover:text-[#f85149] transition-colors text-base leading-none">✕</button>
                          </div>
                        )
                      })}
                    </>
                  )}
                </div>
              )}

              {/* Clear Active — floats over content, always visible */}
              {!recentLoading && (expiringToday.length > 0 || currentlyActive.length > 0) && (
                <div className="absolute bottom-0 right-0 px-3 py-2">
                  <button onClick={clearActive} className="px-3 py-1 text-xs font-bold text-[#6e7681] hover:text-[#f85149] bg-[#0d1117] border border-[#30363d] hover:border-[#f85149] rounded cursor-pointer transition-colors">
                    Clear Active
                  </button>
                </div>
              )}
            </div>

            {/* Pinned bottom: print history header + horizontal scroll strip */}
            {!recentLoading && (filteredHistory.length > 0 || expiringToday.length > 0 || currentlyActive.length > 0) && (
              <div className="shrink-0 border-t border-[#30363d]">
                <div className="flex items-center justify-between px-3 pt-2 pb-1">
                  <span className="text-[10px] font-bold text-[#6e7681] uppercase tracking-wider">Print History</span>
                  {filteredHistory.length > 0 && (
                    <button onClick={clearHistory} className="text-[10px] font-semibold text-[#6e7681] hover:text-[#f85149] cursor-pointer bg-transparent border-0 transition-colors">
                      Clear
                    </button>
                  )}
                </div>
                {filteredHistory.length === 0 ? (
                  <div className="text-[#6e7681] text-xs text-center py-3 px-3">No history yet</div>
                ) : (
                  <div className="flex gap-2 px-2 pb-2 overflow-x-auto scrollbar-dark">
                    {[...filteredHistory]
                      .sort((a, b) => b.printed_at.localeCompare(a.printed_at))
                      .map((job, i) => (
                        <div key={i} className={`${classes.gridCard} w-[190px] shrink-0`}>
                          <div className={classes.gridCardHead}>
                            <div className={classes.recentBadge}>{job.template}</div>
                            <span className="flex-1 text-white text-sm font-medium truncate min-w-0">{fmtDuration(job.duration_hrs)}</span>
                          </div>
                          <div className={classes.gridCardMeta}>
                            {new Date(job.printed_at).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })} · ×{job.qty} · {timeAgo(job.printed_at)}
                          </div>
                          <div className={classes.gridCardBtns}>
                            <button onClick={() => onPrint(job.duration_hrs, job.qty)} className={classes.gridCardBtn(false)}>Reprint</button>
                          </div>
                        </div>
                      ))
                    }
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {showAddItem && (
        <AddEditItemPage
          categories={allCats}
          durationOptions={durationOptions}
          onSave={addItem}
          onAddCategory={addCategory}
          onClose={() => setShowAddItem(false)}
        />
      )}
      {editingItem && (
        <AddEditItemPage
          item={editingItem}
          categories={allCats}
          durationOptions={durationOptions}
          onSave={saveEditItem}
          onAddCategory={addCategory}
          onClose={() => setEditingItem(null)}
        />
      )}
      {showAddBundle && (
        <AddBundlePage
          quickItems={singleItems}
          durationOptions={durationOptions}
          onAdd={addBundle}
          onClose={() => setShowAddBundle(false)}
        />
      )}
      {datePromptItem && (
        <DatePromptPage
          itemName={datePromptItem.name}
          template={template}
          onPrint={(hrs, qty) => { logActive(datePromptItem.name, datePromptItem.category, template, hrs, qty); onItemPrint(hrs, qty, datePromptItem.name) }}
          onClose={() => setDatePromptItem(null)}
        />
      )}
    </>
  )
}
