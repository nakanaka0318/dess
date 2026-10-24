// 全部屋の読み込み・出入口の整合性チェック
'use strict';
const { load, Runner } = require('./headless');
const G = load();

let ok = true;
const ids = Object.keys(G.ROOMS);
for (const id of ids) {
  const def = G.ROOMS[id];
  try {
    const r = new Runner(G, id, {});
    for (let i = 0; i < 30; i++) r.step({});
  } catch (e) {
    ok = false;
    console.log(`[NG] ${id}: ${e.stack}`);
    continue;
  }
  // 出口の相互リンク
  const opp = { left: 'right', right: 'left', up: 'down', down: 'up' };
  for (const [dir, to] of Object.entries(def.exits || {})) {
    const td = G.ROOMS[to];
    if (!td) {
      ok = false;
      console.log(`[NG] ${id}: exit ${dir} -> ${to} が存在しない`);
      continue;
    }
    if (!td.oneWayIn && (td.exits || {})[opp[dir]] !== id) console.log(`[warn] ${id} -${dir}-> ${to} だが ${to} の ${opp[dir]} は ${(td.exits || {})[opp[dir]]}`);
    // 境界の開口部が一致しているか
    const a = def.map,
      b = td.map;
    const open = (m, x, y) => !'#B'.includes(m[y][x]);
    let mism = [];
    if (dir === 'right' || dir === 'left') {
      const xa = dir === 'right' ? 23 : 0,
        xb = dir === 'right' ? 0 : 23;
      for (let y = 0; y < 14; y++) if (open(a, xa, y) && !open(b, xb, y)) mism.push(y);
    } else {
      const ya = dir === 'up' ? 0 : 13,
        yb = dir === 'up' ? 13 : 0;
      for (let x = 0; x < 24; x++) if (open(a, x, ya) && !open(b, x, yb)) mism.push(x);
    }
    if (mism.length) console.log(`[info] ${id} -${dir}-> ${to}: 先が塞がっている位置 ${mism.join(',')}`);
  }
  // セーブポイントの下が地面か
  def.map.forEach((row, ty) => {
    [...row].forEach((ch, tx) => {
      if ((ch === 'S' || ch === 's') && !(ty + 1 < 14 && '#B-'.includes(def.map[ty + 1][tx])))
        console.log(`[warn] ${id}: セーブ(${tx},${ty})の下が地面ではない`);
    });
  });
}
console.log(ok ? `OK: ${ids.length} rooms` : 'NG');
process.exit(ok ? 0 : 1);
