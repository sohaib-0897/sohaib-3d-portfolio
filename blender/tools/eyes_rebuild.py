"""Face-correction pass (2026-09-26): natural eyes.

Rebuilds eye1/eye2 as smooth, smaller ellipsoid eyeballs with a painted dark-brown iris (texture depends only on
latitude from the pupil axis, UV v = 1 - angle/180), and adds a static `lids` mesh (upper + lower eyelid shells with
a lash line) parented to `man`. Eye objects keep their names / locations / base rotation, so the site's
eye-follow (rotates every /eye/i mesh) keeps working; the lids never rotate. No new name contains "eye".

Run headless:  blender --background <file.blend> --python eyes_rebuild.py   (saves the file)
"""
import bpy, bmesh, math
import numpy as np
from mathutils import Vector, Matrix
from mathutils.bvhtree import BVHTree

P = dict(
    radii=(0.052, 0.049, 0.046),      # world eyeball radii: across, up, forward (was .064/.056/.053)
    iris_deg=33.0, pupil_deg=13.5, limbus_deg=3.5,
    lid_scale=1.05,                   # lid shell radius / eyeball radius
    up_edge=0.50, lo_edge=-0.52,      # lid edges at the pupil column (normalised front coords)
    canthal=0.06,                     # outer corner lift
    width=0.90,
    tilt=-0.08,                       # head roll: dz/dx of the eye line (glasses are rolled the same way)
)


def srgb2lin(c):
    c = np.asarray(c, np.float64)
    return np.where(c <= 0.04045, c / 12.92, ((c + 0.055) / 1.055) ** 2.4)


def eye_texture(size=1024):
    H = W = size
    v = (np.arange(H) + 0.5) / H
    u = (np.arange(W) + 0.5) / W
    U, V = np.meshgrid(u, v)
    a = (1 - V) * 180.0                              # degrees from the pupil axis
    rng = np.random.default_rng(3)
    ir, pu, lb = P["iris_deg"], P["pupil_deg"], P["limbus_deg"]
    sclera_in = np.array([0.93, 0.91, 0.88]); sclera_out = np.array([0.80, 0.76, 0.73])
    col = sclera_in + (sclera_out - sclera_in) * np.clip((a - ir) / 70, 0, 1)[..., None]
    # iris: dark brown, lighter ring around the pupil, radial fibres
    t = np.clip((a - pu) / (ir - pu), 0, 1)
    inner = np.array([0.36, 0.22, 0.12]); outer = np.array([0.17, 0.10, 0.06])
    iris = inner + (outer - inner) * t[..., None] ** 0.8
    fib = (np.sin(U * 2 * np.pi * 90 + rng.random() * 6) * 0.5 + np.sin(U * 2 * np.pi * 37) * 0.5)
    noise = rng.random((H, W)) * 0.5
    iris *= (0.88 + 0.12 * fib + 0.1 * (noise - 0.25))[..., None]
    col = np.where((a < ir)[..., None], iris, col)
    # limbal ring (soft) and pupil
    lim = np.exp(-((a - ir) / lb) ** 2)[..., None]
    col = col * (1 - 0.75 * lim) + np.array([0.05, 0.035, 0.03]) * 0.75 * lim
    pup = np.clip((pu + 0.8 - a) / 1.6, 0, 1)[..., None]
    col = col * (1 - pup) + np.array([0.02, 0.018, 0.018]) * pup
    img = bpy.data.images.get("eye_natural")
    if img: bpy.data.images.remove(img)
    img = bpy.data.images.new("eye_natural", W, H, alpha=True)
    px = np.concatenate([np.clip(col, 0, 1), np.ones((H, W, 1))], -1).astype(np.float32)
    img.pixels.foreach_set(px.ravel()); img.update(); img.pack()
    return img


def eyeball_mesh():
    rx, ry, rz = P["radii"]
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=40, v_segments=24, radius=1.0)
    uvl = bm.loops.layers.uv.verify()
    for f in bm.faces:
        us = []
        for l in f.loops:
            c = l.vert.co.normalized()
            us.append((math.atan2(c.y, c.x) / (2 * math.pi)) % 1.0)
        if max(us) - min(us) > 0.5:
            us = [x + 1.0 if x < 0.5 else x for x in us]
        for l, uu in zip(f.loops, us):
            c = l.vert.co.normalized()
            l[uvl].uv = (uu, 1 - math.acos(max(-1, min(1, c.z))) / math.pi)
    for vt in bm.verts:
        vt.co = Vector((vt.co.x * rx, vt.co.y * ry, vt.co.z * rz))   # local x = across, y = up, z = forward
    for f in bm.faces: f.smooth = True
    me = bpy.data.meshes.new("eyeball_natural"); bm.to_mesh(me); bm.free()
    return me


def eye_material(img):
    mat = bpy.data.objects["eye1"].data.materials[0]
    nt = mat.node_tree
    tex = next(n for n in nt.nodes if n.type == "TEX_IMAGE")
    tex.image = img
    bsdf = next(n for n in nt.nodes if n.type == "BSDF_PRINCIPLED")
    bsdf.inputs["Roughness"].default_value = 0.18
    return mat


def lid_frame(eye):
    r = Vector((1, 0, P["tilt"])).normalized()
    u = Vector((-P["tilt"], 0, 1)).normalized()
    f = Vector((0, -1, 0))
    outer = 1 if eye.matrix_world.translation.x > 0 else -1
    return eye.matrix_world.translation.copy(), r, u, f, outer


def build_lids(eyes, mat_skin, mat_lash, mat_rim):
    rx, ry, rz = P["radii"]
    ls = P["lid_scale"]
    w = P["width"]
    bm = bmesh.new()
    uvl = bm.loops.layers.uv.verify()
    rows_t = [0.0, 0.07, 0.16, 0.30, 0.46, 0.64, 0.82, 1.0]
    NC = 56
    faces_mat = []

    def pt(C, r, u, f, X, Z, scale, back=0.0):
        F = math.sqrt(max(0.0, 1 - X * X - Z * Z))
        d = X * r + Z * u + F * f
        if back:
            d = d * math.cos(back) - f * math.sin(back)
        # ellipsoid: scale each world component by radius along (r,u,f)
        loc = (d.dot(r) * rx) * r + (d.dot(u) * ry) * u + (d.dot(f) * rz) * f
        return C + loc * scale

    for eye in eyes:
        C, r, u, f, outer = lid_frame(eye)
        for upper in (True, False):
            grid = []          # rows: [rim_inner, edge, ... rows ..., back]
            for i in range(NC + 1):
                X = -1 + 2 * i / NC
                X = max(-0.999, min(0.999, X))
                q = max(0.0, 1 - (X / w) ** 2)
                canth = P["canthal"] * X * outer
                ztop = math.sqrt(max(0.0, 1 - X * X)) * 0.999
                if upper:
                    ze = P["up_edge"] * q ** 0.7 + canth
                    ze = max(-ztop, min(ztop, ze))
                    zs = [ze + (ztop - ze) * t for t in rows_t]
                else:
                    ze = P["lo_edge"] * q ** 0.8 + canth
                    ze = max(-ztop, min(ztop, ze))
                    zs = [ze + (-ztop - ze) * t for t in rows_t]
                # shell hugs the eyeball away from the opening: ls at the edge -> 1.015 at the far rows
                sc_t = [ls - (ls - 1.015) * min(1.0, t / 0.6) ** 1.5 for t in rows_t]
                col = [pt(C, r, u, f, X, zs[0], 1.006)]
                col += [pt(C, r, u, f, X, z, s) for z, s in zip(zs, sc_t)]
                col.append(pt(C, r, u, f, X, zs[-1], 0.995, back=math.radians(35)))
                grid.append([bm.verts.new(p) for p in col])
            for i in range(NC):
                for j in range(len(grid[0]) - 1):
                    a, b, c, d = grid[i][j], grid[i + 1][j], grid[i + 1][j + 1], grid[i][j + 1]
                    try:
                        fc = bm.faces.new((a, b, c, d) if upper else (a, d, c, b))
                    except ValueError:
                        continue
                    fc.smooth = True
                    if j == 0: fc.material_index = 1 if upper else 2          # rim (lid thickness)
                    elif j == 1 and upper: fc.material_index = 1              # upper lash line
                    else: fc.material_index = 0
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-6)
    # open shells: orient every face away from its eyeball centre (recalc_face_normals can pick inward)
    centres = [e.matrix_world.translation for e in eyes]
    for fc in bm.faces:
        c = fc.calc_center_median()
        eC = min(centres, key=lambda q: (q - c).length)
        if fc.normal.dot(c - eC) < 0: fc.normal_flip()
    bm.normal_update()
    me = bpy.data.meshes.new("lids_mesh"); bm.to_mesh(me); bm.free()
    for m in (mat_skin, mat_lash, mat_rim): me.materials.append(m)
    # UVs: copy the face texture from the nearest skin point so the lids match the surrounding skin exactly
    man = bpy.data.objects["man"]
    dg = bpy.context.evaluated_depsgraph_get()
    mesh = man.data
    bvh = BVHTree.FromObject(man, dg)
    mi = man.matrix_world.inverted()
    uvsrc = mesh.uv_layers.active.data
    uvdst = me.uv_layers[0].data          # bmesh already created the (only) UV layer
    cache = {}
    for poly in me.polygons:
        for li in poly.loop_indices:
            vi = me.loops[li].vertex_index
            if vi not in cache:
                p = me.vertices[vi].co
                eyeC = min(eyes, key=lambda e: (e.matrix_world.translation - p).length).matrix_world.translation
                # one clean skin texel per eye (upper cheek just under the eye): per-vertex sampling around the old
                # eye area picked up dark specks and read as patchy, jagged lids in close-ups
                q = eyeC + Vector((0, -0.045, -0.075))
                loc, nor, fi, dist = bvh.find_nearest(mi @ q)
                pg = mesh.polygons[fi]
                # barycentric on the polygon's first triangle fan
                vs = [mesh.vertices[mesh.loops[k].vertex_index].co for k in pg.loop_indices]
                uvs = [Vector(uvsrc[k].uv) for k in pg.loop_indices]
                best = None
                for k in range(1, len(vs) - 1):
                    from mathutils.geometry import barycentric_transform
                    uvp = barycentric_transform(loc, vs[0], vs[k], vs[k + 1], uvs[0].to_3d(), uvs[k].to_3d(), uvs[k + 1].to_3d())
                    dd = (loc - (vs[0] + vs[k] + vs[k + 1]) / 3).length
                    if best is None or dd < best[0]: best = (dd, uvp)
                cache[vi] = best[1].to_2d()
            uvdst[li].uv = cache[vi]
    ob = bpy.data.objects.get("lids")
    if ob:
        old = ob.data; bpy.data.objects.remove(ob); bpy.data.meshes.remove(old)
    ob = bpy.data.objects.new("lids", me)
    bpy.data.collections["Collection"].objects.link(ob)
    ob.parent = man; ob.matrix_parent_inverse = man.matrix_world.inverted()
    return ob


def simple_mat(name, rgb, rough):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.use_nodes = True
    b = next(n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    b.inputs["Base Color"].default_value = (*srgb2lin(rgb), 1)
    b.inputs["Roughness"].default_value = rough
    return m


def run():
    sc = bpy.context.scene; sc.frame_set(1)
    eyes = [bpy.data.objects["eye1"], bpy.data.objects["eye2"]]
    img = eye_texture()
    mat = eye_material(img)
    me = eyeball_mesh(); me.materials.append(mat)
    for e in eyes:
        old = e.data
        mw = e.matrix_world.copy()
        e.data = me
        e.scale = (1, 1, 1)
        if old.users == 0: bpy.data.meshes.remove(old)
    old_img = bpy.data.images.get("eye")
    if old_img and old_img.users == 0: bpy.data.images.remove(old_img)
    bpy.context.view_layer.update()
    skin = bpy.data.materials["sohaib_body"]
    lash = simple_mat("lid_lash", (0.07, 0.05, 0.045), 0.6)
    rim = simple_mat("lid_rim", (0.62, 0.40, 0.36), 0.45)
    lids = build_lids(eyes, skin, lash, rim)
    return len(lids.data.vertices)


if __name__ == "__main__":
    print("lids verts", run())
    bpy.ops.wm.save_mainfile(compress=True)
