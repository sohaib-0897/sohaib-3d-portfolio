// Bridge between the R3F frame loop (Scene.tsx) and the DOM story hotspots (ui/StoryHotspots.tsx).
// Scene projects the glb anchors `watch_interaction` / `shoes_interaction` to screen space every frame and
// writes position / size / visibility straight onto these elements — no React state per frame.
import type { StoryId } from '../data/stories'

export const hotspotEls: Partial<Record<StoryId, HTMLButtonElement | null>> = {}

export const lanyardEls: { trigger: HTMLButtonElement | null } = { trigger: null }
