import type { LabelLayout, LabelElement } from './labelTypes'
import { getLabelSize, DEFAULT_DOW_CONFIG } from './labelDefs'
import { STATIC_PRESETS_KEY } from './constants'

// ── Static presets ───────────────────────────────────────────────────────────
// A static preset prints a mostly-fixed label (no duration input). The body is
// tiled with a short repeated text (e.g. "EOD"), and — because it inherits a
// Daymark layout — the day-of-week strip still draws a box around *today* with
// this week's day-of-month numbers (handled by generateZpl / LabelPreview when
// rendered with durationHrs: 0).

export interface StaticPreset {
  id:   string
  name: string   // card title, e.g. "End of Day"
  text: string   // short text tiled across the body, e.g. "EOD"
}

// Permanent, non-deletable. Custom presets live in localStorage.
export const BUILTIN_STATIC_PRESETS: StaticPreset[] = [
  { id: 'static-eod', name: 'End of Day', text: 'EOD' },
]

export function loadCustomStaticPresets(): StaticPreset[] {
  try {
    const raw = JSON.parse(localStorage.getItem(STATIC_PRESETS_KEY) ?? '[]')
    if (!Array.isArray(raw)) return []
    return raw.filter((p): p is StaticPreset =>
      p && typeof p.id === 'string' && typeof p.name === 'string' && typeof p.text === 'string')
  } catch { return [] }
}

export function loadStaticPresets(): StaticPreset[] {
  return [...BUILTIN_STATIC_PRESETS, ...loadCustomStaticPresets()]
}

export function saveCustomStaticPresets(list: StaticPreset[]): void {
  localStorage.setItem(STATIC_PRESETS_KEY, JSON.stringify(list))
}

export function isBuiltinStaticPreset(id: string): boolean {
  return BUILTIN_STATIC_PRESETS.some(p => p.id === id)
}

/**
 * Build a 2"×1" Daymark layout for a static preset: the body is tiled with the
 * preset's text and the Daymark day-of-week strip is included so the box-around-
 * today + day numbers render. Print/preview with `durationHrs: 0` so "today" is
 * the reference day.
 */
export function buildStaticLayout(sp: StaticPreset): LabelLayout {
  const size = getLabelSize('2x1')
  const W = size.dotsW   // 406
  const H = size.dotsH   // 203
  const dow = { ...DEFAULT_DOW_CONFIG }
  const stripBottom = dow.numberY + dow.numberFontSize   // ≈ 50

  const fs     = 18
  const text   = (sp.text || 'EOD').trim() || 'EOD'
  const textW  = Math.max(12, Math.round(text.length * fs * 0.6))
  const colStep = textW + 16
  const rowStep = fs + 8
  const margin  = 4
  const startX  = 8
  const startY  = stripBottom + 6

  // Diamond lattice: stagger every other row by half a column so the cells form a
  // rotated (diamond) lattice rather than a square one.
  const elements: LabelElement[] = []
  let n = 0
  let row = 0
  for (let y = startY; y + fs <= H - margin; y += rowStep) {
    const xOffset = (row % 2) * Math.round(colStep / 2)
    for (let x = startX + xOffset; x + textW <= W - margin; x += colStep) {
      elements.push({ id: `s${n++}`, type: 'static', x, y, fontSize: fs, fontWidth: fs, rotation: 0, text, bold: true })
    }
    row++
  }

  // Big centred label on top of the grid. Pushed last so it draws over the
  // tiled background (later elements render after earlier ones in both the
  // preview and the generated ZPL).
  const bigFs    = 76
  const fitFs    = Math.min(bigFs, Math.floor((W - 2 * margin) / (text.length * 0.6)))
  const bigW     = Math.round(text.length * fitFs * 0.6)
  const bigX     = Math.max(margin, Math.round((W - bigW) / 2))
  const bigY     = Math.round(stripBottom + (H - stripBottom - fitFs) / 2)
  elements.push({ id: 'big', type: 'static', x: bigX, y: bigY, fontSize: fitFs, fontWidth: fitFs, rotation: 0, text, bold: true })

  return {
    id: `static-${sp.id}`,
    name: sp.name,
    isBuiltin: true,
    sizeKey: '2x1',
    stockKey: 'daymark',
    dowConfig: dow,
    invert: true,
    elements,
  }
}
