import { useNavigate, useLocation } from 'react-router-dom'

export default function DebugButton() {
  const navigate = useNavigate()
  const location = useLocation()

  if (location.pathname === '/debug') return null

  return (
    <button
      onClick={() => navigate('/debug')}
      title="Open debug panel"
      style={{
        position: 'fixed',
        bottom: 16,
        right: 16,
        zIndex: 9999,
        background: 'rgba(220, 53, 69, 0.85)',
        color: '#fff',
        border: 'none',
        borderRadius: 6,
        padding: '6px 12px',
        fontSize: '0.75rem',
        fontFamily: 'monospace',
        fontWeight: 700,
        letterSpacing: 1,
        cursor: 'pointer',
        backdropFilter: 'blur(4px)',
        boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
        userSelect: 'none',
      }}
    >
      DEBUG
    </button>
  )
}
