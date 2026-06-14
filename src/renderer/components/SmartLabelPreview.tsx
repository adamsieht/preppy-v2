import Label from './Label'
import ScaledLabelPreview from './ScaledLabelPreview'
import { LABEL_PREVIEW_STYLE_KEY } from '../pages/Preppy/constants'
import type { LabelPreviewStyle } from '../pages/Preppy/constants'
import type { LabelLayout, LabelValues } from '../pages/Preppy/labelTypes'

/** Read the saved preview style (defaults to the display-friendly card). */
export function getLabelPreviewStyle(): LabelPreviewStyle {
  return localStorage.getItem(LABEL_PREVIEW_STYLE_KEY) === 'actual' ? 'actual' : 'friendly'
}

interface Props {
  layout: LabelLayout
  values: LabelValues
  offset?: { x: number; y: number }
  /** Override the global setting (e.g. force the actual layout in the editor). */
  force?: LabelPreviewStyle
}

/**
 * Renders a label preview honouring the user's preview-style preference:
 *  • 'friendly' → a clean, readable card (the classic look)
 *  • 'actual'   → a true-to-print rendering of the real ZPL layout
 * Falls back to the actual rendering when the layout contains content the
 * friendly card can't represent (item names or static/tiled text), so quick
 * items and static presets always show their real content. Printing is
 * unaffected — it always uses the real layout.
 */
export default function SmartLabelPreview({ layout, values, offset, force }: Props) {
  const style = force ?? getLabelPreviewStyle()
  const unrepresentable = layout.elements.some(el => el.type === 'item-name' || el.type === 'static')

  if (style === 'friendly' && !unrepresentable) {
    // Fill the parent (like ScaledLabelPreview) so this is a clean drop-in. The
    // friendly Label card is width-driven (aspect 2:1), centred in the slot.
    return (
      <div className="w-full h-full flex items-center justify-center overflow-hidden">
        <div className="w-full">
          <Label durationHrs={values.durationHrs} type={values.template} />
        </div>
      </div>
    )
  }
  return <ScaledLabelPreview layout={layout} values={values} offset={offset} />
}
