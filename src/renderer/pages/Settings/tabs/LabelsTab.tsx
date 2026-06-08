import { useState, useMemo } from 'react'
import type { LabelLayout, LabelValues } from '../../Preppy/labelTypes'
import { BUILTIN_LAYOUTS, DEFAULT_ASSIGNMENTS, getLabelSize } from '../../Preppy/labelDefs'
import { generateZpl } from '../../Preppy/labelZpl'
import { LABEL_LAYOUTS_KEY, LABEL_ASSIGNMENTS_KEY } from '../../Preppy/constants'
import LabelPreview from '../../../components/LabelPreview'
import LabelEditor from '../../../components/label-editor/LabelEditor'
import SettingsCard from '../../../components/settings/SettingsCard'
import { ui } from '../../../components/settings/styles'

type TemplateName = 'IX' | 'OX' | 'UX'
const TEMPLATES: TemplateName[] = ['IX', 'OX', 'UX']
const TEMPLATE_LABELS: Record<TemplateName, string> = { IX: 'Internal (IX)', OX: 'Opened (OX)', UX: 'Use First (UX)' }

function loadCustomLayouts(): LabelLayout[] {
  try { return JSON.parse(localStorage.getItem(LABEL_LAYOUTS_KEY) ?? '[]') } catch { return [] }
}
function loadAssignments(): Record<TemplateName, string> {
  try { return { ...DEFAULT_ASSIGNMENTS, ...JSON.parse(localStorage.getItem(LABEL_ASSIGNMENTS_KEY) ?? '{}') } } catch { return { ...DEFAULT_ASSIGNMENTS } }
}
function saveLayouts(layouts: LabelLayout[]) {
  localStorage.setItem(LABEL_LAYOUTS_KEY, JSON.stringify(layouts))
}
function saveAssignments(a: Record<TemplateName, string>) {
  localStorage.setItem(LABEL_ASSIGNMENTS_KEY, JSON.stringify(a))
}

let _nid = Date.now()
function newId() { return `custom-${_nid++}` }

const SAMPLE_VALUES: LabelValues = { template: 'IX', durationHrs: 24, itemName: 'Sample Item' }

export default function LabelsTab() {
  const [customLayouts, setCustomLayouts]   = useState<LabelLayout[]>(loadCustomLayouts)
  const [assignments, setAssignments]       = useState<Record<TemplateName, string>>(loadAssignments)
  const [editingLayout, setEditingLayout]   = useState<LabelLayout | null>(null)
  const [activeTemplate, setActiveTemplate] = useState<TemplateName>('IX')
  const [copiedId, setCopiedId]             = useState<string | null>(null)

  const allLayouts = useMemo(() => [...BUILTIN_LAYOUTS, ...customLayouts], [customLayouts])
  const assignedId = assignments[activeTemplate]
  const assignedLayout = allLayouts.find(l => l.id === assignedId) ?? BUILTIN_LAYOUTS[0]
  const previewValues: LabelValues = { ...SAMPLE_VALUES, template: activeTemplate }

  function assign(tpl: TemplateName, layoutId: string) {
    const next = { ...assignments, [tpl]: layoutId }
    setAssignments(next)
    saveAssignments(next)
  }

  function startNew() {
    const base: LabelLayout = {
      id: newId(), name: 'New Layout', isBuiltin: false,
      sizeKey: '2x1', stockKey: 'blank', elements: [],
    }
    setEditingLayout(base)
  }

  function startCopy(layout: LabelLayout) {
    setEditingLayout({ ...JSON.parse(JSON.stringify(layout)), id: newId(), name: `${layout.name} copy`, isBuiltin: false })
  }

  function handleSave(saved: LabelLayout) {
    const existing = customLayouts.findIndex(l => l.id === saved.id)
    let next: LabelLayout[]
    if (existing >= 0) {
      next = customLayouts.map(l => l.id === saved.id ? saved : l)
    } else {
      next = [...customLayouts, saved]
    }
    setCustomLayouts(next)
    saveLayouts(next)
    setEditingLayout(null)
  }

  function deleteLayout(id: string) {
    const next = customLayouts.filter(l => l.id !== id)
    setCustomLayouts(next)
    saveLayouts(next)
    // Re-assign any template pointing at this id
    const updated = { ...assignments }
    let changed = false
    for (const tpl of TEMPLATES) {
      if (updated[tpl] === id) { updated[tpl] = BUILTIN_LAYOUTS[0].id; changed = true }
    }
    if (changed) { setAssignments(updated); saveAssignments(updated) }
  }

  function copyZpl(layout: LabelLayout, tpl: TemplateName) {
    const zpl = generateZpl(layout, { template: tpl, durationHrs: 24, itemName: 'Sample' })
    navigator.clipboard.writeText(zpl).then(() => {
      setCopiedId(layout.id)
      setTimeout(() => setCopiedId(null), 1500)
    })
  }

  const size = getLabelSize(assignedLayout.sizeKey)

  return (
    <div className="flex flex-col gap-5 pb-4">
      {/* Template assignments */}
      <SettingsCard title="Template Label Assignments" desc="Choose which label layout is used when printing each template type.">
        <div className="flex flex-col gap-3">
          {/* Template tabs */}
          <div className="flex gap-1">
            {TEMPLATES.map(tpl => (
              <button
                key={tpl}
                onClick={() => setActiveTemplate(tpl)}
                className={`px-4 py-1.5 rounded text-sm font-semibold border-0 cursor-pointer transition-colors ${
                  activeTemplate === tpl ? 'bg-[#238636] text-white' : 'bg-[#21262d] text-[#adbac7] hover:bg-[#2d333b]'
                }`}
              >
                {tpl}
              </button>
            ))}
          </div>

          <div className="text-xs text-[#768390]">{TEMPLATE_LABELS[activeTemplate]}</div>

          {/* Layout picker */}
          <div className="flex gap-4 items-start">
            <div className="flex-1">
              <div className="text-xs text-[#768390] mb-1.5">Assigned Layout</div>
              <select
                className={ui.input + ' cursor-pointer'}
                value={assignedId}
                onChange={e => assign(activeTemplate, e.target.value)}
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
                {size.label} · {assignedLayout.stockKey === 'daymark' ? 'Daymark DissolveMark' : 'Blank stock'}
              </div>
            </div>

            {/* Live preview */}
            <div className="flex flex-col items-center gap-1 shrink-0">
              <div className="text-[10px] text-[#768390] mb-0.5 uppercase tracking-wider">Preview</div>
              <LabelPreview layout={assignedLayout} values={previewValues} />
            </div>
          </div>
        </div>
      </SettingsCard>

      {/* Layout library */}
      <SettingsCard
        title="Label Layouts"
        desc="Built-in layouts cannot be edited, but you can copy them to customize."
        right={
          <button className={ui.primaryBtn} onClick={startNew}>+ New Layout</button>
        }
      >
        <div className="flex flex-col gap-2">
          {/* Built-in layouts */}
          <div className={ui.sectionLabel}>Built-in</div>
          {BUILTIN_LAYOUTS.map(layout => (
            <LayoutRow
              key={layout.id}
              layout={layout}
              activeTemplate={activeTemplate}
              copiedId={copiedId}
              onEdit={null}
              onCopy={() => startCopy(layout)}
              onCopyZpl={() => copyZpl(layout, activeTemplate)}
              onDelete={null}
            />
          ))}

          {/* Custom layouts */}
          {customLayouts.length > 0 && (
            <>
              <div className={ui.sectionLabel + ' mt-2'}>Custom</div>
              {customLayouts.map(layout => (
                <LayoutRow
                  key={layout.id}
                  layout={layout}
                  activeTemplate={activeTemplate}
                  copiedId={copiedId}
                  onEdit={() => setEditingLayout(JSON.parse(JSON.stringify(layout)))}
                  onCopy={() => startCopy(layout)}
                  onCopyZpl={() => copyZpl(layout, activeTemplate)}
                  onDelete={() => deleteLayout(layout.id)}
                />
              ))}
            </>
          )}
        </div>
      </SettingsCard>

      {/* Editor modal */}
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
  layout, activeTemplate, copiedId,
  onEdit, onCopy, onCopyZpl, onDelete,
}: {
  layout: LabelLayout
  activeTemplate: TemplateName
  copiedId: string | null
  onEdit:    (() => void) | null
  onCopy:    () => void
  onCopyZpl: () => void
  onDelete:  (() => void) | null
}) {
  const size = getLabelSize(layout.sizeKey)
  const previewValues: LabelValues = { template: activeTemplate, durationHrs: 24, itemName: 'Sample' }

  return (
    <div className="flex items-center gap-3 bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2">
      {/* Mini preview */}
      <div style={{ transform: 'scale(0.45)', transformOrigin: 'left center', flexShrink: 0, marginRight: -size.dotsW * 0.62 * 0.55 }}>
        <LabelPreview layout={layout} values={previewValues} />
      </div>

      {/* Name + meta */}
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-[#e6edf3] truncate">{layout.name}</div>
        <div className="text-xs text-[#768390]">
          {size.label} · {layout.stockKey === 'daymark' ? 'Daymark' : 'Blank'} · {layout.elements.length} elements
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-1.5 shrink-0">
        {onEdit && (
          <button className={ui.secondaryBtn} onClick={onEdit}>Edit</button>
        )}
        <button className={ui.neutralBtn} onClick={onCopy}>Copy</button>
        <button
          className={`${ui.neutralBtn} text-[10px]`}
          onClick={onCopyZpl}
          title="Copy ZPL to clipboard"
        >
          {copiedId === layout.id ? '✓ Copied' : 'ZPL'}
        </button>
        {onDelete && (
          <button className={ui.dangerBtn} onClick={onDelete}>Delete</button>
        )}
      </div>
    </div>
  )
}
