import { useState, useEffect, useRef } from 'react'
import type { QuickListEntry, QuickSingleItem, BundleEntry, CategoryDef, PrintJob, LabelTemplate, TemplateHrs } from '../pages/Preppy/types'
import { ITEM_CATEGORIES, CATS_KEY, ITEMS_KEY } from '../pages/Preppy/constants'
import { loadItems, loadUserCats, persist, fmtDuration, timeAgo, getCat } from '../pages/Preppy/utils'
import { PencilIcon } from './Icons'
import AddEditItemPage from '../pages/AddEditItemPage'
import AddBundlePage from '../pages/AddBundlePage'
import { classes } from './QuickItemsPanel.styles'

type SortField = 'name' | 'cat' | 'recent'

interface PanelProps {
  onPrint:          (hrs: number, qty: number) => void
  onPrintBundle:    (entries: BundleEntry[], multiplier: number) => void
  onCustomPrint:    (templateHrs: TemplateHrs, label: string) => void
  template:         LabelTemplate
  durationOptions:  { label: string; hrs: number }[]
  collapsed:        boolean
  onToggleCollapse: () => void
}

export default function QuickItemsPanel({ onPrint, onPrintBundle, onCustomPrint, template, durationOptions, collapsed, onToggleCollapse }: PanelProps) {
  const [items,         setItems]         = useState<QuickListEntry[]>(() => loadItems())
  const [userCats,      setUserCats]      = useState<CategoryDef[]>(() => loadUserCats())
  const [tab,           setTab]           = useState<'items' | 'bundles' | 'recent'>('items')
  const [sortField,     setSortField]     = useState<SortField>('name')
  const [sortAsc,       setSortAsc]       = useState(true)
  const [filterCats,    setFilterCats]    = useState<Set<string>>(new Set())
  const [recentJobs,    setRecentJobs]    = useState<PrintJob[]>([])
  const [recentLoading, setRecentLoading] = useState(false)
  const [showAddBundle, setShowAddBundle] = useState(false)
  const [showAddItem,   setShowAddItem]   = useState(false)
  const [editingItem,   setEditingItem]   = useState<QuickSingleItem | null>(null)
  const [isWide,        setIsWide]        = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = panelRef.current
    if (!el) return
    const ro = new ResizeObserver(entries => {
      for (const entry of entries) {
        setIsWide(entry.contentRect.width > window.innerWidth / 2)
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
  }, [tab])

  const allCats     = [...ITEM_CATEGORIES, ...userCats]
  const singleItems = items.filter((i): i is QuickSingleItem => i.type === 'item')
  const bundleItems = items.filter(i => i.type === 'bundle')

  const visibleItems = (() => {
    const list = filterCats.size > 0 ? singleItems.filter(i => filterCats.has(i.category ?? 'item')) : singleItems
    return [...list].sort((a, b) => {
      let cmp = 0
      if (sortField === 'name') {
        cmp = a.name.localeCompare(b.name)
      } else if (sortField === 'cat') {
        const order: string[] = ITEM_CATEGORIES.map(c => c.id)
        const ai = order.indexOf(a.category ?? 'item')
        const bi = order.indexOf(b.category ?? 'item')
        cmp = ai !== bi ? ai - bi : a.name.localeCompare(b.name)
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
      <div className={classes.panel} ref={panelRef}>
        {/* Header */}
        <div className={classes.panelHead}>
          <span className={classes.panelTitle}>Quick Items</span>
          <div className="flex items-center gap-2">
            <span className={classes.panelCount}>
              {singleItems.length} item{singleItems.length !== 1 ? 's' : ''}{bundleItems.length > 0 ? ` · ${bundleItems.length} bundle${bundleItems.length !== 1 ? 's' : ''}` : ''}
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
          <button className={classes.panelTab(tab === 'items')}   onClick={() => setTab('items')}>Items</button>
          <button className={classes.panelTab(tab === 'bundles')} onClick={() => setTab('bundles')}>Bundles</button>
          <button className={classes.panelTab(tab === 'recent')}  onClick={() => setTab('recent')}>Recent</button>
        </div>

        {/* ── Items tab ── */}
        {tab === 'items' && (
          <>
            {/* Filter + sort controls */}
            <div className="shrink-0 border-b border-[#30363d]">
              {/* Category filter pills — multi-select */}
              <div className={classes.filterBar} style={{ paddingBottom: '6px' }}>
                <button
                  className={classes.filterPill(filterCats.size === 0)}
                  onClick={() => setFilterCats(new Set())}
                >All</button>
                {allCats.map(cat => {
                  const active = filterCats.has(cat.id)
                  return (
                    <button
                      key={cat.id}
                      className={classes.filterPill(active)}
                      style={active ? {} : { borderColor: cat.color + '55', color: cat.color }}
                      onClick={() => setFilterCats(prev => {
                        const next = new Set(prev)
                        if (next.has(cat.id)) next.delete(cat.id)
                        else next.add(cat.id)
                        return next
                      })}
                    >{cat.label}</button>
                  )
                })}
              </div>
              {/* Sort by row */}
              <div className="flex items-center gap-2 px-3 pb-2">
                <span className="text-[#6e7681] text-[10px] font-semibold uppercase tracking-wide shrink-0">Sort by</span>
                <select
                  value={sortField}
                  onChange={e => { const f = e.target.value as SortField; setSortField(f); setSortAsc(f !== 'recent') }}
                  className="flex-1 bg-[#161b22] border border-[#30363d] rounded px-2 py-[5px] text-white text-xs outline-none cursor-pointer hover:border-[#6e7681] transition-colors"
                >
                  <option value="name">Name</option>
                  <option value="cat">Category</option>
                  <option value="recent">Recently Added</option>
                </select>
                <button
                  onClick={() => setSortAsc(prev => !prev)}
                  title={sortAsc ? 'Ascending — click to reverse' : 'Descending — click to reverse'}
                  className="w-7 h-7 shrink-0 flex items-center justify-center rounded border border-[#30363d] bg-transparent text-[#adbac7] hover:text-white hover:border-[#6e7681] cursor-pointer transition-colors text-sm font-bold"
                >{sortAsc ? '↑' : '↓'}</button>
              </div>
            </div>

            {visibleItems.length === 0 ? (
              <div className={`${classes.panelList} flex`}>
                <div className={classes.emptyState}>
                  <span className="text-white font-medium">{singleItems.length === 0 ? 'No items yet' : 'No items match filter'}</span>
                  <span>{singleItems.length === 0 ? 'Use the button below to add your first item' : 'Try a different category filter'}</span>
                </div>
              </div>
            ) : isWide ? (
              /* ── Grid mode (panel wider than half the screen) ── */
              <div className={classes.panelGrid}>
                {visibleItems.map(item => {
                  const cat = getCat(item.category ?? 'item', userCats)
                  return (
                    <div key={item.id} className={classes.gridCard}>
                      <div className={classes.gridCardHead}>
                        <span
                          className={classes.catBadge}
                          style={{ color: cat.color, borderColor: cat.color + '66' }}
                        >{cat.label}</span>
                        <span className="flex-1 text-white text-sm font-medium truncate min-w-0">{item.name}</span>
                        <button onClick={() => setEditingItem(item)} className={`${classes.gridCardIconBtn} text-[#6e7681] hover:text-[#58a6ff]`} title="Edit"><PencilIcon /></button>
                        <button onClick={() => removeItem(item.id)} className={`${classes.gridCardIconBtn} text-[#6e7681] hover:text-[#f85149]`} title="Remove">✕</button>
                      </div>
                      <div className={classes.gridCardMeta}>
                        IX {fmtDuration(item.hrs.IX)} · OX {fmtDuration(item.hrs.OX)} · UX {fmtDuration(item.hrs.UX)}
                      </div>
                      <div className={classes.gridCardBtns}>
                        <button onClick={() => onPrint(item.hrs[template], 1)} className={classes.gridCardBtn(false)}>×1</button>
                        <button onClick={() => onPrint(item.hrs[template], 5)} className={classes.gridCardBtn(false)}>×5</button>
                        <button onClick={() => onCustomPrint(item.hrs, item.name)} className={classes.gridCardBtn(true)}>🖨 ×</button>
                      </div>
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
                      <button onClick={() => onPrint(item.hrs[template], 1)} className={classes.itemBtn(false)}>×1</button>
                      <button onClick={() => onPrint(item.hrs[template], 5)} className={classes.itemBtn(false)}>×5</button>
                      <button onClick={() => onCustomPrint(item.hrs, item.name)} className={classes.itemBtn(true)}>🖨 ×</button>
                      <button onClick={() => setEditingItem(item)} className={classes.itemEditBtn} title="Edit"><PencilIcon /></button>
                      <button onClick={() => removeItem(item.id)} className={classes.itemDelBtn} title="Remove">✕</button>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Add Item button — bottom right */}
            <div className="shrink-0 flex justify-end px-3 py-2 border-t border-[#30363d]">
              <button
                onClick={() => setShowAddItem(true)}
                className="px-4 py-[7px] text-sm font-bold text-white bg-[#28a745] hover:bg-[#2ea043] border-0 rounded-lg cursor-pointer transition-colors"
              >+ Add Item</button>
            </div>
          </>
        )}

        {/* ── Bundles tab ── */}
        {tab === 'bundles' && (
          <>
            <div className={classes.panelList}>
              {bundleItems.length === 0 ? (
                <div className={classes.emptyState}>
                  <span className="text-white font-medium">No bundles yet</span>
                  <span>Bundles let you print multiple labels at once for a full prep session</span>
                </div>
              ) : (
                bundleItems.map(item => {
                  if (item.type !== 'bundle') return null
                  const total   = item.entries.reduce((s, e) => s + e.qty, 0)
                  const summary = item.entries.map(e => e.name ?? fmtDuration(e.hrs[template])).join(' + ')
                  return (
                    <div key={item.id} className={classes.itemRow}>
                      <div className={classes.itemInfo}>
                        <div className="flex items-center">
                          <span className={classes.bundleBadge}>BUNDLE</span>
                          <span className={`${classes.itemName} flex-1`}>{item.name}</span>
                        </div>
                        <div className={classes.itemDur}>{total} label{total !== 1 ? 's' : ''} · {summary}</div>
                      </div>
                      <button onClick={() => onPrintBundle(item.entries, 1)} className={classes.itemBtn(true)}>Print</button>
                      <button onClick={() => removeItem(item.id)} className={classes.itemDelBtn} title="Remove">✕</button>
                    </div>
                  )
                })
              )}
            </div>

            <div className={classes.addForm}>
              <button onClick={() => setShowAddBundle(true)} className={classes.addBtn}>
                + New Bundle
              </button>
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
    </>
  )
}
