import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Receipt, CalendarDays, AlertCircle, TrendingUp, Plus, Unlock, Lock, Send } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '@/context/AuthContext'
import { useDevice } from '@/context/DeviceContext'
import { bridge } from '@/lib/fdms/bridge'
import DailyReceiptsChart from '@/components/dashboard/DailyReceiptsChart'
import SubmitReceiptModal from '@/components/dashboard/SubmitReceiptModal'
import NeedDevice from '@/components/dashboard/NeedDevice'

export default function Overview() {
  return <NeedDevice><Inner/></NeedDevice>
}

function Inner() {
  const { merchant } = useAuth()
  const { device, reload } = useDevice()
  const [series, setSeries] = useState([])
  const [busy, setBusy] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)

  const loadSeries = async () => {
    try {
      const rows = await bridge.series(device.deviceID, 14)
      const map = new Map(rows.map((r) => [r.day, r]))
      const out = []
      for (let i = 13; i >= 0; i--) {
        const d = new Date(Date.now() + 2 * 3600e3 - i * 86400e3).toISOString().slice(0, 10)
        out.push({ day: d, receipt_count: map.get(d)?.receipts || 0, gross_total: map.get(d)?.revenue || 0 })
      }
      setSeries(out)
    } catch { /* chart is optional */ }
  }
  useEffect(() => { loadSeries() /* eslint-disable-next-line */ }, [device.deviceID, device.day?.receipts])

  const day = device.day
  const dayOpen = day?.status === 'FiscalDayOpened'
  const run = async (fn, okMsg) => {
    setBusy(true)
    try { await fn(); if (okMsg) toast.success(okMsg); await reload() } catch (e) { toast.error(e.message) } finally { setBusy(false) }
  }

  return (
    <div>
      <SubmitReceiptModal open={modalOpen} onClose={() => setModalOpen(false)} device={device} onDone={reload} />

      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-zim-red-700">{device.env === 'live' ? 'Live' : 'Test'} · {device.taxpayer?.taxPayerName}</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-zim-ink-900">Hello, {merchant.full_name}.</h1>
          <p className="mt-1 text-sm text-zim-ink-500">{dayOpen ? `Fiscal day #${day.no} is open.` : 'No fiscal day open. Open one to start selling.'}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!dayOpen
            ? <button onClick={() => run(() => bridge.openDay(device.deviceID), 'Day opened')} disabled={busy} className="btn-primary"><Unlock size={14}/> Open fiscal day</button>
            : <>
                <button onClick={() => setModalOpen(true)} className="btn-primary"><Plus size={14}/> New sale</button>
                <button onClick={() => confirm(`Close fiscal day ${day.no}?`) && run(() => bridge.closeDay(device.deviceID), 'Day closed')} disabled={busy} className="btn-secondary"><Lock size={14}/> Close day</button>
              </>}
        </div>
      </header>

      {day?.queued > 0 && (
        <div className="mt-6 flex items-start gap-3 rounded-xl border border-zim-gold-300 bg-zim-gold-50 p-4">
          <AlertCircle className="mt-0.5 text-zim-gold-700" size={18}/>
          <div className="flex-1">
            <p className="text-sm font-semibold text-zim-ink-900">{day.queued} sale{day.queued > 1 ? 's' : ''} waiting to reach ZIMRA</p>
            <p className="mt-0.5 text-sm text-zim-ink-700">They are saved safely and sent in order once ZIMRA is reachable.</p>
          </div>
          <button onClick={() => run(() => bridge.flush(device.deviceID), 'Sent')} disabled={busy} className="btn-secondary"><Send size={14}/> Send now</button>
        </div>
      )}

      <div className="mt-8 grid gap-4 md:grid-cols-3">
        <Card icon={Receipt}      label="Receipts this day" value={day?.receipts ?? 0}/>
        <Card icon={TrendingUp}   label="Revenue this day"  value={`$${(day?.total ?? 0).toFixed(2)}`}/>
        <Card icon={CalendarDays} label="Fiscal day"        value={day?.no ? `#${day.no}` : '—'} accent={dayOpen ? 'emerald' : 'slate'}/>
      </div>

      <div className="mt-8 card p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-zim-ink-900">Receipts · last 14 days</h2>
          <Link to="/dashboard/receipts" className="text-xs font-semibold text-zim-red-700 hover:text-zim-red-800">View all →</Link>
        </div>
        <DailyReceiptsChart series={series}/>
      </div>
    </div>
  )
}

function Card({ icon: I, label, value, accent }) {
  return (
    <div className="card p-5">
      <div className="flex items-center gap-2 text-zim-ink-500"><I size={14}/> <span className="text-xs font-semibold uppercase tracking-wider">{label}</span></div>
      <p className={`mt-3 text-3xl font-bold tracking-tight ${accent === 'emerald' ? 'text-emerald-700' : 'text-zim-ink-900'}`}>{value}</p>
    </div>
  )
}
