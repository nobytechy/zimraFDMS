import { useState } from 'react'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import { Save } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useAuth } from '@/context/AuthContext'
import { supabase } from '@/lib/supabase'

export default function Settings() {
  const { merchant } = useAuth()
  const { register, handleSubmit } = useForm({ defaultValues: merchant || {} })
  const [busy, setBusy] = useState(false)

  if (!merchant) return null

  const onSubmit = async (data) => {
    setBusy(true)
    const { error } = await supabase.from('fdms_merchants').update({
      full_name: data.full_name,
      business_name: data.business_name,
      tin: data.tin,
      vat_number: data.vat_number,
    }).eq('id', merchant.id)
    setBusy(false)
    if (error) { toast.error(error.message); return }
    toast.success('Saved')
  }

  return (
    <div>
      <h1 className="text-3xl font-bold tracking-tight text-zim-ink-900">Settings</h1>
      <p className="mt-1 text-sm text-zim-ink-500">Business details we attach to receipts when ZIMRA needs them.</p>
      <form onSubmit={handleSubmit(onSubmit)} className="mt-8 max-w-2xl space-y-5">
        <div>
          <label className="label">Full name</label>
          <input className="input" {...register('full_name')}/>
        </div>
        <div>
          <label className="label">Business name <span className="text-zim-ink-400">(as registered)</span></label>
          <input className="input" {...register('business_name')}/>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="label">TIN</label>
            <input className="input" {...register('tin')}/>
          </div>
          <div>
            <label className="label">VAT number <span className="text-zim-ink-400">(if VAT registered)</span></label>
            <input className="input" {...register('vat_number')}/>
          </div>
        </div>
        <div className="rounded-xl border border-zim-ink-200 bg-zim-ink-50 p-4 text-xs text-zim-ink-600">
          <strong className="text-zim-ink-900">ZIMRA device:</strong> connect your own device ID and activation key from the <Link to="/dashboard/connect" className="font-semibold text-zim-red-700">Device</Link> page. Keys are created and kept on the server — never in your browser.
        </div>
        <button type="submit" disabled={busy} className="btn-primary">
          {busy ? 'Saving…' : <><Save size={14}/> Save</>}
        </button>
      </form>
    </div>
  )
}
