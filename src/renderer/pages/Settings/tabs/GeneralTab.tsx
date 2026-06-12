import { useRef, useState } from 'react'
import SettingsCard from '../../../components/settings/SettingsCard'
import { ui } from '../../../components/settings/styles'
import { loadItems, loadUserCats, persist } from '../../Preppy/utils'
import {
  ITEMS_KEY, CATS_KEY,
  PRINT_COUNTS_KEY, HOURLY_COUNTS_KEY, FAVORITES_KEY,
  WIDTH_KEY, PANEL_COLLAPSED_KEY, LEFT_COLLAPSED_KEY,
  QUICK_SORT_FIELD_KEY, QUICK_SORT_DIR_KEY, QUICK_CARD_STYLE_KEY, QUICK_SORT_FIELDS,
  THEME_KEY, ACCENT_KEY, ACCENT_COLORS, DOW_ACCENT_PALETTE, getDowAccentIdx, applyDowAccent,
} from '../../Preppy/constants'
import type { QuickSortField, QuickCardStyle, AppTheme, AccentColor } from '../../Preppy/constants'
import { SHELF_LIFE_ITEMS, importShelfLifeItems } from '../../Preppy/shelfLifeGuide'
import { LABEL_DATE_CALC_KEY } from '../../Preppy/labelDateCalc'

const CONFIG_BACKUP_VERSION = 1

const DISPLAY_PREF_KEYS = [
  QUICK_SORT_FIELD_KEY,
  QUICK_SORT_DIR_KEY,
  QUICK_CARD_STYLE_KEY,
  THEME_KEY,
  ACCENT_KEY,
] as const

const classes = {
  result: (ok: boolean) =>
    `text-sm rounded-lg px-4 py-3 border ${ok ? 'bg-[#0d2818] border-[#238636] text-[#3fb950]' : 'bg-[#21262d] border-[#30363d] text-[#8b949e]'}`,
  segBtn: (active: boolean) =>
    `flex-1 px-4 py-2 rounded-lg border text-sm font-bold cursor-pointer transition-colors ${active ? 'border-[#28a745] bg-[#28a745] text-white' : 'border-[#30363d] bg-transparent text-[#adbac7] hover:border-[#6e7681] hover:text-white'}`,
}

export default function GeneralTab() {
  const [totalCount,     setTotalCount]     = useState(() => loadItems().length)
  const [result,         setResult]         = useState<{ added: number; updated: number; skipped: number } | null>(null)
  const [confirmClear,   setConfirmClear]   = useState(false)
  const [resetMsg,       setResetMsg]       = useState<string | null>(null)
  const [backupMsg,      setBackupMsg]      = useState<{ ok: boolean; text: string } | null>(null)
  const importRef = useRef<HTMLInputElement>(null)
  const [sortField,    setSortField]    = useState<QuickSortField>(() => {
    const v = localStorage.getItem(QUICK_SORT_FIELD_KEY) as QuickSortField | null
    return v && QUICK_SORT_FIELDS.some(o => o.value === v) ? v : 'popular'
  })
  const [sortAsc,      setSortAsc]      = useState(() => (localStorage.getItem(QUICK_SORT_DIR_KEY) ?? 'desc') === 'asc')
  const [cardStyle,    setCardStyle]    = useState<QuickCardStyle>(() => localStorage.getItem(QUICK_CARD_STYLE_KEY) === 'label' ? 'label' : 'standard')
  const [theme,        setTheme]        = useState<AppTheme>(() => (localStorage.getItem(THEME_KEY) as AppTheme) ?? 'dark')
  const [accent,       setAccent]       = useState<AccentColor>(() => (localStorage.getItem(ACCENT_KEY) as AccentColor) ?? 'green')

  function changeSortField(f: QuickSortField) {
    setSortField(f)
    localStorage.setItem(QUICK_SORT_FIELD_KEY, f)
  }
  function toggleSortDir() {
    setSortAsc(prev => {
      const next = !prev
      localStorage.setItem(QUICK_SORT_DIR_KEY, next ? 'asc' : 'desc')
      return next
    })
  }
  function changeCardStyle(s: QuickCardStyle) {
    setCardStyle(s)
    localStorage.setItem(QUICK_CARD_STYLE_KEY, s)
  }

  function changeTheme(t: AppTheme) {
    setTheme(t)
    localStorage.setItem(THEME_KEY, t)
    document.documentElement.classList.toggle('theme-light', t === 'light')
  }

  function changeAccent(a: AccentColor) {
    setAccent(a)
    localStorage.setItem(ACCENT_KEY, a)
    if (a === 'dow') {
      document.documentElement.removeAttribute('data-accent')
      applyDowAccent()
    } else {
      document.documentElement.style.removeProperty('--c-accent')
      document.documentElement.style.removeProperty('--c-accent-hover')
      document.documentElement.setAttribute('data-accent', a)
    }
  }

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

  async function handleExportConfig() {
    try {
      const config = await window.electronAPI.getConfig() as Record<string, unknown> & {
        printer?: { device?: string; labelhomeX?: number; labelhomeY?: number }
      }
      const updateSettings = await window.electronAPI.getUpdateSettings()
      const backup = {
        _version: CONFIG_BACKUP_VERSION,
        _exported: new Date().toISOString(),
        quickItems:        localStorage.getItem(ITEMS_KEY),
        categories:        localStorage.getItem(CATS_KEY),
        dateCalcSettings:  localStorage.getItem(LABEL_DATE_CALC_KEY),
        displayPrefs: Object.fromEntries(
          DISPLAY_PREF_KEYS.map(k => [k, localStorage.getItem(k)])
        ),
        printerDevice:  config.printer?.device ?? null,
        labelHomeX:     config.printer?.labelhomeX ?? null,
        labelHomeY:     config.printer?.labelhomeY ?? null,
        updateSettings: {
          repoOwner: updateSettings.repoOwner,
          repoName:  updateSettings.repoName,
        },
      }
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' })
      const url  = URL.createObjectURL(blob)
      const a    = document.createElement('a')
      a.href     = url
      a.download = `preppy-config-${new Date().toISOString().slice(0, 10)}.json`
      a.click()
      URL.revokeObjectURL(url)
      setBackupMsg({ ok: true, text: 'Config exported — save the file somewhere safe.' })
    } catch (err) {
      setBackupMsg({ ok: false, text: `Export failed: ${err}` })
    }
  }

  function handleImportConfig(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = async ev => {
      try {
        const text = ev.target?.result
        if (typeof text !== 'string') throw new Error('Could not read file.')
        const data = JSON.parse(text) as Record<string, unknown>
        if (data._version !== CONFIG_BACKUP_VERSION) throw new Error('Unrecognised backup format.')

        if (typeof data.quickItems === 'string')       localStorage.setItem(ITEMS_KEY, data.quickItems)
        if (typeof data.categories === 'string')       localStorage.setItem(CATS_KEY, data.categories)
        if (typeof data.dateCalcSettings === 'string') localStorage.setItem(LABEL_DATE_CALC_KEY, data.dateCalcSettings)

        const prefs = data.displayPrefs as Record<string, string | null> | undefined
        if (prefs) {
          for (const k of DISPLAY_PREF_KEYS) {
            if (typeof prefs[k] === 'string') localStorage.setItem(k, prefs[k]!)
          }
        }

        if (typeof data.printerDevice === 'string' && data.printerDevice) {
          await window.electronAPI.setPrinterDevice(data.printerDevice)
        }
        if (typeof data.labelHomeX === 'number' && typeof data.labelHomeY === 'number') {
          await window.electronAPI.setLabelHome(data.labelHomeX, data.labelHomeY)
        }
        if (data.updateSettings && typeof data.updateSettings === 'object') {
          const us = data.updateSettings as { repoOwner?: string; repoName?: string }
          if (us.repoOwner || us.repoName) {
            await window.electronAPI.saveUpdateSettings({
              repoOwner: us.repoOwner ?? '',
              repoName:  us.repoName  ?? '',
              token:     '',
            })
          }
        }

        setBackupMsg({ ok: true, text: 'Config imported — reloading…' })
        setTimeout(() => window.location.reload(), 800)
      } catch (err) {
        setBackupMsg({ ok: false, text: `Import failed: ${err}` })
      } finally {
        if (importRef.current) importRef.current.value = ''
      }
    }
    reader.readAsText(file)
  }

  return (
    <div className="flex flex-col gap-5 max-w-2xl">

      {/* ── Appearance ── */}
      <SettingsCard
        title="Appearance"
        desc="Choose a light or dark theme and pick an accent color used throughout the app."
      >
        <div className="flex flex-col gap-1.5">
          <div className={ui.fieldLabel}>Theme</div>
          <div className="flex gap-2">
            <button onClick={() => changeTheme('dark')}  className={classes.segBtn(theme === 'dark')}>Dark</button>
            <button onClick={() => changeTheme('light')} className={classes.segBtn(theme === 'light')}>Light</button>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <div className={ui.fieldLabel}>Accent color</div>
          <div className="flex gap-3 flex-wrap items-center">
            {ACCENT_COLORS.map(a => (
              <button
                key={a.value}
                onClick={() => changeAccent(a.value)}
                title={a.label}
                style={{
                  background: a.color,
                  boxShadow: accent === a.value ? `0 0 0 2px white, 0 0 0 4px ${a.color}` : 'none',
                }}
                className="w-8 h-8 rounded-full cursor-pointer border-0 transition-all shrink-0"
              />
            ))}
            {/* Day of Week swatch — rainbow conic showing all 7 day colours */}
            <button
              onClick={() => changeAccent('dow')}
              title="Day of Week — accent follows today's label day colour, updates at midnight"
              style={{
                background: `conic-gradient(${DOW_ACCENT_PALETTE.map((p, i) => `${p.base} ${Math.round(i*100/7)}% ${Math.round((i+1)*100/7)}%`).join(', ')})`,
                boxShadow: accent === 'dow' ? `0 0 0 2px white, 0 0 0 4px ${DOW_ACCENT_PALETTE[getDowAccentIdx()].base}` : 'none',
              }}
              className="w-8 h-8 rounded-full cursor-pointer border-0 transition-all shrink-0"
            />
          </div>
          <div className="text-[#6e7681] text-xs">
            {accent === 'dow'
              ? `Day of Week — currently ${['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'][getDowAccentIdx()]}; updates automatically at midnight.`
              : `${ACCENT_COLORS.find(a => a.value === accent)?.label ?? 'Green'} — used for buttons, active tabs, and highlights.`
            }
          </div>
        </div>
      </SettingsCard>

      {/* ── Quick Items display ── */}
      <SettingsCard
        title="Quick Items Display"
        desc="Control how the quick items list in Print Labels is sorted and how each item card looks."
      >
        <div className="flex flex-col gap-1.5">
          <div className={ui.fieldLabel}>Sort items by</div>
          <div className="flex gap-2 items-center">
            <select
              className={ui.input + ' cursor-pointer flex-1'}
              value={sortField}
              onChange={e => changeSortField(e.target.value as QuickSortField)}
            >
              {QUICK_SORT_FIELDS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <button onClick={toggleSortDir} className={ui.neutralBtn} title="Toggle sort direction">
              {sortAsc ? '↑ Ascending' : '↓ Descending'}
            </button>
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <div className={ui.fieldLabel}>Item card style</div>
          <div className="flex gap-2">
            <button onClick={() => changeCardStyle('standard')} className={classes.segBtn(cardStyle === 'standard')}>Standard</button>
            <button onClick={() => changeCardStyle('label')} className={classes.segBtn(cardStyle === 'label')}>Label preview</button>
          </div>
          <div className="text-[#6e7681] text-xs leading-relaxed">
            <b>Standard</b> shows category, name and shelf-life details with print buttons.{' '}
            <b>Label preview</b> shows a true-to-print label (matching your active layout) with the item name on it.
          </div>
        </div>
      </SettingsCard>

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

      {/* ── Config backup ── */}
      <SettingsCard
        title="Config Backup"
        desc="Export your full configuration — quick items, categories, display preferences, printer device, and update settings — to a JSON file. Import it on another device to replicate the setup instantly."
      >
        <div className={ui.actionRow}>
          <button onClick={handleExportConfig} className={ui.primaryBtn}>
            Export config
          </button>
          <button onClick={() => importRef.current?.click()} className={ui.neutralBtn}>
            Import config
          </button>
          <input
            ref={importRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={handleImportConfig}
          />
        </div>
        {backupMsg && (
          <div className={classes.result(backupMsg.ok)}>{backupMsg.text}</div>
        )}
        <div className="text-[#6e7681] text-xs">
          The exported file does not include your GitHub token or usage history. Import restores all other settings and reloads the app.
        </div>
      </SettingsCard>

    </div>
  )
}
