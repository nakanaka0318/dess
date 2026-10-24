// ボス戦の検証：無敵の自動操縦ボットで最後まで倒し切れるか（進行不能にならないか）を確かめる
// 使い方: node tools/bosstest.js [2-B|4-B] [--hazard]  （--hazard で無敵なし＝被弾回数を数える）
'use strict';
const { load, Runner, spawnAt } = require('./headless');
const G = load();
G.autoShot = true;
const args = process.argv.slice(2);
const hazard = args.includes('--hazard');
const rooms = args.filter((a) => !a.startsWith('--'));
const targets = rooms.length ? rooms : ['2-B', '4-B', '5-B', '6-B'];
const ENTRY = { '2-B': 'right', '5-B': 'left', '6-B': 'left' }; // 隣の部屋から入ってくる向き

function run(id, seed) {
  G.god = !hazard;
  const flags = {};
  const r = new Runner(G, id, { spawn: ENTRY[id] ? { x: 30, y: 226, face: 1 } : spawnAt(G, id, 'S'), flags, respawn: false });
  if (ENTRY[id] === 'right') {
    // 右隣の部屋から入ってくる想定
    r.W.player.x = 440;
    r.W.player.y = 240 - 14;
  }
  let cleared = false;
  r.game.stageClear = () => (cleared = true);
  r.W.onBossCleared = ((f) => () => {
    cleared = true;
    if (f) f();
  })(r.W.onBossCleared);
  let hits = 0;
  const W = r.W;
  const origKill = W.kill.bind(W);
  W.kill = (c) => {
    hits++;
    hitLog[c] = (hitLog[c] || 0) + 1;
  };
  const hitLog = {};
  let jumpHold = 0,
    t = 0;
  const MAX = 60 * 60 * 6;
  for (; t < MAX; t++) {
    const P = W.player,
      b = W.boss;
    const inp = {};
    if (b && !b.defeated) {
      let tx, platform;
      if (id === '5-B' || id === '6-B') {
        // 距離を取って撃つ。床が危ない時（マグマ・地面を転がる太陽）は足場へ
        const lava = W.ents.some((e) => e.alive && e instanceof G.Lava);
        const low = b instanceof G.SunBoss && b.y + b.h > 200;
        if (b instanceof G.SunBoss && !lava && !low) {
          // 太陽に近い方の足場の上から撃つ
          platform = b.cx < 240 ? 100 : 380;
          tx = platform;
        } else if (lava || low) {
          platform = P.cx < 240 ? 100 : 380;
          tx = platform;
        } else {
          const side = P.cx < b.cx ? -1 : 1;
          tx = G.clamp(b.cx + side * 120, 30, 450);
          if (b.cx < 90 && side < 0) tx = 200;
          if (b.cx > 390 && side > 0) tx = 280;
        }
      } else if (id === '2-B') {
        // キングと同じ高さで距離を取りつつ撃つ
        const side = P.cx < b.cx ? -1 : 1;
        tx = G.clamp(b.cx + side * 110, 30, 450);
        if (Math.abs(b.cx - 240) < 60 && Math.abs(P.cx - b.cx) < 60) tx = P.cx < 240 ? 40 : 440;
      } else {
        // 月の真下に近い足場へ
        platform = b.cx < 240 ? 100 : 380;
        tx = b.y + b.h > 200 ? G.clamp(b.cx + (P.cx < b.cx ? -110 : 110), 30, 450) : platform;
      }
      if (!b.vulnerable && !b.showBar) tx = ENTRY[id] ? 200 : P.cx;
      const dx = tx - P.cx;
      if (Math.abs(dx) > 6) {
        inp.right = dx > 0;
        inp.left = dx < 0;
      } else if (t % 20 === 0) {
        // ボスの方を向く
        inp.right = b.cx > P.cx;
        inp.left = b.cx < P.cx;
      }
      const wantUp = platform && (id !== '4-B' || b.y + b.h <= 200) && P.y > 160 && Math.abs(dx) < 40;
      if (jumpHold > 0) {
        inp.jump = true;
        jumpHold--;
      } else if (wantUp && (P.onGround || (P.djump && P.vy > -0.5))) {
        jumpHold = 16;
        inp.jump = true;
      } else if (id === '4-B' && P.onGround && P.y < 170 && t % 50 === 0) {
        jumpHold = 8;
        inp.jump = true;
      }
    }
    r.step(inp);
    if (W.boss && W.boss.defeated) break;
  }
  // 撃破後の演出が終わって先へ進めるか（中ボスは出口が開く、ボスはステージクリア）
  const defeated = !!(W.boss && W.boss.defeated);
  if (defeated) for (let k = 0; k < 1200 && !cleared; k++) r.step({ right: k % 120 < 60, left: k % 120 >= 60 });
  return { t, defeated, cleared, hp: W.boss && W.boss.hp, hits, hitLog };
}

for (const id of targets) {
  const res = run(id);
  console.log(`${id}: ${res.defeated ? '撃破' : '未撃破'} ${(res.t / 60).toFixed(1)}秒  残HP=${res.hp}  被弾=${res.hits}  ${res.cleared ? '先へ進める' : '先へ進めない'}`);
  if (!res.defeated || !res.cleared) process.exitCode = 1;
  if (hazard) console.log('  ', JSON.stringify(res.hitLog));
}
