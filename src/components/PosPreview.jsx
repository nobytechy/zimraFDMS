/**
 * Landing-page POS teaser. A compact, static-but-animated representation of
 * the visual sandbox — gives recruiters / business owners a feel for what
 * they'll get without making them click through.
 *
 * Three components stacked side-by-side on desktop:
 *   1. Till screen — dark cart preview with totals + Charge button
 *   2. FDMS pipeline — 4-node vertical rail with a continuously moving dot
 *   3. Fiscalised receipt — printed result
 */
import { Link } from 'react-router-dom'
import { motion } from 'framer-motion'
import { ArrowRight, Lock, Cloud, BadgeCheck, Wrench, CheckCircle2 } from 'lucide-react'
import FiscalReceiptCard from '@/components/FiscalReceiptCard'

const CART_PREVIEW = [
  { emoji: '☕', name: 'Coffee',       qty: 2, price: 2.50 },
  { emoji: '🥧', name: 'Beef pie',     qty: 1, price: 2.50 },
  { emoji: '🥤', name: 'Mazoe 2L',     qty: 1, price: 3.20 },
  { emoji: '🌽', name: 'Mealie meal',  qty: 1, price: 8.00 },
]

const PIPELINE = [
  { icon: Wrench,     label: 'Build receipt',  hint: 'lines · taxes · payments' },
  { icon: Lock,       label: 'Sign locally',   hint: 'SHA-256 + ECDSA' },
  { icon: Cloud,      label: 'Submit to FDMS', hint: 'POST /submitReceipt' },
  { icon: BadgeCheck, label: 'ZIMRA stamped',  hint: 'QR + counter-signature' },
]

export default function PosPreview() {
  const subtotal = CART_PREVIEW.reduce((s, l) => s + l.qty * l.price, 0)

  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-white via-zim-sand-50 to-white py-20">
      {/* Soft brand halo */}
      <div className="pointer-events-none absolute inset-0 -z-10">
        <div className="absolute -left-24 top-1/4 size-96 rounded-full bg-zim-red-100 opacity-50 blur-3xl"/>
        <div className="absolute -right-24 bottom-0 size-96 rounded-full bg-zim-gold-100 opacity-50 blur-3xl"/>
      </div>

      <div className="container-page">
        <div className="mb-10 grid gap-6 md:grid-cols-[1.4fr_1fr] md:items-end">
          <div className="max-w-2xl">
            <span className="chip">See it in action</span>
            <h2 className="mt-3 text-3xl font-bold tracking-tight text-zim-ink-900 md:text-4xl">
              A real till. A real receipt. <span className="text-zim-red-700">A real ZIMRA signature.</span>
            </h2>
            <p className="mt-3 text-zim-ink-600 leading-relaxed">
              The sandbox lets you ring up a shift the way a cashier would — pick products, swipe a card,
              charge the customer. Behind the scenes you'll see the receipt get built, signed, submitted
              to FDMS and stamped, then printed with a verifiable QR code. No signup. No ZIMRA account.
            </p>
          </div>
          <div className="md:text-right">
            <Link to="/sandbox" className="btn-primary py-3 text-base">
              Open the live till <ArrowRight size={16}/>
            </Link>
          </div>
        </div>

        {/* Three-up POS visualisation */}
        <div className="grid gap-5 lg:grid-cols-[1fr_1fr_1fr]">
          {/* Till screen */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.45 }}
            className="overflow-hidden rounded-2xl bg-zim-ink-900 text-zim-ink-50 shadow-2xl ring-1 ring-zim-ink-700"
          >
            <div className="border-b border-zim-ink-700 bg-gradient-to-b from-zim-ink-900 to-zim-ink-800 px-5 py-4">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                  <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse"/> Till active
                </span>
                <span className="font-mono text-[10px] text-zim-ink-400">{CART_PREVIEW.length} items</span>
              </div>
              <div className="mt-2 flex items-end justify-between">
                <span className="text-xs font-semibold uppercase tracking-wider text-zim-ink-400">Total</span>
                <span className="text-3xl font-bold tabular-nums">${subtotal.toFixed(2)}</span>
              </div>
            </div>
            <ul className="space-y-2 px-5 py-4">
              {CART_PREVIEW.map((l) => (
                <li key={l.name} className="flex items-center gap-2.5 rounded-lg bg-zim-ink-800/60 px-3 py-2">
                  <span className="text-xl">{l.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <p className="truncate text-[12.5px] font-semibold">{l.name}</p>
                    <p className="text-[10px] text-zim-ink-400">${l.price.toFixed(2)} each · qty {l.qty}</p>
                  </div>
                  <p className="font-mono text-[12.5px] font-bold text-zim-gold-300">${(l.qty * l.price).toFixed(2)}</p>
                </li>
              ))}
            </ul>
            <div className="border-t border-zim-ink-700 px-5 py-3">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-zim-ink-400">Pay with</p>
              <div className="grid grid-cols-3 gap-2">
                {['💵 Cash', '📱 EcoCash', '💳 Card'].map((m, i) => (
                  <div key={m} className={[
                    'rounded-lg border px-2 py-1.5 text-center text-[10px] font-bold uppercase tracking-wider',
                    i === 1 ? 'border-zim-red-400 bg-zim-red-600/30 text-white' : 'border-zim-ink-700 text-zim-ink-300',
                  ].join(' ')}>
                    {m}
                  </div>
                ))}
              </div>
            </div>
            <div className="bg-gradient-to-b from-zim-ink-800 to-zim-ink-900 p-3">
              <div className="w-full rounded-lg bg-gradient-to-b from-emerald-500 to-emerald-600 px-4 py-3 text-center text-base font-bold text-white shadow-lg">
                Charge ${subtotal.toFixed(2)}
              </div>
            </div>
          </motion.div>

          {/* FDMS pipeline */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.5, delay: 0.1 }}
            className="card flex flex-col p-6"
          >
            <h3 className="text-sm font-bold uppercase tracking-wider text-zim-red-700">Behind the scenes</h3>
            <p className="mt-1 text-xs text-zim-ink-500">What zimFDMS does for every <span className="font-mono">Charge</span> click.</p>

            <ol className="mt-5 flex-1 space-y-1">
              {PIPELINE.map((s, i) => {
                const Icon = s.icon
                return (
                  <li key={s.label} className="relative flex items-start gap-3">
                    <div className="relative flex flex-col items-center">
                      <motion.div
                        animate={{ scale: [1, 1.18, 1], backgroundColor: ['#9C1C2A', '#10B981', '#9C1C2A'] }}
                        transition={{
                          duration: 4, repeat: Infinity, ease: 'easeInOut',
                          delay: i * 1.0,
                          times: [0, 0.25, 1],
                        }}
                        className="grid size-9 shrink-0 place-items-center rounded-full text-white shadow-md"
                      >
                        <Icon size={14}/>
                      </motion.div>
                      {i < PIPELINE.length - 1 && (
                        <div className="relative h-8 w-px overflow-hidden bg-zim-ink-200">
                          <motion.div
                            animate={{ y: ['-100%', '100%'] }}
                            transition={{ duration: 1.2, repeat: Infinity, ease: 'easeInOut', delay: i * 0.25 }}
                            className="absolute inset-x-0 h-6 bg-gradient-to-b from-transparent via-zim-red-500 to-transparent"
                          />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 pb-3">
                      <p className="text-sm font-semibold text-zim-ink-900">{s.label}</p>
                      <p className="text-xs text-zim-ink-500">{s.hint}</p>
                    </div>
                  </li>
                )
              })}
            </ol>

            <div className="mt-4 rounded-lg bg-emerald-50 px-3 py-2 text-[11px] text-emerald-800 ring-1 ring-emerald-100">
              <CheckCircle2 size={12} className="inline mr-1"/>
              Typical end-to-end time: <strong>~180ms</strong> per receipt.
            </div>
          </motion.div>

          {/* Fiscalised receipt */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-60px' }}
            transition={{ duration: 0.55, delay: 0.2 }}
            className="flex items-center justify-center"
          >
            <FiscalReceiptCard
              lines={CART_PREVIEW.map((l) => ({ name: l.name, qty: l.qty, price: l.price }))}
              invoiceNo="INV-00134"
              fiscalDayNo={142}
              receiptGlobalNo={4521}
              receiptCounter={17}
            />
          </motion.div>
        </div>
      </div>
    </section>
  )
}
