import { useState, useEffect } from 'react'
import dayjs from 'dayjs'

interface Props {
  durationHrs: number
}

export default function Label({ durationHrs }: Props) {
  const [expiry, setExpiry] = useState(() => dayjs().add(durationHrs, 'hour'))

  useEffect(() => {
    setExpiry(dayjs().add(durationHrs, 'hour'))
    const timer = setInterval(() => setExpiry(dayjs().add(durationHrs, 'hour')), 60_000)
    return () => clearInterval(timer)
  }, [durationHrs])

  return (
    <div className="border rounded p-3 text-center bg-light">
      <div className="text-muted small">Use By</div>
      <div className="fs-5 fw-bold">{expiry.format('MM/DD/YY')}</div>
      <div className="fs-6">{expiry.format('hh:mm A')}</div>
    </div>
  )
}
