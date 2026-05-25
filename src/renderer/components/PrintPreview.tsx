import { useEffect, useState } from 'react'
import { Table, Button } from 'react-bootstrap'

type LabelTemplate = 'IX' | 'OX' | 'UX'

const TEMPLATE_LABELS: Record<LabelTemplate, string> = {
  IX: 'Internal Use',
  OX: 'Opened/Expiry',
  UX: 'Use First',
}

interface PreviewFields {
  template: LabelTemplate
  durationHrs: number
  printDate: string
  printTime: string
  expiryDate: string
  expiryTime: string
}

function LabelMock({ fields }: { fields: PreviewFields }) {
  return (
    <div style={{
      width: 260,
      background: '#fff',
      border: '2px solid #222',
      borderRadius: 4,
      padding: '10px 14px',
      fontFamily: 'monospace',
      boxShadow: '2px 2px 6px rgba(0,0,0,0.12)',
      flexShrink: 0,
    }}>
      <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: 1, color: '#444' }}>
        {fields.template} — {TEMPLATE_LABELS[fields.template]}
      </div>
      <div style={{ fontSize: 10, color: '#888', marginBottom: 6 }}>
        {fields.printDate} {fields.printTime}
      </div>
      <hr style={{ margin: '4px 0', borderColor: '#222' }} />
      <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 2 }}>
        {fields.template === 'UX' ? 'Use First By' : fields.template === 'OX' ? 'Expires' : 'Use By'}
      </div>
      <div style={{ fontSize: 30, fontWeight: 900, lineHeight: 1.1 }}>{fields.expiryDate}</div>
      <div style={{ fontSize: 22, fontWeight: 700 }}>{fields.expiryTime}</div>
      <hr style={{ margin: '6px 0', borderColor: '#222' }} />
      <div style={{ fontSize: 10, color: '#666' }}>
        {fields.template === 'UX' ? `Priority — ${fields.durationHrs}h` : `${fields.durationHrs}h from ${fields.template === 'OX' ? 'opening' : 'prep'}`}
      </div>
    </div>
  )
}

function ZplViewer({ zpl }: { zpl: string }) {
  return (
    <div style={{
      fontFamily: 'monospace',
      fontSize: '0.75rem',
      background: '#1e1e1e',
      color: '#d4d4d4',
      padding: 12,
      borderRadius: 6,
      overflowX: 'auto',
      lineHeight: 1.6,
      flex: 1,
      minWidth: 0,
    }}>
      {zpl.split('\n').filter(Boolean).map((line, i) => (
        <div key={i}>
          {line.split(/(^\^[A-Z0-9]+)/).map((part, j) =>
            /^\^[A-Z0-9]+/.test(part)
              ? <span key={j} style={{ color: '#569cd6', fontWeight: 'bold' }}>{part}</span>
              : <span key={j}>{part}</span>
          )}
        </div>
      ))}
    </div>
  )
}

interface Props {
  template: LabelTemplate
  durationHrs: number
}

export default function PrintPreview({ template, durationHrs }: Props) {
  const [zpl, setZpl] = useState<string | null>(null)
  const [fields, setFields] = useState<PreviewFields | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setError(null)
    window.electronAPI.previewPrint({ template, durationHrs })
      .then((result) => {
        if (!result.success || !result.zpl || !result.fields) {
          setError(result.error ?? 'Preview unavailable')
        } else {
          setZpl(result.zpl)
          setFields(result.fields as PreviewFields)
        }
      })
      .catch((err: unknown) => setError(err instanceof Error ? err.message : String(err)))
  }, [template, durationHrs])

  if (error) return <div className="text-danger small mt-2">{error}</div>
  if (!zpl || !fields) return <div className="text-muted small mt-2">Loading preview…</div>

  return (
    <div className="mt-3 border-top pt-3">
      <div className="d-flex gap-3 align-items-start flex-wrap">
        <LabelMock fields={fields} />
        <div style={{ flex: 1, minWidth: 200 }}>
          <div className="d-flex align-items-center justify-content-between mb-1">
            <span className="small text-muted fw-semibold">ZPL OUTPUT</span>
            <Button size="sm" variant="outline-secondary" style={{ fontSize: '0.7rem', padding: '1px 6px' }}
              onClick={() => navigator.clipboard.writeText(zpl)}>
              Copy
            </Button>
          </div>
          <ZplViewer zpl={zpl} />
          <Table size="sm" bordered className="mt-2 mb-0" style={{ fontFamily: 'monospace', fontSize: '0.75rem' }}>
            <tbody>
              {[
                ['{{DATE}}', fields.printDate],
                ['{{TIME}}', fields.printTime],
                ['{{EXPIRY_DATE}}', fields.expiryDate],
                ['{{EXPIRY_TIME}}', fields.expiryTime],
                ['{{DURATION}}', String(fields.durationHrs)],
              ].map(([ph, val]) => (
                <tr key={ph}><td className="text-muted">{ph}</td><td>{val}</td></tr>
              ))}
            </tbody>
          </Table>
        </div>
      </div>
    </div>
  )
}
