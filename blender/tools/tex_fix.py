import bpy, math
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree

MAN = bpy.data.objects["man"]

def pixel_ray(cam_loc, look_at, res, px, py, lens=50.0, sensor=36.0):
    """world hit on man for a pixel of a shots.py render (sensor fit = larger dimension)"""
    W, H = res
    f = lens / sensor * max(W, H)
    q = (Vector(look_at) - Vector(cam_loc)).to_track_quat("-Z", "Y")
    d_cam = Vector(((px - W / 2) / f, -(py - H / 2) / f, -1.0))
    d = (q.to_matrix() @ d_cam).normalized()
    mi = MAN.matrix_world.inverted()
    ok, loc, n, fi = MAN.ray_cast(mi @ Vector(cam_loc), (mi.to_3x3() @ d).normalized())
    return (MAN.matrix_world @ loc, fi) if ok else (None, None)

def face_uv_tris(face_indices):
    me = MAN.data
    uv = me.uv_layers.active.data
    tris = []
    for fi in face_indices:
        p = me.polygons[fi]
        li = list(p.loop_indices)
        for k in range(1, len(li) - 1):
            tris.append((tuple(uv[li[0]].uv), tuple(uv[li[k]].uv), tuple(uv[li[k + 1]].uv)))
    return tris

def raster_mask(tris, size, dilate=2):
    W, H = size
    mask = np.zeros((H, W), dtype=bool)
    for (a, b, c) in tris:
        P = np.array([a, b, c]) * np.array([W, H])
        x0, y0 = np.floor(P.min(0)).astype(int) - dilate
        x1, y1 = np.ceil(P.max(0)).astype(int) + dilate
        x0, y0 = max(x0, 0), max(y0, 0); x1, y1 = min(x1, W - 1), min(y1, H - 1)
        if x1 < x0 or y1 < y0:
            continue
        xs, ys = np.meshgrid(np.arange(x0, x1 + 1) + 0.5, np.arange(y0, y1 + 1) + 0.5)
        (ax, ay), (bx, by), (cx, cy) = P
        den = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy)
        if abs(den) < 1e-12:
            continue
        l1 = ((by - cy) * (xs - cx) + (cx - bx) * (ys - cy)) / den
        l2 = ((cy - ay) * (xs - cx) + (ax - cx) * (ys - cy)) / den
        l3 = 1 - l1 - l2
        e = dilate / max(1.0, abs(den) ** 0.5)
        inside = (l1 >= -e) & (l2 >= -e) & (l3 >= -e)
        mask[y0:y1 + 1, x0:x1 + 1] |= inside
    return mask

def faces_near_point(center, radius):
    mw = MAN.matrix_world
    c = Vector(center)
    return [p.index for p in MAN.data.polygons if (mw @ p.center - c).length < radius]

def faces_near_object(obj, dist):
    dg = bpy.context.evaluated_depsgraph_get()
    ob = obj.evaluated_get(dg)
    bvh = BVHTree.FromObject(ob, dg)
    to_obj = obj.matrix_world.inverted() @ MAN.matrix_world
    out = []
    for p in MAN.data.polygons:
        hit = bvh.find_nearest(to_obj @ p.center)
        if hit[0] is not None and hit[3] < dist:
            out.append(p.index)
    return out
