import Label from './Label'
import ScaledLabelPreview from './ScaledLabelPreview'
import { LABEL_PREVIEW_STYLE_KEY } from '../pages/Preppy/constants'
import type { LabelPreviewStyle } from '../pages/Preppy/constants'
import { DISPLAY_DOW_CONFIG } from '../pages/Preppy/labelDefs'
import type { LabelLayout, LabelValues } from '../pages/Preppy/labelTypes'

/** Read the saved preview style (defaults to the display-friendly card). */
export function getLabelPreviewStyle(): LabelPreviewStyle {
  const v = localStorage.getItem(LABEL_PREVIEW_STYLE_KEY)
  if (v === 'actual' || v === 'display-zpl') return v
  return 'friendly'
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
 *  • 'friendly'    → a clean, readable card (the classic look)
 *  • 'display-zpl' → ZPL layout renderer with a display-friendly DOW config
 *                    (numbers below the colour band — the v2.0.0 look)
 *  • 'actual'      → true-to-print rendering of the real ZPL layout
 * Falls back to ZPL rendering when the layout contains content the friendly
 * card can't represent (item names or static/tiled text). Printing always
 * uses the real layout regardless of this setting.
 */
export default function SmartLabelPreview({ layout, values, offset, force }: Props) {
  const style = force ?? getLabelPreviewStyle()
  const unrepresentable = layout.elements.some(el => el.type === 'item-name' || el.type === 'static')

  if (style === 'friendly' && !unrepresentable) {
    return (
      <div className="w-full h-full flex items-center justify-center overflow-hidden">
        <div className="w-full">
          <Label durationHrs={values.durationHrs} type={values.template} />
        </div>
      </div>
    )
  }

  if (style === 'display-zpl' && layout.dowConfig) {
    const displayLayout: LabelLayout = { ...layout, dowConfig: DISPLAY_DOW_CONFIG }
    return <ScaledLabelPreview layout={displayLayout} values={values} offset={offset} />
  }

  return <ScaledLabelPreview layout={layout} values={values} offset={offset} />
}
