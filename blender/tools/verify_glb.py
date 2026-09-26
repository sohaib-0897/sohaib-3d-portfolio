# Re-import web/public/models/me.glb into an empty scene and report what the site depends on.
# blender --background --factory-startup --python verify_glb.py
import bpy, os
GLB = os.path.join(os.path.dirname(__file__), "..", "..", "web", "public", "models", "me.glb")
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=os.path.abspath(GLB))
objs = {o.name: o for o in bpy.data.objects}
need = ["Camera", "eye1", "eye2", "man", "glasses", "watch_left", "focus-0", "focus-works"] + [f"focus-{i}" for i in range(1, 6)]
print("MISSING", [n for n in need if n not in objs])
print("ACTIONS", [(a.name, tuple(round(x) for x in a.frame_range)) for a in bpy.data.actions])
print("STICKERS", sorted(n for n in objs if n.startswith("sticker")))
for m in bpy.data.materials:
    imgs = [n.image.name for n in m.node_tree.nodes if n.type == "TEX_IMAGE" and n.image] if m.node_tree else []
    ok = all(bpy.data.images[i].has_data or bpy.data.images[i].size[0] > 0 for i in imgs)
    print("MAT", m.name, imgs, "images ok" if ok else "IMAGE MISSING")
for n in ("man", "sticker_agents", "sticker_git", "sticker_postgres"):
    me = objs[n].data
    print("MESH", n, len(me.polygons), "faces", "valid" if not me.validate(verbose=False) else "FIXED-INVALID")
