import { useState, useEffect } from 'react'
import dayjs from 'dayjs'

// ── Tailwind class map ──────────────────────────────────────────────────────
const classes = {
  wrapper: 'flex items-center gap-3 shrink-0',
  date:    'text-sm text-[#768390]',
  time:    'text-sm font-bold text-[#adbac7]',
}
// ───────────────────────────────────────────────────────────────────────────

export default function Clock() {
  const [now, setNow] = useState(dayjs())

  useEffect(() => {
    const timer = setInterval(() => setNow(dayjs()), 1000)
    return () => clearInterval(timer)
  }, [])

  return (
    <div className={classes.wrapper}>
      <span className={classes.date}>{now.format('ddd, MMM D')}</span>
      <span className={classes.time}>{now.format('h:mm A')}</span>
    </div>
  )
}
