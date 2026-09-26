"""Face-correction pass (2026-09-26): lower-face proportions / profile, measured against blender/refs/face.jpg.

Before: nose base z .3375, mouth line .294, chin bottom .09 -> upper lip only .044 tall (nose sat on the mouth),
mouth-to-chin .204 (1.37x eye-to-nose; the reference is ~0.8x); profile: chin .05 behind the lower lip.
Changes (all smooth fields, front of the lower face only; eyes / glasses / neck / collar untouched):
  1. z remap  .09 -> .10, .294 -> .276, nose base fixed  (longer upper lip, shorter chin)
  2. chin forward .026, lower lip forward .008, upper lip back .005
  3. jaw / chin slimmed up to 7 % (oval, closer to the reference)
Run headless:  blender --background <file.blend> --python face_sculpt_v3.py   (saves the file)
"""
import bpy
import numpy as np

P = dict(zmap=((0.05, 0.05), (0.09, 0.10), (0.294, 0.276), (0.3375, 0.3375), (0.37, 0.37)),
         chin_fwd=0.026, llip_fwd=0.008, ulip_back=0.005, slim=0.07)


def ss(e0, e1, x):
    t = np.clip((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t)


def smooth_remap(z):
    zs, zn = map(np.array, zip(*P["zmap"]))
    grid = np.linspace(0.0, 0.45, 901)
    d = np.interp(grid, zs, zn - zs)
    k = np.exp(-0.5 * (np.arange(-40, 41) * 0.0005 / 0.008) ** 2); k /= k.sum()
    d = np.convolve(np.pad(d, 40, mode="edge"), k, mode="valid")
    return z + np.interp(z, grid, d, left=0, right=0)


def run():
    bpy.context.scene.frame_set(1)
    man = bpy.data.objects["man"]; me = man.data
    co = np.empty(len(me.vertices) * 3, np.float64); me.vertices.foreach_get("co", co); co = co.reshape(-1, 3)
    Mw = np.array(man.matrix_world); Mi = np.linalg.inv(Mw)
    p = co @ Mw[:3, :3].T + Mw[:3, 3]
    x, y, z = p[:, 0], p[:, 1], p[:, 2]
    ax = np.abs(x)
    front = 1 - ss(-0.16, -0.02, y)                 # front of the head only
    region = front * ss(0.03, 0.07, z) * (1 - ss(0.36, 0.40, z)) * (1 - ss(0.26, 0.34, ax))
    nz = z + (smooth_remap(z) - z) * region
    # profile (measured after the remap)
    g_chin = np.exp(-(x / 0.12) ** 2 - ((nz - 0.155) / 0.065) ** 2)
    g_ll = np.exp(-(x / 0.07) ** 2 - ((nz - 0.25) / 0.022) ** 2)
    g_ul = np.exp(-(x / 0.07) ** 2 - ((nz - 0.305) / 0.018) ** 2)
    dy = (-P["chin_fwd"] * g_chin - P["llip_fwd"] * g_ll + P["ulip_back"] * g_ul) * front * ss(0.03, 0.08, z)
    # slimmer jaw / chin (tapers to nothing at the cheekbones)
    a = P["slim"] * (1 - ss(0.18, 0.31, nz)) * ss(0.04, 0.10, nz) * front
    nx = x * (1 - a)
    np_ = np.stack([nx, y + dy, nz], 1)
    loc = np_ @ Mi[:3, :3].T + Mi[:3, 3]
    me.vertices.foreach_set("co", loc.astype(np.float32).ravel()); me.update()
    return float(np.abs(np_ - p).max())


if __name__ == "__main__":
    print("max move", run())
    bpy.ops.wm.save_mainfile(compress=True)
