/**
 * Product grid for the POS till. Click any tile to add it to the cart.
 */
import { motion } from 'framer-motion'

export const PRODUCTS = [
  { id: 'p1',  name: 'Coffee',         emoji: '☕', price: 2.50, taxID: 1, taxPercent: 15 },
  { id: 'p2',  name: 'Bread loaf',     emoji: '🍞', price: 1.80, taxID: 2, taxPercent: 0  },
  { id: 'p3',  name: 'Mazoe 2L',       emoji: '🥤', price: 3.20, taxID: 1, taxPercent: 15 },
  { id: 'p4',  name: 'Beef pie',       emoji: '🥧', price: 2.50, taxID: 1, taxPercent: 15 },
  { id: 'p5',  name: 'Milk 1L',        emoji: '🥛', price: 1.50, taxID: 2, taxPercent: 0  },
  { id: 'p6',  name: 'Sadza plate',    emoji: '🍛', price: 4.50, taxID: 1, taxPercent: 15 },
  { id: 'p7',  name: 'Newspaper',      emoji: '📰', price: 0.50, taxID: 3                  },
  { id: 'p8',  name: 'Airtime',        emoji: '📱', price: 5.00, taxID: 3                  },
  { id: 'p9',  name: 'Chocolate',      emoji: '🍫', price: 1.20, taxID: 1, taxPercent: 15 },
  { id: 'p10', name: 'Cooking oil',    emoji: '🛢️', price: 4.80, taxID: 1, taxPercent: 15 },
  { id: 'p11', name: 'Mealie meal',    emoji: '🌽', price: 8.00, taxID: 2, taxPercent: 0  },
  { id: 'p12', name: 'Sweet bun',      emoji: '🥯', price: 0.80, taxID: 1, taxPercent: 15 },
]

export default function PosProducts({ onPick, disabled }) {
  return (
    <div className="grid grid-cols-3 gap-2.5 sm:grid-cols-4">
      {PRODUCTS.map((p) => (
        <motion.button
          key={p.id}
          type="button"
          onClick={() => onPick(p)}
          disabled={disabled}
          whileTap={{ scale: 0.95 }}
          className="group flex flex-col items-center justify-between rounded-xl border border-zim-ink-200 bg-white p-3 text-center transition hover:border-zim-red-400 hover:bg-zim-red-50/30 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <span className="text-3xl">{p.emoji}</span>
          <span className="mt-1.5 text-[11.5px] font-semibold text-zim-ink-900 leading-tight">{p.name}</span>
          <div className="mt-1 flex items-center gap-1">
            <span className="text-[11px] font-bold text-zim-red-700">${p.price.toFixed(2)}</span>
            <TaxTag p={p}/>
          </div>
        </motion.button>
      ))}
    </div>
  )
}

function TaxTag({ p }) {
  if (p.taxID === 3) return <span className="rounded bg-zim-ink-100 px-1 py-px text-[8.5px] font-bold text-zim-ink-500">EX</span>
  if (p.taxPercent === 0) return <span className="rounded bg-emerald-100 px-1 py-px text-[8.5px] font-bold text-emerald-700">0%</span>
  return <span className="rounded bg-zim-gold-100 px-1 py-px text-[8.5px] font-bold text-zim-gold-700">15%</span>
}
