import { useState } from 'react'
import dayjs from 'dayjs'
import type { LabelTemplate } from '../pages/Preppy/types'

interface DatePromptPageProps {
  itemName: string
  template: LabelTemplate
  onPrint:  (hrs: number, qty: number) => void | Promise<void>
  onClose:  () => void
}

export default function DatePromptPage({ itemName, template, onPrint, onClose }: DatePromptPageProps) {
  const today      = dayjs().startOf('day')
  const [viewMonth, setViewMonth] = useState(() => dayjs().startOf('month'))
  const [qty, setQty] = useState(1)

  const firstOfMonth = viewMonth.startOf('month')
  const daysInMonth  = viewMonth.daysInMonth()
  const startDow     = firstOfMonth.day()

  const cells: (dayjs.Dayjs | null)[] = []
  for (let i = 0; i < startDow; i++) cells.push(null)
  for (let d = 1; d <= daysInMonth; d++) cells.push(firstOfMonth.date(d))
  while (cells.length % 7 !== 0) cells.push(null)

  async function handleDayPress(day: dayjs.Dayjs) {
    const endOfDay = day.hour(23).minute(59).second(59)
    const hrs = Math.max(0, endOfDay.diff(dayjs(), 'minute') / 60)
    await onPrint(hrs, qty)
    onClose()
  }

  function dayClass(day: dayjs.Dayjs) {
    const past = day.isBefore(today, 'day')
    const tod  = day.isSame(today, 'day')
    const base = 'flex-1 min-h-[52px] rounded-lg text-sm font-bold transition-colors'
    if (past) return `${base} text-[#484f58] bg-transparent cursor-not-allowed`
    if (tod)  return `${base} text-[#28a745] bg-transparent border border-[#28a745] cursor-pointer hover:bg-[#28a745]/10`
    return `${base} text-[#adbac7] bg-transparent hover:bg-[#161b22] cursor-pointer`
  }

  return (
    <div className="fixed inset-0 z-[300] bg-[#0d1117] flex flex-col">

      {/* Header */}
      <div className="flex items-center px-4 py-3 border-b border-[#30363d] shrink-0">
        <button
          onClick={onClose}
          className="px-3 py-1 text-sm font-bold text-[#6e7681] hover:text-white bg-transparent border border-[#30363d] hover:border-[#6e7681] rounded cursor-pointer transition-colors"
        >← Cancel</button>
        <span className="flex-1 text-center text-white font-bold text-lg truncate px-2">{itemName}</span>
        <div className="w-[72px]" />
      </div>

      {/* Hint */}
      <div className="px-4 py-2 border-b border-[#30363d] shrink-0 text-center text-[#8b949e] text-xs">
        Tap a day to print <span className="text-[#e3b341] font-semibold">{template}</span> labels expiring at end of that day
      </div>

      {/* Qty picker */}
      <div className="flex items-center justify-center gap-5 px-4 py-3 border-b border-[#30363d] shrink-0">
        <button
          onClick={() => setQty(q => Math.max(1, q - 1))}
          className="w-14 h-14 rounded-xl border border-[#30363d] bg-[#161b22] text-white text-3xl font-bold cursor-pointer hover:border-[#6e7681] hover:bg-[#21262d] active:scale-95 transition-all select-none flex items-center justify-center"
        >−</button>
        <span className="text-white font-bold text-3xl w-12 text-center select-none">{qty}</span>
        <button
          onClick={() => setQty(q => q + 1)}
          className="w-14 h-14 rounded-xl border border-[#30363d] bg-[#161b22] text-white text-3xl font-bold cursor-pointer hover:border-[#6e7681] hover:bg-[#21262d] active:scale-95 transition-all select-none flex items-center justify-center"
        >+</button>
      </div>

      {/* Calendar — fills remaining space */}
      <div className="flex flex-col flex-1 min-h-0 p-3 gap-2">

        {/* Month nav */}
        <div className="flex items-center justify-between shrink-0">
          <button
            onClick={() => setViewMonth(m => m.subtract(1, 'month'))}
            className="w-10 h-10 flex items-center justify-center rounded-lg border border-[#30363d] bg-transparent text-[#adbac7] hover:text-white hover:border-[#6e7681] cursor-pointer text-xl font-bold transition-colors"
          >‹</button>
          <span className="text-white font-bold text-base">{viewMonth.format('MMMM YYYY')}</span>
          <button
            onClick={() => setViewMonth(m => m.add(1, 'month'))}
            className="w-10 h-10 flex items-center justify-center rounded-lg border border-[#30363d] bg-transparent text-[#adbac7] hover:text-white hover:border-[#6e7681] cursor-pointer text-xl font-bold transition-colors"
          >›</button>
        </div>

        {/* Day-of-week headers */}
        <div className="grid grid-cols-7 shrink-0">
          {['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].map(d => (
            <div key={d} className="text-center text-[#6e7681] text-xs font-semibold py-1">{d}</div>
          ))}
        </div>

        {/* Day grid — grows to fill space */}
        <div className="grid grid-cols-7 gap-1 flex-1">
          {cells.map((day, i) =>
            day ? (
              <button
                key={i}
                onClick={() => { if (!day.isBefore(today, 'day')) void handleDayPress(day) }}
                disabled={day.isBefore(today, 'day')}
                className={dayClass(day)}
              >
                {day.date()}
              </button>
            ) : (
              <div key={i} />
            )
          )}
        </div>

      </div>
    </div>
  )
}
