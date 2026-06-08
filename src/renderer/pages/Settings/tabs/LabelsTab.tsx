import { useState, useMemo } from 'react'
import type { LabelLayout, LabelValues } from '../../Preppy/labelTypes'
import { BUILTIN_LAYOUTS, DEFAULT_LAYOUT_ID, getLabelSize } from '../../Preppy/labelDefs'
import { generateZpl } from '../../Preppy/labelZpl'
import { LABEL_LAYOUTS_KEY, LABEL_ACTIVE_KEY } from '../../Preppy/constants'
import LabelPreview from '../../../components/LabelPreview'
import LabelEditor from '../../../components/label-editor/LabelEditor'
import SettingsCard from '../../../components/settings/SettingsCard'
import { ui } from '../../../components/settings/styles'

function loadCustomLayouts(): LabelLayout[] {
  try { return JSON.parse(localStorage.getItem(LABEL_LAYOUTS_KEY) ?? '[]') } catch { return [] }
}
function loadActiveId(): string {
  return localStorage.getItem(LABEL_ACTIVE_KEY) ?? DEFAULT_LAYOUT_ID
}
function saveLayouts(layouts: LabelLayout[]) {
  localStorage.setItem(LABEL_LAYOUTS_KEY, JSON.stringify(layouts))
}
function saveActiveId(id: string) {
  localStorage.setItem(LABEL_ACTIVE_KEY, id)
}

let _nid = Date.now()
function newId() { return `custom-${_nid++}` }

const PREVIEW_VALUES: LabelValues = { template: 'IX', durationHrs: 24, itemName: 'Sample Item' }

export default function LabelsTab() {
  const [customLayouts, setCustomLayouts] = useState<LabelLayout[]>(loadCustomLayouts)
  const [activeId, setActiveId]           = useState<string>(loadActiveId)
  const [editingLayout, setEditingLayout] = useState<LabelLayout | null>(null)
  const [copiedId, setCopiedId]           = useState<string | null>(null)

  const allLayouts = useMemo(() => [...BUILTIN_LAYOUTS, ...customLayouts], [customLayouts])
  const activeLayout = allLayouts.find(l => l.id === activeId) ?? BUILTIN_LAYOUTS[0]
  const size = getLabelSize(activeLayout.sizeKey)

  function selectLayout(id: string) {
    setActiveId(id)
    saveActiveId(id)
  }

  function startNew() {
    setEditingLayout({
      id: newId(), name: 'New Layout', isBuiltin: false,
      sizeKey: '2x1', stockKey: 'blank', elements: [],
    })
  }

  function startCopy(layout: LabelLayout) {
    setEditingLayout({
      ...JSON.parse(JSON.stringify(layout)),
      id: newId(), name: `${layout.name} copy`, isBuiltin: false,
    })
  }

  function handleSave(saved: LabelLayout) {
    const idx = customLayouts.findIndex(l => l.id === saved.id)
    const next = idx >= 0
      ? customLayouts.map(l => l.id === saved.id ? saved : l)
      : [...customLayouts, saved]
    setCustomLayouts(next)
    saveLayouts(next)
    setEditingLayout(null)
  }

  function deleteLayout(id: string) {
    const next = customLayouts.filter(l => l.id !== id)
    setCustomLayouts(next)
    saveLayouts(next)
    if (activeId === id) selectLayout(DEFAULT_LAYOUT_ID)
  }

  function copyZpl(layout: LabelLayout) {
    const zpl = generateZpl(layout, { template: 'IX', durationHrs: 24, itemName: 'Sample' })
    navigator.clipboard.writeText(zpl).then(() => {
      setCopiedId(layout.id)
      setTimeout(() => setCopiedId(null), 1500)
    })
  }

  return (
    <div className="flex flex-col gap-5 pb-4">
      {/* Active layout */}
      <SettingsCard
        title="Active Label Layout"
        desc="All templates (IX / OX / UX) use this layout. Place a Template ID element on the label to show which template is active — it updates automatically when printing."
      >
        <div className="flex gap-4 items-start">
          <div className="flex-1">
            <div className="text-xs text-[#768390] mb-1.5">Layout</div>
            <select
              className={ui.input + ' cursor-pointer'}
              value={activeId}
              onChange={e => selectLayout(e.target.value)}
            >
              <optgroup label="Built-in">
                {BUILTIN_LAYOUTS.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
              </optgroup>
              {customLayouts.length > 0 && (
                <optgroup label="Custom">
                  {customLayouts.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
                </optgroup>
              )}
            </select>
            <div className="text-[11px] text-[#768390] mt-1">
              {size.label} · {activeLayout.stockKey === 'daymark' ? 'Daymark DissolveMark' : 'Blank stock'} · {activeLayout.elements.length} elements
            </div>
          </div>

          {/* Live preview */}
          <div className="flex flex-col items-center gap-1 shrink-0">
            <div className="text-[10px] text-[#768390] mb-0.5 uppercase tracking-wider">Preview</div>
            <LabelPreview layout={activeLayout} values={PREVIEW_VALUES} />
          </div>
        </div>
      </SettingsCard>

      {/* Layout library */}
      <SettingsCard
        title="Label Layouts"
        desc="Built-in layouts cannot be edited, but you can copy them to customize. Add a Template ID element to show IX / OX / UX on your label."
        right={<button className={ui.primaryBtn} onClick={startNew}>+ New Layout</button>}
      >
        <div className="flex flex-col gap-2">
          <div className={ui.sectionLabel}>Built-in</div>
          {BUILTIN_LAYOUTS.map(layout => (
            <LayoutRow
              key={layout.id}
              layout={layout}
              isActive={layout.id === activeId}
              copiedId={copiedId}
              onSelect={() => selectLayout(layout.id)}
              onEdit={null}
              onCopy={() => startCopy(layout)}
              onCopyZpl={() => copyZpl(layout)}
              onDelete={null}
            />
          ))}

          {customLayouts.length > 0 && (
            <>
              <div className={ui.sectionLabel + ' mt-2'}>Custom</div>
              {customLayouts.map(layout => (
                <LayoutRow
                  key={layout.id}
                  layout={layout}
                  isActive={layout.id === activeId}
                  copiedId={copiedId}
                  onSelect={() => selectLayout(layout.id)}
                  onEdit={() => setEditingLayout(JSON.parse(JSON.stringify(layout)))}
                  onCopy={() => startCopy(layout)}
                  onCopyZpl={() => copyZpl(layout)}
                  onDelete={() => deleteLayout(layout.id)}
                />
              ))}
            </>
          )}
        </div>
      </SettingsCard>

      {editingLayout && (
        <LabelEditor
          layout={editingLayout}
          onSave={handleSave}
          onCancel={() => setEditingLayout(null)}
        />
      )}
    </div>
  )
}

// ── Layout row ──────────────────────────────────────────────────────────────
function LayoutRow({
  layout, isActive, copiedId,
  onSelect, onEdit, onCopy, onCopyZpl, onDelete,
}: {
  layout:    LabelLayout
  isActive:  boolean
  copiedId:  string | null
  onSelect:  () => void
  onEdit:    (() => void) | null
  onCopy:    () => void
  onCopyZpl: () => void
  onDelete:  (() => void) | null
}) {
  const size = getLabelSize(layout.sizeKey)
  const previewW = size.dotsW * 0.62
  const scaledW  = previewW * 0.45

  return (
    <div
      className={`flex items-center gap-3 rounded-lg px-3 py-2 border cursor-pointer transition-colors ${
        isActive
          ? 'bg-[#1f3146] border-[#58a6ff]'
          : 'bg-[#0d1117] border-[#30363d] hover:border-[#444c56]'
      }`}
      onClick={onSelect}
    >
      {/* Mini preview */}
      <div style={{ width: scaledW, flexShrink: 0, overflow: 'hidden' }}>
        <div style={{ transform: 'scale(0.45)', transformOrigin: 'left center' }}>
          <LabelPreview layout={layout} values={{ template: 'IX', durationHrs: 24 }} />
        </div>
      </div>

      {/* Name + meta */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-[#e6edf3] truncate">{layout.name}</span>
          {isActive && <span className="text-[10px] bg-[#1f6feb] text-white px-1.5 py-0.5 rounded font-semibold">Active</span>}
        </div>
        <div className="text-xs text-[#768390]">
          {size.label} · {layout.stockKey === 'daymark' ? 'Daymark' : 'Blank'} · {layout.elements.length} elements
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-1.5 shrink-0" onClick={e => e.stopPropagation()}>
        {onEdit && <button className={ui.secondaryBtn} onClick={onEdit}>Edit</button>}
        <button className={ui.neutralBtn} onClick={onCopy}>Copy</button>
        <button className={`${ui.neutralBtn} text-[10px]`} onClick={onCopyZpl} title="Copy ZPL to clipboard">
          {copiedId === layout.id ? '✓ Copied' : 'ZPL'}
        </button>
        {onDelete && <button className={ui.dangerBtn} onClick={onDelete}>Delete</button>}
      </div>
    </div>
  )
}
