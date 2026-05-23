import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Search, Receipt as ReceiptIcon, ExternalLink, Plus } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { listReceipts, getOpenFiscalDay } from '@/lib/fdms/merchantService'
import SubmitReceiptModal from '@/components/dashboard/SubmitReceiptModal'

export default function Receipts() {
  const { merchant } = useAuth()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('')
  const [day, setDay] = useState(null)
  const [modalOpen, setModalOpen] = useState(false)

  const load = async () => {
    if (!merchant) return
    setLoading(true)
    const [{ data }, d] = await Promise.all([
      listReceipts(merchant.id, { search: q, status }),
      getOpenFiscalDay(merchant.id),
    ])
    setRows(data)
    setDay(d)
    setLoading(false)
  }
  useEffect(() => { load() /* eslint-disable-next-line */ }, [merchant?.id, q, status])

  if (!merchant) return null

  return (
    <div>
      <SubmitReceiptModal open={modalOpen} onClose={() => setModalOpen(false)} merchantId={merchant.id} fiscalDay={day} onDone={() => load()} />

      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-zim-ink-900">Receipts</h1>
          <p className="mt-1 text-sm text-zim-ink-500">Everything you've fiscalised, with its FDMS status and ZIMRA signature.</p>
        </div>
        {day && (
          <button onClick={() => setModalOpen(true)} className="btn-primary"><Plus size={14}/> Submit test receipt</button>
        )}
      </header>

      <div className="mt-6 flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[240px]">
          <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zim-ink-400"/>
          <input className="input pl-9" placeholder="Search by invoice number…" value={q} onChange={(e) => setQ(e.target.value)}/>
        </div>
        <select className="input max-w-[180px]" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option>
          <option value="submitted">Submitted</option>
          <option value="accepted">Accepted</option>
          <option value="failed">Failed</option>
          <option value="queued">Queued</option>
        </select>
      </div>

      <div className="mt-6 overflow-hidden rounded-2xl border border-zim-ink-200 bg-white">
        {loading ? (
          <div className="p-12 text-center text-sm text-zim-ink-500">Loading…</div>
        ) : rows.length === 0 ? (
          <EmptyState onSubmit={day ? () => setModalOpen(true) : null}/>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-zim-ink-200 bg-zim-ink-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zim-ink-500">Invoice</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zim-ink-500">Date</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zim-ink-500">Type</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wider text-zim-ink-500">Total</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-zim-ink-500">Status</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zim-ink-100">
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-zim-ink-50">
                  <td className="px-4 py-3 font-mono text-xs font-semibold text-zim-red-700">{r.invoice_no}</td>
                  <td className="px-4 py-3 text-xs text-zim-ink-600">{new Date(r.created_at).toLocaleString()}</td>
                  <td className="px-4 py-3 text-xs">{r.receipt_type}</td>
                  <td className="px-4 py-3 text-right font-mono font-semibold">${Number(r.receipt_total).toFixed(2)}</td>
                  <td className="px-4 py-3"><StatusPill status={r.status}/></td>
                  <td className="px-4 py-3 text-right">
                    <Link to={`/verify/${r.invoice_no}`} target="_blank" className="inline-flex items-center gap-1 text-xs font-semibold text-zim-red-700 hover:text-zim-red-800">
                      Verify <ExternalLink size={11}/>
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}

function StatusPill({ status }) {
  const map = {
    submitted: 'bg-zim-ink-100 text-zim-ink-700',
    accepted:  'bg-emerald-100 text-emerald-700',
    failed:    'bg-rose-100 text-rose-700',
    queued:    'bg-zim-gold-100 text-zim-gold-700',
  }
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${map[status] || 'bg-zim-ink-100 text-zim-ink-700'}`}>
      {status}
    </span>
  )
}

function EmptyState({ onSubmit }) {
  return (
    <div className="p-12 text-center">
      <ReceiptIcon className="mx-auto text-zim-ink-300" size={36}/>
      <p className="mt-3 text-sm font-semibold text-zim-ink-700">No receipts yet</p>
      <p className="mt-1 text-xs text-zim-ink-500">
        {onSubmit ? 'Submit a test receipt to see how it looks here.' : 'Open a fiscal day first, then submit receipts.'}
      </p>
      {onSubmit && (
        <button onClick={onSubmit} className="btn-primary mt-5"><Plus size={14}/> Submit test receipt</button>
      )}
    </div>
  )
}
