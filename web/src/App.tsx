import { Suspense, useEffect, useRef, useState } from 'react'
import { Canvas } from '@react-three/fiber'
import { motion, useMotionValue, useScroll, useTransform, type MotionValue } from 'framer-motion'
import * as THREE from 'three'
import Scene from './scene/Scene'
import NoiseOverlay from './ui/NoiseOverlay'
import Resume from './ui/Resume'
import Works from './ui/Works'
import LoadingScreen from './ui/LoadingScreen'
import StoryHotspots from './ui/StoryHotspots'
import StoryPanel from './ui/StoryPanel'
import StoryScroll from './ui/StoryScroll'
import ContactPanel from './ui/ContactPanel'
import LanyardCredentials from './ui/LanyardCredentials'
import SocialLinks from './ui/SocialLinks'
import { useStore } from './store'

function Backdrop() {
  // 点击空白处收起详情
  const setActive = useStore((s) => s.setActive)
  return (
    <mesh position={[0, 0, -40]} onClick={() => setActive(null)}>
      <planeGeometry args={[600, 300]} />
      <meshBasicMaterial transparent opacity={0} depthWrite={false} />
    </mesh>
  )
}

type Lang = 'en' | 'zh'

const COPY_EN = {
  title: 'SOHAIB IMRAN',
  role: 'Software Engineer · Backend & Applied AI Systems',
  paragraphs: [
    'I build Python/FastAPI backends for ML workloads, real-time vision, hybrid retrieval, and distributed workers — from performance optimization to production APIs and deployment.',
  ],
}
// English-only site: zh reuses the English copy (the language toggle is hidden).
const COPY: Record<Lang, typeof COPY_EN> = { en: COPY_EN, zh: COPY_EN }

function Hero({ lang, cueOpacity }: { lang: Lang; cueOpacity: MotionValue<number> }) {
  const { title, role, paragraphs } = COPY[lang]
  const aboutRef = useRef(null)
  // 触发起点提前：about 顶部位于视口 60% 处即开始（offset[0] 进度 0），到达顶部为进度 1
  const { scrollYProgress } = useScroll({
    target: aboutRef,
    offset: ['start 0.6', 'start start'],
  })
  // 透明度在 about 顶部升到约 30vh 时归 0：起点 60%→进度 p 时顶部在 0.6×(1−p)，
  // 令 =0.3 解得 p=0.5，故 opacity 区间 [0, 0.5]。
  // 矮视口（如 1280×720）里 about 顶部一开始就高于 60%，未滚动时已是半透明 + 模糊：
  // 以加载时（scrollY=0）的进度 p0 为起点，保证首屏文字完整清晰；高视口 p0=0，行为不变。
  const p0 = useMotionValue(0)
  useEffect(() => {
    const measure = () => {
      const el = aboutRef.current as HTMLElement | null
      if (!el) return
      const edge = window.innerHeight * 0.6
      const top0 = el.getBoundingClientRect().top + window.scrollY
      p0.set(Math.min(0.4, Math.max(0, (edge - top0) / edge)))
    }
    measure()
    window.addEventListener('resize', measure)
    return () => window.removeEventListener('resize', measure)
  }, [p0])
  const fade = useTransform([scrollYProgress, p0], ([p, s]: number[]) => Math.min(1, Math.max(0, (p - s) / 0.5)))
  const blur = useTransform(fade, (f) => `blur(${f * 16}px)`)
  const opacity = useTransform(fade, (f) => 1 - f)
  // 视差：标题上升更快、字距随滚动拉开；正文上升慢一点
  const titleY = useTransform(scrollYProgress, [0, 1], [0, -96])
  const bodyY = useTransform(scrollYProgress, [0, 1], [0, -52])
  const titleSpacing = useTransform(scrollYProgress, [0, 1], ['0.01em', '0.42em'])
  return (
    <section className="hero">
      <motion.div
        className="about"
        lang={lang}
        ref={aboutRef}
        style={{ filter: blur, opacity }}
      >
        {/* 入场动画放内层，避免其 fill 锁住 opacity 覆盖外层滚动 opacity */}
        <div className="about-intro">
          <motion.h1 className="about-title" style={{ y: titleY, letterSpacing: titleSpacing }}>
            {title}
          </motion.h1>
          <motion.p className="about-role" style={{ y: bodyY }}>
            {role}
          </motion.p>
          {paragraphs.map((p, i) => (
            <motion.p key={i} className="about-body" style={{ y: bodyY }}>
              {p}
            </motion.p>
          ))}
        </div>
      </motion.div>
      <motion.div className="scroll-cue" style={{ opacity: cueOpacity }} aria-hidden="true">
        <span className="scroll-cue-label">SCROLL</span>
        <span className="scroll-cue-track">
          <span className="scroll-cue-dot" />
        </span>
      </motion.div>
    </section>
  )
}

export default function App() {
  // English-only site; the `lang` plumbing is kept so a second language can be added later.
  const [lang] = useState<Lang>('en')
  const { scrollY } = useScroll()
  // 作品区蒙层：以作品区顶部从视口底进入到视口中部的进度，驱动 3D 渐暗 + 模糊
  const worksRef = useRef(null)
  const { scrollYProgress: worksProgress } = useScroll({
    target: worksRef,
    offset: ['start end', 'start center'],
  })
  const fogBg = useTransform(
    worksProgress,
    [0, 1],
    ['rgba(8, 11, 18, 0)', 'rgba(8, 11, 18, 0.41)'] // 压暗减半（原 0.82）
  )
  const fogBlur = useTransform(worksProgress, [0, 1], ['blur(0px)', 'blur(10px)'])
  // 滚动渐暗：离开首屏后压暗 3D 场景，保证履历文字可读
  const scrimOpacity = useTransform(scrollY, [0, 520], [0, 0.4])
  // 首屏滚动提示随之淡出
  const cueOpacity = useTransform(scrollY, [0, 160], [1, 0])
  // 首屏底部渐变底色：开始滑动后淡出
  const heroGradientOpacity = useTransform(scrollY, [0, 240], [1, 0])
  // 磨砂右轨：进入履历区后淡入（首屏不磨砂）
  const vh = typeof window !== 'undefined' ? window.innerHeight : 800
  const railOpacity = useTransform(scrollY, [vh * 0.5, vh * 1.1], [0, 1])
  // 首屏装饰画框/角标：滚动后淡出
  const heroChromeOpacity = useTransform(scrollY, [0, 280], [1, 0])

  return (
    <>
      {/* 加载遮罩：模型全部加载完成前覆盖全屏，完成后淡出 */}
      <LoadingScreen />

      {/* 固定的 3D 背景 */}
      <div className="scene-bg">
        <Canvas
          shadows={{ type: THREE.PCFShadowMap }}
          dpr={[1, 1.5]}
          camera={{ position: [0, 5, 19], fov: 39, near: 0.1, far: 500 }}
          gl={{ antialias: false, stencil: false, depth: true, toneMapping: THREE.ACESFilmicToneMapping }}
        >
          <color attach="background" args={['#0a0e16']} />
          <Suspense fallback={null}>
            <Backdrop />
            <Scene />
          </Suspense>
        </Canvas>
      </div>

      {/* 滚动渐暗蒙层 */}
      <motion.div className="scrim" style={{ opacity: scrimOpacity }} aria-hidden="true" />

      {/* 作品区固定蒙层：仅压暗（减半），模糊先注释掉 */}
      <motion.div
        className="stage-fog"
        style={{ background: fogBg /* , backdropFilter: fogBlur, WebkitBackdropFilter: fogBlur */ }}
        aria-hidden="true"
      />

      {/* 固定磨砂右轨（进入履历区淡入） */}
      <motion.div className="glass-rail" style={{ opacity: railOpacity }} aria-hidden="true" />

      {/* 首屏底部渐变底色，滚动后淡出 —— 暂时注释查看效果 */}
      {/* <motion.div
        className="hero-gradient"
        style={{ opacity: heroGradientOpacity }}
        aria-hidden="true"
      /> */}

      {/* 首屏装饰：发丝内框 + 四角定位标 + 角标元数据（随滚动淡出） */}
      <motion.div className="hero-chrome" style={{ opacity: heroChromeOpacity }} aria-hidden="true">
        <div className="hero-frame" />
        <span className="hero-mark tl">+</span>
        <span className="hero-mark tr">+</span>
        <span className="hero-mark bl">+</span>
        <span className="hero-mark br">+</span>
        <div className="hero-meta hm-tl">
          <span className="hm-name">Sohaib Imran</span>
          <span>Backend / Applied AI</span>
        </div>
        <div className="hero-meta hm-tr">Portfolio — 2026</div>
        {/* 窄屏拆成三行（隐藏分隔点），避开胸前工牌 */}
        <div className="hero-meta hm-bl">
          <span>Agents</span>
          <span className="hm-sep"> · </span>
          <span>Vision</span>
          <span className="hm-sep"> · </span>
          <span>Retrieval</span>
        </div>
      </motion.div>

      {/* 全屏胶片噪点蒙层（multiply 混合） */}
      <SocialLinks opacity={heroChromeOpacity} />
      <NoiseOverlay />

      {/* 可滚动内容 */}
      <main className="content">
        <Hero lang={lang} cueOpacity={cueOpacity} />
        <Resume lang={lang} />
        {/* 角色故事滚动段：全身揭示 → 手表 → 鞋子 → 工牌 → 回到全身（相机叠加见 Scene.tsx） */}
        <StoryScroll />
        <Works lang={lang} innerRef={worksRef} />
      </main>

      {/* 角色故事：手表 / 鞋子热点（位置由 Scene 每帧投影写入）+ 故事面板 */}
      <StoryHotspots />
      <LanyardCredentials />
      <StoryPanel />
      {/* 工牌段「Let’s Connect」打开的联系面板 */}
      <ContactPanel />
    </>
  )
}
