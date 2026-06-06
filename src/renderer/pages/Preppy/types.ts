export type LabelTemplate = 'IX' | 'OX' | 'UX'

export interface TemplateHrs { IX: number; OX: number; UX: number }

export type PrintQtyTarget =
  | { kind: 'preset'; label: string; durationHrs: number }
  | { kind: 'item';   label: string; templateHrs: TemplateHrs }

export interface BundleEntry {
  hrs:   TemplateHrs
  qty:   number
  name?: string
}

export interface QuickSingleItem {
  id:        string
  name:      string
  type:      'item'
  hrs:       TemplateHrs
  category?: string
}

export interface QuickBundleItem {
  id:      string
  name:    string
  type:    'bundle'
  entries: BundleEntry[]
}

export type QuickListEntry = QuickSingleItem | QuickBundleItem

export interface PrintJob {
  template:     string
  duration_hrs: number
  qty:          number
  printed_at:   string
  success:      number
}

export interface CategoryDef {
  id:    string
  label: string
  color: string
}

export interface CustomPreset {
  id:    string
  label: string
  hrs:   number
}

export interface DisplayPreset {
  id:        string
  label:     string
  hrs:       number
  isDefault: boolean
}

export interface ToastState {
  id:        string
  qty:       number
  done:      number
  state:     'printing' | 'success' | 'error'
  label?:    string
  errorMsg?: string
  removing?: boolean
}
