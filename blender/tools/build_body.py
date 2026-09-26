import bpy, bmesh
from mathutils import Vector

def build_body(b=0.85, d=0.10, k=2.75, ratio=0.08):
    old = bpy.data.objects.get("sohaib_work")
    if old:
        me = old.data; bpy.data.objects.remove(old); bpy.data.meshes.remove(me)
    src = bpy.data.objects["model"]
    w = src.copy(); w.data = src.data.copy(); w.name = "sohaib_work"; w.data.name = "sohaib_body_mesh"
    bpy.data.collections["_import"].objects.link(w)
    w.hide_set(False); w.hide_render = False
    bm = bmesh.new(); bm.from_mesh(w.data)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    bm.to_mesh(w.data); bm.free()
    m = w.modifiers.new("dec", "DECIMATE"); m.decimate_type = "COLLAPSE"; m.ratio = ratio
    bpy.context.view_layer.objects.active = w
    for o in bpy.context.selected_objects: o.select_set(False)
    w.select_set(True)
    bpy.ops.object.modifier_apply(modifier="dec")
    mw = w.matrix_world.copy()
    E = Vector((-0.04, 0.005, 1.694)); E2 = Vector((0.0, 0.0, 0.486))
    P = Vector((-0.045, 0.01, 1.58))
    z_hi, z_lo = 1.62, 1.50
    sm = lambda t: (lambda u: u * u * (3 - 2 * u))(max(0.0, min(1.0, t)))
    for v in w.data.vertices:
        p = mw @ v.co
        t = sm((p.z - z_lo) / (z_hi - z_lo))
        f = b + (1 - b) * t
        q = P + (p - P) * f
        q.z -= d * (1 - t)
        v.co = (q - E) * k + E2
    w.matrix_world.identity()
    w.data.update()
    zs = [v.co.z for v in w.data.vertices]
    return w, min(zs), max(zs), len(w.data.polygons)
