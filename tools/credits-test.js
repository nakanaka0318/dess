// 3-4（偽エンディング）の検証：エンドロールの行を乗り継ぐ自動操縦で出口まで行けるか
'use strict';
const { load, Runner, spawnAt } = require('./headless');
const G = load();
const r = new Runner(G, '3-4', { spawn: spawnAt(G, '3-4', 'S') });
const W = r.W;
let t = 0;
for (; t < 60 * 40; t++) {
  const P = W.player;
  const lines = W.ents.filter((e) => e.alive && e.style === 'credit').sort((a, b) => a.y - b.y);
  const spikes = W.ents.filter((e) => e.alive && e instanceof G.Spike);
  const on = lines.find((l) => P.isRiding(l));
  let tx = 240;
  if (on) {
    const below = lines.filter((l) => l.y > on.y + 10).sort((a, b) => a.y - b.y)[0];
    const last = on.uiLabel.includes('ウソ');
    if (last && on.y <= 81) tx = 470;
    else if (on.y < 140 && below) {
      // 下の行の安全な場所へ降りる
      const safe = [];
      for (let x = below.x + 6; x < below.x + below.w - 6; x += 4) {
        const offCur = x < on.x - 6 || x > on.x + on.w + 6;
        if (offCur && !spikes.some((s) => Math.abs(s.cx - x) < 18 && Math.abs(s.y + 20 - below.y) < 4)) safe.push(x);
      }
      tx = safe.reduce((a, b) => (Math.abs(b - P.cx) < Math.abs(a - P.cx) ? b : a), safe[0]);
    } else {
      // 乗っている行の中で、トゲから離れた所に立つ
      const sp = spikes.filter((s) => Math.abs(s.y + 20 - on.y) < 4);
      let best = P.cx,
        bd = -1;
      for (let x = on.x + 6; x < on.x + on.w - 6; x += 4) {
        const d = sp.length ? Math.min(...sp.map((s) => Math.abs(s.cx - x))) : 999;
        const score = Math.min(d, 60) - Math.abs(x - P.cx) * 0.01;
        if (score > bd) {
          bd = score;
          best = x;
        }
      }
      tx = best;
    }
  } else if (P.onGround && P.y > 200) {
    // 「THE END」の文字が落ちてくるまではその下から離れて待つ
    const theEnd = W.ents.some((e) => e.alive && e instanceof G.BigText && e.text === 'THE END');
    tx = theEnd || W.time < 30 ? 340 : 290;
  }
  else if (P.onGround && P.y < 100) tx = 500;
  else tx = P.cx;
  const dx = tx - P.cx;
  r.step({ left: dx < -2, right: dx > 2 });
  if (r.deaths.length || r.exited) break;
}
console.log('3-4 credits:', r.exited ? `出口(${r.exited}) ${(t / 60).toFixed(1)}秒` : 'NG', JSON.stringify(r.deaths));
process.exit(r.exited === 'right' ? 0 : 1);
