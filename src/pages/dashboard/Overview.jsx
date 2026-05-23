import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Receipt, CalendarDays, KeyRound, AlertCircle, ArrowRight, TrendingUp, Plus, Unlock, Lock, FileText } from 'lucide-react'
import toast from 'react-hot-toast'
import { useAuth } from '@/context/AuthContext'
import { getOverviewStats, getDailySeries, openFiscalDay, closeFiscalDay } from '@/lib/fdms/merchantService'
import DailyReceiptsChart from '@/components/dashboard/DailyReceiptsChart'
import SubmitReceiptModal from '@/components/dashboard/SubmitReceiptModal'
import FiscalReceiptCard from '@/components/FiscalReceiptCard'

export default function Overview() {
  const { merchant } = useAuth()
  const [stats, setStats]  = useState(null)
  const [series, setSeries] = useState([])
  const [busy, setBusy]    = useState(false)
  const [modalOpen, setModalOpen] = useState(false)

  const load = async () => {
    if (!merchant) return
    const [s, ds] = await Promise.all([
      getOverviewStats(merchant.id),
      getDailySeries(merchant.id, 14),
    ])
    setStats(s)
    setSeries(ds)
  }
  useEffect(() => { load() /* eslint-disable-next-line */ }, [merchant?.id])

  if (!merchant) return null
  if (!stats) return <div className="text-zim-ink-500">Loading…</div>

  const dayOpen = !!stats.day

  const handleOpen = async () => {
    setBusy(true)
    const { data, error } = await openFiscalDay(merchant.id)
    setBusy(false)
    if (error) { toast.error(error.message); return }
    toast.success(`Fiscal day ${data.fiscal_day_no} opened`)
    load()
  }
  const handleClose = async () => {
    if (!stats.day) return
    if (!confirm(`Close fiscal day ${stats.day.fiscal_day_no}? Your Z report will be generated.`)) return
    setBusy(true)
    const { error } = await closeFiscalDay(merchant.id, stats.day.id)
    setBusy(false)
    if (error) { toast.error(error.message); return }
    toast.success('Day closed')
    load()
  }

  return (
    <div>
      <SubmitReceiptModal
        open={modalOpen} onClose={() => setModalOpen(false)}
        merchantId={merchant.id} fiscalDay={stats.day}
        onDone={() => load()}
      />

      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-zim-red-700">Welcome back</p>
          <h1 className="mt-1 text-3xl font-bold tracking-tight text-zim-ink-900">Hello, {merchant.full_name}.</h1>
          <p className="mt-1 text-sm text-zim-ink-500">{dayOpen ? `Fiscal day #${stats.day.fiscal_day_no} is open.` : 'No fiscal day open. Open one to start submitting receipts.'}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {!dayOpen
            ? <button onClick={handleOpen} disabled={busy} className="btn-primary"><Unlock size={14}/> Open fiscal day</button>
            : <>
                <button onClick={() => setModalOpen(true)} className="btn-primary"><Plus size={14}/> Submit test receipt</button>
                <button onClick={handleClose} disabled={busy} className="btn-secondary"><Lock size={14}/> Close day</button>
              </>
          }
        </div>
      </header>

      {!merchant.phone_verified && (
        <div className="mt-6 flex items-start gap-3 rounded-xl border border-zim-gold-300 bg-zim-gold-50 p-4">
          <AlertCircle className="mt-0.5 text-zim-gold-700" size={18}/>
          <div className="flex-1">
            <p className="text-sm font-semibold text-zim-ink-900">Verify your phone</p>
            <p className="mt-0.5 text-sm text-zim-ink-700">SMS verification is shipping soon — all features work without it during early access.</p>
          </div>
        </div>
      )}

      <div className="mt-8 grid gap-4 md:grid-cols-4">
        <Card icon={Receipt}      label="Receipts today" value={stats.todayCount}/>
        <Card icon={TrendingUp}   label="Revenue today"  value={`$${stats.todayRevenue.toFixed(2)}`}/>
        <Card icon={CalendarDays} label="Fiscal day"     value={stats.day ? `#${stats.day.fiscal_day_no}` : '—'} accent={dayOpen ? 'emerald' : 'slate'}/>
        <Card icon={KeyRound}     label="API keys"       value={stats.apiKeysActive}/>
      </div>

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="card p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-zim-ink-900">Receipts · last 14 days</h2>
            <Link to="/dashboard/receipts" className="text-xs font-semibold text-zim-red-700 hover:text-zim-red-800">View all →</Link>
          </div>
          <DailyReceiptsChart series={series}/>
          <p className="mt-4 text-xs text-zim-ink-500">
            Bar height = receipt count. Hover a bar to see the day's totals. Today is the darkest bar on the right.
          </p>
        </div>

        <div className="card p-6">
          <h2 className="text-lg font-bold text-zim-ink-900">Getting started</h2>
          <ol className="mt-4 space-y-3 text-sm text-zim-ink-700">
            <Step n={1} title="Open a fiscal day" body="Without it, no receipts can be submitted." done={dayOpen}/>
            <Step n={2} title="Submit test receipts" body="Ring up sample sales — they fiscalise + persist." done={stats.todayCount > 0}/>
            <Step n={3} title="Close the day for a Z report" body="ZIMRA-signed daily summary." done={!dayOpen && stats.todayCount > 0}/>
            <Step n={4} title="Connect your POS" body="Generate an API key + integrate from your store."/>
          </ol>
        </div>
      </div>
    </div>
  )
}

function Card({ icon: I, label, value, accent }) {
  const tone =
    accent === 'emerald' ? 'text-emerald-700' :
                            'text-zim-ink-900'
  return (
    <div className="card p-5">
      <div className="flex items-center gap-2 text-zim-ink-500">
        <I size={14}/> <span className="text-xs font-semibold uppercase tracking-wider">{label}</span>
      </div>
      <p className={`mt-3 text-3xl font-bold tracking-tight ${tone}`}>{value}</p>
    </div>
  )
}

function Step({ n, title, body, done }) {
  return (
    <li className="flex gap-3">
      <span className={[
        'grid size-6 shrink-0 place-items-center rounded-full text-xs font-bold',
        done ? 'bg-emerald-500 text-white' : 'bg-gradient-to-br from-zim-red-600 to-zim-red-800 text-white',
      ].join(' ')}>{done ? '✓' : n}</span>
      <div>
        <p className={['font-semibold', done ? 'text-emerald-700 line-through decoration-emerald-300' : 'text-zim-ink-900'].join(' ')}>{title}</p>
        <p className="mt-0.5 text-zim-ink-600">{body}</p>
      </div>
    </li>
  )
}
