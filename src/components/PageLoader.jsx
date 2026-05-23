/**
 * Initial-mount loader — 5 bouncing bubbles with the brand gradient + logo.
 * Mounts at the App root, shows for ~700 ms on first load, then fades out.
 */
import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import Logo from '@/components/Logo'

export default function PageLoader({ minDuration = 700 }) {
  const [show, setShow] = useState(true)

  useEffect(() => {
    const t = setTimeout(() => setShow(false), minDuration)
    return () => clearTimeout(t)
  }, [minDuration])

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          key="page-loader"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.45, ease: 'easeOut' } }}
          className="fixed inset-0 z-[200] grid place-items-center bg-gradient-to-br from-zim-sand-50 via-white to-zim-sand-100"
        >
          {/* Soft brand halos */}
          <div className="pointer-events-none absolute inset-0 -z-10">
            <div className="absolute -left-24 top-1/4 size-96 rounded-full bg-zim-red-100/70 blur-3xl"/>
            <div className="absolute -right-24 bottom-1/4 size-96 rounded-full bg-zim-gold-100/70 blur-3xl"/>
          </div>

          <div className="flex flex-col items-center gap-7">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
            >
              <Logo size={36} />
            </motion.div>

            {/* Bouncing bubbles */}
            <div className="flex items-end gap-2.5">
              {[0, 1, 2, 3, 4].map((i) => (
                <motion.span
                  key={i}
                  className="block size-3 rounded-full"
                  style={{
                    background: 'linear-gradient(135deg, #9C1C2A 0%, #D89A00 100%)',
                    boxShadow: '0 6px 14px -4px rgba(156, 28, 42, 0.4)',
                  }}
                  animate={{ y: [0, -18, 0], opacity: [0.7, 1, 0.7] }}
                  transition={{
                    duration: 1.1,
                    repeat: Infinity,
                    ease: 'easeInOut',
                    delay: i * 0.12,
                  }}
                />
              ))}
            </div>

            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.2 }}
              className="text-[11px] font-semibold uppercase tracking-[0.3em] text-zim-ink-500"
            >
              Loading zimFDMS
            </motion.p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
