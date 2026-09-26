// Renders stickers.html to stickers_atlas.png (transparent, 2048x2048) + stickers_atlas.json (pixel boxes per sticker).
// Usage: node render_atlas.cjs   (needs Playwright; path below is the local npx cache copy)
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
;(async () => {
  const browser = await chromium.launch()
  const page = await browser.newPage({ viewport: { width: 2048, height: 2048 }, deviceScaleFactor: 1 })
  await page.goto('file:///' + path.join(__dirname, 'stickers.html').replace(/\\/g, '/'))
  await page.waitForFunction(() => window.__boxes && Object.keys(window.__boxes).length > 0)
  await page.evaluate(() => document.fonts.ready)
  const boxes = await page.evaluate(() => window.__boxes)
  await page.locator('#atlas').screenshot({ path: path.join(__dirname, 'stickers_atlas.png'), omitBackground: true })
  fs.writeFileSync(path.join(__dirname, 'stickers_atlas.json'), JSON.stringify({ size: 2048, boxes }, null, 2))
  console.log(Object.keys(boxes).length, 'stickers')
  await browser.close()
})()
