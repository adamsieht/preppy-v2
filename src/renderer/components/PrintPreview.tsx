import { useEffect, useState } from 'react'

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

// ── Tailwind class map ──────────────────────────────────────────────────────
const classes = {
  errorText:      'text-[#dc3545] text-sm mt-2',
  loadingText:    'text-[#6c757d] text-sm mt-2',
  wrapper:        'mt-3 border-t pt-3',
  row:            'flex gap-3 items-start flex-wrap',
  rightCol:       'flex-1 min-w-[200px]',
  zplHeader:      'flex items-center justify-between mb-1',
  zplLabel:       'text-sm text-[#6c757d] font-semibold',
  copyBtn:        'border border-[#dee2e6] text-[#6c757d] bg-transparent rounded text-[0.7rem] px-[6px] py-[1px]',
  zplViewer:      'font-mono text-[0.75rem] bg-[#1e1e1e] text-[#d4d4d4] p-3 rounded overflow-x-auto leading-[1.6] flex-1 min-w-0',
  zplCommand:     'text-[#569cd6] font-bold',
  table:          'mt-2 w-full border-collapse font-mono text-[0.75rem]',
  tableCell:      'border border-[#dee2e6] px-2 py-1',
  tableCellMuted: 'border border-[#dee2e6] px-2 py-1 text-[#6c757d]',
  // LabelMock
  mock:           'w-[260px] bg-white border-2 border-[#222] rounded-[4px] px-[14px] py-[10px] font-mono shadow-[2px_2px_6px_rgba(0,0,0,0.12)] shrink-0',
  mockHeader:     'text-[11px] font-semibold tracking-[1px] text-[#444]',
  mockDate:       'text-[10px] text-[#888] mb-[6px]',
  mockDivider:    'border-t border-[#222] my-1',
  mockLabel:      'text-[11px] font-bold uppercase tracking-[2px]',
  mockExpiryDate: 'text-[30px] font-black leading-[1.1]',
  mockExpiryTime: 'text-[22px] font-bold',
  mockFooter:     'text-[10px] text-[#666]',
}
// ───────────────────────────────────────────────────────────────────────────

function LabelMock({ fields }: { fields: PreviewFields }) {
  return (
    <div className={classes.mock}>
      <div className={classes.mockHeader}>
        {fields.template} — {TEMPLATE_LABELS[fields.template]}
      </div>
      <div className={classes.mockDate}>{fields.printDate} {fields.printTime}</div>
      <div className={classes.mockDivider} />
      <div className={classes.mockLabel}>
        {fields.template === 'UX' ? 'Use First By' : fields.template === 'OX' ? 'Expires' : 'Use By'}
      </div>
      <div className={classes.mockExpiryDate}>{fields.expiryDate}</div>
      <div className={classes.mockExpiryTime}>{fields.expiryTime}</div>
      <div className={classes.mockDivider} />
      <div className={classes.mockFooter}>
        {fields.template === 'UX'
          ? `Priority — ${fields.durationHrs}h`
          : `${fields.durationHrs}h from ${fields.template === 'OX' ? 'opening' : 'prep'}`}
      </div>
    </div>
  )
}

function ZplViewer({ zpl }: { zpl: string }) {
  return (
    <div className={classes.zplViewer}>
      {zpl.split('\n').filter(Boolean).map((line, i) => (
        <div key={i}>
          {line.split(/(^\^[A-Z0-9]+)/).map((part, j) =>
            /^\^[A-Z0-9]+/.test(part)
              ? <span key={j} className={classes.zplCommand}>{part}</span>
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

  if (error) return <div className={classes.errorText}>{error}</div>
  if (!zpl || !fields) return <div className={classes.loadingText}>Loading preview…</div>

  return (
    <div className={classes.wrapper}>
      <div className={classes.row}>
        <LabelMock fields={fields} />
        <div className={classes.rightCol}>
          <div className={classes.zplHeader}>
            <span className={classes.zplLabel}>ZPL OUTPUT</span>
            <button className={classes.copyBtn} onClick={() => navigator.clipboard.writeText(zpl)}>
              Copy
            </button>
          </div>
          <ZplViewer zpl={zpl} />
          <table className={classes.table}>
            <tbody>
              {[
                ['{{DATE}}', fields.printDate],
                ['{{TIME}}', fields.printTime],
                ['{{EXPIRY_DATE}}', fields.expiryDate],
                ['{{EXPIRY_TIME}}', fields.expiryTime],
                ['{{DURATION}}', String(fields.durationHrs)],
              ].map(([ph, val]) => (
                <tr key={ph}>
                  <td className={classes.tableCellMuted}>{ph}</td>
                  <td className={classes.tableCell}>{val}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
