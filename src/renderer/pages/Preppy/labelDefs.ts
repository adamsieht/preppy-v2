import type { LabelSize, LabelStock, LabelLayout, DowStripConfig } from './labelTypes'
import { LABEL_LAYOUTS_KEY, LABEL_ACTIVE_KEY } from './constants'

// ── Physical label sizes at 203 DPI ─────────────────────────────────────────
export const LABEL_SIZES: LabelSize[] = [
  { key: '2x1', label: '2" × 1"', dotsW: 406, dotsH: 203, widthIn: 2, heightIn: 1 },
  { key: '2x2', label: '2" × 2"', dotsW: 406, dotsH: 406, widthIn: 2, heightIn: 2 },
]

// ── Label stock types ────────────────────────────────────────────────────────
export const LABEL_STOCKS: LabelStock[] = [
  { key: 'blank',   label: 'Blank label',                   hasDow: false },
  { key: 'daymark', label: 'Daymark DissolveMark (DITM)',   hasDow: true  },
]

// ── Day-of-week strip ────────────────────────────────────────────────────────
// Default config for a 2"×1" (406×203 dot) Daymark label, tuned to the physical
// DissolveMark stock: a tall coloured band across the top with a box around the
// current day and the week's date numbers printed inside the band.
// Cells run left→right across the top: Mon(0)…Sun(6).
// The user can adjust these in the Labels settings to match their specific stock.
export const DEFAULT_DOW_CONFIG: DowStripConfig = {
  x: 40, y: 5,
  cellW: 51, cellH: 88,
  order: 'mon-first',
  numberY: 63,
  numberFontSize: 30,
}

// Browser-side colours matching the Daymark DITM pre-printed ink (mon-first, index 0-6).
// Order: Mon, Tue, Wed, Thu, Fri, Sat, Sun
export const DOW_COLORS      = ['#1D6ECC','#E8A800','#CC1E1E','#7A3F1E','#1E8C3C','#E07020','#1A1A1A']
export const DOW_TEXT_COLORS = ['#ffffff','#ffffff','#ffffff','#ffffff','#ffffff','#ffffff','#ffffff']
export const DOW_ABBR          = ['M','Tu','W','Th','F','Sa','Su']
export const DOW_FULL_NAMES    = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday']

// ── Built-in label layouts ───────────────────────────────────────────────────
// These are shipped with the app and cannot be deleted; users can copy them.

/** Convert a JS dayjs day (0=Sun…6=Sat) to mon-first strip index (0=Mon…6=Sun) */
export function dayjsDayToMonFirst(d: number): number {
  return d === 0 ? 6 : d - 1
}

export const BUILTIN_LAYOUTS: LabelLayout[] = [
  // ── Standard blank 2"×1" ───────────────────────────────────────────────────
  {
    id: 'builtin-blank-2x1', name: 'Standard Blank 2×1',
    isBuiltin: true, sizeKey: '2x1', stockKey: 'blank',
    elements: [
      { id: 'e1', type: 'template-id',  x: 20,  y: 20,  fontSize: 28, fontWidth: 28, rotation: 0 },
      { id: 'e2', type: 'print-date',   x: 20,  y: 60,  fontSize: 20, fontWidth: 20, rotation: 0, dateFormat: 'MM/DD/YY' },
      { id: 'e3', type: 'expiry-date',  x: 20,  y: 100, fontSize: 40, fontWidth: 40, rotation: 0, dateFormat: 'MM/DD/YY' },
      { id: 'e4', type: 'expiry-time',  x: 20,  y: 148, fontSize: 32, fontWidth: 32, rotation: 0, dateFormat: 'hh:mm A' },
      { id: 'e5', type: 'duration',     x: 20,  y: 180, fontSize: 18, fontWidth: 18, rotation: 0 },
    ],
  },

  // ── Daymark 2"×1" ──────────────────────────────────────────────────────────
  {
    id: 'builtin-daymark-2x1', name: 'Daymark 2×1',
    isBuiltin: true, sizeKey: '2x1', stockKey: 'daymark', invert: true,
    dowConfig: { ...DEFAULT_DOW_CONFIG },
    elements: [
      // IX/OX/UX centred under the boxed current day, just below the band
      { id: 'e1', type: 'template-id', x: 0,   y: 98,  fontSize: 40, fontWidth: 40, rotation: 0, anchorDowDay: true },
      // Day of week — bottom-left
      { id: 'e2', type: 'dow-name',    x: 20,  y: 145, fontSize: 45, fontWidth: 45, rotation: 0 },
      // Expiry date — bottom-right (left edge placed so 8-char date ends near the right edge)
      { id: 'e3', type: 'expiry-date', x: 194, y: 150, fontSize: 40, fontWidth: 40, rotation: 0, dateFormat: 'MM/DD/YY' },
    ],
  },

  // ── Standard blank 2"×2" ───────────────────────────────────────────────────
  {
    id: 'builtin-blank-2x2', name: 'Standard Blank 2×2',
    isBuiltin: true, sizeKey: '2x2', stockKey: 'blank',
    elements: [
      { id: 'e1', type: 'template-id',  x: 20, y: 20,  fontSize: 28, fontWidth: 28, rotation: 0 },
      { id: 'e2', type: 'print-date',   x: 20, y: 60,  fontSize: 20, fontWidth: 20, rotation: 0, dateFormat: 'MM/DD/YY' },
      { id: 'e3', type: 'expiry-date',  x: 20, y: 130, fontSize: 52, fontWidth: 52, rotation: 0, dateFormat: 'MM/DD/YY' },
      { id: 'e4', type: 'expiry-time',  x: 20, y: 195, fontSize: 40, fontWidth: 40, rotation: 0, dateFormat: 'hh:mm A' },
      { id: 'e5', type: 'dow-name',     x: 20, y: 250, fontSize: 32, fontWidth: 32, rotation: 0 },
      { id: 'e6', type: 'duration',     x: 20, y: 300, fontSize: 20, fontWidth: 20, rotation: 0 },
    ],
  },

  // ── Daymark 2"×2" ──────────────────────────────────────────────────────────
  {
    id: 'builtin-daymark-2x2', name: 'Daymark 2×2',
    isBuiltin: true, sizeKey: '2x2', stockKey: 'daymark', invert: true,
    dowConfig: {
      x: 0, y: 0, cellW: 58, cellH: 56, order: 'mon-first',
      numberY: 62, numberFontSize: 22,
    },
    elements: [
      // IX/OX/UX under the boxed current day, along the top
      { id: 'e1', type: 'template-id', x: 0,   y: 90,  fontSize: 30, fontWidth: 30, rotation: 0, anchorDowDay: true },
      // Day of week — bottom-left
      { id: 'e2', type: 'dow-name',    x: 12,  y: 352, fontSize: 40, fontWidth: 40, rotation: 0 },
      // Date — bottom-right
      { id: 'e3', type: 'expiry-date', x: 183, y: 348, fontSize: 44, fontWidth: 44, rotation: 0, dateFormat: 'MM/DD/YY' },
    ],
  },
]

// Default active layout (single global layout; IX/OX/UX is a placeable element)
export const DEFAULT_LAYOUT_ID = 'builtin-daymark-2x1'

// ── Helpers ──────────────────────────────────────────────────────────────────
export function getLabelSize(key: string): LabelSize {
  return LABEL_SIZES.find(s => s.key === key) ?? LABEL_SIZES[0]
}

/** Resolve the currently-active label layout (built-in + custom, by saved id). */
export function loadActiveLayout(): LabelLayout {
  let custom: LabelLayout[] = []
  try { custom = JSON.parse(localStorage.getItem(LABEL_LAYOUTS_KEY) ?? '[]') } catch { custom = [] }
  const activeId = localStorage.getItem(LABEL_ACTIVE_KEY) ?? DEFAULT_LAYOUT_ID
  return [...BUILTIN_LAYOUTS, ...custom].find(l => l.id === activeId) ?? BUILTIN_LAYOUTS[0]
}

/**
 * Quick-item label layout —
 *   • template (I/O/U)→ under the boxed current day (daymark), along the top
 *   • item name      → centred horizontally + vertically on the card
 *   • day of week    → bottom-left
 *   • expiry date    → bottom-right
 * Inherits the active layout's size + stock so the Daymark day-of-week strip
 * still renders. The date is positioned using an estimated text width (date is
 * a fixed 8 chars); the template id and name are positioned dynamically at
 * render time (anchorDowDay / centerX).
 */
export function buildQuickItemLayout(active: LabelLayout): LabelLayout {
  const size = getLabelSize(active.sizeKey)
  const W = size.dotsW
  const H = size.dotsH
  const isDaymark = active.stockKey === 'daymark' && !!active.dowConfig
  const big = size.key === '2x2'

  // Keep the top row clear of the pre-printed Daymark day-of-week strip.
  const stripBottom = isDaymark && active.dowConfig
    ? active.dowConfig.numberY + active.dowConfig.numberFontSize
    : 0

  const nameFs = big ? 40 : 30
  const idFs   = big ? 34 : 28
  const dowFs  = big ? 34 : 26
  const dateFs = big ? 40 : 28
  const margin = big ? 18 : 12
  const CW     = 0.6 // approx character width as a fraction of font height

  const topY    = Math.max(margin, stripBottom + (big ? 12 : 8))
  const bottomY = H - Math.max(dowFs, dateFs) - margin
  // Centre the name in the band between the template id and the bottom row so
  // the gap above (to IX) matches the gap below (to the day/date).
  const nameY   = Math.round((topY + idFs + bottomY - nameFs) / 2)
  const idX     = Math.round(W - 2 * idFs * CW - margin) // fallback for blank stock
  const dateX   = Math.round(W - 'MM/DD/YY'.length * dateFs * CW - margin)

  return {
    id: `quick-${active.id}`,
    name: 'Quick Item',
    isBuiltin: true,
    sizeKey: active.sizeKey,
    stockKey: active.stockKey,
    dowConfig: active.dowConfig ? { ...active.dowConfig } : undefined,
    invert: active.invert,
    elements: [
      { id: 'qi-tpl',  type: 'template-id', x: idX,    y: topY,     fontSize: idFs,   fontWidth: idFs,   rotation: 0, anchorDowDay: true },
      { id: 'qi-name', type: 'item-name',   x: margin, y: nameY,    fontSize: nameFs, fontWidth: nameFs, rotation: 0, centerX: true, bold: true },
      { id: 'qi-dow',  type: 'dow-name',    x: margin, y: bottomY,  fontSize: dowFs,  fontWidth: dowFs,  rotation: 0 },
      { id: 'qi-date', type: 'expiry-date', x: dateX,  y: bottomY,  fontSize: dateFs, fontWidth: dateFs, rotation: 0, dateFormat: 'MM/DD/YY' },
    ],
  }
}
