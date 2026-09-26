import bpy, bmesh, math
from mathutils import Vector, Matrix

def mat(name, rgba, rough, metal=0.0):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    b = next(n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
    b.inputs["Base Color"].default_value = rgba
    b.inputs["Roughness"].default_value = rough
    b.inputs["Metallic"].default_value = metal
    m.diffuse_color = rgba
    return m

def build_watch(C, A, radii, face_turn_deg=25.0, time_text="10:58"):
    coll = bpy.data.collections["Collection"]
    man = bpy.data.objects["man"]
    old = bpy.data.objects.get("watch_left")
    if old:
        me = old.data; bpy.data.objects.remove(old); bpy.data.meshes.remove(me)
    M_black = mat("watch_resin", (0.012, 0.012, 0.013, 1), 0.5)
    M_lcd = mat("watch_lcd", (0.50, 0.54, 0.46, 1), 0.25)
    M_dig = mat("watch_digits", (0.01, 0.01, 0.01, 1), 0.4)
    M_ring = mat("watch_bezel_accent", (0.08, 0.08, 0.085, 1), 0.3, 0.6)

    U = A.cross(Vector((0, 0, 1))).normalized(); V = A.cross(U).normalized()
    want = Vector((math.cos(math.radians(face_turn_deg)), -math.sin(math.radians(face_turn_deg)), 0))
    n = (want - A * want.dot(A)).normalized()
    a_face = math.atan2(n.dot(V), n.dot(U))
    ang = [a for a, r in radii]; rs = [r for a, r in radii]
    def r_at(a):
        a = a % (2 * math.pi); step = 2 * math.pi / len(rs); i = int(a // step); t = (a - i * step) / step
        return rs[i] * (1 - t) + rs[(i + 1) % len(rs)] * t
    r_face = r_at(a_face)

    objs = []
    # --- band (hugs the arm) ---
    bm = bmesh.new(); N = 64; half = 0.026; th = 0.013; gap = 0.004
    rings = []
    for i in range(N):
        a = 2 * math.pi * i / N; d = U * math.cos(a) + V * math.sin(a); r = r_at(a) + gap
        rings.append([bm.verts.new(C + d * r - A * half), bm.verts.new(C + d * (r + th) - A * half),
                      bm.verts.new(C + d * (r + th) + A * half), bm.verts.new(C + d * r + A * half)])
    for i in range(N):
        a, b = rings[i], rings[(i + 1) % N]
        for k in range(4):
            bm.faces.new((a[k], b[k], b[(k + 1) % 4], a[(k + 1) % 4]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    me = bpy.data.meshes.new("watch_band"); bm.to_mesh(me); bm.free()
    me.materials.append(M_black)
    for p in me.polygons:
        p.use_smooth = True
    # keep the band's rim edges crisp: mark edges between strip sides as sharp
    import bmesh as _b
    bm2 = _b.new(); bm2.from_mesh(me)
    for e in bm2.edges:
        if len(e.link_faces) == 2 and e.link_faces[0].normal.angle(e.link_faces[1].normal) > math.radians(45):
            e.smooth = False
    bm2.to_mesh(me); bm2.free()
    band = bpy.data.objects.new("watch_band", me); coll.objects.link(band); objs.append(band)

    # local watch frame: X = along arm (3 o'clock toward hand), Z = out of wrist, Y = 12 o'clock
    X = A.normalized(); Z = n; Y = Z.cross(X).normalized()
    base = C + n * (r_face + gap + th)
    case_h = 0.036
    F = Matrix((X, Y, Z)).transposed().to_4x4()
    def place(o, local):
        o.matrix_world = Matrix.Translation(base) @ F @ local
    # --- case: chunky octagon ---
    bpy.ops.mesh.primitive_cylinder_add(vertices=8, radius=0.062, depth=case_h, location=(0, 0, 0))
    case = bpy.context.active_object; case.name = "watch_case"
    for c in case.users_collection: c.objects.unlink(case)
    coll.objects.link(case)
    case.data.transform(Matrix.Rotation(math.radians(22.5), 4, "Z") @ Matrix.Diagonal((1.0, 0.92, 1, 1)))
    bv = case.modifiers.new("bev", "BEVEL"); bv.width = 0.007; bv.segments = 3; bv.limit_method = "ANGLE"
    case.data.materials.append(M_black)
    place(case, Matrix.Translation((0, 0, case_h / 2 - 0.004)))
    objs.append(case)
    # --- bezel accent ring + LCD window ---
    bpy.ops.mesh.primitive_cylinder_add(vertices=8, radius=0.05, depth=0.006)
    bez = bpy.context.active_object; bez.name = "watch_bezel"
    for c in bez.users_collection: c.objects.unlink(bez)
    coll.objects.link(bez)
    bez.data.transform(Matrix.Rotation(math.radians(22.5), 4, "Z") @ Matrix.Diagonal((1.0, 0.92, 1, 1)))
    bez.data.materials.append(M_ring)
    place(bez, Matrix.Translation((0, 0, case_h - 0.003)))
    objs.append(bez)
    bpy.ops.mesh.primitive_plane_add(size=1)
    lcd = bpy.context.active_object; lcd.name = "watch_lcd"
    for c in lcd.users_collection: c.objects.unlink(lcd)
    coll.objects.link(lcd)
    lcd.data.transform(Matrix.Diagonal((0.064, 0.046, 1, 1)))
    lcd.data.materials.append(M_lcd)
    place(lcd, Matrix.Translation((0, -0.002, case_h + 0.0005)))
    objs.append(lcd)
    # --- digits ---
    cu = bpy.data.curves.new("watch_time", "FONT"); cu.body = time_text; cu.size = 0.028
    cu.align_x = "CENTER"; cu.align_y = "CENTER"; cu.extrude = 0.0006
    txt = bpy.data.objects.new("watch_time", cu); coll.objects.link(txt)
    cu.materials.append(M_dig)
    place(txt, Matrix.Translation((0, -0.001, case_h + 0.0015)))
    objs.append(txt)
    # small secondary readout bar
    bpy.ops.mesh.primitive_plane_add(size=1)
    bar = bpy.context.active_object; bar.name = "watch_bar"
    for c in bar.users_collection: c.objects.unlink(bar)
    coll.objects.link(bar)
    bar.data.transform(Matrix.Diagonal((0.034, 0.006, 1, 1)))
    bar.data.materials.append(M_dig)
    place(bar, Matrix.Translation((0, 0.015, case_h + 0.0012)))
    objs.append(bar)
    # --- four side buttons (along +/-X) ---
    for sx in (-1, 1):
        for sy in (-1, 1):
            bpy.ops.mesh.primitive_cylinder_add(vertices=12, radius=0.0075, depth=0.016)
            b = bpy.context.active_object; b.name = "watch_btn"
            for c in b.users_collection: c.objects.unlink(b)
            coll.objects.link(b)
            b.data.materials.append(M_black)
            place(b, Matrix.Translation((sx * 0.062, sy * 0.022, case_h * 0.5)) @ Matrix.Rotation(math.radians(90), 4, "Y"))
            objs.append(b)
    # --- convert + join into one object ---
    for o in bpy.context.selected_objects: o.select_set(False)
    for o in objs: o.select_set(True)
    bpy.context.view_layer.objects.active = case
    bpy.ops.object.convert(target="MESH")
    bpy.ops.object.join()
    w = bpy.context.active_object; w.name = "watch_left"; w.data.name = "watch_left_mesh"
    w.parent = man; w.matrix_parent_inverse = man.matrix_world.inverted()
    return w, n
