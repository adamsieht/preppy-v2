import { useRef, useState, useLayoutEffect } from 'react'
import type { LabelLayout, LabelValues } from '../pages/Preppy/labelTypes'
import { getLabelSize } from '../pages/Preppy/labelDefs'
import LabelPreview, { PX_PER_DOT } from './LabelPreview'

interface Props {
  layout: LabelLayout
  values: LabelValues
  offset?: { x: number; y: number }
}

/**
 * Renders an accurate `LabelPreview` of the given layout (a true-to-print
 * representation, including the Daymark day-of-week strip) and scales it to
 * fit whatever space the parent provides, preserving aspect ratio and
 * centering. Lets the preset cards show exactly what will be printed without
 * changing the surrounding card size or layout.
 */
export default function ScaledLabelPreview({ layout, values, offset }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(1)

  const size     = getLabelSize(layout.sizeKey)
  const naturalW = size.dotsW * PX_PER_DOT
  const naturalH = size.dotsH * PX_PER_DOT

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const update = () => {
      const { width, height } = el.getBoundingClientRect()
      if (width === 0 || height === 0) return
      setScale(Math.min(width / naturalW, height / naturalH))
    }
    update()
    const ro = new ResizeObserver(update)
    ro.observe(el)
    return () => ro.disconnect()
  }, [naturalW, naturalH])

  return (
    <div ref={ref} className="w-full h-full flex items-center justify-center overflow-hidden">
      <div style={{ width: naturalW * scale, height: naturalH * scale }}>
        <div style={{ transform: `scale(${scale})`, transformOrigin: 'top left' }}>
          <LabelPreview layout={layout} values={values} offset={offset} />
        </div>
      </div>
    </div>
  )
}
