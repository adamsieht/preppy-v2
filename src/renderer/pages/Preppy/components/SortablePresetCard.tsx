import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import Label from '../../../components/Label'
import { TrashIcon } from './Icons'
import type { DisplayPreset, LabelTemplate } from '../types'
import { classes } from './SortablePresetCard.styles'

interface SortableCardProps {
  preset:   DisplayPreset
  template: LabelTemplate
  onDelete: (id: string) => void
}

export default function SortablePresetCard({ preset, template, onDelete }: SortableCardProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: preset.id })

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`relative w-[220px] h-[210px] bg-[#0d1117] border rounded-lg overflow-hidden flex flex-col cursor-grab active:cursor-grabbing select-none touch-none ${
        isDragging ? 'border-[#28a745] opacity-50 shadow-[0_0_0_2px_#28a745]' : 'border-[#30363d]'
      }`}
      {...attributes}
      {...listeners}
    >
      <div className="flex items-center border-b border-[#30363d] shrink-0">
        <div className="w-8 shrink-0" />
        <div className="flex-1 text-center py-[6px] text-white text-base font-bold tracking-wide">
          {preset.label}
        </div>
        <button
          onClick={e => { e.stopPropagation(); onDelete(preset.id) }}
          onPointerDown={e => e.stopPropagation()}
          className={classes.delBtn}
          title="Remove preset"
        >
          <TrashIcon />
        </button>
      </div>
      <div className="bg-[#090c10] p-3 flex-1 min-h-0 overflow-hidden">
        <Label durationHrs={preset.hrs} type={template} />
      </div>
    </div>
  )
}
