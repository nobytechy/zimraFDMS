/**
 * "Submit a test receipt" — modal a merchant uses to ring up a sale against
 * their real Supabase data.
 */
import { useState } from 'react'
import { motion } from 'framer-motion'
import { X, Loader2, Plus, Minus, Trash2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { submitReceipt } from '@/lib/fdms/merchantService'
import { PRODUCTS } from '@/components/pos/PosProducts'
import { cn } from '@/lib/utils'

const PAY = [
  { id: 'Cash',         label: 'Cash',     emoji: '💵' },
  { id: 'MobileWallet', label: 'EcoCash',  emoji: '📱' },
  { id: 'Card',         label: 'Card',     emoji: '💳' },
]

export default function SubmitReceiptModal({ open, onClose, merchantId, fiscalDay, onDone }) {
  const [cart, setCart] = useState([])
  const [pay, setPay] = useState('Cash')
  const [busy, setBusy] = useState(false)
  if (!open) return null

  const subtotal = cart.reduce((s, l) => s + l.qty * l.price, 0)

  const add = (p) => setCart((c) => {
    const ex = c.find((l) => l.id === p.id)
    if (ex) return c.map((l) => l.id === p.id ? { ...l, qty: l.qty + 1 } : l)
    return [...c, { ...p, qty: 1 }]
  })
  const inc    = (id) => setCart((c) => c.map((l) => l.id === id ? { ...l, qty: l.qty + 1 } : l))
  const dec    = (id) => setCart((c) => c.map((l) => l.id === id ? { ...l, qty: Math.max(1, l.qty - 1) } : l))
  const remove = (id) => setCart((c) => c.filter((l) => l.id !== id))

  const handleSubmit = async () => {
    if (!cart.length) return
    setBusy(true)
    const { data, error } = await submitReceipt({
      merchantId,
      fiscalDay,
      cart,
      paymentMethod: pay,
      deviceConfig: { deviceID: 1042 },
    })
    setBusy(false)
    if (error) { toast.error(error.message); return }
    toast.success(`Receipt ${data.invoice_no} fiscalised`)
    onDone?.(data)
    setCart([])
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-zim-ink-900/70 p-4 backdrop-blur-sm">
      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        className="relative w-full max-w-3xl overflow-hidden rounded-2xl bg-white shadow-2xl"
      >
        <div className="flex items-center justify-between border-b border-zim-ink-200 px-6 py-4">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-zim-red-700">Test receipt</p>
            <h2 className="mt-0.5 text-xl font-bold text-zim-ink-900">Ring up a sale</h2>
          </div>
          <button onClick={onClose} className="rounded-md p-1.5 text-zim-ink-500 hover:bg-zim-ink-100">
            <X size={18}/>
          </button>
        </div>

        <div className="grid gap-4 px-6 py-5 lg:grid-cols-[1fr_280px]">
          {/* Product grid */}
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-zim-ink-600">Tap to add</p>
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {PRODUCTS.map((p) => (
                <button key={p.id} onClick={() => add(p)} disabled={busy}
                  className="rounded-lg border border-zim-ink-200 bg-white p-3 text-center transition hover:border-zim-red-400 hover:bg-zim-red-50/30">
                  <div className="text-2xl">{p.emoji}</div>
                  <div className="mt-1 text-[11px] font-semibold text-zim-ink-900">{p.name}</div>
                  <div className="text-[11px] font-bold text-zim-red-700">${p.price.toFixed(2)}</div>
                </button>
              ))}
            </div>
          </div>

          {/* Cart */}
          <div className="rounded-xl bg-zim-ink-900 text-zim-ink-50 p-4">
            <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-zim-ink-400">Cart · {cart.length}</p>
            {cart.length === 0 ? (
              <p className="py-6 text-center text-xs text-zim-ink-500">Pick a product to start</p>
            ) : (
              <ul className="space-y-1.5 max-h-56 overflow-y-auto">
                {cart.map((l) => (
                  <li key={l.id} className="flex items-center gap-2 rounded bg-zim-ink-800/60 px-2 py-1.5 text-xs">
                    <span className="text-base">{l.emoji}</span>
                    <span className="flex-1 truncate font-medium">{l.name}</span>
                    <button onClick={() => dec(l.id)} className="grid size-5 place-items-center rounded bg-zim-ink-700 hover:bg-zim-red-700"><Minus size={10}/></button>
                    <span className="w-5 text-center">{l.qty}</span>
                    <button onClick={() => inc(l.id)} className="grid size-5 place-items-center rounded bg-zim-ink-700 hover:bg-emerald-700"><Plus size={10}/></button>
                    <span className="w-12 text-right font-mono font-bold text-zim-gold-300">${(l.qty * l.price).toFixed(2)}</span>
                    <button onClick={() => remove(l.id)} className="text-zim-ink-500 hover:text-zim-red-400"><Trash2 size={10}/></button>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-3 flex items-end justify-between border-t border-zim-ink-700 pt-3">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-zim-ink-400">Total</span>
              <span className="text-xl font-bold tabular-nums">${subtotal.toFixed(2)}</span>
            </div>

            <p className="mt-3 mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-zim-ink-400">Pay with</p>
            <div className="grid grid-cols-3 gap-1.5">
              {PAY.map((m) => (
                <button key={m.id} onClick={() => setPay(m.id)}
                  className={cn(
                    'rounded border px-2 py-1.5 text-center text-[10px] font-bold uppercase tracking-wider',
                    pay === m.id ? 'border-zim-red-400 bg-zim-red-600/30 text-white' : 'border-zim-ink-700 bg-zim-ink-800/40 text-zim-ink-300',
                  )}>
                  <div className="text-base">{m.emoji}</div>
                  {m.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3 border-t border-zim-ink-200 bg-zim-ink-50 px-6 py-3">
          <p className="text-xs text-zim-ink-500">Receipt will be signed locally + persisted to your Supabase.</p>
          <button onClick={handleSubmit} disabled={busy || cart.length === 0}
            className="btn-primary py-3 text-base">
            {busy ? <><Loader2 size={14} className="animate-spin"/> Fiscalising…</> : <>Charge ${subtotal.toFixed(2)}</>}
          </button>
        </div>
      </motion.div>
    </div>
  )
}
