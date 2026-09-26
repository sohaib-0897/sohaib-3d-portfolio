# Builds the lanyard + career badge + interaction anchors in sohaib.blend (idempotent: re-running replaces them).
# Run inside Blender via MCP: exec(open(r".../blender/tools/lanyard_build.py").read()); build()
#
# Objects (all in `Collection`, all parented to `man` so they follow manAction; no name contains "eye"):
#   lanyard            ribbon strap around the collar base, converging at the clip
#   lanyard_clip       metal clip block + split ring through the badge slot
#   career_badge       rounded card, front = blender/lanyard/badge.png, back/rim plain
#   watch_interaction  EMPTY at the watch face centre (parented to watch_left) — web hit-target anchor
#   shoes_interaction  EMPTY between the clogs at toe-top height — web hit-target anchor
import bpy, bmesh, math, os
from mathutils import Vector, Matrix
from mathutils.bvhtree import BVHTree

_base = os.path.dirname(bpy.data.filepath) if bpy.data.filepath else os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ROOT = os.path.dirname(_base) if os.path.basename(_base) == "blender" else _base
BADGE_PNG = os.path.join(ROOT, "blender", "lanyard", "badge.png")
NAMES = ("lanyard", "lanyard_clip", "career_badge", "watch_interaction", "shoes_interaction")

P = dict(
    strap_w=0.040,        # ribbon width
    strap_t=0.004,        # ribbon thickness
    strap_off=0.010,      # clearance above the body surface
    snap_tol=0.045,       # points closer than this to the body are laid onto it
    card_w=0.16, card_h=0.24, card_r=0.013, card_t=0.0045,
    card_gap=0.045,       # clip junction → card top
    card_clear=0.014,     # min clearance card back ↔ chest
    strap_rgb=(0.20, 0.33, 0.36),   # muted slate teal (sRGB)
)

# Strap route (character space at frame 1; character faces -Y, LEFT = +X). Right half only, mirrored for the left.
# FRONT: (x, z) samples on the lapel / chest, hit by rays from the front (+Y) — strap lies OVER the collar.
# RING:  (angle°, z) samples around the collar base, hit by horizontal rays aimed at the neck axis
#        (angle measured in XY from -Y = front, positive toward -X = character right; 180 = back).
FRONT = [(-0.020, -0.535), (-0.055, -0.490), (-0.095, -0.420), (-0.140, -0.330), (-0.185, -0.240), (-0.230, -0.150)]
RING = [(70, -0.090), (95, -0.070), (125, -0.050), (155, -0.035), (180, -0.030)]
NECK_AXIS = (0.0, 0.15)


def srgb(c):
    return tuple(((x + 0.055) / 1.055) ** 2.4 if x > 0.04045 else x / 12.92 for x in c)


def _remove_old():
    for n in NAMES:
        o = bpy.data.objects.get(n)
        if o:
            d = o.data
            bpy.data.objects.remove(o, do_unlink=True)
            if d is not None and d.users == 0:
                if isinstance(d, bpy.types.Mesh): bpy.data.meshes.remove(d)


def _body_bvh():
    man = bpy.data.objects["man"]
    dg = bpy.context.evaluated_depsgraph_get()
    ev = man.evaluated_get(dg)
    me = ev.to_mesh()
    mw = man.matrix_world
    verts = [mw @ v.co for v in me.vertices]
    polys = [tuple(p.vertices) for p in me.polygons]
    ev.to_mesh_clear()
    return BVHTree.FromPolygons(verts, polys), verts


def _mat(name, rgb=None, rough=0.5, metal=0.0, image=None):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    bsdf = next(n for n in nt.nodes if n.type == "BSDF_PRINCIPLED")
    if rgb is not None:
        bsdf.inputs["Base Color"].default_value = (*srgb(rgb), 1)
    bsdf.inputs["Roughness"].default_value = rough
    bsdf.inputs["Metallic"].default_value = metal
    for n in [n for n in nt.nodes if n.type == "TEX_IMAGE"]:
        nt.nodes.remove(n)
    if image is not None:
        tex = nt.nodes.new("ShaderNodeTexImage"); tex.image = image; tex.location = (-400, 200)
        nt.links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
    return m


def _chaikin(pts, it=3):
    for _ in range(it):
        out = [pts[0]]
        for a, b in zip(pts[:-1], pts[1:]):
            out += [a.lerp(b, 0.25), a.lerp(b, 0.75)]
        out.append(pts[-1]); pts = out
    return pts


def _resample(pts, n):
    L = [0.0]
    for a, b in zip(pts[:-1], pts[1:]): L.append(L[-1] + (b - a).length)
    tot = L[-1]; out = []; j = 0
    for i in range(n):
        s = tot * i / (n - 1)
        while j < len(L) - 2 and L[j + 1] < s: j += 1
        t = (s - L[j]) / max(1e-9, L[j + 1] - L[j])
        out.append(pts[j].lerp(pts[j + 1], t))
    return out


def _lay_on_body(bvh, pts, push_only=False):
    out, nrm = [], []
    for p in pts:
        loc, n, _, dist = bvh.find_nearest(p)
        if loc is None:
            out.append(p); nrm.append(Vector((0, -1, 0))); continue
        d = p - loc
        side = d.dot(n)
        if side < 0 or dist < P["strap_off"] or (not push_only and dist < P["snap_tol"]):
            q = loc + n * P["strap_off"]
        else:
            q = p
        out.append(q)
        nrm.append(n.normalized() if side >= 0 else n.normalized())
    return out, nrm


def _smooth(pts, it=4, keep_ends=True):
    for _ in range(it):
        new = pts[:]
        for i in range(1, len(pts) - 1):
            new[i] = pts[i] * 0.5 + (pts[i - 1] + pts[i + 1]) * 0.25
        pts = new
    return pts


def _ribbon(name, pts, nrm, width, mat):
    me = bpy.data.meshes.new(name)
    bm = bmesh.new()
    uv = bm.loops.layers.uv.new("UVMap")
    left, right = [], []
    L = 0.0
    for i, p in enumerate(pts):
        t = (pts[min(i + 1, len(pts) - 1)] - pts[max(i - 1, 0)]).normalized()
        n = nrm[i] - t * nrm[i].dot(t); n.normalize()
        w = t.cross(n).normalized()
        left.append(bm.verts.new(p - w * width / 2)); right.append(bm.verts.new(p + w * width / 2))
    bm.verts.ensure_lookup_table()
    acc = [0.0]
    for a, b in zip(pts[:-1], pts[1:]): acc.append(acc[-1] + (b - a).length)
    for i in range(len(pts) - 1):
        f = bm.faces.new((left[i], right[i], right[i + 1], left[i + 1]))
        for loop, (u, v) in zip(f.loops, ((0, acc[i]), (1, acc[i]), (1, acc[i + 1]), (0, acc[i + 1]))):
            loop[uv].uv = (u, v / width)
    bm.normal_update()
    bm.to_mesh(me); bm.free()
    for poly in me.polygons: poly.use_smooth = True
    o = bpy.data.objects.new(name, me)
    o.data.materials.append(mat)
    return o


def _link(o, parent):
    coll = bpy.data.collections["Collection"]
    coll.objects.link(o)
    mw = o.matrix_world.copy()
    o.parent = parent
    o.matrix_parent_inverse = parent.matrix_world.inverted()
    o.matrix_world = mw


def _to_local(o, man):
    # bake world-space vertex coords into man-local mesh data, then parent with identity inverse
    inv = man.matrix_world.inverted()
    o.data.transform(inv)
    coll = bpy.data.collections["Collection"]
    coll.objects.link(o)
    o.parent = man
    o.matrix_parent_inverse = Matrix.Identity(4)
    o.matrix_world = man.matrix_world.copy()


def build(report=True):
    sc = bpy.context.scene
    keep_frame = sc.frame_current
    sc.frame_set(1)
    _remove_old()
    man = bpy.data.objects["man"]
    bvh, body_verts = _body_bvh()

    # ---------- strap ----------
    off = P["strap_off"]
    right = []
    for x, z in FRONT:
        hit = bvh.ray_cast(Vector((x, -2.0, z)), Vector((0, 1, 0)), 5.0)
        right.append(hit[0] + Vector((0, -off, 0)))
    cx, cy = NECK_AXIS
    for ang, z in RING:
        a = math.radians(ang)
        d = Vector((-math.sin(a), -math.cos(a), 0))          # outward direction from the neck axis
        o = Vector((cx, cy, z)) + d * 1.2
        hit = bvh.ray_cast(o, -d, 2.0)
        right.append(hit[0] + d * off)
    right[-1].x = 0.0
    ctrl = right + [Vector((-p.x, p.y, p.z)) for p in reversed(right[:-1])]
    pts = _resample(_chaikin(ctrl, 3), 200)
    for _ in range(4):
        pts, nrm = _lay_on_body(bvh, pts, push_only=True)
        pts = _smooth(pts, 6)
    pts, nrm = _lay_on_body(bvh, pts, push_only=True)
    # smooth normals along the path
    for _ in range(6):
        nrm = [nrm[0]] + [(nrm[i - 1] + nrm[i] * 2 + nrm[i + 1]).normalized() for i in range(1, len(nrm) - 1)] + [nrm[-1]]
    strap_mat = _mat("lanyard_strap", P["strap_rgb"], rough=0.62)
    strap = _ribbon("lanyard", pts, nrm, P["strap_w"], strap_mat)
    sol = strap.modifiers.new("thickness", "SOLIDIFY"); sol.thickness = P["strap_t"]; sol.offset = 1.0
    _to_local(strap, man)

    # ---------- clip + ring ----------
    metal = _mat("lanyard_metal", (0.78, 0.79, 0.80), rough=0.28, metal=1.0)
    J = (pts[0] + pts[-1]) * 0.5
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, vec=(0.050, 0.014, 0.030), verts=bm.verts)
    bmesh.ops.bevel(bm, geom=list(bm.edges), offset=0.004, segments=2, affect="EDGES")
    bmesh.ops.translate(bm, vec=J + Vector((0, -0.004, -0.004)), verts=bm.verts)
    # split ring through the badge slot: small torus in the card plane's side view (YZ plane)
    ring_c = J + Vector((0, -0.006, -0.030))
    RR, rr, SEG, SIDES = 0.0125, 0.0022, 20, 8
    rows = []
    for i in range(SEG):
        a = 2 * math.pi * i / SEG
        c = ring_c + Vector((0, RR * math.cos(a), RR * math.sin(a)))
        radial = Vector((0, math.cos(a), math.sin(a)))
        row = []
        for j in range(SIDES):
            b = 2 * math.pi * j / SIDES
            row.append(bm.verts.new(c + radial * (rr * math.cos(b)) + Vector((rr * math.sin(b), 0, 0))))
        rows.append(row)
    for i in range(SEG):
        for j in range(SIDES):
            a, b = rows[i][j], rows[i][(j + 1) % SIDES]
            c, d = rows[(i + 1) % SEG][(j + 1) % SIDES], rows[(i + 1) % SEG][j]
            bm.faces.new((a, b, c, d))
    bm.normal_update()
    clip_me = bpy.data.meshes.new("lanyard_clip"); bm.to_mesh(clip_me); bm.free()
    clip = bpy.data.objects.new("lanyard_clip", clip_me); clip.data.materials.append(metal)
    _to_local(clip, man)

    # ---------- card ----------
    W, H, R = P["card_w"], P["card_h"], P["card_r"]
    top_z = J.z - P["card_gap"]
    bot_z = top_z - H
    # frontmost body surface in the card footprint (ray from the front along +Y)
    front = []
    for zz in [top_z - i * H / 8 for i in range(9)]:
        for xx in (-W / 2, -W / 4, 0, W / 4, W / 2):
            hit = bvh.ray_cast(Vector((xx, -2.0, zz)), Vector((0, 1, 0)), 5.0)
            if hit[0] is not None: front.append((zz, hit[0].y))
    y_top = min(y for z, y in front if z >= (top_z + bot_z) / 2) - P["card_clear"] - P["card_t"]
    y_bot = min(y for z, y in front if z < (top_z + bot_z) / 2) - P["card_clear"] - P["card_t"]
    tilt = math.atan2(y_top - y_bot, H)   # lean to follow the chest
    corner = []
    for cx, cz, a0 in ((W / 2 - R, H / 2 - R, 0), (-W / 2 + R, H / 2 - R, 90), (-W / 2 + R, -H / 2 + R, 180), (W / 2 - R, -H / 2 + R, 270)):
        for k in range(7):
            a = math.radians(a0 + 90 * k / 6)
            corner.append((cx + R * math.cos(a), cz + R * math.sin(a)))
    bm = bmesh.new(); uv = bm.loops.layers.uv.new("UVMap")
    vs = [bm.verts.new((x, 0, z)) for x, z in corner]
    f = bm.faces.new(vs)
    # face must point toward -Y (front)
    bm.normal_update()
    if f.normal.y > 0: f.normal_flip()
    for loop in f.loops:
        x, _, z = loop.vert.co
        loop[uv].uv = ((x + W / 2) / W, (z + H / 2) / H)
    bmesh.ops.triangulate(bm, faces=[f])
    card_me = bpy.data.meshes.new("career_badge"); bm.to_mesh(card_me); bm.free()
    img = bpy.data.images.load(BADGE_PNG, check_existing=True); img.name = "career_badge_art"; img.pack()
    card = bpy.data.objects.new("career_badge", card_me)
    card.data.materials.append(_mat("career_badge_front", rough=0.32, image=img))
    card.data.materials.append(_mat("career_badge_back", (0.07, 0.08, 0.09), rough=0.5))
    card.data.materials.append(_mat("career_badge_rim", (0.80, 0.82, 0.83), rough=0.25))
    sol = card.modifiers.new("thickness", "SOLIDIFY"); sol.thickness = P["card_t"]; sol.offset = -1.0
    sol.material_offset = 1; sol.material_offset_rim = 2
    # bake placement into the mesh (object not linked yet, so build the matrix explicitly)
    place = Matrix.Translation((0, (y_top + y_bot) / 2, (top_z + bot_z) / 2)) @ Matrix.Rotation(-tilt, 4, "X")
    card.data.transform(place)
    _to_local(card, man)

    # ---------- interaction anchors ----------
    watch = bpy.data.objects["watch_left"]
    wv = [watch.matrix_world @ Vector(c) for c in watch.bound_box]
    wc = sum(wv, Vector()) / 8
    # hit size is encoded in the empty's SCALE (plain node transform in the glb; no glTF extras needed):
    # watch_interaction = unit sphere scaled to the watch radius, shoes_interaction = unit cube scaled to the clog box.
    we = bpy.data.objects.new("watch_interaction", None); we.empty_display_type = "SPHERE"; we.empty_display_size = 1.0
    r = round(max((v - wc).length for v in wv), 3)
    we.location = wc; we.scale = (r, r, r)
    bpy.data.collections["Collection"].objects.link(we)
    we.parent = watch; we.matrix_parent_inverse = watch.matrix_world.inverted()

    zmin = min(v.z for v in body_verts)
    fx = [v for v in body_verts if v.z < zmin + 0.35]          # both clogs
    lo = Vector((min(v.x for v in fx), min(v.y for v in fx), min(v.z for v in fx)))
    hi = Vector((max(v.x for v in fx), max(v.y for v in fx), max(v.z for v in fx)))
    sc_c = (lo + hi) / 2
    se = bpy.data.objects.new("shoes_interaction", None); se.empty_display_type = "CUBE"; se.empty_display_size = 1.0
    se.location = sc_c
    se.scale = tuple(round(c, 3) for c in (hi - lo) / 2)      # half extents in man-local axes
    bpy.data.collections["Collection"].objects.link(se)
    se.parent = man; se.matrix_parent_inverse = man.matrix_world.inverted()

    sc.frame_set(keep_frame)
    if report:
        print("junction", tuple(round(c, 3) for c in J), "card top/bot z", round(top_z, 3), round(bot_z, 3),
              "card y", round(y_top, 3), round(y_bot, 3), "tilt deg", round(math.degrees(tilt), 2))
        print("watch_interaction", tuple(round(c, 3) for c in wc), "r", r,
              "shoes_interaction", tuple(round(c, 3) for c in sc_c), "half extents", tuple(se.scale))
        bad = [o.name for o in bpy.data.objects if "eye" in o.name.lower() and o.name not in ("eye1", "eye2")]
        print("eye-name check:", bad or "ok")
    return strap, clip, card, we, se
