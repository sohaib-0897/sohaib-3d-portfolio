# Development Guide

This document describes how to set up, develop, build, and deploy the portfolio locally.

## Tech Stack

- **Framework**: React 18 + TypeScript (strict mode)
- **Bundler**: Vite 5
- **3D Engine**: Three.js (r169) via `@react-three/fiber` & `@react-three/drei`
- **Post-Processing**: `@react-three/postprocessing` (Depth of Field, Bloom, SMAA)
- **Animation & Transitions**: Framer Motion
- **State Management**: Zustand
- **Content Rendering**: React Markdown + Rehype Raw + Remark GFM
- **Styling**: Vanilla CSS (custom properties, fluid clamps)

## Prerequisites

- **Node.js**: v20 or higher
- **npm**: v10 or higher
- **Blender**: 5.x LTS (only required if editing the 3D model)

## Getting Started

1. Navigate to the frontend directory:
   ```bash
   cd web
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start local development server:
   ```bash
   npm run dev
   ```
   Open [http://localhost:5173](http://localhost:5173) in your browser.

## Available Scripts

All scripts are executed from the `web/` directory:

| Command | Purpose |
| :--- | :--- |
| `npm run dev` | Starts Vite dev server with hot module replacement |
| `npm run build` | Runs TypeScript compilation (`tsc -b`) and Vite production bundle |
| `npm run preview` | Serves the production build locally at `http://localhost:4173` |
| `npm run typecheck` | Type-checks code using TypeScript compiler |
| `npm run lint` | Runs ESLint |

## Architecture Overview

- **`web/index.html`**: SPA entry point loading typography and main script.
- **`web/src/main.tsx`**: Mounts the React application.
- **`web/src/App.tsx`**: Core layout container hosting the fixed 3D canvas background and the scrollable HTML overlay.
- **`web/src/scene/Scene.tsx`**: Initializes the Three.js canvas, parses camera animations from `me.glb`, binds scroll progress to timeline frames, and computes depth-of-field targets.
- **`web/src/scene/Env.tsx`**: Handles environment HDR map lighting (`textures/env.hdr`).
- **`web/src/ui/Resume.tsx`**: Résumé timeline tied to focus points.
- **`web/src/ui/Works.tsx`**: Horizontal project showcase gallery and modal dialogs.
- **`web/src/ui/StoryScroll.tsx` & `StoryPanel.tsx`**: Interactive beats and contextual detail panels.

## Deployment

The application is a static Single Page Application (SPA). `vite.config.ts` sets `base: './'`, enabling static deployment to any hosting provider (GitHub Pages, Cloudflare Pages, Netlify, Vercel).

### GitHub Pages (Automated CI/CD)

The repository includes a GitHub Actions workflow in [`.github/workflows/deploy.yml`](../.github/workflows/deploy.yml). When code is pushed to the `main` branch, the workflow automatically:
1. Installs dependencies (`npm ci`).
2. Builds the project (`npm run build`).
3. Deploys `web/dist/` to GitHub Pages.

To enable GitHub Pages in your repository:
1. Go to **Settings** > **Pages**.
2. Under **Build and deployment**, select **GitHub Actions** as the source.
