import { useEffect, useRef, useState } from 'react'
import { motion, useMotionValueEvent, useScroll, useTransform, type MotionValue } from 'framer-motion'
import { useStore } from '../store'
import { SCROLL_COPY, type BeatId } from '../data/stories'
import { isNarrow, storyKeys } from '../data/storyScroll'

// 一段文案：只在相机停在对应物件时出现（淡入 / 淡出由段进度驱动）；不可见时 inert，不进 Tab 顺序。
// 手表 / 鞋子的按钮打开故事面板；工牌段（career）的按钮打开联系面板。
function Beat({ id, progress, range }: { id: BeatId; progress: MotionValue<number>; range: number[] }) {
  const openStory = useStore((s) => s.openStory)
  const setContact = useStore((s) => s.setContact)
  const copy = SCROLL_COPY[id]
  const opacity = useTransform(progress, range, [0, 1, 1, 0])
  const y = useTransform(progress, range, [18, 0, 0, -18])
  const [active, setActive] = useState(false)
  useMotionValueEvent(opacity, 'change', (v) => setActive(v > 0.02))
  useEffect(() => setActive(opacity.get() > 0.02), [opacity])

  return (
    <motion.div
      className={`ss-beat is-${id}`}
      style={{ opacity, y }}
      aria-hidden={!active}
      {...((!active ? { inert: '' } : {}) as any)}
    >
      <span className="ss-label">{copy.label}</span>
      <h3 className="ss-title" id={`ss-title-${id}`}>
        {copy.title}
      </h3>
      <p className="ss-line">{copy.line}</p>
      <button
        type="button"
        className="ss-explore"
        aria-haspopup="dialog"
        aria-describedby={`ss-title-${id}`}
        onClick={() => (id === 'career' ? setContact(true) : openStory(id))}
      >
        {copy.cta ?? 'View story'} <span aria-hidden="true">→</span>
        {id === 'career' && <span className="ss-action-hint">Contact details</span>}
      </button>
    </motion.div>
  )
}

// 履历之后、作品之前的角色故事滚动段：本身只是一段透明滚动空间（高度见 data/storyScroll.ts），
// 相机叠加运动由 Scene.tsx 按同一进度计算；这里只放三段极简文案（fixed 层，随进度淡入淡出）。
export default function StoryScroll() {
  const ref = useRef<HTMLElement>(null)
  const [narrow, setNarrow] = useState(isNarrow)
  useEffect(() => {
    const onResize = () => setNarrow(isNarrow())
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])
  const { total, k } = storyKeys(narrow)
  // 与 Scene 相同的进度定义：段顶在视口底 → 0，段底在视口底 → 1
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'end end'] })
  const dim = useStore((s) => s.story !== null || s.contact) // 面板打开时文案让位

  // 文案在相机到达前的最后 40% 行程淡入、离开后的前 40% 行程淡出
  const win = (a: number, b: number, c: number, d: number) => [b - (b - a) * 0.4, b, c, c + (d - c) * 0.4]

  return (
    <section className="story-scroll" ref={ref} style={{ height: `${total}vh` }} aria-label="Personal details">
      <div className={`ss-layer${dim ? ' is-dim' : ''}`}>
        <Beat id="watch" progress={scrollYProgress} range={win(k[2], k[3], k[4], k[5])} />
        <Beat id="shoes" progress={scrollYProgress} range={win(k[4], k[5], k[6], k[7])} />
        <Beat id="career" progress={scrollYProgress} range={win(k[6], k[7], k[8], k[9])} />
      </div>
    </section>
  )
}
