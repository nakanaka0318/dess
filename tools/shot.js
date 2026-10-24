// Playwright でスクリーンショットを撮る
// 使い方: node tools/shot.js <out.png> [query] [width] [height] [waitMs] [touch]
'use strict';
const { chromium } = require('playwright');
(async () => {
  const [out, query = '', w = '960', h = '560', wait = '800', touch = ''] = process.argv.slice(2);
  const browser = await chromium.launch();
  const ctx = await browser.newContext({
    viewport: { width: +w, height: +h },
    deviceScaleFactor: 2,
    hasTouch: !!touch,
    isMobile: !!touch,
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await page.goto('http://localhost:8765/index.html' + query);
  await page.waitForTimeout(+wait);
  await page.screenshot({ path: out });
  if (errors.length) console.log('ERRORS:\n' + errors.join('\n'));
  await browser.close();
})();
