# Blender 3D Character & Model Workflow

This directory contains the 3D Blender source file and procedural helper tools for the 3D character and scene.

## Main Model File

- **`sohaib.blend`**: Main working file containing the 3D character, armature, clothing, glasses, digital watch, clogs, camera animation (`CameraAction`), focus empty anchors (`focus-0` through `focus-5`, `focus-works`), and eyeball meshes (`eye1`, `eye2`).

## Directory Structure

- **`tools/`**: Procedural Python modeling tools:
  - `build_body.py`: Proportional scaling, head adjustment, and neck alignment.
  - `build_watch.py`: G-Shock style digital watch geometry on character's left wrist.
  - `lanyard_build.py`: Conference lanyard and career badge builder.
  - `stickers_place.py`: Face sticker UV placement generator.
  - `tex_fix.py`: Texture mask and color correction utilities.
  - `verify_glb.py`: GLB mesh and node hierarchy validator.
  - `shots.py`: Camera angle screenshot rendering utility.
- **`stickers/`**: Face sticker atlas source:
  - `stickers.html`: HTML layout for project and skill stickers.
  - `render_atlas.cjs`: Playwright script to render stickers atlas texture and JSON coordinate mapping.
  - `stickers_atlas.png`: Generated atlas texture.
  - `stickers_atlas.json`: Coordinate bounding boxes.
- **`lanyard/`**: Lanyard badge source:
  - `badge.html`: HTML layout for lanyard badge.
  - `render_badge.cjs`: Script to render `badge.png`.
  - `badge.png`: Generated badge texture.

## Exporting to Production (`web/public/models/me.glb`)

1. Open `sohaib.blend` in Blender 5.x.
2. Ensure you are on **frame 1**.
3. Select only objects inside the collection `Collection` (exclude any reference or hidden collections).
4. Export GLTF/GLB with these settings:
   - **Format**: `GLB`
   - **Include**: Selected Objects, Custom Properties (False), Cameras, Animations
   - **Transform**: +Y Up
   - **Images**: WEBP, Quality 90%
   - **Animation**: Group by NLA Track (or shape keys + actions), Sample Animations
5. Save output to `web/public/models/me.glb`.
6. Verify file size is ~2.5 MB and run `npm run typecheck` and `npm run build` in `web/`.
