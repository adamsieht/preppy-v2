import { describe, it, expect } from 'vitest'
import { estTextWidth, dowStripRightEdge, computeDowFitSize } from '../../renderer/pages/Preppy/labelZpl'
import { BUILTIN_LAYOUTS } from '../../renderer/pages/Preppy/labelDefs'

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

    const fit = computeDowFitSize(daymark2x1, dateText)!
    expect(fit).toBeLessThan(dowEl.fontSize) // shrunk from its configured size

    // The right-aligned date's left edge, and the fitted "Wednesday" right edge.
    const dateLeft = dowStripRightEdge(daymark2x1.dowConfig!) - estTextWidth(dateText, dateEl.fontSize)
    const dowRight = dowEl.x + estTextWidth('Wednesday', fit)
    expect(dowRight).toBeLessThanOrEqual(dateLeft)
  })

  it('returns undefined when the layout has no DOW strip', () => {
    expect(computeDowFitSize(blank2x1, '06/15/26')).toBeUndefined()
  })
})
