import { useState, useEffect } from 'react'
import dayjs from 'dayjs'

interface Props {
  showSeconds?: boolean
  timeOnly?:    boolean   // hide the date span; used when date is shown elsewhere
}

export default function Clock({ showSeconds, timeOnly }: Props) {
  const [now, setNow] = useState(dayjs())

  useEffect(() => {
    const timer = setInterval(() => setNow(dayjs()), 1000)
    return () => clearInterval(timer)
  }, [])

  const timeFmt = showSeconds ? 'h:mm:ss A' : 'h:mm A'

  return (
    <div className="flex items-center gap-3 shrink-0">
      {!timeOnly && (
        <span className="text-sm text-[#768390]">{now.format('ddd, MMM D')}</span>
      )}
      <span className={`${showSeconds ? 'text-base' : 'text-sm'} font-bold text-[#adbac7] tabular-nums`}>
        {now.format(timeFmt)}
      </span>
    </div>
  )
}
