import CalendarPicker from './CalendarPicker'
import type { LabelTemplate } from '../pages/Preppy/types'

interface DatePromptPageProps {
  itemName:      string
  template:      LabelTemplate
  onPrint:       (hrs: number, qty: number) => void | Promise<void>
  onCustomPrint: (hrs: number, label: string) => void
  onClose:       () => void
}

/**
 * Full-screen modal shown when an item has no fixed shelf life for the selected
 * template (use-by-date / keep-expiration items). Wraps the shared
 * CalendarPicker so the operator can enter the real expiration date; the picked
 * date is converted to a duration and printed exactly like any other label.
 */
export default function DatePromptPage({ itemName, template, onPrint, onCustomPrint, onClose }: DatePromptPageProps) {
  return (
    <div className="fixed inset-0 z-[300] bg-[#0d1117] flex flex-col">
      {/* Header */}
      <div className="flex items-center px-4 py-3 border-b border-[#30363d] shrink-0">
        <button onClick={onClose} className="px-3 py-1 text-sm font-bold text-[#6e7681] hover:text-white bg-transparent border border-[#30363d] hover:border-[#6e7681] rounded cursor-pointer transition-colors">← Cancel</button>
        <span className="flex-1 text-center text-white font-bold text-lg truncate px-2">{itemName}</span>
        <div className="w-[72px]" />
      </div>

      {/* Hint */}
      <div className="px-4 py-2 border-b border-[#30363d] shrink-0 text-center text-[#8b949e] text-xs">
        No fixed shelf life — pick the <span className="text-[#e3b341] font-semibold">{template}</span> expiration date for this label
      </div>

      <CalendarPicker
        template={template}
        onPrint={async (hrs, qty) => { await onPrint(hrs, qty); onClose() }}
        onCustomPrint={(hrs, label) => { onCustomPrint(hrs, label); onClose() }}
      />
    </div>
  )
}
