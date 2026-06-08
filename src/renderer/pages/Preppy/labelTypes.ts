export type LabelSizeKey = '2x1' | '2x2'
export type LabelStockKey = 'blank' | 'daymark'

/** What the user can place on a label */
export type ElementType =
  | 'expiry-date'
  | 'expiry-time'
  | 'print-date'
  | 'print-time'
  | 'dow-name'
  | 'template-id'
  | 'duration'
  | 'item-name'
  | 'static'

export interface LabelElement {
  id:         string
  type:       ElementType
  x:          number          // ZPL dots from left edge
  y:          number          // ZPL dots from top edge
  fontSize:   number          // ZPL font height (dots)
  fontWidth?: number          // ZPL font width (defaults to fontSize)
  rotation:   0 | 90 | 180 | 270
  text?:      string          // for 'static'
  dateFormat?: string         // for date/time elements
  bold?:      boolean
}

export interface DowStripConfig {
  x:               number   // strip left edge in dots
  y:               number   // strip top edge in dots
  cellW:           number   // width of one day cell
  cellH:           number   // height of one day cell
  order:           'mon-first' | 'sun-first'
  numberY:         number   // Y position for the day-of-month numbers row
  numberFontSize:  number
}

export interface LabelSize {
  key:       LabelSizeKey
  label:     string
  dotsW:     number       // at 203 DPI
  dotsH:     number
  widthIn:   number
  heightIn:  number
}

export interface LabelStock {
  key:    LabelStockKey
  label:  string
  hasDow: boolean
}

export interface LabelLayout {
  id:         string
  name:       string
  isBuiltin?: boolean
  sizeKey:    LabelSizeKey
  stockKey:   LabelStockKey
  elements:   LabelElement[]
  dowConfig?: DowStripConfig   // only when stockKey === 'daymark'
}

export type TemplateAssignments = Record<'IX' | 'OX' | 'UX', string>

/** Runtime values passed to ZPL/preview generators */
export interface LabelValues {
  template:    'IX' | 'OX' | 'UX'
  durationHrs: number
  itemName?:   string
}
