/**
 * Tiny dependency-free bar chart — receipts per day for the last 14 days.
 * Animates in on mount. No recharts / chart.js needed.
 */
import { motion } from 'framer-motion'

export default function DailyReceiptsChart({ series, height = 110 }) {
  const max = Math.max(1, ...series.map((s) => s.receipt_count))
  return (
    <div>
      <div className="flex items-end gap-1.5" style={{ height }}>
        {series.map((s, i) => {
          const h = Math.max(2, (s.receipt_count / max) * (height - 18))
          const day = new Date(s.day + 'T00:00:00')
          const label = day.toLocaleDateString('en-US', { weekday: 'short' })[0]
          const isToday = i === series.length - 1
          return (
            <motion.div
              key={s.day}
              initial={{ height: 2, opacity: 0.4 }}
              animate={{ height: h, opacity: 1 }}
              transition={{ duration: 0.45, delay: i * 0.03 }}
              title={`${s.day}: ${s.receipt_count} receipt${s.receipt_count === 1 ? '' : 's'} · $${s.gross_total.toFixed(2)}`}
              className={[
                'flex-1 rounded-t-md min-w-[6px] relative group',
                isToday ? 'bg-zim-red-600' : s.receipt_count > 0 ? 'bg-zim-red-300' : 'bg-zim-ink-100',
              ].join(' ')}
            />
          )
        })}
      </div>
      <div className="mt-2 flex items-end gap-1.5">
        {series.map((s, i) => {
          const day = new Date(s.day + 'T00:00:00')
          return (
            <span key={s.day} className="flex-1 text-center text-[9px] font-medium uppercase text-zim-ink-400">
              {day.toLocaleDateString('en-US', { weekday: 'short' })[0]}
            </span>
          )
        })}
      </div>
    </div>
  )
}
