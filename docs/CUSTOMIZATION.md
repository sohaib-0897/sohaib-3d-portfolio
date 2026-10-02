# Customization Guide

This guide explains how to update portfolio copy, résumé stops, project cards, detail pages, and visual parameters. All paths are relative to `web/`.

## 1. Hero Section (Header Copy)

Edit `web/src/App.tsx`:
- Look for `COPY_EN`:
  - `name`: Large hero title (e.g., `SOHAIB IMRAN`)
  - `role`: Sub-heading (e.g., `Backend / Applied AI Engineer`)
  - `intro`: One-sentence introduction text
  - `meta`: Corner tags and focus areas

## 2. Résumé Stops

Edit `web/src/ui/Resume.tsx`:
- Look for `RESUME_EN`:
  - Each item contains `no`, `title`, `sub`, `points`, and `tech`.
  - **Important**: The résumé stops map directly to the 3D model's camera timeline anchors `focus-1` through `focus-5`. Ensure the count and order match `web/src/data/focusPoints.ts`.

## 3. Projects & Works Gallery

The five résumé camera stops retain their sticker order. The gallery order is independent and can prioritize projects without changing those anchors.

### Project Cards
Edit `web/src/data/works.ts`:
- Modify `WORKS_EN.sections`:
  - `id`: Unique identifier
  - `no`: Display number (e.g., `01`, `02`)
  - `title`: Project title (e.g., `DataShield`, `OmniOps`)
  - `tagline`: One-line project pitch
  - `items`: Flat item details with `slug`, tech tags, and repository URL
- Cover images:
  - Place approved screenshots in `web/public/works/covers/<slug>.png` without cropping.
  - Map them in `SECTION_COVERS` and set their native width/height in `SECTION_COVER_SIZES` inside `web/src/data/works.ts`.
- `link` is the GitHub URL; optional `live` adds a matching Live control in the detail dialog.

### Project Detail Pages
Markdown detail pages live in `web/src/content/works/<slug>.md`:
- Each file has frontmatter (`title`, `sub`, `tags`, `link`) followed by markdown body text describing architecture, challenges, and impact.
- An example template is available at `web/src/content/works/example.md`.

## 4. Visual Tuning (3D Scene & Effects)

Adjust constants at the top of `web/src/scene/Scene.tsx`:
- **Lighting**: Intensity, direction, and colors for key lights and fill lights.
- **Post-Processing**:
  - `DepthOfField`: Focus distance, focal length, bokeh scale.
  - `Bloom`: Luminance threshold, intensity, radius.
  - `SMAA`: Anti-aliasing quality.
- **Story Scroll & Interaction**:
  - Sequence framing parameters are configured in `STORY_SEQ` at the top of `Scene.tsx`.
  - Beat durations are defined in `web/src/data/storyScroll.ts`.

## 5. Typography

Typography is loaded via Google Fonts in `web/index.html`:
- Headings: `Mansalva`
- Accents & Titles: `Cormorant Upright`
- Body & UI: System font stack / sans-serif fallback

Offline font files for fallback are bundled under `web/public/fonts/`.

## 6. Career Panel / CV Details

Edit `web/src/data/profile.ts` for the full name, professional summary, experience, education, certifications, skills, and leadership. These appear in compact, initially collapsed lists in the existing “Let’s Connect” panel. Completed certifications have a `certificate` URL; ongoing courses use `null`.

Contact options remain in `web/src/data/stories.ts`. GitHub and the supplied LinkedIn profile use short clickable labels; only use verified URLs.
