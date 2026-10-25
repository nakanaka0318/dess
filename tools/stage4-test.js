// 4面の謎解き部屋の検証：答えを知っている人の手順を再生して、かけらを取って次へ進めるか
// 使い方: node tools/stage4-test.js [roomId ...]
'use strict';
const { run, G } = require('./human');

const ON_PLAT = (W, P) => P.onGround && P.y < 200;
const S4 = {
  '9-1': {
    from: 'S',
    steps: [
      { go: 92 }, { jump: 'R', hold: 12 }, // 1つ目のクレーター
      { go: 178 }, { wait: 45 }, // 旗を倒させてから
      { go: 214 }, { go: 196 }, { wait: 30 }, // うさぎの餅を先に落とさせる
      { go: 276 }, { jump: 0, hold: 4 }, { wait: 40 }, // その場で跳んで隕石を先に落とさせる
      { go: 274 }, { jump: 'R', hold: 14 }, { go: 500 },
    ],
  },
  '9-B1': {
    enter: { x: 20, y: 226 },
    flag: 'orderSolved',
    steps: [
      { go: 150 }, { jump: 0, hold: 16, dj: 16, djHold: 12 }, { wait: 30 }, // 低い足場へ
      { go: 170 }, { jump: 'R', hold: 16, dj: 18, djHold: 14, steerFrames: 34 }, { wait: 30 }, // 高い足場へ
      { go: 266 }, { shoot: 24 }, // ☀（右の壁の高い所）
      { go: 300 }, { wait: 30 }, { go: 330 }, { shoot: 24 }, // 床に降りて ☾
      { go: 200 }, { jump: 'L', hold: 16, dj: 18, djHold: 14, steerFrames: 30 }, { wait: 30 }, // 低い足場へ戻る
      { go: 130 }, { shoot: 24 }, // ★（左の壁）
      { wait: 60 }, { go: 500 },
    ],
  },
  '9-B2': {
    enter: { x: 20, y: 226 },
    flag: 'piece1',
    goal: 'down',
    steps: [
      { go: 222 }, { jump: 'R', hold: 12 }, // 偽のかけらを跳び越える
      { go: 314 }, { jump: 'R', hold: 18 }, // 穴を越える
      { go: 455 }, { wait: 10 }, // 壁の中の本物
      { go: 350 }, // 下の穴へ
    ],
  },
  '9-C1': {
    enter: { x: 380, y: -2, vy: 2 },
    flag: 'piece2',
    goal: 'up',
    steps: [
      { go: 446 }, { jump: 0, hold: 8 }, { wait: 40 }, // 右端の小さなオーブで天井へ
      { go: 430 }, { jump: 'L', hold: 16 }, // 天井の穴を越える
      { go: 296 }, { jump: 'L', hold: 10 }, // 天井のトゲ
      { go: 214 }, { jump: 'L', hold: 14 }, // 天井のトゲ2本
      { go: 44 }, { wait: 10 }, // かけら
      { go: 146 }, { jump: 'R', hold: 14 }, { go: 244 }, { jump: 'R', hold: 10 },
      { go: 390 }, // 天井の穴から上の部屋へ
    ],
  },
  '9-C2': {
    enter: { x: 20, y: 226 },
    goal: 'up',
    steps: [
      { go: 330 }, { wait: 320 }, // 看板から離れて5秒待つ
      { go: 300 }, { jump: 0, hold: 16, dj: 16, djHold: 12 }, { wait: 30 }, // 足場1
      { go: 334 }, { jump: 0, hold: 16, dj: 16, djHold: 12 }, { wait: 30 }, // 足場2
      { go: 352 }, { jump: 0, hold: 16, dj: 16, djHold: 12 }, { wait: 30 }, // 足場3
      { go: 356 }, { jump: 0, hold: 16, dj: 18, djHold: 14 }, // 天井の穴へ
    ],
  },
  '9-A1': {
    enter: { x: 66, y: 262, vy: -5 },
    goal: 'warp:9-A2',
    steps: [
      { until: (W, P) => P.onGround, dir: 'R' },
      { go: 176 }, { jump: 'R', hold: 16 }, // 扉Aを跳び越える
      { go: 290 }, // 扉B
    ],
  },
  '9-A2': {
    from: 'S',
    flag: 'piece3',
    goal: 'warp:9-A1',
    steps: [{ go: 192 }, { jump: 'R', hold: 20 }, { go: 425 }],
  },
};

const only = process.argv.slice(2).filter((a) => !a.startsWith('--'));
let bad = 0;
for (const id of Object.keys(S4)) {
  if (only.length && !only.includes(id)) continue;
  const sc = S4[id];
  const flagsSeen = {};
  const runOne = (rng) => {
    const r = run(id, sc, rng, (W) => (sc.flag ? (flagsSeen.v = !!(W.game.flags[sc.flag])) : true));
    return r;
  };
  const base = runOne(null);
  const baseOk = base.ok && (!sc.flag || flagsSeen.v);
  const rng = new G.RNG(5);
  let ok = 0;
  const causes = {};
  const N = 20;
  for (let i = 0; i < N; i++) {
    flagsSeen.v = false;
    const r = runOne(rng);
    if (r.ok && (!sc.flag || flagsSeen.v)) ok++;
    else causes[r.death || r.exit || (r.ok ? 'フラグなし' : 'stuck@' + r.pos)] = (causes[r.death || r.exit || (r.ok ? 'フラグなし' : 'stuck@' + r.pos)] || 0) + 1;
  }
  if (!baseOk || ok < N * 0.6) bad++;
  console.log(`${id}: 基準手順 ${baseOk ? 'OK' : 'NG(' + (base.death || base.exit || 'stuck@' + base.pos) + ')'}  揺らし成功率 ${Math.round((ok / N) * 100)}%  ${Object.entries(causes).map(([k, v]) => k + '×' + v).join(' / ')}`);
}
process.exit(bad ? 1 : 0);
