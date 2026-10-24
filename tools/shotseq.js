// 時間を追って連続スクリーンショット
// 使い方: node tools/shotseq.js <outprefix> <query> <ms,ms,...> [width] [height] [touch]
'use strict';
const { chromium } = require('playwright');
(async () => {
  const [prefix, query, times, w = '960', h = '560', touch = ''] = process.argv.slice(2);
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: +w, height: +h }, deviceScaleFactor: 1, hasTouch: !!touch, isMobile: !!touch });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto('http://localhost:8765/index.html' + query);
  let last = 0;
  for (const t of times.split(',').map(Number)) {
    await page.waitForTimeout(t - last);
    last = t;
    await page.screenshot({ path: `${prefix}-${t}.png` });
  }
  if (errors.length) console.log('ERRORS:\n' + errors.join('\n'));
  await browser.close();
})();
