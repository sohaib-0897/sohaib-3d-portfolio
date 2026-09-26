"""Face-correction pass (2026-09-26): stickers moved to the face perimeter so eyes / nose / mouth / chin stay clear.

Reuses stickers_place.py (build) with a new layout. Project stickers stay on the side of the face their résumé
camera looks at (focus-1/2 character-left, focus-3/4 character-right) — further out and a little smaller.
The agents sticker leaves the nose for the left temple; focus-5 (full-face résumé stop) is put back on the nose
bridge afterwards so that stop still focuses on the centre of the face. The small chin stickers move round to the
jaw / cheek sides: an x with |x| > 1 is read as an angle in degrees around the head (0 = front, + = character left)
instead of a front-view position.

Run headless:  blender --background <file.blend> --python stickers_relayout.py   (saves the file)
"""
import bpy, os
from mathutils import Vector

HERE = os.path.dirname(os.path.abspath(__file__)) if "__file__" in globals() else r"C:\Users\Sohaib\Downloads\sen-3d-resume-main\blender\tools"
src = open(os.path.join(HERE, "stickers_place.py"), encoding="utf-8").read()
# side placement: accept normals from side hits too
src = src.replace("if n2 and l2.y < -0.05: acc += n2", "if n2 is not None and (l2.y < -0.05 or abs(x) > 1): acc += n2")
exec(src)
ROOT = os.path.join(os.path.dirname(HERE), "stickers")
ATLAS_PNG = os.path.join(ROOT, "stickers_atlas.png")
ATLAS_JSON = os.path.join(ROOT, "stickers_atlas.json")

_front_hit = front_hit


def front_hit(x, z, man, dg):
    if abs(x) > 1:                      # angle around the head (degrees)
        return hit(x, z, man, dg)
    return _front_hit(x, z, man, dg)


# name: (atlas id, front x | angle deg, z, width, rotation, anchor)   +x = character LEFT (image right)
LAYOUT_PERIMETER = {
    "sticker_datashield": ("datashield",  0.205, 0.355, 0.080, -8, "focus-1"),
    "sticker_omniops":    ("omniops",     0.190, 0.262, 0.082, 10, "focus-2"),
    "sticker_vigilai":    ("vigilai",    -0.222, 0.365, 0.098, 6, "focus-3"),
    "sticker_inboxlearn": ("inboxlearn", -0.205, 0.266, 0.090, -8, "focus-4"),
    "sticker_agents":     ("agents",      0.250, 0.455, 0.048, -6, "focus-5"),
    "sticker_opencv":     ("opencv",     -0.240, 0.455, 0.054, 8, None),
    "sticker_docker":     ("docker",      70.0, 0.500, 0.056, -10, None),
    "sticker_metal":      ("metal",       80.0, 0.390, 0.046, 12, None),
    "sticker_tennis":     ("tennis",     -80.0, 0.390, 0.042, 0, None),
    "sticker_fastapi":    ("fastapi",     76.0, 0.220, 0.058, -14, None),
    "sticker_python":     ("python",     -76.0, 0.220, 0.064, 14, None),
    "sticker_git":        ("git",         86.0, 0.305, 0.038, -8, None),
    "sticker_postgres":   ("postgres",   -86.0, 0.305, 0.036, 8, None),
}

if __name__ == "__main__":
    f5 = bpy.data.objects["focus-5"].matrix_world.copy()       # nose-bridge anchor of the full-face stop
    print(build(LAYOUT_PERIMETER))
    bpy.data.objects["focus-5"].matrix_world = f5
    bpy.ops.wm.save_mainfile(compress=True)
