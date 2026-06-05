import { useState, useEffect } from 'react'
import dayjs from 'dayjs'

interface Props {
  durationHrs: number
  type?: string
}

// ── Tailwind class map ──────────────────────────────────────────────────────
const classes = {
  card:    'relative w-full aspect-[2/1] min-h-[65px] bg-[#f8f9fa] text-[#212529] text-center rounded-lg px-2 py-1 flex items-center justify-center',
  dow:     'absolute top-[3px] left-[5px] text-[18px] font-semibold leading-none',
  type:    'absolute top-[3px] right-[5px] text-[19px] font-semibold leading-none',
  display: 'mt-[30px] mb-0 text-[1.75rem] font-bold leading-none',
}
// ───────────────────────────────────────────────────────────────────────────

export default function Label({ durationHrs, type }: Props) {
  const [labelDate, setLabelDate] = useState(() => dayjs().add(durationHrs, 'hour'))

  useEffect(() => {
    setLabelDate(dayjs().add(durationHrs, 'hour'))
    const timer = setInterval(() => setLabelDate(dayjs().add(durationHrs, 'hour')), 1000)
    return () => clearInterval(timer)
  }, [durationHrs])

  const display = durationHrs < 24
    ? labelDate.format('h:mm A')
    : labelDate.format('MM/DD/YY')

  return (
    <div className={classes.card}>
      <p className={classes.dow}>{labelDate.format('dddd')}</p>
      {type && <p className={classes.type}>{type}</p>}
      <p className={classes.display}>{display}</p>
    </div>
  )
}
