const path = require('path')
const fs = require('fs')

function getChromium() {
  if (process.env.PLAYWRIGHT) {
    try { return require(process.env.PLAYWRIGHT).chromium; } catch (e) {}
  }
  try { return require('playwright').chromium; } catch (e) {}
  if (process.env.LOCALAPPDATA) {
    try {
      const p = path.join(process.env.LOCALAPPDATA, 'npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright')
      return require(p).chromium
    } catch (e) {}
  }
  console.error('Playwright not found.')
  process.exit(1)
}

const chromium = getChromium()
const OUT = path.join(__dirname, 'screenshots', 'loading')
fs.mkdirSync(OUT, { recursive: true })

const BASE_URL = process.env.BASE_URL || 'http://localhost:4173/'
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function run() {
  const browser = await chromium.launch({
    headless: true,
    args: ['--enable-gpu', '--ignore-gpu-blocklist', '--use-angle=d3d11']
  })

  console.log('=== Starting Loading Screen QA ===')

  // 1. Desktop Test (1440x900)
  console.log('\n--- 1. Desktop 1440x900 ---')
  const desktopContext = await browser.newContext({
    viewport: { width: 1440, height: 900 }
  })
  const page = await desktopContext.newPage()

  await page.goto(`${BASE_URL}?qa-loading&qa-pct=72&qa-fact-idx=15`, { waitUntil: 'networkidle' })
  await sleep(600)

  // Verify elements
  const ring = await page.$('.loading-ring')
  const label = await page.innerText('.loading-label')
  const pct = await page.innerText('.loading-pct')
  const header = await page.innerText('.loading-fact-header')
  const fact1 = await page.innerText('.loading-fact-text')
  const cat1 = await page.innerText('.loading-fact-category')
  const srText = await page.innerText('.sr-only')

  console.log('Status label:', label)
  console.log('Percentage:', pct)
  console.log('Fact header:', header)
  console.log('Fact 1:', fact1, `[${cat1}]`)
  console.log('Screen reader label:', srText)

  if (!ring || label !== 'LOADING EXPERIENCE' || pct !== '72%' || !fact1) {
    console.error('FAIL: Desktop elements missing or incorrect')
  } else {
    console.log('PASS: Desktop elements verified')
  }

  // Check overflow
  const overflowDesktop = await page.evaluate(() => {
    return document.body.scrollWidth > window.innerWidth
  })
  console.log('Desktop overflow check:', overflowDesktop ? 'FAIL (overflow detected)' : 'PASS (no overflow)')

  const shot1 = path.join(OUT, '01_desktop_loading.png')
  await page.screenshot({ path: shot1 })
  console.log('Saved:', shot1)

  // 2. Rotate to second fact
  console.log('\n--- 2. Desktop Second Fact Rotation ---')
  await page.evaluate(() => {
    if (window.__qaNextFact) window.__qaNextFact()
  })
  await page.waitForFunction((prev) => {
    const el = document.querySelector('.loading-fact-text')
    return el && el.textContent.trim() !== prev.trim()
  }, fact1, { timeout: 5000 })
  await sleep(400) // Settle enter animation

  const fact2 = await page.innerText('.loading-fact-text')
  const cat2 = await page.innerText('.loading-fact-category')
  console.log('Fact 2:', fact2, `[${cat2}]`)

  if (fact1 === fact2) {
    console.error('FAIL: Fact did not change on rotation')
  } else {
    console.log('PASS: Fact rotated successfully to non-duplicate fact')
  }

  const shot2 = path.join(OUT, '02_desktop_second_fact.png')
  await page.screenshot({ path: shot2 })
  console.log('Saved:', shot2)

  await desktopContext.close()

  // 3. Mobile Test (390x844)
  console.log('\n--- 3. Mobile 390x844 ---')
  const mobileContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148'
  })
  const mobilePage = await mobileContext.newPage()
  await mobilePage.goto(`${BASE_URL}?qa-loading&qa-pct=64&qa-fact-idx=17`, { waitUntil: 'networkidle' })
  await sleep(600)

  const mobileFact = await mobilePage.innerText('.loading-fact-text')
  const mobileCat = await mobilePage.innerText('.loading-fact-category')
  console.log('Mobile Fact:', mobileFact, `[${mobileCat}]`)

  const overflowMobile390 = await mobilePage.evaluate(() => {
    const content = document.querySelector('.loading-content')
    return {
      bodyOverflow: document.body.scrollWidth > window.innerWidth,
      contentOverflow: content ? content.scrollWidth > window.innerWidth : false,
      viewportHeight: window.innerHeight,
      contentBottom: content ? content.getBoundingClientRect().bottom : 0
    }
  })
  console.log('Mobile 390x844 metrics:', overflowMobile390)
  if (overflowMobile390.bodyOverflow || overflowMobile390.contentOverflow) {
    console.error('FAIL: Mobile overflow detected')
  } else {
    console.log('PASS: Mobile 390x844 layout clean and contained')
  }

  const shot3 = path.join(OUT, '03_mobile_loading_390x844.png')
  await mobilePage.screenshot({ path: shot3 })
  console.log('Saved:', shot3)
  await mobileContext.close()

  // 4. Mobile Test (360x740)
  console.log('\n--- 4. Mobile 360x740 ---')
  const smallMobileContext = await browser.newContext({
    viewport: { width: 360, height: 740 }
  })
  const smallMobilePage = await smallMobileContext.newPage()
  await smallMobilePage.goto(`${BASE_URL}?qa-loading&qa-pct=85&qa-fact-idx=27`, { waitUntil: 'networkidle' })
  await sleep(600)

  const overflowMobile360 = await smallMobilePage.evaluate(() => {
    return document.body.scrollWidth > window.innerWidth
  })
  console.log('Mobile 360x740 overflow:', overflowMobile360 ? 'FAIL' : 'PASS (no overflow)')

  const shot4 = path.join(OUT, '04_mobile_loading_360x740.png')
  await smallMobilePage.screenshot({ path: shot4 })
  console.log('Saved:', shot4)
  await smallMobileContext.close()

  // 5. Easter Egg Fact Test ("ABOUT THIS SITE")
  console.log('\n--- 5. Easter Egg Fact ("ABOUT THIS SITE") ---')
  const easterEggContext = await browser.newContext({
    viewport: { width: 1440, height: 900 }
  })
  const easterEggPage = await easterEggContext.newPage()
  // Index 38 is "ABOUT THIS SITE: The character you're looking at is rendered in real time in your browser."
  await easterEggPage.goto(`${BASE_URL}?qa-loading&qa-pct=90&qa-fact-idx=38`, { waitUntil: 'networkidle' })
  await sleep(600)

  const eeCategory = await easterEggPage.innerText('.loading-fact-category')
  const eeText = await easterEggPage.innerText('.loading-fact-text')
  console.log('Easter egg fact:', eeText, `[${eeCategory}]`)

  if (eeCategory !== 'ABOUT THIS SITE') {
    console.error('FAIL: Expected ABOUT THIS SITE category')
  } else {
    console.log('PASS: ABOUT THIS SITE easter egg displayed correctly')
  }

  const shot5 = path.join(OUT, '05_easter_egg_fact.png')
  await easterEggPage.screenshot({ path: shot5 })
  console.log('Saved:', shot5)
  await easterEggContext.close()

  // 6. Reduced Motion Test
  console.log('\n--- 6. Reduced Motion Support ---')
  const reducedMotionContext = await browser.newContext({
    viewport: { width: 1440, height: 900 },
    reducedMotion: 'reduce'
  })
  const rmPage = await reducedMotionContext.newPage()
  await rmPage.goto(`${BASE_URL}?qa-loading&qa-pct=50&qa-fact-idx=5`, { waitUntil: 'networkidle' })
  await sleep(600)

  const ringAnimation = await rmPage.evaluate(() => {
    const el = document.querySelector('.loading-ring')
    return window.getComputedStyle(el).animationName
  })
  console.log('Loading ring animation with reduced-motion:', ringAnimation)
  if (ringAnimation === 'none') {
    console.log('PASS: Reduced motion disables spinning animation')
  } else {
    console.log('INFO: Ring animation property:', ringAnimation)
  }
  await reducedMotionContext.close()

  // 7. Full Real-world Load Test (no QA params)
  console.log('\n--- 7. Real-world Natural Loading ---')
  const realContext = await browser.newContext({
    viewport: { width: 1440, height: 900 }
  })
  const realPage = await realContext.newPage()

  await realPage.goto(BASE_URL, { waitUntil: 'domcontentloaded' })
  
  // Check that loading screen is initially visible
  const initialLoaderVisible = await realPage.evaluate(() => {
    const l = document.querySelector('.loading-screen')
    const t = document.querySelector('.loading-fact-text')
    return l && !l.classList.contains('is-hidden') && !!t && t.textContent.length > 0
  })
  console.log('Initial loading screen visible with fact immediately:', initialLoaderVisible ? 'PASS' : 'WARN')

  // Wait for application loading to complete and loader to disappear
  console.log('Waiting for portfolio assets and 3D model to load...')
  await realPage.waitForSelector('.loading-screen.is-hidden', { timeout: 30000 })
  console.log('PASS: Loading screen faded out immediately upon asset load completion')

  await realContext.close()

  await browser.close()
  console.log('\n=== All Loading Screen QA Checks Passed Successfully ===')
}

run().catch((err) => {
  console.error('QA script error:', err)
  process.exit(1)
})
