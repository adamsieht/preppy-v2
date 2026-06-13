import { useState, useEffect } from 'react'
import SettingsCard from '../../../components/settings/SettingsCard'
import Feedback, { type FeedbackMsg } from '../../../components/settings/Feedback'
import { ui } from '../../../components/settings/styles'
import ScaledLabelPreview from '../../../components/ScaledLabelPreview'
import { loadActiveLayout } from '../../Preppy/labelDefs'

const c = {
  axisRow:   'flex items-center gap-2',
  axisLabel: 'text-[#6e7681] text-xs font-semibold w-24 shrink-0',
  adjBtn:    'w-10 h-10 rounded-lg bg-[#21262d] border border-[#30363d] text-[#adbac7] text-sm font-bold cursor-pointer hover:border-[#6e7681] hover:text-white transition-colors shrink-0',
  valInput:  'w-20 text-center bg-[#0d1117] border border-[#30363d] rounded-lg text-white font-mono text-sm px-2 py-[6px] outline-none focus:border-[#28a745]',
  axisNote:  'text-[#484f58] text-[10px]',
  calBtn: (busy: boolean) =>
    `self-start px-5 py-3 rounded-lg border-0 text-white text-sm font-bold cursor-pointer transition-colors ${busy ? 'bg-[#30363d] text-[#6e7681] cursor-not-allowed' : 'bg-[#6e40c9] hover:bg-[#7d4ed3]'}`,
}

export default function CalibrationTab() {
  const [x, setX] = useState(0)
  const [y, setY] = useState(0)
  const [saving, setSaving]           = useState(false)
  const [calibrating, setCalibrating] = useState(false)
  const [saveFb, setSaveFb]           = useState<FeedbackMsg | null>(null)
  const [calFb, setCalFb]             = useState<FeedbackMsg | null>(null)
  const [activeLayout] = useState(loadActiveLayout)

  useEffect(() => {
    window.electronAPI.getConfig().then((cfg: unknown) => {
      const p = (cfg as { printer?: { labelhomeX?: number; labelhomeY?: number } })?.printer
      setX(p?.labelhomeX ?? 0)
      setY(p?.labelhomeY ?? 0)
    }).catch(() => {})
  }, [])

  function clampAdj(setter: (v: number) => void, current: number, delta: number) {
    setter(Math.max(-999, Math.min(999, current + delta)))
  }

  async function handleSave() {
    setSaving(true)
    setSaveFb(null)
    try {
      const result = await window.electronAPI.setLabelHome(x, y)
      setSaveFb(result.success
        ? { ok: true,  msg: 'Saved — offset will apply to all future prints.' }
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

  return (
    <div className="flex flex-col gap-5 max-w-3xl">

      {/* ── Label home offset ── */}
      <SettingsCard
        title="Label Home Offset"
        desc="Shifts all printed content from the printhead origin. Increase X to move content right; increase Y to move content down. Changes take effect after saving."
      >
        <div className={c.axisRow}>
          <span className={c.axisLabel}>X (horizontal)</span>
          <button className={c.adjBtn} onClick={() => clampAdj(setX, x, -10)}>−10</button>
          <button className={c.adjBtn} onClick={() => clampAdj(setX, x,  -1)}>−1</button>
          <input
            type="number" value={x}
            onChange={e => { const v = parseInt(e.target.value, 10); if (!isNaN(v)) setX(Math.max(-999, Math.min(999, v))) }}
            className={c.valInput}
          />
          <button className={c.adjBtn} onClick={() => clampAdj(setX, x,  +1)}>+1</button>
          <button className={c.adjBtn} onClick={() => clampAdj(setX, x, +10)}>+10</button>
          <span className={c.axisNote}>dots</span>
        </div>

        <div className={c.axisRow}>
          <span className={c.axisLabel}>Y (vertical)</span>
          <button className={c.adjBtn} onClick={() => clampAdj(setY, y, -10)}>−10</button>
          <button className={c.adjBtn} onClick={() => clampAdj(setY, y,  -1)}>−1</button>
          <input
            type="number" value={y}
            onChange={e => { const v = parseInt(e.target.value, 10); if (!isNaN(v)) setY(Math.max(-999, Math.min(999, v))) }}
            className={c.valInput}
          />
          <button className={c.adjBtn} onClick={() => clampAdj(setY, y,  +1)}>+1</button>
          <button className={c.adjBtn} onClick={() => clampAdj(setY, y, +10)}>+10</button>
          <span className={c.axisNote}>dots</span>
        </div>

        <div className={ui.actionRow}>
          <button className={ui.secondaryBtn} onClick={() => { setX(0); setY(0); setSaveFb(null) }}>Reset to 0, 0</button>
          <button className={ui.primaryBtn} onClick={() => void handleSave()} disabled={saving}>
            {saving ? 'Saving…' : 'Save Offsets'}
          </button>
        </div>
        <Feedback fb={saveFb} />
      </SettingsCard>

      {/* ── Live preview ── */}
      <SettingsCard
        title="Live Preview"
        desc="The label boundary stays fixed. Adjust offsets above to see how the printed content shifts."
      >
        <div style={{ width: '100%', maxWidth: 420, height: 168 }}>
          <ScaledLabelPreview
            layout={activeLayout}
            values={{ template: 'IX', durationHrs: 8 }}
            offset={{ x, y }}
          />
        </div>
      </SettingsCard>

      {/* ── Media calibration ── */}
      <SettingsCard
        title="Media Calibration"
        desc="Sends a calibration command to the printer to auto-detect label size, gap, and sensor thresholds. The printer will feed several labels during this process — ensure labels are loaded."
      >
        <button className={c.calBtn(calibrating)} onClick={() => void handleCalibrate()} disabled={calibrating}>
          {calibrating ? 'Sending…' : 'Calibrate Media'}
        </button>
        <Feedback fb={calFb} />
      </SettingsCard>

    </div>
  )
}
