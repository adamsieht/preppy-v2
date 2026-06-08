import { useState } from 'react'
import type { QuickSingleItem, BundleEntry, LabelTemplate } from '../Preppy/types'
import { fmtDuration } from '../Preppy/utils'
import { styles } from './styles'

interface AddBundlePageProps {
  quickItems:      QuickSingleItem[]
  durationOptions: { label: string; hrs: number }[]
  onAdd:   (name: string, entries: BundleEntry[]) => void
  onClose: () => void
}

const TEMPLATES: LabelTemplate[] = ['IX', 'OX', 'UX']

export default function AddBundlePage({ quickItems, durationOptions, onAdd, onClose }: AddBundlePageProps) {
  const [name,    setName]    = useState('')
  const [entries, setEntries] = useState<BundleEntry[]>([])

  // Per-quick-item state: qty + template
  const [itemQtys,      setItemQtys]      = useState<Record<string, number>>({})
  const [itemTemplates, setItemTemplates] = useState<Record<string, LabelTemplate>>({})

  // Custom entry state: single template + single duration
  const [cTemplate, setCTemplate] = useState<LabelTemplate>('IX')
  const [cHrs,      setCHrs]      = useState(durationOptions[2]?.hrs ?? 4)
  const [cQty,      setCQty]      = useState(1)

  function itemQty(id: string) { return itemQtys[id] ?? 1 }
  function setItemQty(id: string, q: number) { setItemQtys(prev => ({ ...prev, [id]: Math.max(1, Math.min(99, q)) })) }
  function itemTemplate(id: string): LabelTemplate { return itemTemplates[id] ?? 'IX' }
  function setItemTemplate(id: string, t: LabelTemplate) { setItemTemplates(prev => ({ ...prev, [id]: t })) }

  function addFromQuickItem(item: QuickSingleItem) {
    const tpl = itemTemplate(item.id)
    const qty = itemQty(item.id)
    setEntries(prev => [...prev, { hrs: item.hrs, qty, name: item.name, template: tpl }])
  }

  function addCustomEntry() {
    setEntries(prev => [...prev, { hrs: { IX: cHrs, OX: cHrs, UX: cHrs }, qty: cQty, template: cTemplate }])
    setCQty(1)
  }

  function removeEntry(i: number) { setEntries(prev => prev.filter((_, idx) => idx !== i)) }
  function updateQty(i: number, q: number) {
    setEntries(prev => prev.map((e, idx) => idx === i ? { ...e, qty: Math.max(1, Math.min(99, q)) } : e))
  }

  function handleSave() {
    if (!name.trim() || entries.length === 0) return
    onAdd(name.trim(), entries)
    onClose()
  }

  const totalLabels = entries.reduce((s, e) => s + e.qty, 0)

  return (
    <div className="fixed inset-0 z-[300] bg-[#0d1117] flex flex-col">
      {/* Header */}
      <div className="flex items-center px-4 py-3 border-b border-[#30363d] shrink-0">
        <button onClick={onClose} className="px-3 py-1 text-sm font-bold text-[#6e7681] hover:text-white bg-transparent border border-[#30363d] hover:border-[#6e7681] rounded cursor-pointer transition-colors">← Cancel</button>
        <span className="flex-1 text-center text-white font-bold text-lg">New Bundle</span>
        <button
          onClick={handleSave}
          disabled={!name.trim() || entries.length === 0}
          className="px-4 py-1 text-sm font-bold text-white bg-[#28a745] border-0 rounded cursor-pointer hover:bg-[#2ea043] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >Save</button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="px-4 py-5 flex flex-col gap-5 max-w-lg mx-auto w-full">

          {/* Bundle name */}
          <div>
            <div className={styles.sectionLbl}>Bundle Name</div>
            <input
              autoFocus value={name} onChange={e => setName(e.target.value)}
              placeholder="e.g. Chicken Prep"
              className="w-full bg-[#161b22] border border-[#30363d] rounded-lg px-4 py-3 text-white text-base placeholder:text-[#484f58] outline-none focus:border-[#28a745]"
            />
          </div>

          {/* Current entries */}
          {entries.length > 0 && (
            <div>
              <div className={styles.sectionLbl}>
                Labels in bundle <span className="ml-1 text-[#484f58] normal-case font-normal">({totalLabels} per print)</span>
              </div>
              <div className="flex flex-col gap-2">
                {entries.map((entry, i) => (
                  <div key={i} className="flex items-center gap-3 bg-[#161b22] border border-[#30363d] rounded-lg px-4 py-[10px]">
                    <div className="flex-1 min-w-0">
                      <div className="text-white text-sm font-medium truncate">{entry.name ?? 'Custom'}</div>
                      <div className="text-[#6e7681] text-xs mt-[1px]">
                        {entry.template} · {fmtDuration(entry.hrs[entry.template])}
                      </div>
                    </div>
                    <button onClick={() => updateQty(i, entry.qty - 1)} className={styles.qtyBtn}>−</button>
                    <span className="text-white text-sm font-mono w-6 text-center tabular-nums">{entry.qty}</span>
                    <button onClick={() => updateQty(i, entry.qty + 1)} className={styles.qtyBtn}>+</button>
                    <button onClick={() => removeEntry(i)} className="w-8 h-8 rounded text-[#6e7681] hover:text-[#f85149] cursor-pointer bg-transparent border-0 flex items-center justify-center transition-colors">✕</button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Custom entry */}
          <div>
            <div className={styles.sectionLbl}>Add Custom Entry</div>
            <div className="bg-[#161b22] border border-[#30363d] rounded-lg p-3 flex flex-col gap-2">
              {/* Template + duration row */}
              <div className="flex gap-2">
                <div className="flex flex-col gap-[3px] shrink-0">
                  <span className="text-[#6e7681] text-[9px] text-center font-semibold uppercase tracking-wide">Template</span>
                  <div className="flex gap-1">
                    {TEMPLATES.map(t => (
                      <button
                        key={t}
                        onClick={() => setCTemplate(t)}
                        className={`px-2 py-[5px] rounded text-[10px] font-bold border cursor-pointer transition-colors ${cTemplate === t ? 'bg-[#28a745] border-[#28a745] text-white' : 'bg-transparent border-[#30363d] text-[#6e7681] hover:border-[#6e7681]'}`}
                      >{t}</button>
                    ))}
                  </div>
                </div>
                <div className="flex-1 flex flex-col gap-[3px]">
                  <span className="text-[#6e7681] text-[9px] font-semibold uppercase tracking-wide">Duration</span>
                  <select value={cHrs} onChange={e => setCHrs(Number(e.target.value))} className={styles.selectCls}>
                    {durationOptions.map(o => <option key={o.hrs} value={o.hrs}>{o.label}</option>)}
                  </select>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[#6e7681] text-xs">Qty</span>
                <button onClick={() => setCQty(q => Math.max(1, q - 1))} className={styles.qtyBtn}>−</button>
                <span className="text-white text-sm font-mono w-6 text-center tabular-nums">{cQty}</span>
                <button onClick={() => setCQty(q => Math.min(99, q + 1))} className={styles.qtyBtn}>+</button>
                <button onClick={addCustomEntry} className="ml-auto px-4 py-[6px] rounded bg-[#28a745] border-0 text-white text-xs font-bold cursor-pointer hover:bg-[#2ea043] transition-colors">+ Add</button>
              </div>
            </div>
          </div>

          {/* From quick items */}
          {quickItems.length > 0 && (
            <div>
              <div className={styles.sectionLbl}>Add from Quick Items</div>
              <div className="flex flex-col gap-2">
                {quickItems.map(item => (
                  <div key={item.id} className="flex flex-col gap-2 bg-[#161b22] border border-[#30363d] rounded-lg px-3 py-[10px]">
                    <div className="flex items-center gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="text-white text-sm font-medium truncate">{item.name}</div>
                        <div className="text-[#6e7681] text-xs mt-[1px]">
                          {itemTemplate(item.id)} · {fmtDuration(item.hrs[itemTemplate(item.id)])}
                        </div>
                      </div>
                      <button onClick={() => setItemQty(item.id, itemQty(item.id) - 1)} className={styles.qtyBtn}>−</button>
                      <span className="text-white text-sm font-mono w-6 text-center tabular-nums">{itemQty(item.id)}</span>
                      <button onClick={() => setItemQty(item.id, itemQty(item.id) + 1)} className={styles.qtyBtn}>+</button>
                      <button
                        onClick={() => addFromQuickItem(item)}
                        className="shrink-0 px-3 py-[6px] rounded bg-[#28a745] border-0 text-white text-xs font-bold cursor-pointer hover:bg-[#2ea043] transition-colors"
                      >+ Add</button>
                    </div>
                    {/* Template selector per item */}
                    <div className="flex gap-1">
                      {TEMPLATES.map(t => (
                        <button
                          key={t}
                          onClick={() => setItemTemplate(item.id, t)}
                          className={`flex-1 py-[3px] rounded text-[10px] font-bold border cursor-pointer transition-colors ${itemTemplate(item.id) === t ? 'bg-[#28a745] border-[#28a745] text-white' : 'bg-transparent border-[#30363d] text-[#6e7681] hover:border-[#6e7681]'}`}
                        >{t}</button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
