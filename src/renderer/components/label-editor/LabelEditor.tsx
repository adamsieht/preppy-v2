import { useState, useRef, useCallback, useEffect } from 'react'
import type { LabelLayout, LabelElement, ElementType, LabelValues, LabelSizeKey, LabelStockKey } from '../../pages/Preppy/labelTypes'
import { getLabelSize, LABEL_SIZES, LABEL_STOCKS, DOW_COLORS, DOW_TEXT_COLORS, DOW_ABBR, dayjsDayToMonFirst, DEFAULT_DOW_CONFIG } from '../../pages/Preppy/labelDefs'
import { DATE_FORMATS, TIME_FORMATS, FONT_SIZES, resolvePreviewText, resolvePreviewExpiry } from '../../pages/Preppy/labelZpl'

// Scale factor: canvas dots → pixels
const PX = 0.85

interface Props {
  layout: LabelLayout
  onSave: (layout: LabelLayout) => void
  onCancel: () => void
}

const ELEMENT_TYPES: { type: ElementType; label: string }[] = [
  { type: 'expiry-date',  label: 'Expiry Date'  },
  { type: 'expiry-time',  label: 'Expiry Time'  },
  { type: 'print-date',   label: 'Print Date'   },
  { type: 'print-time',   label: 'Print Time'   },
  { type: 'dow-name',     label: 'Day of Week'  },
  { type: 'template-id',  label: 'Template ID'  },
  { type: 'duration',     label: 'Duration'     },
  { type: 'item-name',    label: 'Item Name'    },
  { type: 'static',       label: 'Static Text'  },
]

const SAMPLE_VALUES: LabelValues = { template: 'IX', durationHrs: 24, itemName: 'Sample Item' }

function isDateType(t: ElementType) { return t === 'expiry-date' || t === 'print-date' }
function isTimeType(t: ElementType) { return t === 'expiry-time' || t === 'print-time' }

let _nextId = Date.now()
function nextId() { return `el-${_nextId++}` }

// ── Canvas label preview with drag handles ──────────────────────────────────
function EditorCanvas({
  layout,
  selected,
  onSelect,
  onMove,
}: {
  layout: LabelLayout
  selected: string | null
  onSelect: (id: string | null) => void
  onMove: (id: string, x: number, y: number) => void
}) {
  const size    = getLabelSize(layout.sizeKey)
  const expiry  = resolvePreviewExpiry(SAMPLE_VALUES.durationHrs)
  const canvasW = size.dotsW * PX
  const canvasH = size.dotsH * PX

  const dragging = useRef<{ id: string; startX: number; startY: number; elX: number; elY: number } | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const expiryIdx = dayjsDayToMonFirst(expiry.day())
  const daysFromMon = expiry.day() === 0 ? 6 : expiry.day() - 1
  const monday = expiry.subtract(daysFromMon, 'day')

  const onMouseDown = useCallback((e: React.MouseEvent, id: string, elX: number, elY: number) => {
    e.stopPropagation()
    onSelect(id)
    dragging.current = { id, startX: e.clientX, startY: e.clientY, elX, elY }
  }, [onSelect])

  useEffect(() => {
    const onMouseMove = (e: MouseEvent) => {
      if (!dragging.current) return
      const dx = e.clientX - dragging.current.startX
      const dy = e.clientY - dragging.current.startY
      const newX = Math.max(0, Math.round(dragging.current.elX + dx / PX))
      const newY = Math.max(0, Math.round(dragging.current.elY + dy / PX))
      onMove(dragging.current.id, newX, newY)
    }
    const onMouseUp = () => { dragging.current = null }
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('mouseup',   onMouseUp)
    return () => {
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('mouseup',   onMouseUp)
    }
  }, [onMove])

  return (
    <div
      ref={containerRef}
      onClick={() => onSelect(null)}
      style={{
        position: 'relative', width: canvasW, height: canvasH,
        background: '#fff', border: '2px solid #555', borderRadius: 4,
        boxShadow: '0 2px 16px rgba(0,0,0,0.25)', overflow: 'hidden',
        cursor: 'default', flexShrink: 0,
      }}
    >
      {/* DOW strip */}
      {layout.stockKey === 'daymark' && layout.dowConfig && (() => {
        const cfg = layout.dowConfig!
        return (
          <div style={{ position: 'absolute', top: cfg.y * PX, left: cfg.x * PX, display: 'flex' }}>
            {DOW_ABBR.map((abbr, i) => {
              const cellW = cfg.cellW * PX
              const cellH = cfg.cellH * PX
              const numFs = cfg.numberFontSize * PX
              const isExpiry = i === expiryIdx
              const dayNum = monday.add(i, 'day').date()
              return (
                <div key={i} style={{ width: cellW, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                  <div style={{
                    width: cellW, height: cellH,
                    background: DOW_COLORS[i], color: DOW_TEXT_COLORS[i],
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: cellH * 0.55, fontWeight: 700, fontFamily: 'monospace',
                    boxSizing: 'border-box',
                    border: isExpiry ? `${Math.max(2, cellW * 0.06)}px solid #000` : 'none',
                  }}>{abbr}</div>
                  <div style={{ fontSize: numFs, fontFamily: 'monospace', color: '#111', lineHeight: 1, marginTop: 1, fontWeight: isExpiry ? 900 : 400 }}>
                    {dayNum}
                  </div>
                </div>
              )
            })}
          </div>
        )
      })()}

      {/* Elements */}
      {layout.elements.map(el => {
        const text = resolvePreviewText(el, SAMPLE_VALUES)
        const isSelected = el.id === selected
        const fs = el.fontSize * PX
        const rotMap: Record<number, string> = { 0: 'none', 90: 'rotate(90deg)', 180: 'rotate(180deg)', 270: 'rotate(270deg)' }
        return (
          <div
            key={el.id}
            onMouseDown={e => onMouseDown(e, el.id, el.x, el.y)}
            style={{
              position: 'absolute',
              left: el.x * PX, top: el.y * PX,
              fontSize: fs, fontFamily: 'monospace', fontWeight: 700,
              color: '#111', lineHeight: 1, whiteSpace: 'nowrap',
              transform: rotMap[el.rotation ?? 0], transformOrigin: 'top left',
              cursor: 'grab',
              outline: isSelected ? '2px solid #58a6ff' : '1px dashed transparent',
              outlineOffset: 2,
              padding: '0 1px',
              userSelect: 'none',
            }}
          >
            {text || <span style={{ color: '#aaa' }}>[{el.type}]</span>}
          </div>
        )
      })}
    </div>
  )
}

// ── Main LabelEditor component ──────────────────────────────────────────────
export default function LabelEditor({ layout: initial, onSave, onCancel }: Props) {
  const [layout, setLayout] = useState<LabelLayout>(() => JSON.parse(JSON.stringify(initial)))
  const [selected, setSelected] = useState<string | null>(null)
  const [nameEdit, setNameEdit] = useState(initial.name)

  const selectedEl = layout.elements.find(e => e.id === selected) ?? null
  const size = getLabelSize(layout.sizeKey)

  // ── Layout-level changes ────────────────────────────────────────────────
  function setSizeKey(sizeKey: LabelSizeKey) {
    setLayout(l => ({ ...l, sizeKey }))
  }
  function setStockKey(stockKey: LabelStockKey) {
    setLayout(l => ({
      ...l, stockKey,
      dowConfig: stockKey === 'daymark' ? (l.dowConfig ?? { ...DEFAULT_DOW_CONFIG }) : undefined,
    }))
  }

  // ── Element mutations ───────────────────────────────────────────────────
  function updateEl(id: string, patch: Partial<LabelElement>) {
    setLayout(l => ({ ...l, elements: l.elements.map(e => e.id === id ? { ...e, ...patch } : e) }))
  }
  const moveEl = useCallback((id: string, x: number, y: number) => {
    setLayout(l => ({ ...l, elements: l.elements.map(e => e.id === id ? { ...e, x, y } : e) }))
  }, [])
  function addElement(type: ElementType) {
    const el: LabelElement = {
      id: nextId(), type, x: 20, y: 20,
      fontSize: 28, fontWidth: 28, rotation: 0,
      ...(type === 'static' ? { text: 'Text' } : {}),
      ...(isDateType(type) ? { dateFormat: 'MM/DD/YY' } : {}),
      ...(isTimeType(type) ? { dateFormat: 'hh:mm A' } : {}),
    }
    setLayout(l => ({ ...l, elements: [...l.elements, el] }))
    setSelected(el.id)
  }
  function deleteSelected() {
    if (!selected) return
    setLayout(l => ({ ...l, elements: l.elements.filter(e => e.id !== selected) }))
    setSelected(null)
  }
  function moveLayer(dir: 'up' | 'down') {
    if (!selected) return
    setLayout(l => {
      const idx = l.elements.findIndex(e => e.id === selected)
      if (idx < 0) return l
      const els = [...l.elements]
      const target = dir === 'up' ? idx + 1 : idx - 1
      if (target < 0 || target >= els.length) return l
      ;[els[idx], els[target]] = [els[target], els[idx]]
      return { ...l, elements: els }
    })
  }

  // ── DowConfig changes ───────────────────────────────────────────────────
  function updateDow(patch: Partial<typeof DEFAULT_DOW_CONFIG>) {
    setLayout(l => ({ ...l, dowConfig: l.dowConfig ? { ...l.dowConfig, ...patch } : { ...DEFAULT_DOW_CONFIG, ...patch } }))
  }

  const ui = {
    root:    'fixed inset-0 z-50 bg-black/70 flex items-center justify-center p-4',
    modal:   'bg-[#0d1117] border border-[#30363d] rounded-xl flex flex-col gap-0 w-full max-w-[1100px] max-h-[95vh] overflow-hidden shadow-2xl',
    header:  'flex items-center gap-3 px-5 py-3 border-b border-[#30363d] shrink-0',
    body:    'flex flex-1 min-h-0 overflow-hidden',
    sidebar: 'w-60 border-r border-[#30363d] flex flex-col gap-0 overflow-y-auto shrink-0',
    canvas:  'flex-1 flex flex-col items-center justify-center bg-[#161b22] p-6 overflow-auto',
    props:   'w-56 border-l border-[#30363d] flex flex-col gap-0 overflow-y-auto shrink-0',
    panel:   'px-4 py-3 border-b border-[#30363d]',
    label:   'text-[10px] font-bold uppercase tracking-wider text-[#768390] mb-1.5',
    input:   'w-full bg-[#21262d] border border-[#30363d] rounded px-2 py-1 text-xs text-[#e6edf3] outline-none focus:border-[#58a6ff]',
    select:  'w-full bg-[#21262d] border border-[#30363d] rounded px-2 py-1 text-xs text-[#e6edf3] outline-none cursor-pointer',
    btn:     'px-3 py-1.5 rounded text-xs font-medium cursor-pointer border-0',
    addBtn:  'w-full text-left px-3 py-1.5 rounded text-xs text-[#e6edf3] bg-transparent border-0 hover:bg-[#21262d] cursor-pointer',
    numInput:'w-full bg-[#21262d] border border-[#30363d] rounded px-2 py-1 text-xs text-[#e6edf3] outline-none focus:border-[#58a6ff]',
  }

  return (
    <div className={ui.root} onClick={e => { if (e.target === e.currentTarget) onCancel() }}>
      <div className={ui.modal}>
        {/* Header */}
        <div className={ui.header}>
          <input
            value={nameEdit}
            onChange={e => setNameEdit(e.target.value)}
            className="flex-1 bg-transparent border-0 text-[#e6edf3] font-bold text-base outline-none"
            placeholder="Layout name…"
          />
          <div className="flex gap-2">
            <button className={`${ui.btn} bg-[#21262d] text-[#adbac7] border border-[#30363d]`} onClick={onCancel}>Cancel</button>
            <button className={`${ui.btn} bg-[#238636] text-white`} onClick={() => onSave({ ...layout, name: nameEdit.trim() || layout.name })}>
              Save Layout
            </button>
          </div>
        </div>

        <div className={ui.body}>
          {/* Left sidebar: layout settings + add elements */}
          <div className={ui.sidebar}>
            {/* Label size / stock */}
            <div className={ui.panel}>
              <div className={ui.label}>Label Size</div>
              <select className={ui.select} value={layout.sizeKey} onChange={e => setSizeKey(e.target.value as LabelSizeKey)}>
                {LABEL_SIZES.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
              </select>
            </div>
            <div className={ui.panel}>
              <div className={ui.label}>Label Stock</div>
              <select className={ui.select} value={layout.stockKey} onChange={e => setStockKey(e.target.value as LabelStockKey)}>
                {LABEL_STOCKS.map(s => <option key={s.key} value={s.key}>{s.label}</option>)}
              </select>
            </div>

            {/* DOW strip config (daymark only) */}
            {layout.stockKey === 'daymark' && layout.dowConfig && (
              <div className={ui.panel}>
                <div className={ui.label}>DOW Strip</div>
                <div className="flex flex-col gap-1.5">
                  {([
                    ['Strip X', 'x'],
                    ['Strip Y', 'y'],
                    ['Cell Width', 'cellW'],
                    ['Cell Height', 'cellH'],
                    ['Numbers Y', 'numberY'],
                    ['Number Size', 'numberFontSize'],
                  ] as [string, keyof typeof DEFAULT_DOW_CONFIG][]).map(([lbl, key]) => (
                    <div key={key}>
                      <div className="text-[10px] text-[#768390] mb-0.5">{lbl}</div>
                      <input
                        type="number" className={ui.numInput}
                        value={layout.dowConfig![key] as number}
                        onChange={e => updateDow({ [key]: Number(e.target.value) })}
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Add elements */}
            <div className={ui.panel}>
              <div className={ui.label}>Add Element</div>
              <div className="flex flex-col gap-0.5">
                {ELEMENT_TYPES.map(({ type, label }) => (
                  <button key={type} className={ui.addBtn} onClick={() => addElement(type)}>
                    + {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Elements list */}
            <div className={ui.panel}>
              <div className={ui.label}>Elements</div>
              <div className="flex flex-col gap-0.5">
                {layout.elements.map(el => (
                  <button
                    key={el.id}
                    className={`w-full text-left px-2 py-1 rounded text-xs border-0 cursor-pointer ${el.id === selected ? 'bg-[#1f3146] text-[#58a6ff]' : 'bg-transparent text-[#adbac7] hover:bg-[#21262d]'}`}
                    onClick={() => setSelected(el.id)}
                  >
                    {ELEMENT_TYPES.find(t => t.type === el.type)?.label ?? el.type}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Canvas */}
          <div className={ui.canvas}>
            <div className="text-[10px] text-[#768390] mb-3 select-none">
              {size.label} · {size.dotsW}×{size.dotsH} dots · Drag elements to reposition
            </div>
            <EditorCanvas
              layout={layout}
              selected={selected}
              onSelect={setSelected}
              onMove={moveEl}
            />
          </div>

          {/* Right props panel */}
          <div className={ui.props}>
            {selectedEl ? (
              <>
                <div className={ui.panel}>
                  <div className={ui.label}>
                    {ELEMENT_TYPES.find(t => t.type === selectedEl.type)?.label}
                  </div>
                  <div className="flex gap-1 mb-2">
                    <button className={`${ui.btn} bg-[#b91c1c] text-white text-[11px] flex-1`} onClick={deleteSelected}>Delete</button>
                    <button className={`${ui.btn} bg-[#21262d] text-[#adbac7] border border-[#30363d] text-[11px]`} title="Move back" onClick={() => moveLayer('down')}>↓</button>
                    <button className={`${ui.btn} bg-[#21262d] text-[#adbac7] border border-[#30363d] text-[11px]`} title="Move forward" onClick={() => moveLayer('up')}>↑</button>
                  </div>
                </div>

                {/* Position */}
                <div className={ui.panel}>
                  <div className={ui.label}>Position (dots)</div>
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <div className="text-[10px] text-[#768390] mb-0.5">X</div>
                      <input type="number" className={ui.numInput} value={selectedEl.x}
                        onChange={e => updateEl(selectedEl.id, { x: Number(e.target.value) })} />
                    </div>
                    <div className="flex-1">
                      <div className="text-[10px] text-[#768390] mb-0.5">Y</div>
                      <input type="number" className={ui.numInput} value={selectedEl.y}
                        onChange={e => updateEl(selectedEl.id, { y: Number(e.target.value) })} />
                    </div>
                  </div>
                </div>

                {/* Font */}
                <div className={ui.panel}>
                  <div className={ui.label}>Font Size</div>
                  <select className={ui.select} value={selectedEl.fontSize}
                    onChange={e => updateEl(selectedEl.id, { fontSize: Number(e.target.value), fontWidth: Number(e.target.value) })}>
                    {FONT_SIZES.map(s => <option key={s} value={s}>{s}pt</option>)}
                  </select>
                  <div className="mt-2">
                    <div className={ui.label}>Font Width</div>
                    <select className={ui.select} value={selectedEl.fontWidth ?? selectedEl.fontSize}
                      onChange={e => updateEl(selectedEl.id, { fontWidth: Number(e.target.value) })}>
                      {FONT_SIZES.map(s => <option key={s} value={s}>{s}pt</option>)}
                    </select>
                  </div>
                </div>

                {/* Rotation */}
                <div className={ui.panel}>
                  <div className={ui.label}>Rotation</div>
                  <select className={ui.select} value={selectedEl.rotation}
                    onChange={e => updateEl(selectedEl.id, { rotation: Number(e.target.value) as 0|90|180|270 })}>
                    <option value={0}>0°</option>
                    <option value={90}>90°</option>
                    <option value={180}>180°</option>
                    <option value={270}>270°</option>
                  </select>
                </div>

                {/* Date format (date elements) */}
                {isDateType(selectedEl.type) && (
                  <div className={ui.panel}>
                    <div className={ui.label}>Date Format</div>
                    <select className={ui.select} value={selectedEl.dateFormat ?? 'MM/DD/YY'}
                      onChange={e => updateEl(selectedEl.id, { dateFormat: e.target.value })}>
                      {DATE_FORMATS.map(f => <option key={f.key} value={f.key}>{f.label}</option>)}
                    </select>
                  </div>
                )}

                {/* Time format (time elements) */}
                {isTimeType(selectedEl.type) && (
                  <div className={ui.panel}>
                    <div className={ui.label}>Time Format</div>
                    <select className={ui.select} value={selectedEl.dateFormat ?? 'hh:mm A'}
                      onChange={e => updateEl(selectedEl.id, { dateFormat: e.target.value })}>
                      {TIME_FORMATS.map(f => <option key={f.key} value={f.key}>{f.label}</option>)}
                    </select>
                  </div>
                )}

                {/* Static text */}
                {selectedEl.type === 'static' && (
                  <div className={ui.panel}>
                    <div className={ui.label}>Text</div>
                    <input className={ui.input} value={selectedEl.text ?? ''}
                      onChange={e => updateEl(selectedEl.id, { text: e.target.value })} />
                  </div>
                )}

                {/* Bold */}
                <div className={ui.panel}>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={selectedEl.bold ?? false}
                      onChange={e => updateEl(selectedEl.id, { bold: e.target.checked })} />
                    <span className="text-xs text-[#adbac7]">Bold</span>
                  </label>
                </div>
              </>
            ) : (
              <div className="flex items-center justify-center h-full text-[#4d5566] text-xs text-center px-4">
                Click an element on the canvas to edit its properties
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
