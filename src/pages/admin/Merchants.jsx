import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export default function AdminMerchants() {
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  useEffect(() => {
    supabase.from('fdms_merchants').select('*').order('created_at', { ascending: false })
      .then(({ data }) => { setRows(data || []); setLoading(false) })
  }, [])
  return (
    <div>
      <h1 className="text-3xl font-bold tracking-tight text-zim-ink-900">Merchants</h1>
      <p className="mt-1 text-sm text-zim-ink-500">Everyone using zimFDMS.</p>
      <div className="mt-8 overflow-hidden rounded-2xl border border-zim-ink-200 bg-white">
        {loading ? (
          <div className="p-8 text-center text-zim-ink-500">Loading…</div>
        ) : rows.length === 0 ? (
          <div className="p-12 text-center text-zim-ink-500">No merchants yet.</div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-zim-ink-200 bg-zim-ink-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zim-ink-500">Name</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zim-ink-500">Phone</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zim-ink-500">Business</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zim-ink-500">Status</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zim-ink-500">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zim-ink-100">
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="px-4 py-3 font-medium">{r.full_name}{r.is_admin && <span className="ml-2 rounded-full bg-zim-red-100 px-2 py-0.5 text-[10px] font-bold text-zim-red-700">ADMIN</span>}</td>
                  <td className="px-4 py-3 font-mono text-xs">{r.phone}</td>
                  <td className="px-4 py-3">{r.business_name || '—'}</td>
                  <td className="px-4 py-3 capitalize">{r.status}</td>
                  <td className="px-4 py-3 text-xs text-zim-ink-500">{new Date(r.created_at).toLocaleDateString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
