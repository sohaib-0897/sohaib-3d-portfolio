// Copy for the two hidden story panels (opened from the watch / shoes hotspots on the 3D character).
// Only the first watch is owned today; every later stage is an aspiration — keep `current` on stage 0 only.

export type StoryId = 'watch' | 'shoes'

export interface WatchStage {
  stage: string
  watch: string
  headline: string
  body: string
  current?: boolean
}

export const WATCH_STORY = {
  title: 'Watches Through My Career',
  intro: 'One watch for where I am. A few more for where I want to go.',
  currentTag: 'On my wrist now',
  futureTag: 'Aspiration',
  stages: [
    {
      stage: 'NOW · BUILDER',
      watch: 'G-Shock GA-B2100',
      headline: 'Building.',
      body: 'For the stage where everything is still being earned: projects, skills, deadlines, mistakes, and momentum.',
      current: true,
    },
    {
      stage: 'FIRST SOFTWARE / AI ROLE',
      watch: 'Tissot PRX Powermatic 80',
      headline: 'Curiosity became a career.',
      body: 'The first marker that building software stopped being only something I studied and became what I do professionally.',
    },
    {
      stage: 'MID-LEVEL ENGINEER',
      watch: 'Longines Spirit Zulu Time 39mm',
      headline: 'The work starts travelling further.',
      body: 'For larger systems, broader collaboration, new time zones, and greater responsibility.',
    },
    {
      stage: 'SENIOR / STAFF ENGINEER',
      watch: 'Omega Speedmaster Moonwatch Professional',
      headline: 'From features to systems.',
      body: 'A reminder that ambitious engineering can move from imagination into something real, reliable, and consequential.',
    },
    {
      stage: 'TECH LEAD / FOUNDER',
      watch: 'Rolex GMT-Master II “Batman”',
      headline: 'Building teams around ideas.',
      body: 'For the stage where engineering becomes direction, leadership, scale, and helping other people build well.',
    },
    {
      stage: 'THE DREAM',
      watch: 'Audemars Piguet Royal Oak',
      headline: 'If this is on my wrist, something went very right.',
      body: 'Not a promotion watch. An endgame milestone for building something genuinely exceptional.',
    },
  ] as WatchStage[],
}

export const MARVEL_STORY = {
  title: 'From Marvel to Engineering',
  paragraphs: [
    'Growing up, Marvel pulled me in through superheroes, but what stayed with me was the technology: Iron Man’s suit, JARVIS, intelligent systems, and the idea that engineering could extend what a person was capable of doing.',
    'That curiosity eventually became practical. I started learning how software, AI, and backend systems actually work, and how ideas that once felt like science fiction become real engineering problems.',
    'I still carry that same instinct today: take ambitious ideas, make them real, and make them work.',
  ],
  path: ['Science-fiction curiosity', 'Engineering curiosity', 'Software & AI projects'],
}

// Beats in the scroll sequence: the two story panels plus the career / lanyard beat (which opens the contact panel).
export type BeatId = StoryId | 'career'

// Minimal copy shown in the scroll sequence (ui/StoryScroll.tsx) while the camera visits the watch / shoes / badge.
// The full stories stay in the panels above; `cta` replaces the default "Explore" button label.
export const SCROLL_COPY: Record<BeatId, { label: string; title: string; line: string; cta?: string }> = {
  watch: {
    label: 'TIME / 01',
    title: 'Watches Through My Career',
    line: 'One watch for where I am. A few more for where I want to go.',
  },
  shoes: {
    label: 'ORIGIN / 02',
    title: 'From Marvel to Engineering',
    line: 'Science-fiction curiosity became something I wanted to build for real.',
  },
  career: {
    label: 'CAREER / 03',
    title: 'Open to the Right Opportunity',
    line: 'Interested in Backend and Applied AI roles where I can build, learn, and take on meaningful engineering problems.',
    cta: 'Let’s Connect',
  },
}

// Contact panel (opened from "Let’s Connect" in the career beat). Only contact options that already exist on the
// site are listed — never invent details. `href: null` = not provided yet: rendered as an obvious placeholder row.
// To add one, fill in its href/value (e.g. 'mailto:…' / 'https://www.linkedin.com/in/…').
export interface ContactLink {
  label: string
  value: string
  href: string | null
}
export const CONTACT = {
  title: 'Let’s Connect',
  intro: 'Software Engineer · Backend & Applied AI Systems — open to opportunities.',
  links: [
    { label: 'GitHub', value: 'Code', href: 'https://github.com/sohaib-0897' },
    { label: 'Email', value: 'msohaibimran1@gmail.com', href: 'mailto:msohaibimran1@gmail.com' },
    { label: 'Phone', value: '03004599778', href: 'tel:+923004599778' },
    { label: 'LinkedIn', value: 'Profile', href: 'https://www.linkedin.com/in/muhammad-sohaib-imran-0z9/' },
  ] as ContactLink[],
}

// Accessible names for the two hotspots on the character.
export const HOTSPOT_LABELS: Record<StoryId, string> = {
  watch: 'Open story: Watches Through My Career',
  shoes: 'Open story: From Marvel to Engineering',
}
