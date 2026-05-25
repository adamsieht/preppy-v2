import { useNavigate } from 'react-router-dom'
import Clock from '../../components/Clock'

const NAV_ITEMS = [
  { label: 'Print Labels', path: '/preppy', bg: '#0d6efd', color: '#fff' },
  { label: 'Custom Label', path: '/printx', bg: '#6c757d', color: '#fff' },
  { label: 'Temperatures', path: '/tempy', bg: '#0dcaf0', color: '#000' },
  { label: 'Prep List',    path: '/tally', bg: '#ffc107', color: '#000' },
  { label: 'Reports',      path: '/reports', bg: '#212529', color: '#fff' },
  { label: 'WiFi',         path: '/wifi', bg: '#f8f9fa', color: '#212529' },
]

export default function Home() {
  const navigate = useNavigate()

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: 12, gap: 8 }}>
      <div style={{ padding: '4px 8px', flexShrink: 0 }}>
        <Clock />
      </div>
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr',
        gap: 10,
        flex: 1,
      }}>
        {NAV_ITEMS.map(({ label, path, bg, color }) => (
          <button
            key={path}
            onClick={() => navigate(path)}
            style={{
              background: bg,
              color,
              border: 'none',
              borderRadius: 12,
              fontSize: '1.3rem',
              fontWeight: 700,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 2px 6px rgba(0,0,0,0.12)',
            }}
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  )
}
