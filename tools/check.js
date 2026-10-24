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
    // 出られる位置（トゲの上は出る前に死ぬので除く）
    const passable = (m, x, y) => !'#B^v<>'.includes(m[y][x]);
    let mism = [];
    if (dir === 'right' || dir === 'left') {
      const xa = dir === 'right' ? 23 : 0,
        xb = dir === 'right' ? 0 : 23;
      for (let y = 0; y < 14; y++) if (passable(a, xa, y) && !open(b, xb, y)) mism.push(y);
    } else {
      const ya = dir === 'up' ? 0 : 13,
        yb = dir === 'up' ? 13 : 0;
      for (let x = 0; x < 24; x++) if (passable(a, x, ya) && !open(b, x, yb)) mism.push(x);
    }
    // ボス撃破後に開く壁など、setup で開口部が変わる部屋は def.edgeOk で除外
    if (mism.length && !(def.edgeOk || []).includes(dir)) {
      ok = false;
      console.log(`[NG] ${id} -${dir}-> ${to}: 移動先が壁で埋まる位置 ${mism.join(',')}`);
    }
  }
  // セーブポイントの下が地面か
  def.map.forEach((row, ty) => {
    [...row].forEach((ch, tx) => {
      if ((ch === 'S' || ch === 's') && !(ty + 1 < 14 && '#B-'.includes(def.map[ty + 1][tx])))
        console.log(`[warn] ${id}: セーブ(${tx},${ty})の下が地面ではない`);
    });
  });
}
// 画面移動のシミュレーション：どこから入っても壁や床に埋まらないか（unstick も含めて確認）
{
  let bad = 0,
    pushed = 0;
  const PW = G.PHYS.PW,
    PH = G.PHYS.PH;
  for (const id of ids) {
    for (const [dir, to] of Object.entries(G.ROOMS[id].exits || {})) {
      if (!G.ROOMS[to]) continue;
      const pos = [];
      if (dir === 'right') for (let y = -6; y <= G.H - PH; y += 2) pos.push([-PW / 2, y]);
      if (dir === 'left') for (let y = -6; y <= G.H - PH; y += 2) pos.push([G.W - PW / 2, y]);
      if (dir === 'up') for (let x = -2; x <= G.W - PW + 2; x += 2) for (const y of [G.H - 8 - PH / 2, G.H - 14]) pos.push([x, y]);
      if (dir === 'down') for (let x = -2; x <= G.W - PW + 2; x += 2) for (const y of [0, 4]) pos.push([x, y]);
      let src;
      try {
        src = new G.World({ diff: 'normal', flags: { kingDead: true, moonDead: true }, save() {}, onDeath() {} }, id, {});
      } catch (e) {
        continue;
      }
      // 出る前の部屋で実際に通れる位置だけを試す
      const reach = ([x, y]) => {
        const sx = dir === 'right' ? x + G.W : dir === 'left' ? x - G.W : x;
        const sy = dir === 'up' ? 0 : dir === 'down' ? G.H - PH : y;
        const r = { x: sx, y: sy, w: PW, h: PH };
        return !src.solidAt(sx, sy, PW, PH) && !src.tileHazard(r);
      };
      for (const [x, y] of pos.filter(reach)) {
        const enter = { x, y, vy: dir === 'up' ? -5 : 2, djump: true, face: 1, dir, from: id };
        let W;
        try {
          W = new G.World({ diff: 'normal', flags: { kingDead: true, moonDead: true }, save() {}, onDeath() {} }, to, { enter });
        } catch (e) {
          continue;
        }
        const P = W.player;
        if (P.x !== Math.round(x) || P.y !== Math.round(y)) pushed++;
        if (W.solidAt(P.x, P.y, P.w, P.h)) {
          bad++;
          if (bad < 10) console.log(`[NG] ${id} -${dir}-> ${to}: (${x},${y}) で埋まる`);
        }
      }
    }
  }
  if (bad) ok = false;
  console.log(`画面移動テスト: 埋まり ${bad} 件 / 押し出し補正 ${pushed} 件`);
}
console.log(ok ? `OK: ${ids.length} rooms` : 'NG');
process.exit(ok ? 0 : 1);
