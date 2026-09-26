import { useEffect, useState } from 'react'
import { useProgress } from '@react-three/drei'

// 临时替代件（原文件缺失，见 web/LOCAL_CHANGES.md）。
// 加载遮罩：模型/贴图全部加载完成前覆盖全屏，进度环显示加载进度（无文字）；完成后淡出。
const R = 22
const C = 2 * Math.PI * R

export default function LoadingScreen() {
  const { active, progress } = useProgress()
  const [hidden, setHidden] = useState(false)

  useEffect(() => {
    if (!active && progress >= 100) {
      // 多留一帧给首帧渲染，避免遮罩消失瞬间看到未就绪画面
      const t = window.setTimeout(() => setHidden(true), 300)
      return () => window.clearTimeout(t)
    }
  }, [active, progress])

  return (
    <div className={`loading-screen${hidden ? ' is-hidden' : ''}`} aria-hidden={hidden}>
      <div className="loading-ring">
        <svg viewBox="0 0 50 50">
          <circle className="lr-track" cx="25" cy="25" r={R} />
          <circle
            className="lr-arc"
            cx="25"
            cy="25"
            r={R}
            strokeDasharray={C}
            strokeDashoffset={C * (1 - Math.min(progress, 100) / 100)}
          />
        </svg>
      </div>
    </div>
  )
}
