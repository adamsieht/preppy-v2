import { useState } from 'react'
import { ui } from './settings/styles'
import type { KioskSetupOptions } from '../../main/services/setup.service'

type Step = 'welcome' | 'options' | 'running' | 'done' | 'failed'

interface Props {
  onFinish: () => void
}

const card = 'bg-[#161b22] border border-[#30363d] rounded-xl'

/**
 * First-run setup wizard (packaged Windows only). Preppy is already installed
 * by the NSIS installer at this point — this wizard only configures the OS for
 * kiosk duty: Windows Update restart policy, always-on power settings, optional
 * auto-login, launch-at-login, and the printer driver. All of it runs through a
 * single elevated PowerShell script (one UAC prompt).
 */
export default function SetupWizard({ onFinish }: Props) {
  const [step, setStep] = useState<Step>('welcome')
  const [updatePolicy, setUpdatePolicy] = useState<'no-reboot' | 'disable'>('no-reboot')
  const [autoStart, setAutoStart] = useState(true)
  const [autoLogin, setAutoLogin] = useState(false)
  const [loginUser, setLoginUser] = useState('')
  const [loginPass, setLoginPass] = useState('')
  const [error, setError] = useState('')
  const [scriptLog, setScriptLog] = useState('')

  async function finish() {
    await window.electronAPI.completeSetup()
    onFinish()
  }

  async function runSetup() {
    if (autoLogin && !loginUser.trim()) {
      setError('Enter a username for automatic login, or turn that option off.')
      return
    }
    setError('')
    setStep('running')
    const opts: KioskSetupOptions = {
      windowsUpdatePolicy: updatePolicy,
      autoLogin,
      autoLoginUser: loginUser.trim(),
      autoLoginPassword: loginPass,
      autoStart,
    }
    const res = await window.electronAPI.runKioskSetup(opts)
    setScriptLog(res.log ?? '')
    if (res.success) {
      setStep('done')
    } else {
      setError(res.error ?? 'Setup failed for an unknown reason.')
      setStep('failed')
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-[#0d1117] flex items-center justify-center p-6 overflow-y-auto">
      <div className="w-full max-w-xl flex flex-col gap-4">

        {/* Header */}
        <div className="flex items-baseline gap-3">
          <div className="text-white text-2xl font-bold">Preppy Setup</div>
          <div className="text-[#6e7681] text-sm">
            {step === 'welcome' && 'Welcome'}
            {step === 'options' && 'Step 1 of 2 — Options'}
            {(step === 'running' || step === 'done' || step === 'failed') && 'Step 2 of 2 — Tablet configuration'}
          </div>
        </div>

        {step === 'welcome' && (
          <div className={`${card} p-6 flex flex-col gap-4`}>
            <div className="text-[#adbac7] text-sm leading-relaxed">
              Preppy is installed. This one-time setup prepares the tablet for kiosk duty:
            </div>
            <ul className="text-[#adbac7] text-sm leading-7 list-disc pl-5">
              <li>Stop Windows from auto-restarting for updates</li>
              <li>Disable sleep, screen timeout, lock screen and screensaver</li>
              <li>Start Preppy automatically at login</li>
              <li>Optional automatic login (no password prompt on boot)</li>
              <li>Install the label printer driver</li>
            </ul>
            <div className={ui.note}>
              You&apos;ll see one Windows administrator prompt. If this is a personal computer rather
              than a dedicated tablet, you can safely skip this — Preppy works without it.
            </div>
            <div className="flex justify-between items-center">
              <button className={ui.secondaryBtn} onClick={finish}>Skip for now</button>
              <button className={ui.primaryBtn} onClick={() => setStep('options')}>Set up this tablet</button>
            </div>
          </div>
        )}

        {step === 'options' && (
          <div className="flex flex-col gap-4">
            <div className={`${card} p-5 flex flex-col gap-3`}>
              <div className="text-white font-bold text-sm">Windows Update</div>
              <label className="flex items-start gap-2 text-[#adbac7] text-sm cursor-pointer">
                <input type="radio" className="mt-1" checked={updatePolicy === 'no-reboot'} onChange={() => setUpdatePolicy('no-reboot')} />
                <span>Allow updates, but never auto-restart <span className="text-[#6e7681]">(recommended)</span></span>
              </label>
              <label className="flex items-start gap-2 text-[#adbac7] text-sm cursor-pointer">
                <input type="radio" className="mt-1" checked={updatePolicy === 'disable'} onChange={() => setUpdatePolicy('disable')} />
                <span>Disable automatic Windows updates entirely</span>
              </label>
            </div>

            <div className={`${card} p-5 flex flex-col gap-3`}>
              <label className="flex items-start gap-2 text-white font-bold text-sm cursor-pointer">
                <input type="checkbox" className="mt-[3px]" checked={autoStart} onChange={e => setAutoStart(e.target.checked)} />
                <span>Start Preppy automatically at login</span>
              </label>
            </div>

            <div className={`${card} p-5 flex flex-col gap-3`}>
              <label className="flex items-start gap-2 text-white font-bold text-sm cursor-pointer">
                <input type="checkbox" className="mt-[3px]" checked={autoLogin} onChange={e => setAutoLogin(e.target.checked)} />
                <span>Log in to Windows automatically <span className="text-[#6e7681] font-normal">(optional)</span></span>
              </label>
              {autoLogin && (
                <div className="flex gap-3">
                  <div className="flex-1">
                    <div className={ui.fieldLabel}>Username</div>
                    <input className={ui.input} value={loginUser} onChange={e => setLoginUser(e.target.value)} />
                  </div>
                  <div className="flex-1">
                    <div className={ui.fieldLabel}>Password</div>
                    <input type="password" className={ui.input} value={loginPass} placeholder="Blank if none set" onChange={e => setLoginPass(e.target.value)} />
                  </div>
                </div>
              )}
            </div>

            {error && <div className="text-[#f85149] text-sm">{error}</div>}

            <div className="flex justify-between items-center">
              <button className={ui.secondaryBtn} onClick={() => setStep('welcome')}>&lt; Back</button>
              <button className={ui.primaryBtn} onClick={runSetup}>Apply Settings</button>
            </div>
          </div>
        )}

        {step === 'running' && (
          <div className={`${card} p-6 flex flex-col gap-4 items-center`}>
            <div className="text-white font-bold">Configuring Windows…</div>
            <div className="w-full bg-[#21262d] rounded-full h-2 overflow-hidden">
              <div className="bg-[#28a745] h-2 rounded-full animate-pulse w-full" />
            </div>
            <div className="text-[#adbac7] text-sm text-center">
              Choose <span className="text-white font-semibold">Yes</span> on the Windows administrator
              prompt if it appears. This takes under a minute.
            </div>
          </div>
        )}

        {(step === 'done' || step === 'failed') && (
          <div className="flex flex-col gap-4">
            <div className={`${card} p-6 flex flex-col gap-3`}>
              {step === 'done' ? (
                <>
                  <div className="text-[#3fb950] font-bold">&#10003; Tablet configured</div>
                  <div className="text-[#adbac7] text-sm leading-relaxed">
                    All settings were applied. Restart Windows when convenient so everything
                    (lock screen, power settings, auto-login) takes effect.
                  </div>
                </>
              ) : (
                <>
                  <div className="text-[#f85149] font-bold">Setup didn&apos;t finish</div>
                  <div className="text-[#adbac7] text-sm leading-relaxed">{error}</div>
                  <div className={ui.note}>
                    You can retry now, or finish and re-run setup later from Settings &rarr; Updates.
                  </div>
                </>
              )}
              {scriptLog && (
                <div className="max-h-40 overflow-y-auto bg-[#0d1117] border border-[#30363d] rounded-lg p-3 text-[11px] text-[#8b949e] whitespace-pre-wrap font-mono">
                  {scriptLog}
                </div>
              )}
            </div>
            <div className="flex justify-between items-center">
              {step === 'failed'
                ? <button className={ui.secondaryBtn} onClick={() => setStep('options')}>&lt; Try again</button>
                : <span />}
              <button className={ui.primaryBtn} onClick={finish}>Finish</button>
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
