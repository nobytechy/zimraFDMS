/**
 * Drop-in wrapper that fades + slides children in as they enter the viewport.
 * Use it for one-off elements that aren't already wrapped in <motion.section>.
 *
 *   <FadeIn delay={0.1}><MyCard /></FadeIn>
 */
import { motion } from 'framer-motion'

export default function FadeIn({ children, delay = 0, y = 18, once = true, className = '' }) {
  return (
    <motion.div
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once, margin: '-60px' }}
      transition={{ duration: 0.55, ease: [0.22, 0.9, 0.32, 1], delay }}
      className={className}
    >
      {children}
    </motion.div>
  )
}
