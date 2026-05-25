import { useState, useEffect } from 'react'
import dayjs from 'dayjs'

export default function Clock() {
  const [now, setNow] = useState(dayjs())

  useEffect(() => {
    const timer = setInterval(() => setNow(dayjs()), 1000)
    return () => clearInterval(timer)
  }, [])

  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '2px 4px' }}>
      <span style={{ fontSize: '1rem', color: '#6c757d' }}>{now.format('ddd, MMM D')}</span>
      <span style={{ fontSize: '1.2rem', fontWeight: 700 }}>{now.format('h:mm A')}</span>
    </div>
  )
}
