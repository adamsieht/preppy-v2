import { useState, useCallback } from 'react'
import PageLayout from '../../components/PageLayout'
import AutoDismissAlert from '../../components/AutoDismissAlert'
import PrintPreview from '../../components/PrintPreview'
import { useErrorMsg } from '../../hooks/useErrorMsg'

type LabelTemplate = 'IX' | 'OX' | 'UX'

const TEMPLATES: { id: LabelTemplate; label: string }[] = [
  { id: 'IX', label: 'IX' },
  { id: 'OX', label: 'OX' },
  { id: 'UX', label: 'UX' },
]

const DIGITS = ['1','2','3','4','5','6','7','8','9','0','00']

export default function PrintX() {
  const [template, setTemplate] = useState<LabelTemplate>('IX')
  const [hrs, setHrs] = useState(4)
  const [qty, setQty] = useState(1)
  const [status, setStatus] = useState<{ ok: boolean; msg: string } | null>(null)
  const [printing, setPrinting] = useState(false)
  const [showPreview, setShowPreview] = useState(false)
  const errorMsg = useErrorMsg()
  const clearStatus = useCallback(() => setStatus(null), [])

  function appendDigit(d: string) {
    setHrs(prev => {
      const next = parseInt(`${prev === 0 ? '' : prev}${d}`, 10)
      return next > 100 ? prev : next
    })
  }

  async function handlePrint() {
    setPrinting(true)
    try {
      const result = await window.electronAPI.print({ template, durationHrs: hrs, qty })
      setStatus(result.success
        ? { ok: true, msg: result.simulated
            ? `Simulated ×${qty} → ${result.simulatedPath ?? 'simulated-labels/'}`
            : `Printed ×${qty}` }
        : { ok: false, msg: result.error ?? 'Print failed' })
    } catch (err) {
      setStatus({ ok: false, msg: errorMsg(err, 'Print failed') })
    } finally {
      setPrinting(false)
    }
  }

  const rightBtn = (
    <button
      onClick={() => setShowPreview(v => !v)}
      style={{
        background: showPreview ? '#ffc107' : 'none',
        border: '1px solid #ffc107',
        borderRadius: 8,
        padding: '6px 14px',
        fontSize: '0.85rem',
        color: showPreview ? '#000' : '#856404',
        minHeight: 40,
      }}
    >
      {showPreview ? 'Hide ZPL' : 'Preview ZPL'}
    </button>
  )

  const footer = (
    <div style={{ display: 'flex', gap: 8, padding: 12, alignItems: 'center' }}>
      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
        <button
          onClick={() => setQty(q => Math.max(1, q - 1))}
          style={{ width: 52, height: 52, fontSize: '1.4rem', border: '1px solid #ced4da', borderRadius: 8, background: '#f8f9fa' }}
        >−</button>
        <span style={{ minWidth: 32, textAlign: 'center', fontSize: '1.2rem', fontWeight: 700 }}>{qty}</span>
        <button
          onClick={() => setQty(q => Math.min(50, q + 1))}
          style={{ width: 52, height: 52, fontSize: '1.4rem', border: '1px solid #ced4da', borderRadius: 8, background: '#f8f9fa' }}
        >+</button>
      </div>
      <button
        onClick={handlePrint}
        disabled={printing || hrs === 0}
        style={{
          flex: 1, minHeight: 64, fontSize: '1.3rem', fontWeight: 800,
          background: hrs === 0 ? '#6c757d' : '#198754',
          color: '#fff', border: 'none', borderRadius: 10,
          opacity: (printing || hrs === 0) ? 0.6 : 1,
        }}
      >
        {printing ? 'Printing…' : `Print ×${qty}`}
      </button>
    </div>
  )

  return (
    <PageLayout title="Custom Label" back noPad footer={footer} right={rightBtn}>
      {status && (
        <div style={{ padding: '12px 12px 0' }}>
          <AutoDismissAlert variant={status.ok ? 'success' : 'danger'} msg={status.msg} onDismiss={clearStatus} />
        </div>
      )}

      {/* Template tabs */}
      <div style={{ display: 'flex', borderBottom: '2px solid #dee2e6' }}>
        {TEMPLATES.map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setTemplate(id)}
            style={{
              flex: 1, minHeight: 56, border: 'none',
              borderBottom: template === id ? '3px solid #0d6efd' : '3px solid transparent',
              background: template === id ? '#e7f1ff' : '#f8f9fa',
              fontWeight: template === id ? 700 : 400,
              fontSize: '1.1rem',
              color: template === id ? '#0d6efd' : '#495057',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      <div style={{ padding: 12, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {/* Hours display */}
        <div style={{
          fontSize: '3rem', fontWeight: 900, textAlign: 'center',
          border: '2px solid #dee2e6', borderRadius: 10, padding: '8px 0',
          background: '#f8f9fa', letterSpacing: 2,
        }}>
          {hrs}h
        </div>

        {/* Numpad */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
          {DIGITS.map(d => (
            <button
              key={d}
              onClick={() => appendDigit(d)}
              style={{
                minHeight: 68, fontSize: '1.5rem', fontWeight: 700,
                border: '1px solid #ced4da', borderRadius: 10, background: '#fff',
              }}
            >
              {d}
            </button>
          ))}
          <button
            onClick={() => setHrs(prev => Math.floor(prev / 10))}
            style={{
              minHeight: 68, fontSize: '1.5rem',
              border: '1px solid #ced4da', borderRadius: 10, background: '#fff3f3', color: '#dc3545',
            }}
          >
            ⌫
          </button>
        </div>

        {showPreview && <PrintPreview template={template} durationHrs={hrs} />}
      </div>
    </PageLayout>
  )
}
