"""Sohaib sticker pass: remove Sen's stickers, build atlas stickers wrapped on the face, move focus anchors.

Run inside Blender (MCP execute_blender_code):  exec(open(r"...\\blender\\tools\\stickers_place.py").read()); build(LAYOUT)
Placement is cylindrical around the head's vertical axis: theta 0 = straight front (-Y), +theta = character LEFT (+X).
"""
import bpy, bmesh, json, math, os
from mathutils import Vector, Matrix

_base = os.path.dirname(bpy.data.filepath) if bpy.data.filepath else os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ROOT = os.path.join(_base, "stickers") if os.path.basename(_base) == "blender" else os.path.join(_base, "blender", "stickers")
ATLAS_PNG = os.path.join(ROOT, "stickers_atlas.png")
ATLAS_JSON = os.path.join(ROOT, "stickers_atlas.json")
AXIS_Y = 0.0          # head vertical axis passes through (0, AXIS_Y, z)
OFFSET = 0.0035       # sticker lift off the skin
SUBDIV = 14           # grid resolution for wrapping

# name: (atlas id, front-view x, z, width, in-plane rotation deg, anchor or None)
# character LEFT = +x (image right in a front view). Anchors follow the résumé camera nodes.
LAYOUT = {
    "sticker_datashield": ("datashield",  0.170, 0.334, 0.100, -6, "focus-1"),
    "sticker_omniops":    ("omniops",     0.185, 0.235, 0.100, 8, "focus-2"),
    "sticker_vigilai":    ("vigilai",    -0.178, 0.350, 0.130, 5, "focus-3"),
    "sticker_inboxlearn": ("inboxlearn", -0.168, 0.238, 0.118, -6, "focus-4"),
    "sticker_agents":     ("agents",      0.000, 0.402, 0.056, 0, "focus-5"),
    "sticker_python":     ("python",     -0.115, 0.155, 0.100, 12, None),
    "sticker_fastapi":    ("fastapi",     0.110, 0.165, 0.086, -10, None),
    "sticker_docker":     ("docker",      0.255, 0.430, 0.068, -8, None),
    "sticker_git":        ("git",         0.040, 0.135, 0.050, 10, None),
    "sticker_postgres":   ("postgres",   -0.036, 0.132, 0.044, -8, None),
    "sticker_opencv":     ("opencv",     -0.250, 0.438, 0.066, 8, None),
    "sticker_tennis":     ("tennis",     -0.242, 0.292, 0.046, 0, None),
    "sticker_metal":      ("metal",       0.228, 0.290, 0.050, 10, None),
}


NEAREST_WRAP = {"sticker_agents"}


def axis_y(z):
    """head axis moves forward for the jaw/chin so side rays land on the jaw, not the neck"""
    t = min(max((z - 0.28) / (0.42 - 0.28), 0.0), 1.0)
    return -0.15 * (1 - t) + AXIS_Y * t


def remove_old():
    old = [o for o in bpy.data.objects if o.name.startswith("sticker")]
    meshes = {o.data for o in old}
    mats = {s.material for o in old for s in o.material_slots if s.material}
    for o in old:
        bpy.data.objects.remove(o)
    for m in meshes:
        if m.users == 0: bpy.data.meshes.remove(m)
    imgs = set()
    for m in mats:
        if m.name == "sohaib_stickers": continue
        if m.node_tree:
            imgs |= {n.image for n in m.node_tree.nodes if n.type == "TEX_IMAGE" and n.image}
        if m.users == 0: bpy.data.materials.remove(m)
    for im in imgs:
        if im.users == 0: bpy.data.images.remove(im)
    return len(old)


def material():
    img = bpy.data.images.get("sohaib_stickers_atlas")
    if img: bpy.data.images.remove(img)
    img = bpy.data.images.load(ATLAS_PNG); img.name = "sohaib_stickers_atlas"; img.pack()
    mat = bpy.data.materials.get("sohaib_stickers") or bpy.data.materials.new("sohaib_stickers")
    mat.use_nodes = True
    nt = mat.node_tree; nt.nodes.clear()
    out = nt.nodes.new("ShaderNodeOutputMaterial"); bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
    tex = nt.nodes.new("ShaderNodeTexImage"); tex.image = img; tex.interpolation = "Linear"
    nt.links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
    nt.links.new(tex.outputs["Alpha"], bsdf.inputs["Alpha"])
    nt.links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])
    bsdf.inputs["Roughness"].default_value = 0.55
    try: mat.surface_render_method = "BLENDED"
    except Exception: pass
    try: mat.blend_method = "BLEND"
    except Exception: pass
    mat.use_backface_culling = False
    return mat


def hit(theta, z, man, dg):
    t = math.radians(theta)
    d = Vector((-math.sin(t), math.cos(t), 0))          # pointing into the head
    o = Vector((0, axis_y(z), z)) - d * 2.0
    me = man.evaluated_get(dg)
    mi = man.matrix_world.inverted()
    ok, loc, nor, fi = me.ray_cast(mi @ o, (mi.to_3x3() @ d).normalized())
    if not ok: return None, None
    loc = man.matrix_world @ loc
    nor = (man.matrix_world.to_3x3() @ nor).normalized()
    return loc, nor


def theta_for_x(x, z, man, dg):
    """bisection: aim angle whose surface hit lands at world x (front-view position)"""
    if abs(x) < 1e-4: return 0.0
    s = 1 if x > 0 else -1
    lo, hi = 0.0, 88.0
    for _ in range(30):
        mid = (lo + hi) / 2
        l, _n = hit(s * mid, z, man, dg)
        if l is None or abs(l.x) > abs(x): hi = mid
        else: lo = mid
    return s * (lo + hi) / 2


def front_hit(x, z, man, dg):
    me = man.evaluated_get(dg); mi = man.matrix_world.inverted()
    ok, loc, nor, fi = me.ray_cast(mi @ Vector((x, -3.0, z)), (mi.to_3x3() @ Vector((0, 1, 0))).normalized())
    if not ok: return None, None
    return man.matrix_world @ loc, (man.matrix_world.to_3x3() @ nor).normalized()


def make_sticker(name, box, W, x, z, width, rot, man, mat, dg):
    loc, nor = front_hit(x, z, man, dg)
    if loc is None: raise RuntimeError(f"no hit for {name}")
    # average normal over the sticker footprint (smoother orientation on curved skin)
    acc = Vector()
    r = width * 0.35
    for dx in (-r, 0, r):
        for dz in (-r, 0, r):
            l2, n2 = front_hit(x + dx, z + dz, man, dg)
            if n2 and l2.y < -0.05: acc += n2
    nor = acc.normalized()
    aspect = box["h"] / box["w"]
    w, h = width, width * aspect
    up = Vector((0, 0, 1))
    xax = up.cross(nor).normalized()          # sticker +X (reads left->right as seen from outside)
    yax = nor.cross(xax).normalized()
    R = Matrix.Rotation(math.radians(rot), 3, nor)
    xax, yax = R @ xax, R @ yax
    bm = bmesh.new()
    bmesh.ops.create_grid(bm, x_segments=SUBDIV, y_segments=SUBDIV, size=0.5, calc_uvs=True)
    uvl = bm.loops.layers.uv.verify()
    u0, v0 = box["x"] / W, 1 - (box["y"] + box["h"]) / W
    du, dv = box["w"] / W, box["h"] / W
    for f in bm.faces:
        for l in f.loops:
            p = l.vert.co
            l[uvl].uv = (u0 + (p.x + 0.5) * du, v0 + (p.y + 0.5) * dv)
    for v in bm.verts:
        v.co = Vector((v.co.x * w, v.co.y * h, 0))
    me = bpy.data.meshes.new(name + "_mesh"); bm.to_mesh(me); bm.free()
    me.materials.append(mat)
    ob = bpy.data.objects.new(name, me)
    bpy.data.collections["Collection"].objects.link(ob)
    M = Matrix((xax, yax, nor)).transposed().to_4x4()
    M.translation = loc + nor * 0.02
    ob.matrix_world = M
    ob.parent = man; ob.matrix_parent_inverse = man.matrix_world.inverted()
    ob.matrix_world = M
    sw = ob.modifiers.new("Shrinkwrap", "SHRINKWRAP")
    sw.target = man; sw.wrap_method = "PROJECT"; sw.use_project_z = True
    sw.use_negative_direction = True; sw.use_positive_direction = True
    sw.offset = OFFSET; sw.wrap_mode = "OUTSIDE_SURFACE"
    if name in NEAREST_WRAP:          # sharp ridges (nose): projection tears the edges, nearest-point wraps cleanly
        sw.wrap_method = "NEAREST_SURFACEPOINT"; sw.offset = 0.0045
    for p in me.polygons: p.use_smooth = True
    return ob, loc, nor


def build(layout=LAYOUT):
    sc = bpy.context.scene; sc.frame_set(1)
    man = bpy.data.objects["man"]
    n_old = remove_old()
    mat = material()
    atlas = json.load(open(ATLAS_JSON)); W = atlas["size"]
    dg = bpy.context.evaluated_depsgraph_get()
    placed = {}
    for name, (aid, theta, z, width, rot, anchor) in layout.items():
        ob, loc, nor = make_sticker(name, atlas["boxes"][aid], W, theta, z, width, rot, man, mat, dg)
        placed[name] = (tuple(round(c, 3) for c in loc), anchor)
        if anchor:
            fo = bpy.data.objects[anchor]
            wm = fo.matrix_world.copy(); wm.translation = loc + nor * (OFFSET + 0.001)
            fo.matrix_world = wm
    return n_old, placed
