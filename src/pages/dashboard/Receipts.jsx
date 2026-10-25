import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Search, Receipt as ReceiptIcon, ExternalLink, Plus } from 'lucide-react'
import { useDevice } from '@/context/DeviceContext'
import { bridge } from '@/lib/fdms/bridge'
import SubmitReceiptModal from '@/components/dashboard/SubmitReceiptModal'
import NeedDevice from '@/components/dashboard/NeedDevice'

export default function Receipts() { return <NeedDevice><Inner/></NeedDevice> }

function Inner() {
  const { device, reload } = useDevice()
  const [rows, setRows] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [f, setF] = useState({ q: '', status: '', type: '', from: '', to: '' })
  const [modalOpen, setModalOpen] = useState(false)
  const dayOpen = device.day?.status === 'FiscalDayOpened'

  const load = async () => {
    setLoading(true); setError('')
    try { setRows(await bridge.receipts(device.deviceID, f)) } catch (e) { setError(e.message) }
    setLoading(false)
  }
  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t) /* eslint-disable-next-line */ }, [device.deviceID, f.q, f.status, f.type, f.from, f.to])
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value })

  return (
    <div>
      <SubmitReceiptModal open={modalOpen} onClose={() => setModalOpen(false)} device={device} onDone={() => { reload(); load() }} />
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-zim-ink-900">Receipts</h1>
          <p className="mt-1 text-sm text-zim-ink-500">Everything you've fiscalised, with its ZIMRA status.</p>
        </div>
        {dayOpen && <button onClick={() => setModalOpen(true)} className="btn-primary"><Plus size={14}/> New sale</button>}
      </header>

      <div className="mt-6 flex flex-wrap gap-3">
        <div className="relative min-w-[220px] flex-1">
          <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zim-ink-400"/>
          <input className="input pl-9" placeholder="Search invoice number…" value={f.q} onChange={set('q')}/>
        </div>
        <select className="input max-w-[150px]" value={f.status} onChange={set('status')}>
          <option value="">All statuses</option>
          <option value="accepted">Accepted</option>
          <option value="queued">Waiting</option>
          <option value="rejected">Rejected</option>
        </select>
        <select className="input max-w-[150px]" value={f.type} onChange={set('type')}>
          <option value="">All types</option>
          <option value="FiscalInvoice">Invoice</option>
          <option value="CreditNote">Credit note</option>
          <option value="DebitNote">Debit note</option>
        </select>
        <label className="flex items-center gap-2 text-xs text-zim-ink-500">From <input type="date" className="input" value={f.from} onChange={set('from')}/></label>
        <label className="flex items-center gap-2 text-xs text-zim-ink-500">To <input type="date" className="input" value={f.to} onChange={set('to')}/></label>
      </div>

      <div className="mt-6 overflow-x-auto rounded-2xl border border-zim-ink-200 bg-white">
        {loading ? <div className="p-12 text-center text-sm text-zim-ink-500">Loading…</div>
         : error ? <div className="p-12 text-center text-sm font-semibold text-rose-600">{error}</div>
         : rows.length === 0 ? (
          <div className="p-12 text-center">
            <ReceiptIcon className="mx-auto text-zim-ink-300" size={36}/>
            <p className="mt-3 text-sm font-semibold text-zim-ink-700">No receipts found</p>
            {dayOpen && <button onClick={() => setModalOpen(true)} className="btn-primary mt-5"><Plus size={14}/> New sale</button>}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-zim-ink-200 bg-zim-ink-50">
              <tr>{['Invoice', 'Date', 'Type', 'Total', 'Status', ''].map((h, i) => (
                <th key={i} className={`px-4 py-3 text-xs font-semibold uppercase tracking-wider text-zim-ink-500 ${h === 'Total' ? 'text-right' : 'text-left'}`}>{h}</th>))}</tr>
            </thead>
            <tbody className="divide-y divide-zim-ink-100">
              {rows.map((r) => (
                <tr key={r.globalNo} className="hover:bg-zim-ink-50">
                  <td className="px-4 py-3 font-mono text-xs font-semibold text-zim-red-700">{r.invoiceNo}</td>
                  <td className="px-4 py-3 text-xs text-zim-ink-600">{r.date.replace('T', ' ')}</td>
                  <td className="px-4 py-3 text-xs">{r.type}</td>
                  <td className="px-4 py-3 text-right font-mono font-semibold">${Number(r.total).toFixed(2)}</td>
                  <td className="px-4 py-3"><StatusPill status={r.status}/></td>
                  <td className="px-4 py-3 text-right">
                    <Link to={`/verify/${r.invoiceNo}`} target="_blank" className="inline-flex items-center gap-1 text-xs font-semibold text-zim-red-700">Verify <ExternalLink size={11}/></Link>
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
  const map = { accepted: 'bg-emerald-100 text-emerald-700', rejected: 'bg-rose-100 text-rose-700', queued: 'bg-zim-gold-100 text-zim-gold-700' }
  const label = { queued: 'waiting' }[status] || status
  return <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${map[status] || 'bg-zim-ink-100 text-zim-ink-700'}`}>{label}</span>
}
