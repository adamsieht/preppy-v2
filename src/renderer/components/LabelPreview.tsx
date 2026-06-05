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

// ── Tailwind class map ──────────────────────────────────────────────────────
const classes = {
  wrapper:      'bg-white border-2 border-[#222] rounded-md px-5 py-4 font-mono shadow-[0_2px_12px_rgba(0,0,0,0.15)] select-none',
  headerRow:    'flex justify-between items-baseline mb-1',
  templateName: 'text-base font-bold tracking-[2px] text-[#222]',
  templateDesc: 'text-[0.75rem] text-[#666]',
  madeOn:       'text-[0.75rem] text-[#888] mb-2',
  dividerBold:  'border-t-2 border-[#222] my-[6px]',
  dividerLight: 'border-t border-[#aaa] my-[6px]',
  useByLabel:   'text-[0.7rem] font-bold uppercase tracking-[3px] text-[#444] mb-1',
  expiryDate:   'text-[3.2rem] font-black leading-none text-[#111] mb-[2px]',
  expiryTime:   'text-[2rem] font-bold text-[#333] mb-[10px]',
  footer:       'text-[0.72rem] text-[#666]',
}
// ───────────────────────────────────────────────────────────────────────────

export default function LabelPreview({ template, durationHrs }: Props) {
  const now = dayjs()
  const expiry = now.add(durationHrs, 'hour')

  return (
    <div className={classes.wrapper}>
      <div className={classes.headerRow}>
        <span className={classes.templateName}>{template}</span>
        <span className={classes.templateDesc}>{TEMPLATE_LABELS[template]}</span>
      </div>

      <div className={classes.madeOn}>
        Made: {now.format('MM/DD/YYYY')} at {now.format('HH:mm')}
      </div>

      <div className={classes.dividerBold} />

      <div className={classes.useByLabel}>{USE_BY_LABEL[template]}</div>
      <div className={classes.expiryDate}>{expiry.format('MM/DD/YYYY')}</div>
      <div className={classes.expiryTime}>{expiry.format('HH:mm')}</div>

      <div className={classes.dividerLight} />

      <div className={classes.footer}>
        {durationHrs < 24
          ? `${durationHrs}h from ${template === 'OX' ? 'opening' : 'prep'}`
          : `${durationHrs / 24} day${durationHrs / 24 !== 1 ? 's' : ''} from ${template === 'OX' ? 'opening' : 'prep'}`}
      </div>
    </div>
  )
}
