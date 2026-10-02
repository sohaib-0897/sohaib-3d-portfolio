import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion'
import { PROFILE } from '../data/profile'
import { lanyardEls } from '../scene/storyAnchors'

// A non-modal credential layer attached to the existing badge camera beat.
export default function LanyardCredentials() {
  const [open, setOpen] = useState(false)
  const [pinned, setPinned] = useState(false)
  const root = useRef<HTMLDivElement>(null)
  const trigger = useRef<HTMLButtonElement>(null)
  const reduce = useReducedMotion()
  const timer = useRef<number>()
  const cancelClose = () => window.clearTimeout(timer.current)
  const close = () => { cancelClose(); setOpen(false); setPinned(false) }
  const leave = () => {
    cancelClose()
    timer.current = window.setTimeout(() => {
      if (!pinned && !root.current?.contains(document.activeElement)) setOpen(false)
    }, 250)
  }

  useEffect(() => {
    const button = trigger.current
    lanyardEls.trigger = button
    const observer = new MutationObserver(() => {
      if (button?.dataset.visible !== '1') { setOpen(false); setPinned(false) }
    })
    if (button) observer.observe(button, { attributes: true, attributeFilter: ['data-visible'] })
    return () => { observer.disconnect(); window.clearTimeout(timer.current); lanyardEls.trigger = null }
  }, [])

  useEffect(() => {
    if (!open) return
    const dismiss = (event: PointerEvent) => {
      if (!root.current?.contains(event.target as Node)) {
        window.clearTimeout(timer.current)
        setOpen(false)
        setPinned(false)
      }
    }
    document.addEventListener('pointerdown', dismiss)
    return () => document.removeEventListener('pointerdown', dismiss)
  }, [open])

  return (
    <div ref={root} onPointerEnter={cancelClose} onPointerLeave={leave}
      onBlur={(event) => { if (!event.currentTarget.contains(event.relatedTarget)) close() }}
      onKeyDown={(event) => {
        if (event.key === 'Escape') { event.stopPropagation(); trigger.current?.focus(); close() }
      }}>
      <div className="story-hotspots">
        <button ref={trigger} type="button" className="story-hotspot is-lanyard" data-visible="0"
          aria-label="Lanyard certifications" aria-expanded={open} aria-controls="lanyard-credentials"
          onPointerEnter={(event) => { if (event.pointerType === 'mouse') { cancelClose(); setOpen(true) } }}
          onFocus={() => setOpen(true)}
          onClick={() => { if (pinned) close(); else { setPinned(true); setOpen(true) } }}>
          <span className="story-hotspot-dot" aria-hidden="true" />
          <span className="story-hotspot-label" aria-hidden="true">
            <span>{pinned ? 'Click to collapse' : 'Click to expand'}</span>
            <span>(certifications)</span>
          </span>
        </button>
      </div>
      <AnimatePresence>
        {open && <motion.aside id="lanyard-credentials" className="lanyard-credentials" aria-label="Lanyard certifications"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: reduce ? 0 : 0.2 }}>
          <button className="story-close" type="button" aria-label="Close certifications" onClick={() => { trigger.current?.focus(); close() }}>×</button>
          <p className="lanyard-identity">SOHAIB IMRAN</p>
          <p className="lanyard-role">Backend / Applied AI Engineer</p>
          <p className="lanyard-status">OPEN TO OPPORTUNITIES</p>
          <h3>Certifications</h3>
          <ul>{PROFILE.certifications.map((course) => <li key={course.name}>
            <strong>{course.name}</strong>
            <small>{course.provider} · {course.status.replace('Completed ', '')}</small>
            {course.certificate && <a className="about-link" href={course.certificate} target="_blank" rel="noopener noreferrer" aria-label={`Certificate: ${course.name}`}>Certificate ↗</a>}
          </li>)}</ul>
        </motion.aside>}
      </AnimatePresence>
    </div>
  )
}
