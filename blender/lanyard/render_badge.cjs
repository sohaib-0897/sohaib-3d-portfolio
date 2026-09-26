// Renders badge.html → badge.png (600×900) for the career_badge texture.
// Uses Playwright from the local npx cache (same as blender/tools/face_browser_test.cjs).
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

;(async () => {
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 600, height: 900 }, deviceScaleFactor: 1 })
  await page.goto('file://' + path.join(__dirname, 'badge.html').replace(/\\/g, '/'))
  await page.evaluate(() => document.fonts.ready)
  await page.locator('#card').screenshot({ path: path.join(__dirname, 'badge.png') })
  await browser.close()
  console.log('wrote', path.join(__dirname, 'badge.png'))
})().catch((e) => { console.error(e); process.exit(1) })
