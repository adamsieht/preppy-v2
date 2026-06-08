import type { LabelSize, LabelStock, LabelLayout, DowStripConfig } from './labelTypes'

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
// Default config for a 2"×1" (406×203 dot) Daymark label.
// Cells run left→right across the top: Mon(0)…Sun(6).
// The user can adjust these in the Labels settings to match their specific stock.
export const DEFAULT_DOW_CONFIG: DowStripConfig = {
  x: 0, y: 0,
  cellW: 58, cellH: 28,
  order: 'mon-first',
  numberY: 32,
  numberFontSize: 18,
}

// Browser-side colours matching the Daymark DITM pre-printed ink (mon-first, index 0-6).
export const DOW_COLORS        = ['#111111','#6b21a8','#1d4ed8','#0f766e','#ca8a04','#b91c1c','#e5e7eb']
export const DOW_TEXT_COLORS   = ['#ffffff','#ffffff','#ffffff','#ffffff','#ffffff','#ffffff','#111111']
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
    isBuiltin: true, sizeKey: '2x1', stockKey: 'daymark',
    dowConfig: { ...DEFAULT_DOW_CONFIG },
    elements: [
      { id: 'e1', type: 'dow-name',    x: 20,  y: 58,  fontSize: 36, fontWidth: 36, rotation: 0 },
      { id: 'e2', type: 'template-id', x: 20,  y: 98,  fontSize: 28, fontWidth: 28, rotation: 0 },
      { id: 'e3', type: 'expiry-date', x: 20,  y: 130, fontSize: 36, fontWidth: 36, rotation: 0, dateFormat: 'MM/DD/YY' },
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
    isBuiltin: true, sizeKey: '2x2', stockKey: 'daymark',
    dowConfig: {
      x: 0, y: 0, cellW: 58, cellH: 56, order: 'mon-first',
      numberY: 62, numberFontSize: 22,
    },
    elements: [
      { id: 'e1', type: 'dow-name',    x: 20, y: 80,  fontSize: 48, fontWidth: 48, rotation: 0 },
      { id: 'e2', type: 'template-id', x: 20, y: 135, fontSize: 28, fontWidth: 28, rotation: 0 },
      { id: 'e3', type: 'expiry-date', x: 20, y: 175, fontSize: 48, fontWidth: 48, rotation: 0, dateFormat: 'MM/DD/YY' },
      { id: 'e4', type: 'item-name',   x: 20, y: 240, fontSize: 28, fontWidth: 28, rotation: 0 },
    ],
  },
]

// Default assignments: IX/OX/UX each default to the daymark 2×1
export const DEFAULT_ASSIGNMENTS: Record<'IX' | 'OX' | 'UX', string> = {
  IX: 'builtin-daymark-2x1',
  OX: 'builtin-daymark-2x1',
  UX: 'builtin-daymark-2x1',
}

// ── Helpers ──────────────────────────────────────────────────────────────────
export function getLabelSize(key: string): LabelSize {
  return LABEL_SIZES.find(s => s.key === key) ?? LABEL_SIZES[0]
}
