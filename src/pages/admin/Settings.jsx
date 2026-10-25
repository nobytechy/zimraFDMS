/**
 * Platform settings (admin). ZIMRA credentials are NOT here any more: every merchant connects their
 * own device (their own deviceID, serial and activation key) from their dashboard, and the server
 * keeps the keys sealed. This page only holds the emergency master switch.
 */
import { useEffect, useState } from 'react'
import toast from 'react-hot-toast'
import { Power } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { cn } from '@/lib/utils'

export default function AdminSettings() {
  const [on, setOn] = useState(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    supabase.from('fdms_platform_settings').select('is_enabled').eq('id', 1).maybeSingle()
      .then(({ data, error }) => {
        if (error) { toast.error(error.message); return }
        if (!data) { toast.error('Settings row missing. Run supabase/install.sql.'); return }
        setOn(data.is_enabled)
      })
  }, [])

  if (on === null) return <div className="text-zim-ink-500">Loading…</div>

  const toggle = async () => {
    setBusy(true)
    const next = !on
    const { error } = await supabase.from('fdms_platform_settings').update({ is_enabled: next }).eq('id', 1)
    setBusy(false)
    if (error) { toast.error(error.message); return }
    setOn(next); toast.success(next ? 'Platform ON' : 'Platform OFF')
  }

  return (
    <div>
      <h1 className="text-3xl font-bold tracking-tight text-zim-ink-900">Platform settings</h1>
      <div className="mt-8 max-w-2xl space-y-6">
        <div className="flex items-center justify-between gap-4 rounded-2xl border border-zim-ink-200 bg-white p-6">
          <div>
            <p className="flex items-center gap-2 font-semibold text-zim-ink-900">
              <Power size={16} className={on ? 'text-emerald-600' : 'text-zim-ink-400'}/> Platform is {on ? 'ON' : 'OFF'}
            </p>
            <p className="mt-0.5 text-sm text-zim-ink-500">Emergency switch for maintenance.</p>
          </div>
          <button type="button" onClick={toggle} disabled={busy}
            className={cn('relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full transition', on ? 'bg-emerald-500' : 'bg-zim-ink-300')}>
            <span className={cn('inline-block h-6 w-6 transform rounded-full bg-white shadow transition', on ? 'translate-x-5' : 'translate-x-0.5')}/>
          </button>
        </div>
        <div className="rounded-xl border border-zim-ink-200 bg-zim-ink-50 p-4 text-xs text-zim-ink-600">
          ZIMRA credentials are per merchant. Each merchant connects their own fiscal device from <strong>Dashboard → Device</strong>.
          Server settings (database, master key, test/live URLs) are environment variables on Netlify — see <code>docs/MERGE_NOTES.md</code>.
        </div>
      </div>
    </div>
  )
}
