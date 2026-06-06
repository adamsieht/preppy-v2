import { useState } from 'react'
import Label from '../../components/Label'
import type { LabelTemplate } from '../Preppy/types'
import { NUMPAD_KEYS } from '../Preppy/constants'

interface AddPresetPageProps {
  template: LabelTemplate
  onAdd:    (hrs: number) => void
  onClose:  () => void
}

export default function AddPresetPage({ template, onAdd, onClose }: AddPresetPageProps) {
  const [input, setInput] = useState('')
  const [unit,  setUnit]  = useState<'hours' | 'days'>('hours')

  const numValue = parseInt(input, 10) || 0
  const hrs      = unit === 'hours' ? numValue : numValue * 24
  const maxVal   = unit === 'hours' ? 720 : 365

  function pressDigit(d: string) {
    setInput(prev => {
      const candidate = prev + d
      const val = parseInt(candidate, 10)
      if (isNaN(val) || val > maxVal) return prev
      return String(val)
    })
  }

  function pressBack() {
    setInput(prev => prev.slice(0, -1))
  }

  function switchUnit(u: 'hours' | 'days') {
    setUnit(u)
    setInput('')
  }

  function handleConfirm() {
    if (hrs < 1) return
    onAdd(hrs)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-[300] bg-[#0d1117] flex flex-col">
      <div className="flex items-center px-4 py-3 border-b border-[#30363d] shrink-0">
        <button
          onClick={onClose}
          className="px-3 py-1 text-sm font-bold text-[#6e7681] hover:text-white bg-transparent border border-[#30363d] hover:border-[#6e7681] rounded cursor-pointer transition-colors"
        >
          ← Cancel
        </button>
        <span className="flex-1 text-center text-white font-bold text-lg">New Preset</span>
        <div className="w-[72px]" />
      </div>

      <div className="flex-1 flex flex-col items-center justify-around px-6 py-4 max-w-sm mx-auto w-full min-h-0">

        <div className="flex gap-3 shrink-0">
          {(['hours', 'days'] as const).map(u => (
            <button
              key={u}
              onClick={() => switchUnit(u)}
              className={`px-8 py-2 rounded-full font-bold text-sm border transition-colors cursor-pointer ${
                unit === u
                  ? 'bg-[#28a745] border-[#28a745] text-white'
                  : 'bg-transparent border-[#30363d] text-[#6e7681] hover:border-[#6e7681] hover:text-white'
              }`}
            >
              {u.toUpperCase()}
            </button>
          ))}
        </div>

        <div className="flex flex-col items-center gap-2 shrink-0">
          <div className="text-6xl font-bold text-white tracking-tight min-h-[72px] flex items-center justify-center">
            {input ? input : <span className="text-[#484f58]">0</span>}
          </div>
          <div className="text-[#6e7681] text-sm">
            {unit} &nbsp;·&nbsp; max {maxVal}
          </div>
          {hrs > 0 && (
            <div className="mt-2">
              <Label durationHrs={hrs} type={template} />
            </div>
          )}
        </div>

        <div className="grid grid-cols-3 gap-2 w-full shrink-0">
          {NUMPAD_KEYS.map(key => {
            if (key === '⌫') {
              return (
                <button
                  key="back"
                  onClick={pressBack}
                  disabled={input.length === 0}
                  className="h-16 rounded-xl bg-[#161b22] border border-[#30363d] text-white text-xl hover:bg-[#21262d] hover:border-[#6e7681] transition-colors disabled:opacity-30 cursor-pointer flex items-center justify-center"
                >⌫</button>
              )
            }
            if (key === '✓') {
              return (
                <button
                  key="confirm"
                  onClick={handleConfirm}
                  disabled={hrs < 1}
                  className="h-16 rounded-xl bg-[#28a745] border-0 text-white text-lg font-bold hover:bg-[#2ea043] active:bg-[#238636] transition-colors disabled:opacity-30 disabled:cursor-not-allowed cursor-pointer"
                >✓ Add</button>
              )
            }
            return (
              <button
                key={key}
                onClick={() => pressDigit(key)}
                className="h-16 rounded-xl bg-[#161b22] border border-[#30363d] text-white text-2xl font-bold hover:bg-[#21262d] hover:border-[#6e7681] active:bg-[#28a745]/20 transition-colors cursor-pointer"
              >{key}</button>
            )
          })}
        </div>

      </div>
    </div>
  )
}
