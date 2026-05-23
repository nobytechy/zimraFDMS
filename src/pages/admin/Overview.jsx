import { useEffect, useState } from 'react'
import { Users, Receipt, ShieldCheck, Activity } from 'lucide-react'
import { supabase } from '@/lib/supabase'

export default function AdminOverview() {
  const [stats, setStats] = useState({ merchants: 0, receipts: 0, openDays: 0 })
  const [settings, setSettings] = useState(null)

  useEffect(() => {
    (async () => {
      const [m, r, d, s] = await Promise.all([
        supabase.from('fdms_merchants').select('id', { count: 'exact', head: true }),
        supabase.from('fdms_receipts').select('id', { count: 'exact', head: true }),
        supabase.from('fdms_fiscal_days').select('id', { count: 'exact', head: true }).eq('status', 'FiscalDayOpened'),
        supabase.from('fdms_platform_settings').select('*').eq('id', 1).maybeSingle(),
      ])
      setStats({ merchants: m.count || 0, receipts: r.count || 0, openDays: d.count || 0 })
      setSettings(s.data || null)
    })()
  }, [])

  return (
    <div>
      <h1 className="text-3xl font-bold tracking-tight text-zim-ink-900">Platform overview</h1>
      <p className="mt-1 text-sm text-zim-ink-500">Everything happening across zimFDMS, at a glance.</p>

      <div className="mt-8 grid gap-4 md:grid-cols-4">
        <Card icon={Users}      label="Merchants"     value={stats.merchants}/>
        <Card icon={Receipt}    label="Receipts"      value={stats.receipts}/>
        <Card icon={Activity}   label="Open days"     value={stats.openDays}/>
        <Card icon={ShieldCheck} label="ZIMRA mode"   value={settings?.mode || '—'}/>
      </div>

      <div className="mt-10 rounded-2xl border border-zim-ink-200 bg-white p-6">
        <h2 className="text-lg font-bold text-zim-ink-900">Quick-start checklist</h2>
        <ul className="mt-4 space-y-2 text-sm">
          <li className="flex items-center gap-2"><Tick on={!!settings}/> Platform settings row exists in Supabase</li>
          <li className="flex items-center gap-2"><Tick on={settings?.device_id != null}/> ZIMRA device ID provided</li>
          <li className="flex items-center gap-2"><Tick on={!!settings?.activation_key}/> Activation key provided</li>
          <li className="flex items-center gap-2"><Tick on={settings?.mode === 'real'}/> Mode set to "real" (otherwise sandbox)</li>
        </ul>
      </div>
    </div>
  )
}

function Card({ icon: I, label, value }) {
  return (
    <div className="rounded-2xl border border-zim-ink-200 bg-white p-5">
      <div className="flex items-center gap-2 text-zim-ink-500">
        <I size={14}/> <span className="text-xs font-semibold uppercase tracking-wider">{label}</span>
      </div>
      <p className="mt-3 text-3xl font-bold text-zim-ink-900">{value}</p>
    </div>
  )
}
function Tick({ on }) {
  return <span className={`grid size-5 place-items-center rounded-full text-[10px] font-bold ${on ? 'bg-emerald-500 text-white' : 'bg-zim-ink-200 text-zim-ink-500'}`}>{on ? '✓' : '·'}</span>
}
