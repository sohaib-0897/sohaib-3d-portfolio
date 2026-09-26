# QA and Automated Verification

This directory contains automated testing and visual inspection scripts for the portfolio website.

## Prerequisites

- Node.js 20+
- The production preview running locally:
  ```bash
  cd web
  npm run build
  npm run preview  # serves on http://localhost:4173
  ```
- Playwright:
  ```bash
  npm install -D playwright
  # or pass PLAYWRIGHT=/path/to/playwright in your environment
  ```

## Available QA Scripts

### 1. `final-qa.cjs`
Comprehensive smoke test verifying:
- Hero metadata and typography
- Résumé entries order and text accuracy
- Works gallery cards and external links
- Project detail dialogs
- Screenshot generation in `scripts/qa/screenshots/`

Run:
```bash
node scripts/qa/final-qa.cjs
```

### 2. `story-qa.cjs`
Validates 3D character story-interaction beats, watch/shoe hotspots, panel focus trapping, and camera stability across viewports.

Run:
```bash
node scripts/qa/story-qa.cjs
```

### 3. `overflow-check.cjs` / `overflow-sweep.cjs`
Checks for horizontal layout overflow across various mobile viewport widths (360px, 390px, etc.).

Run:
```bash
node scripts/qa/overflow-check.cjs 390 844
node scripts/qa/overflow-sweep.cjs
```
