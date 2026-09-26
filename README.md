# Sohaib Imran · 3D Portfolio

A scroll-driven 3D portfolio and personal résumé. A stylized character model sits in a fixed 3D background, and scrolling drives the camera through the scene: hero → five résumé stops → interactive story beats → projects. Each résumé stop pushes the camera onto the matching project sticker on the character's face.

**Sohaib Imran**, Backend / Applied AI Engineer.

Featured Projects:

| Project | Focus | Repository |
| :--- | :--- | :--- |
| **DataShield** | Endpoint DLP & incident response | [sohaib-0897/DataShield](https://github.com/sohaib-0897/DataShield) |
| **OmniOps** | Multimodal autonomous agent system | [sohaib-0897/OmniOps](https://github.com/sohaib-0897/OmniOps) |
| **VigilAI** | Real-time video intelligence | [sohaib-0897/VigilAi](https://github.com/sohaib-0897/VigilAi) |
| **InboxLearn** | Human-in-the-loop email triage | [sohaib-0897/InboxLearn](https://github.com/sohaib-0897/InboxLearn) |

This project is a customized fork of [dayinji/sen-3d-resume](https://github.com/dayinji/sen-3d-resume). See [Attribution & Licensing](docs/ATTRIBUTION.md).

---

## Tech Stack

- **Frontend**: React 18 + TypeScript (strict mode), built with Vite 5
- **3D Graphics**: Three.js via `@react-three/fiber`, `@react-three/drei`, and `@react-three/postprocessing` (Depth of Field, Bloom, SMAA)
- **UI & Motion**: Framer Motion for scroll-linked elements, Zustand for state
- **Content**: React Markdown for project detail modals
- **3D Modeling & Animation**: Blender 5.x for the character model, accessories, focus anchors, and camera trajectory, exported as an optimized binary GLTF (`me.glb`)

---

## Quick Start

Requires Node.js 20+. All application code lives in [`web/`](web).

```bash
# 1. Navigate to frontend directory
cd web

# 2. Install dependencies
npm install

# 3. Start local development server
npm run dev        # http://localhost:5173
```

### Build & Verification Commands

```bash
cd web
npm run build      # type-check + production bundle → web/dist/
npm run preview    # serve the built bundle locally (http://localhost:4173)
npm run typecheck  # TypeScript validation (tsc -b)
npm run lint       # ESLint check
```

Static deployment is automated via [`.github/workflows/deploy.yml`](.github/workflows/deploy.yml) on push to `main`.

---

## Documentation

Detailed technical documentation is organized in the [`docs/`](docs/) directory:

- 🛠️ [**Development Guide**](docs/DEVELOPMENT.md): Complete setup, local development commands, architecture overview, and hosting setup.
- 🎨 [**Customization Guide**](docs/CUSTOMIZATION.md): Step-by-step instructions for editing hero text, résumé entries, project cards, and visual constants.
- 📐 [**3D Model Pipeline**](docs/MODEL_PIPELINE.md): Blender object hierarchy, camera animation timeline (`CameraAction`), focus anchors, and GLB export guidelines.
- 📜 [**Attribution & Licensing**](docs/ATTRIBUTION.md): Full credits to the original upstream project, licensing boundaries, and third-party asset notices.
- 🧪 [**QA & Verification**](scripts/qa/README.md): Automated smoke tests and viewport overflow verification.

---

## Project Structure

```text
sohaib-3d-portfolio/
│
├── README.md                      # Project overview & quick start
├── LICENSE                        # MIT License (upstream code)
├── NOTICE                         # Copyright notice & personal asset exclusions
├── .gitignore                     # Git ignore rules
├── .gitattributes                 # Line ending and binary file configuration
│
├── web/                           # Frontend React + Three.js application
│   ├── src/                       # Components, scenes, hooks, and content
│   ├── public/                    # Production 3D model (me.glb), textures, covers
│   ├── package.json               # Dependencies and scripts
│   └── vite.config.ts             # Vite configuration
│
├── blender/                       # Blender source files and modeling tools
│   ├── sohaib.blend               # Main 3D character working file
│   ├── tools/                     # Procedural Python modeling scripts
│   ├── stickers/                  # Face sticker atlas sources
│   ├── lanyard/                   # Conference badge sources
│   └── README.md                  # Blender workflow guide
│
├── docs/                          # Comprehensive project documentation
│   ├── DEVELOPMENT.md             # Developer guide & setup
│   ├── CUSTOMIZATION.md           # Customization instructions
│   ├── MODEL_PIPELINE.md          # 3D technical specifications
│   ├── ATTRIBUTION.md             # Attribution & upstream credits
│   └── upstream/                  # Preserved upstream READMEs
│
└── scripts/                       # Automation scripts
    ├── qa/                        # Playwright verification suites
    └── utilities/                 # Media optimization utilities
```

---

## Attribution & Copyright

- **Upstream Engine Code**: Licensed under the [MIT License](LICENSE) © 2026 Sen Zheng ([@dayinji](https://github.com/dayinji)). The core scroll camera tracking, depth-of-field auto-focus, and post-processing architecture originate from [dayinji/sen-3d-resume](https://github.com/dayinji/sen-3d-resume).
- **Personal Content & Likeness**: Personal likeness, custom 3D model, résumé history, project copy, and project imagery are © 2026 Sohaib Imran. These personal assets are **not** licensed under MIT.
- **Upstream Model Exclusion**: In accordance with the upstream [NOTICE](NOTICE), Sen Zheng's personal character model and source `blender/sen.blend` have been replaced with a custom model and are not redistributed in this repository.
- **Third-Party Assets**: Fonts (`Cormorant Upright`, `Mansalva`) are licensed under the SIL Open Font License.
