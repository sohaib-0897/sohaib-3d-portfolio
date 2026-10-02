import { motion } from 'framer-motion'
import { FOCUS_POINTS } from '../data/focusPoints'

interface ResumeGroup {
  heading?: string
  sub?: string
  link?: string
  items?: string[]
}
interface ResumeEntry {
  period: string
  place: string
  role?: string
  logo?: { src: string; alt: string }
  points?: string[]
  tech?: string
  groups?: ResumeGroup[]
}
// 5 entries, in focus-anchor order: focus-1 DataShield, focus-2 OmniOps, focus-3 VigilAI,
// focus-4 InboxLearn, focus-5 Applied AI & Agents (each camera stop lands on that project's face sticker).
// Keep exactly 5, in this order — they map 1:1 onto FOCUS_POINTS.
const RESUME_EN: { title: string; entries: ResumeEntry[] } = {
  title: 'Résumé',
  entries: [
    {
      period: '01',
      place: 'DataShield',
      role: 'Endpoint DLP & Incident Response',
      points: [
        'Built Windows endpoint monitoring for PII/CNIC detection, browser/upload monitoring, HTTP upload interception, and authenticated analyst Allow / Block decisions.',
      ],
      tech: 'Python · Flask · React · Watchdog · pytest · GitHub Actions',
    },
    {
      period: '02',
      place: 'OmniOps',
      role: 'Multimodal Investigation Backend',
      points: [
        'Built PDF/OCR/audio ingestion, hybrid PostgreSQL/pgvector retrieval with Reciprocal Rank Fusion, database-leased workers, authenticated SSE, and sandboxed tools in isolated workspaces.',
      ],
      tech: 'FastAPI · PostgreSQL · pgvector · Next.js · TypeScript · Docker',
    },
    {
      period: '03',
      place: 'VigilAI',
      role: 'Real-Time Video Analytics Platform',
      points: [
        'Built CPU-only real-time detection and persistent tracking with zones, line crossing, dwell, occupancy, event deduplication, and annotated incident evidence.',
      ],
      tech: 'FastAPI · YOLOv8 · ByteTrack · ONNX Runtime · PostgreSQL · Docker',
    },
    {
      period: '04',
      place: 'InboxLearn',
      role: 'Human-in-the-Loop Email Triage',
      points: [
        'Built email and priority classification with user corrections, low-confidence review, candidate evaluation, promotion gates, model versioning, and rollback.',
      ],
      tech: 'Python · scikit-learn · SQLite · Streamlit · GitHub Actions',
    },
    {
      period: '05',
      place: 'Applied AI & Agents',
      role: 'Inference · Retrieval · Evaluation',
      points: [
        'Engineering LLM inference and benchmarks in llm-inference-lab: KV cache, GQA, RoPE, speculative decoding, INT8 quantization, and ONNX export; measuring TTFT, throughput, VRAM, and context scaling.',
      ],
      tech: 'Python · LLM Inference · MCP · Ollama · ONNX · Hybrid Retrieval',
    },
  ],
}
// The site is English-only; zh reuses the English content (the language toggle is hidden).
const RESUME: Record<'en' | 'zh', { title: string; entries: ResumeEntry[] }> = {
  en: RESUME_EN,
  zh: RESUME_EN,
}

// 履历条目依次对应 glb 里的聚焦锚点（相机停靠点），顺序须与 entries 一致。
// 名单是唯一真源，见 data/focusPoints.ts（Scene.tsx 也从那里取）。
const POINT_ORDER = FOCUS_POINTS

const EASE = [0.22, 1, 0.36, 1]
const containerV = {
  hidden: {},
  show: { transition: { staggerChildren: 0.09, delayChildren: 0.04 } },
}
const itemV = {
  hidden: { opacity: 0, y: 26 },
  show: { opacity: 1, y: 0, transition: { duration: 0.75, ease: EASE } },
}

function Group({ group }: { group: ResumeGroup }) {
  const heading = group.link ? (
    <a className="about-link" href={group.link} target="_blank" rel="noopener noreferrer">
      {group.heading}
    </a>
  ) : (
    <span>{group.heading}</span>
  )

  return (
    <motion.div className="tl-group" variants={itemV}>
      <div className="tl-group-head">
        {heading}
        {group.sub && <span className="tl-group-sub">{group.sub}</span>}
      </div>
      {group.items && (
        <ul className="tl-points">
          {group.items.map((it, i) => (
            <li key={i}>{it}</li>
          ))}
        </ul>
      )}
    </motion.div>
  )
}

function Entry({ entry, index }: { entry: ResumeEntry; index: number }) {
  return (
    <motion.div
      className="tl-entry"
      data-point={POINT_ORDER[index]}
      variants={containerV}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: '-12% 0px -12% 0px' }}
    >
      <motion.span className="tl-dot" variants={itemV} aria-hidden="true" />
      {/* tl-body 包住文字内容（点保持在外做时间轴标记）：移动端可给它加卡片衬底，
          且它紧贴内容高度，不含 tl-entry 用于排布的大 padding。
          用普通 div（非 motion）：framer 变体经 React context 穿透它，叶子元素仍是
          tl-entry 的直接 stagger 子级，入场动画与包裹前完全一致。 */}
      <div className="tl-body">
        <motion.div className="tl-period" variants={itemV}>
          {entry.period}
        </motion.div>
        <motion.div className="tl-head" variants={itemV}>
          {entry.logo && (
            <span className="tl-logo-chip">
              <img src={entry.logo.src} alt={entry.logo.alt} loading="lazy" />
            </span>
          )}
          <h3 className="tl-place">{entry.place}</h3>
        </motion.div>
        {entry.role && (
          <motion.div className="tl-role" variants={itemV}>
            {entry.role}
          </motion.div>
        )}
        {entry.points && (
          <motion.ul className="tl-points" variants={itemV}>
            {entry.points.map((p, i) => (
              <li key={i}>{p}</li>
            ))}
          </motion.ul>
        )}
        {entry.tech && (
          <motion.div className="tl-tech" variants={itemV}>
            {entry.tech}
          </motion.div>
        )}
        {entry.groups && entry.groups.map((g, i) => <Group key={i} group={g} />)}
      </div>
    </motion.div>
  )
}

export default function Resume({ lang }: { lang: 'en' | 'zh' }) {
  const data = RESUME[lang]
  return (
    <section className="resume" lang={lang}>
      <motion.h2
        className="resume-title"
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, margin: '-10% 0px' }}
        transition={{ duration: 0.7, ease: EASE }}
      >
        {data.title}
      </motion.h2>
      <div className="timeline">
        {data.entries.map((e, i) => (
          <Entry key={i} entry={e} index={i} />
        ))}
      </div>
    </section>
  )
}
