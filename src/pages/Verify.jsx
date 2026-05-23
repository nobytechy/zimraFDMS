/**
 * /verify          — search box only
 * /verify/:ref     — looks up a fiscalised receipt by invoice_no via the
 *                    public RPC and renders it with the FDMS verification
 *                    stamp. Anonymous; no login required.
 */
import { useEffect, useState } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { Search, ShieldCheck, AlertTriangle, ArrowRight, Receipt, CheckCircle2 } from 'lucide-react'
import { motion } from 'framer-motion'
import { verifyReceipt } from '@/lib/fdms/merchantService'
import Seo from '@/components/Seo'

export default function Verify() {
  const { ref } = useParams()
  const nav = useNavigate()
  const [q, setQ] = useState(ref || '')
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!ref) return
    (async () => {
      setBusy(true); setError(null); setData(null)
      const r = await verifyReceipt(ref)
      setBusy(false)
      if (r.error) setError(r.error.message)
      else setData(r.data)
    })()
  }, [ref])

  const submit = (e) => {
    e?.preventDefault?.()
    if (!q.trim()) return
    nav(`/verify/${encodeURIComponent(q.trim())}`)
  }

  return (
    <div className="min-h-screen bg-zim-sand-50">
      <Seo
        title={ref ? `Verify receipt ${ref}` : 'Verify a fiscalised receipt'}
        description="Paste an invoice number from any zimFDMS-fiscalised receipt to verify it's genuine — see the FDMS signature stamp, line items, taxes and total."
        path={ref ? `/verify/${ref}` : '/verify'}
      />
      <section className="hero-grad">
        <div className="container-page py-14 md:py-20 text-center">
          <span className="chip">Receipt verification</span>
          <h1 className="mt-4 text-balance text-4xl font-bold tracking-tight text-zim-ink-900 md:text-5xl">
            Is this receipt <span className="text-zim-red-700">genuine?</span>
          </h1>
          <p className="mx-auto mt-3 max-w-xl text-zim-ink-600">
            Paste the invoice number from any zimFDMS-fiscalised receipt and we'll show you the original record + the FDMS signature stamp.
          </p>
          <form onSubmit={submit} className="mx-auto mt-7 flex max-w-xl flex-col gap-2 sm:flex-row">
            <div className="relative flex-1">
              <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zim-ink-400"/>
              <input
                className="input pl-10 py-3 text-base"
                placeholder="INV-1234567-1"
                value={q}
                onChange={(e) => setQ(e.target.value)}
                autoFocus
              />
            </div>
            <button type="submit" className="btn-primary py-3">
              Verify <ArrowRight size={16}/>
            </button>
          </form>
        </div>
      </section>

      <div className="container-page py-10">
        {busy && <div className="card p-10 text-center text-zim-ink-500">Looking up receipt…</div>}

        {error && !busy && (
          <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
            className="mx-auto max-w-2xl rounded-2xl border border-rose-200 bg-rose-50 p-6">
            <div className="flex items-start gap-3">
              <AlertTriangle className="mt-0.5 text-rose-600" size={20}/>
              <div>
                <p className="font-semibold text-rose-900">Receipt not found</p>
                <p className="mt-1 text-sm text-rose-700">{error}</p>
                <p className="mt-2 text-xs text-rose-600">Double-check the reference. If your receipt was issued today, it may still be syncing — try again in a moment.</p>
              </div>
            </div>
          </motion.div>
        )}

        {data && !busy && <VerifiedReceipt data={data}/>}

        {!ref && !busy && (
          <div className="mx-auto mt-4 max-w-2xl rounded-2xl border border-zim-ink-200 bg-white p-7">
            <p className="text-xs font-semibold uppercase tracking-wider text-zim-ink-500">How this works</p>
            <h3 className="mt-2 text-lg font-bold text-zim-ink-900">Every fiscalised receipt is publicly verifiable</h3>
            <p className="mt-2 text-sm text-zim-ink-600">
              The QR code printed on every zimFDMS receipt encodes a link to this page. Anyone scanning it can confirm the receipt is real and that the seller has reported the sale to ZIMRA. That's the whole point of fiscalisation — transparency, on both sides of the till.
            </p>
            <div className="mt-4 rounded-lg bg-zim-ink-50 p-4">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-zim-ink-500">Try a sample</p>
              <p className="mt-1 text-xs text-zim-ink-600">If you don't have a real reference yet, sign up as a merchant + submit a test receipt from your dashboard, then paste its invoice number here.</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <Link to="/signup" className="btn-primary text-xs">Create a merchant account</Link>
                <Link to="/sandbox" className="btn-secondary text-xs">Try the sandbox</Link>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

function VerifiedReceipt({ data }) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
      className="mx-auto max-w-2xl">
      <div className="mb-4 flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 p-3">
        <CheckCircle2 className="text-emerald-600" size={20}/>
        <div>
          <p className="text-sm font-bold text-emerald-900">Genuine fiscalised receipt</p>
          <p className="text-xs text-emerald-700">Signed by device + counter-signed by FDMS.</p>
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-zim-ink-200 bg-white shadow-sm">
        <div className="border-b border-zim-ink-200 bg-gradient-to-br from-zim-red-700 via-zim-red-600 to-zim-red-500 px-6 py-5 text-white">
          <p className="text-[10px] font-bold uppercase tracking-[0.3em] opacity-80">ZIMRA fiscalisation</p>
          <h2 className="mt-1 text-2xl font-bold">{data.invoice_no}</h2>
          <p className="mt-1 text-sm text-zim-red-50/85">{data.merchant_name || 'Merchant'}{data.merchant_tin && ` · TIN ${data.merchant_tin}`}</p>
        </div>

        <div className="px-6 py-5 space-y-4">
          <div className="grid grid-cols-2 gap-4 text-sm">
            <Field k="Receipt type" v={data.receipt_type}/>
            <Field k="Status"      v={<span className="capitalize">{data.status}</span>}/>
            <Field k="Date"        v={new Date(data.receipt_date || data.created_at).toLocaleString()}/>
            <Field k="Currency"    v={data.receipt_currency}/>
            <Field k="Global no."  v={data.receipt_global_no}/>
            <Field k="Fiscal day"  v={data.fiscal_day_no ? `#${data.fiscal_day_no}` : '—'}/>
          </div>

          <hr className="border-zim-ink-200"/>

          <div>
            <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-zim-ink-500">Items</p>
            <ul className="divide-y divide-zim-ink-100">
              {(data.lines || []).map((l, i) => (
                <li key={i} className="flex items-center justify-between py-2 text-sm">
                  <span className="text-zim-ink-700">{l.receiptLineQuantity}× {l.receiptLineName}</span>
                  <span className="font-mono font-semibold">${Number(l.receiptLineTotal).toFixed(2)}</span>
                </li>
              ))}
            </ul>
          </div>

          <hr className="border-zim-ink-200"/>

          <div className="space-y-1.5 text-sm">
            {(data.taxes || []).map((t, i) => (
              <div key={i} className="flex justify-between text-zim-ink-600">
                <span>Tax {t.taxPercent !== undefined ? `${t.taxPercent}%` : 'Exempt'}</span>
                <span className="font-mono">${Number(t.taxAmount).toFixed(2)}</span>
              </div>
            ))}
            <div className="flex justify-between border-t border-zim-ink-200 pt-2 text-base font-bold">
              <span>Total</span>
              <span className="font-mono text-zim-red-700">${Number(data.receipt_total).toFixed(2)}</span>
            </div>
          </div>

          <hr className="border-zim-ink-200"/>

          <div className="rounded-xl bg-zim-ink-50 p-4">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-zim-ink-500">FDMS signature stamp</p>
            <p className="mt-1.5 font-mono text-[10.5px] text-zim-ink-700 break-all">{data.fdms_signature?.hash}</p>
            <p className="mt-1 font-mono text-[10.5px] text-zim-ink-500 break-all">{data.fdms_signature?.signature}</p>
            <p className="mt-2 text-[10px] text-zim-ink-500">
              <ShieldCheck size={10} className="inline mr-1"/>
              Signed by ZIMRA's Fiscal Device Management System. Tampering invalidates this signature.
            </p>
          </div>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap justify-between gap-2 text-xs text-zim-ink-500">
        <span>Showing FDMS record · last sync just now</span>
        <button onClick={() => window.print()} className="font-semibold text-zim-red-700 hover:text-zim-red-800">Print this receipt</button>
      </div>
    </motion.div>
  )
}

function Field({ k, v }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-zim-ink-500">{k}</p>
      <p className="mt-0.5 font-mono text-sm font-semibold text-zim-ink-900">{v}</p>
    </div>
  )
}
