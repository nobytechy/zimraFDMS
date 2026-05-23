/**
 * "Behind the scenes" pipeline visualisation — what happens between
 * pressing Charge and the printed receipt landing in the customer's hand.
 *
 * 4 stages:
 *   1. Build  — receipt assembled locally
 *   2. Sign   — device private key signs the canonical concat
 *   3. Submit — POST to ZIMRA's Fiscal Device Gateway
 *   4. Stamp  — FDMS counter-signs, QR data returned
 *
 * Pass `activeStage` (0–4) — the matching node highlights and the connecting
 * arrow becomes a flowing dashed line.
 */
import { Wrench, Lock, Cloud, BadgeCheck } from 'lucide-react'
import { motion } from 'framer-motion'

const STAGES = [
  { icon: Wrench,     title: 'Build receipt',  hint: 'Lines, taxes, payments, total' },
  { icon: Lock,       title: 'Sign locally',   hint: 'SHA-256 + ECDSA' },
  { icon: Cloud,      title: 'Submit to ZIMRA', hint: 'POST /submitReceipt' },
  { icon: BadgeCheck, title: 'FDMS-stamped',   hint: 'QR + counter-signature' },
]

export default function FDMSPipeline({ activeStage = -1 }) {
  return (
    <div className="rounded-2xl border border-zim-ink-200 bg-white p-5">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold uppercase tracking-wider text-zim-red-700">Behind the scenes</h3>
        <span className="text-[10px] font-semibold uppercase tracking-wider text-zim-ink-500">FDMS pipeline</span>
      </div>
      <p className="mt-1 text-xs text-zim-ink-500">What zimFDMS does for every "Charge" click.</p>

      <ol className="mt-5 space-y-3">
        {STAGES.map((s, i) => {
          const Icon = s.icon
          const isActive = i === activeStage
          const isDone   = i < activeStage
          return (
            <li key={s.title} className="flex items-start gap-3">
              {/* Node + connecting line */}
              <div className="relative flex flex-col items-center">
                <motion.div
                  animate={{
                    scale: isActive ? [1, 1.15, 1] : 1,
                    backgroundColor: isDone ? '#10B981' : isActive ? '#9C1C2A' : '#E2E8F0',
                  }}
                  transition={{ duration: 0.6, repeat: isActive ? Infinity : 0 }}
                  className={[
                    'grid size-9 shrink-0 place-items-center rounded-full text-white shadow-sm',
                  ].join(' ')}
                >
                  <Icon size={14}/>
                </motion.div>
                {i < STAGES.length - 1 && (
                  <div className="relative my-1 h-7 w-px">
                    <div className="absolute inset-0 bg-zim-ink-200"/>
                    {(isActive || isDone) && (
                      <motion.div
                        initial={{ height: '0%' }}
                        animate={{ height: '100%' }}
                        transition={{ duration: 0.45, ease: 'easeOut' }}
                        className={[
                          'absolute inset-x-0 top-0 w-px',
                          isDone ? 'bg-emerald-500' : 'bg-zim-red-500',
                        ].join(' ')}
                      />
                    )}
                  </div>
                )}
              </div>

              {/* Label */}
              <div className="flex-1 pb-2">
                <p className={[
                  'text-sm font-semibold',
                  isDone ? 'text-emerald-700' : isActive ? 'text-zim-red-700' : 'text-zim-ink-900',
                ].join(' ')}>
                  {s.title}
                  {isActive && <span className="ml-2 text-[10px] font-normal text-zim-red-600 animate-pulse">running…</span>}
                  {isDone && <span className="ml-2 text-[10px] font-normal text-emerald-600">done</span>}
                </p>
                <p className="text-xs text-zim-ink-500">{s.hint}</p>
              </div>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
