import { useEffect, useState } from 'react'
import { Lock, Unlock, FileText, Loader2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { useDevice } from '@/context/DeviceContext'
import { bridge } from '@/lib/fdms/bridge'
import ZReportModal from '@/components/pos/ZReportModal'
import NeedDevice from '@/components/dashboard/NeedDevice'

export default function FiscalDay() { return <NeedDevice><Inner/></NeedDevice> }

function Inner() {
  const { device, reload } = useDevice()
  const [day, setDay] = useState(null)        // { dayNo, status, opened, closedAt, receipts:[record] }
  const [busy, setBusy] = useState(false)
  const [zOpen, setZOpen] = useState(false)
  const no = device.day?.no

  const load = async () => {
    if (!no) { setDay(null); return }
    try { setDay(await bridge.day(device.deviceID, no)) } catch (e) { toast.error(e.message) }
  }
  useEffect(() => { load() /* eslint-disable-next-line */ }, [no, device.day?.status, device.day?.receipts])

  const run = async (fn, msg, after) => {
    setBusy(true)
    try { await fn(); toast.success(msg); await reload(); after?.() } catch (e) { toast.error(e.message) } finally { setBusy(false) }
  }

  const isOpen = device.day?.status === 'FiscalDayOpened'
  const receipts = day?.receipts || []
  const total = receipts.reduce((s, r) => s + (r.receipt?.receiptTotal || 0), 0)
  const zReceipts = receipts.map((r) => ({ receiptID: r.receiptID, receiptType: r.receipt.receiptType, receiptTaxes: r.receipt.receiptTaxes, receiptPayments: r.receipt.receiptPayments }))

  return (
    <div>
      <ZReportModal open={zOpen} onClose={() => setZOpen(false)} receipts={zReceipts} fiscalDayNo={no} dayOpened={day?.opened} dayClosed={day?.closedAt} />
      <h1 className="text-3xl font-bold tracking-tight text-zim-ink-900">Fiscal day</h1>
      <p className="mt-1 text-sm text-zim-ink-500">Open the day before any sale. Close it at end of day.</p>

      {!no ? (
        <div className="card mt-8 p-10 text-center">
          <div className="mx-auto grid size-16 place-items-center rounded-2xl bg-gradient-to-br from-zim-red-600 to-zim-red-800 text-white shadow-lg"><Unlock size={28}/></div>
          <h2 className="mt-4 text-2xl font-bold text-zim-ink-900">No fiscal day yet</h2>
          <button onClick={() => run(() => bridge.openDay(device.deviceID), 'Day opened')} disabled={busy} className="btn-primary mt-6 px-8 py-3 text-base">
            {busy ? <Loader2 size={16} className="animate-spin"/> : <Unlock size={16}/>} Open first day
          </button>
        </div>
      ) : (
        <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_300px]">
          <div className="card p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-2xl font-bold text-zim-ink-900">Fiscal day #{no}</h2>
                <p className="mt-1 text-sm text-zim-ink-500">Opened {day?.opened ? new Date(day.opened).toLocaleString() : '—'}{day?.closedAt && <> · Closed {new Date(day.closedAt).toLocaleString()}</>}</p>
              </div>
              <span className="rounded-full bg-zim-ink-100 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-zim-ink-700">{device.day.status.replace('FiscalDay', '')}</span>
            </div>
            <div className="mt-6 grid gap-3 sm:grid-cols-3">
              <Stat label="Receipts" value={receipts.length}/>
              <Stat label="Revenue" value={`$${total.toFixed(2)}`}/>
              <Stat label="Waiting to send" value={device.day.queued}/>
            </div>
            <div className="mt-6 flex flex-wrap gap-2">
              {isOpen
                ? <button onClick={() => confirm(`Close fiscal day ${no}?`) && run(() => bridge.closeDay(device.deviceID), 'Day closed', () => setZOpen(true))} disabled={busy} className="btn-primary"><Lock size={14}/> Close day</button>
                : <>
                    <button onClick={() => setZOpen(true)} className="btn-primary"><FileText size={14}/> View Z report</button>
                    <button onClick={() => run(() => bridge.openDay(device.deviceID), 'Day opened')} disabled={busy} className="btn-secondary"><Unlock size={14}/> Open new day</button>
                  </>}
            </div>
          </div>
          <div className="card p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-zim-red-700">Latest receipts</p>
            {receipts.length === 0 ? <p className="mt-4 text-sm text-zim-ink-500">No receipts yet.</p> : (
              <ul className="mt-3 divide-y divide-zim-ink-100">
                {receipts.slice().reverse().slice(0, 8).map((r) => (
                  <li key={r.receipt.receiptGlobalNo} className="flex items-center justify-between gap-2 py-2 text-xs">
                    <span className="truncate font-mono text-zim-ink-500">{r.receipt.invoiceNo}</span>
                    <span className="font-mono font-semibold text-zim-red-700">${Number(r.receipt.receiptTotal).toFixed(2)}</span>
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

function Stat({ label, value }) {
  return (
    <div className="rounded-lg border border-zim-ink-200 bg-zim-ink-50/40 p-4">
      <p className="text-[10px] font-semibold uppercase tracking-wider text-zim-ink-500">{label}</p>
      <p className="mt-1 text-xl font-bold text-zim-ink-900">{value}</p>
    </div>
  )
}
