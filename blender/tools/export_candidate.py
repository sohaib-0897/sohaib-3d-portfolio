"""Export the candidate glb from `Collection` only (same settings as the approved production export).

Usage: blender --background sohaib.blend --python export_candidate.py -- <out.glb>
"""
import bpy, sys, re

out = sys.argv[sys.argv.index("--") + 1]
# only eye1/eye2 may match /eye/i anywhere a three.js object name can come from (node or mesh names)
for coll in (bpy.data.meshes, bpy.data.objects):
    for d in coll:
        if re.search("eye", d.name, re.I) and d.name not in ("eye1", "eye2"):
            d.name = re.sub("eye", "iris", d.name, flags=re.I)
for im in bpy.data.images:
    if re.search("eye", im.name, re.I):
        im.name = re.sub("eye", "iris", im.name, flags=re.I)
sc = bpy.context.scene
sc.frame_set(1)
coll = bpy.data.collections["Collection"]
for o in bpy.context.view_layer.objects:
    o.select_set(False)
names = []
for o in coll.all_objects:
    if o.name in bpy.context.view_layer.objects:
        o.select_set(True); names.append(o.name)
bpy.ops.export_scene.gltf(filepath=out, use_selection=True, export_apply=True, export_cameras=True,
                          export_animations=True, export_image_format='WEBP', export_image_quality=90,
                          export_extras=False)
print("EXPORTED", out, sorted(names))
bad = [n for n in names if re.search("eye", n, re.I) and n not in ("eye1", "eye2")]
print("EYE-NAME CHECK", "OK" if not bad else bad)
bpy.ops.wm.save_mainfile(compress=True)
