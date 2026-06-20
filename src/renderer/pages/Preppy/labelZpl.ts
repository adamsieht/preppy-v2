import dayjs from 'dayjs'
import type { LabelLayout, LabelElement, LabelValues, DowStripConfig } from './labelTypes'
import { dayjsDayToMonFirst, getLabelSize } from './labelDefs'
import { loadDateCalcSettings, resolveExpiry } from './labelDateCalc'
import type { LabelDateCalcSettings } from './labelDateCalc'

// Time format used when a same-day label's expiry-date slot shows the time instead
// of the (useless, always-today) date. Matches the friendly preview card.
const SAME_DAY_TIME_FORMAT = 'h:mm A'

function isSameDay(durationHrs: number): boolean {
  return durationHrs > 0 && durationHrs < 24
}

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
// sameDayAsTime: when true, an expiry-date element on a same-day label (<24h)
// renders the expiry TIME instead of the date — the date would just be "today".
function resolveText(el: LabelElement, values: LabelValues, now: dayjs.Dayjs, expiry: dayjs.Dayjs, sameDayAsTime: boolean): string {
  switch (el.type) {
    case 'expiry-date':
      return sameDayAsTime && isSameDay(values.durationHrs)
        ? expiry.format(SAME_DAY_TIME_FORMAT)
        : expiry.format(el.dateFormat ?? 'MM/DD/YY')
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

// ── Text width / DOW geometry helpers ────────────────────────────────────────
// Approximate printed width of a string in the scalable ^A0 font (CG Triumvirate
// Condensed), used for centring and overlap math. The font is narrower than a
// naive square estimate — ~0.5×height per character is close in practice. The
// right-aligned date doesn't rely on this at all (it uses a ZPL field block).
export const CHAR_WIDTH_RATIO = 0.5
export function estTextWidth(text: string, fontSize: number): number {
  return text.length * fontSize * CHAR_WIDTH_RATIO
}

// Right edge of the DOW strip = right edge of the Sunday cell (Mon..Sun, 7 cells).
export function dowStripRightEdge(cfg: DowStripConfig): number {
  return cfg.x + 7 * cfg.cellW
}

// X that right-aligns `text`'s right edge to the DOW strip's right edge.
function dowEndAlignedX(cfg: DowStripConfig, text: string, fontSize: number): number {
  return Math.round(dowStripRightEdge(cfg) - estTextWidth(text, fontSize))
}

// ── DOW-anchored X ──────────────────────────────────────────────────────────
// Centres an element under the boxed (expiry) day's column in the DOW strip.
function dowAnchorX(cfg: DowStripConfig, expiry: dayjs.Dayjs, text: string, fontSize: number): number {
  const idx   = dayjsDayToMonFirst(expiry.day())
  const cellX = cfg.x + idx * cfg.cellW
  const textW = estTextWidth(text, fontSize)
  return Math.round(cellX + Math.max(0, (cfg.cellW - textW) / 2))
}

// Gap kept between the day-of-week and the right-aligned expiry date.
const DOW_DATE_GAP = 12
// Longest day-of-week name — the dow font is sized so this fits, uniformly for
// every day, so a long name (Wednesday) can never overrun into the date.
const LONGEST_DOW_NAME = 'Wednesday'

/**
 * When a daymark layout right-aligns its expiry date to the DOW strip end, the
 * bottom-left text (day-of-week or item name) can collide with it. This returns
 * the id of that left element plus a font size that guarantees it clears the
 * date — or undefined when no adjustment applies (no DOW strip, or no
 * right-anchored date + left-text pair). The day-of-week is sized uniformly for
 * the longest day name; an item name is fitted to its actual text.
 */
export interface RowFit { id: string; fontSize: number }

export function computeRowFit(layout: LabelLayout, dateText: string, itemName = ''): RowFit | undefined {
  const cfg = layout.dowConfig
  if (!cfg) return undefined
  const dateEl = layout.elements.find(e => e.anchorDowEnd)
  const leftEl = layout.elements.find(e => e.type === 'dow-name' || e.type === 'item-name')
  if (!dateEl || !leftEl) return undefined

  const sample   = leftEl.type === 'dow-name' ? LONGEST_DOW_NAME : itemName
  const dateLeft = dowEndAlignedX(cfg, dateText, dateEl.fontSize)
  const budget   = dateLeft - DOW_DATE_GAP - leftEl.x
  const natural  = estTextWidth(sample, leftEl.fontSize)
  const fontSize = budget <= 0 || natural <= budget
    ? leftEl.fontSize
    : Math.max(8, Math.floor(leftEl.fontSize * budget / natural))
  return { id: leftEl.id, fontSize }
}

interface RenderCtx {
  dowConfig?: DowStripConfig
  labelW: number
  sameDayAsTime: boolean
  /** Element whose font was shrunk to fit the bottom row, and its fitted size. */
  fitId?: string
  fitSize?: number
}

// ── Element ZPL fragment ────────────────────────────────────────────────────
function elementZpl(el: LabelElement, values: LabelValues, now: dayjs.Dayjs, expiry: dayjs.Dayjs, ctx: RenderCtx): string {
  const text = resolveText(el, values, now, expiry, ctx.sameDayAsTime)
  if (!text) return ''
  const fw = el.rotation === 90 ? 'R' : el.rotation === 180 ? 'I' : el.rotation === 270 ? 'B' : 'N'
  const rotate = el.rotation !== 0 ? `^FW${fw}` : ''
  // The bottom-row left element may be shrunk to fit; scale its width to match.
  const fontSize = ctx.fitId && el.id === ctx.fitId && ctx.fitSize ? ctx.fitSize : el.fontSize
  const w = Math.round((el.fontWidth ?? el.fontSize) * (fontSize / el.fontSize))

  // Right-align to the DOW strip's right edge with a right-justified field block,
  // so the printer places the text exactly at the edge regardless of font metrics.
  if (el.anchorDowEnd && ctx.dowConfig) {
    const right = dowStripRightEdge(ctx.dowConfig)
    const draw = (dx: number) => `${rotate}^FO${dx},${el.y}^A0N,${fontSize},${w}^FB${right},1,0,R^FD${text}^FS`
    return el.bold ? `${draw(0)}\n${draw(1)}` : draw(0)
  }

  const textW = estTextWidth(text, fontSize)
  const baseX = el.anchorDowDay && ctx.dowConfig
    ? dowAnchorX(ctx.dowConfig, expiry, text, fontSize)
    : el.centerX && ctx.labelW
      ? Math.round((ctx.labelW - textW) / 2)
      : el.x
  const draw = (dx: number) => `${rotate}^FO${baseX + dx},${el.y}^A0N,${fontSize},${w}^FD${text}^FS`
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
export interface GenerateZplOptions {
  /** Date-calc settings override. Calendar prints pass standard mode to skip the
   *  day-first 24h subtraction so the label lands on the exact date clicked. */
  settings?: LabelDateCalcSettings
  /** Force expiry-date elements to always render the date, even same-day. Calendar
   *  prints target an explicit date, so the date (not a time) is what's wanted. */
  forceExpiryDate?: boolean
}

export function generateZpl(
  layout: LabelLayout,
  values: LabelValues,
  labelHomeX = 0,
  labelHomeY = 0,
  options: GenerateZplOptions = {},
): string {
  const now    = dayjs()
  const expiry = resolveExpiry(values.durationHrs, options.settings ?? loadDateCalcSettings(), now)
  const labelW = getLabelSize(layout.sizeKey).dotsW
  // Show the time on same-day labels unless this layout has a dedicated expiry-time
  // element (then the date slot keeps the date) or the caller forces a date.
  const hasExpiryTime = layout.elements.some(e => e.type === 'expiry-time')
  const sameDayAsTime = !hasExpiryTime && !options.forceExpiryDate

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

  // Pre-fit the bottom-left text (day-of-week or item name) so it can't overlap a
  // right-anchored date.
  const dateEl = layout.elements.find(e => e.anchorDowEnd)
  const fit = dateEl
    ? computeRowFit(layout, resolveText(dateEl, values, now, expiry, sameDayAsTime), values.itemName ?? '')
    : undefined
  const ctx: RenderCtx = { dowConfig: layout.dowConfig, labelW, sameDayAsTime, fitId: fit?.id, fitSize: fit?.fontSize }

  // User-placed elements
  for (const el of layout.elements) {
    const fragment = elementZpl(el, values, now, expiry, ctx)
    if (fragment) lines.push(fragment)
  }

  lines.push('^XZ')
  return lines.join('\n')
}

// ── Preview-only value resolver (used by browser preview) ───────────────────
// Callers pass sameDayAsTime (computed from whether the layout has an expiry-time
// element) so the preview matches the printed label's same-day behaviour.
export function resolvePreviewText(el: LabelElement, values: LabelValues, sameDayAsTime = false): string {
  const now    = dayjs()
  const expiry = resolveExpiry(values.durationHrs, loadDateCalcSettings(), now)
  return resolveText(el, values, now, expiry, sameDayAsTime)
}

export function resolvePreviewExpiry(durationHrs: number): dayjs.Dayjs {
  return resolveExpiry(durationHrs, loadDateCalcSettings())
}
