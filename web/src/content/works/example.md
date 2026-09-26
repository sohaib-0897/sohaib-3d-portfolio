---
title: Example Work
banner: /works/example/banner.jpg
year: 2026
role: Backend / Applied AI
tags: [Python, Example Tag]
link: https://example.com
---

> **Template for a work detail page.** Copy this file to `src/content/works/<slug>.md`, where
> `<slug>` matches the `slug` of an item in `src/data/works.ts`; that item then opens this page.
> This file's slug is `example`, which matches no work, so it never renders — reference only.

## Section heading

Standard Markdown works: **bold**, *italic*, [links](https://example.com), and lists:

- Point one
- Point two

## Images and video

Put media in `public/works/<slug>/` and reference it with `/works/...` absolute paths
(`public/works/` is gitignored except `covers/`):

![Example image](/works/example/1.jpg)

<video src="/works/example/demo.mp4" autoplay muted loop playsinline></video>

---

Frontmatter fields (all optional):

| Field | Meaning |
| --- | --- |
| `title` | Detail title (falls back to the item name in works.ts) |
| `banner` | Top banner image path (gradient placeholder if absent) |
| `year` | Year |
| `role` | Subtitle / role |
| `tags` | Tag list, e.g. `[Python, FastAPI]` |
| `link` | External link, rendered as the "View on GitHub" button |
