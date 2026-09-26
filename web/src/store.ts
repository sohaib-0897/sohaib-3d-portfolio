import { create } from 'zustand'
import type { StoryId } from './data/stories'

const SEEN_KEY = 'story-seen'
function readSeen(): Record<string, boolean> {
  try {
    return JSON.parse(localStorage.getItem(SEEN_KEY) || '{}') || {}
  } catch {
    return {}
  }
}

// 全站交互状态：当前展开的领域 / 悬停的领域 / 是否已进入 / 打开的角色故事面板
interface StoreState {
  active: string | null // 当前展开的 domain id（null = 总览）
  hovered: string | null // 悬停的 domain id
  entered: boolean // 是否已通过入场
  story: StoryId | null // 打开的故事面板（watch / shoes），Scene 每帧读它做镜头微推
  seen: Record<string, boolean> // 打开过的故事（热点停止脉冲），存 localStorage
  setActive: (id: string | null) => void
  setHovered: (id: string | null) => void
  enter: () => void
  setStory: (id: StoryId | null) => void
  openStory: (id: StoryId) => void // 打开面板并记为已看（热点 / 滚动文案里的 Explore 共用）
}

export const useStore = create<StoreState>((set, get) => ({
  active: null,
  hovered: null,
  entered: false,
  story: null,
  seen: readSeen(),
  setActive: (id) => set({ active: id }),
  setHovered: (id) => set({ hovered: id }),
  enter: () => set({ entered: true }),
  setStory: (id) => set({ story: id }),
  openStory: (id) => {
    const seen = get().seen
    if (seen[id]) return set({ story: id })
    const next = { ...seen, [id]: true }
    set({ story: id, seen: next })
    try {
      localStorage.setItem(SEEN_KEY, JSON.stringify(next))
    } catch {
      /* storage unavailable: the pulse just keeps showing */
    }
  },
}))

// 开发期调试钩子：可在 console 用 __store.getState().setActive('ads')
declare global {
  interface Window {
    __store?: typeof useStore
  }
}
if (import.meta.env.DEV) window.__store = useStore
