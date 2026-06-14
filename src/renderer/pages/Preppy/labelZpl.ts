import dayjs from 'dayjs'
import type { LabelLayout, LabelElement, LabelValues, DowStripConfig } from './labelTypes'
import { dayjsDayToMonFirst, getLabelSize } from './labelDefs'
import { loadDateCalcSettings, resolveExpiry } from './labelDateCalc'

// ── Date format map (dayjs tokens) ──────────────────────────────────────────
export const DATE_FORMATS: { key: string; label: string; fmt: string }[] = [
  { key: 'MM/DD/YY',   label: 'MM/DD/YY   (06/09/26)',    fmt: 'MM/DD/YY'   },
  { key: 'MM/DD/YYYY', label: 'MM/DD/YYYY (06/09/2026)',  fmt: 'MM/DD/YYYY' },
  { key: 'M/D',        label: 'M/D        (6/9)',          fmt: 'M/D'        },
  { key: 'MMMM D',     label: 'Month Day  (June 9)',       fmt: 'MMMM D'     },
  { key: 'ddd M/D',    label: 'Day M/D    (Mon 6/9)',      fmt: 'ddd M/D'    },
]

export const TIME_FORMATS: { key: string; label: string; fmt: string }[] = [
  { key: 'hh:mm A', label: '12-hour (02:30 PM)', fmt: 'hh:mm A' },
  { key: 'HH:mm',   label: '24-hour (14:30)',     fmt: 'HH:mm'   },
]

export const FONT_SIZES = [12, 16, 18, 20, 24, 28, 32, 36, 40, 48, 56, 64]

// ── Element text resolution ─────────────────────────────────────────────────
function resolveText(el: LabelElement, values: LabelValues, now: dayjs.Dayjs, expiry: dayjs.Dayjs): string {
  switch (el.type) {
    case 'expiry-date': return expiry.format(el.dateFormat ?? 'MM/DD/YY')
    case 'expiry-time': return expiry.format(el.dateFormat ?? 'hh:mm A')
    case 'print-date':  return now.format(el.dateFormat ?? 'MM/DD/YY')
    case 'print-time':  return now.format(el.dateFormat ?? 'hh:mm A')
    case 'dow-name': {
      const idx = dayjsDayToMonFirst(expiry.day())
      return ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'][idx]
    }
    case 'template-id': return values.template
    case 'duration': {
      const h = values.durationHrs
      return h < 24 ? `${h}h` : `${h / 24}d`
    }
    case 'item-name':   return values.itemName ?? ''
    case 'static':      return el.text ?? ''
    default:            return ''
  }
}

// ── DOW-anchored X ──────────────────────────────────────────────────────────
// Centres an element under the boxed (expiry) day's column in the DOW strip.
function dowAnchorX(cfg: DowStripConfig, expiry: dayjs.Dayjs, text: string, fontSize: number): number {
  const idx   = dayjsDayToMonFirst(expiry.day())
  const cellX = cfg.x + idx * cfg.cellW
  const textW = text.length * fontSize * 0.6
  return Math.round(cellX + Math.max(0, (cfg.cellW - textW) / 2))
}

// ── Element ZPL fragment ────────────────────────────────────────────────────
function elementZpl(el: LabelElement, values: LabelValues, now: dayjs.Dayjs, expiry: dayjs.Dayjs, dowConfig?: DowStripConfig, labelW = 0): string {
  const text = resolveText(el, values, now, expiry)
  if (!text) return ''
  const fw = el.rotation === 90 ? 'R' : el.rotation === 180 ? 'I' : el.rotation === 270 ? 'B' : 'N'
  const rotate = el.rotation !== 0 ? `^FW${fw}` : ''
  const w = el.fontWidth ?? el.fontSize
  const textW = text.length * el.fontSize * 0.6
  const baseX = el.anchorDowDay && dowConfig
    ? dowAnchorX(dowConfig, expiry, text, el.fontSize)
    : el.centerX && labelW
      ? Math.round((labelW - textW) / 2)
      : el.x
  const draw = (dx: number) => `${rotate}^FO${baseX + dx},${el.y}^A0N,${el.fontSize},${w}^FD${text}^FS`
  // Bold: overstrike with a 1-dot horizontal offset so strokes print heavier.
  return el.bold ? `${draw(0)}\n${draw(1)}` : draw(0)
}

// ── DOW strip ZPL ───────────────────────────────────────────────────────────
function dowZpl(cfg: DowStripConfig, expiry: dayjs.Dayjs): string {
  const expiryMonFirst = dayjsDayToMonFirst(expiry.day())
  const boxX = cfg.x + expiryMonFirst * cfg.cellW

  // Box around the expiry day
  const box = `^FO${boxX},${cfg.y}^GB${cfg.cellW},${cfg.cellH},3^FS`

  // Day-of-month numbers for the expiry week (Mon–Sun)
  const daysFromMon = expiry.day() === 0 ? 6 : expiry.day() - 1
  const monday = expiry.subtract(daysFromMon, 'day')
  const numLines = Array.from({ length: 7 }, (_, i) => {
    const d = monday.add(i, 'day')
    const numStr = String(d.date())
    const nx = cfg.x + i * cfg.cellW + Math.max(0, Math.floor((cfg.cellW - numStr.length * cfg.numberFontSize * 0.6) / 2))
    return `^FO${nx},${cfg.numberY}^A0N,${cfg.numberFontSize},${cfg.numberFontSize}^FD${numStr}^FS`
  })

  return [box, ...numLines].join('\n')
}

// ── Main ZPL generator ──────────────────────────────────────────────────────
export function generateZpl(
  layout: LabelLayout,
  values: LabelValues,
  labelHomeX = 0,
  labelHomeY = 0,
): string {
  const now    = dayjs()
  const expiry = resolveExpiry(values.durationHrs, loadDateCalcSettings(), now)
  const labelW = getLabelSize(layout.sizeKey).dotsW

  const lines: string[] = ['^XA']
  // Invert (^POI) flips the whole label 180°. Used for stock fed so the pre-printed
  // day-of-week band ends up at the top when read. Affects print only — not the preview.
  if (layout.invert) lines.push('^POI')
  if (labelHomeX !== 0 || labelHomeY !== 0) {
    lines.push(`^LH${labelHomeX},${labelHomeY}`)
  }

  // DOW strip (if daymark label)
  if (layout.stockKey === 'daymark' && layout.dowConfig) {
    lines.push(dowZpl(layout.dowConfig, expiry))
  }

  // User-placed elements
  for (const el of layout.elements) {
    const fragment = elementZpl(el, values, now, expiry, layout.dowConfig, labelW)
    if (fragment) lines.push(fragment)
  }

  lines.push('^XZ')
  return lines.join('\n')
}

// ── Preview-only value resolver (used by browser preview) ───────────────────
export function resolvePreviewText(el: LabelElement, values: LabelValues): string {
  const now    = dayjs()
  const expiry = resolveExpiry(values.durationHrs, loadDateCalcSettings(), now)
  return resolveText(el, values, now, expiry)
}

export function resolvePreviewExpiry(durationHrs: number): dayjs.Dayjs {
  return resolveExpiry(durationHrs, loadDateCalcSettings())
}
