import { useState, useCallback } from 'react'
import PageLayout from '../../components/PageLayout'
import AutoDismissAlert from '../../components/AutoDismissAlert'
import LabelPreview from '../../components/LabelPreview'
import { useErrorMsg } from '../../hooks/useErrorMsg'

type LabelTemplate = 'IX' | 'OX' | 'UX'

const TEMPLATES: { id: LabelTemplate; label: string }[] = [
  { id: 'IX', label: 'IX — Internal' },
  { id: 'OX', label: 'OX — Opened' },
  { id: 'UX', label: 'UX — Use First' },
]

const PRESETS: { label: string; hrs: number }[] = [
  { label: '4 HR',   hrs: 4   },
  { label: '8 HR',   hrs: 8   },
  { label: '12 HR',  hrs: 12  },
  { label: '1 DAY',  hrs: 24  },
  { label: '2 DAY',  hrs: 48  },
  { label: '3 DAY',  hrs: 72  },
  { label: '7 DAY',  hrs: 168 },
  { label: '14 DAY', hrs: 336 },
  { label: '30 DAY', hrs: 720 },
]

export default function Preppy() {
  const [template, setTemplate] = useState<LabelTemplate>('IX')
  const [selectedHrs, setSelectedHrs] = useState<number | null>(null)
  const [status, setStatus] = useState<{ ok: boolean; msg: string } | null>(null)
  const [printing, setPrinting] = useState(false)
  const errorMsg = useErrorMsg()
  const clearStatus = useCallback(() => setStatus(null), [])

  async function handlePrint(qty: number) {
    if (!selectedHrs) return
    setPrinting(true)
    try {
      const result = await window.electronAPI.print({ template, durationHrs: selectedHrs, qty })
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

  const footer = selectedHrs ? (
    <div style={{ display: 'flex', gap: 8, padding: 12 }}>
      <button
        onClick={() => handlePrint(1)}
        disabled={printing}
        style={{
          flex: 1, minHeight: 64, fontSize: '1.3rem', fontWeight: 700,
          background: '#0d6efd', color: '#fff', border: 'none', borderRadius: 10,
          opacity: printing ? 0.6 : 1,
        }}
      >
        Print ×1
      </button>
      <button
        onClick={() => handlePrint(5)}
        disabled={printing}
        style={{
          flex: 2, minHeight: 64, fontSize: '1.4rem', fontWeight: 800,
          background: '#198754', color: '#fff', border: 'none', borderRadius: 10,
          opacity: printing ? 0.6 : 1,
        }}
      >
        {printing ? 'Printing…' : 'Print ×5'}
      </button>
    </div>
  ) : null

  return (
    <PageLayout title="Print Labels" back noPad footer={footer}>
      {status && (
        <div style={{ padding: '12px 12px 0' }}>
          <AutoDismissAlert variant={status.ok ? 'success' : 'danger'} msg={status.msg} onDismiss={clearStatus} />
        </div>
      )}

      {/* Template tabs */}
      <div style={{ display: 'flex', gap: 0, borderBottom: '2px solid #dee2e6', flexShrink: 0 }}>
        {TEMPLATES.map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setTemplate(id)}
            style={{
              flex: 1, minHeight: 56, border: 'none', borderBottom: template === id ? '3px solid #0d6efd' : '3px solid transparent',
              background: template === id ? '#e7f1ff' : '#f8f9fa',
              fontWeight: template === id ? 700 : 400,
              fontSize: '0.95rem',
              color: template === id ? '#0d6efd' : '#495057',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Preset grid — fills remaining height */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: '1fr 1fr 1fr',
        gap: 8,
        padding: 12,
      }}>
        {PRESETS.map(({ label, hrs }) => {
          const active = selectedHrs === hrs
          return (
            <button
              key={hrs}
              onClick={() => setSelectedHrs(hrs)}
              style={{
                minHeight: 72,
                border: active ? '3px solid #198754' : '2px solid #dee2e6',
                borderRadius: 10,
                background: active ? '#d1e7dd' : '#fff',
                fontSize: '1.2rem',
                fontWeight: active ? 800 : 600,
                color: active ? '#0f5132' : '#212529',
                boxShadow: active ? '0 0 0 2px #19875440' : 'none',
              }}
            >
              {label}
            </button>
          )
        })}
      </div>

      {/* Live label preview */}
      {selectedHrs ? (
        <div style={{ padding: '0 12px 12px' }}>
          <LabelPreview template={template} durationHrs={selectedHrs} />
        </div>
      ) : (
        <p style={{ color: '#adb5bd', fontSize: '0.9rem', padding: '4px 12px', textAlign: 'center' }}>
          Select a time above to preview the label
        </p>
      )}

    </PageLayout>
  )
}
