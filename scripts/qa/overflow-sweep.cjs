// Scroll the whole page in steps and report the max horizontal overflow per viewport (vite preview :4173, candidate glb).
// usage: node overflow_sweep.cjs
function getChromium() {
  if (process.env.PLAYWRIGHT) {
    try { return require(process.env.PLAYWRIGHT).chromium; } catch (e) {}
  }
  try { return require('playwright').chromium; } catch (e) {}
  if (process.env.LOCALAPPDATA) {
    try {
      const p = require('path').join(process.env.LOCALAPPDATA, 'npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright');
      return require(p).chromium;
    } catch (e) {}
  }
  console.error('Playwright not found. Install it with `npm install -D playwright` or set PLAYWRIGHT environment variable.');
  process.exit(1);
}
const chromium = getChromium();
const path = require('path')
const fs = require('fs')
const CAND = path.join(__dirname, '..', '..', 'blender', 'previews', 'candidates', 'me_lanyard.glb');
const PROD = path.join(__dirname, '..', '..', 'web', 'public', 'models', 'me.glb');
const GLB = fs.existsSync(CAND) ? fs.readFileSync(CAND) : fs.readFileSync(PROD);)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
;(async () => {
  const b = await chromium.launch({ args: ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=d3d11'] })
  for (const [w, h, mobile] of [[1440, 900], [1920, 1080], [1280, 720], [800, 900], [390, 844, 1]]) {
    const ctx = await b.newContext({ viewport: { width: w, height: h }, ...(mobile ? { isMobile: true, hasTouch: true, deviceScaleFactor: 2 } : {}) })
    const p = await ctx.newPage()
    await p.route('**/models/me.glb', (r) => r.fulfill({ status: 200, contentType: 'model/gltf-binary', body: GLB }))
    await p.goto('http://localhost:4173/', { waitUntil: 'domcontentloaded' })
    await p.waitForFunction(() => { const l = document.querySelector('.loading-screen'); return !l || l.classList.contains('is-hidden') }, null, { timeout: 90000 })
    await sleep(2000)
    const H = await p.evaluate(() => document.documentElement.scrollHeight)
    let worst = { ox: 0, y: 0 }
    for (let y = 0; y <= H; y += Math.round(h * 0.25)) {
      await p.evaluate((y) => scrollTo({ top: y, behavior: 'instant' }), y); await sleep(120)
      const ox = await p.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
      if (ox > worst.ox) worst = { ox, y }
    }
    console.log(`${w}x${h}${mobile ? ' mobile' : ''}: max overflow ${worst.ox}px${worst.ox ? ' at y=' + worst.y : ''}`)
    await ctx.close()
  }
  await b.close()
})()
