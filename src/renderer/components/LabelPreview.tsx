import dayjs from 'dayjs'

type LabelTemplate = 'IX' | 'OX' | 'UX'

const TEMPLATE_LABELS: Record<LabelTemplate, string> = {
  IX: 'Internal Use',
  OX: 'Opened / Expiry',
  UX: 'Use First',
}

const USE_BY_LABEL: Record<LabelTemplate, string> = {
  IX: 'USE BY',
  OX: 'EXPIRES',
  UX: 'USE FIRST BY',
}

interface Props {
  template: LabelTemplate
  durationHrs: number
}

export default function LabelPreview({ template, durationHrs }: Props) {
  const now = dayjs()
  const expiry = now.add(durationHrs, 'hour')

  return (
    <div style={{
      background: '#fff',
      border: '2px solid #222',
      borderRadius: 6,
      padding: '16px 20px',
      fontFamily: 'monospace',
      boxShadow: '0 2px 12px rgba(0,0,0,0.15)',
      userSelect: 'none',
    }}>
      {/* Header row */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 4 }}>
        <span style={{ fontSize: '1rem', fontWeight: 700, letterSpacing: 2, color: '#222' }}>
          {template}
        </span>
        <span style={{ fontSize: '0.75rem', color: '#666' }}>
          {TEMPLATE_LABELS[template]}
        </span>
      </div>

      <div style={{ fontSize: '0.75rem', color: '#888', marginBottom: 8 }}>
        Made: {now.format('MM/DD/YYYY')} at {now.format('HH:mm')}
      </div>

      <hr style={{ margin: '6px 0 10px', borderColor: '#222', borderWidth: 2 }} />

      {/* Big expiry block */}
      <div style={{ fontSize: '0.7rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 3, color: '#444', marginBottom: 4 }}>
        {USE_BY_LABEL[template]}
      </div>
      <div style={{ fontSize: '3.2rem', fontWeight: 900, lineHeight: 1, color: '#111', marginBottom: 2 }}>
        {expiry.format('MM/DD/YYYY')}
      </div>
      <div style={{ fontSize: '2rem', fontWeight: 700, color: '#333', marginBottom: 10 }}>
        {expiry.format('HH:mm')}
      </div>

      <hr style={{ margin: '6px 0 8px', borderColor: '#aaa' }} />

      <div style={{ fontSize: '0.72rem', color: '#666' }}>
        {durationHrs < 24
          ? `${durationHrs}h from ${template === 'OX' ? 'opening' : 'prep'}`
          : `${durationHrs / 24} day${durationHrs / 24 !== 1 ? 's' : ''} from ${template === 'OX' ? 'opening' : 'prep'}`}
      </div>
    </div>
  )
}
