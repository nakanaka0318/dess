// ブラウザでの通し確認：タイトル→はじめから→死亡→リトライ→つづきから
'use strict';
const { chromium } = require('playwright');
const out = process.argv[2] || '.';
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 960, height: 560 } });
  const errors = [];
  page.on('pageerror', (e) => errors.push(String(e)));
  page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  await page.goto('http://localhost:8765/index.html');
  await page.waitForTimeout(800);
  const st = () => page.evaluate(() => ({ state: __game.state, room: __game.world && __game.world.id, deaths: __game.deaths, x: __game.world && __game.world.player.x }));
  // はじめから → ふつう
  await page.keyboard.press('Enter');
  await page.waitForTimeout(200);
  await page.keyboard.press('Enter');
  await page.waitForTimeout(400);
  console.log('after start', await st());
  // 右へ走って最初のリンゴに当たる
  await page.keyboard.down('ArrowRight');
  for (let i = 0; i < 40; i++) {
    await page.waitForTimeout(100);
    const s = await st();
    if (s.state === 'dead') break;
  }
  await page.keyboard.up('ArrowRight');
  await page.waitForTimeout(500);
  console.log('after run', await st());
  await page.screenshot({ path: out + '/e2e-dead.png' });
  // リトライ
  await page.keyboard.press('KeyZ');
  await page.waitForTimeout(300);
  console.log('after retry', await st());
  // ポーズ
  await page.keyboard.press('Escape');
  await page.waitForTimeout(300);
  await page.screenshot({ path: out + '/e2e-pause.png' });
  console.log('paused', await st());
  // タイトルへ戻って「つづきから」
  for (let i = 0; i < 6; i++) {
    await page.keyboard.press('ArrowDown');
    await page.waitForTimeout(60);
  }
  await page.keyboard.press('Enter');
  await page.waitForTimeout(400);
  console.log('to title', await st());
  const save = await page.evaluate(() => localStorage.getItem('iwktm_save_v1'));
  console.log('save', save);
  await page.keyboard.press('Enter'); // つづきから が選択されているはず
  await page.waitForTimeout(400);
  console.log('continue', await st());
  // エンディング表示
  await page.evaluate(() => __game.finish());
  await page.waitForTimeout(5500);
  await page.screenshot({ path: out + '/e2e-ending.png' });
  console.log('ending', await st());
  if (errors.length) console.log('ERRORS:\n' + errors.join('\n'));
  await browser.close();
})();
