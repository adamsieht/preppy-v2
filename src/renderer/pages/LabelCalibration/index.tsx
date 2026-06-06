import { useState, useEffect } from 'react'
import PageLayout from '../../components/PageLayout'
import LabelPreview from '../../components/LabelPreview'

type LabelTemplate = 'IX' | 'OX' | 'UX'
const TEMPLATES: LabelTemplate[] = ['IX', 'OX', 'UX']

// ── Tailwind class map ──────────────────────────────────────────────────────
const c = {
  section:     'mb-5',
  sectionCard: 'bg-[#161b22] border border-[#30363d] rounded-xl p-4',
  sectionTitle:'text-[#adbac7] text-sm font-bold mb-[3px]',
  sectionDesc: 'text-[#6e7681] text-xs mb-4 leading-relaxed',

  // Offset controls
  axisRow:    'flex items-center gap-2 mb-3',
  axisLabel:  'text-[#6e7681] text-xs font-semibold w-24 shrink-0',
  adjBtn:     'w-10 h-10 rounded-lg bg-[#21262d] border border-[#30363d] text-[#adbac7] text-sm font-bold cursor-pointer hover:border-[#6e7681] hover:text-white transition-colors shrink-0',
  valInput:   'w-20 text-center bg-[#0d1117] border border-[#30363d] rounded-lg text-white font-mono text-sm px-2 py-[6px] outline-none focus:border-[#28a745]',
  axisNote:   'text-[#484f58] text-[10px]',

  // Action buttons
  actionRow:  'flex gap-2 mt-4',
  resetBtn:   'px-4 py-2 rounded-lg bg-transparent border border-[#30363d] text-[#adbac7] text-sm font-bold cursor-pointer hover:border-[#6e7681] hover:text-white transition-colors',
  saveBtn:    'px-5 py-2 rounded-lg bg-[#28a745] border-0 text-white text-sm font-bold cursor-pointer hover:bg-[#2ea043] transition-colors disabled:opacity-50 disabled:cursor-not-allowed',

  feedbackOk:  'flex items-center gap-1 text-xs text-[#3fb950] mt-2',
  feedbackErr: 'flex items-center gap-1 text-xs text-[#f85149] mt-2',

  // Template selector
  tmplBar:    'flex gap-2 mb-4',
  tmplBtn:    (active: boolean) => active
    ? 'px-4 py-[6px] rounded-lg bg-[#28a745] border-0 text-white text-sm font-bold cursor-pointer'
    : 'px-4 py-[6px] rounded-lg bg-transparent border border-[#30363d] text-[#adbac7] text-sm font-bold cursor-pointer hover:border-[#6e7681] hover:text-white transition-colors',

  // ZPL viewer
  zplBox:     'bg-[#0d1117] rounded-lg p-3 font-mono text-[0.73rem] leading-[1.7] overflow-x-auto overflow-y-auto max-h-52',
  zplCmd:     'text-[#58a6ff] font-bold',
  zplLhCmd:   'text-[#3fb950] font-bold',
  zplLhLine:  'bg-[#28a745]/10 rounded px-1 -mx-1 block',

  // Calibrate button
  calBtn: (busy: boolean) =>
    `px-5 py-3 rounded-lg border-0 text-white text-sm font-bold cursor-pointer transition-colors ${
      busy ? 'bg-[#30363d] text-[#6e7681] cursor-not-allowed' : 'bg-[#6e40c9] hover:bg-[#7d4ed3]'
    }`,
  calNote: 'text-[#6e7681] text-[11px] mt-2 leading-relaxed',
}
// ───────────────────────────────────────────────────────────────────────────

function ZplViewer({ zpl }: { zpl: string }) {
  return (
    <div className={c.zplBox}>
      {zpl.split('\n').filter(line => line.trim()).map((line, i) => {
        const isLh = /^\^LH/.test(line.trim())
        const parts = line.split(/(\^[A-Z0-9]+|~[A-Z0-9]+)/)
        return (
          <span key={i} className={isLh ? c.zplLhLine : 'block'}>
            {parts.map((p, j) =>
              /^\^[A-Z0-9]+|^~[A-Z0-9]+/.test(p)
                ? <span key={j} className={isLh ? c.zplLhCmd : c.zplCmd}>{p}</span>
                : <span key={j} className="text-[#d4d4d4]">{p}</span>
            )}
          </span>
        )
      })}
    </div>
  )
}

export default function LabelCalibration() {
  const [x, setX] = useState(0)
  const [y, setY] = useState(0)
  const [template, setTemplate]     = useState<LabelTemplate>('IX')
  const [baseZpl, setBaseZpl]       = useState('')
  const [zplLoading, setZplLoading] = useState(false)
  const [saving, setSaving]         = useState(false)
  const [calibrating, setCalibrating] = useState(false)
  const [saveFb, setSaveFb]         = useState<{ ok: boolean; msg: string } | null>(null)
  const [calFb, setCalFb]           = useState<{ ok: boolean; msg: string } | null>(null)

  // Load saved values from config on mount
  useEffect(() => {
    window.electronAPI.getConfig().then((cfg: unknown) => {
      const p = (cfg as { printer?: { labelhomeX?: number; labelhomeY?: number } })?.printer
      setX(p?.labelhomeX ?? 0)
      setY(p?.labelhomeY ?? 0)
    }).catch(() => {})
  }, [])

  // Fetch base ZPL whenever template changes (backend fills date/time vars)
  useEffect(() => {
    setZplLoading(true)
    window.electronAPI.previewPrint({ template, durationHrs: 8 })
      .then(r => { if (r.success && r.zpl) setBaseZpl(r.zpl) })
      .catch(() => {})
      .finally(() => setZplLoading(false))
  }, [template])

  // Derive the displayed ZPL by replacing the backend-injected ^LH with live values
  const displayZpl = baseZpl
    ? baseZpl.includes('^LH')
      ? baseZpl.replace(/\^LH-?\d+,-?\d+/, `^LH${x},${y}`)
      : baseZpl.replace(/(\^XA\r?\n?)/, `$1^LH${x},${y}\n`)
    : ''

  function clampAdj(setter: (v: number) => void, current: number, delta: number) {
    setter(Math.max(-999, Math.min(999, current + delta)))
  }

  async function handleSave() {
    setSaving(true)
    setSaveFb(null)
    try {
      const result = await window.electronAPI.setLabelHome(x, y)
      setSaveFb(result.success
        ? { ok: true,  msg: `Saved — ^LH${x},${y} will apply to all future prints.` }
        : { ok: false, msg: result.error ?? 'Save failed.' })
    } catch (err) {
      setSaveFb({ ok: false, msg: String(err) })
    } finally {
      setSaving(false)
    }
  }

  async function handleCalibrate() {
    setCalibrating(true)
    setCalFb(null)
    try {
      const result = await window.electronAPI.sendRawZpl('~JC')
      setCalFb(result.success
        ? { ok: true,  msg: 'Calibration command sent. The printer will feed labels to detect the gap.' }
        : { ok: false, msg: result.error ?? 'Failed to send calibration command.' })
    } catch (err) {
      setCalFb({ ok: false, msg: String(err) })
    } finally {
      setCalibrating(false)
    }
  }

  // Scale and offset for the visual preview container
  // Container represents the label paper; content shifts to visualise ^LH
  const SCALE = 0.38           // LabelPreview rendered at 38% for container fit
  const DOT_PX = 0.5           // 1 ZPL dot ≈ 0.5 container px (visual approximation)
  const MARGIN = 10            // default gap from container edge in px

  return (
    <PageLayout title="Label Calibration" back="/debug">

      {/* ── Label home offset ── */}
      <div className={c.section}>
        <div className={c.sectionCard}>
          <div className={c.sectionTitle}>Label Home Offset (^LH)</div>
          <div className={c.sectionDesc}>
            Shifts all printed content from the printhead origin.
            Increase X to move content right; increase Y to move content down.
            Changes take effect after saving.
          </div>

          {/* X axis */}
          <div className={c.axisRow}>
            <span className={c.axisLabel}>X (horizontal)</span>
            <button className={c.adjBtn} onClick={() => clampAdj(setX, x, -10)}>−10</button>
            <button className={c.adjBtn} onClick={() => clampAdj(setX, x,  -1)}>−1</button>
            <input
              type="number"
              value={x}
              onChange={e => { const v = parseInt(e.target.value, 10); if (!isNaN(v)) setX(Math.max(-999, Math.min(999, v))) }}
              className={c.valInput}
            />
            <button className={c.adjBtn} onClick={() => clampAdj(setX, x,  +1)}>+1</button>
            <button className={c.adjBtn} onClick={() => clampAdj(setX, x, +10)}>+10</button>
            <span className={c.axisNote}>dots</span>
          </div>

          {/* Y axis */}
          <div className={c.axisRow}>
            <span className={c.axisLabel}>Y (vertical)</span>
            <button className={c.adjBtn} onClick={() => clampAdj(setY, y, -10)}>−10</button>
            <button className={c.adjBtn} onClick={() => clampAdj(setY, y,  -1)}>−1</button>
            <input
              type="number"
              value={y}
              onChange={e => { const v = parseInt(e.target.value, 10); if (!isNaN(v)) setY(Math.max(-999, Math.min(999, v))) }}
              className={c.valInput}
            />
            <button className={c.adjBtn} onClick={() => clampAdj(setY, y,  +1)}>+1</button>
            <button className={c.adjBtn} onClick={() => clampAdj(setY, y, +10)}>+10</button>
            <span className={c.axisNote}>dots</span>
          </div>

          <div className={c.actionRow}>
            <button className={c.resetBtn} onClick={() => { setX(0); setY(0); setSaveFb(null) }}>
              Reset to 0, 0
            </button>
            <button className={c.saveBtn} onClick={() => void handleSave()} disabled={saving}>
              {saving ? 'Saving…' : 'Save Offsets'}
            </button>
          </div>

          {saveFb && (
            <div className={saveFb.ok ? c.feedbackOk : c.feedbackErr}>
              <span>{saveFb.ok ? '✓' : '✗'}</span><span>{saveFb.msg}</span>
            </div>
          )}
        </div>
      </div>

      {/* ── Live preview ── */}
      <div className={c.section}>
        <div className={c.sectionCard}>
          <div className={c.sectionTitle}>Live Preview</div>

          <div className={c.tmplBar}>
            {TEMPLATES.map(t => (
              <button key={t} className={c.tmplBtn(template === t)} onClick={() => setTemplate(t)}>{t}</button>
            ))}
            <span className="ml-auto text-[#484f58] text-xs self-center font-mono">^LH{x},{y}</span>
          </div>

          <div className="flex gap-4 items-start flex-wrap">

            {/* Visual offset preview */}
            <div className="shrink-0">
              <div className="text-[#6e7681] text-[11px] mb-2">Label paper boundary (clipped)</div>
              <div
                className="relative overflow-hidden rounded-lg"
                style={{ width: 355, height: 128, background: '#0a0d12', border: '2px dashed #30363d' }}
              >
                {/* Subtle dot grid representing label area */}
                <div
                  className="absolute inset-0 opacity-[0.07]"
                  style={{
                    backgroundImage: 'radial-gradient(circle, #adbac7 1px, transparent 1px)',
                    backgroundSize: '16px 16px',
                  }}
                />
                {/* Shifted content */}
                <div
                  style={{
                    position: 'absolute',
                    top:  MARGIN + y * DOT_PX,
                    left: MARGIN + x * DOT_PX,
                    transform: `scale(${SCALE})`,
                    transformOrigin: 'top left',
                    pointerEvents: 'none',
                  }}
                >
                  <LabelPreview template={template} durationHrs={8} />
                </div>
              </div>
              <div className="text-[#484f58] text-[10px] mt-1 text-center">
                1 dot ≈ 0.125 mm @ 203 dpi
              </div>
            </div>

            {/* ZPL code viewer */}
            <div className="flex-1 min-w-0">
              <div className="text-[#6e7681] text-[11px] mb-2">
                ZPL output — <span className="text-[#3fb950]">^LH</span> updates live
              </div>
              {zplLoading
                ? <div className="text-[#6e7681] text-xs py-4">Loading…</div>
                : <ZplViewer zpl={displayZpl} />
              }
            </div>

          </div>
        </div>
      </div>

      {/* ── Media calibration ── */}
      <div className={c.section}>
        <div className={c.sectionCard}>
          <div className={c.sectionTitle}>Media Calibration</div>
          <div className={c.sectionDesc}>
            Sends <span className="font-mono text-[#adbac7]">~JC</span> to the printer to
            auto-detect label size, gap, and sensor thresholds. The printer will feed several
            labels during this process — ensure labels are loaded.
          </div>

          <button
            className={c.calBtn(calibrating)}
            onClick={() => void handleCalibrate()}
            disabled={calibrating}
          >
            {calibrating ? 'Sending…' : 'Calibrate Media'}
          </button>

          {calFb && (
            <div className={calFb.ok ? c.feedbackOk : c.feedbackErr}>
              <span>{calFb.ok ? '✓' : '✗'}</span><span>{calFb.msg}</span>
            </div>
          )}
        </div>
      </div>

    </PageLayout>
  )
}
