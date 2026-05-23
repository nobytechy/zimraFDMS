/**
 * Animated 5-stage lifecycle ring.
 *
 *  - Curved arcs connect the 5 nodes in sequence.
 *  - Two flowing "data packets" continuously travel the ring (one fast, one slow)
 *    using a CSS rotate animation on wrapper divs offset radially.
 *  - The active stage (if `active` is passed) pulses softly.
 *  - Each node is a clickable button; click → onPick(stageId).
 *  - Respects prefers-reduced-motion (animation pauses).
 */
import { motion } from 'framer-motion'

const STAGES = [
  { id: 'register', label: '1. Register',  hint: 'Get device cert from ZIMRA', emoji: '🪪' },
  { id: 'open',     label: '2. Open Day',  hint: 'Start the fiscal day',       emoji: '🗓️' },
  { id: 'submit',   label: '3. Receipts',  hint: 'Sign + submit each sale',    emoji: '🧾' },
  { id: 'close',    label: '4. Close Day', hint: 'Reconcile + finalise',       emoji: '🔒' },
  { id: 'zreport',  label: '5. Z Report',  hint: 'ZIMRA-signed day summary',   emoji: '📋' },
]

export default function LifecycleCircle({ active, onPick, size = 460, compact = false }) {
  const cx = size / 2
  const cy = size / 2
  const r  = size / 2 - (compact ? 50 : 60)

  // For each adjacent pair, build an SVG arc path along the circle.
  // Sweep is clockwise (1). Using two arcs per leg lets us animate dasharray.
  const arcs = STAGES.map((_, i) => {
    const a1 = (i / STAGES.length) * 2 * Math.PI - Math.PI / 2
    const a2 = ((i + 1) / STAGES.length) * 2 * Math.PI - Math.PI / 2
    const x1 = cx + r * Math.cos(a1)
    const y1 = cy + r * Math.sin(a1)
    const x2 = cx + r * Math.cos(a2)
    const y2 = cy + r * Math.sin(a2)
    return `M ${x1} ${y1} A ${r} ${r} 0 0 1 ${x2} ${y2}`
  })

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="absolute inset-0" aria-hidden="true">
        <defs>
          <linearGradient id="lc-ring" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%"  stopColor="#9C1C2A" stopOpacity="0.85"/>
            <stop offset="100%" stopColor="#D89A00" stopOpacity="0.85"/>
          </linearGradient>
          <linearGradient id="lc-glow" cx="50%" cy="50%">
            <stop offset="0%"  stopColor="#9C1C2A" stopOpacity="0.18"/>
            <stop offset="100%" stopColor="#9C1C2A" stopOpacity="0"/>
          </linearGradient>
          <marker id="lc-arrow" viewBox="0 0 10 10" refX="6" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M0,0 L10,5 L0,10 Z" fill="#9C1C2A"/>
          </marker>
        </defs>

        {/* Soft outer halo */}
        <circle cx={cx} cy={cy} r={r + 28} fill="url(#lc-glow)"/>

        {/* Dashed guide ring (under) */}
        <circle cx={cx} cy={cy} r={r} fill="none" stroke="#FCDCDF" strokeWidth="1.5" strokeDasharray="2 8"/>

        {/* Gradient arcs that draw in on mount */}
        {arcs.map((d, i) => (
          <motion.path
            key={i}
            d={d}
            fill="none"
            stroke="url(#lc-ring)"
            strokeWidth="2.5"
            strokeLinecap="round"
            markerEnd="url(#lc-arrow)"
            initial={{ pathLength: 0, opacity: 0 }}
            animate={{ pathLength: 1, opacity: 1 }}
            transition={{ duration: 0.7, delay: 0.25 + i * 0.12, ease: 'easeOut' }}
          />
        ))}
      </svg>

      {/* Continuously orbiting data packets — pure CSS rotate on a wrapper */}
      <div className="absolute inset-0 lifecycle-orbit pointer-events-none" aria-hidden="true">
        <div className="absolute" style={{ top: cy - 8, left: cx - 8 }}>
          <div className="size-4 rounded-full bg-zim-red-500 shadow-[0_0_18px_rgba(156,28,42,0.55)]"
               style={{ transform: `translateX(${r}px)` }}/>
        </div>
      </div>
      <div className="absolute inset-0 lifecycle-orbit-fast pointer-events-none opacity-70" aria-hidden="true">
        <div className="absolute" style={{ top: cy - 5, left: cx - 5 }}>
          <div className="size-2.5 rounded-full bg-zim-gold-500"
               style={{ transform: `translateX(${r}px) rotate(140deg)` }}/>
        </div>
      </div>

      {/* Central caption */}
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center pointer-events-none">
        <span className="chip">FDMS lifecycle</span>
        <span className="mt-3 text-2xl font-bold tracking-tight text-zim-ink-900">5 stages</span>
        <span className="mt-1 max-w-[200px] text-xs text-zim-ink-500">click a stage to learn what it does</span>
      </div>

      {/* Stage nodes */}
      {STAGES.map((s, i) => {
        const angle = (i / STAGES.length) * 2 * Math.PI - Math.PI / 2
        const x = cx + r * Math.cos(angle)
        const y = cy + r * Math.sin(angle)
        const isActive = active === s.id
        return (
          <motion.button
            key={s.id}
            type="button"
            onClick={() => onPick?.(s.id)}
            initial={{ opacity: 0, scale: 0.7 }}
            animate={{
              opacity: 1, scale: 1,
              boxShadow: isActive
                ? ['0 0 0 0 rgba(156, 28, 42, 0)', '0 0 0 10px rgba(156, 28, 42, 0.18)', '0 0 0 0 rgba(156, 28, 42, 0)']
                : '0 1px 2px rgba(15, 23, 42, 0.05)',
            }}
            transition={{
              opacity: { delay: 0.15 + i * 0.08 },
              scale:   { delay: 0.15 + i * 0.08, type: 'spring', stiffness: 220, damping: 18 },
              boxShadow: isActive ? { duration: 2, repeat: Infinity, ease: 'easeInOut' } : { duration: 0.3 },
            }}
            className={[
              'absolute -translate-x-1/2 -translate-y-1/2 rounded-2xl border bg-white px-3 py-2.5 text-left transition',
              isActive
                ? 'border-zim-red-500 ring-2 ring-zim-red-500/30 z-10'
                : 'border-zim-ink-200 hover:border-zim-red-400',
            ].join(' ')}
            style={{ left: x, top: y, width: compact ? 116 : 138 }}
          >
            <div className="flex items-center gap-2">
              <span className="text-base">{s.emoji}</span>
              <span className="text-[11.5px] font-bold text-zim-ink-900">{s.label}</span>
            </div>
            <p className="mt-0.5 text-[10.5px] leading-snug text-zim-ink-500">{s.hint}</p>
          </motion.button>
        )
      })}
    </div>
  )
}

export { STAGES }
