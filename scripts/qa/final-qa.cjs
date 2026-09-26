// Final QA against the production build (npm run preview on :4173).
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
const OUT = path.join(__dirname, 'screenshots')
fs.mkdirSync(OUT, { recursive: true })
const URL = process.env.BASE_URL || 'http://localhost:4173/'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const EXPECTED = {
  datashield: 'https://github.com/sohaib-0897/DataShield',
  omniops: 'https://github.com/sohaib-0897/OmniOps',
  vigilai: 'https://github.com/sohaib-0897/VigilAi',
  inboxlearn: 'https://github.com/sohaib-0897/InboxLearn',
}

async function load(page) {
  await page.goto(URL, { waitUntil: 'domcontentloaded' })
  await page.waitForSelector('canvas', { timeout: 60000, state: 'attached' })
  await page.waitForFunction(() => {
    const l = document.querySelector('.loading-screen'); return !l || l.classList.contains('is-hidden')
  }, null, { timeout: 90000 })
  await sleep(3000)
}

;(async () => {
  const res = { checks: [], logs: [], failedRequests: [] }
  const check = (name, ok, detail) => res.checks.push({ name, ok: !!ok, detail })
  const browser = await chromium.launch({ args: ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=d3d11'] })

  // ---------------- desktop ----------------
  const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
  page.on('console', (m) => { if (m.type() === 'error') res.logs.push('desktop: ' + m.text()) })
  page.on('pageerror', (e) => res.logs.push('desktop pageerror: ' + e.message))
  page.on('response', (r) => { if (r.status() >= 400) res.failedRequests.push(`${r.status()} ${r.url()}`) })
  await load(page)
  const shot = (p, n) => p.screenshot({ path: path.join(OUT, n + '.png') })
  const scrollTo = async (p, y, w = 2800) => { await p.evaluate((y) => window.scrollTo(0, y), y); await sleep(w) }

  await page.mouse.move(720, 450); await sleep(1200)
  await shot(page, '01_desktop_hero')
  const heroText = await page.evaluate(() => ({
    title: document.querySelector('.about-title')?.textContent,
    role: document.querySelector('.about-role')?.textContent,
    titlePx: getComputedStyle(document.querySelector('.about-title')).fontSize,
    rolePx: getComputedStyle(document.querySelector('.about-role')).fontSize,
    bodyPx: getComputedStyle(document.querySelector('.about-body')).fontSize,
    docTitle: document.title,
    bodyText: document.body.innerText,
  }))
  check('hero name', heroText.title === 'SOHAIB IMRAN', heroText.title)
  check('hero role', heroText.role === 'Backend / Applied AI Engineer', heroText.role)
  res.heroSizes = { title: heroText.titlePx, role: heroText.rolePx, body: heroText.bodyPx, docTitle: heroText.docTitle }
  const banned = /\bSen\b|Zheng|郑|ZOOOP|HOTSAR|Bilibili|Douyin|Shenzhen|[\u4e00-\u9fff]/
  check('no old identity text visible on page', !banned.test(heroText.bodyText), (heroText.bodyText.match(banned) || [''])[0])

  // résumé stops
  const stops = await page.evaluate(() => ['focus-1', 'focus-2', 'focus-3', 'focus-4', 'focus-5'].map((n) => {
    const el = document.querySelector(`[data-point="${n}"]`)
    return el ? { top: el.getBoundingClientRect().top + window.scrollY, title: el.querySelector('.tl-place')?.textContent } : null
  }))
  const wantTitles = ['DataShield', 'OmniOps', 'VigilAI', 'InboxLearn', 'Applied AI & Agents']
  check('five résumé anchors in order', stops.every((s, i) => s && s.title === wantTitles[i]), stops.map((s) => s && s.title).join(' | '))
  for (let i = 0; i < 5; i++) { await scrollTo(page, stops[i].top - 900 * 0.3); await shot(page, `1${i + 1}_desktop_resume_focus-${i + 1}`) }

  // works
  const g = await page.evaluate(() => { const el = document.querySelector('.wk-gallery'); return el.getBoundingClientRect().top + window.scrollY })
  const range = await page.evaluate(() => document.querySelector('.wk-gallery').offsetHeight - window.innerHeight)
  await scrollTo(page, g + range * 0.3, 2600); await shot(page, '20_desktop_works_01_02')
  await scrollTo(page, g + range * 0.72, 2600); await shot(page, '21_desktop_works_02_03')
  await scrollTo(page, g + range, 2600); await shot(page, '22_desktop_works_03_04')
  const cards = await page.evaluate(() => [...document.querySelectorAll('.wk-card')].map((c) => ({
    title: c.querySelector('.wk-card-title')?.textContent,
    tagline: c.querySelector('.wk-card-tagline')?.textContent,
    cover: c.querySelector('.wk-card-cover img') ? c.querySelector('.wk-card-cover img').getAttribute('src') : null,
    coverLoaded: c.querySelector('.wk-card-cover img') ? c.querySelector('.wk-card-cover img').naturalWidth : 0,
  })))
  res.cards = cards
  check('four works cards in order', cards.map((c) => c.title).join(',') === 'DataShield,OmniOps,VigilAI,InboxLearn', cards.map((c) => c.title).join(','))
  check('covers load (omniops, inboxlearn)', cards[1].coverLoaded > 0 && cards[3].coverLoaded > 0, `${cards[1].coverLoaded} / ${cards[3].coverLoaded}`)

  // detail pages: open every card's item, verify title + GitHub href, screenshot each
  const slugs = ['datashield', 'omniops', 'vigilai', 'inboxlearn']
  res.details = []
  for (let i = 0; i < 4; i++) {
    // scroll the horizontal gallery so card i is on screen, then click its line
    await scrollTo(page, g + range * [0.3, 0.3, 0.72, 1][i], 1800)
    const btn = page.locator('.wk-card').nth(i).locator('.wk-line-btn')
    await btn.click()
    await page.waitForSelector('.wk-detail', { timeout: 5000 }); await sleep(900)
    const d = await page.evaluate(() => ({
      title: document.querySelector('.wk-detail-title')?.textContent,
      sub: document.querySelector('.wk-detail-sub')?.textContent,
      tags: [...document.querySelectorAll('.wk-detail .wk-badge')].map((b) => b.textContent),
      body: document.querySelector('.wk-md')?.textContent?.trim().slice(0, 60),
      href: document.querySelector('a.wk-detail-link')?.getAttribute('href'),
      target: document.querySelector('a.wk-detail-link')?.getAttribute('target'),
      label: document.querySelector('a.wk-detail-link')?.textContent,
    }))
    res.details.push(d)
    check(`detail ${slugs[i]} link`, d.href === EXPECTED[slugs[i]] && d.target === '_blank', d.href)
    await shot(page, `3${i + 1}_desktop_detail_${slugs[i]}`)
    await page.keyboard.press('Escape'); await sleep(700)
  }

  // GitHub URLs actually resolve
  res.github = {}
  for (const [k, u] of Object.entries(EXPECTED)) {
    try { const r = await fetch(u, { method: 'GET', redirect: 'follow' }); res.github[k] = r.status; check(`github ${k} reachable`, r.status === 200, r.status) }
    catch (e) { res.github[k] = String(e); check(`github ${k} reachable`, false, String(e)) }
  }
  await page.close()

  // ---------------- mobile ----------------
  const m = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
  m.on('console', (x) => { if (x.type() === 'error') res.logs.push('mobile: ' + x.text()) })
  m.on('pageerror', (e) => res.logs.push('mobile pageerror: ' + e.message))
  await load(m)
  await shot(m, '40_mobile_hero')
  const overflowX = await m.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  check('mobile: no horizontal overflow', overflowX <= 0, overflowX)
  const mg = await m.evaluate(() => [...document.querySelectorAll('.wk-card')].map((c) => c.getBoundingClientRect().top + window.scrollY))
  const title = await m.evaluate(() => { const el = document.querySelector('.wk-gallery-title'); return el.getBoundingClientRect().top + window.scrollY })
  await scrollTo(m, title - 20, 2500); await shot(m, '41_mobile_works_top')
  for (let i = 0; i < mg.length; i++) { await scrollTo(m, mg[i] - 10, 1800); await shot(m, `4${i + 2}_mobile_works_card_${i + 1}`) }
  // open one detail on mobile
  await m.locator('.wk-card').nth(1).locator('.wk-line-btn').tap(); await sleep(1100)
  await shot(m, '47_mobile_detail_omniops')
  const mHref = await m.evaluate(() => document.querySelector('a.wk-detail-link')?.getAttribute('href'))
  check('mobile detail link', mHref === EXPECTED.omniops, mHref)

  res.passed = res.checks.every((c) => c.ok)
  fs.writeFileSync(path.join(OUT, 'result.json'), JSON.stringify(res, null, 2))
  console.log(JSON.stringify({ passed: res.passed, checks: res.checks, heroSizes: res.heroSizes, github: res.github, logs: res.logs, failedRequests: res.failedRequests, details: res.details }, null, 1))
  await browser.close()
})().catch((e) => { console.error(e); process.exit(1) })
