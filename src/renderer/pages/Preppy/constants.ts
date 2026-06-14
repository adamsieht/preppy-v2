import type { CategoryDef, LabelTemplate } from './types'

export const TEMPLATES: LabelTemplate[] = ['IX', 'OX', 'UX']

// Sentinel duration meaning "no fixed shelf life — prompt the user for an
// expiration date via the calendar when printing" (use-by-date / keep-prior-stage
// expiration / end-of-day / other non-fixed values from the shelf life guide).
export const PROMPT_HRS = -1

export const ITEM_CATEGORIES: CategoryDef[] = [
  { id: 'item',   label: 'Item',   color: '#6e7681' },
  { id: 'veggie', label: 'Veggie', color: '#3fb950' },
  { id: 'meat',   label: 'Meat',   color: '#f85149' },
  { id: 'sauce',  label: 'Sauce',  color: '#e3b341' },
]

export const CAT_PALETTE = [
  '#3fb950', '#f85149', '#e3b341', '#58a6ff',
  '#d2a8ff', '#ff7b72', '#79c0ff', '#ffa657',
]

export const DEFAULT_PRESETS = [
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

export const DEFAULT_DURATIONS = [
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

export const ITEMS_KEY           = 'preppy-quick-items'
export const CATS_KEY            = 'preppy-quick-cats'
export const HIDDEN_CATS_KEY     = 'preppy-hidden-cats'
export const PRESETS_KEY         = 'preppy-custom-presets'
export const WIDTH_KEY           = 'preppy-left-width'
export const PRESET_ORDER_KEY    = 'preppy-preset-order'
export const HIDDEN_PRESETS_KEY  = 'preppy-hidden-presets'
export const PANEL_COLLAPSED_KEY = 'preppy-panel-collapsed'
export const LEFT_COLLAPSED_KEY  = 'preppy-left-collapsed'
export const ACTIVE_LOG_KEY      = 'preppy-active-log'
export const RECENT_CLEARED_KEY  = 'preppy-recent-cleared'
export const PRINT_COUNTS_KEY    = 'preppy-print-counts'
export const HOURLY_COUNTS_KEY   = 'preppy-hourly-counts'
export const FAVORITES_KEY       = 'preppy-favorites'
export const LABEL_LAYOUTS_KEY    = 'preppy-label-layouts'
export const LABEL_ACTIVE_KEY     = 'preppy-label-active'
export const STATIC_PRESETS_KEY         = 'preppy-static-presets'
export const STATIC_PRESETS_ENABLED_KEY = 'preppy-static-presets-enabled'
export const QUICK_SORT_FIELD_KEY = 'preppy-quick-sort-field'
export const QUICK_SORT_DIR_KEY   = 'preppy-quick-sort-dir'
export const QUICK_CARD_STYLE_KEY = 'preppy-quick-card-style'

// Quick-items display preferences (set in Settings → General, read by the panel)
export type QuickSortField = 'name' | 'cat' | 'recent' | 'popular' | 'recommended'
export type QuickCardStyle = 'standard' | 'label'

export const QUICK_SORT_FIELDS: { value: QuickSortField; label: string }[] = [
  { value: 'name',        label: 'Name' },
  { value: 'cat',         label: 'Category' },
  { value: 'recent',      label: 'Recently Added' },
  { value: 'popular',     label: 'Most Popular' },
  { value: 'recommended', label: 'Recommended' },
]

export const THEME_KEY  = 'preppy-theme'
export const ACCENT_KEY = 'preppy-accent'

// How label previews render in the UI: a clean display-friendly card (default)
// or a true-to-print rendering of the actual ZPL layout. Printing always uses
// the real layout regardless of this setting.
export const LABEL_PREVIEW_STYLE_KEY = 'preppy-label-preview-style'
export type LabelPreviewStyle = 'friendly' | 'display-zpl' | 'actual'

export type AppTheme    = 'dark' | 'light'
export type AccentColor = 'green' | 'blue' | 'purple' | 'orange' | 'red' | 'teal' | 'dow'

export const ACCENT_COLORS: { value: AccentColor; label: string; color: string }[] = [
  { value: 'green',  label: 'Green',  color: '#28a745' },
  { value: 'blue',   label: 'Blue',   color: '#1f6feb' },
  { value: 'purple', label: 'Purple', color: '#8b5cf6' },
  { value: 'orange', label: 'Orange', color: '#f97316' },
  { value: 'red',    label: 'Red',    color: '#ef4444' },
  { value: 'teal',   label: 'Teal',   color: '#0d9488' },
]

// Daymark DITM day-of-week accent palette (mon-first: Mon=0 … Sun=6).
// Matches DOW_COLORS in labelDefs.ts so the accent colour always mirrors the label strip.
export const DOW_ACCENT_PALETTE: { base: string; hover: string }[] = [
  { base: '#1D6ECC', hover: '#3A85E0' }, // Mon - blue
  { base: '#E8A800', hover: '#F5BF2A' }, // Tue - golden yellow
  { base: '#CC1E1E', hover: '#E03232' }, // Wed - red
  { base: '#7A3F1E', hover: '#965030' }, // Thu - brown
  { base: '#1E8C3C', hover: '#28A84A' }, // Fri - green
  { base: '#E07020', hover: '#F08030' }, // Sat - orange
  { base: '#1A1A1A', hover: '#363636' }, // Sun - black
]

/** Returns the current day's mon-first index (0=Mon … 6=Sun). */
export function getDowAccentIdx(): number {
  const d = new Date().getDay() // 0=Sun in JS
  return d === 0 ? 6 : d - 1
}

/** Apply the current DOW accent colour directly to html inline styles. */
export function applyDowAccent(): void {
  const { base, hover } = DOW_ACCENT_PALETTE[getDowAccentIdx()]
  document.documentElement.style.setProperty('--c-accent',       base)
  document.documentElement.style.setProperty('--c-accent-hover', hover)
}

export const NUMPAD_KEYS = ['7','8','9','4','5','6','1','2','3','⌫','0','✓'] as const
