import { useState } from 'react'
import Label from '../../components/Label'
import ScaledLabelPreview from '../../components/ScaledLabelPreview'
import type { LabelTemplate, TemplateHrs } from '../Preppy/types'
import type { LabelLayout } from '../Preppy/labelTypes'
import { TEMPLATES, NUMPAD_KEYS } from '../Preppy/constants'

interface PrintQtyPageProps {
  label:        string
  initTemplate: LabelTemplate
  templateHrs?: TemplateHrs   // item mode: switching template also changes duration
  durationHrs:  number        // preset mode: duration is always this value
  staticLayout?: LabelLayout  // static mode: no template/duration, just qty
  onPrint:      (qty: number, tpl: LabelTemplate) => void
  onClose:      () => void
}

export default function PrintQtyPage({ label, initTemplate, templateHrs, durationHrs, staticLayout, onPrint, onClose }: PrintQtyPageProps) {
  const [input, setInput] = useState('')
  const [tpl,   setTpl]   = useState<LabelTemplate>(initTemplate)

  // In item mode, duration changes with template; in preset mode it's fixed
  const resolvedHrs = templateHrs ? templateHrs[tpl] : durationHrs
  const qty = parseInt(input, 10) || 0

  function pressDigit(d: string) {
    setInput(prev => {
      const candidate = prev + d
      const val = parseInt(candidate, 10)
      if (isNaN(val) || val > 500) return prev
      return String(val)
    })
  }

  function pressBack() { setInput(prev => prev.slice(0, -1)) }
  function handleConfirm() { if (qty >= 1) onPrint(qty, tpl) }

  return (
    <div className="fixed inset-0 z-[300] bg-[#0d1117] flex flex-col">
      <div className="flex items-center px-4 py-3 border-b border-[#30363d] shrink-0">
        <button onClick={onClose} className="px-3 py-1 text-sm font-bold text-[#6e7681] hover:text-white bg-transparent border border-[#30363d] hover:border-[#6e7681] rounded cursor-pointer transition-colors">← Cancel</button>
        <span className="flex-1 text-center text-white font-bold text-lg">Print {label}</span>
        <div className="w-[72px]" />
      </div>

      <div className="flex-1 flex flex-col items-center justify-around px-6 py-4 max-w-sm mx-auto w-full min-h-0">

        {/* Template switcher — hidden in static mode (no template) */}
        {!staticLayout && (
          <div className="flex gap-3 shrink-0">
            {TEMPLATES.map(t => (
              <button
                key={t}
                onClick={() => setTpl(t)}
                className={`px-6 py-2 rounded-full font-bold text-sm border transition-colors cursor-pointer ${
                  tpl === t
                    ? 'bg-[#28a745] border-[#28a745] text-white'
                    : 'bg-transparent border-[#30363d] text-[#6e7681] hover:border-[#6e7681] hover:text-white'
                }`}
              >{t}</button>
            ))}
          </div>
        )}

        <div className="shrink-0">
          {staticLayout
            ? <div className="w-[220px] h-[120px]"><ScaledLabelPreview layout={staticLayout} values={{ template: 'IX', durationHrs: 0 }} /></div>
            : <Label durationHrs={resolvedHrs} type={tpl} />}
        </div>

        <div className="flex flex-col items-center gap-2 shrink-0">
          <div className="text-[#6e7681] text-sm font-medium">How many labels?</div>
          <div className="text-6xl font-bold text-white tracking-tight min-h-[72px] flex items-center justify-center">
            {input ? input : <span className="text-[#484f58]">0</span>}
          </div>
          <div className="text-[#6e7681] text-sm">max 500</div>
        </div>

        <div className="grid grid-cols-3 gap-2 w-full shrink-0">
          {NUMPAD_KEYS.map(key => {
            if (key === '⌫') return (
              <button key="back" onClick={pressBack} disabled={input.length === 0}
                className="h-16 rounded-xl bg-[#161b22] border border-[#30363d] text-white text-xl hover:bg-[#21262d] hover:border-[#6e7681] transition-colors disabled:opacity-30 cursor-pointer flex items-center justify-center"
              >⌫</button>
            )
            if (key === '✓') return (
              <button key="confirm" onClick={handleConfirm} disabled={qty < 1}
                className="h-16 rounded-xl bg-[#28a745] border-0 text-white text-lg font-bold hover:bg-[#2ea043] active:bg-[#238636] transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
              >✓ Print</button>
            )
            return (
              <button key={key} onClick={() => pressDigit(key)}
                className="h-16 rounded-xl bg-[#161b22] border border-[#30363d] text-white text-2xl font-bold hover:bg-[#21262d] hover:border-[#6e7681] active:bg-[#28a745]/20 transition-colors cursor-pointer"
              >{key}</button>
            )
          })}
        </div>

      </div>
    </div>
  )
}
