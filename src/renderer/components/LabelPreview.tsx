import dayjs from 'dayjs'
import type { LabelLayout, LabelValues } from '../pages/Preppy/labelTypes'
import { getLabelSize, DOW_COLORS, DOW_TEXT_COLORS, DOW_ABBR, dayjsDayToMonFirst } from '../pages/Preppy/labelDefs'
import { resolvePreviewText, resolvePreviewExpiry } from '../pages/Preppy/labelZpl'

type LabelTemplate = 'IX' | 'OX' | 'UX'

// ── Legacy props ─────────────────────────────────────────────────────────────
interface LegacyProps {
  template: LabelTemplate
  durationHrs: number
  layout?: undefined
  values?: undefined
  offset?: undefined
}

// ── Layout-based props ──────────────────────────────────────────────────────
interface LayoutProps {
  layout: LabelLayout
  values: LabelValues
  /** Shifts printed content within the label boundary (simulates ^LH offset). */
  offset?: { x: number; y: number }
  template?: undefined
  durationHrs?: undefined
}

type Props = LegacyProps | LayoutProps

// Pixels per ZPL dot — keeps preview size reasonable
export const PX_PER_DOT = 0.62

// ── DOW color cells — pre-printed on label stock, never moves with ^LH ──────
function DowColorCells({ layout }: { layout: LabelLayout }) {
  const cfg = layout.dowConfig
  if (!cfg) return null
  const cellW = cfg.cellW * PX_PER_DOT
  const cellH = cfg.cellH * PX_PER_DOT
  const stripX = cfg.x   * PX_PER_DOT
  const stripY = cfg.y   * PX_PER_DOT
  return (
    <div style={{ position: 'absolute', top: stripY, left: stripX, display: 'flex' }}>
      {DOW_ABBR.map((abbr, i) => (
        <div key={i} style={{
          width: cellW, height: cellH,
          background: DOW_COLORS[i],
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: cellH * 0.55, fontWeight: 700,
          color: DOW_TEXT_COLORS[i], fontFamily: 'monospace',
          boxSizing: 'border-box',
        }}>
          {abbr}
        </div>
      ))}
    </div>
  )
}

// ── DOW printed elements — thermal-printed, moves with ^LH offset ────────────
// Includes: black box around the expiry day, date numbers below the strip.
function DowPrinted({ layout, expiry }: { layout: LabelLayout; expiry: dayjs.Dayjs }) {
  const cfg = layout.dowConfig
  if (!cfg) return null
  const expiryIdx  = dayjsDayToMonFirst(expiry.day())
  const daysFromMon = expiry.day() === 0 ? 6 : expiry.day() - 1
  const monday     = expiry.subtract(daysFromMon, 'day')
  const cellW   = cfg.cellW         * PX_PER_DOT
  const cellH   = cfg.cellH         * PX_PER_DOT
  const stripX  = cfg.x             * PX_PER_DOT
  const stripY  = cfg.y             * PX_PER_DOT
  const numFs   = cfg.numberFontSize * PX_PER_DOT
  const borderW = Math.max(2, cellW * 0.06)
  return (
    <>
      {/* Black box around expiry day */}
      <div style={{
        position: 'absolute',
        left: stripX + expiryIdx * cellW, top: stripY,
        width: cellW, height: cellH,
        border: `${borderW}px solid #000`,
        outline: '1px solid #000',
        boxSizing: 'border-box',
        pointerEvents: 'none',
      }} />
      {/* Date numbers — positioned at the configured numberY (matches the ZPL) */}
      <div style={{ position: 'absolute', top: cfg.numberY * PX_PER_DOT, left: stripX, display: 'flex' }}>
        {DOW_ABBR.map((_, i) => (
          <div key={i} style={{
            width: cellW, textAlign: 'center',
            fontSize: numFs, fontFamily: 'monospace',
            color: '#111', lineHeight: 1,
            fontWeight: i === expiryIdx ? 900 : 400,
          }}>
            {monday.add(i, 'day').date()}
          </div>
        ))}
      </div>
    </>
  )
}

// ── Layout-based preview ────────────────────────────────────────────────────
function LayoutPreview({ layout, values, offset }: { layout: LabelLayout; values: LabelValues; offset?: { x: number; y: number } }) {
  const size   = getLabelSize(layout.sizeKey)
  const expiry = resolvePreviewExpiry(values.durationHrs)
  const w      = size.dotsW * PX_PER_DOT
  const h      = size.dotsH * PX_PER_DOT
  const ox     = (offset?.x ?? 0) * PX_PER_DOT
  const oy     = (offset?.y ?? 0) * PX_PER_DOT

  return (
    <div style={{
      position: 'relative',
      width: w, height: h,
      background: '#fff',
      border: '2px solid #555',
      borderRadius: 4,
      boxShadow: '0 2px 12px rgba(0,0,0,0.18)',
      overflow: 'hidden',
      flexShrink: 0,
      userSelect: 'none',
    }}>
      {/* Pre-printed stock — color cells only, never moves */}
      {layout.stockKey === 'daymark' && layout.dowConfig && (
        <DowColorCells layout={layout} />
      )}

      {/* Thermal-printed content — shifts with ^LH offset */}
      <div style={{ position: 'absolute', inset: 0, transform: `translate(${ox}px, ${oy}px)` }}>
        {layout.stockKey === 'daymark' && layout.dowConfig && (
          <DowPrinted layout={layout} expiry={expiry} />
        )}
      {layout.elements.map(el => {
        const text = resolvePreviewText(el, values)
        if (!text) return null
        const fs = el.fontSize * PX_PER_DOT
        const fw = (el.fontWidth ?? el.fontSize) * PX_PER_DOT
        // anchorDowDay: x tracks the boxed (expiry) day's column in the strip.
        // centerX: x centres the element horizontally on the label.
        const textWdot = text.length * el.fontSize * 0.6
        let xDot = el.x
        if (el.anchorDowDay && layout.dowConfig) {
          const cfg   = layout.dowConfig
          const idx   = dayjsDayToMonFirst(expiry.day())
          const cellX = cfg.x + idx * cfg.cellW
          xDot = cellX + Math.max(0, (cfg.cellW - textWdot) / 2)
        } else if (el.centerX) {
          xDot = (size.dotsW - textWdot) / 2
        }
        const x  = xDot * PX_PER_DOT
        const y  = el.y * PX_PER_DOT

        const rotMap: Record<number, string> = { 0: 'none', 90: 'rotate(90deg)', 180: 'rotate(180deg)', 270: 'rotate(270deg)' }
        return (
          <div
            key={el.id}
            style={{
              position: 'absolute',
              left: x, top: y,
              fontSize: fs,
              fontFamily: 'monospace',
              fontWeight: el.bold ? 900 : 700,
              color: '#111',
              lineHeight: 1,
              transform: rotMap[el.rotation ?? 0],
              transformOrigin: 'top left',
              whiteSpace: 'nowrap',
              letterSpacing: `${(fw - fs) * 0.1}px`,
            }}
          >
            {text}
          </div>
        )
      })}
      </div>
    </div>
  )
}

// ── Legacy preview (unchanged look) ────────────────────────────────────────
const TEMPLATE_LABELS: Record<LabelTemplate, string> = {
  IX: 'Internal Use', OX: 'Opened / Expiry', UX: 'Use First',
}
const USE_BY_LABEL: Record<LabelTemplate, string> = {
  IX: 'USE BY', OX: 'EXPIRES', UX: 'USE FIRST BY',
}

const cls = {
  wrapper:      'bg-white border-2 border-[#222] rounded-md px-5 py-4 font-mono shadow-[0_2px_12px_rgba(0,0,0,0.15)] select-none',
  headerRow:    'flex justify-between items-baseline mb-1',
  templateName: 'text-base font-bold tracking-[2px] text-[#222]',
  templateDesc: 'text-[0.75rem] text-[#666]',
  madeOn:       'text-[0.75rem] text-[#888] mb-2',
  dividerBold:  'border-t-2 border-[#222] my-[6px]',
  dividerLight: 'border-t border-[#aaa] my-[6px]',
  useByLabel:   'text-[0.7rem] font-bold uppercase tracking-[3px] text-[#444] mb-1',
  expiryDate:   'text-[3.2rem] font-black leading-none text-[#111] mb-[2px]',
  expiryTime:   'text-[2rem] font-bold text-[#333] mb-[10px]',
  footer:       'text-[0.72rem] text-[#666]',
}

function LegacyPreview({ template, durationHrs }: { template: LabelTemplate; durationHrs: number }) {
  const now    = dayjs()
  const expiry = resolvePreviewExpiry(durationHrs)
  return (
    <div className={cls.wrapper}>
      <div className={cls.headerRow}>
        <span className={cls.templateName}>{template}</span>
        <span className={cls.templateDesc}>{TEMPLATE_LABELS[template]}</span>
      </div>
      <div className={cls.madeOn}>Made: {now.format('MM/DD/YYYY')} at {now.format('HH:mm')}</div>
      <div className={cls.dividerBold} />
      <div className={cls.useByLabel}>{USE_BY_LABEL[template]}</div>
      <div className={cls.expiryDate}>{expiry.format('MM/DD/YYYY')}</div>
      <div className={cls.expiryTime}>{expiry.format('HH:mm')}</div>
      <div className={cls.dividerLight} />
      <div className={cls.footer}>
        {durationHrs < 24
          ? `${durationHrs}h from ${template === 'OX' ? 'opening' : 'prep'}`
          : `${durationHrs / 24} day${durationHrs / 24 !== 1 ? 's' : ''} from ${template === 'OX' ? 'opening' : 'prep'}`}
      </div>
    </div>
  )
}

// ── Public component ────────────────────────────────────────────────────────
export default function LabelPreview(props: Props) {
  if (props.layout && props.values) {
    return <LayoutPreview layout={props.layout} values={props.values} offset={props.offset} />
  }
  return <LegacyPreview template={props.template!} durationHrs={props.durationHrs!} />
}
