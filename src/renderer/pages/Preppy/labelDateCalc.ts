import dayjs from 'dayjs'

export interface LabelDateCalcSettings {
  /** 'day-first': today counts as day 1 (subtract 24h for multi-day labels). 'standard': raw hour addition. */
  mode: 'day-first' | 'standard'
  /** Hour (20–24) after which day-first reverts to standard for multi-day labels. 24 means "never revert" (all-day day-first). */
  cutoffHour: number
  /** Round same-day expiry times up to the nearest N minutes. 0 = no rounding. */
  minuteRounding: 0 | 5 | 10 | 15 | 30
  /** If a same-day label's expiry would cross midnight, print the EOD static label instead. */
  eodOnMidnight: boolean
}

export const LABEL_DATE_CALC_KEY = 'preppy-label-date-calc'

export const DEFAULT_DATE_CALC_SETTINGS: LabelDateCalcSettings = {
  mode: 'day-first',
  cutoffHour: 23,
  minuteRounding: 0,
  eodOnMidnight: false,
}

export function loadDateCalcSettings(): LabelDateCalcSettings {
  try {
    const raw = localStorage.getItem(LABEL_DATE_CALC_KEY)
    if (!raw) return { ...DEFAULT_DATE_CALC_SETTINGS }
    return { ...DEFAULT_DATE_CALC_SETTINGS, ...JSON.parse(raw) }
  } catch {
    return { ...DEFAULT_DATE_CALC_SETTINGS }
  }
}

export function saveDateCalcSettings(settings: LabelDateCalcSettings): void {
  localStorage.setItem(LABEL_DATE_CALC_KEY, JSON.stringify(settings))
}

/**
 * Resolves the expiry dayjs for a label given the current date-calc settings.
 * - durationHrs <= 0: returns now (static/sentinel labels)
 * - durationHrs < 24: same-day — applies minute rounding, no day-first subtraction
 * - durationHrs >= 24: multi-day — applies day-first subtraction unless past cutoff
 */
export function resolveExpiry(
  durationHrs: number,
  settings: LabelDateCalcSettings,
  now = dayjs(),
): dayjs.Dayjs {
  if (durationHrs <= 0) return now

  // Same-day labels: apply minute rounding only
  if (durationHrs < 24) {
    const raw = now.add(durationHrs, 'hour').second(0)
    if (settings.minuteRounding === 0) return raw
    const mins = raw.minute()
    if (mins === 0) return raw
    const r = settings.minuteRounding
    const rounded = Math.ceil(mins / r) * r
    if (rounded >= 60) {
      return raw.add(1, 'hour').minute(rounded - 60).second(0)
    }
    return raw.minute(rounded).second(0)
  }

  // Multi-day labels
  const raw = now.add(durationHrs, 'hour')
  if (settings.mode === 'standard') return raw

  // Day-first: cutoffHour < 24 means there's a real cutoff; 24 means all-day day-first
  const pastCutoff = settings.cutoffHour < 24 && now.hour() >= settings.cutoffHour
  if (pastCutoff) return raw

  return raw.subtract(24, 'hour')
}

/**
 * Returns true when a same-day label's expiry (after rounding) would cross into
 * the next calendar day AND the eodOnMidnight setting is enabled.
 */
export function wouldExceedMidnight(
  durationHrs: number,
  settings: LabelDateCalcSettings,
  now = dayjs(),
): boolean {
  if (!settings.eodOnMidnight) return false
  if (durationHrs <= 0 || durationHrs >= 24) return false
  const expiry = resolveExpiry(durationHrs, settings, now)
  return (
    expiry.date()  !== now.date()  ||
    expiry.month() !== now.month() ||
    expiry.year()  !== now.year()
  )
}

export const CUTOFF_OPTIONS: { label: string; value: number }[] = [
  { label: '8 PM',  value: 20 },
  { label: '9 PM',  value: 21 },
  { label: '10 PM', value: 22 },
  { label: '11 PM', value: 23 },
  { label: '12 AM', value: 24 },
]

export const MINUTE_ROUNDING_OPTIONS: { label: string; value: 0 | 5 | 10 | 15 | 30 }[] = [
  { label: 'No rounding', value: 0  },
  { label: '5 minutes',   value: 5  },
  { label: '10 minutes',  value: 10 },
  { label: '15 minutes',  value: 15 },
  { label: '30 minutes',  value: 30 },
]
