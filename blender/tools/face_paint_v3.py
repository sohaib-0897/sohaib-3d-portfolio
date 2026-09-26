"""Face-correction pass (2026-09-26): clean lower-face texture (run AFTER face_sculpt_v3.py).

Rebuilds the beard / moustache / lips in UV space from a UV->world position map of the current mesh:
  * lower face reset to an even skin tone (removes the mottled blotches and the blocky moustache rectangle)
  * short even stubble: natural cheek line, denser moustache / chin / jaw, fades under the jaw, fine grain only
  * defined lips: upper lip with a soft cupid's bow, fuller lower lip, thin mouth line (mouth line z = .276)
Colours are image (sRGB) values, like the earlier face_paint.py.
Run headless:  blender --background <file.blend> --python face_paint_v3.py   (saves the file)
"""
import bpy
import numpy as np

P = dict(
    tilt=-0.08,                     # head roll: dz/dx of the eye line
    mouth_z=0.276, mouth_w=0.080,
    ulip_h=0.018, llip_h=0.027,
    ulip_col=(0.55, 0.31, 0.29), llip_col=(0.66, 0.39, 0.36), line_col=(0.27, 0.13, 0.12),
    beard_col=(0.085, 0.065, 0.055),
    d_chin=0.70, d_jaw=0.60, d_cheek=0.42, d_mous=0.66,
    nose_base=0.335,
    # moustache shape: half-width, gap under the nostrils, upper-edge drop toward the ends, gap above the lip,
    # philtrum lightening
    m_w=0.088, m_top_gap=0.0015, m_drop=0.012, m_lip_gap=0.0022, m_philtrum=0.20,
)


def ss(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t)


def blur(a, r):
    for _ in range(2):
        k = 2 * r + 1
        c = np.cumsum(np.pad(a, ((0, 0), (r + 1, r)), mode="edge"), 1); a = (c[:, k:] - c[:, :-k]) / k
        c = np.cumsum(np.pad(a, ((r + 1, r), (0, 0)), mode="edge"), 0); a = (c[k:] - c[:-k]) / k
    return a


def posmap(man, W, H):
    me = man.data
    me.calc_loop_triangles()
    lt = me.loop_triangles
    tl = np.empty(len(lt) * 3, np.int32); lt.foreach_get("loops", tl); tl = tl.reshape(-1, 3)
    tv = np.empty(len(lt) * 3, np.int32); lt.foreach_get("vertices", tv); tv = tv.reshape(-1, 3)
    uv = np.empty(len(me.loops) * 2, np.float32); me.uv_layers.active.data.foreach_get("uv", uv); uv = uv.reshape(-1, 2)
    co = np.empty(len(me.vertices) * 3, np.float32); me.vertices.foreach_get("co", co); co = co.reshape(-1, 3)
    Mw = np.array(man.matrix_world); wco = co @ Mw[:3, :3].T + Mw[:3, 3]
    cen = wco[tv].mean(1)
    sel = np.where((cen[:, 2] > -0.05) & (cen[:, 2] < 0.62) & (cen[:, 1] < 0.1))[0]
    pos = np.full((H, W, 3), np.nan, np.float32)
    for t in sel:
        Pp = uv[tl[t]] * np.array([W, H]); V = wco[tv[t]]
        x0, y0 = np.floor(Pp.min(0)).astype(int) - 1; x1, y1 = np.ceil(Pp.max(0)).astype(int) + 1
        x0, y0 = max(x0, 0), max(y0, 0); x1, y1 = min(x1, W - 1), min(y1, H - 1)
        if x1 < x0 or y1 < y0: continue
        xs, ys = np.meshgrid(np.arange(x0, x1 + 1) + 0.5, np.arange(y0, y1 + 1) + 0.5)
        (ax, ay), (bx, by), (cx, cy) = Pp
        den = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy)
        if abs(den) < 1e-12: continue
        l1 = ((by - cy) * (xs - cx) + (cx - bx) * (ys - cy)) / den
        l2 = ((cy - ay) * (xs - cx) + (ax - cx) * (ys - cy)) / den
        l3 = 1 - l1 - l2
        e = 1.0 / max(1.0, abs(den) ** 0.5)
        ins = (l1 >= -e) & (l2 >= -e) & (l3 >= -e)
        if not ins.any(): continue
        p = l1[..., None] * V[0] + l2[..., None] * V[1] + l3[..., None] * V[2]
        blk = pos[y0:y1 + 1, x0:x1 + 1]; blk[ins] = p[ins]
    return pos


def paint():
    man = bpy.data.objects["man"]
    img = bpy.data.images["sohaib_diffuse"]
    W, H = img.size
    px = np.empty(W * H * 4, np.float32); img.pixels.foreach_get(px); px = px.reshape(H, W, 4)
    pos = posmap(man, W, H)
    ok = np.isfinite(pos[..., 0])
    X, Y, Z = [np.where(ok, pos[..., i], 0) for i in range(3)]
    ax = np.abs(X)
    zt = Z - P["tilt"] * X
    col = px[..., :3].astype(np.float64)
    rng = np.random.default_rng(11)

    # ---- zone: lower face below the cheek line (front half of the head)
    zc = np.interp(ax, [0.0, 0.09, 0.16, 0.22, 0.29], [0.345, 0.335, 0.325, 0.365, 0.47])
    zone = ok * ss(zc + 0.03, zc - 0.005, zt) * (1 - ss(-0.06, 0.04, Y)) * ss(0.0, 0.05, Z) * (1 - ss(0.27, 0.33, ax))

    # clean skin reference: the cheek / upper-lip-free skin just above the beard line
    ref = ok & (zt > zc + 0.01) & (zt < zc + 0.06) & (Y < -0.12) & (ax > 0.05) & (ax < 0.22)
    lum = col.mean(-1)
    ref &= (lum > 0.45) & (lum < 0.9)
    skin_ref = np.median(col[ref], 0) if ref.sum() > 50 else np.array([0.80, 0.58, 0.47])
    # keep only the very low-frequency shading of the old texture, drop the blotches
    wz = zone.astype(np.float32)
    low = np.stack([blur(np.where(zone > 0.2, col[..., i], skin_ref[i]), 24) for i in range(3)], -1)
    lowl = low.mean(-1, keepdims=True); refl = skin_ref.mean()
    base = skin_ref * np.clip(lowl / refl, 0.85, 1.08) ** 0.35
    col = col * (1 - wz[..., None]) + base * wz[..., None]

    # ---- lips (front coords, roll removed)
    mz, mw = P["mouth_z"], P["mouth_w"]
    q = np.clip(1 - (X / mw) ** 2, 0, 1)
    bow = 1 - 0.28 * np.exp(-(X / 0.010) ** 2) + 0.10 * np.exp(-((ax - 0.016) / 0.012) ** 2)
    ztop = mz + P["ulip_h"] * q ** 0.55 * bow
    zbot = mz - P["llip_h"] * q ** 0.65
    front = ok & (Y < -0.2)
    edge = 0.0025
    up = front * ss(mz - edge, mz + edge * 0.3, zt) * (1 - ss(ztop - edge, ztop + edge, zt)) * (q > 0)
    lo = front * ss(zbot - edge, zbot + edge, zt) * (1 - ss(mz - edge * 0.3, mz + edge, zt)) * (q > 0)
    lipmask = np.clip(up + lo, 0, 1)

    # ---- stubble density
    dens = zone.copy()
    lvl = P["d_cheek"] + (P["d_jaw"] - P["d_cheek"]) * (1 - ss(0.26, 0.33, zt))
    lvl = lvl + (P["d_chin"] - lvl) * (1 - ss(0.07, 0.13, ax)) * (1 - ss(0.22, 0.27, zt))
    # moustache (refinement 2026-09-26b): a shaped band, not a filled block.
    #  - upper-lip area: base stubble thinned so the moustache is not one patch with the beard
    #  - lower edge sits a clean skin gap above the lip contour; upper edge stays under the nostrils and drops
    #    toward the sides -> natural taper; slightly lighter philtrum; ends thin out before the mouth corners
    lipband = front * ss(ztop - 0.002, ztop + 0.002, zt) * ss(P["nose_base"] + 0.004, P["nose_base"] - 0.004, zt)
    lvl = lvl * (1 - 0.3 * lipband * (1 - ss(mw - 0.02, mw + 0.02, ax)))
    xm = np.clip(ax / P["m_w"], 0, 1.5)
    m_top = P["nose_base"] - P["m_top_gap"] - P["m_drop"] * xm ** 1.6
    m_bot = ztop + P["m_lip_gap"]
    mous = (ss(m_bot - 0.0005, m_bot + 0.004, zt) * ss(m_top + 0.004, m_top - 0.006, zt)
            * np.clip(1 - xm ** 2, 0, 1) ** 0.9
            * (1 - P["m_philtrum"] * np.exp(-(X / 0.008) ** 2)))
    lvl = np.maximum(lvl, P["d_mous"] * mous)
    # thin skin gap right on the lip contour (keeps the upper lip readable)
    lvl *= 1 - 0.6 * front * np.exp(-((zt - (ztop + 0.0015)) / 0.0018) ** 2) * (1 - ss(mw - 0.01, mw + 0.02, ax))
    # slightly lighter just under the lower lip centre and at the nostril edges (natural growth pattern)
    lvl *= 1 - 0.35 * np.exp(-(X / 0.02) ** 2 - ((zt - (zbot - 0.012)) / 0.008) ** 2)
    lvl *= 1 - 0.5 * np.exp(-((ax - 0.03) / 0.018) ** 2 - ((zt - (P["nose_base"] - 0.004)) / 0.004) ** 2)
    under = ss(-0.22, -0.10, Y) * (1 - ss(0.02, 0.13, Z))           # fade onto the neck
    dens *= 1 - 0.75 * under
    a = np.clip(lvl * dens, 0, 1) * (1 - lipmask)
    grain = rng.random(a.shape).astype(np.float32)
    grain = (grain - grain.mean()) / (grain.std() + 1e-6)
    soft = blur(rng.random(a.shape).astype(np.float32), 18)
    soft = (soft - soft.mean()) / (soft.std() + 1e-6)
    a = np.clip(a * (1 + 0.10 * grain + 0.04 * soft), 0, 1)
    col = col * (1 - a[..., None]) + np.array(P["beard_col"]) * a[..., None]

    # ---- lip colour, soft highlight on the lower lip, mouth line
    col = col * (1 - up[..., None] * 0.9) + np.array(P["ulip_col"]) * up[..., None] * 0.9
    col = col * (1 - lo[..., None] * 0.9) + np.array(P["llip_col"]) * lo[..., None] * 0.9
    hl = lo * np.exp(-(X / 0.03) ** 2 - ((zt - (mz - P["llip_h"] * 0.45)) / 0.006) ** 2)
    col = col + hl[..., None] * 0.06
    line = front * np.exp(-((zt - mz) / 0.0018) ** 2) * (1 - ss(mw - 0.012, mw + 0.004, ax))
    col = col * (1 - line[..., None] * 0.8) + np.array(P["line_col"]) * line[..., None] * 0.8

    out = px.copy(); out[..., :3] = np.clip(col, 0, 1)
    img.pixels.foreach_set(out.ravel()); img.update(); img.pack()
    return W, H, skin_ref.round(3).tolist(), int(ok.sum())


if __name__ == "__main__":
    print("paint", paint())
    bpy.ops.wm.save_mainfile(compress=True)
