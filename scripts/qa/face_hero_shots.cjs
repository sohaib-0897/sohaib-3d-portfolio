// Face-correction pass: hero screenshots (desktop + mobile) + measured hero-text contrast, with a candidate glb
// served by request interception (production web/public/models/me.glb is never touched).
// Needs a preview server (BASE, default :4173). Screenshots show the user's likeness -> blender/previews/ (git-ignored).
// usage: [BASE=http://localhost:4173] [GLB=blender/previews/candidates/me_face_v3.glb] node scripts/qa/face_hero_shots.cjs <outName>
const { chromium } = require('C:/Users/Sohaib/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright')
const path = require('path')
const fs = require('fs')
const ROOT = path.join(__dirname, '..', '..')
const BASE = process.env.BASE || 'http://localhost:4173/'
const GLB_PATH = path.resolve(ROOT, process.env.GLB || 'blender/previews/candidates/me_face_v3.glb')
const name = process.argv[2] || 'run'
const OUT = path.join(ROOT, 'blender', 'previews', 'face_v3', name)
fs.mkdirSync(OUT, { recursive: true })
const GLB = fs.readFileSync(GLB_PATH)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function open(browser, opts) {
  const ctx = await browser.newContext(opts)
  const page = await ctx.newPage()
  await page.route('**/models/me.glb', (r) => r.fulfill({ status: 200, contentType: 'model/gltf-binary', body: GLB }))
  page.on('pageerror', (e) => console.log('pageerror', e.message))
  await page.goto(BASE, { waitUntil: 'domcontentloaded' })
  await page.waitForFunction(() => { const l = document.querySelector('.loading-screen'); return !l || l.classList.contains('is-hidden') }, null, { timeout: 90000 })
  await sleep(4000)
  return { ctx, page }
}

// p10 / p50 WCAG contrast of each hero text element against the real rendered pixels behind it
async function contrast(page, sels) {
  const out = {}
  for (const sel of sels) {
    const info = await page.evaluate((sel) => {
      const el = document.querySelector(sel)
      if (!el) return null
      const r = el.getBoundingClientRect()
      if (r.width < 2 || r.height < 2) return null
      let op = 1
      for (let n = el; n && n !== document.documentElement; n = n.parentElement) op *= +getComputedStyle(n).opacity
      return { x: r.left, y: r.top, w: r.width, h: r.height, color: getComputedStyle(el).color, op }
    }, sel)
    if (!info) { out[sel] = null; continue }
    const h = await page.addStyleTag({ content: `${sel}, ${sel} * { color: transparent !important; text-shadow: none !important; }` })
    await page.evaluate((s) => { s.dataset.pol = '1' }, h)
    await sleep(150)
    const vp = page.viewportSize()
    const clip = { x: Math.max(0, info.x), y: Math.max(0, info.y), width: Math.min(info.w, vp.width - Math.max(0, info.x)), height: Math.min(info.h, vp.height - Math.max(0, info.y)) }
    const buf = await page.screenshot({ clip })
    await page.evaluate(() => document.querySelectorAll('style[data-pol]').forEach((s) => s.remove()))
    out[sel] = await page.evaluate(async ([b64, color, op]) => {
      const im = await new Promise((r) => { const i = new Image(); i.onload = () => r(i); i.src = 'data:image/png;base64,' + b64 })
      const cv = document.createElement('canvas'); cv.width = im.width; cv.height = im.height
      const x = cv.getContext('2d'); x.drawImage(im, 0, 0)
      const d = x.getImageData(0, 0, im.width, im.height).data
      const c = color.match(/[\d.]+/g).map(Number); const a = (c[3] ?? 1) * op
      const lin = (v) => { v /= 255; return v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4 }
      const L = (r, g, b) => 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
      const cr = []
      for (let k = 0; k < d.length; k += 16) {
        const bg = [d[k], d[k + 1], d[k + 2]]
        const fg = bg.map((v, j) => c[j] * a + v * (1 - a))
        const l1 = L(...fg), l2 = L(...bg)
        cr.push((Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05))
      }
      cr.sort((p, q) => p - q)
      const pc = (p) => +cr[Math.floor(p * (cr.length - 1))].toFixed(2)
      return { p10: pc(0.1), p50: pc(0.5) }
    }, [buf.toString('base64'), info.color, info.op])
  }
  return out
}

const HERO_SELS = ['.about-title', '.about-role', '.about-body', '.scroll-cue-label']
const SIZES = [
  ['hero_1440x900', { viewport: { width: 1440, height: 900 } }],
  ['hero_1920x1080', { viewport: { width: 1920, height: 1080 } }],
  ['hero_1280x720', { viewport: { width: 1280, height: 720 } }],
  ['hero_m390x844', { viewport: { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true }],
  ['hero_m360x740', { viewport: { width: 360, height: 740 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true }],
]

;(async () => {
  const only = process.env.ONLY ? process.env.ONLY.split(',') : null
  const browser = await chromium.launch({ args: ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=d3d11'] })
  const results = {}
  for (const [n, opts] of SIZES) {
    if (only && !only.includes(n)) continue
    const { ctx, page } = await open(browser, opts)
    if (!opts.isMobile) { await page.mouse.move(opts.viewport.width * 0.5, opts.viewport.height * 0.36); await sleep(1500) }
    await page.screenshot({ path: path.join(OUT, n + '.png') })
    results[n] = await contrast(page, HERO_SELS)
    // title vs face overlap: where does the name sit relative to the eye anchor / chin (screen px)?
    results[n].layout = await page.evaluate(() => {
      const t = document.querySelector('.about-title').getBoundingClientRect()
      return { titleTop: Math.round(t.top), titleBottom: Math.round(t.bottom), vh: innerHeight, overflowX: document.documentElement.scrollWidth - innerWidth }
    })
    console.log(n, JSON.stringify(results[n]))
    await ctx.close()
  }
  fs.writeFileSync(path.join(OUT, 'contrast.json'), JSON.stringify(results, null, 2))
  await browser.close()
})()
