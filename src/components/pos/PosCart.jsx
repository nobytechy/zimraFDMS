/**
 * Cart list, totals and payment-method selection. The "Charge" button
 * fires onCheckout(payments) → the parent triggers FDMS fiscalisation.
 */
import { Plus, Minus, Trash2, Receipt } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

const PAY_METHODS = [
  { id: 'Cash',         label: 'Cash',     emoji: '💵' },
  { id: 'MobileWallet', label: 'EcoCash',  emoji: '📱' },
  { id: 'Card',         label: 'Card',     emoji: '💳' },
]

export default function PosCart({ cart, onIncrement, onDecrement, onRemove, onClear, onCheckout, onOpenTill, dayOpen, payMethod, setPayMethod, busy }) {
  const subtotal = cart.reduce((s, l) => s + l.qty * l.price, 0)
  const taxableLines = cart.filter((l) => l.taxPercent && l.taxPercent > 0)
  const taxAmount    = taxableLines.reduce((s, l) => s + (l.qty * l.price * l.taxPercent / (100 + l.taxPercent)), 0)
  const netTotal     = subtotal - taxAmount

  return (
    <div className="flex h-full flex-col rounded-2xl bg-zim-ink-900 text-zim-ink-50 shadow-2xl ring-1 ring-zim-ink-700">
      {/* Header — "screen" */}
      <div className="border-b border-zim-ink-700 bg-gradient-to-b from-zim-ink-900 to-zim-ink-800 px-5 py-4">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-emerald-400">
            <span className="size-1.5 rounded-full bg-emerald-400 animate-pulse"/> Till active
          </span>
          <span className="font-mono text-[10px] text-zim-ink-400">cart {cart.length} item{cart.length === 1 ? '' : 's'}</span>
        </div>
        <div className="mt-2 flex items-end justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-zim-ink-400">Total</span>
          <span className="text-3xl font-bold tabular-nums">${subtotal.toFixed(2)}</span>
        </div>
      </div>

      {/* Line items */}
      <div className="flex-1 overflow-y-auto px-5 py-4">
        {cart.length === 0 ? (
          <div className="grid h-full place-items-center text-center">
            <div>
              <Receipt size={32} className="mx-auto text-zim-ink-700"/>
              <p className="mt-2 text-sm text-zim-ink-400">Pick a product to start the sale</p>
            </div>
          </div>
        ) : (
          <ul className="space-y-2.5">
            <AnimatePresence initial={false}>
              {cart.map((l) => (
                <motion.li
                  key={l.id}
                  layout
                  initial={{ opacity: 0, x: 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -12 }}
                  className="flex items-center gap-2.5 rounded-lg bg-zim-ink-800/60 px-3 py-2"
                >
                  <span className="text-xl shrink-0">{l.emoji}</span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[12.5px] font-semibold text-zim-ink-50">{l.name}</p>
                    <p className="text-[10px] text-zim-ink-400">${l.price.toFixed(2)} each</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <button onClick={() => onDecrement(l.id)} className="grid size-6 place-items-center rounded bg-zim-ink-700 text-zim-ink-200 hover:bg-zim-red-700">
                      <Minus size={11}/>
                    </button>
                    <span className="w-6 text-center font-mono text-sm text-zim-ink-50">{l.qty}</span>
                    <button onClick={() => onIncrement(l.id)} className="grid size-6 place-items-center rounded bg-zim-ink-700 text-zim-ink-200 hover:bg-emerald-700">
                      <Plus size={11}/>
                    </button>
                  </div>
                  <div className="w-16 text-right">
                    <p className="font-mono text-[12.5px] font-bold text-zim-gold-300">${(l.qty * l.price).toFixed(2)}</p>
                  </div>
                  <button onClick={() => onRemove(l.id)} className="ml-1 text-zim-ink-500 hover:text-zim-red-400">
                    <Trash2 size={13}/>
                  </button>
                </motion.li>
              ))}
            </AnimatePresence>
          </ul>
        )}
      </div>

      {/* Totals breakdown */}
      {cart.length > 0 && (
        <div className="border-t border-zim-ink-700 px-5 py-3 space-y-1 text-xs">
          <Row k="Net total" v={netTotal} />
          <Row k="VAT 15%"   v={taxAmount} accent />
          <Row k="Subtotal"  v={subtotal}   bold />
        </div>
      )}

      {/* Payment method */}
      <div className="border-t border-zim-ink-700 px-5 py-3">
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-zim-ink-400">Pay with</p>
        <div className="grid grid-cols-3 gap-2">
          {PAY_METHODS.map((m) => (
            <button
              key={m.id}
              onClick={() => setPayMethod(m.id)}
              className={[
                'rounded-lg border px-2 py-2 text-center transition',
                payMethod === m.id ? 'border-zim-red-400 bg-zim-red-600/30 text-white' : 'border-zim-ink-700 bg-zim-ink-800/40 text-zim-ink-300 hover:border-zim-ink-500',
              ].join(' ')}
            >
              <span className="block text-lg">{m.emoji}</span>
              <span className="block text-[10px] font-bold uppercase tracking-wider">{m.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Charge button — morphs into "Open the till" when the day is closed */}
      <div className="border-t border-zim-ink-700 bg-gradient-to-b from-zim-ink-800 to-zim-ink-900 p-3">
        {!dayOpen ? (
          <button
            onClick={onOpenTill}
            disabled={busy}
            className="w-full rounded-lg bg-gradient-to-b from-zim-red-500 to-zim-red-700 px-4 py-3 text-base font-bold text-white shadow-lg transition hover:from-zim-red-600 hover:to-zim-red-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            🔓  {busy ? 'Opening till…' : 'Open the till to start'}
          </button>
        ) : (
          <button
            onClick={() => onCheckout(payMethod)}
            disabled={cart.length === 0 || busy}
            className="w-full rounded-lg bg-gradient-to-b from-emerald-500 to-emerald-600 px-4 py-3 text-base font-bold text-white shadow-lg transition hover:from-emerald-600 hover:to-emerald-700 disabled:cursor-not-allowed disabled:opacity-40"
          >
            {busy ? 'Fiscalising…' : cart.length === 0 ? 'Pick a product to ring up' : `Charge $${subtotal.toFixed(2)}`}
          </button>
        )}
        {cart.length > 0 && (
          <button onClick={onClear} className="mt-2 w-full text-[10px] uppercase tracking-wider text-zim-ink-400 hover:text-zim-ink-200">
            Clear cart
          </button>
        )}
      </div>
    </div>
  )
}

function Row({ k, v, accent, bold }) {
  return (
    <div className="flex items-center justify-between">
      <span className={bold ? 'font-semibold text-zim-ink-100' : 'text-zim-ink-400'}>{k}</span>
      <span className={[
        'font-mono tabular-nums',
        bold ? 'text-base font-bold text-zim-gold-300' : accent ? 'text-zim-gold-400' : 'text-zim-ink-200',
      ].join(' ')}>${Number(v).toFixed(2)}</span>
    </div>
  )
}
