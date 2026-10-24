// 全部屋のクリア可能性を並列で検証する
// 使い方: node tools/verify.js [roomId ...]
'use strict';
const { spawn } = require('child_process');
const path = require('path');
const os = require('os');

// 本編の順路。各部屋について「前の部屋から入ってきた位置」と「セーブ地点」から、次の部屋への出口に到達できるか調べる
const ROUTE = ['1-1', '1-2', '1-3', '1-4', '2-1', '2-2', '2-3', '2-4', '2-B', '3-1', '3-2', '3-3', '3-4', '4-1', '4-2', '4-3', '4-B'];
const EXTRA = { '4-2': ['--shoot', 'action'] };
const SKIP = { '2-B': true, '4-B': true, '3-4': true }; // ボス部屋は bosstest.js、3-4 は credits-test.js で検証

function buildCases(G) {
  const cases = [];
  ROUTE.forEach((id, i) => {
    if (SKIP[id]) return;
    const def = G.ROOMS[id];
    if (!def) return;
    const next = ROUTE[i + 1];
    const goal = Object.keys(def.exits).find((d) => def.exits[d] === next) || def.goal;
    const prev = ROUTE[i - 1];
    const from = prev ? Object.keys(def.exits).find((d) => def.exits[d] === prev) : '@';
    cases.push([id, from, goal, EXTRA[id]]);
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
