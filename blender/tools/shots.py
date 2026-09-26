# helper: render a set of temp-camera shots of a target point, restoring scene state afterwards
import bpy, math, os
from mathutils import Vector

OUT_DIR = os.environ.get("RENDER_OUT", os.path.join(os.path.dirname(bpy.data.filepath) if bpy.data.filepath else ".", "renders"))
os.makedirs(OUT_DIR, exist_ok=True)

def render_shots(shots, prefix, res=(600, 800), lens=50, engine=None, hide=(), show_only=None, frame=1, light=True):
    """shots: {name: (cam_loc, look_at)}"""
    sc = bpy.context.scene
    state = dict(cam=sc.camera, frame=sc.frame_current, rx=sc.render.resolution_x, ry=sc.render.resolution_y,
                 eng=sc.render.engine, fp=sc.render.filepath)
    hidden = []
    objs = list(bpy.context.view_layer.objects)
    for o in objs:
        want_hide = (o.name in hide) or (show_only is not None and o.name not in show_only and o.type != 'CAMERA')
        if want_hide and not o.hide_render:
            o.hide_render = True; hidden.append(o)
    sc.frame_set(frame)
    cd = bpy.data.cameras.new("tmp_cam"); cd.lens = lens; cd.clip_start = 0.01; cd.clip_end = 200
    co = bpy.data.objects.new("tmp_cam", cd); sc.collection.objects.link(co)
    tmp = [co]
    if light:
        for i, (loc, e) in enumerate((((-3, -4, 4), 800), ((4, -2, 3), 400), ((0, 5, 4), 500))):
            ld = bpy.data.lights.new(f"tmp_light{i}", "AREA"); ld.energy = e; ld.size = 3
            lo = bpy.data.objects.new(f"tmp_light{i}", ld); sc.collection.objects.link(lo)
            lo.location = loc
            d = Vector((0, 0, 0)) - lo.location
            lo.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()
            tmp.append(lo)
    sc.camera = co
    sc.render.resolution_x, sc.render.resolution_y = res
    if engine:
        try: sc.render.engine = engine
        except TypeError as e: print(e)
    out = []
    try:
        for name, (loc, at) in shots.items():
            co.location = Vector(loc)
            co.rotation_euler = (Vector(at) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
            fp = os.path.join(OUT_DIR, f"{prefix}_{name}.png")
            sc.render.filepath = fp
            bpy.ops.render.render(write_still=True)
            out.append(fp)
    finally:
        sc.camera = state['cam']; sc.frame_set(state['frame'])
        sc.render.resolution_x, sc.render.resolution_y = state['rx'], state['ry']
        sc.render.engine = state['eng']; sc.render.filepath = state['fp']
        for o in hidden: o.hide_render = False
        for o in tmp:
            d = o.data; bpy.data.objects.remove(o)
            if isinstance(d, bpy.types.Camera): bpy.data.cameras.remove(d)
            else: bpy.data.lights.remove(d)
    return out
