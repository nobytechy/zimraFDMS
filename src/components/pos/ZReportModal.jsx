/**
 * Z report modal — full ZIMRA daily report layout per spec section 10.4.
 *
 * Renders from the merchant's receipts array — builds totals by tax,
 * document counts, payment breakdown. Print + close.
 */
import { X, Printer, Download } from 'lucide-react'
import { motion } from 'framer-motion'

export default function ZReportModal({ open, onClose, receipts, fiscalDayNo, dayOpened, dayClosed }) {
  if (!open) return null

  // ── Aggregate counters from receipts ────────────────────────────────────
  const totals = {}  // taxKey -> { taxName, taxPercent, sales, taxAmount }
  let invoiceCount = 0, creditCount = 0, debitCount = 0
  const payments = {} // method -> sum

  for (const r of receipts) {
    if (r.receiptType === 'FiscalInvoice') invoiceCount++
    else if (r.receiptType === 'CreditNote') creditCount++
    else if (r.receiptType === 'DebitNote')  debitCount++

    for (const t of r.receiptTaxes || []) {
      const key = `${t.taxID}|${t.taxPercent ?? 'EX'}`
      const name = t.taxPercent === undefined ? 'Exempt'
                  : t.taxPercent === 0        ? 'Zero rated'
                  : `VAT ${t.taxPercent}%`
      if (!totals[key]) totals[key] = { name, taxPercent: t.taxPercent, sales: 0, taxAmount: 0 }
      totals[key].sales      += Number(t.salesAmountWithTax) || 0
      totals[key].taxAmount  += Number(t.taxAmount) || 0
    }
    for (const p of r.receiptPayments || []) {
      payments[p.moneyTypeCode] = (payments[p.moneyTypeCode] || 0) + (Number(p.paymentAmount) || 0)
    }
  }
  const totalRows = Object.values(totals).sort((a, b) => (b.taxPercent ?? -1) - (a.taxPercent ?? -1))
  const totalSales = Object.values(totals).reduce((s, r) => s + r.sales, 0)
  const totalTax   = Object.values(totals).reduce((s, r) => s + r.taxAmount, 0)
  const totalNet   = totalSales - totalTax

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zim-ink-900/70 p-4 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        className="relative w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl"
      >
        {/* Header */}
        <div className="bg-gradient-to-br from-zim-red-700 via-zim-red-600 to-zim-red-500 px-6 py-4 text-white">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.3em] opacity-80">ZIMRA · End-of-day</p>
              <h2 className="mt-1 text-2xl font-bold">Z REPORT</h2>
            </div>
            <button onClick={onClose} className="rounded-md p-1.5 text-white/70 hover:bg-white/10 hover:text-white">
              <X size={18}/>
            </button>
          </div>
        </div>

        {/* Body — printable */}
        <div id="z-report-print" className="receipt-paper px-7 py-6 font-mono text-[11px] text-zim-ink-800 max-h-[60vh] overflow-y-auto">
          <div className="text-center">
            <p className="text-sm font-bold tracking-wide text-zim-ink-900">SAMPLE TRADER (PVT) LTD</p>
            <p className="mt-0.5 text-[10px] text-zim-ink-500">Harare CBD · Speke Avenue</p>
            <p className="mt-1 text-[10px] text-zim-ink-500">TIN: 1000000001 · VAT: 200000001</p>
          </div>

          <hr className="my-3 border-dashed border-zim-ink-300"/>

          <div className="text-center text-[10px] text-zim-ink-500 space-y-0.5">
            <div className="flex justify-between"><span>Fiscal day</span><span className="text-zim-ink-900">#{fiscalDayNo || '—'}</span></div>
            <div className="flex justify-between"><span>Opened</span><span className="text-zim-ink-900">{dayOpened ? new Date(dayOpened).toLocaleString() : '—'}</span></div>
            <div className="flex justify-between"><span>Closed</span><span className="text-zim-ink-900">{dayClosed ? new Date(dayClosed).toLocaleString() : '—'}</span></div>
            <div className="flex justify-between"><span>Device ID</span><span className="text-zim-ink-900">1042</span></div>
          </div>

          <hr className="my-3 border-dashed border-zim-ink-300"/>

          <p className="text-center text-[10px] font-bold uppercase tracking-wider text-zim-ink-700">Daily totals · USD</p>

          {totalRows.length === 0 ? (
            <p className="mt-3 text-center text-[10px] text-zim-ink-500">No receipts submitted today.</p>
          ) : (
            <>
              {/* Net by tax */}
              <p className="mt-3 text-[10px] uppercase tracking-wider text-zim-ink-500">Total net sales</p>
              <ul className="mt-1 space-y-0.5">
                {totalRows.map((r) => (
                  <li key={r.name} className="flex justify-between"><span>Net {r.name}</span><span className="tabular-nums">{(r.sales - r.taxAmount).toFixed(2)}</span></li>
                ))}
                <li className="flex justify-between border-t border-dashed border-zim-ink-300 pt-1 font-semibold"><span>Total net</span><span className="tabular-nums">{totalNet.toFixed(2)}</span></li>
              </ul>

              {/* Taxes */}
              <p className="mt-3 text-[10px] uppercase tracking-wider text-zim-ink-500">Total taxes</p>
              <ul className="mt-1 space-y-0.5">
                {totalRows.filter((r) => r.taxAmount > 0).map((r) => (
                  <li key={r.name} className="flex justify-between"><span>Tax {r.name}</span><span className="tabular-nums">{r.taxAmount.toFixed(2)}</span></li>
                ))}
                <li className="flex justify-between border-t border-dashed border-zim-ink-300 pt-1 font-semibold"><span>Total tax</span><span className="tabular-nums">{totalTax.toFixed(2)}</span></li>
              </ul>

              {/* Gross */}
              <p className="mt-3 text-[10px] uppercase tracking-wider text-zim-ink-500">Total gross sales</p>
              <ul className="mt-1 space-y-0.5">
                {totalRows.map((r) => (
                  <li key={r.name} className="flex justify-between"><span>Total {r.name}</span><span className="tabular-nums">{r.sales.toFixed(2)}</span></li>
                ))}
                <li className="flex justify-between border-t border-dashed border-zim-ink-300 pt-1 font-bold text-zim-ink-900"><span>TOTAL GROSS</span><span className="tabular-nums">{totalSales.toFixed(2)}</span></li>
              </ul>

              {/* Document counts */}
              <hr className="my-3 border-dashed border-zim-ink-300"/>
              <p className="text-[10px] uppercase tracking-wider text-zim-ink-500">Documents</p>
              <ul className="mt-1 space-y-0.5">
                <li className="flex justify-between"><span>Invoices</span><span className="tabular-nums">{invoiceCount}</span></li>
                {creditCount > 0 && <li className="flex justify-between"><span>Credit notes</span><span className="tabular-nums">{creditCount}</span></li>}
                {debitCount > 0  && <li className="flex justify-between"><span>Debit notes</span><span className="tabular-nums">{debitCount}</span></li>}
                <li className="flex justify-between border-t border-dashed border-zim-ink-300 pt-1 font-semibold"><span>Total documents</span><span className="tabular-nums">{invoiceCount + creditCount + debitCount}</span></li>
              </ul>

              {/* Payments */}
              <hr className="my-3 border-dashed border-zim-ink-300"/>
              <p className="text-[10px] uppercase tracking-wider text-zim-ink-500">By payment method</p>
              <ul className="mt-1 space-y-0.5">
                {Object.entries(payments).map(([m, amt]) => (
                  <li key={m} className="flex justify-between"><span>{m}</span><span className="tabular-nums">{amt.toFixed(2)}</span></li>
                ))}
              </ul>
            </>
          )}

          <hr className="my-3 border-dashed border-zim-ink-300"/>
          <p className="text-center text-[9px] text-zim-ink-400">
            FDMS Server Signature
            <br/>
            <span className="font-mono text-zim-ink-700 break-all">zR-{Math.random().toString(36).slice(2, 18)}…</span>
          </p>
        </div>

        {/* Footer actions */}
        <div className="flex items-center justify-between border-t border-zim-ink-200 bg-zim-ink-50 px-5 py-3">
          <button onClick={() => window.print()} className="btn-secondary">
            <Printer size={14}/> Print
          </button>
          <button onClick={onClose} className="btn-primary">Close report</button>
        </div>
      </motion.div>
    </div>
  )
}
