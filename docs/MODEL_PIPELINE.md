# 3D Model & Camera Pipeline

This document explains the technical contract between the Blender source file (`blender/sohaib.blend`) and the Three.js frontend runtime (`web/src/scene/Scene.tsx`).

## 1. Scene Structure & Object Hierarchy

The 3D scene consists of:
- **`man`**: Core character mesh (outfit, curly hair, neat beard, sweatpants, clogs).
- **`Camera`**: Perspective camera bound to animation clip `CameraAction`.
- **Eyeballs (`eye1`, `eye2`)**:
  > [!IMPORTANT]
  > **Crucial Naming Rule**: In Three.js, `Scene.tsx` matches meshes using `/eye/i` to drive cursor eye-tracking. **No other object in the entire scene may contain "eye" in its name** (e.g. use `glasses`, `brows`, `polo`, etc.).
- **Accessories**:
  - `glasses`: Dark rounded-rectangle frames parented to `man`.
  - `watch_left`: Digital watch on the left wrist parented to `man`.
  - `lanyard`, `lanyard_clip`, `career_badge`: Conference lanyard with badge texture.
- **Focus Anchors (Empties)**:
  - `focus-0` (or `focus-start`): Starting camera focus for Hero view.
  - `focus-1` through `focus-5`: Target anchors on the face stickers for each of the 5 résumé stops.
  - `focus-works`: Focus anchor for the full-body Works showcase.
- **Interaction Targets (Empties)**:
  - `watch_interaction`: Screen-space hotspot target for watch story panel.
  - `shoes_interaction`: Screen-space hotspot target for shoes story panel.

## 2. Camera Animation & Scroll Synchronization

- **Clip Name**: `CameraAction` (baked at 24 FPS).
- **Total Duration**: ~350 frames.
- **Timeline Mapping**:
  - **Frame 0**: Hero resting position.
  - **Frames 1–250**: Résumé stops. Each stop is exactly 50 frames apart:
    - Frame 50: `focus-1` (DataShield)
    - Frame 100: `focus-2` (OmniOps)
    - Frame 150: `focus-3` (VigilAI)
    - Frame 200: `focus-4` (InboxLearn)
    - Frame 250: `focus-5` (Applied AI & Agents)
  - **Frames 250–300**: Transition into full-body view.
  - **Frames 300–350**: Full-body works framing, slight orbit and angle adjustment.

The Three.js frontend controls playback:
```typescript
// Scroll progress directly maps to clip timeline
mixer.setTime((scrollProgress * totalDuration));
```

## 3. Materials & Textures

- Materials use PBR Metallic-Roughness workflow.
- Textures are embedded directly inside the GLB using WebP format (90% quality).
- Sticker graphics are generated from `blender/stickers/` using `stickers.html` and `render_atlas.cjs`, projected onto the face geometry via UV mapping.
- Conference badge graphic is generated from `blender/lanyard/badge.html`.

## 4. Exporting to GLB (`me.glb`)

To produce the production model:

1. Open `blender/sohaib.blend` in Blender 5.x.
2. Select collection `Collection` (ensure reference layers remain excluded).
3. Export settings:
   - **Path**: `web/public/models/me.glb`
   - **Format**: `GLB`
   - **Include**: Selected Objects, Cameras, Animations
   - **Images**: WEBP (Quality 90)
   - **Transform**: +Y Up
4. Run validation check:
   ```bash
   python blender/tools/verify_glb.py
   ```
5. Target file size is ~2.5 MB to 2.7 MB for optimal web loading performance.
