import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { useStore } from '../store'
import { WATCH_STORY, MARVEL_STORY, type StoryId } from '../data/stories'
import { hotspotEls } from '../scene/storyAnchors'

const EASE = [0.22, 1, 0.36, 1]
const FOCUSABLE = 'button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])'

// 手表：六个阶段的纵向时间轴。当前（G-Shock）与未来愿景明确区分；方向键 / Home / End 切换阶段。
function WatchStory({ reduce }: { reduce: boolean }) {
  const stages = WATCH_STORY.stages
  const n = stages.length
  const [i, setI] = useState(0)
  const listRef = useRef<HTMLOListElement>(null)

  const go = (k: number, focus = true) => {
    const j = Math.max(0, Math.min(n - 1, k))
    setI(j)
    if (focus) listRef.current?.querySelectorAll<HTMLButtonElement>('.wt-stage')[j]?.focus()
  }
  const onKey = (e: ReactKeyboardEvent) => {
    const map: Record<string, number> = { ArrowDown: i + 1, ArrowRight: i + 1, ArrowUp: i - 1, ArrowLeft: i - 1, Home: 0, End: n - 1 }
    if (e.key in map) {
      e.preventDefault()
      go(map[e.key])
    }
  }

  return (
    <div className="wt">
      <h2 id="story-title-watch" className="story-title">
        {WATCH_STORY.title}
      </h2>
      <p className="story-intro">{WATCH_STORY.intro}</p>

      <div className="wt-timeline">
        <div className="wt-rail" aria-hidden="true">
          <motion.div
            className="wt-rail-fill"
            initial={false}
            animate={{ scaleY: i / (n - 1) }}
            transition={{ duration: reduce ? 0 : 0.6, ease: EASE }}
          />
        </div>
        <ol className="wt-list" ref={listRef} onKeyDown={onKey}>
          {stages.map((s, k) => {
            const state = k === i ? 'is-active' : k < i ? 'is-past' : 'is-future'
            return (
              <motion.li
                key={s.watch}
                className={`wt-item ${state}${s.current ? ' is-current' : ''}`}
                initial={reduce ? false : { opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, ease: EASE, delay: reduce ? 0 : 0.15 + k * 0.08 }}
              >
                <button
                  type="button"
                  className="wt-stage"
                  aria-current={k === i ? 'step' : undefined}
                  aria-expanded={k === i}
                  tabIndex={k === i ? 0 : -1}
                  onClick={() => go(k, false)}
                >
                  <span className="wt-dot" aria-hidden="true" />
                  <span className="wt-meta">
                    <span className="wt-stage-label">{s.stage}</span>
                    {s.current ? (
                      <span className="wt-tag is-now">{WATCH_STORY.currentTag}</span>
                    ) : (
                      k === i && <span className="wt-tag">{WATCH_STORY.futureTag}</span>
                    )}
                  </span>
                  <span className="wt-watch">{s.watch}</span>
                  <span className="wt-stage-action">{k === i ? 'Expanded' : 'Click to expand'}</span>
                </button>
                {/* 纯 CSS 展开（grid-rows 0fr→1fr）：不嵌套 AnimatePresence，避免拖住面板的退出动画 */}
                <div className="wt-detail" aria-hidden={k !== i} {...((k !== i ? { inert: '' } : {}) as any)}>
                  <div className="wt-detail-inner">
                    <p className="wt-headline">{s.headline}</p>
                    <p className="wt-body">{s.body}</p>
                  </div>
                </div>
              </motion.li>
            )
          })}
        </ol>
      </div>

      <div className="wt-nav">
        <button type="button" onClick={() => go(i - 1, false)} disabled={i === 0}>
          <span aria-hidden="true">←</span> Previous
        </button>
        <span className="wt-count" aria-live="polite">
          {String(i + 1).padStart(2, '0')} / {String(n).padStart(2, '0')}
        </span>
        <button type="button" onClick={() => go(i + 1, false)} disabled={i === n - 1}>
          Next <span aria-hidden="true">→</span>
        </button>
      </div>
    </div>
  )
}

// 鞋子：更有电影感但克制——暗底、极淡的红 / 蓝光、细网格与 HUD 角标；无任何官方标识或影视素材。
function MarvelStory({ reduce }: { reduce: boolean }) {
  const reveal = (k: number) => ({
    initial: reduce ? false : { opacity: 0, y: 12 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.7, ease: EASE, delay: reduce ? 0 : 0.2 + k * 0.18 },
  })
  return (
    <div className="mv">
      <span className="mv-corner tl" aria-hidden="true" />
      <span className="mv-corner tr" aria-hidden="true" />
      <span className="mv-corner bl" aria-hidden="true" />
      <span className="mv-corner br" aria-hidden="true" />
      <h2 id="story-title-shoes" className="story-title mv-title">
        {MARVEL_STORY.title}
      </h2>
      <span className="mv-rule" aria-hidden="true" />
      {MARVEL_STORY.paragraphs.map((p, k) => (
        <motion.p key={k} className={`mv-p${k === 0 ? ' is-lead' : ''}`} {...(reveal(k) as any)}>
          {p}
        </motion.p>
      ))}
      <motion.ol className="mv-path" aria-label="From curiosity to projects" {...(reveal(MARVEL_STORY.paragraphs.length) as any)}>
        {MARVEL_STORY.path.map((s, k) => (
          <li key={s} className={`mv-step s${k + 1}`}>
            <span className="mv-step-no">{String(k + 1).padStart(2, '0')}</span>
            <span className="mv-step-text">{s}</span>
          </li>
        ))}
      </motion.ol>
    </div>
  )
}

// 对话框外壳：背景点击 / Esc / 关闭按钮关闭；Tab 焦点圈在面板内；打开时锁页面滚动；关闭后焦点回到热点。
export default function StoryPanel() {
  const story = useStore((s) => s.story)
  const setStory = useStore((s) => s.setStory)
  const reduce = useReducedMotion() ?? false
  const panelRef = useRef<HTMLDivElement>(null)
  const [narrow, setNarrow] = useState(false)

  useEffect(() => {
    if (!story) return
    const opener = story
    // 打开来源：热点或滚动文案里的 Explore（Safari 点击按钮不聚焦 → 回退到热点）
    const active = document.activeElement as HTMLElement | null
    const openerEl = active && active !== document.body && !panelRef.current?.contains(active) ? active : null
    setNarrow(window.innerWidth <= 640)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        setStory(null)
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
    // 初始焦点：面板里第一个可交互项（关闭按钮之后的内容由 Tab 进入）
    const t = window.setTimeout(() => panelRef.current?.querySelector<HTMLElement>('.story-close')?.focus(), 30)
    return () => {
      window.clearTimeout(t)
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
      // 关闭后镜头缓回，热点稍后才重新出现 → 轮询到可见再把焦点还回去
      let tries = 0
      const back = () => {
        const el = openerEl && openerEl.isConnected ? openerEl : hotspotEls[opener as StoryId]
        const shown = el && getComputedStyle(el).visibility === 'visible' && !el.closest('[inert]')
        if (el && shown) el.focus({ preventScroll: true })
        else if (tries++ < 40) window.setTimeout(back, 80)
      }
      back()
    }
  }, [story, setStory])

  const close = () => setStory(null)
  const offset = reduce ? {} : narrow ? { y: 60 } : { x: 48 }

  return (
    <AnimatePresence>
      {story && (
        <>
          <motion.div
            key="story-backdrop"
            className="story-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.35 }}
            onClick={close}
          />
          <motion.div
            key={`story-${story}`}
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={`story-title-${story}`}
            className={`story-panel is-${story}`}
            initial={{ opacity: 0, ...offset }}
            animate={{ opacity: 1, x: 0, y: 0 }}
            exit={{ opacity: 0, ...offset }}
            transition={{ duration: reduce ? 0.15 : 0.55, ease: EASE }}
          >
            <button type="button" className="story-close" onClick={close} aria-label="Close story">
              <span aria-hidden="true">✕</span>
            </button>
            {story === 'watch' ? <WatchStory reduce={reduce} /> : <MarvelStory reduce={reduce} />}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
