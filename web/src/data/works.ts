// 作品集数据（双语）。5 大板块 → 点击展开作品详情。
// 纯数据驱动：增删板块 / 作品只改本文件，Works.jsx 仅负责渲染。
//
// 板块字段：
//   id        唯一标识（用于 framer layoutId 共享元素动画）
//   no        编号 '01'…'05'
//   title     板块标题
//   tagline   索引行右侧一句话
//   items[]   扁平作品列表：{ name, meta?, tags?, link? }
//             点击 item 弹出全屏详情，可补充可选媒体/文案字段：
//             { image?, video?, year?, desc? }（缺省时媒体用占位、简介回退 meta/标签）
//   groups[]  分组作品（与 items 二选一）：{ heading, items: string[] }
//   awards[]  奖项 chip（可选）
//   footer    底部技术/备注一行（可选）

export interface WorkListItem {
  name: string
  meta?: string
  tags?: string[]
  link?: string
  live?: string
  slug?: string
}

export interface WorkGroup {
  heading: string
  items: string[]
}

export interface WorkSection {
  id: string
  no: string
  title: string
  tagline: string
  items?: WorkListItem[]
  groups?: WorkGroup[]
  awards?: string[]
  footer?: string
}

export interface WorksLang {
  title: string
  closeLabel: string
  openLabel: string
  hint: string
  awardsLabel: string
  visitLabel: string
  detailPlaceholder: string
  phImageLabel: string
  phButtonLabel: string
  countLabel: (n: number) => string
  sections: WorkSection[]
}

// One card per project, in this order. Each item's `slug` opens src/content/works/<slug>.md.
const WORKS_EN: WorksLang = {
  title: 'Works',
  closeLabel: 'Back',
  openLabel: 'Explore',
  hint: 'Keep scrolling',
  awardsLabel: 'Awards',
  visitLabel: 'Code',
  detailPlaceholder: 'Details coming soon.',
  phImageLabel: 'Image / Video',
  phButtonLabel: 'Link',
  countLabel: (n) => `${n} ${n === 1 ? 'project' : 'projects'}`,
  sections: [
    {
      id: 'vigilai',
      no: '01',
      title: 'VigilAI',
      tagline: 'Computer Vision',
      items: [
        {
          name: 'Real-Time Video Analytics Platform',
          link: 'https://github.com/sohaib-0897/VigilAi',
          live: 'http://0897vigilai.duckdns.org/',
          slug: 'vigilai',
        },
      ],
      footer: 'FastAPI · YOLOv8 · ByteTrack · ONNX Runtime · PostgreSQL · Next.js · Docker',
    },
    {
      id: 'omniops',
      no: '02',
      title: 'OmniOps',
      tagline: 'Agents / Applied AI',
      items: [
        {
          name: 'Multimodal Investigation Backend',
          link: 'https://github.com/sohaib-0897/OmniOps',
          live: 'https://omniops.duckdns.org/',
          slug: 'omniops',
        },
      ],
      footer: 'FastAPI · PostgreSQL · pgvector · Next.js · TypeScript · Docker',
    },
    {
      id: 'llm-inference-lab',
      no: '03',
      title: 'llm-inference-lab',
      tagline: 'Inference / Benchmarking',
      items: [
        {
          name: 'LLM Inference Engineering & Benchmarking',
          link: 'https://github.com/sohaib-0897/llm-inference-lab',
          live: 'https://sohaib-0897.github.io/llm-inference-lab/',
          slug: 'llm-inference-lab',
        },
      ],
      footer: 'KV Cache · GQA · RoPE · INT8 · ONNX · Ollama',
    },
    {
      id: 'inboxlearn',
      no: '04',
      title: 'InboxLearn',
      tagline: 'Human-in-the-Loop ML',
      items: [
        {
          name: 'Human-in-the-Loop Email Triage',
          link: 'https://github.com/sohaib-0897/InboxLearn',
          live: 'https://inboxlearn-d4kkvrrgrz6q9icqxnzqyq.streamlit.app/',
          slug: 'inboxlearn',
        },
      ],
      footer: 'Python · scikit-learn · SQLite · Streamlit · GitHub Actions',
    },
    {
      id: 'datashield',
      no: '05',
      title: 'DataShield',
      tagline: 'Security / Backend',
      items: [
        {
          name: 'Endpoint DLP & Incident Response',
          link: 'https://github.com/sohaib-0897/DataShield',
          slug: 'datashield',
        },
      ],
      footer: 'Python · Flask · React · Watchdog · pytest · GitHub Actions',
    },
  ],
}

// English-only site: zh reuses the English content (the language toggle is hidden).
export const WORKS: Record<'zh' | 'en', WorksLang> = {
  zh: WORKS_EN,
  en: WORKS_EN,
}

export const SECTION_COVERS: Record<string, string> = {
  vigilai: `${import.meta.env.BASE_URL}works/covers/vigilai.png`,
  omniops: `${import.meta.env.BASE_URL}works/covers/omniops.png`,
  'llm-inference-lab': `${import.meta.env.BASE_URL}works/covers/llm-inference-lab.png`,
  inboxlearn: `${import.meta.env.BASE_URL}works/covers/inboxlearn.png`,
}

// Native dimensions of the approved screenshots; holders use the same proportions.
export const SECTION_COVER_SIZES: Record<string, { width: number; height: number }> = {
  vigilai: { width: 1903, height: 912 },
  omniops: { width: 1847, height: 822 },
  'llm-inference-lab': { width: 1878, height: 892 },
  inboxlearn: { width: 1068, height: 793 },
}

// 统计一个板块的作品数（items 或 groups 求和），用于索引行 hover 显示
export function sectionCount(section: WorkSection): number {
  if (section.items) return section.items.length
  if (section.groups) return section.groups.reduce((n, g) => n + g.items.length, 0)
  return 0
}
