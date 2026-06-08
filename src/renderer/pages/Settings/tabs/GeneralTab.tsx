import { useState } from 'react'
import SettingsCard from '../../../components/settings/SettingsCard'
import { ui } from '../../../components/settings/styles'
import { loadItems, loadUserCats, persist } from '../../Preppy/utils'
import {
  ITEMS_KEY, CATS_KEY,
  PRINT_COUNTS_KEY, HOURLY_COUNTS_KEY, FAVORITES_KEY,
  WIDTH_KEY, PANEL_COLLAPSED_KEY, LEFT_COLLAPSED_KEY,
} from '../../Preppy/constants'
import { SHELF_LIFE_ITEMS, importShelfLifeItems } from '../../Preppy/shelfLifeGuide'

const classes = {
  result: (ok: boolean) =>
    `text-sm rounded-lg px-4 py-3 border ${ok ? 'bg-[#0d2818] border-[#238636] text-[#3fb950]' : 'bg-[#21262d] border-[#30363d] text-[#8b949e]'}`,
}

export default function GeneralTab() {
  const [totalCount,   setTotalCount]   = useState(() => loadItems().length)
  const [result,       setResult]       = useState<{ added: number; updated: number; skipped: number } | null>(null)
  const [confirmClear, setConfirmClear] = useState(false)
  const [resetMsg,     setResetMsg]     = useState<string | null>(null)

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

  function clearKeys(keys: string[], msg: string) {
    keys.forEach(k => localStorage.removeItem(k))
    setResetMsg(msg)
  }

  return (
    <div className="flex flex-col gap-5 max-w-2xl">

      {/* ── Shelf Life Guide import ── */}
      <SettingsCard
        title="Shelf Life Guide"
        desc={<>
          Import the {SHELF_LIFE_ITEMS.length} products from the Shelf Life Guide as quick items.
          Each item is pre-filled with its <b>UX</b> (received), <b>OX</b> (prepped) and <b>IX</b>{' '}
          (in-use) shelf life. Products without a fixed shelf life — use-by-date or
          keep-prior-stage items — will prompt for an expiration date on the calendar when printed.
        </>}
      >
        <div className={ui.stat}>
          Current quick items &amp; bundles: <span className={ui.statNum}>{totalCount}</span>
        </div>
        <button onClick={handleImport} className={`self-start ${ui.primaryBtn}`}>
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
      </SettingsCard>

      {/* ── Clear all quick items ── */}
      <SettingsCard
        title="Clear Quick Items"
        desc="Permanently delete all quick items and bundles. This cannot be undone — use the Shelf Life Guide import above to restore the default items."
      >
        <div className={ui.stat}>
          Current quick items &amp; bundles: <span className={ui.statNum}>{totalCount}</span>
        </div>
        {confirmClear ? (
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-sm text-[#f85149] font-semibold">
              Delete all {totalCount} item{totalCount !== 1 ? 's' : ''}? This cannot be undone.
            </span>
            <button onClick={handleClearAll} className={ui.dangerSolid}>Yes, delete all</button>
            <button onClick={() => setConfirmClear(false)} className={ui.secondaryBtn}>Cancel</button>
          </div>
        ) : (
          <button onClick={() => setConfirmClear(true)} disabled={totalCount === 0} className={`self-start ${ui.dangerBtn}`}>
            Delete all quick items
          </button>
        )}
      </SettingsCard>

      {/* ── Data management ── */}
      <SettingsCard
        title="Usage Data & Layout"
        desc="Reset the data Preppy collects to power sorting and remember your screen layout. These don't affect your quick items."
      >
        <div className={ui.actionRow}>
          <button
            onClick={() => clearKeys([PRINT_COUNTS_KEY, HOURLY_COUNTS_KEY], 'Usage history cleared — Most Popular and Recommended sorting has been reset.')}
            className={ui.neutralBtn}
          >Reset usage history</button>
          <button
            onClick={() => clearKeys([FAVORITES_KEY], 'Favorites cleared.')}
            className={ui.neutralBtn}
          >Clear favorites</button>
          <button
            onClick={() => clearKeys([WIDTH_KEY, PANEL_COLLAPSED_KEY, LEFT_COLLAPSED_KEY], 'Panel layout reset — changes apply next time you open Print Labels.')}
            className={ui.neutralBtn}
          >Reset panel layout</button>
        </div>
        {resetMsg && <div className={ui.note}>{resetMsg}</div>}
      </SettingsCard>

    </div>
  )
}
