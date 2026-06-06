import { useState, useMemo } from 'react'
import dayjs from 'dayjs'
import Label from './Label'
import type { LabelTemplate } from '../pages/Preppy/types'
import { styles } from './CalendarPicker.styles'

interface CalendarPickerProps {
  template:      LabelTemplate
  onPrint:       (hrs: number, qty: number) => Promise<void>
  onCustomPrint: (hrs: number, label: string) => void
}

export default function CalendarPicker({ template, onPrint, onCustomPrint }: CalendarPickerProps) {
  const today     = dayjs().startOf('day')
  const [selDate,   setSelDate]   = useState<dayjs.Dayjs>(() => dayjs())
  const [viewMonth, setViewMonth] = useState<dayjs.Dayjs>(() => dayjs().startOf('month'))
  const [hour,      setHour]      = useState(12)
  const [minute,    setMinute]    = useState(0)
  const [ampm,      setAmpm]      = useState<'AM' | 'PM'>('PM')

  const firstOfMonth = viewMonth.startOf('month')
  const daysInMonth  = viewMonth.daysInMonth()
  const startDow     = firstOfMonth.day()

  const cells: (dayjs.Dayjs | null)[] = []
  for (let i = 0; i < startDow; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(firstOfMonth.date(d))
  while (cells.length % 7 !== 0) cells.push(null)

  const durationHrs = useMemo(() => {
    const h24 = ampm === 'AM' ? (hour === 12 ? 0 : hour) : (hour === 12 ? 12 : hour + 12)
    const exp = selDate.hour(h24).minute(minute).second(0)
    return Math.max(0, exp.diff(dayjs(), 'minute') / 60)
  }, [selDate, hour, minute, ampm])

  function getExpiryHrs() {
    const h24 = ampm === 'AM' ? (hour === 12 ? 0 : hour) : (hour === 12 ? 12 : hour + 12)
    const exp = selDate.hour(h24).minute(minute).second(0)
    return Math.max(0, exp.diff(dayjs(), 'minute') / 60)
  }

  const calLabel = `CAL ${selDate.format('M/D')} ${hour}:${minute.toString().padStart(2, '0')} ${ampm}`
  const isPast   = durationHrs <= 0

  function dayBtnClass(day: dayjs.Dayjs) {
    const sel  = day.isSame(selDate, 'day')
    const tod  = day.isSame(today,   'day')
    const past = day.isBefore(today, 'day')
    const base = 'min-h-[44px] w-full rounded-lg text-sm font-bold transition-colors'
    if (past) return `${base} text-[#484f58] bg-transparent cursor-not-allowed`
    if (sel)  return `${base} text-white bg-[#28a745] cursor-pointer`
    if (tod)  return `${base} text-[#28a745] bg-transparent border border-[#28a745] cursor-pointer hover:bg-[#28a745]/10`
    return `${base} text-[#adbac7] bg-transparent hover:bg-[#161b22] cursor-pointer`
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-y-auto scrollbar-dark">

      {/* Month navigation */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[#30363d] shrink-0">
        <button
          onClick={() => setViewMonth(m => m.subtract(1, 'month'))}
          className={styles.stepBtn}
        >
          ‹
        </button>
        <span className="text-white font-bold text-sm">{viewMonth.format('MMMM YYYY')}</span>
        <button
          onClick={() => setViewMonth(m => m.add(1, 'month'))}
          className={styles.stepBtn}
        >
          ›
        </button>
      </div>

      {/* Day grid */}
      <div className="px-3 pt-2 pb-1 shrink-0">
        <div className="grid grid-cols-7 mb-1">
          {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => (
            <div key={d} className="text-center text-[#6e7681] text-[11px] font-semibold py-1">{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-[3px]">
          {cells.map((day, i) =>
            day
              ? <button
                  key={i}
                  onClick={() => { if (!day.isBefore(today, 'day')) setSelDate(day) }}
                  disabled={day.isBefore(today, 'day')}
                  className={dayBtnClass(day)}
                >
                  {day.date()}
                </button>
              : <div key={i} />
          )}
        </div>
      </div>

      {/* Time picker */}
      <div className="flex items-end justify-center gap-4 px-3 py-3 border-t border-[#30363d] shrink-0">
        <div className="flex flex-col items-center">
          <div className={styles.timeLbl}>Hour</div>
          <div className="flex items-center gap-2">
            <button className={styles.stepBtn} onClick={() => setHour(h => h === 1 ? 12 : h - 1)}>−</button>
            <span className={styles.timeVal}>{hour}</span>
            <button className={styles.stepBtn} onClick={() => setHour(h => h === 12 ? 1 : h + 1)}>+</button>
          </div>
        </div>
        <span className="text-white font-bold text-xl mb-[2px]">:</span>
        <div className="flex flex-col items-center">
          <div className={styles.timeLbl}>Min</div>
          <div className="flex items-center gap-2">
            <button className={styles.stepBtn} onClick={() => setMinute(m => m === 0 ? 45 : m - 15)}>−</button>
            <span className={styles.timeVal}>{minute.toString().padStart(2, '0')}</span>
            <button className={styles.stepBtn} onClick={() => setMinute(m => m === 45 ? 0 : m + 15)}>+</button>
          </div>
        </div>
        <div className="flex flex-col items-center">
          <div className={styles.timeLbl}>Period</div>
          <button
            onClick={() => setAmpm(a => a === 'AM' ? 'PM' : 'AM')}
            className={`min-h-[40px] min-w-[56px] rounded-lg border text-sm font-bold cursor-pointer transition-colors ${
              ampm === 'PM'
                ? 'border-[#28a745] bg-[#28a745] text-white'
                : 'border-[#30363d] bg-[#161b22] text-white hover:border-[#6e7681]'
            }`}
          >
            {ampm}
          </button>
        </div>
      </div>

      {/* Preview + print buttons */}
      <div className="px-3 pb-3 pt-3 flex flex-col gap-2 border-t border-[#30363d] shrink-0">
        {!isPast ? (
          <>
            <div onClick={() => void onPrint(getExpiryHrs(), 1)} style={{ cursor: 'pointer' }}>
              <Label durationHrs={durationHrs} type={template} />
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => void onPrint(getExpiryHrs(), 5)}
                className="flex-1 min-h-[44px] border border-[#30363d] rounded-lg bg-[#161b22] text-white text-sm font-bold disabled:opacity-60"
              >
                🖨 5
              </button>
              <button
                onClick={() => onCustomPrint(getExpiryHrs(), calLabel)}
                className="flex-1 min-h-[44px] border border-[#28a745] rounded-lg bg-[#28a745] text-white text-sm font-bold disabled:opacity-60"
              >
                🖨 ×
              </button>
            </div>
          </>
        ) : (
          <div className="text-[#6e7681] text-sm text-center py-6">Selected time is in the past</div>
        )}
      </div>
    </div>
  )
}
