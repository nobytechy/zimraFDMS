/**
 * /demo-dashboard — public, read-only preview of the merchant dashboard with
 * seeded data. Lets recruiters / business owners see what the operator side
 * looks like without creating an account.
 */
import { Link } from 'react-router-dom'
import { Receipt, CalendarDays, KeyRound, TrendingUp, ArrowRight, Eye, ExternalLink } from 'lucide-react'
import { motion } from 'framer-motion'
import Logo from '@/components/Logo'
import DailyReceiptsChart from '@/components/dashboard/DailyReceiptsChart'

// Seeded 14-day data — gentle ramp-up over the past 2 weeks
const SERIES = Array.from({ length: 14 }).map((_, i) => {
  const d = new Date(); d.setDate(d.getDate() - (13 - i))
  const count = Math.max(0, Math.round(8 + Math.sin(i / 1.6) * 6 + (i / 2)))
  return {
    day: d.toISOString().slice(0, 10),
    receipt_count: count,
    gross_total:  +(count * 12.4).toFixed(2),
  }
})

const RECEIPTS = [
  { invoice_no: 'INV-9182301-17', receipt_total: 14.20, receipt_type: 'FiscalInvoice', status: 'accepted', created_at: new Date(Date.now() - 5 * 60_000).toISOString() },
  { invoice_no: 'INV-9182301-16', receipt_total:  8.50, receipt_type: 'FiscalInvoice', status: 'accepted', created_at: new Date(Date.now() - 18 * 60_000).toISOString() },
  { invoice_no: 'INV-9182301-15', receipt_total: 32.00, receipt_type: 'FiscalInvoice', status: 'accepted', created_at: new Date(Date.now() - 35 * 60_000).toISOString() },
  { invoice_no: 'INV-9182301-14', receipt_total:  6.30, receipt_type: 'CreditNote',    status: 'accepted', created_at: new Date(Date.now() - 48 * 60_000).toISOString() },
  { invoice_no: 'INV-9182301-13', receipt_total: 21.50, receipt_type: 'FiscalInvoice', status: 'accepted', created_at: new Date(Date.now() - 90 * 60_000).toISOString() },
  { invoice_no: 'INV-9182301-12', receipt_total:  4.80, receipt_type: 'FiscalInvoice', status: 'failed',   created_at: new Date(Date.now() - 130 * 60_000).toISOString() },
]

const STATS = {
  todayCount: SERIES.at(-1).receipt_count,
  todayRevenue: SERIES.at(-1).gross_total,
  fiscalDayNo: 142,
  apiKeysActive: 2,
}

export default function DemoDashboard() {
  return (
    <div className="min-h-screen bg-zim-ink-50">
      {/* Demo banner */}
      <div className="bg-gradient-to-r from-zim-gold-400 to-zim-gold-500 text-zim-ink-900">
        <div className="container-page flex flex-wrap items-center justify-between gap-2 py-2 text-xs font-semibold">
          <span className="flex items-center gap-1.5"><Eye size={12}/> Demo dashboard — what merchants see after signing in. Data is sample.</span>
          <Link to="/signup" className="underline hover:no-underline">Create your real account →</Link>
        </div>
      </div>

      {/* Mini header */}
      <header className="border-b border-zim-ink-200 bg-white">
        <div className="container-page flex items-center justify-between py-4">
          <Link to="/"><Logo /></Link>
          <div className="flex items-center gap-2">
            <Link to="/sandbox" className="btn-secondary text-xs"><ExternalLink size={12}/> Sandbox</Link>
            <Link to="/signup" className="btn-primary text-xs">Sign up <ArrowRight size={12}/></Link>
          </div>
        </div>
      </header>

      <main className="container-page py-10">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-zim-red-700">Welcome back</p>
            <h1 className="mt-1 text-3xl font-bold tracking-tight text-zim-ink-900">Hello, Sample Trader.</h1>
            <p className="mt-1 text-sm text-zim-ink-500">Fiscal day #{STATS.fiscalDayNo} is open.</p>
          </div>
          <div className="flex items-center gap-2">
            <button disabled className="btn-primary opacity-80">+ Submit test receipt</button>
            <button disabled className="btn-secondary opacity-80">Close day</button>
          </div>
        </header>

        <div className="mt-8 grid gap-4 md:grid-cols-4">
          <Card icon={Receipt}     label="Receipts today" value={STATS.todayCount}/>
          <Card icon={TrendingUp}  label="Revenue today"  value={`$${STATS.todayRevenue.toFixed(2)}`}/>
          <Card icon={CalendarDays} label="Fiscal day"     value={`#${STATS.fiscalDayNo}`} accent="emerald"/>
          <Card icon={KeyRound}    label="API keys"       value={STATS.apiKeysActive}/>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          <div className="card p-6">
            <h2 className="text-lg font-bold text-zim-ink-900">Receipts · last 14 days</h2>
            <div className="mt-3">
              <DailyReceiptsChart series={SERIES}/>
            </div>
          </div>
          <div className="card p-6">
            <h2 className="text-lg font-bold text-zim-ink-900">Recent receipts</h2>
            <ul className="mt-3 divide-y divide-zim-ink-100">
              {RECEIPTS.slice(0, 5).map((r) => (
                <motion.li key={r.invoice_no}
                  initial={{ opacity: 0, x: 8 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }}
                  className="flex items-center justify-between gap-2 py-2 text-xs">
                  <span className="font-mono text-zim-ink-500">{r.invoice_no}</span>
                  <span className="text-zim-ink-700">{r.receipt_type}</span>
                  <span className="font-mono font-semibold text-zim-red-700">${r.receipt_total.toFixed(2)}</span>
                </motion.li>
              ))}
            </ul>
            <p className="mt-3 text-[11px] text-zim-ink-500">In the real dashboard, every row links to the public verify page so customers can scan the QR and confirm.</p>
          </div>
        </div>

        <div className="mt-10 rounded-2xl bg-gradient-to-br from-zim-red-700 via-zim-red-600 to-zim-red-500 p-8 text-white">
          <h3 className="text-2xl font-bold">Like what you see?</h3>
          <p className="mt-2 max-w-xl text-zim-red-50/90">This is exactly what your real dashboard looks like — with your real fiscalised receipts, your real fiscal day, your real Z reports.</p>
          <div className="mt-5 flex flex-wrap gap-2">
            <Link to="/signup" className="btn-gold text-base">Create my account <ArrowRight size={14}/></Link>
            <Link to="/sandbox" className="btn-secondary !bg-white/10 !border-white/30 !text-white hover:!bg-white/20">Run the POS sandbox</Link>
          </div>
        </div>
      </main>
    </div>
  )
}

function Card({ icon: I, label, value, accent }) {
  return (
    <div className="card p-5">
      <div className="flex items-center gap-2 text-zim-ink-500">
        <I size={14}/> <span className="text-xs font-semibold uppercase tracking-wider">{label}</span>
      </div>
      <p className={`mt-3 text-3xl font-bold tracking-tight ${accent === 'emerald' ? 'text-emerald-700' : 'text-zim-ink-900'}`}>{value}</p>
    </div>
  )
}
