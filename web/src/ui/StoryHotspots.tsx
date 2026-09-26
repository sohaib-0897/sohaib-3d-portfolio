import { useEffect } from 'react'
import { useStore } from '../store'
import { HOTSPOT_LABELS, type StoryId } from '../data/stories'
import { hotspotEls } from '../scene/storyAnchors'

const IDS: StoryId[] = ['watch', 'shoes']

// Two quiet hit targets that sit over the watch and the clogs (story scroll beats + works full-body shot).
// Position / size / visibility / emphasis are written every frame by Scene.tsx (see scene/storyAnchors.ts);
// this component only renders the buttons and handles clicks. A soft pulse marks a story until it has been opened once.
export default function StoryHotspots() {
  const openStory = useStore((s) => s.openStory)
  const seen = useStore((s) => s.seen)

  useEffect(() => {
    return () => {
      IDS.forEach((id) => (hotspotEls[id] = null))
    }
  }, [])

  return (
    <div className="story-hotspots">
      {IDS.map((id) => (
        <button
          key={id}
          ref={(el) => {
            hotspotEls[id] = el
          }}
          type="button"
          className={`story-hotspot is-${id}${seen[id] ? ' is-seen' : ''}`}
          data-visible="0"
          aria-label={HOTSPOT_LABELS[id]}
          aria-haspopup="dialog"
          onClick={() => openStory(id)}
        >
          <span className="story-hotspot-dot" aria-hidden="true" />
          <span className="story-hotspot-label" aria-hidden="true">
            Explore
          </span>
        </button>
      ))}
    </div>
  )
}
