import { useState, useEffect } from 'react'

type Status = 'loading' | 'unconfigured' | 'ok' | 'error'

const LABELS: Record<Status, string> = {
  loading:      'Checking printer…',
  unconfigured: 'No printer configured — running in simulate mode',
  ok:           'Printer connected',
  error:        'Printer not accessible — check connection',
}

function PrinterIcon({ status }: { status: Status }) {
  const color =
    status === 'ok'           ? 'var(--c-accent)' :
    status === 'error'        ? '#f85149'          :
    status === 'unconfigured' ? '#6e7681'          :
                                '#444c56'

  const dotColor =
    status === 'ok'    ? 'var(--c-accent)' :
    status === 'error' ? '#f85149'          :
    null

  return (
    <div style={{ position: 'relative', display: 'inline-flex' }}>
      <svg
        width="20" height="20"
        viewBox="0 0 24 24"
        fill="none"
        stroke={color}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {/* paper tray (top) */}
        <path d="M6 9V3h12v6" />
        {/* printer body */}
        <rect x="2" y="9" width="20" height="9" rx="2" />
        {/* output paper (bottom) */}
        <path d="M6 18h12v3H6z" />
        {/* ready indicator dot on body */}
        <circle cx="18" cy="13.5" r="1" fill={color} stroke="none" />
      </svg>

      {/* Status dot — bottom-right corner of the icon */}
      {dotColor && (
        <span style={{
          position: 'absolute',
          bottom: -1, right: -1,
          width: 7, height: 7,
          borderRadius: '50%',
          background: dotColor,
          border: '1.5px solid var(--c-surface, #161b22)',
        }} />
      )}
    </div>
  )
}

export default function PrinterStatus() {
  const [status, setStatus] = useState<Status>('loading')

  async function check() {
    try {
      const cfg = await window.electronAPI.getConfig()
      const dev = (cfg as { printer?: { device?: string } })?.printer?.device ?? ''
      if (!dev) { setStatus('unconfigured'); return }
      const result = await window.electronAPI.testPrinter(dev)
      setStatus(result.success ? 'ok' : 'error')
    } catch {
      setStatus('error')
    }
  }

  useEffect(() => {
    check()
    const iv = setInterval(check, 30_000)
    return () => clearInterval(iv)
  }, [])

  return (
    <div
      title={LABELS[status]}
      style={{ display: 'inline-flex', alignItems: 'center', cursor: 'default', padding: '0 2px' }}
    >
      <PrinterIcon status={status} />
    </div>
  )
}
