/**
 * Connect a ZIMRA fiscal device — wizard, one question per screen, Back / Next / Cancel only.
 *  1 Device ID  2 Serial number  3 Activation key  4 Test or Live  5 Confirm taxpayer -> register
 */
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Loader2, CheckCircle2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { bridge } from '@/lib/fdms/bridge'
import { useDevice } from '@/context/DeviceContext'
import { cn } from '@/lib/utils'

const QUESTIONS = [
  { key: 'deviceID',      q: 'What is your Device ID?',       hint: 'The number ZIMRA gave you.', type: 'tel', inputMode: 'numeric' },
  { key: 'serialNo',      q: 'What is the device serial number?', hint: 'Exactly as registered with ZIMRA.', type: 'text' },
  { key: 'activationKey', q: 'Enter your activation key',     hint: '8 characters from ZIMRA.', type: 'text' },
  { key: 'env',           q: 'Which ZIMRA system?',           choices: [{ v: 'test', label: 'Test' }, { v: 'live', label: 'Live' }] },
]

export default function ConnectDevice() {
  const nav = useNavigate()
  const { listed, reload } = useDevice()
  const resume = listed?.state === 'connected'
  const [step, setStep] = useState(resume ? QUESTIONS.length : 0)
  const [v, setV] = useState({ env: 'test' })
  const [taxpayer, setTaxpayer] = useState(resume ? listed.taxpayer : null)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const deviceID = resume ? listed.deviceID : Number(v.deviceID)

  const q = QUESTIONS[step]
  const cancel = () => nav('/dashboard')
  const back = () => { setErr(''); setStep((s) => Math.max(0, s - 1)) }

  const next = async () => {
    setErr('')
    if (q) {
      const val = String(v[q.key] ?? '').trim()
      if (!val) { setErr('Please answer to continue'); return }
      if (q.key === 'deviceID' && !/^\d+$/.test(val)) { setErr('Numbers only'); return }
      if (step < QUESTIONS.length - 1) { setStep(step + 1); return }
      setBusy(true)
      try {
        const r = await bridge.connect({ deviceID: Number(v.deviceID), serialNo: v.serialNo.trim(), activationKey: v.activationKey.trim(), env: v.env })
        setTaxpayer(r.taxpayer); setStep(step + 1)
      } catch (e) { setErr(e.message) } finally { setBusy(false) }
      return
    }
    setBusy(true)
    try {
      await bridge.register(deviceID)
      await reload()
      toast.success('Device connected')
      nav('/dashboard')
    } catch (e) { setErr(e.message) } finally { setBusy(false) }
  }

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center">
      <p className="text-center text-xs font-semibold uppercase tracking-wider text-zim-ink-400">
        {q ? `Step ${step + 1} of ${QUESTIONS.length + 1}` : `Step ${QUESTIONS.length + 1} of ${QUESTIONS.length + 1}`}
      </p>

      {q ? (
        <>
          <h1 className="mt-3 text-center text-2xl font-bold text-zim-ink-900">{q.q}</h1>
          {q.hint && <p className="mt-1 text-center text-sm text-zim-ink-500">{q.hint}</p>}
          {q.choices ? (
            <div className="mt-8 grid grid-cols-2 gap-3">
              {q.choices.map((c) => (
                <button key={c.v} onClick={() => setV({ ...v, env: c.v })}
                  className={cn('rounded-2xl border-2 py-6 text-lg font-bold', v.env === c.v ? 'border-zim-red-600 bg-zim-red-50 text-zim-red-700' : 'border-zim-ink-200 text-zim-ink-700')}>
                  {c.label}
                </button>
              ))}
            </div>
          ) : (
            <input autoFocus className="input mt-8 py-4 text-center text-xl" type={q.type} inputMode={q.inputMode}
              value={v[q.key] ?? ''} onChange={(e) => setV({ ...v, [q.key]: e.target.value })}
              onKeyDown={(e) => e.key === 'Enter' && next()} autoCapitalize="characters" />
          )}
        </>
      ) : (
        <>
          <div className="mt-3 text-center">
            <CheckCircle2 className="mx-auto text-emerald-600" size={36}/>
            <h1 className="mt-3 text-2xl font-bold text-zim-ink-900">Is this your business?</h1>
          </div>
          <div className="card mt-6 p-5 text-center">
            <p className="text-lg font-bold text-zim-ink-900">{taxpayer?.taxPayerName || '—'}</p>
            {taxpayer?.deviceBranchName && <p className="mt-1 text-sm text-zim-ink-600">{taxpayer.deviceBranchName}</p>}
            {taxpayer?.taxPayerTIN && <p className="mt-1 font-mono text-xs text-zim-ink-500">TIN {taxpayer.taxPayerTIN}</p>}
            <p className="mt-2 font-mono text-xs text-zim-ink-500">Device {deviceID}</p>
          </div>
        </>
      )}

      {err && <p className="mt-4 text-center text-sm font-semibold text-rose-600">{err}</p>}

      <div className="mt-8 grid grid-cols-3 gap-3">
        <button onClick={cancel} disabled={busy} className="btn-ghost">Cancel</button>
        <button onClick={back} disabled={busy || step === 0 || (resume && !q)} className="btn-secondary">Back</button>
        <button onClick={next} disabled={busy} className="btn-primary">
          {busy ? <Loader2 size={16} className="animate-spin"/> : q ? 'Next' : 'Yes, connect'}
        </button>
      </div>
    </div>
  )
}
