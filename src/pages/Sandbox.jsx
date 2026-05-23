/**
 * /sandbox — interactive POS simulator.
 *
 * Visual cashier UI on the left, FDMS pipeline visualisation on the right,
 * Z report at end of day. Toggleable Developer view shows the raw JSON
 * event log for engineers / recruiters who want to peek inside.
 */
import { useEffect, useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Play, RotateCcw, CheckCircle2, Loader2, Lock, Unlock, FileText, Eye, Code2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { createClient } from '@/lib/fdms/client'
import { buildReceiptSigInput, sha256Base64 } from '@/lib/fdms/crypto'

import PosProducts from '@/components/pos/PosProducts'
import PosCart from '@/components/pos/PosCart'
import FDMSPipeline from '@/components/pos/FDMSPipeline'
import ZReportModal from '@/components/pos/ZReportModal'
import PrintedReceiptToast from '@/components/pos/PrintedReceiptToast'
import FiscalReceiptCard from '@/components/FiscalReceiptCard'
import Seo from '@/components/Seo'

const DEVICE_ID = 1042

export default function Sandbox() {
  const [client] = useState(() => createClient({ mode: 'demo', deviceID: DEVICE_ID }))
  const [view, setView] = useState('cashier')     // 'cashier' | 'developer'
  const [status, setStatus] = useState(null)
  const [receipts, setReceipts] = useState([])
  const [cart, setCart] = useState([])
  const [payMethod, setPayMethod] = useState('Cash')
  const [busy, setBusy] = useState(false)
  const [pipelineStage, setPipelineStage] = useState(-1)
  const [lastPrint, setLastPrint] = useState(null)        // { ref, qrUrl } briefly shown
  const [stepLog, setStepLog] = useState([])
  const [zReportOpen, setZReportOpen] = useState(false)
  const [dayOpened, setDayOpened] = useState(null)
  const [dayClosed, setDayClosed] = useState(null)
  const lastFlyer = useRef(null)

  useEffect(() => { refresh() /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [])

  async function refresh() {
    const s = await client.getStatus({})
    setStatus(s)
    const dev = client._peekDevice()
    setReceipts(dev?.receipts || [])
    if (dev?.fiscalDayOpened) setDayOpened(dev.fiscalDayOpened)
    if (dev?.fiscalDayClosed) setDayClosed(dev.fiscalDayClosed)
  }

  function log(stage, ok, data) {
    setStepLog((l) => [{ stage, ok, data, ts: new Date().toISOString() }, ...l].slice(0, 30))
  }

  // ─── Cart ops ───────────────────────────────────────────────────────────
  function addToCart(p) {
    if (status?.fiscalDayStatus !== 'FiscalDayOpened') { toast.error('Open the till first'); return }
    setCart((c) => {
      const existing = c.find((l) => l.id === p.id)
      if (existing) return c.map((l) => l.id === p.id ? { ...l, qty: l.qty + 1 } : l)
      return [...c, { ...p, qty: 1 }]
    })
  }
  const inc = (id) => setCart((c) => c.map((l) => l.id === id ? { ...l, qty: l.qty + 1 } : l))
  const dec = (id) => setCart((c) => c.map((l) => l.id === id ? { ...l, qty: Math.max(1, l.qty - 1) } : l))
  const removeLine = (id) => setCart((c) => c.filter((l) => l.id !== id))
  const clearCart = () => setCart([])

  // ─── Lifecycle ops ──────────────────────────────────────────────────────
  async function openTill() {
    setBusy(true)
    try {
      // Auto-handle registration first time
      if (!status?.fiscalDayStatus) {
        const v = await client.verifyTaxpayerInformation({})
        log('verifyTaxpayerInformation', true, v)
        const r = await client.registerDevice({ deviceSerialNo: `SN-${DEVICE_ID}`, certificateRequest: '(mock CSR)' })
        log('registerDevice', true, r)
      }
      const r = await client.openDay({ fiscalDayOpened: new Date().toISOString() })
      if (r.error) { log('openDay', false, r); toast.error(r.message); return }
      log('openDay', true, r)
      toast.success(`Till open · fiscal day ${r.fiscalDayNo}`)
      await refresh()
    } finally { setBusy(false) }
  }

  async function closeTill() {
    if (cart.length > 0) {
      if (!confirm('Cart has items in it — close the till anyway?')) return
      clearCart()
    }
    setBusy(true)
    try {
      const r = await client.closeDay({ fiscalDayClosed: new Date().toISOString() })
      if (r.error) { log('closeDay', false, r); toast.error(r.message); return }
      log('closeDay', true, r)
      setZReportOpen(true)
      await refresh()
    } finally { setBusy(false) }
  }

  async function checkout(method) {
    if (cart.length === 0) return
    setBusy(true)
    setPipelineStage(0)
    try {
      // 1 · Build receipt
      const counter = receipts.length + 1
      const lines = cart.map((l, i) => ({
        receiptLineType: 'Sale', receiptLineNo: i + 1, receiptLineName: l.name,
        receiptLinePrice: l.price, receiptLineQuantity: l.qty,
        receiptLineTotal: +(l.price * l.qty).toFixed(2),
        taxID: l.taxID, taxPercent: l.taxPercent,
      }))
      const total = +lines.reduce((s, l) => s + l.receiptLineTotal, 0).toFixed(2)
      const taxesMap = new Map()
      lines.forEach((l) => {
        const k = `${l.taxID}|${l.taxPercent ?? 'EX'}`
        const v = taxesMap.get(k) || { taxID: l.taxID, taxPercent: l.taxPercent, taxAmount: 0, salesAmountWithTax: 0 }
        v.salesAmountWithTax += l.receiptLineTotal
        if (l.taxPercent) v.taxAmount += +(l.receiptLineTotal * l.taxPercent / (100 + l.taxPercent)).toFixed(2)
        taxesMap.set(k, v)
      })
      const taxes = Array.from(taxesMap.values()).map((t) => ({ ...t, taxAmount: +t.taxAmount.toFixed(2), salesAmountWithTax: +t.salesAmountWithTax.toFixed(2) }))

      await pause(450)

      const receipt = {
        receiptType: 'FiscalInvoice', receiptCurrency: 'USD',
        receiptCounter: counter, receiptGlobalNo: counter,
        invoiceNo: `INV-${Date.now().toString().slice(-6)}`,
        receiptDate: new Date().toISOString().slice(0, 19),
        receiptLinesTaxInclusive: true,
        receiptLines: lines, receiptTaxes: taxes,
        receiptPayments: [{ moneyTypeCode: method, paymentAmount: total }],
        receiptTotal: total,
      }

      // 2 · Sign
      setPipelineStage(1)
      const concat = buildReceiptSigInput({ deviceID: DEVICE_ID, receipt })
      const hash = await sha256Base64(concat)
      receipt.receiptDeviceSignature = { hash, signature: 'mock-' + hash.slice(0, 16) }
      await pause(500)

      // 3 · Submit
      setPipelineStage(2)
      const r = await client.submitReceipt({ receipt })
      if (r.error) { log('submitReceipt', false, r); toast.error(r.message); setPipelineStage(-1); return }
      log('submitReceipt', true, { request: receipt, response: r })
      await pause(450)

      // 4 · Stamped
      setPipelineStage(3)
      await pause(500)

      const qrUrl = `invoice-verification.zimra.co.zw/${DEVICE_ID}/${receipt.invoiceNo}`
      setLastPrint({ ref: receipt.invoiceNo, qrUrl })
      setTimeout(() => setLastPrint(null), 2800)

      // settle
      setPipelineStage(-1)
      clearCart()
      await refresh()
    } finally { setBusy(false) }
  }

  function reset() {
    if (!confirm('Reset the sandbox? All receipts and the fiscal day will be cleared.')) return
    client._resetMock()
    setStepLog([]); setReceipts([]); setStatus(null); setCart([]); setDayOpened(null); setDayClosed(null)
    refresh()
    toast('Sandbox reset', { icon: '🔄' })
  }

  const dayOpen = status?.fiscalDayStatus === 'FiscalDayOpened'
  const totalToday = receipts.reduce((s, r) => s + (r.receiptTotal || 0), 0)
  const lastReceipt = receipts.at(-1)

  return (
    <div className="min-h-screen bg-zim-sand-50">
      <Seo
        title="Interactive POS sandbox"
        description="Run a full ZIMRA fiscalisation lifecycle in your browser — open the till, sell products, watch each receipt get signed and submitted to FDMS, close the day, see the Z report. No signup, no ZIMRA account."
        path="/sandbox"
      />
      <PrintedReceiptToast show={!!lastPrint} ref={lastPrint?.ref} qrUrl={lastPrint?.qrUrl}/>

      <ZReportModal
        open={zReportOpen}
        onClose={() => setZReportOpen(false)}
        receipts={receipts}
        fiscalDayNo={status?.lastFiscalDayNo}
        dayOpened={dayOpened}
        dayClosed={dayClosed}
      />

      {/* Hero strip */}
      <section className="hero-grad">
        <div className="container-page py-10">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <span className="chip">Interactive POS sandbox</span>
              <h1 className="mt-2 text-3xl font-bold tracking-tight text-zim-ink-900 md:text-4xl">
                Run a real shift — every sale fiscalised live.
              </h1>
              <p className="mt-2 max-w-2xl text-zim-ink-600">
                Open the till. Click products to add them to the cart. Pick a payment method, charge — and watch the receipt get signed, submitted to FDMS and stamped before the customer leaves. Close the till at the end of the day for the Z report.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <ViewToggle view={view} setView={setView}/>
              <button onClick={reset} className="btn-ghost text-xs"><RotateCcw size={12}/> Reset</button>
            </div>
          </div>
        </div>
      </section>

      <div className="container-page py-8">
        {/* Status strip */}
        <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatusCard
            label="Till"
            value={dayOpen ? 'Open' : dayClosed ? 'Closed (day ended)' : 'Closed'}
            accent={dayOpen ? 'emerald' : 'slate'}
            action={!dayOpen ? { label: busy ? 'Opening…' : 'Open till', onClick: openTill, disabled: busy } : null}
          />
          <StatusCard label="Fiscal day"    value={`#${status?.lastFiscalDayNo ?? '—'}`}/>
          <StatusCard label="Receipts today" value={receipts.length}/>
          <StatusCard label="Revenue today"  value={`$${totalToday.toFixed(2)}`} accent="gold"/>
        </div>

        {view === 'cashier' && (
          <CashierView
            dayOpen={dayOpen} status={status} busy={busy} openTill={openTill} closeTill={closeTill}
            cart={cart} addToCart={addToCart} inc={inc} dec={dec} removeLine={removeLine} clearCart={clearCart}
            payMethod={payMethod} setPayMethod={setPayMethod} checkout={checkout}
            pipelineStage={pipelineStage} lastReceipt={lastReceipt} receipts={receipts}
            openZReport={() => setZReportOpen(true)}
          />
        )}
        {view === 'developer' && (
          <DeveloperView stepLog={stepLog} receipts={receipts} status={status}/>
        )}
      </div>
    </div>
  )
}

// ─── Cashier view ─────────────────────────────────────────────────────────

function CashierView({
  dayOpen, status, busy, openTill, closeTill,
  cart, addToCart, inc, dec, removeLine, clearCart,
  payMethod, setPayMethod, checkout,
  pipelineStage, lastReceipt, receipts, openZReport,
}) {
  // First-time / freshly-reset state — no day open and no receipts to show.
  // We always offer the big "Open the till" CTA from here so the user is
  // never stuck staring at a locked till with no obvious next step.
  if (!dayOpen && receipts.length === 0) {
    return (
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="card relative overflow-hidden p-10 text-center">
          <div className="absolute -right-12 -top-12 size-48 rounded-full bg-zim-red-50 opacity-70"/>
          <div className="absolute -left-12 -bottom-12 size-48 rounded-full bg-zim-gold-50 opacity-70"/>
          <div className="relative">
            <div className="mx-auto grid size-16 place-items-center rounded-2xl bg-gradient-to-br from-zim-red-600 to-zim-red-800 text-white shadow-lg">
              <Unlock size={28}/>
            </div>
            <h2 className="mt-4 text-2xl font-bold tracking-tight text-zim-ink-900">Open the till to start the shift</h2>
            <p className="mx-auto mt-2 max-w-md text-sm text-zim-ink-600">
              We'll register the device with ZIMRA (one-off, automatic) and open today's fiscal day. Then you're a cashier — start ringing up sales.
            </p>
            <button onClick={openTill} disabled={busy} className="btn-primary mt-6 px-8 py-3 text-base">
              {busy ? 'Opening…' : <>Open the till <Unlock size={16}/></>}
            </button>
          </div>
        </div>
        <FDMSPipeline activeStage={-1}/>
      </div>
    )
  }

  // Day closed — show Z report option
  if (!dayOpen && receipts.length > 0) {
    return (
      <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="card relative p-8">
          <div className="grid size-12 place-items-center rounded-xl bg-emerald-100 text-emerald-700"><FileText size={22}/></div>
          <h2 className="mt-4 text-2xl font-bold tracking-tight text-zim-ink-900">Day closed.</h2>
          <p className="mt-1 text-sm text-zim-ink-600">{receipts.length} receipts fiscalised today. The Z report is ZIMRA-signed and ready.</p>
          <div className="mt-5 flex flex-wrap gap-2">
            <button onClick={openZReport} className="btn-primary"><FileText size={14}/> View Z report</button>
            <button onClick={openTill} disabled={busy} className="btn-secondary"><Unlock size={14}/> Open new day</button>
          </div>

          <hr className="my-6 border-zim-ink-200"/>
          <h3 className="text-sm font-bold uppercase tracking-wider text-zim-ink-700">Receipts today</h3>
          <ul className="mt-3 divide-y divide-zim-ink-100">
            {receipts.slice().reverse().map((r) => (
              <li key={r.receiptID} className="flex items-center justify-between gap-2 py-2 text-sm">
                <span className="font-mono text-xs text-zim-ink-500">#{r.receiptID}</span>
                <span className="flex-1 truncate text-zim-ink-700">{r.invoiceNo}</span>
                <span className="font-mono font-semibold text-zim-red-700">${r.receiptTotal.toFixed(2)}</span>
              </li>
            ))}
          </ul>
        </div>
        <div className="flex justify-center">
          {lastReceipt ? (
            <FiscalReceiptCard
              invoiceNo={lastReceipt.invoiceNo}
              fiscalDayNo={status?.lastFiscalDayNo}
              receiptGlobalNo={lastReceipt.receiptGlobalNo}
              receiptCounter={lastReceipt.receiptCounter}
              lines={lastReceipt.receiptLines.map((l) => ({ name: l.receiptLineName, qty: l.receiptLineQuantity, price: l.receiptLinePrice }))}
            />
          ) : <FiscalReceiptCard />}
        </div>
      </div>
    )
  }

  // Live trading view
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_360px_320px]">
      {/* Products */}
      <div className="card p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-wider text-zim-ink-700">Tap to add</h2>
          <button onClick={closeTill} disabled={busy} className="text-xs font-medium text-zim-red-700 hover:text-zim-red-800 flex items-center gap-1">
            <Lock size={11}/> Close the till
          </button>
        </div>
        <PosProducts onPick={addToCart} disabled={busy}/>
      </div>

      {/* Cart / Till screen */}
      <div className="min-h-[560px]">
        <PosCart
          cart={cart}
          onIncrement={inc} onDecrement={dec} onRemove={removeLine} onClear={clearCart}
          onCheckout={checkout} onOpenTill={openTill}
          dayOpen={dayOpen} payMethod={payMethod} setPayMethod={setPayMethod}
          busy={busy}
        />
      </div>

      {/* FDMS pipeline + latest fiscalised receipt */}
      <div className="space-y-4">
        <FDMSPipeline activeStage={pipelineStage}/>
        <AnimatePresence>
          {lastReceipt && (
            <motion.div
              key={lastReceipt.receiptID}
              initial={{ opacity: 0, y: 12, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              className="flex justify-center"
            >
              <FiscalReceiptCard
                invoiceNo={lastReceipt.invoiceNo}
                fiscalDayNo={status?.lastFiscalDayNo}
                receiptGlobalNo={lastReceipt.receiptGlobalNo}
                receiptCounter={lastReceipt.receiptCounter}
                lines={lastReceipt.receiptLines.map((l) => ({ name: l.receiptLineName, qty: l.receiptLineQuantity, price: l.receiptLinePrice }))}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

// ─── Developer view (the old JSON-log experience, kept as a toggle) ───────

function DeveloperView({ stepLog, receipts, status }) {
  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      <div className="card">
        <div className="border-b border-zim-ink-200 px-6 py-4">
          <h3 className="text-sm font-bold uppercase tracking-wider text-zim-ink-700">Event log · raw FDMS calls</h3>
          <p className="mt-1 text-xs text-zim-ink-500">Every API call the SDK has made, most recent first.</p>
        </div>
        <div className="max-h-[640px] overflow-y-auto p-4">
          {stepLog.length === 0 ? (
            <p className="py-8 text-center text-sm text-zim-ink-500">No events yet — switch to Cashier view and ring up a sale.</p>
          ) : (
            <ul className="space-y-2">
              <AnimatePresence>
                {stepLog.map((e, i) => (
                  <motion.li key={i} layout initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                    className="rounded-lg border border-zim-ink-200 bg-zim-ink-50/40 p-3">
                    <div className="flex items-center justify-between">
                      <span className={[
                        'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold',
                        e.ok ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800',
                      ].join(' ')}>
                        <CheckCircle2 size={11}/> {e.stage}
                      </span>
                      <span className="text-[10px] text-zim-ink-400">{new Date(e.ts).toLocaleTimeString()}</span>
                    </div>
                    <pre className="codebox mt-2 max-h-56">
                      {JSON.stringify(e.data, null, 2)}
                    </pre>
                  </motion.li>
                ))}
              </AnimatePresence>
            </ul>
          )}
        </div>
      </div>

      <aside className="space-y-4">
        <div className="card p-5">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-zim-red-700">Device status</p>
          <p className="mt-1 font-mono text-xs text-zim-ink-500">ID: {1042}</p>
          <div className="mt-3 space-y-1.5 text-xs">
            <Row k="Day status"     v={status?.fiscalDayStatus || '—'} />
            <Row k="Day #"          v={status?.lastFiscalDayNo ?? '—'} />
            <Row k="Receipts today" v={receipts.length} />
          </div>
        </div>
        <div className="card p-5">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-zim-red-700">SDK note</p>
          <p className="mt-2 text-xs text-zim-ink-600">
            All calls here flow through <span className="kbd">src/lib/fdms/client.js</span> — the same module merchant integrations use in production (just pointed at the local mock instead of <span className="kbd">api.zimra.co.zw</span>).
          </p>
        </div>
      </aside>
    </div>
  )
}

// ─── Small helpers ────────────────────────────────────────────────────────

function ViewToggle({ view, setView }) {
  return (
    <div className="inline-flex rounded-lg border border-zim-ink-200 bg-white p-0.5 text-xs">
      <button onClick={() => setView('cashier')}
        className={[
          'flex items-center gap-1.5 rounded-md px-2.5 py-1.5 font-semibold transition',
          view === 'cashier' ? 'bg-zim-red-600 text-white' : 'text-zim-ink-600 hover:text-zim-ink-900',
        ].join(' ')}>
        <Eye size={12}/> Cashier view
      </button>
      <button onClick={() => setView('developer')}
        className={[
          'flex items-center gap-1.5 rounded-md px-2.5 py-1.5 font-semibold transition',
          view === 'developer' ? 'bg-zim-red-600 text-white' : 'text-zim-ink-600 hover:text-zim-ink-900',
        ].join(' ')}>
        <Code2 size={12}/> Developer view
      </button>
    </div>
  )
}

function StatusCard({ label, value, accent = 'slate', action }) {
  const tone =
    accent === 'emerald' ? 'text-emerald-700' :
    accent === 'gold'    ? 'text-zim-red-700' :
                            'text-zim-ink-900'
  return (
    <div className="card flex items-center justify-between gap-3 px-4 py-3">
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-zim-ink-500">{label}</p>
        <p className={`mt-0.5 text-lg font-bold tracking-tight truncate ${tone}`}>{value}</p>
      </div>
      {action && (
        <button onClick={action.onClick} disabled={action.disabled}
          className="shrink-0 rounded-lg bg-gradient-to-b from-zim-red-600 to-zim-red-700 px-3 py-2 text-xs font-bold text-white shadow-sm transition hover:from-zim-red-700 hover:to-zim-red-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {action.label}
        </button>
      )}
    </div>
  )
}

function Row({ k, v }) {
  return <div className="flex items-center justify-between"><span className="text-zim-ink-500">{k}</span><span className="font-mono font-semibold text-zim-ink-900">{v}</span></div>
}

function pause(ms) { return new Promise((r) => setTimeout(r, ms)) }
