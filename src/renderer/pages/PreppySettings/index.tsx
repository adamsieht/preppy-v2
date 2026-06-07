import { useState } from 'react'
import PageLayout from '../../components/PageLayout'
import { loadItems, loadUserCats, persist } from '../Preppy/utils'
import { ITEMS_KEY, CATS_KEY } from '../Preppy/constants'
import { SHELF_LIFE_ITEMS, importShelfLifeItems } from '../Preppy/shelfLifeGuide'

const classes = {
  wrap:      'max-w-2xl mx-auto flex flex-col gap-6',
  card:      'bg-[#161b22] border border-[#30363d] rounded-xl p-5 flex flex-col gap-3',
  cardTitle: 'text-white font-bold text-base',
  cardDesc:  'text-[#8b949e] text-sm leading-relaxed',
  stat:      'text-[#adbac7] text-sm',
  statNum:   'text-white font-bold',
  btn:       'self-start px-5 py-2.5 text-sm font-bold text-white bg-[#28a745] hover:bg-[#2ea043] border-0 rounded-lg cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition-colors',
  btnDanger: 'self-start px-5 py-2.5 text-sm font-bold text-[#f85149] bg-transparent hover:bg-[#f85149] hover:text-white border border-[#f85149] rounded-lg cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed transition-colors',
  result:    (ok: boolean) => `text-sm rounded-lg px-4 py-3 border ${ok ? 'bg-[#0d2818] border-[#238636] text-[#3fb950]' : 'bg-[#21262d] border-[#30363d] text-[#8b949e]'}`,
}

export default function PreppySettings() {
  const [totalCount,    setTotalCount]    = useState(() => loadItems().length)
  const [result,        setResult]        = useState<{ added: number; updated: number; skipped: number } | null>(null)
  const [confirmClear,  setConfirmClear]  = useState(false)

  function handleImport() {
    const existingItems = loadItems()
    const existingCats  = loadUserCats()
    const { items, cats, added, updated, skipped } = importShelfLifeItems(existingItems, existingCats)
    persist(ITEMS_KEY, items)
    persist(CATS_KEY, cats)
    setTotalCount(items.length)
    setResult({ added, updated, skipped })
  }

  function handleClearAll() {
    persist(ITEMS_KEY, [])
    setTotalCount(0)
    setConfirmClear(false)
    setResult(null)
  }

  return (
    <PageLayout title="Preppy Settings" back="/debug" noPad>
      <div className="p-4 overflow-y-auto h-full">
        <div className={classes.wrap}>

          {/* ── Shelf Life Guide import ─────────────────────────────────── */}
          <div className={classes.card}>
            <div className={classes.cardTitle}>Shelf Life Guide</div>
            <div className={classes.cardDesc}>
              Import the {SHELF_LIFE_ITEMS.length} products from the Shelf Life Guide as quick items.
              Each item is pre-filled with its <b>UX</b> (received), <b>OX</b> (prepped) and <b>IX</b>{' '}
              (in-use) shelf life. Products without a fixed shelf life — use-by-date or
              keep-prior-stage items — will prompt for an expiration date on the calendar when printed.
            </div>
            <div className={classes.stat}>
              Current quick items &amp; bundles: <span className={classes.statNum}>{totalCount}</span>
            </div>
            <button onClick={handleImport} className={classes.btn}>
              Import Shelf Life Guide items
            </button>
            {result && (
              <div className={classes.result(result.added > 0 || result.updated > 0)}>
                {result.added > 0 && `Added ${result.added} new item${result.added !== 1 ? 's' : ''}. `}
                {result.updated > 0 && `Updated shelf life for ${result.updated} item${result.updated !== 1 ? 's' : ''}. `}
                {result.added === 0 && result.updated === 0 && 'All items already up to date.'}
                {result.skipped > 0 && ` (${result.skipped} unchanged)`}
              </div>
            )}
            <div className="text-[#6e7681] text-xs">
              Running import again updates shelf life values for existing items without removing your custom ones.
            </div>
          </div>

          {/* ── Clear all quick items ───────────────────────────────────── */}
          <div className={classes.card}>
            <div className={classes.cardTitle}>Clear Quick Items</div>
            <div className={classes.cardDesc}>
              Permanently delete all quick items and bundles. This cannot be undone — use the
              Shelf Life Guide import above to restore the default items.
            </div>
            <div className={classes.stat}>
              Current quick items &amp; bundles: <span className={classes.statNum}>{totalCount}</span>
            </div>
            {confirmClear ? (
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-sm text-[#f85149] font-semibold">
                  Delete all {totalCount} item{totalCount !== 1 ? 's' : ''}? This cannot be undone.
                </span>
                <button onClick={handleClearAll} className="px-4 py-2 text-sm font-bold text-white bg-[#f85149] hover:bg-[#da3633] border-0 rounded-lg cursor-pointer transition-colors">
                  Yes, delete all
                </button>
                <button onClick={() => setConfirmClear(false)} className="px-4 py-2 text-sm font-bold text-[#6e7681] hover:text-white bg-transparent border border-[#30363d] hover:border-[#6e7681] rounded-lg cursor-pointer transition-colors">
                  Cancel
                </button>
              </div>
            ) : (
              <button onClick={() => setConfirmClear(true)} disabled={totalCount === 0} className={classes.btnDanger}>
                Delete all quick items
              </button>
            )}
          </div>

        </div>
      </div>
    </PageLayout>
  )
}
