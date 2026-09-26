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
  visitLabel: 'View on GitHub',
  detailPlaceholder: 'Details coming soon.',
  phImageLabel: 'Image / Video',
  phButtonLabel: 'Link',
  countLabel: (n) => `${n} ${n === 1 ? 'project' : 'projects'}`,
  sections: [
    {
      id: 'datashield',
      no: '01',
      title: 'DataShield',
      tagline: 'Security / Backend',
      items: [
        {
          name: 'Endpoint DLP & Incident Response',
          link: 'https://github.com/sohaib-0897/DataShield',
          slug: 'datashield',
        },
      ],
      footer: 'Python · Flask · React · Tailwind CSS · Watchdog · Pytest',
    },
    {
      id: 'omniops',
      no: '02',
      title: 'OmniOps',
      tagline: 'Agents / Applied AI',
      items: [
        {
          name: 'Multimodal Autonomous Agent System',
          link: 'https://github.com/sohaib-0897/OmniOps',
          slug: 'omniops',
        },
      ],
      footer: 'FastAPI · Next.js · PostgreSQL · pgvector · Docker · LangGraph',
    },
    {
      id: 'vigilai',
      no: '03',
      title: 'VigilAI',
      tagline: 'Computer Vision',
      items: [
        {
          name: 'Real-Time Video Intelligence',
          link: 'https://github.com/sohaib-0897/VigilAi',
          slug: 'vigilai',
        },
      ],
      footer: 'Python · OpenCV · Computer Vision · Docker',
    },
    {
      id: 'inboxlearn',
      no: '04',
      title: 'InboxLearn',
      tagline: 'Human-in-the-Loop ML',
      items: [
        {
          name: 'Human-in-the-Loop Email Triage Agent',
          link: 'https://github.com/sohaib-0897/InboxLearn',
          slug: 'inboxlearn',
        },
      ],
      footer: 'Python · Streamlit · scikit-learn · SQLite · Pytest',
    },
  ],
}

// English-only site: zh reuses the English content (the language toggle is hidden).
export const WORKS: Record<'zh' | 'en', WorksLang> = {
  zh: WORKS_EN,
  en: WORKS_EN,
}

// 板块配图，key 为板块 id，放到 public/works/covers/<id>.jpg（统一 3:2，768×512）。
// 只用项目仓库里的真实截图；缺图的板块显示大编号占位（datashield / vigilai 暂无截图）。
export const SECTION_COVERS: Record<string, string> = {
  omniops: `${import.meta.env.BASE_URL}works/covers/omniops.jpg`,
  inboxlearn: `${import.meta.env.BASE_URL}works/covers/inboxlearn.jpg`,
}

// 统计一个板块的作品数（items 或 groups 求和），用于索引行 hover 显示
export function sectionCount(section: WorkSection): number {
  if (section.items) return section.items.length
  if (section.groups) return section.groups.reduce((n, g) => n + g.items.length, 0)
  return 0
}
