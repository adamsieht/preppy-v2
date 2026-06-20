import { describe, it, expect } from 'vitest'
import { estTextWidth, dowStripRightEdge, computeRowFit, generateZpl } from '../../renderer/pages/Preppy/labelZpl'
import { BUILTIN_LAYOUTS, buildQuickItemLayout } from '../../renderer/pages/Preppy/labelDefs'

const daymark2x1 = BUILTIN_LAYOUTS.find(l => l.id === 'builtin-daymark-2x1')!
const blank2x1   = BUILTIN_LAYOUTS.find(l => l.id === 'builtin-blank-2x1')!

describe('labelZpl — DOW / date geometry', () => {
  it('dowStripRightEdge is the right edge of the Sunday (7th) cell', () => {
    const cfg = daymark2x1.dowConfig!
    expect(dowStripRightEdge(cfg)).toBe(cfg.x + 7 * cfg.cellW)
  })

  it('shrinks the day-of-week font so the longest day name never overlaps the date', () => {
    const dowEl  = daymark2x1.elements.find(e => e.type === 'dow-name')!
    const dateEl = daymark2x1.elements.find(e => e.type === 'expiry-date')!
    const dateText = '06/15/26'

    const fit = computeRowFit(daymark2x1, dateText)!
    expect(fit.id).toBe(dowEl.id)
    expect(fit.fontSize).toBeLessThan(dowEl.fontSize) // shrunk from its configured size

    // The right-aligned date's left edge, and the fitted "Wednesday" right edge.
    const dateLeft = dowStripRightEdge(daymark2x1.dowConfig!) - estTextWidth(dateText, dateEl.fontSize)
    const dowRight = dowEl.x + estTextWidth('Wednesday', fit.fontSize)
    expect(dowRight).toBeLessThanOrEqual(dateLeft)
  })

  it('returns undefined when the layout has no DOW strip', () => {
    expect(computeRowFit(blank2x1, '06/15/26')).toBeUndefined()
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

  it('emits the item name (and no day-of-week) in the generated ZPL', () => {
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
