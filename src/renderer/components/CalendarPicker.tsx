import { useState } from 'react'
import dayjs from 'dayjs'
import type { LabelTemplate } from '../pages/Preppy/types'
import { styles } from './CalendarPicker.styles'

interface CalendarPickerProps {
  template: LabelTemplate
  onPrint:  (hrs: number, qty: number) => Promise<void>
}

export default function CalendarPicker({ template, onPrint }: CalendarPickerProps) {
  const today      = dayjs().startOf('day')
  const [viewMonth, setViewMonth] = useState(() => dayjs().startOf('month'))

  const firstOfMonth = viewMonth.startOf('month')
  const daysInMonth  = viewMonth.daysInMonth()
  const startDow     = firstOfMonth.day()

  const cells: (dayjs.Dayjs | null)[] = []
  for (let i = 0; i < startDow; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(firstOfMonth.date(d))
  while (cells.length % 7 !== 0) cells.push(null)

  function handleDayPress(day: dayjs.Dayjs) {
    const endOfDay = day.hour(23).minute(59).second(59)
    const hrs = Math.max(0, endOfDay.diff(dayjs(), 'minute') / 60)
    void onPrint(hrs, 1)
  }

  function dayBtnClass(day: dayjs.Dayjs) {
    const past = day.isBefore(today, 'day')
    const tod  = day.isSame(today, 'day')
    const base = 'flex-1 min-h-[44px] rounded-lg text-sm font-bold transition-colors'
    if (past) return `${base} text-[#484f58] bg-transparent cursor-not-allowed`
    if (tod)  return `${base} text-[#28a745] bg-transparent border border-[#28a745] cursor-pointer hover:bg-[#28a745]/10`
    return `${base} text-[#adbac7] bg-transparent hover:bg-[#161b22] cursor-pointer`
  }

  return (
    <div className="flex flex-col flex-1 min-h-0 p-3 gap-2">

      {/* Month navigation */}
      <div className="flex items-center justify-between shrink-0">
        <button
          onClick={() => setViewMonth(m => m.subtract(1, 'month'))}
          className={styles.stepBtn}
        >‹</button>
        <span className="text-white font-bold text-sm">{viewMonth.format('MMMM YYYY')}</span>
        <button
          onClick={() => setViewMonth(m => m.add(1, 'month'))}
          className={styles.stepBtn}
        >›</button>
      </div>

      {/* Day-of-week headers */}
      <div className="grid grid-cols-7 shrink-0">
        {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => (
          <div key={d} className="text-center text-[#6e7681] text-[11px] font-semibold py-1">{d}</div>
        ))}
      </div>

      {/* Day grid — fills remaining space */}
      <div className="grid grid-cols-7 gap-[3px] flex-1">
        {cells.map((day, i) =>
          day ? (
            <button
              key={i}
              onClick={() => { if (!day.isBefore(today, 'day')) handleDayPress(day) }}
              disabled={day.isBefore(today, 'day')}
              className={dayBtnClass(day)}
            >
              {day.date()}
            </button>
          ) : (
            <div key={i} />
          )
        )}
      </div>

    </div>
  )
}
