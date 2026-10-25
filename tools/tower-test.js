// 5面（塔）の確認：各部屋のてっぺんから跳ぶと上の部屋の入口に乗れるか、着地で自動セーブされるか、頂上でクリアになるか
// 使い方: node tools/tower-test.js
'use strict';
const { load, Runner, spawnAt } = require('./headless');
const G = load();
const T = G.T;
let fail = 0;
const ok = (c, msg) => {
  console.log((c ? '[OK] ' : '[NG] ') + msg);
  if (!c) fail++;
};

// changeRoom と同じ入り方で次の部屋を作る
function enterNext(r, dir) {
  const W = r.W,
    P = W.player;
  const nid = W.exits[dir];
  const y = dir === 'up' ? P.y + G.H : P.y - G.H;
  const vy = dir === 'up' ? Math.min(P.vy, -5) : P.vy;
  const enter = { x: P.x, y, vy, djump: P.djump, face: P.face, xr: P.xr, yr: P.yr, jumpHeld: P.jumpHeld, from: W.id, dir };
  return new Runner(G, nid, { enter });
}

// 1) てっぺんから真上へ2段ジャンプ → 上の部屋の入口に着地
for (let k = 1; k <= 8; k++) {
  const id = '10-' + k;
  const r = new Runner(G, id, { spawn: spawnAt(G, id, 'T'), respawn: true });
  for (let i = 0; i < 10; i++) r.step({});
  let t = 0,
    dj = false;
  while (!r.exited && t < 200) {
    const P = r.W.player;
    let jump = t < 22;
    if (!dj && t > 22 && P.vy >= -0.5) dj = true;
    if (dj && t < 70) jump = jump || t > 22;
    r.step({ jump });
    t++;
  }
  if (r.exited !== 'up') {
    ok(false, `${id}: てっぺんから上へ抜けられない (${r.exited})`);
    continue;
  }
  const n = enterNext(r, 'up');
  const P = n.W.player;
  const top = k === 8;
  let landed = false;
  for (let i = 0; i < 200 && !n.exited; i++) {
    // 頂上は床の穴から跳び上がるので、床より上に出たら横へよける
    n.step({ right: top && (P.vy > 0 || P.y + P.h < 250) });
    if (P.onGround) {
      landed = true;
      break;
    }
  }
  ok(landed && !n.exited, `${id} → ${n.W.id}: 入口に着地 (y=${Math.round(P.y + P.h)}, x=${Math.round(P.cx)})`);
}

// 2) 着地すると自動セーブ（崩れる足場の上ではセーブしない）
{
  const r = new Runner(G, '10-2', { spawn: spawnAt(G, '10-2', 'E'), respawn: true });
  const saves = [];
  r.game.save = (room, tx, ty) => saves.push([room, tx, ty]);
  for (let i = 0; i < 5; i++) r.step({});
  const e = G.findMark('10-2', 'E');
  ok(saves.length === 1 && saves[0][1] === e.tx && saves[0][2] === e.ty, `10-2: 着地で自動セーブ ${JSON.stringify(saves)}`);
  // 崩れる足場（15,9）に乗る
  const r2 = new Runner(G, '10-2', { spawn: { x: 15 * T + 6, y: 8 * T + 6, face: 1 }, respawn: true });
  const s2 = [];
  r2.game.save = (room, tx, ty) => s2.push([room, tx, ty]);
  for (let i = 0; i < 5; i++) r2.step({});
  ok(s2.length === 0, '10-2: 崩れる足場の上ではセーブしない');
}

// 3) 上の部屋から落ちると、下の部屋に着地してそこがセーブ地点になる
{
  const r = new Runner(G, '10-3', { spawn: spawnAt(G, '10-3', 'E'), respawn: true });
  for (let i = 0; i < 5; i++) r.step({});
  let t = 0;
  while (!r.exited && t < 400) {
    r.step({ left: true });
    t++;
  }
  ok(r.exited === 'down', `10-3: 足場から落ちると下の部屋へ (${r.exited})`);
  let n = enterNext(r, 'down');
  const saves = [];
  for (let hop = 0; hop < 4 && n; hop++) {
    n.game.save = (room, tx, ty) => saves.push([room, tx, ty]);
    let i = 0;
    while (!n.exited && i < 300 && !saves.length) {
      n.step({});
      i++;
    }
    if (saves.length) break;
    n = n.exited === 'down' ? enterNext(n, 'down') : null;
  }
  ok(saves.length === 1, `落ちた先でセーブ ${JSON.stringify(saves)}`);
}

// 4) 頂上：木に近づくとクリア
{
  const r = new Runner(G, '10-T', { spawn: { x: 16 * T + 6, y: 12 * T + 6, face: 1 }, respawn: true });
  let cleared = false;
  r.game.stageClear = () => (cleared = true);
  for (let i = 0; i < 900 && !cleared && !r.deaths.length; i++) r.step({ right: r.W.player.cx < 350 });
  ok(cleared && !r.deaths.length && /リンゴ/.test(r.game.endingNote || ''), `10-T: クリア (${r.game.endingNote})`);
}

// 5) 近道の扉はふもとへ
{
  const r = new Runner(G, '10-7', { spawn: { x: 2 * T + 6, y: 8 * T + 6, face: 1 }, respawn: true });
  for (let i = 0; i < 120 && !r.exited; i++) r.step({ right: i > 20 });
  ok(r.exited === 'warp:10-1', `10-7: 近道の扉 → ${r.exited}`);
}

if (fail) {
  console.log(`${fail} 件失敗`);
  process.exit(1);
}
console.log('塔の確認：すべてOK');
