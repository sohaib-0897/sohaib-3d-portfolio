// Story-interaction QA against the production build (vite preview :4173).
// The production glb is tested by default; CANDIDATE_GLB explicitly opts into an alternate model.
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
const OUT = path.join(__dirname, 'screenshots', 'story')
fs.mkdirSync(OUT, { recursive: true })
// ?qa enables the read-only badge probe (window.__qa: story coordinate + career_badge screen rect)
const URL = (process.env.BASE_URL || 'http://localhost:4173/') + '?qa'
const qa = (page) => page.evaluate(() => window.__qa && { c: window.__qa.c, badge: { ...window.__qa.badge } })
const rect = (page, sel) => page.evaluate((sel) => { const el = document.querySelector(sel); if (!el) return null; const r = el.getBoundingClientRect(); return { left: r.left, right: r.right, top: r.top, bottom: r.bottom } }, sel)
const overlaps = (a, b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top
const CANDIDATE = process.env.CANDIDATE_GLB || path.join(__dirname, '..', '..', 'blender', 'previews', 'candidates', 'me_lanyard.glb')
const PROD_GLB = path.join(__dirname, '..', '..', 'web', 'public', 'models', 'me.glb')
const GLB = fs.readFileSync(process.env.CANDIDATE_GLB ? CANDIDATE : PROD_GLB)
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const res = { checks: [], perf: {}, logs: [], hotspots: {} }
const check = (name, ok, detail) => { res.checks.push({ name, ok: !!ok, detail }); console.log((ok ? 'PASS ' : 'FAIL ') + name + (detail !== undefined ? '  ' + JSON.stringify(detail) : '')) }

async function newPage(browser, opts, tag) {
  const ctx = await browser.newContext(opts)
  const page = await ctx.newPage()
  let served = 0
  await page.route('**/models/me.glb', (route) => { served++; route.fulfill({ status: 200, contentType: 'model/gltf-binary', body: GLB }) })
  page.on('console', (m) => { if (m.type() === 'error') res.logs.push(`${tag}: ${m.text()}`) })
  page.on('pageerror', (e) => res.logs.push(`${tag} pageerror: ${e.message}`))
  await page.goto(URL, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('canvas', { timeout: 60000, state: 'attached' })
  await page.waitForFunction(() => { const l = document.querySelector('.loading-screen'); return !l || l.classList.contains('is-hidden') }, null, { timeout: 90000 })
  await sleep(2500)
  check(`${tag}: candidate glb served`, served >= 1, served)
  return { ctx, page }
}
const fps = (page, ms = 3000) => page.evaluate((ms) => new Promise((res) => {
  let n = 0; const ts = []; let last = performance.now(); const t0 = last
  const f = (t) => { n++; ts.push(t - last); last = t; if (t - t0 < ms) requestAnimationFrame(f); else { ts.sort((a, b) => a - b); res({ fps: +(n / ((t - t0) / 1000)).toFixed(1), p95ms: +ts[Math.floor(ts.length * 0.95)].toFixed(1) }) } }
  requestAnimationFrame(f)
}), ms)
const hs = (page, id) => page.evaluate((id) => {
  const el = document.querySelector(`.story-hotspot.is-${id}`); if (!el) return null
  const r = el.getBoundingClientRect()
  return { visible: el.dataset.visible, emph: el.dataset.emph, x: +r.left.toFixed(1), y: +r.top.toFixed(1), w: +r.width.toFixed(1), h: +r.height.toFixed(1), cx: +(r.left + r.width / 2).toFixed(1), cy: +(r.top + r.height / 2).toFixed(1) }
}, id)
// wait until the story panel has actually left the DOM, then let the camera nudge settle
const panelGone = async (page, settle = 2500) => { await page.waitForFunction(() => !document.querySelector('.story-panel'), null, { timeout: 20000 }); await sleep(settle) }
const scrollTo = async (page, y, w = 2600) => { await page.evaluate((y) => window.scrollTo({ top: y, behavior: 'instant' }), y); await sleep(w) }
const galleryTop = (page) => page.evaluate(() => { const el = document.querySelector('.wk-gallery'); return el.getBoundingClientRect().top + window.scrollY })
async function crop(page, name, c, size = 260) {
  const vp = page.viewportSize()
  const x = Math.max(0, Math.min(vp.width - size, c.cx - size / 2)), y = Math.max(0, Math.min(vp.height - size, c.cy - size / 2))
  await page.screenshot({ path: path.join(OUT, name + '.png'), clip: { x, y, width: size, height: size } })
}

;(async () => {
  const browser = await chromium.launch({ args: ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=d3d11'] })

  // ================= DESKTOP 1440×900 =================
  {
    const { ctx, page } = await newPage(browser, { viewport: { width: 1440, height: 900 } }, 'desktop')
    const shot = (n) => page.screenshot({ path: path.join(OUT, n + '.png') })
    await page.mouse.move(720, 450); await sleep(800)
    await shot('d01_hero')
    res.perf.hero = await fps(page)
    const hHero = await hs(page, 'watch')
    check('hotspots hidden in hero', hHero.visible === '0', hHero.visible)
    // eye tracking
    await page.mouse.move(60, 450, { steps: 8 }); await sleep(1500); await shot('d02_hero_eyes_left')
    await page.mouse.move(1380, 450, { steps: 8 }); await sleep(1500); await shot('d03_hero_eyes_right')
    await page.mouse.move(720, 450, { steps: 8 }); await sleep(600)
    // résumé stops
    const tops = await page.evaluate(() => ['focus-1', 'focus-2', 'focus-3', 'focus-4', 'focus-5'].map((n) => { const el = document.querySelector(`[data-point="${n}"]`); return el.getBoundingClientRect().top + window.scrollY }))
    for (let i = 0; i < 5; i++) {
      await scrollTo(page, tops[i] - 900 * 0.3, 2800); await shot(`d1${i + 1}_resume_focus-${i + 1}`)
      if (i === 2) res.perf.resume = await fps(page)
      const h = await hs(page, 'watch'); if (h.visible !== '0') check(`hotspot hidden at résumé ${i + 1}`, false, h.visible)
    }
    // works full-body stage
    const g = await galleryTop(page)
    await scrollTo(page, g, 3000)
    await shot('d20_works_fullbody')
    res.perf.works = await fps(page)
    const w1 = await hs(page, 'watch'); const s1 = await hs(page, 'shoes')
    res.hotspots.desktop = { watch: w1, shoes: s1 }
    check('watch hotspot visible at works stage', w1.visible === '1', w1)
    check('shoes hotspot visible at works stage', s1.visible === '1', s1)
    // stability: no drift at rest
    await sleep(700); const w1b = await hs(page, 'watch')
    check('watch hotspot stable at rest', Math.abs(w1b.cx - w1.cx) < 0.6 && Math.abs(w1b.cy - w1.cy) < 0.6, [w1.cx, w1.cy, w1b.cx, w1b.cy])
    await crop(page, 'd21_watch_alignment_idle', w1)
    await crop(page, 'd22_shoes_alignment_idle', s1, 340)
    // hover watch
    await page.mouse.move(w1.cx, w1.cy, { steps: 6 }); await sleep(2500) // let the mouse parallax settle
    await shot('d23_watch_hover'); await crop(page, 'd23b_watch_hover_crop', w1)
    const w1h = await hs(page, 'watch') // baseline for the restore check (pointer stays here until after close)
    const cursor = await page.evaluate(() => getComputedStyle(document.querySelector('.story-hotspot.is-watch')).cursor)
    check('watch hotspot cursor pointer', cursor === 'pointer', cursor)
    // click watch → panel
    await page.mouse.click(w1.cx, w1.cy); await sleep(2600)
    const dlg = await page.evaluate(() => { const d = document.querySelector('[role="dialog"].story-panel'); return d ? { label: d.getAttribute('aria-labelledby'), title: d.querySelector('.story-title')?.textContent, focus: document.activeElement?.className, overflow: document.body.style.overflow } : null })
    check('watch panel opens on click', dlg && dlg.title === 'Watches Through My Career', dlg)
    check('focus moved into panel', dlg && /story-close/.test(dlg.focus), dlg && dlg.focus)
    check('page scroll locked while open', dlg && dlg.overflow === 'hidden', dlg && dlg.overflow)
    res.perf.watchPanel = await fps(page)
    await shot('d24_watch_panel_open')
    const current = await page.evaluate(() => { const li = document.querySelector('.wt-item.is-current'); return { tag: li?.querySelector('.wt-tag')?.textContent, watch: li?.querySelector('.wt-watch')?.textContent, active: li?.classList.contains('is-active') } })
    check('G-Shock marked current', current.tag === 'On my wrist now' && current.watch === 'G-Shock GA-B2100', current)
    // keyboard progression inside the timeline
    await page.focus('.wt-item.is-active .wt-stage')
    await page.keyboard.press('ArrowDown'); await sleep(700)
    await page.keyboard.press('ArrowDown'); await sleep(900)
    await shot('d25_watch_stage3_keyboard')
    const st3 = await page.evaluate(() => ({ active: document.querySelector('.wt-item.is-active .wt-watch')?.textContent, tag: document.querySelector('.wt-item.is-active .wt-tag')?.textContent, count: document.querySelector('.wt-count')?.textContent }))
    check('arrow keys advance stages', st3.active === 'Longines Spirit Zulu Time 39mm', st3)
    check('future stage tagged Aspiration', st3.tag === 'Aspiration', st3.tag)
    await page.keyboard.press('End'); await sleep(900)
    await shot('d26_watch_future_dream')
    const last = await page.evaluate(() => ({ active: document.querySelector('.wt-item.is-active .wt-watch')?.textContent, nextDisabled: document.querySelectorAll('.wt-nav button')[1].disabled }))
    check('End jumps to THE DREAM', last.active === 'Audemars Piguet Royal Oak' && last.nextDisabled, last)
    // Tab stays inside the dialog
    for (let k = 0; k < 6; k++) await page.keyboard.press('Tab')
    const inside = await page.evaluate(() => !!document.activeElement?.closest('.story-panel'))
    check('Tab focus trapped in panel', inside, inside)
    // Esc closes, camera restores exactly, focus returns to hotspot
    // exit length in rendered frames (wall-clock is unreliable here: headless GPU stalls of several seconds)
    const counter = page.evaluate(() => new Promise((res) => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (!document.querySelector('.story-panel')) res({ frames: n, ms: Math.round(performance.now() - t0) }); else if (n > 600) res({ frames: -1 }); else requestAnimationFrame(f) }; requestAnimationFrame(f) }))
    await page.keyboard.press('Escape')
    const exit = await counter
    check('Esc removes panel within 50 frames (~0.8 s at 60 fps)', exit.frames > 0 && exit.frames <= 50, exit)
    await sleep(2000)
    const w2 = await hs(page, 'watch')
    const closed = await page.evaluate(() => ({ dialog: !!document.querySelector('.story-panel'), focus: document.activeElement?.className || '', overflow: document.body.style.overflow }))
    check('Esc closes panel', !closed.dialog, closed)
    check('scroll unlocked after close', closed.overflow === '', closed.overflow)
    check('camera restored exactly (hotspot back to same px)', w2.visible === '1' && Math.abs(w2.cx - w1h.cx) < 0.3 && Math.abs(w2.cy - w1h.cy) < 0.3, [w1h.cx, w1h.cy, w2.cx, w2.cy])
    check('focus returned to watch hotspot', /story-hotspot is-watch/.test(closed.focus), closed.focus)
    await shot('d27_after_close_restored')
    // keyboard activation: Enter / Space on focused hotspot
    await page.focus('.story-hotspot.is-watch'); await sleep(300)
    await crop(page, 'd28_watch_focus_visible', w2)
    await page.keyboard.press('Enter'); await sleep(1200)
    const byEnter = await page.evaluate(() => !!document.querySelector('.story-panel.is-watch'))
    check('Enter opens watch panel', byEnter, byEnter)
    await page.click('.story-close'); await panelGone(page)
    await page.focus('.story-hotspot.is-shoes'); await page.keyboard.press('Space'); await sleep(1200)
    const bySpace = await page.evaluate(() => !!document.querySelector('.story-panel.is-shoes'))
    check('Space opens shoes panel', bySpace, bySpace)
    await page.mouse.click(200, 450); await panelGone(page) // backdrop click closes
    const backdropClosed = await page.evaluate(() => !document.querySelector('.story-panel'))
    check('backdrop click closes', backdropClosed, backdropClosed)
    // shoes hover + click
    const s2 = await hs(page, 'shoes')
    await page.mouse.move(s2.cx, s2.cy, { steps: 6 }); await sleep(700)
    await shot('d30_shoes_hover'); await crop(page, 'd30b_shoes_hover_crop', s2, 340)
    await page.locator('.story-hotspot.is-shoes').click(); await sleep(2800)
    const mv = await page.evaluate(() => ({ title: document.querySelector('.story-panel.is-shoes .story-title')?.textContent, paras: document.querySelectorAll('.mv-p').length, steps: [...document.querySelectorAll('.mv-step-text')].map((e) => e.textContent) }))
    check('Marvel panel opens on click', mv.title === 'From Marvel to Engineering' && mv.paras === 3, mv)
    await shot('d31_marvel_panel_open')
    await page.keyboard.press('Escape'); await sleep(3200)
    // cards still work + hotspots hide under cards
    await scrollTo(page, g + 1440 * 0.35, 2000)
    await shot('d40_works_cards_sliding')
    const hideUnderCard = await hs(page, 'watch')
    res.hotspots.desktopSliding = hideUnderCard
    await scrollTo(page, g + 1440 * 1.1, 2000)
    const hid2 = await hs(page, 'watch')
    check('hotspots hidden once cards cover the character', hid2.visible === '0', hid2.visible)
    await page.locator('.wk-card').nth(1).locator('.wk-line-btn').click(); await sleep(1100)
    const detail = await page.evaluate(() => document.querySelector('a.wk-detail-link[href="https://github.com/sohaib-0897/OmniOps"]')?.getAttribute('href'))
    check('project detail still opens', detail === 'https://github.com/sohaib-0897/OmniOps', detail)
    await shot('d41_project_detail'); await page.keyboard.press('Escape'); await sleep(600)
    await ctx.close()
  }

  // Run just desktop interactions when investigating keyboard / pointer timing.
  if (process.env.QA_DESKTOP_ONLY) {
    res.passed = res.checks.every((c) => c.ok)
    fs.writeFileSync(path.join(OUT, 'desktop-result.json'), JSON.stringify(res, null, 2))
    console.log(JSON.stringify({ passed: res.passed, failed: res.checks.filter((c) => !c.ok), perf: res.perf, logs: res.logs }, null, 1))
    await browser.close()
    if (!res.passed) process.exitCode = 1
    return
  }
  // ================= STORY SCROLL SEQUENCE (résumé → full body → watch → shoes → lanyard → works) =================
  {
    // mirror of STORY_BEATS in web/src/data/storyScroll.ts
    const SEQ = { d: [45, 10, 50, 55, 50, 55, 45, 45, 45, 15], m: [35, 10, 40, 45, 40, 45, 35, 40, 40, 10] }
    const keys = (seq) => { const t = seq.reduce((a, b) => a + b, 0); const k = [0]; seq.forEach((v) => k.push(k[k.length - 1] + v / t)); return k }
    const geo = (page) => page.evaluate(() => { const s = document.querySelector('.story-scroll'); return { top: s.getBoundingClientRect().top + scrollY, h: s.offsetHeight, ih: innerHeight } })
    const toP = (page, g, p, w) => scrollTo(page, g.top - g.ih + p * g.h, w)
    const { ctx, page } = await newPage(browser, { viewport: { width: 1440, height: 900 } }, 'seq')
    const shot = (n) => page.screenshot({ path: path.join(OUT, n + '.png') })
    await page.mouse.move(720, 450); await sleep(600)
    // résumé stops identical to the pre-change baseline (same pointer, same scroll positions)
    const tops = await page.evaluate(() => ['focus-1', 'focus-2', 'focus-3', 'focus-4', 'focus-5'].map((n) => { const el = document.querySelector(`[data-point="${n}"]`); return el.getBoundingClientRect().top + window.scrollY }))
    const BASE = process.env.QA_BASELINE || path.join(OUT, '..', 'baseline')
    for (let i = 0; i < 5; i++) {
      await scrollTo(page, tops[i] - 900 * 0.3, 2800)
      const cur = (await page.screenshot()).toString('base64')
      const basePath = path.join(BASE, `1${i + 1}_desktop_resume_focus-${i + 1}.png`)
      if (!fs.existsSync(basePath)) { check(`résumé stop ${i + 1} baseline present`, false, basePath); continue }
      const base = fs.readFileSync(basePath).toString('base64')
      const diff = await page.evaluate(async ([a, b]) => {
        const load = (s) => new Promise((r) => { const im = new Image(); im.onload = () => r(im); im.src = 'data:image/png;base64,' + s })
        const [ia, ib] = await Promise.all([load(a), load(b)])
        const W = 90, H = 56, c = document.createElement('canvas'); c.width = W; c.height = H; const x = c.getContext('2d')
        x.drawImage(ia, 0, 0, W, H); const da = x.getImageData(0, 0, W, H).data
        x.drawImage(ib, 0, 0, W, H); const db = x.getImageData(0, 0, W, H).data
        let s = 0; for (let k = 0; k < da.length; k += 4) s += Math.abs(da[k] - db[k]) + Math.abs(da[k + 1] - db[k + 1]) + Math.abs(da[k + 2] - db[k + 2])
        return +(s / (W * H * 3)).toFixed(2)
      }, [cur, base])
      res.perf[`resumeDiff${i + 1}`] = diff
      // coarse (90 px wide) framing diff: same build run-to-run 1–9 (grain, DoF/eye/texture-mip settle); neighbouring stop ≈ 44
      check(`résumé stop ${i + 1} framing matches pre-change baseline`, diff < 20, diff)
    }
    const g = await geo(page); const k = keys(SEQ.d)
    const at = async (p, name, w = 3000) => { await toP(page, g, p, w); if (name) await shot(name); return { watch: await hs(page, 'watch'), shoes: await hs(page, 'shoes') } }
    let h = await at(0.02, 'q01_transition_begin')
    check('seq: hotspots hidden at transition start', h.watch.visible === '0' && h.shoes.visible === '0', [h.watch.visible, h.shoes.visible])
    h = await at((k[1] + k[2]) / 2, 'q02_fullbody')
    check('seq: full body shows both hotspots', h.watch.visible === '1' && h.shoes.visible === '1', h)
    check('seq: no copy visible at full body', await page.evaluate(() => [...document.querySelectorAll('.ss-beat')].every((b) => b.getAttribute('aria-hidden') === 'true')))
    const fullW = h.watch
    // hotspot tracks the watch while the camera travels (sample mid-motion)
    await page.evaluate((y) => window.scrollTo({ top: y, behavior: 'instant' }), g.top - g.ih + (k[3] + k[4]) / 2 * g.h)
    const track = []
    for (let n = 0; n < 6; n++) { await sleep(120); track.push(await hs(page, 'watch')) }
    check('seq: watch hotspot updates every frame during camera travel', new Set(track.map((t) => t.cx.toFixed(0))).size >= 3, track.map((t) => [t.cx, t.cy]))
    res.perf.watchTravel = await fps(page, 2000)
    await sleep(2500)
    await shot('q03_watch')
    h = { watch: await hs(page, 'watch'), shoes: await hs(page, 'shoes') }
    check('seq: watch beat → watch hotspot visible + emphasised', h.watch.visible === '1' && h.watch.emph === '1', h.watch)
    check('seq: watch beat → shoes hotspot hidden', h.shoes.visible === '0', h.shoes.visible)
    check('seq: watch beat copy shown', await page.evaluate(() => document.querySelector('.ss-beat.is-watch').getAttribute('aria-hidden') === 'false'))
    check('seq: panel not auto-opened by scroll', await page.evaluate(() => !document.querySelector('.story-panel')))
    check('seq: watch is on the left (clear of copy)', h.watch.cx < 1440 * 0.45, h.watch.cx)
    res.hotspots.seqWatch = h.watch
    await crop(page, 'q03b_watch_hotspot', h.watch, 320)
    res.perf.watchBeat = await fps(page)
    // Explore in the copy opens the panel; Esc closes; camera + focus return
    const w0 = h.watch
    await page.hover('.ss-beat.is-watch .ss-explore'); await sleep(900); await shot('q04_watch_explore_hover')
    await page.click('.ss-beat.is-watch .ss-explore'); await sleep(2600)
    check('seq: Explore opens watch panel', await page.evaluate(() => document.querySelector('.story-panel.is-watch .story-title')?.textContent === 'Watches Through My Career'))
    await shot('q05_watch_panel_from_scroll')
    await page.keyboard.press('Escape'); await panelGone(page)
    const w1 = await hs(page, 'watch')
    check('seq: camera back to the scroll-controlled watch shot after close', w1.visible === '1' && Math.abs(w1.cx - w0.cx) < 0.5 && Math.abs(w1.cy - w0.cy) < 0.5, [w0.cx, w0.cy, w1.cx, w1.cy])
    check('seq: focus returned to Explore button', await page.evaluate(() => document.activeElement?.classList.contains('ss-explore')))
    // hotspot click still opens the same panel in the beat
    await page.mouse.click(w1.cx, w1.cy); await sleep(2400)
    check('seq: watch hotspot opens panel in beat', await page.evaluate(() => !!document.querySelector('.story-panel.is-watch')))
    await page.keyboard.press('Escape'); await panelGone(page, 1000)
    await page.mouse.move(720, 450); await sleep(600)
    await at((k[4] + k[5]) / 2, 'q06_watch_to_shoes', 1600)
    h = await at((k[5] + k[6]) / 2, 'q07_shoes')
    check('seq: shoes beat → shoes hotspot visible + emphasised', h.shoes.visible === '1' && h.shoes.emph === '1', h.shoes)
    check('seq: shoes beat → watch hotspot hidden', h.watch.visible === '0', h.watch.visible)
    check('seq: shoes beat copy shown', await page.evaluate(() => document.querySelector('.ss-beat.is-shoes').getAttribute('aria-hidden') === 'false'))
    res.hotspots.seqShoes = h.shoes
    await crop(page, 'q07b_shoes_hotspot', h.shoes, 360)
    await page.hover('.ss-beat.is-shoes .ss-explore'); await sleep(900); await shot('q08_shoes_explore_hover')
    await page.click('.ss-beat.is-shoes .ss-explore'); await sleep(2800)
    check('seq: Explore opens Marvel panel', await page.evaluate(() => !!document.querySelector('.story-panel.is-shoes')))
    await shot('q09_marvel_panel_from_scroll')
    await page.click('.story-close'); await page.mouse.move(720, 450); await panelGone(page) // same pointer as the baseline
    const s1 = await hs(page, 'shoes')
    check('seq: camera back to shoes shot after close', s1.visible === '1' && Math.abs(s1.cx - h.shoes.cx) < 0.5 && Math.abs(s1.cy - h.shoes.cy) < 0.5, [h.shoes.cx, h.shoes.cy, s1.cx, s1.cy])
    await page.mouse.move(720, 450); await sleep(600)
    // ---- lanyard / career beat ----
    // smooth rise: jump from the shoes hold to the badge hold, sample the damped story coordinate every frame
    const cTrace = await page.evaluate(async (y) => {
      window.scrollTo({ top: y, behavior: 'instant' })
      const out = []
      await new Promise((res) => { const t0 = performance.now(); const f = () => { if (window.__qa) out.push(window.__qa.c); if (performance.now() - t0 < 2500) requestAnimationFrame(f); else res() }; requestAnimationFrame(f) })
      return out
    }, g.top - g.ih + ((k[7] + k[8]) / 2) * g.h)
    const mids = cTrace.filter((c) => c > 2.02 && c < 2.98).length
    let maxStep = 0; for (let n = 1; n < cTrace.length; n++) maxStep = Math.max(maxStep, cTrace[n] - cTrace[n - 1])
    check('lanyard: shoes → badge travels smoothly (no snap cut)', mids >= 5 && maxStep < 0.3 && cTrace.every((c, n) => n === 0 || c >= cTrace[n - 1] - 1e-6), { frames: cTrace.length, mids, maxStep: +maxStep.toFixed(3) })
    await at(k[6] + (k[7] - k[6]) * 0.5, 'q14_shoes_to_lanyard', 1500)
    h = await at((k[7] + k[8]) / 2, 'q15_lanyard')
    const lq = await qa(page)
    const lCard = await rect(page, '.ss-beat.is-career')
    res.hotspots.seqLanyard = { badge: lq && lq.badge, card: lCard }
    check('lanyard: camera settled on the badge pose', lq && Math.abs(lq.c - 3) < 1e-3, lq && lq.c)
    check('lanyard: badge fully on screen', lq && lq.badge.left > 0 && lq.badge.right < 1440 && lq.badge.top > 0 && lq.badge.bottom < 900, lq && lq.badge)
    const bh = lq ? lq.badge.bottom - lq.badge.top : 0
    check('lanyard: badge readable but not a product close-up (90–300 px tall of 900)', bh >= 90 && bh <= 300, +bh.toFixed(1))
    check('lanyard: copy does not cover the badge', lq && lCard && !overlaps(lq.badge, lCard), { badge: lq && lq.badge, card: lCard })
    check('lanyard: both hotspots hidden in the badge beat', h.watch.visible === '0' && h.shoes.visible === '0', [h.watch.visible, h.shoes.visible])
    const lCopy = await page.evaluate(() => ({
      beats: [...document.querySelectorAll('.ss-beat')].map((b) => [b.className.replace('ss-beat ', ''), b.getAttribute('aria-hidden')]),
      label: document.querySelector('.ss-beat.is-career .ss-label')?.textContent,
      title: document.querySelector('.ss-beat.is-career .ss-title')?.textContent,
      line: document.querySelector('.ss-beat.is-career .ss-line')?.textContent,
      cta: document.querySelector('.ss-beat.is-career .ss-explore')?.textContent.trim(),
    }))
    check('lanyard: only the career copy is shown', lCopy.beats.every(([c, a]) => (c === 'is-career') === (a === 'false')), lCopy.beats)
    check('lanyard: copy text', lCopy.label === 'CAREER / 03' && lCopy.title === 'Open to the Right Opportunity' && lCopy.line === 'Interested in Backend and Applied AI roles where I can build, learn, and take on meaningful engineering problems.' && /^Let’s Connect\s*→\s*Contact details$/.test(lCopy.cta), lCopy)
    check('lanyard: "Looking for Work" is not used as a heading', await page.evaluate(() => ![...document.querySelectorAll('h1,h2,h3')].some((e) => /looking for work/i.test(e.textContent))))
    check('lanyard: scroll does not open the contact panel', await page.evaluate(() => !document.querySelector('.contact-panel')))
    res.perf.lanyardBeat = await fps(page)
    await crop(page, 'q15b_lanyard_badge', { cx: (lq.badge.left + lq.badge.right) / 2, cy: (lq.badge.top + lq.badge.bottom) / 2 }, 360)
    // Let’s Connect → contact panel
    await page.hover('.ss-beat.is-career .ss-explore'); await sleep(900); await shot('q16_lanyard_cta_hover')
    await page.click('.ss-beat.is-career .ss-explore'); await sleep(1500)
    const ct = await page.evaluate(() => {
      const d = document.querySelector('[role="dialog"].contact-panel'); if (!d) return null
      return {
        modal: d.getAttribute('aria-modal'), title: d.querySelector('#contact-title')?.textContent, focus: document.activeElement?.className,
        overflow: document.body.style.overflow, storyPanel: !!document.querySelector('.story-panel'),
        links: [...d.querySelectorAll('.ct-list a')].map((a) => ({ href: a.getAttribute('href'), target: a.target, rel: a.rel })),
        placeholders: [...d.querySelectorAll('.ct-row.is-placeholder .ct-key')].map((e) => e.textContent),
        invented: [...d.querySelectorAll('.ct-list a')].some((a) => !['https://github.com/sohaib-0897', 'https://www.linkedin.com/in/muhammad-sohaib-imran-0z9/', 'mailto:msohaibimran1@gmail.com', 'tel:+923004599778'].includes(a.getAttribute('href'))),
      }
    })
    await shot('q17_contact_panel')
    check('contact: Let’s Connect opens a small contact dialog (not a story panel)', ct && ct.modal === 'true' && ct.title === 'Let’s Connect' && !ct.storyPanel, ct)
    check('contact: supplied GitHub and LinkedIn profiles open safely', ct && ct.links.length === 4 && ct.links.some((link) => link.href === 'https://github.com/sohaib-0897') && ct.links.some((link) => link.href === 'https://www.linkedin.com/in/muhammad-sohaib-imran-0z9/') && ct.links.filter((link) => /^https:/.test(link.href)).every((link) => link.target === '_blank' && /noopener/.test(link.rel)) && !ct.invented, ct && ct.links)
    check('contact: supplied email and phone are actionable', ct && ct.placeholders.length === 0 && ct.links.some((link) => link.href === 'mailto:msohaibimran1@gmail.com') && ct.links.some((link) => link.href === 'tel:+923004599778'), ct && ct.links)
    check('contact: focus moved into dialog + scroll locked', ct && /story-close/.test(ct.focus) && ct.overflow === 'hidden', ct && [ct.focus, ct.overflow])
    for (let n = 0; n < 5; n++) await page.keyboard.press('Tab')
    check('contact: Tab focus trapped in dialog', await page.evaluate(() => !!document.activeElement?.closest('.contact-panel')))
    await page.keyboard.press('Escape'); await page.waitForSelector('.contact-panel', { state: 'detached' }); await sleep(500)
    const ctClosed = await page.evaluate(() => ({ open: !!document.querySelector('.contact-panel'), focus: document.activeElement?.className || '', overflow: document.body.style.overflow }))
    check('contact: Esc closes, scroll unlocked', !ctClosed.open && ctClosed.overflow === '', ctClosed)
    check('contact: focus returned to Let’s Connect', /ss-explore/.test(ctClosed.focus) && await page.evaluate(() => !!document.activeElement?.closest('.ss-beat.is-career')), ctClosed.focus)
    const lq2 = await qa(page)
    check('contact: camera unchanged by the panel', lq2 && Math.abs(lq2.badge.left - lq.badge.left) < 0.5 && Math.abs(lq2.badge.top - lq.badge.top) < 0.5, [lq.badge.left, lq.badge.top, lq2 && lq2.badge.left, lq2 && lq2.badge.top])
    await page.keyboard.press('Enter'); await sleep(1300)
    check('contact: Enter on Let’s Connect opens it', await page.evaluate(() => !!document.querySelector('.contact-panel')))
    await page.mouse.click(200, 450); await page.waitForSelector('.contact-panel', { state: 'detached' }); await sleep(500)
    check('contact: backdrop click closes', await page.evaluate(() => !document.querySelector('.contact-panel')))
    await page.mouse.move(720, 450); await sleep(600)
    // lanyard → works: pull back to the approved full-body shot
    await at((k[8] + k[9]) / 2, 'q10_return_mid', 1400)
    h = await at((k[9] + 1) / 2, 'q11_return_fullbody')
    check('seq: return lands on the exact full-body shot', h.watch.visible === '1' && Math.abs(h.watch.cx - fullW.cx) < 0.5 && Math.abs(h.watch.cy - fullW.cy) < 0.5, [fullW.cx, fullW.cy, h.watch.cx, h.watch.cy])
    const gt = await galleryTop(page)
    await scrollTo(page, gt, 3000); await shot('q12_works_pinned')
    const wWorks = await hs(page, 'watch')
    check('seq: works full-body unchanged (= story full body)', Math.abs(wWorks.cx - fullW.cx) < 0.5 && Math.abs(wWorks.cy - fullW.cy) < 0.5, [fullW.cx, fullW.cy, wWorks.cx, wWorks.cy])
    await scrollTo(page, gt + 1440 * 0.5, 2500); await shot('q13_works_cards_entering')
    const ox = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    check('seq: no horizontal overflow (desktop)', ox <= 0, ox)
    await ctx.close()

    // reduced motion: stable compositions, no interpolated travel
    {
      const { ctx, page } = await newPage(browser, { viewport: { width: 1440, height: 900 }, reducedMotion: 'reduce' }, 'reduced')
      await page.mouse.move(720, 450)
      const g2 = await geo(page)
      await page.evaluate((y) => window.scrollTo({ top: y, behavior: 'instant' }), g2.top - g2.ih + (k[3] + k[4]) / 2 * g2.h)
      await sleep(250); const a1 = await hs(page, 'watch'); await sleep(1500); const a2 = await hs(page, 'watch')
      check('reduced motion: watch composition is immediate (no travel)', a1.visible === '1' && Math.abs(a1.cx - a2.cx) < 1 && Math.abs(a1.cy - a2.cy) < 1, [a1.cx, a1.cy, a2.cx, a2.cy])
      await page.screenshot({ path: path.join(OUT, 'q20_reduced_watch.png') })
      check('reduced motion: copy + Explore present', await page.evaluate(() => document.querySelector('.ss-beat.is-watch').getAttribute('aria-hidden') === 'false'))
      await toP(page, g2, (k[5] + k[6]) / 2, 1500)
      await page.screenshot({ path: path.join(OUT, 'q21_reduced_shoes.png') })
      const b = await hs(page, 'shoes')
      check('reduced motion: shoes composition shown', b.visible === '1', b.visible)
      await page.evaluate((y) => window.scrollTo({ top: y, behavior: 'instant' }), g2.top - g2.ih + (k[7] + k[8]) / 2 * g2.h)
      await sleep(250); const r1 = await qa(page); await sleep(1500); const r2 = await qa(page)
      check('reduced motion: lanyard composition is immediate (no travel)', r1 && r1.c === 3 && Math.abs(r1.badge.top - r2.badge.top) < 1, [r1 && r1.c, r1 && r1.badge.top, r2 && r2.badge.top])
      await page.screenshot({ path: path.join(OUT, 'q22_reduced_lanyard.png') })
      await ctx.close()
    }

    // mobile beats
    for (const m of [{ tag: 'm390x844', viewport: { width: 390, height: 844 }, deviceScaleFactor: 3 }, { tag: 'm360x740', viewport: { width: 360, height: 740 }, deviceScaleFactor: 2 }]) {
      const { ctx, page } = await newPage(browser, { viewport: m.viewport, deviceScaleFactor: m.deviceScaleFactor, isMobile: true, hasTouch: true }, `seq-${m.tag}`)
      const g3 = await geo(page); const km = keys(SEQ.m)
      await toP(page, g3, (km[3] + km[4]) / 2, 3200)
      await page.screenshot({ path: path.join(OUT, `q30_${m.tag}_watch.png`) })
      const mw = await hs(page, 'watch')
      const copyTop = await page.evaluate(() => document.querySelector('.ss-beat.is-watch').getBoundingClientRect().top)
      check(`${m.tag}: watch beat hotspot visible above the copy`, mw.visible === '1' && mw.cy + mw.w / 2 < copyTop, [mw.visible, mw.cy, copyTop])
      await page.tap('.ss-beat.is-watch .ss-explore'); await sleep(2600)
      check(`${m.tag}: tap Explore opens watch panel`, await page.evaluate(() => !!document.querySelector('.story-panel.is-watch')))
      await page.tap('.story-close'); await panelGone(page, 1000)
      await toP(page, g3, (km[5] + km[6]) / 2, 3200)
      await page.screenshot({ path: path.join(OUT, `q31_${m.tag}_shoes.png`) })
      const ms = await hs(page, 'shoes')
      const copyTop2 = await page.evaluate(() => document.querySelector('.ss-beat.is-shoes').getBoundingClientRect().top)
      check(`${m.tag}: shoes beat hotspot visible above the copy`, ms.visible === '1' && ms.cy < copyTop2, [ms.visible, ms.cy, copyTop2])
      await page.touchscreen.tap(ms.cx, ms.cy); await sleep(2600)
      check(`${m.tag}: tap shoes hotspot opens Marvel panel`, await page.evaluate(() => !!document.querySelector('.story-panel.is-shoes')))
      await page.tap('.story-close'); await panelGone(page, 1000)
      // lanyard beat: wider chest shot, badge above the bottom copy card
      await toP(page, g3, (km[7] + km[8]) / 2, 3200)
      await page.screenshot({ path: path.join(OUT, `q32_${m.tag}_lanyard.png`) })
      const mq = await qa(page)
      const mCard = await rect(page, '.ss-beat.is-career')
      const vpm = page.viewportSize()
      check(`${m.tag}: lanyard badge on screen, above the copy card`, mq && mq.badge.left > 0 && mq.badge.right < vpm.width && mq.badge.top > 0 && mCard && mq.badge.bottom < mCard.top, { badge: mq && mq.badge, cardTop: mCard && mCard.top })
      const mbh = mq ? mq.badge.bottom - mq.badge.top : 0
      check(`${m.tag}: lanyard is a chest shot, not an extreme close-up (badge ≤ 20% of height)`, mbh > 40 && mbh <= vpm.height * 0.2, +mbh.toFixed(1))
      check(`${m.tag}: career copy card shown`, await page.evaluate(() => document.querySelector('.ss-beat.is-career').getAttribute('aria-hidden') === 'false'))
      await page.tap('.ss-beat.is-career .ss-explore'); await sleep(1500)
      check(`${m.tag}: tap Let’s Connect opens contact panel`, await page.evaluate(() => !!document.querySelector('.contact-panel')))
      await page.screenshot({ path: path.join(OUT, `q33_${m.tag}_contact.png`) })
      const cpOx = await page.evaluate(() => { const r = document.querySelector('.contact-panel').getBoundingClientRect(); return { left: r.left, right: r.right, vw: window.innerWidth } })
      check(`${m.tag}: contact panel fits the viewport`, cpOx.left >= 0 && cpOx.right <= cpOx.vw + 0.5, cpOx)
      await page.tap('.story-close'); await sleep(1500)
      check(`${m.tag}: contact panel closes`, await page.evaluate(() => !document.querySelector('.contact-panel')))
      const ox = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
      check(`${m.tag}: no horizontal overflow in story beats`, ox <= 0, ox)
      await ctx.close()
    }
  }

  // ================= VIEWPORT / DPR VARIANTS (alignment) =================
  for (const v of [
    { tag: 'v1280x720_dpr1', viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 },
    { tag: 'v1920x1080_dpr1', viewport: { width: 1920, height: 1080 }, deviceScaleFactor: 1 },
    { tag: 'v1440x900_dpr2', viewport: { width: 1440, height: 900 }, deviceScaleFactor: 2 },
  ]) {
    const { ctx, page } = await newPage(browser, { viewport: v.viewport, deviceScaleFactor: v.deviceScaleFactor }, v.tag)
    // Inspect the final full-body hold before project cards can occlude the hotspots.
    const g = await page.evaluate(() => {
      const el = document.querySelector('.story-scroll')
      return el.getBoundingClientRect().top + scrollY + el.offsetHeight - innerHeight - innerHeight * 0.075
    })
    await scrollTo(page, g, 3000)
    const w = await hs(page, 'watch'); const s = await hs(page, 'shoes')
    res.hotspots[v.tag] = { watch: w, shoes: s }
    check(`${v.tag}: hotspots visible`, w.visible === '1' && s.visible === '1', [w.visible, s.visible])
    await page.focus('.story-hotspot.is-watch'); await sleep(400)
    await crop(page, `v_${v.tag}_watch`, w)
    await page.focus('.story-hotspot.is-shoes'); await sleep(400)
    await crop(page, `v_${v.tag}_shoes`, s, 360)
    await ctx.close()
  }

  // ================= MOBILE =================
  for (const m of [
    { tag: 'm390x844', viewport: { width: 390, height: 844 }, deviceScaleFactor: 3 },
    { tag: 'm360x740', viewport: { width: 360, height: 740 }, deviceScaleFactor: 2 },
  ]) {
    const { ctx, page } = await newPage(browser, { viewport: m.viewport, deviceScaleFactor: m.deviceScaleFactor, isMobile: true, hasTouch: true }, m.tag)
    const shot = (n) => page.screenshot({ path: path.join(OUT, `${m.tag}_${n}.png`) })
    await shot('01_hero')
    const heroLabel = await rect(page, '.hm-bl')
    const heroQa = await qa(page)
    check(`${m.tag}: hero AGENTS · VISION · RETRIEVAL label clear of the badge`, heroLabel && heroQa && !overlaps(heroLabel, heroQa.badge), { label: heroLabel, badge: heroQa && heroQa.badge })
    const stageTop = await page.evaluate(() => { const el = document.querySelector('.wk-stage'); return el.getBoundingClientRect().top + window.scrollY })
    const g = await galleryTop(page)
    // scroll so the stage fills the screen (below the Works title)
    await scrollTo(page, Math.max(g, stageTop - 60), 3200)
    await shot('02_works_stage')
    let w = await hs(page, 'watch'); const s = await hs(page, 'shoes')
    res.hotspots[m.tag] = { watch: w, shoes: s }
    // taps emit compat mouse events that feed the camera parallax → pin the pointer at the watch first, then baseline
    await page.mouse.move(w.cx, w.cy); await sleep(2500)
    w = await hs(page, 'watch')
    check(`${m.tag}: watch hotspot visible on stage`, w.visible === '1', w)
    check(`${m.tag}: shoes hotspot visible on stage`, s.visible === '1', s)
    const overflowX = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
    check(`${m.tag}: no horizontal overflow`, overflowX <= 0, overflowX)
    if (w.visible === '1') {
      await page.touchscreen.tap(w.cx, w.cy); await sleep(2600)
      const open = await page.evaluate(() => !!document.querySelector('.story-panel.is-watch'))
      check(`${m.tag}: tap opens watch panel`, open, open)
      await shot('03_watch_panel')
      await page.tap('.wt-nav button:last-child'); await sleep(500)
      await page.tap('.wt-nav button:last-child'); await sleep(900)
      await shot('04_watch_panel_stage3')
      await page.tap('.story-close'); await sleep(3200)
    }
    const s2 = await hs(page, 'shoes')
    if (s2.visible === '1') {
      await page.touchscreen.tap(s2.cx, s2.cy); await sleep(2800)
      const open = await page.evaluate(() => !!document.querySelector('.story-panel.is-shoes'))
      check(`${m.tag}: tap opens Marvel panel`, open, open)
      await shot('05_marvel_panel')
      await page.tap('.story-close'); await sleep(3000)
    }
    await page.mouse.move(w.cx, w.cy); await sleep(2500) // same pointer as the baseline
    const w3 = await hs(page, 'watch')
    check(`${m.tag}: camera restored after close`, w3.visible === '1' && Math.abs(w3.cx - w.cx) < 0.3 && Math.abs(w3.cy - w.cy) < 0.3, [w.cx, w.cy, w3.cx, w3.cy])
    // cards below still usable
    const first = await page.evaluate(() => { const el = document.querySelector('.wk-card'); return el.getBoundingClientRect().top + window.scrollY })
    await scrollTo(page, first - 20, 2000)
    await shot('06_works_card1')
    const wCard = await hs(page, 'watch')
    check(`${m.tag}: hotspots hidden over cards`, wCard.visible === '0', wCard.visible)
    await ctx.close()
  }

  res.passed = res.checks.every((c) => c.ok)
  fs.writeFileSync(path.join(OUT, 'result.json'), JSON.stringify(res, null, 2))
  console.log(JSON.stringify({ passed: res.passed, failed: res.checks.filter((c) => !c.ok), perf: res.perf, logs: res.logs.slice(0, 20) }, null, 1))
  await browser.close()
  if (!res.passed) process.exitCode = 1
})().catch((e) => { console.error(e); process.exit(1) })
