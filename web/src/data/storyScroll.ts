// 角色故事滚动段（履历 focus-5 之后、作品画廊之前）的节奏表：唯一真源，
// ui/StoryScroll.tsx（段高度 + 文案淡入淡出）与 scene/Scene.tsx（相机叠加）都从这里取。
//
// 单位 = vh 滚动距离；段进度 p = (视口高 − 段顶) / 段高 ∈ [0, 1]
// （段顶到达视口底 = 履历走满第 250 帧的位置 → p=0；段底到达视口底 → p=1，随后作品画廊照旧进场）。
//   reveal    ：全身揭示——CameraAction 第 250→300 帧（原先由画廊进场驱动，现移到这里）
//   holdFull  ：全身停留
//   toWatch   ：叠加相机 全身 → 手表
//   holdWatch ：手表停留（TIME / 01 文案）
//   toShoes   ：手表 → 鞋子
//   holdShoes ：鞋子停留（ORIGIN / 02 文案）
//   toBadge   ：鞋子 → 胸前工牌（镜头上移）
//   holdBadge ：工牌停留（CAREER / 03 文案）
//   back      ：工牌 → 全身（叠加权重回到 0 = 原作品区全身镜头，分毫不差）
//   holdEnd   ：全身停留，然后作品画廊进场
export interface StoryBeats {
  reveal: number
  holdFull: number
  toWatch: number
  holdWatch: number
  toShoes: number
  holdShoes: number
  toBadge: number
  holdBadge: number
  back: number
  holdEnd: number
}

// 加入工牌段后揭示 / 全身停留各缩短一点，整段不至于拖沓
export const STORY_BEATS: { desktop: StoryBeats; mobile: StoryBeats } = {
  desktop: { reveal: 45, holdFull: 10, toWatch: 50, holdWatch: 55, toShoes: 50, holdShoes: 55, toBadge: 45, holdBadge: 45, back: 45, holdEnd: 15 },
  mobile: { reveal: 35, holdFull: 10, toWatch: 40, holdWatch: 45, toShoes: 40, holdShoes: 45, toBadge: 35, holdBadge: 40, back: 40, holdEnd: 10 },
}

// 与移动端样式断点一致
export const isNarrow = () => typeof window !== 'undefined' && window.innerWidth <= 640

// 段总长（vh）+ 各节点累计进度：k[0]=0 … k[10]=1
//   k1 揭示结束 · k2 离开全身 · k3 到达手表 · k4 离开手表 · k5 到达鞋子 · k6 离开鞋子
//   k7 到达工牌 · k8 离开工牌 · k9 回到全身
export function storyKeys(narrow: boolean): { total: number; k: number[] } {
  const b = narrow ? STORY_BEATS.mobile : STORY_BEATS.desktop
  const seq = [b.reveal, b.holdFull, b.toWatch, b.holdWatch, b.toShoes, b.holdShoes, b.toBadge, b.holdBadge, b.back, b.holdEnd]
  const total = seq.reduce((a, v) => a + v, 0)
  const k = [0]
  seq.forEach((v) => k.push(k[k.length - 1] + v / total))
  k[k.length - 1] = 1
  return { total, k }
}

// 进度 p → 相机「故事坐标」c：0 = 全身，1 = 手表，2 = 鞋子，3 = 工牌，4 = 全身（与 0 同一镜头）。
// 过渡段内线性，Scene 里再做缓动 + 阻尼。
export const STORY_END = 4
export function storyCoord(p: number, k: number[]): number {
  if (p <= k[2]) return 0
  for (let n = 0; n < STORY_END; n++) {
    const a = k[2 + 2 * n] // 离开第 n 个镜头
    const b = k[3 + 2 * n] // 到达第 n+1 个镜头
    if (p < b) return n + (p - a) / (b - a)
    if (p <= k[4 + 2 * n]) return n + 1
  }
  return STORY_END
}
