/**
 * Floating "back to top" button. Fades in after the user scrolls past 400px.
 * The chevron inside bobs continuously to draw the eye.
 */
import { useEffect, useState } from 'react'
import { ChevronUp } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

export default function BackToTop() {
  const [show, setShow] = useState(false)
  useEffect(() => {
    const onScroll = () => setShow(window.scrollY > 400)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <AnimatePresence>
      {show && (
        <motion.button
          key="b2t"
          type="button"
          onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
          initial={{ opacity: 0, scale: 0.6, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.6, y: 12 }}
          whileHover={{ scale: 1.08 }}
          whileTap={{ scale: 0.94 }}
          transition={{ type: 'spring', stiffness: 280, damping: 22 }}
          aria-label="Back to top"
          className="fixed bottom-6 right-6 z-40 grid size-12 place-items-center rounded-full bg-gradient-to-br from-zim-red-600 to-zim-red-800 text-white shadow-xl ring-2 ring-zim-red-500/25 hover:from-zim-red-700 hover:to-zim-red-900 focus:outline-none focus:ring-4 focus:ring-zim-red-500/40"
        >
          {/* Pulsing halo */}
          <span className="absolute inset-0 -z-10 animate-ping rounded-full bg-zim-red-500/30"/>
          <motion.span
            animate={{ y: [-2, 2, -2] }}
            transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
          >
            <ChevronUp size={20} strokeWidth={2.5}/>
          </motion.span>
        </motion.button>
      )}
    </AnimatePresence>
  )
}
