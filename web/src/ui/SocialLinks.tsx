import { useState } from 'react'
import { motion, useMotionValueEvent, type MotionValue } from 'framer-motion'
import { CONTACT } from '../data/stories'

export default function SocialLinks({ opacity }: { opacity: MotionValue<number> }) {
  const [visible, setVisible] = useState(opacity.get() > 0.05)
  useMotionValueEvent(opacity, 'change', (value) => setVisible(value > 0.05))

  return (
    <motion.nav className="hero-socials" aria-label="Social profiles" style={{ opacity, visibility: visible ? 'visible' : 'hidden' }}>
      {CONTACT.links.filter((link) => link.label === 'LinkedIn' || link.label === 'GitHub').map((link) => (
        <a key={link.label} href={link.href!} target="_blank" rel="noopener noreferrer">
          <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
            {link.label === 'LinkedIn' ? <>
              <rect x="2" y="2" width="20" height="20" rx="2" fill="currentColor" />
              <circle cx="7" cy="7" r="1.4" fill="#0a0e16" />
              <path d="M5.8 10h2.4v8H5.8zm4.5 0h2.3v1.1c.7-1 1.6-1.4 2.8-1.4 2.2 0 3.2 1.4 3.2 3.8V18h-2.4v-4.1c0-1.3-.4-2-1.5-2-1.3 0-1.9.9-1.9 2.2V18h-2.5z" fill="#0a0e16" />
            </> : <path fill="currentColor" d="M12 .8a11.2 11.2 0 0 0-3.54 21.83c.56.1.77-.24.77-.54v-2.08c-3.13.68-3.79-1.33-3.79-1.33-.51-1.3-1.25-1.65-1.25-1.65-1.02-.7.08-.68.08-.68 1.13.08 1.72 1.15 1.72 1.15 1 1.71 2.63 1.22 3.27.93.1-.72.39-1.22.71-1.5-2.5-.29-5.13-1.25-5.13-5.57 0-1.23.44-2.24 1.15-3.03-.11-.28-.5-1.43.11-2.99 0 0 .94-.3 3.08 1.15a10.7 10.7 0 0 1 5.62 0c2.14-1.45 3.08-1.15 3.08-1.15.61 1.56.23 2.71.11 2.99.72.79 1.15 1.8 1.15 3.03 0 4.33-2.64 5.28-5.15 5.56.41.35.76 1.04.76 2.1v3.07c0 .3.2.65.77.54A11.2 11.2 0 0 0 12 .8Z" />}
          </svg>
          <span>{link.label}</span>
        </a>
      ))}
    </motion.nav>
  )
}
