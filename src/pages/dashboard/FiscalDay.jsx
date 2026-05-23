import { useEffect, useState } from 'react'
import { Lock, Unlock, FileText, Plus, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '@/context/AuthContext'
import { getLatestFiscalDay, openFiscalDay, closeFiscalDay, listReceiptsForDay } from '@/lib/fdms/merchantService'
import ZReportModal from '@/components/pos/ZReportModal'

export default function FiscalDay() {
  const { merchant } = useAuth()
  const [day, setDay] = useState(null)
  const [receipts, setReceipts] = useState([])
  const [busy, setBusy] = useState(false)
  const [zOpen, setZOpen] = useState(false)

  const load = async () => {
    if (!merchant) return
    const d = await getLatestFiscalDay(merchant.id)
    setDay(d)
    if (d) {
      const { data } = await listReceiptsForDay(merchant.id, d.id)
      setReceipts(data)
    } else {
      setReceipts([])
    }
  }
  useEffect(() => { load() /* eslint-disable-next-line */ }, [merchant?.id])

  if (!merchant) return null

  const handleOpen = async () => {
    setBusy(true)
    const { data, error } = await openFiscalDay(merchant.id)
    setBusy(false)
    if (error) { toast.error(error.message); return }
    toast.success(`Day ${data.fiscal_day_no} opened`)
    load()
  }
  const handleClose = async () => {
    if (!day) return
    if (!confirm(`Close fiscal day ${day.fiscal_day_no}?`)) return
    setBusy(true)
    const { error } = await closeFiscalDay(merchant.id, day.id)
    setBusy(false)
    if (error) { toast.error(error.message); return }
    toast.success('Day closed — Z report ready')
    setZOpen(true)
    load()
  }

  const isOpen = day?.status === 'FiscalDayOpened'
  const totalRevenue = receipts.reduce((s, r) => s + Number(r.receipt_total), 0)

  // Build receipts shaped for ZReportModal
  const zReceipts = receipts.map((r) => ({
    receiptID: r.id,
    receiptType: r.receipt_type,
    receiptTaxes: r.taxes || [],
    receiptPayments: r.payments || [],
  }))

  return (
    <div>
      <ZReportModal
        open={zOpen} onClose={() => setZOpen(false)}
        receipts={zReceipts}
        fiscalDayNo={day?.fiscal_day_no}
        dayOpened={day?.opened_at}
        dayClosed={day?.closed_at}
      />

      <h1 className="text-3xl font-bold tracking-tight text-zim-ink-900">Fiscal day</h1>
      <p className="mt-1 text-sm text-zim-ink-500">Open the day before any sale. Close it at end of day for a ZIMRA-signed Z report.</p>

      {!day ? (
        <div className="mt-8 card relative overflow-hidden p-10 text-center">
          <div className="absolute -right-12 -top-12 size-48 rounded-full bg-zim-red-50 opacity-70"/>
          <div className="absolute -left-12 -bottom-12 size-48 rounded-full bg-zim-gold-50 opacity-70"/>
          <div className="relative">
            <div className="mx-auto grid size-16 place-items-center rounded-2xl bg-gradient-to-br from-zim-red-600 to-zim-red-800 text-white shadow-lg">
              <Unlock size={28}/>
            </div>
            <h2 className="mt-4 text-2xl font-bold tracking-tight text-zim-ink-900">No fiscal day yet</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-zim-ink-600">Open your first fiscal day to start submitting receipts.</p>
            <button onClick={handleOpen} disabled={busy} className="btn-primary mt-6 px-8 py-3 text-base">
              {busy ? <Loader2 size={16} className="animate-spin"/> : <Unlock size={16}/>}
              {busy ? 'Opening…' : 'Open first day'}
            </button>
          </div>
        </div>
      ) : (
        <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_300px]">
          <div className="card p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-wider text-zim-red-700">Current state</p>
                <h2 className="mt-1 text-2xl font-bold text-zim-ink-900">Fiscal day #{day.fiscal_day_no}</h2>
                <p className="mt-1 text-sm text-zim-ink-500">
                  {isOpen
                    ? <>Opened {new Date(day.opened_at).toLocaleString()}</>
                    : <>Opened {new Date(day.opened_at).toLocaleString()} · Closed {new Date(day.closed_at).toLocaleString()}</>
                  }
                </p>
              </div>
              <StatusBadge status={day.status}/>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <Stat label="Receipts"   value={receipts.length}/>
              <Stat label="Revenue"    value={`$${totalRevenue.toFixed(2)}`}/>
              <Stat label="Status"     value={isOpen ? 'Open' : 'Closed'} accent={isOpen ? 'emerald' : 'slate'}/>
            </div>

            <div className="mt-6 flex flex-wrap gap-2">
              {isOpen
                ? <button onClick={handleClose} disabled={busy} className="btn-primary"><Lock size={14}/> Close day + generate Z report</button>
                : <>
                    <button onClick={() => setZOpen(true)} className="btn-primary"><FileText size={14}/> View Z report</button>
                    <button onClick={handleOpen} disabled={busy} className="btn-secondary"><Unlock size={14}/> Open new day</button>
                  </>
              }
            </div>
          </div>

          <div className="card p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-zim-red-700">Receipts today</p>
            {receipts.length === 0 ? (
              <p className="mt-4 text-sm text-zim-ink-500">No receipts yet for this day.</p>
            ) : (
              <ul className="mt-3 divide-y divide-zim-ink-100">
                {receipts.slice().reverse().slice(0, 8).map((r) => (
                  <li key={r.id} className="flex items-center justify-between gap-2 py-2 text-xs">
                    <span className="font-mono text-zim-ink-500 truncate">{r.invoice_no}</span>
                    <span className="font-mono font-semibold text-zim-red-700">${Number(r.receipt_total).toFixed(2)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function StatusBadge({ status }) {
  const map = {
    FiscalDayOpened: 'bg-emerald-100 text-emerald-700',
    FiscalDayClosed: 'bg-zim-ink-100 text-zim-ink-600',
    FiscalDayCloseFailed: 'bg-rose-100 text-rose-700',
    FiscalDayCloseInitiated: 'bg-zim-gold-100 text-zim-gold-700',
  }
  return <span className={`inline-flex items-center rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wider ${map[status] || ''}`}>{status}</span>
}

function Stat({ label, value, accent }) {
  return (
    <div className="rounded-lg border border-zim-ink-200 bg-zim-ink-50/40 p-4">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-zim-ink-500">{label}</p>
      <p className={`mt-1 text-xl font-bold ${accent === 'emerald' ? 'text-emerald-700' : 'text-zim-ink-900'}`}>{value}</p>
    </div>
  )
}
