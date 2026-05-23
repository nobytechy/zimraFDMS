/**
 * Fixed-top scroll progress bar — fills left-to-right as the page scrolls.
 * Uses a Framer Motion spring so it feels smooth, not jittery.
 */
import { motion, useScroll, useSpring } from 'framer-motion'

export default function ScrollProgress() {
  const { scrollYProgress } = useScroll()
  const scaleX = useSpring(scrollYProgress, { stiffness: 120, damping: 30, restDelta: 0.001 })
  return (
    <motion.div
      aria-hidden="true"
      style={{ scaleX, transformOrigin: '0% 50%' }}
      className="fixed inset-x-0 top-0 z-[60] h-[3px] bg-gradient-to-r from-zim-red-700 via-zim-red-500 to-zim-gold-500 shadow-[0_0_12px_rgba(156,28,42,0.45)]"
    />
  )
}
