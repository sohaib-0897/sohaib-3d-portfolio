import { useEffect, useRef, useState } from 'react'
import { useProgress } from '@react-three/drei'
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion'
import { LOADING_FACTS, createShuffledBag, type LoadingFact } from '../data/loadingFacts'

const R = 22
const C = 2 * Math.PI * R

export interface LoadingScreenProps {
  overrideFact?: LoadingFact
  overrideProgress?: number
  forceVisible?: boolean
}

export default function LoadingScreen({
  overrideFact,
  overrideProgress,
  forceVisible,
}: LoadingScreenProps = {}) {
  const { active, progress } = useProgress()
  const [hidden, setHidden] = useState(false)
  const shouldReduceMotion = useReducedMotion()

  // Initialize a freshly shuffled bag of facts
  const bagRef = useRef<LoadingFact[]>([])
  const indexRef = useRef<number>(0)
  if (bagRef.current.length === 0) {
    bagRef.current = createShuffledBag(LOADING_FACTS)
  }

  // Check URL params for QA debugging if running automated tests
  const qaParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null
  const isQaLoading = qaParams?.has('qa-loading') || forceVisible
  const qaFactIdxParam = qaParams?.get('qa-fact-idx')
  const qaProgressParam = qaParams?.get('qa-pct')

  const initialFact = overrideFact ?? (
    qaFactIdxParam !== null && qaFactIdxParam !== undefined
      ? LOADING_FACTS[parseInt(qaFactIdxParam, 10)] || bagRef.current[0]
      : bagRef.current[0]
  )

  const [currentFact, setCurrentFact] = useState<LoadingFact>(initialFact)

  // Listen for model/texture load completion and fade out
  useEffect(() => {
    if (isQaLoading) return
    if (!active && progress >= 100) {
      // Allow one frame for Three.js first render to prevent flashing
      const t = window.setTimeout(() => setHidden(true), 300)
      return () => window.clearTimeout(t)
    }
  }, [active, progress, isQaLoading])

  // Periodic rotation of loading facts using the shuffled bag
  useEffect(() => {
    if (hidden || isQaLoading) return

    const interval = window.setInterval(() => {
      const nextIndex = indexRef.current + 1
      if (nextIndex >= bagRef.current.length) {
        const lastFact = bagRef.current[bagRef.current.length - 1]
        bagRef.current = createShuffledBag(LOADING_FACTS, lastFact)
        indexRef.current = 0
      } else {
        indexRef.current = nextIndex
      }
      setCurrentFact(bagRef.current[indexRef.current])
    }, 3500)

    return () => window.clearInterval(interval)
  }, [hidden, isQaLoading])

  // Expose QA helper hook on window when testing
  useEffect(() => {
    if (typeof window === 'undefined') return
    // Allow QA test scripts to inspect and step facts if needed
    ;(window as unknown as { __qaFact?: LoadingFact }).__qaFact = currentFact
    ;(window as unknown as { __qaNextFact?: () => void }).__qaNextFact = () => {
      const nextIndex = indexRef.current + 1
      if (nextIndex >= bagRef.current.length) {
        const lastFact = bagRef.current[bagRef.current.length - 1]
        bagRef.current = createShuffledBag(LOADING_FACTS, lastFact)
        indexRef.current = 0
      } else {
        indexRef.current = nextIndex
      }
      setCurrentFact(bagRef.current[indexRef.current])
    }
  }, [currentFact])

  const effectiveProgress = overrideProgress ?? (
    qaProgressParam !== null && qaProgressParam !== undefined
      ? parseInt(qaProgressParam, 10)
      : progress
  )
  const displayProgress = Math.min(Math.max(Math.round(effectiveProgress), 0), 100)
  const isScreenHidden = hidden && !isQaLoading

  return (
    <div
      className={`loading-screen${isScreenHidden ? ' is-hidden' : ''}`}
      aria-hidden={isScreenHidden}
      role="status"
      aria-label="Loading portfolio"
    >
      <span className="sr-only">Loading portfolio: {displayProgress}% complete</span>

      <div className="loading-content">
        <div className="loading-status">
          <div className="loading-ring" aria-hidden="true">
            <svg viewBox="0 0 50 50">
              <circle className="lr-track" cx="25" cy="25" r={R} />
              <circle
                className="lr-arc"
                cx="25"
                cy="25"
                r={R}
                strokeDasharray={C}
                strokeDashoffset={C * (1 - displayProgress / 100)}
              />
            </svg>
          </div>

          <div className="loading-progress-info">
            <span className="loading-label">LOADING EXPERIENCE</span>
            <span className="loading-pct">{displayProgress}%</span>
          </div>
        </div>

        <div className="loading-divider" aria-hidden="true" />

        <div className="loading-fact-box" aria-hidden="true">
          <span className="loading-fact-header">WHILE THE WORLD LOADS...</span>
          <div className="loading-fact-stage">
            <AnimatePresence mode="wait">
              <motion.div
                key={currentFact.text}
                initial={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, y: -6 }}
                transition={{ duration: 0.28, ease: [0.25, 0.1, 0.25, 1] }}
                className="loading-fact-item"
              >
                <p className="loading-fact-text">{currentFact.text}</p>
                <span className="loading-fact-category">{currentFact.category}</span>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  )
}
