// 超高難易度エリアの確認：ステージクリア後に「極」の扉が出て入れるか、黄色い三角を取ると帰りの扉が出るか
// （各部屋がクリアできるかは verify.js の探索ソルバーで確認）
// 使い方: node tools/extreme-test.js
'use strict';
const { load, Runner } = require('./headless');
const G = load();
let fail = 0;
const ok = (c, msg) => {
  console.log((c ? '[OK] ' : '[NG] ') + msg);
  if (!c) fail++;
};
const ENTRY = [
  [1, '4-B', { stage1Clear: true, kingDead: true, moonDead: true }],
  [2, '6-B', { stage2Clear: true, sunDead: true }],
  [3, '8-B', { treeDead: true, stage3Clear: true }],
  [4, '9-X', { stage4Clear: true, saveBossDead: true }],
  [5, '10-T', { stage5Clear: true }],
  [6, '11-1', { trueMoonDead: true }],
];
for (const [n, room, flags] of ENTRY) {
  // クリア前は扉がない
  const r0 = new Runner(G, room, { spawn: { x: 46, y: 226, face: 1 }, flags: {}, respawn: true });
  const none = !r0.W.ents.some((e) => e.to === 'EX' + n + '-1');
  // クリア後は扉がある。扉の前に立つと極エリアへ
  const r = new Runner(G, room, { spawn: { x: 46, y: 226, face: 1 }, flags: Object.assign({}, flags), respawn: true });
  const door = r.W.ents.find((e) => e.to === 'EX' + n + '-1');
  if (door) {
    const P = r.W.player;
    P.x = door.x + 30;
    P.y = door.y + door.h - P.h;
    for (let i = 0; i < 120 && !r.exited; i++) r.step({ left: true });
  }
  ok(none && door && r.exited === 'warp:EX' + n + '-1', `${room}: クリア後に「極」の扉 → EX${n}-1 (${r.exited})`);
  // 2画面目：黄色い三角を取ると帰りの扉
  const id = 'EX' + n + '-2';
  const r2 = new Runner(G, id, { spawn: { x: 40, y: 40, face: 1 }, flags: {}, respawn: true });
  r2.W.god = true;
  const tri = r2.W.ents.find((e) => e instanceof G.Triangle);
  const P2 = r2.W.player;
  P2.x = tri.cx - 4;
  P2.y = tri.cy - 7;
  for (let i = 0; i < 80; i++) r2.step({});
  const back = r2.W.ents.find((e) => e.to && e.to === (n === 6 ? '11-1' : room));
  ok(r2.game.flags['tri' + n] && back && G.ROOMS[back.to], `${id}: 黄色い三角を取ると帰りの扉（→ ${back && back.to}）`);
}
if (fail) {
  console.log(`${fail} 件失敗`);
  process.exit(1);
}
console.log('超高難易度エリア：すべてOK');
