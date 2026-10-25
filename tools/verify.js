// 全部屋のクリア可能性を並列で検証する
// 使い方: node tools/verify.js [roomId ...]
'use strict';
const { spawn } = require('child_process');
const path = require('path');
const os = require('os');

// 本編の順路。各部屋について「前の部屋から入ってきた位置」と「セーブ地点」から、次の部屋への出口に到達できるか調べる
const ROUTES = [
  ['1-1', '1-2', '1-3', '1-4', '2-1', '2-2', '2-3', '2-4', '2-B', '3-1', '3-2', '3-3', '3-4', '4-1', '4-2', '4-3', '4-B'],
  ['5-1', '5-2', '5-3', '5-B', '6-1', '6-2', '6-3', '6-B'],
  ['7-1', '7-2', '7-3', '7-B', '8-1', '8-2', '8-3', '8-B'],
];
const EXTRA_FROM = { '5-1': ['left'], '7-1': ['left'] };
const EXTRA = { '4-2': ['--shoot', 'action'], '5-1': ['--shoot', 'action'], '8-1': ['--shoot', 'action'] };
// ボス部屋は bosstest.js、3-4 は credits-test.js で検証
const SKIP = { '2-B': true, '4-B': true, '3-4': true, '5-B': true, '6-B': true, '7-B': true, '8-B': true };

// 4面：分かれ道の部屋はそれぞれの出口へ（謎解き部屋は stage4-test.js で検証）
const CUSTOM = [
  ['9-1', 'left', 'right'], ['9-1', 'S', 'right'],
  ['9-H', 'left', 'right'], ['9-H', 'left', 'up'], ['9-H', 'left', 'down'], ['9-H', 'S', 'up'],
  ['9-A3', 'S', 'right'],
  // 5面：塔の各画面を入口（E）から上へ（画面のつなぎ目は tower-test.js で検証）
  ['10-1', '@', 'up'], ['10-2', 'E', 'up'], ['10-3', 'E', 'up'], ['10-4', 'E', 'up'], ['10-5', 'E', 'up', ['--max', '80000']],
  ['10-6', 'E', 'up'], ['10-7', 'E', 'up'], ['10-8', 'E', 'up'],
  // 6面（12-1 のエレベーターは human.js、推理の間は stage6-test.js と bosstest.js で検証）
  ['11-1', 'S', 'right', ['--shoot', 'action']], ['11-2', 'S', 'right', ['--max', '12000']], ['11-3', 'S', 'right'], ['11-4', 'S', 'right'],
  ['12-2', 'S', 'right', ['--shoot', 'action']], ['12-3', 'S', 'right'],
];
function buildCases(G) {
  const cases = CUSTOM.filter((c) => G.ROOMS[c[0]]).slice();
  for (const ROUTE of ROUTES) ROUTE.forEach((id, i) => {
    if (SKIP[id]) return;
    const def = G.ROOMS[id];
    if (!def) return;
    const next = ROUTE[i + 1];
    const goal = Object.keys(def.exits).find((d) => def.exits[d] === next) || def.goal;
    const prev = ROUTE[i - 1];
    const from = prev ? Object.keys(def.exits).find((d) => def.exits[d] === prev) : '@';
    cases.push([id, from, goal, EXTRA[id]]);
    // 前のステージのボス部屋から歩いて入ってくる場合
    if (EXTRA_FROM[id]) for (const f of EXTRA_FROM[id]) cases.push([id, f, goal, EXTRA[id]]);
    if (def.map.some((r) => r.includes('S'))) cases.push([id, 'S', goal, EXTRA[id]]);
    if (def.map.some((r) => r.includes('s'))) cases.push([id, 's', goal, (EXTRA[id] || []).concat(['--easy'])]);
  });
  return cases;
}

const only = process.argv.slice(2);
const G = require('./headless').load();
const todo = buildCases(G).filter((c) => !only.length || only.includes(c[0]));
const N = Math.max(1, os.cpus().length);
let running = 0,
  idx = 0,
  fails = 0;
const results = [];
function next() {
  while (running < N && idx < todo.length) {
    const c = todo[idx++];
    running++;
    const args = [path.join(__dirname, 'solve.js'), c[0], '--from', c[1], '--goal', c[2], '--quiet', '--max', '40000'].concat(c[3] || []);
    const p = spawn(process.execPath, args);
    let out = '';
    p.stdout.on('data', (d) => (out += d));
    p.stderr.on('data', (d) => (out += d));
    p.on('close', (code) => {
      running--;
      if (code !== 0) fails++;
      results.push(out.trim());
      console.log(out.trim());
      if (idx >= todo.length && running === 0) {
        console.log(fails ? `\n${fails} 件失敗` : `\n全 ${todo.length} 件クリア可能`);
        process.exit(fails ? 1 : 0);
      }
      next();
    });
  }
}
next();
