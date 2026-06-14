import { useState, useCallback } from 'react'
import PageLayout from '../../components/PageLayout'
import AutoDismissAlert from '../../components/AutoDismissAlert'
import PrintPreview from '../../components/PrintPreview'
import { loadActiveLayout } from '../Preppy/labelDefs'
import { generateZpl } from '../Preppy/labelZpl'
import { useErrorMsg } from '../../hooks/useErrorMsg'

type LabelTemplate = 'IX' | 'OX' | 'UX'

const TEMPLATES: { id: LabelTemplate; label: string }[] = [
  { id: 'IX', label: 'IX' },
  { id: 'OX', label: 'OX' },
  { id: 'UX', label: 'UX' },
]

const DIGITS = ['1','2','3','4','5','6','7','8','9','0','00']

// ── Tailwind class map ──────────────────────────────────────────────────────
const classes = {
  alertWrapper:  'px-3 pt-3',
  tabsContainer: 'flex border-b-2 border-[#dee2e6]',
  tabBtn: (active: boolean) =>
    [
      'flex-1 min-h-[56px] border-solid border-0 border-b-[3px] text-[1.1rem] cursor-pointer',
      active
        ? 'border-[#0d6efd] bg-[#e7f1ff] font-bold text-[#0d6efd]'
        : 'border-transparent bg-[#f8f9fa] font-normal text-[#495057]',
    ].join(' '),
  body:          'p-3 flex flex-col gap-3',
  hoursDisplay:  'text-[3rem] font-black text-center border-2 border-[#dee2e6] rounded-xl py-2 bg-[#f8f9fa] tracking-[2px]',
  numpadGrid:    'grid grid-cols-3 gap-2',
  digitBtn:      'min-h-[68px] text-[1.5rem] font-bold border border-[#ced4da] rounded-xl bg-white',
  deleteBtn:     'min-h-[68px] text-[1.5rem] border border-[#ced4da] rounded-xl bg-[#fff3f3] text-[#dc3545]',
  footer:        'flex gap-2 p-3 items-center',
  qtyRow:        'flex gap-[6px] items-center',
  qtyBtn:        'w-[52px] h-[52px] text-[1.4rem] border border-[#ced4da] rounded-lg bg-[#f8f9fa]',
  qtyDisplay:    'min-w-[32px] text-center text-[1.2rem] font-bold',
  printBtn: (hasHrs: boolean) =>
    [
      'flex-1 min-h-[64px] text-[1.3rem] font-extrabold text-white border-0 rounded-xl disabled:opacity-60',
      hasHrs ? 'bg-[#198754]' : 'bg-[#6c757d]',
    ].join(' '),
  previewBtn: (active: boolean) =>
    [
      'border border-[#ffc107] rounded-lg px-[14px] py-[6px] text-[0.85rem] min-h-[40px]',
      active ? 'bg-[#ffc107] text-black' : 'bg-transparent text-[#856404]',
    ].join(' '),
}
// ───────────────────────────────────────────────────────────────────────────

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
      const zpl = generateZpl(loadActiveLayout(), { template, durationHrs: hrs })
      const result = await window.electronAPI.printZpl({ zpl, qty })
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
    <button onClick={() => setShowPreview(v => !v)} className={classes.previewBtn(showPreview)}>
      {showPreview ? 'Hide ZPL' : 'Preview ZPL'}
    </button>
  )

  const footer = (
    <div className={classes.footer}>
      <div className={classes.qtyRow}>
        <button onClick={() => setQty(q => Math.max(1, q - 1))} className={classes.qtyBtn}>−</button>
        <span className={classes.qtyDisplay}>{qty}</span>
        <button onClick={() => setQty(q => Math.min(50, q + 1))} className={classes.qtyBtn}>+</button>
      </div>
      <button
        onClick={handlePrint}
        disabled={printing || hrs === 0}
        className={classes.printBtn(hrs > 0)}
      >
        {printing ? 'Printing…' : `Print ×${qty}`}
      </button>
    </div>
  )

  return (
    <PageLayout title="Custom Label" back noPad footer={footer} right={rightBtn}>
      {status && (
        <div className={classes.alertWrapper}>
          <AutoDismissAlert variant={status.ok ? 'success' : 'danger'} msg={status.msg} onDismiss={clearStatus} />
        </div>
      )}

      {/* Template tabs */}
      <div className={classes.tabsContainer}>
        {TEMPLATES.map(({ id, label }) => (
          <button key={id} onClick={() => setTemplate(id)} className={classes.tabBtn(template === id)}>
            {label}
          </button>
        ))}
      </div>

      <div className={classes.body}>
        {/* Hours display */}
        <div className={classes.hoursDisplay}>{hrs}h</div>

        {/* Numpad */}
        <div className={classes.numpadGrid}>
          {DIGITS.map(d => (
            <button key={d} onClick={() => appendDigit(d)} className={classes.digitBtn}>{d}</button>
          ))}
          <button onClick={() => setHrs(prev => Math.floor(prev / 10))} className={classes.deleteBtn}>⌫</button>
        </div>

        {showPreview && <PrintPreview template={template} durationHrs={hrs} />}
      </div>
    </PageLayout>
  )
}
