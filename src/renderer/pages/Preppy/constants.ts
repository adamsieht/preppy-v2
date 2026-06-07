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
export const PRESETS_KEY         = 'preppy-custom-presets'
export const WIDTH_KEY           = 'preppy-left-width'
export const PRESET_ORDER_KEY    = 'preppy-preset-order'
export const HIDDEN_PRESETS_KEY  = 'preppy-hidden-presets'
export const PANEL_COLLAPSED_KEY = 'preppy-panel-collapsed'
export const LEFT_COLLAPSED_KEY  = 'preppy-left-collapsed'
export const ACTIVE_LOG_KEY      = 'preppy-active-log'
export const RECENT_CLEARED_KEY  = 'preppy-recent-cleared'

export const NUMPAD_KEYS = ['7','8','9','4','5','6','1','2','3','⌫','0','✓'] as const
