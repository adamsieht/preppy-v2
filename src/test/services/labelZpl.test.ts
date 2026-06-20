import { describe, it, expect } from 'vitest'
import dayjs from 'dayjs'
import { estTextWidth, dowStripRightEdge, computeRowFit, computeTimeBar, generateZpl } from '../../renderer/pages/Preppy/labelZpl'
import { BUILTIN_LAYOUTS, buildQuickItemLayout, dayjsDayToMonFirst } from '../../renderer/pages/Preppy/labelDefs'

const daymark2x1 = BUILTIN_LAYOUTS.find(l => l.id === 'builtin-daymark-2x1')!
const blank2x1   = BUILTIN_LAYOUTS.find(l => l.id === 'builtin-blank-2x1')!

describe('labelZpl — DOW / date geometry', () => {
  it('dowStripRightEdge is the right edge of the Sunday (7th) cell', () => {
    const cfg = daymark2x1.dowConfig!
    expect(dowStripRightEdge(cfg)).toBe(cfg.x + 7 * cfg.cellW)
  })

  it('does not shrink the day-of-week on the default layout (it already fits)', () => {
    const dowEl = daymark2x1.elements.find(e => e.type === 'dow-name')!
    const fit = computeRowFit(daymark2x1, '06/15/26')!
    expect(fit.id).toBe(dowEl.id)
    expect(fit.fontSize).toBe(dowEl.fontSize) // no needless shrink
  })

  it('keeps even the longest day name clear of the right-aligned date', () => {
    const dowEl  = daymark2x1.elements.find(e => e.type === 'dow-name')!
    const dateEl = daymark2x1.elements.find(e => e.type === 'expiry-date')!
    const fit = computeRowFit(daymark2x1, '06/15/26')!
    const dateLeft = dowStripRightEdge(daymark2x1.dowConfig!) - estTextWidth('06/15/26', dateEl.fontSize)
    const dowRight = dowEl.x + estTextWidth('Wednesday', fit.fontSize)
    expect(dowRight).toBeLessThanOrEqual(dateLeft)
  })

  it('returns undefined when the layout has no DOW strip', () => {
    expect(computeRowFit(blank2x1, '06/15/26')).toBeUndefined()
  })

  it('right-justifies the date to the DOW strip edge via a ^FB field block', () => {
    const zpl = generateZpl(
      daymark2x1,
      { template: 'IX', durationHrs: 48 },
      0, 0,
      { settings: { mode: 'standard', cutoffHour: 24, minuteRounding: 0, eodOnMidnight: false } },
    )
    const right = dowStripRightEdge(daymark2x1.dowConfig!)
    expect(zpl).toContain(`^FB${right},1,0,R`)
  })
})

describe('buildQuickItemLayout', () => {
  it('replaces the day-of-week with an item name in the same spot', () => {
    const quick = buildQuickItemLayout(daymark2x1)
    expect(quick.elements.some(e => e.type === 'dow-name')).toBe(false)

    const nameEl = quick.elements.find(e => e.type === 'item-name')!
    const dowEl  = daymark2x1.elements.find(e => e.type === 'dow-name')!
    expect(nameEl.x).toBe(dowEl.x)
    expect(nameEl.y).toBe(dowEl.y)

    // Template id and right-anchored date carry over from the preset unchanged.
    expect(quick.elements.some(e => e.type === 'template-id')).toBe(true)
    expect(quick.elements.some(e => e.type === 'expiry-date' && e.anchorDowEnd)).toBe(true)
  })

  it('fits a long item name to the left of the date', () => {
    const quick   = buildQuickItemLayout(daymark2x1)
    const nameEl  = quick.elements.find(e => e.type === 'item-name')!
    const dateEl  = quick.elements.find(e => e.type === 'expiry-date')!
    const dateText = '06/15/26'

    const fit = computeRowFit(quick, dateText, 'Caramelized Onions')!
    expect(fit.id).toBe(nameEl.id)

    const dateLeft = dowStripRightEdge(quick.dowConfig!) - estTextWidth(dateText, dateEl.fontSize)
    const nameRight = nameEl.x + estTextWidth('Caramelized Onions', fit.fontSize)
    expect(nameRight).toBeLessThanOrEqual(dateLeft)
  })

  it('emits the item name in the generated ZPL (sanity)', () => {
    const quick = buildQuickItemLayout(daymark2x1)
    const zpl = generateZpl(
      quick,
      { template: 'IX', durationHrs: 48, itemName: 'Diced Tomatoes' },
      0, 0,
      { settings: { mode: 'standard', cutoffHour: 24, minuteRounding: 0, eodOnMidnight: false } },
    )
    expect(zpl).toContain('Diced Tomatoes')
  })
})

describe('computeTimeBar', () => {
  const cfg = daymark2x1.dowConfig!
  const thu = dayjs('2026-06-25')   // Thursday, idx 3
  const expiryEndX = cfg.x + dayjsDayToMonFirst(thu.day()) * cfg.cellW  // left edge of Thu cell

  it('returns null for a same-day label', () => {
    expect(computeTimeBar(daymark2x1, thu, thu)).toBeNull()
  })

  it('returns null when the layout has no DOW strip', () => {
    expect(computeTimeBar(blank2x1, dayjs('2026-06-22'), thu)).toBeNull()
  })

  it('draws a block under the print day and a line stopping before the expiry day', () => {
    const mon = dayjs('2026-06-22')   // Monday, same week as Thursday
    const bar = computeTimeBar(daymark2x1, mon, thu)!
    expect(bar.block).not.toBeNull()
    // Block centred under Monday's column (idx 0)
    const monCenter = cfg.x + 0 * cfg.cellW + cfg.cellW / 2
    expect(Math.abs((bar.block!.x + bar.block!.w / 2) - monCenter)).toBeLessThanOrEqual(1)
    // Line begins at the block's right edge and ends before the expiry cell
    expect(bar.line.x).toBe(bar.block!.x + bar.block!.w)
    expect(bar.line.x + bar.line.w).toBe(expiryEndX)
  })

  it('draws only a line from the left edge when the print day predates the shown week', () => {
    const earlier = dayjs('2026-06-15')   // the previous week
    const bar = computeTimeBar(daymark2x1, earlier, thu)!
    expect(bar.block).toBeNull()
    expect(bar.line.x).toBe(0)
    expect(bar.line.x + bar.line.w).toBe(expiryEndX)
  })

  it('generateZpl adds bar boxes only when the timeline bar is enabled', () => {
    const opts = { settings: { mode: 'standard' as const, cutoffHour: 24, minuteRounding: 0 as const, eodOnMidnight: false } }
    const count = (s: string) => (s.match(/\^GB/g) || []).length
    const on  = generateZpl(daymark2x1, { template: 'IX', durationHrs: 48 }, 0, 0, { ...opts, timeBar: true })
    const off = generateZpl(daymark2x1, { template: 'IX', durationHrs: 48 }, 0, 0, { ...opts, timeBar: false })
    expect(count(on)).toBeGreaterThan(count(off))
  })
})
