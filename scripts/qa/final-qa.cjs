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
  'llm-inference-lab': 'https://github.com/sohaib-0897/llm-inference-lab',
}
const LIVE = {
  vigilai: 'http://0897vigilai.duckdns.org/',
  omniops: 'https://omniops.duckdns.org/',
  'llm-inference-lab': 'https://sohaib-0897.github.io/llm-inference-lab/',
  inboxlearn: 'https://inboxlearn-d4kkvrrgrz6q9icqxnzqyq.streamlit.app/',
}
const CERTIFICATES = [
  'https://coursera.org/share/e6fd0f90e37b4742a2cc5feb152d2443',
  'https://coursera.org/share/334b00140bcdca82ed42015d27740989',
  'https://coursera.org/share/42af0d17589feeef9ceb8e4c99cc2341',
  'https://coursera.org/share/dbc62f5e6837b9e73c0edd3cf4c9e21b',
]

async function lanyardQa(page, check, shot) {
  const trigger = page.locator('.story-hotspot.is-lanyard')
  await trigger.waitFor({ state: 'visible' })
  const mobile = await page.evaluate(() => matchMedia('(pointer: coarse)').matches)
  if (mobile) await trigger.tap()
  else await trigger.hover()
  const panel = page.locator('.lanyard-credentials')
  await panel.waitFor({ state: 'visible' })
  check('lanyard hover / tap reveals credentials', await trigger.getAttribute('aria-expanded') === 'true')
  const identity = await panel.innerText()
  check('lanyard preserves identity', ['SOHAIB IMRAN', 'Backend / Applied AI Engineer', 'OPEN TO OPPORTUNITIES'].every((text) => identity.includes(text)))
  check('lanyard five courses / four safe certificate links', await panel.locator('li').count() === 5 && await panel.locator('a').evaluateAll((links) => links.length === 4 && links.every((a) => a.target === '_blank' && a.rel.includes('noopener'))))
  check('lanyard is within viewport and has no text overflow', await panel.evaluate((el) => { const r = el.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight && el.scrollWidth <= el.clientWidth }))
  const badge = await trigger.boundingBox()
  check('credentials do not cover the lanyard', await panel.evaluate((el, badge) => { const r = el.getBoundingClientRect(); return r.right <= badge.x || r.left >= badge.x + badge.width || r.bottom <= badge.y || r.top >= badge.y + badge.height }, badge))
  await shot('lanyard_credentials')
  await panel.locator('.story-close').click()
  await panel.waitFor({ state: 'detached' })
  await trigger.blur()
  await trigger.focus()
  await panel.waitFor({ state: 'visible' })
  await page.keyboard.press('Tab')
  await page.keyboard.press('Tab')
  check('lanyard keyboard reaches certificate action', await page.evaluate(() => document.activeElement.closest('.lanyard-credentials') && document.activeElement.textContent.includes('Certificate')))
  await page.keyboard.press('Escape')
  await panel.waitFor({ state: 'detached' })
  check('lanyard Escape returns focus to badge', await trigger.evaluate((el) => el === document.activeElement))
  await page.mouse.move(0, 0)
  await trigger.blur()
}

async function profileQa(page, check, shot) {
  // Walk the existing career beat rather than bypassing its interaction.
  const bounds = await page.locator('.story-scroll').evaluate((el) => ({ top: el.getBoundingClientRect().top + scrollY, height: el.offsetHeight }))
  for (let t = 0.65; t <= 0.95; t += 0.025) {
    await page.evaluate(({ bounds, t }) => scrollTo(0, bounds.top - innerHeight + bounds.height * t), { bounds, t })
    await sleep(250)
    if (await page.locator('.ss-beat.is-career').evaluate((el) => !el.hasAttribute('inert') && +getComputedStyle(el).opacity > 0.9)) break
  }
  await lanyardQa(page, check, shot)
  await page.locator('.ss-beat.is-career .ss-explore').click()
  await page.waitForSelector('.contact-panel')
  await sleep(500)
  const panel = page.locator('.contact-panel')
  check('full professional name in career panel', (await panel.innerText()).includes('Muhammad Sohaib Imran'))
  check('supplied LinkedIn profile opens safely', await panel.locator('.ct-list a').evaluateAll((links) => links.some((a) => a.href === 'https://www.linkedin.com/in/muhammad-sohaib-imran-0z9/' && a.target === '_blank' && a.rel.includes('noopener'))))
  check('supplied email and phone use native actions', await panel.locator('.ct-list a').evaluateAll((links) => links.some((a) => a.getAttribute('href') === 'mailto:msohaibimran1@gmail.com' && !a.target) && links.some((a) => a.getAttribute('href') === 'tel:+923004599778' && !a.target)))
  check('CV sections start collapsed', await panel.locator('details[open]').count() === 0)
  await shot('career_collapsed')
  for (const label of ['Experience', 'Education', 'Certifications', 'Skills', 'Leadership']) {
    const detail = panel.locator('details').filter({ has: page.locator('summary', { hasText: label }) })
    await detail.locator('summary').click()
    const text = await detail.innerText()
    if (label === 'Experience') check('Systems before Multan, current contract dates', text.indexOf('Systems International') < text.indexOf('Multan Beverages') && text.includes('Jun – Jul 2026') && text.includes('15%'))
    if (label === 'Education') check('graduated education with year-only degree dates', text.includes('2022 – 2026') && text.includes('Graduated 2022') && !/Expected|student/i.test(text))
    if (label === 'Certifications') {
      const links = await detail.locator('a').evaluateAll((links) => links.map((a) => ({ href: a.href, target: a.target, rel: a.rel, text: a.textContent })))
      check('four safe Certificate links and ongoing course without certificate', JSON.stringify(links.map((a) => a.href)) === JSON.stringify(CERTIFICATES) && links.every((a) => a.target === '_blank' && a.rel.includes('noopener') && a.text === 'Certificate ↗') && text.includes('Building with the Claude API') && text.includes('Ongoing'))
    }
    if (label === 'Skills') check('priority backend, AI, retrieval and infrastructure skills', ['Python', 'FastAPI', 'PostgreSQL', 'MCP', 'Hybrid Retrieval', 'ONNX Runtime', 'GitHub Actions'].every((skill) => text.includes(skill)))
    if (label === 'Leadership') check('all leadership roles', text.includes('Vice President') && text.includes('Co-Vice Head') && text.includes('NASCON 2024–25'))
    check(`${label}: contained horizontally`, await detail.evaluate((el) => el.scrollWidth <= el.clientWidth))
    await shot(`career_${label.toLowerCase()}`)
    await detail.locator('summary').click()
  }
  // Tab stays inside the dialog and skips links in collapsed details.
  await panel.locator('.story-close').focus()
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press('Tab')
    check('career keyboard focus stays in visible controls', await page.evaluate(() => !!document.activeElement.closest('.contact-panel') && document.activeElement.getClientRects().length > 0))
  }
  await page.keyboard.press('Escape')
  await panel.waitFor({ state: 'detached' })
  check('career close restores page scrolling', await page.evaluate(() => document.body.style.overflow !== 'hidden'))
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
  check('landing social links visible and safe', await page.locator('.hero-socials a').evaluateAll((links) => links.length === 2 && links.every((a) => a.target === '_blank' && a.rel.includes('noopener') && getComputedStyle(a.closest('nav')).visibility === 'visible')))
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
  check('hero role', heroText.role === 'Software Engineer · Backend & Applied AI Systems', heroText.role)
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
  await profileQa(page, check, (name) => shot(page, `desktop_${name}`))

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
  check('five works cards in priority order', cards.map((c) => c.title).join(',') === 'VigilAI,OmniOps,llm-inference-lab,InboxLearn,DataShield', cards.map((c) => c.title).join(','))
  check('four approved covers load; DataShield retains placeholder', cards.slice(0, 4).every((c) => c.coverLoaded > 0) && cards[4].cover === null, cards)

  // detail pages: open every card's item, verify title + GitHub href, screenshot each
  const slugs = ['vigilai', 'omniops', 'llm-inference-lab', 'inboxlearn', 'datashield']
  res.details = []
  for (let i = 0; i < slugs.length; i++) {
    // scroll the horizontal gallery so card i is on screen, then click its line
    const offset = await page.locator('.wk-card').nth(i).evaluate((el) => el.offsetLeft + el.offsetWidth / 2 - innerWidth / 2)
    await scrollTo(page, g + Math.min(range, Math.max(0, offset)), 1800)
    const btn = page.locator('.wk-card').nth(i).locator('.wk-line-btn')
    await btn.click()
    await page.waitForSelector('.wk-detail', { timeout: 5000 }); await sleep(900)
    const d = await page.evaluate(() => ({
      title: document.querySelector('.wk-detail-title')?.textContent,
      sub: document.querySelector('.wk-detail-sub')?.textContent,
      tags: [...document.querySelectorAll('.wk-detail .wk-badge')].map((b) => b.textContent),
      body: document.querySelector('.wk-md')?.textContent?.trim().slice(0, 60),
      href: [...document.querySelectorAll('a.wk-detail-link[target]')].find((a) => a.textContent.includes('GitHub'))?.getAttribute('href'),
      target: document.querySelector('a.wk-detail-link[target]')?.getAttribute('target'),
      label: document.querySelector('a.wk-detail-link[target]')?.textContent,
      links: [...document.querySelectorAll('a.wk-detail-link[target]')].map((a) => ({ href: a.href, label: a.textContent.trim(), target: a.target, rel: a.rel })),
      fullBody: document.querySelector('.wk-md')?.textContent,
    }))
    res.details.push(d)
    check(`detail ${slugs[i]} link`, d.href === EXPECTED[slugs[i]] && d.target === '_blank', d.href)
    check(`detail ${slugs[i]} Details / Live / GitHub controls`, d.links.at(-1).label === 'GitHub ↗' && d.links.every((a) => a.target === '_blank' && a.rel.includes('noopener')) && (LIVE[slugs[i]] ? d.links.length === 2 && d.links[0].href === LIVE[slugs[i]] && d.links[0].label === 'Live ↗' : d.links.length === 1), d.links)
    if (slugs[i] === 'vigilai') check('VigilAI benchmarks retain CPU / hardware context', ['17.3 FPS', '52.2 ms', '21.7 FPS', '36.6 ms', 'i5-13420H', 'no GPU'].every((x) => d.fullBody.includes(x)))
    if (slugs[i] === 'inboxlearn') check('InboxLearn metrics retain synthetic/demo context', d.fullBody.includes('fixed synthetic/demo dataset') && d.fullBody.includes('50% → 90%') && d.fullBody.includes('30% → 80%'))
    if (slugs[i] === 'llm-inference-lab') check('inference benchmark retains model / hardware context', ['Qwen 0.5B', '227 tokens/sec', 'RTX 4050', '6 GB VRAM'].every((x) => d.fullBody.includes(x)))
    check(`detail ${slugs[i]} compact navigation`, await page.locator('.wk-detail-actions').evaluate((el) => el.querySelector('[aria-current="page"]')?.textContent === 'Details' && el.getBoundingClientRect().bottom < innerHeight))
    if (i < 4) check(`detail ${slugs[i]} approved screenshot`, await page.locator('.wk-detail-banner img').evaluate((el) => el.naturalWidth > 0 && getComputedStyle(el).objectFit === 'contain'))
    if (i < 4) check(`detail ${slugs[i]} holder fits native ratio`, await page.locator('.wk-detail-banner').evaluate((el) => { const image=el.querySelector('img'), r=el.getBoundingClientRect(); return Math.abs(r.width/r.height-image.naturalWidth/image.naturalHeight) < 0.01 }))
    await shot(page, `3${i + 1}_desktop_detail_${slugs[i]}`)
    const scrollBeforeDetails = await page.evaluate(() => scrollY)
    await page.locator('.wk-detail-actions [aria-current]').click()
    check(`detail ${slugs[i]} Details stays inside portfolio`, await page.evaluate((before) => !!document.querySelector('.wk-detail') && scrollY === before, scrollBeforeDetails))
    await page.keyboard.press('Escape'); await sleep(700)
  }

  // GitHub URLs actually resolve
  res.github = {}
  for (const [k, u] of Object.entries(EXPECTED)) {
    try { const r = await fetch(u, { method: 'GET', redirect: 'follow', signal: AbortSignal.timeout(15000) }); res.github[k] = r.status; check(`github ${k} reachable`, r.status === 200, r.status) }
    catch (e) { res.github[k] = String(e); check(`github ${k} reachable`, false, String(e)) }
  }
  res.external = await Promise.all([...Object.values(LIVE), ...CERTIFICATES].map(async (url) => {
    // Streamlit's redirect handshake requires the cookie jar provided by Playwright.
    if (url.includes('.streamlit.app/')) {
      const ctx = await browser.newContext()
      try { const r = await ctx.request.get(url, { timeout: 20000 }); return { url, status: r.status(), finalUrl: r.url() } }
      catch (e) { return { url, error: String(e) } }
      finally { await ctx.close() }
    }
    try { const r = await fetch(url, { redirect: 'follow', signal: AbortSignal.timeout(20000) }); return { url, status: r.status, finalUrl: r.url } }
    catch (e) { return { url, error: String(e) } }
  }))
  await page.close()

  // ---------------- mobile ----------------
  const m = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true })
  m.on('console', (x) => { if (x.type() === 'error') res.logs.push('mobile: ' + x.text()) })
  m.on('pageerror', (e) => res.logs.push('mobile pageerror: ' + e.message))
  await load(m)
  check('mobile social links are visible within viewport', await m.locator('.hero-socials').evaluate((el) => { const r=el.getBoundingClientRect(); return r.left>=0 && r.right<=innerWidth && r.top>=0 && getComputedStyle(el).visibility==='visible' }))
  await shot(m, '40_mobile_hero')
  const overflowX = await m.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  check('mobile: no horizontal overflow', overflowX <= 0, overflowX)
  await profileQa(m, check, (name) => shot(m, `mobile_${name}`))
  const mg = await m.evaluate(() => [...document.querySelectorAll('.wk-card')].map((c) => c.getBoundingClientRect().top + window.scrollY))
  const title = await m.evaluate(() => { const el = document.querySelector('.wk-gallery-title'); return el.getBoundingClientRect().top + window.scrollY })
  await scrollTo(m, title - 20, 2500); await shot(m, '41_mobile_works_top')
  for (let i = 0; i < mg.length; i++) { await scrollTo(m, mg[i] - 10, 1800); await shot(m, `4${i + 2}_mobile_works_card_${i + 1}`) }
  // Every detail remains readable and actionable by touch.
  for (let i = 0; i < slugs.length; i++) {
    await m.locator('.wk-card').nth(i).locator('.wk-line-btn').tap()
    await m.waitForSelector('.wk-detail')
    await sleep(500)
    check(`mobile ${slugs[i]} safe external actions`, await m.locator('.wk-detail-actions a[target]').evaluateAll((links) => links.every((a) => a.target === '_blank' && a.rel.includes('noopener'))))
    check(`mobile ${slugs[i]} no detail overflow`, await m.locator('.wk-detail').evaluate((el) => el.scrollWidth <= el.clientWidth))
    if (i < 4) check(`mobile ${slugs[i]} full screenshot`, await m.locator('.wk-detail-banner img').evaluate((el) => el.naturalWidth > 0 && getComputedStyle(el).objectFit === 'contain'))
    await shot(m, `mobile_detail_${slugs[i]}`)
    await m.locator('.wk-detail-close').tap()
    await m.locator('.wk-detail').waitFor({ state: 'detached' })
  }
  // Retain the existing mobile smoke check.
  await m.locator('.wk-card').nth(1).locator('.wk-line-btn').tap(); await sleep(1100)
  await shot(m, '47_mobile_detail_omniops')
  const mHref = await m.evaluate(() => [...document.querySelectorAll('a.wk-detail-link[target]')].find((a) => a.textContent.includes('GitHub'))?.getAttribute('href'))
  check('mobile detail link', mHref === EXPECTED.omniops, mHref)

  check('no console errors or failed asset requests', res.logs.length === 0 && res.failedRequests.length === 0, { logs: res.logs, failedRequests: res.failedRequests })
  res.passed = res.checks.every((c) => c.ok)
  fs.writeFileSync(path.join(OUT, 'result.json'), JSON.stringify(res, null, 2))
  console.log(JSON.stringify({ passed: res.passed, failed: res.checks.filter((c) => !c.ok), heroSizes: res.heroSizes, github: res.github, external: res.external, logs: res.logs, failedRequests: res.failedRequests }, null, 1))
  await browser.close()
  if (!res.passed) process.exitCode = 1
})().catch((e) => { console.error(e); process.exit(1) })
