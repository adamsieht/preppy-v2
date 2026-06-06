import { useState } from 'react'
import type { QuickSingleItem, TemplateHrs, CategoryDef } from './types'
import { CAT_PALETTE } from './constants'
import { styles } from './AddEditItemPage.styles'

interface AddEditItemPageProps {
  item?:           QuickSingleItem
  categories:      CategoryDef[]
  durationOptions: { label: string; hrs: number }[]
  onSave:          (name: string, category: string, hrs: TemplateHrs) => void
  onAddCategory:   (cat: CategoryDef) => void
  onClose:         () => void
}

export default function AddEditItemPage({ item, categories, durationOptions, onSave, onAddCategory, onClose }: AddEditItemPageProps) {
  const [name,       setName]       = useState(item?.name ?? '')
  const [cat,        setCat]        = useState<string>(item?.category ?? 'item')
  const [hrsIX,      setHrsIX]      = useState(item?.hrs.IX ?? durationOptions[2]?.hrs ?? 4)
  const [hrsOX,      setHrsOX]      = useState(item?.hrs.OX ?? durationOptions[2]?.hrs ?? 4)
  const [hrsUX,      setHrsUX]      = useState(item?.hrs.UX ?? durationOptions[2]?.hrs ?? 4)
  const [newCatName, setNewCatName] = useState('')
  const [newCatColor,setNewCatColor]= useState(CAT_PALETTE[0])
  const [showNewCat, setShowNewCat] = useState(false)

  const isEdit = !!item
  const canSave = name.trim().length > 0

  function handleSave() {
    if (!canSave) return
    onSave(name.trim(), cat, { IX: hrsIX, OX: hrsOX, UX: hrsUX })
    onClose()
  }

  function handleAddCat() {
    if (!newCatName.trim()) return
    const id = newCatName.trim().toLowerCase().replace(/\s+/g, '-') + '-' + Date.now()
    const newCat: CategoryDef = { id, label: newCatName.trim(), color: newCatColor }
    onAddCategory(newCat)
    setCat(id)
    setNewCatName('')
    setShowNewCat(false)
  }

  return (
    <div className="fixed inset-0 z-[300] bg-[#0d1117] flex flex-col">
      {/* Header */}
      <div className="flex items-center px-4 py-3 border-b border-[#30363d] shrink-0">
        <button onClick={onClose} className="px-3 py-1 text-sm font-bold text-[#6e7681] hover:text-white bg-transparent border border-[#30363d] hover:border-[#6e7681] rounded cursor-pointer transition-colors">← Cancel</button>
        <span className="flex-1 text-center text-white font-bold text-lg">{isEdit ? 'Edit Item' : 'New Item'}</span>
        <button
          onClick={handleSave}
          disabled={!canSave}
          className="px-4 py-1 text-sm font-bold text-white bg-[#28a745] border-0 rounded cursor-pointer hover:bg-[#2ea043] disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >Save</button>
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="px-4 py-5 flex flex-col gap-5 max-w-lg mx-auto w-full">

          {/* Name */}
          <div>
            <div className={styles.sectionLbl}>Item Name</div>
            <input
              autoFocus
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter' && canSave) handleSave() }}
              placeholder="e.g. Chicken Wings"
              className="w-full bg-[#161b22] border border-[#30363d] rounded-lg px-4 py-3 text-white text-base placeholder:text-[#484f58] outline-none focus:border-[#28a745]"
            />
          </div>

          {/* Category */}
          <div>
            <div className={styles.sectionLbl}>Category</div>
            <div className="flex gap-2 flex-wrap">
              {categories.map(c => {
                const active = cat === c.id
                return (
                  <button
                    key={c.id}
                    onClick={() => setCat(c.id)}
                    style={{
                      borderColor: c.color,
                      color: active ? '#fff' : c.color,
                      backgroundColor: active ? c.color + '33' : 'transparent',
                    }}
                    className="px-4 py-2 rounded-lg border-2 text-sm font-bold cursor-pointer transition-colors"
                  >{c.label}</button>
                )
              })}
            </div>

            {/* New category form */}
            {!showNewCat ? (
              <button
                onClick={() => setShowNewCat(true)}
                className="mt-3 text-[11px] font-semibold text-[#6e7681] hover:text-[#adbac7] bg-transparent border-0 cursor-pointer transition-colors px-0 underline underline-offset-2"
              >+ Add category</button>
            ) : (
              <div className="mt-3 flex flex-col gap-2 p-3 bg-[#161b22] border border-[#30363d] rounded-lg">
                <input
                  autoFocus
                  value={newCatName}
                  onChange={e => setNewCatName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleAddCat(); if (e.key === 'Escape') setShowNewCat(false) }}
                  placeholder="Category name"
                  className="w-full bg-[#0d1117] border border-[#30363d] rounded px-3 py-2 text-white text-sm placeholder:text-[#484f58] outline-none focus:border-[#28a745]"
                />
                <div className="flex items-center gap-2">
                  <span className="text-[#6e7681] text-xs shrink-0">Color</span>
                  <div className="flex gap-[6px] flex-wrap">
                    {CAT_PALETTE.map(color => (
                      <button
                        key={color}
                        onClick={() => setNewCatColor(color)}
                        style={{
                          backgroundColor: color,
                          outline: newCatColor === color ? '2px solid #fff' : '2px solid transparent',
                          outlineOffset: '2px',
                        }}
                        className="w-5 h-5 rounded-full border-0 cursor-pointer transition-all shrink-0"
                      />
                    ))}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={handleAddCat}
                    disabled={!newCatName.trim()}
                    className="flex-1 py-[6px] text-xs font-bold text-white bg-[#28a745] hover:bg-[#2ea043] border-0 rounded cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                  >Add</button>
                  <button
                    onClick={() => { setShowNewCat(false); setNewCatName('') }}
                    className="px-3 py-[6px] text-xs font-bold text-[#6e7681] hover:text-white bg-transparent border border-[#30363d] hover:border-[#6e7681] rounded cursor-pointer transition-colors"
                  >Cancel</button>
                </div>
              </div>
            )}
          </div>

          {/* Expiry times */}
          <div>
            <div className={styles.sectionLbl}>Expiry Times</div>
            <div className="grid grid-cols-3 gap-3">
              {([['IX', hrsIX, setHrsIX], ['OX', hrsOX, setHrsOX], ['UX', hrsUX, setHrsUX]] as const).map(([lbl, val, set]) => (
                <div key={lbl} className="flex flex-col gap-[6px]">
                  <span className="text-[#adbac7] text-xs text-center font-semibold uppercase tracking-wide">{lbl}</span>
                  <select value={val} onChange={e => set(Number(e.target.value))} className={styles.selectCls}>
                    {durationOptions.map(o => <option key={o.hrs} value={o.hrs}>{o.label}</option>)}
                  </select>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>
    </div>
  )
}
