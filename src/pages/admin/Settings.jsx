/**
 * Super-admin platform settings — where Noby pastes his ZIMRA device ID
 * and activation key when ZIMRA provides them. Until then the platform
 * runs in 'demo' mode against the in-browser mock backend.
 */
import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import { Save, Power, Eye, EyeOff } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'

export default function AdminSettings() {
  const [settings, setSettings] = useState(null)
  const [form, setForm] = useState(null)
  const [busy, setBusy] = useState(false)
  const [showSecrets, setShowSecrets] = useState(false)

  useEffect(() => {
    supabase.from('fdms_platform_settings').select('*').eq('id', 1).maybeSingle()
      .then(({ data, error }) => {
        if (error) { toast.error(error.message); return }
        if (!data) { toast.error('Settings row missing. Run supabase/install.sql.'); return }
        setSettings(data)
        // Mask secrets in the form — only update on user typing
        setForm({ ...data, activation_key: '', private_key_pem: '' })
      })
  }, [])

  if (!form) return <div className="text-zim-ink-500">Loading…</div>

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e?.target?.value ?? e }))

  const onSave = async () => {
    setBusy(true)
    try {
      const payload = {
        mode: form.mode,
        is_enabled: form.is_enabled,
        zimra_base_url: form.zimra_base_url,
        device_id: form.device_id ? Number(form.device_id) : null,
        device_serial_no: form.device_serial_no,
        certificate_pem: form.certificate_pem,
      }
      if (form.activation_key && form.activation_key.length > 0) payload.activation_key = form.activation_key
      if (form.private_key_pem && form.private_key_pem.length > 0) payload.private_key_pem = form.private_key_pem
      const { data, error } = await supabase.from('fdms_platform_settings').update(payload).eq('id', 1).select().single()
      if (error) throw error
      setSettings(data)
      setForm((f) => ({ ...f, activation_key: '', private_key_pem: '' }))
      toast.success('Settings saved')
    } catch (e) {
      toast.error(e.message)
    } finally { setBusy(false) }
  }

  const keyExists = (col) => Boolean(settings?.[col] && String(settings[col]).length > 0)

  return (
    <div>
      <h1 className="text-3xl font-bold tracking-tight text-zim-ink-900">ZIMRA settings</h1>
      <p className="mt-1 text-sm text-zim-ink-500">Paste your ZIMRA device credentials here. The playground + dashboard auto-pick the values.</p>

      <div className="mt-8 max-w-2xl space-y-6">
        {/* Mode + master switch */}
        <div className="rounded-2xl border border-zim-ink-200 bg-white p-6 space-y-4">
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="font-semibold text-zim-ink-900 flex items-center gap-2">
                <Power size={16} className={form.is_enabled ? 'text-emerald-600' : 'text-zim-ink-400'}/>
                Platform is {form.is_enabled ? 'ON' : 'OFF'}
              </p>
              <p className="text-sm text-zim-ink-500 mt-0.5">Flip off to disable all incoming receipt traffic for emergency maintenance.</p>
            </div>
            <button
              type="button"
              onClick={() => set('is_enabled')({ target: { value: !form.is_enabled } })}
              className={cn('relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full transition', form.is_enabled ? 'bg-emerald-500' : 'bg-zim-ink-300')}
            >
              <span className={cn('inline-block h-6 w-6 rounded-full bg-white shadow ring-0 transition transform', form.is_enabled ? 'translate-x-5' : 'translate-x-0.5')}/>
            </button>
          </div>
          <div>
            <label className="label">Mode</label>
            <div className="grid grid-cols-2 gap-3">
              {['demo', 'real'].map((m) => (
                <button key={m} type="button" onClick={() => set('mode')({ target: { value: m } })}
                  className={cn(
                    'rounded-lg border px-4 py-3 text-left transition',
                    form.mode === m ? 'border-zim-red-500 bg-zim-red-50 ring-2 ring-zim-red-500/20' : 'border-zim-ink-200 bg-white hover:border-zim-red-300',
                  )}>
                  <p className="font-bold text-zim-ink-900 capitalize">{m}</p>
                  <p className="text-xs text-zim-ink-500 mt-0.5">{m === 'demo' ? 'In-browser mock FDMS (no network)' : 'Live ZIMRA Fiscal Device Gateway'}</p>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ZIMRA device credentials */}
        <div className="rounded-2xl border border-zim-ink-200 bg-white p-6 space-y-4">
          <h2 className="font-semibold text-zim-ink-900">ZIMRA device credentials</h2>
          <p className="text-sm text-zim-ink-500 -mt-2">From the ZIMRA registration portal. Save these once — the platform uses them for every request to FDMS.</p>

          <div>
            <label className="label">ZIMRA Fiscal Device Gateway URL</label>
            <input className="input" value={form.zimra_base_url || ''} onChange={set('zimra_base_url')} placeholder="https://fdmsapi.zimra.co.zw"/>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="label">Device ID</label>
              <input className="input" type="number" value={form.device_id || ''} onChange={set('device_id')} placeholder="187"/>
            </div>
            <div>
              <label className="label">Device serial number</label>
              <input className="input" value={form.device_serial_no || ''} onChange={set('device_serial_no')} placeholder="SN0001"/>
            </div>
          </div>
          <div>
            <label className="label flex items-center justify-between">
              <span>Activation key</span>
              <span className={cn('text-[10px] uppercase tracking-wider', keyExists('activation_key') ? 'text-emerald-600' : 'text-zim-ink-400')}>
                {keyExists('activation_key') ? '● Set' : 'Not set'}
              </span>
            </label>
            <input className="input" type={showSecrets ? 'text' : 'password'} value={form.activation_key} onChange={set('activation_key')}
              placeholder={keyExists('activation_key') ? '•••••• (type to replace)' : '8-character key'}/>
          </div>
          <div>
            <label className="label flex items-center justify-between">
              <span>Device certificate (X.509 PEM)</span>
              <span className={cn('text-[10px] uppercase tracking-wider', keyExists('certificate_pem') ? 'text-emerald-600' : 'text-zim-ink-400')}>
                {keyExists('certificate_pem') ? '● Set' : 'Not set'}
              </span>
            </label>
            <textarea className="input font-mono text-xs" rows={5} value={form.certificate_pem || ''} onChange={set('certificate_pem')}
              placeholder="-----BEGIN CERTIFICATE-----..."/>
          </div>
          <div>
            <label className="label flex items-center justify-between">
              <span>Device private key (PKCS#8 PEM)</span>
              <span className={cn('text-[10px] uppercase tracking-wider', keyExists('private_key_pem') ? 'text-emerald-600' : 'text-zim-ink-400')}>
                {keyExists('private_key_pem') ? '● Set' : 'Not set'}
              </span>
            </label>
            <textarea className="input font-mono text-xs" rows={4} value={form.private_key_pem} onChange={set('private_key_pem')}
              placeholder={keyExists('private_key_pem') ? '•••••• (type to replace)' : '-----BEGIN PRIVATE KEY-----...'}/>
          </div>
          <button type="button" onClick={() => setShowSecrets((v) => !v)} className="btn-ghost text-xs">
            {showSecrets ? <EyeOff size={12}/> : <Eye size={12}/>} {showSecrets ? 'Hide' : 'Show'} secret fields
          </button>
        </div>

        <div className="flex justify-end">
          <button onClick={onSave} disabled={busy} className="btn-primary py-3 text-base">
            {busy ? 'Saving…' : <><Save size={14}/> Save settings</>}
          </button>
        </div>
      </div>
    </div>
  )
}
