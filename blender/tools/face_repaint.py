"""Re-run face_paint_v3 without stacking paint: restore `sohaib_diffuse` from a pre-paint .blend, then paint.

Only the diffuse texture changes — mesh, eyes / lids, stickers, anchors stay as they are in the open file.
Usage: blender --background current.blend --python face_repaint.py -- <pre_paint.blend>
"""
import bpy, os, sys
import numpy as np

src = sys.argv[sys.argv.index("--") + 1]
with bpy.data.libraries.load(src, link=False) as (data_from, data_to):
    data_to.images = ["sohaib_diffuse"]
pristine = data_to.images[0]
img = bpy.data.images["sohaib_diffuse"]
assert tuple(pristine.size) == tuple(img.size), (pristine.size, img.size)
px = np.empty(img.size[0] * img.size[1] * 4, np.float32)
pristine.pixels.foreach_get(px)
img.pixels.foreach_set(px); img.update()
bpy.data.images.remove(pristine)

here = os.path.dirname(os.path.abspath(__file__))
g = {"__name__": "face_paint_v3"}
exec(open(os.path.join(here, "face_paint_v3.py"), encoding="utf-8-sig").read(), g)
print("paint", g["paint"]())
bpy.ops.wm.save_mainfile(compress=True)
