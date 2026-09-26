import { useEffect, useRef } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { useStore } from '../store'
import { CONTACT } from '../data/stories'

const EASE = [0.22, 1, 0.36, 1]
const FOCUSABLE = 'button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'

// 联系面板：工牌段「Let’s Connect →」打开的小卡片（不是长篇故事面板）。
// 只列站内已有的联系方式；未提供的（href: null）显示为明显的占位行，不可点击。
// 外壳行为与 StoryPanel 一致：Esc / 背景 / ✕ 关闭，Tab 圈在面板内，锁页面滚动，关闭后焦点回到打开它的按钮。
export default function ContactPanel() {
  const open = useStore((s) => s.contact)
  const setContact = useStore((s) => s.setContact)
  const reduce = useReducedMotion() ?? false
  const panelRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const active = document.activeElement as HTMLElement | null
    const openerEl = active && active !== document.body ? active : null
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        setContact(false)
        return
      }
      if (e.key === 'Tab' && panelRef.current) {
        const items = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE))
        if (!items.length) return
        const first = items[0]
        const last = items[items.length - 1]
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first.focus()
        } else if (!panelRef.current.contains(document.activeElement)) {
          e.preventDefault()
          first.focus()
        }
      }
    }
    window.addEventListener('keydown', onKey)
    const t = window.setTimeout(() => panelRef.current?.querySelector<HTMLElement>('.story-close')?.focus(), 30)
    return () => {
      window.clearTimeout(t)
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
      // 文案层随面板关闭淡回（is-dim 过渡）→ 等按钮不再 inert 再把焦点还回去
      let tries = 0
      const back = () => {
        const ok = openerEl && openerEl.isConnected && !openerEl.closest('[inert]')
        if (ok) openerEl.focus({ preventScroll: true })
        else if (openerEl && tries++ < 20) window.setTimeout(back, 80)
      }
      back()
    }
  }, [open, setContact])

  const close = () => setContact(false)
  const offset = reduce ? {} : { y: 16 }

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="contact-backdrop"
            className="story-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            onClick={close}
          />
          <motion.div
            key="contact-panel"
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="contact-title"
            aria-describedby="contact-intro"
            className="contact-panel"
            initial={{ opacity: 0, ...offset }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, ...offset }}
            transition={{ duration: reduce ? 0.15 : 0.4, ease: EASE }}
          >
            <button type="button" className="story-close" onClick={close} aria-label="Close contact options">
              <span aria-hidden="true">✕</span>
            </button>
            <span className="ct-label">CAREER / 03</span>
            <h2 id="contact-title" className="ct-title">
              {CONTACT.title}
            </h2>
            <p id="contact-intro" className="ct-intro">
              {CONTACT.intro}
            </p>
            <ul className="ct-list">
              {CONTACT.links.map((l) => (
                <li key={l.label}>
                  {l.href ? (
                    <a className="ct-row" href={l.href} target="_blank" rel="noopener noreferrer">
                      <span className="ct-key">{l.label}</span>
                      <span className="ct-val">{l.value}</span>
                      <span className="ct-arrow" aria-hidden="true">
                        ↗
                      </span>
                    </a>
                  ) : (
                    <div className="ct-row is-placeholder" aria-label={`${l.label}: not provided yet`}>
                      <span className="ct-key">{l.label}</span>
                      <span className="ct-val">{l.value}</span>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
