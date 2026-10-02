// Find horizontal overflow on a mobile viewport (vite preview, candidate glb). usage: node overflow_check.cjs [width] [height]
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
const GLB = fs.readFileSync(process.env.CANDIDATE_GLB || PROD);
const W = +(process.argv[2] || 390), H = +(process.argv[3] || 844)
;(async () => {
  const b = await chromium.launch()
  const ctx = await b.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
  const p = await ctx.newPage()
  await p.route('**/models/me.glb', (r) => r.fulfill({ status: 200, contentType: 'model/gltf-binary', body: GLB }))
  await p.goto(process.env.BASE || 'http://localhost:4173/', { waitUntil: 'domcontentloaded' })
  await p.waitForFunction(() => { const l = document.querySelector('.loading-screen'); return !l || l.classList.contains('is-hidden') }, null, { timeout: 90000 })
  await new Promise((r) => setTimeout(r, 2500))
  console.log(JSON.stringify(await p.evaluate(() => {
    const iw = document.documentElement.clientWidth
    const wide = []
    for (const el of document.querySelectorAll('body *')) {
      const r = el.getBoundingClientRect()
      if (r.width && (r.right > iw + 1 || r.left < -1)) wide.push(`${el.tagName.toLowerCase()}.${[...el.classList].join('.')} L${Math.round(r.left)} R${Math.round(r.right)}`)
      for (const ps of ['::before', '::after']) {
        const cs = getComputedStyle(el, ps)
        if (cs.content && cs.content !== 'none' && cs.position === 'absolute') {
          // pseudo boxes are not measurable directly; report resolved left/right offsets
          if (parseFloat(cs.left) < -1 || parseFloat(cs.right) < -1) wide.push(`${el.className}${ps} left=${cs.left} right=${cs.right} host L${Math.round(r.left)} R${Math.round(r.right)}`)
        }
      }
    }
    return { innerWidth, clientWidth: iw, scrollWidth: document.documentElement.scrollWidth, bodyScroll: document.body.scrollWidth, visualScale: visualViewport.scale, wide: wide.slice(0, 30) }
  })))
  await b.close()
})()
