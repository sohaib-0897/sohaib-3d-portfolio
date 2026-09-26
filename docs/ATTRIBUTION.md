# Attribution & Licensing

This project is a customized fork of [**sen-3d-resume**](https://github.com/dayinji/sen-3d-resume), created by **Sen Zheng** ([@dayinji](https://github.com/dayinji)).

## 1. Upstream Project & Original Code

The original open-source project provided the foundational technical architecture:
- React Three Fiber canvas setup and Three.js integration
- Scroll-driven camera animation synchronization
- Dynamic focus point depth-of-field targeting
- Cursor-following eye tracking mechanism
- Post-processing pipeline (Depth of Field, Bloom, SMAA)
- Base responsive layout and timeline structure

The upstream codebase is released under the **MIT License**. The original license and copyright text are preserved in [`LICENSE`](../LICENSE) and [`NOTICE`](../NOTICE).

## 2. Upstream Character Model & Exclusion of `sen.blend`

In accordance with the upstream author's [`NOTICE`](../NOTICE):
> *"The personal content and assets below are © 2026 Sen Zheng (SEN), all rights reserved. They are not licensed under MIT and may not be reused, redistributed, or repurposed without permission — please replace them with your own if you fork this project:*
> *- Name & likeness — 'Sen' / 'SEN' / 'Sen Zheng 郑越升', the 3D character model depicting the author `web/public/models/me.glb`, and its Blender source `blender/sen.blend`."*

To fully respect the author's copyright and privacy, **`sen.blend` and the original character assets are not redistributed in this public repository**.

For reference, the upstream repository and its documentation can be found at:
- Repository: [https://github.com/dayinji/sen-3d-resume](https://github.com/dayinji/sen-3d-resume)
- Live Demo: [https://about.senbuzy.com/](https://about.senbuzy.com/)
- Preserved upstream READMEs: [`docs/upstream/UPSTREAM_README.en.md`](upstream/UPSTREAM_README.en.md) and [`docs/upstream/UPSTREAM_README.zh.md`](upstream/UPSTREAM_README.zh.md)

## 3. Customizations & Personal Content

The following personal content, branding, and assets belong to **Sohaib Imran** and are **not** covered by the MIT license:
- **Identity & Likeness**: Name, bio, professional summary, and personal likeness.
- **3D Character Model**: The custom 3D model in `web/public/models/me.glb` and its source `blender/sohaib.blend` depicting Sohaib Imran.
- **Career Content**: Résumé history, achievements, and project descriptions.
- **Project Assets**: Portfolio covers, markdown documentation, and GitHub repository links.

## 4. Third-Party Assets

- **Fonts**:
  - `Mansalva` and `Cormorant Upright` are licensed under the [SIL Open Font License (OFL)](http://scripts.sil.org/OFL) via Google Fonts.
- **Environment Map**:
  - `web/public/textures/env.hdr` provides high-dynamic-range image-based lighting.
