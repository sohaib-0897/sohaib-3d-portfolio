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

// Minimal copy shown in the scroll sequence (ui/StoryScroll.tsx) while the camera visits the watch / shoes.
// The full stories stay in the panels above.
export const SCROLL_COPY: Record<StoryId, { label: string; title: string; line: string }> = {
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
}

// Accessible names for the two hotspots on the character.
export const HOTSPOT_LABELS: Record<StoryId, string> = {
  watch: 'Open story: Watches Through My Career',
  shoes: 'Open story: From Marvel to Engineering',
}
