/**
 * Animated "receipt flies out of the printer" toast.
 * Shows briefly after each successful sale.
 */
import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle2 } from 'lucide-react'

export default function PrintedReceiptToast({ show, ref: receiptRef, qrUrl }) {
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: -20, rotate: -3 }}
          animate={{ opacity: 1, y: 0, rotate: -2 }}
          exit={{ opacity: 0, y: 30, rotate: 4 }}
          className="pointer-events-none fixed left-1/2 top-24 z-30 -translate-x-1/2"
        >
          <div className="receipt-paper rounded-md border border-zim-ink-200 px-4 py-3 shadow-2xl" style={{ minWidth: 220, fontFamily: 'ui-monospace, Menlo, monospace' }}>
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-wider text-emerald-700">
              <CheckCircle2 size={11}/> FDMS Accepted
            </div>
            <p className="mt-1 text-[11px] text-zim-ink-700">Receipt <span className="font-bold text-zim-ink-900">{receiptRef}</span></p>
            <p className="mt-0.5 text-[10px] text-zim-ink-500 break-all">{qrUrl}</p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
