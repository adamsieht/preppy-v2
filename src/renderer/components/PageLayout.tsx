import { useNavigate } from 'react-router-dom'

interface Props {
  title: string
  back?: boolean | string       // true = '/', string = path
  right?: React.ReactNode
  children: React.ReactNode
  footer?: React.ReactNode      // sticky bottom bar
  noPad?: boolean               // opt out of content padding
}

export default function PageLayout({ title, back, right, children, footer, noPad }: Props) {
  const navigate = useNavigate()
  const backPath = back === true ? '/' : (back ?? null)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        minHeight: 64,
        padding: '0 16px',
        borderBottom: '1px solid #dee2e6',
        background: '#fff',
        flexShrink: 0,
        gap: 12,
      }}>
        {backPath && (
          <button
            onClick={() => navigate(backPath)}
            style={{
              background: 'none',
              border: '1px solid #ced4da',
              borderRadius: 8,
              padding: '8px 16px',
              fontSize: '1.1rem',
              minHeight: 48,
              color: '#495057',
            }}
          >
            ←
          </button>
        )}
        <span style={{ fontSize: '1.3rem', fontWeight: 700, flexGrow: 1 }}>{title}</span>
        {right}
      </div>

      {/* Scrollable content */}
      <div style={{ flex: 1, overflow: 'hidden auto', WebkitOverflowScrolling: 'touch' as never, padding: noPad ? 0 : 16 }}>
        {children}
      </div>

      {/* Sticky footer */}
      {footer && (
        <div style={{
          borderTop: '1px solid #dee2e6',
          background: '#fff',
          flexShrink: 0,
        }}>
          {footer}
        </div>
      )}
    </div>
  )
}
