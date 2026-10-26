// クリア可能性の検証：入力列を探索して部屋の出口（またはゴール条件）に到達できるか調べる
// 使い方: node tools/solve.js <roomId> [--from S|@|left|right|up|down] [--goal right|left|up|down|boss] [--god] [--k 6] [--max 20000]
'use strict';
const { load, Runner, spawnAt } = require('./headless');

function parseArgs(argv) {
  const o = { room: argv[0], from: 'S', goal: null, god: false, k: 6, max: 20000, shoot: 'never', diff: 'normal', w: 0.6 };
  for (let i = 1; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--from') o.from = argv[++i];
    else if (a === '--goal') o.goal = argv[++i];
    else if (a === '--god') o.god = true;
    else if (a === '--k') o.k = +argv[++i];
    else if (a === '--max') o.max = +argv[++i];
    else if (a === '--shoot') o.shoot = argv[++i];
    else if (a === '--easy') o.diff = 'easy';
    else if (a === '--w') o.w = +argv[++i];
    else if (a === '--quiet') o.quiet = true;
    else if (a === '--robust') o.robust = +argv[++i];
    else if (a === '--tbucket') o.tbucket = +argv[++i];
  }
  return o;
}

class Heap {
  constructor() {
    this.a = [];
  }
  push(n) {
    const a = this.a;
    a.push(n);
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (a[p].f <= a[i].f) break;
      [a[p], a[i]] = [a[i], a[p]];
      i = p;
    }
  }
  pop() {
    const a = this.a;
    const top = a[0],
      last = a.pop();
    if (a.length) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1,
          r = l + 1;
        let m = i;
        if (l < a.length && a[l].f < a[m].f) m = l;
        if (r < a.length && a[r].f < a[m].f) m = r;
        if (m === i) break;
        [a[m], a[i]] = [a[i], a[m]];
        i = m;
      }
    }
    return top;
  }
  get size() {
    return this.a.length;
  }
}

function makeStart(G, o) {
  const id = o.room;
  if (o.from.length === 1) return { spawn: spawnAt(G, id, o.from), respawn: o.from !== '@' };
  // 隣の部屋から入ってくる：境界上の開いている位置を探す
  const def = G.ROOMS[id];
  const T = G.T;
  const map = def.map;
  const open = (x, y) => !'#B^v<>'.includes(map[y][x]);
  if (o.from === 'left' || o.from === 'right') {
    const x = o.from === 'left' ? 0 : 23;
    for (let y = 12; y >= 0; y--)
      if (open(x, y) && y + 1 < 14 && !open(x, y + 1))
        return { enter: { x: o.from === 'left' ? 1 : G.W - 9, y: y * T + T - G.PHYS.PH, vy: 0, djump: true, face: o.from === 'left' ? 1 : -1 } };
  }
  if (o.from === 'down') {
    for (let x = 0; x < 24; x++) if (open(x, 13)) return { enter: { x: x * T + 6, y: G.H - 8, vy: -5, djump: false, face: 1 } };
  }
  if (o.from === 'up') {
    for (let x = 0; x < 24; x++) if (open(x, 0)) return { enter: { x: x * T + 6, y: -6, vy: 2, djump: true, face: 1 } };
  }
  throw new Error('cannot determine start for ' + o.from);
}

// ゴールまでの「足場グラフ」上の距離場（ヒューリスティック用）
function buildField(G, W, goal) {
  const C = G.COLS,
    RW = G.ROWS,
    T = G.T;
  const entSolid = (tx, ty) => W.ents.some((e) => e.alive && e.solid && !e.fake && e.x < (tx + 1) * T && e.x + e.w > tx * T && e.y < (ty + 1) * T && e.y + e.h > ty * T);
  const entPlat = (tx, ty) => W.ents.some((e) => e.alive && e.oneway && e.x < (tx + 1) * T && e.x + e.w > tx * T && e.y >= ty * T && e.y < (ty + 1) * T);
  const pass = (tx, ty) => {
    if (tx < 0 || tx >= C || ty < 0 || ty >= RW) return false;
    const c = W.tiles[ty * C + tx];
    return !(c === 1 || c === 2 || c >= 10) && !entSolid(tx, ty);
  };
  const support = (tx, ty) => {
    if (ty >= RW) return false;
    const c = W.tiles[ty * C + tx];
    return c === 1 || c === 2 || c === 3 || entSolid(tx, ty) || entPlat(tx, ty);
  };
  const N = C * RW;
  const stand = new Uint8Array(N);
  for (let ty = 0; ty < RW; ty++) for (let tx = 0; tx < C; tx++) if (pass(tx, ty) && support(tx, ty + 1)) stand[ty * C + tx] = 1;
  const dist = new Float64Array(N).fill(Infinity);
  const seed = [];
  for (let ty = 0; ty < RW; ty++)
    for (let tx = 0; tx < C; tx++) {
      if (!pass(tx, ty)) continue;
      if ((goal === 'right' && tx === C - 1) || (goal === 'left' && tx === 0) || (goal === 'up' && ty === 0) || (goal === 'down' && ty === RW - 1)) {
        dist[ty * C + tx] = 0;
        seed.push(ty * C + tx);
      }
    }
  const reach = (u, v, air) => {
    const ux = u % C,
      uy = (u / C) | 0,
      vx = v % C,
      vy = (v / C) | 0;
    const dx = Math.abs(vx - ux),
      dy = vy - uy;
    return dx <= (air ? 5 : 6) && dy >= (air ? -2 : -4);
  };
  const cost = (u, v) => {
    const dx = (v % C) - (u % C),
      dy = ((v / C) | 0) - ((u / C) | 0);
    return Math.sqrt(dx * dx + dy * dy) + (dy < 0 ? -dy * 0.5 : 0);
  };
  // 逆向きダイクストラ（ノード数が少ないので単純実装）
  const done = new Uint8Array(N);
  for (;;) {
    let v = -1,
      bd = Infinity;
    for (let i = 0; i < N; i++) if (!done[i] && dist[i] < bd && (stand[i] || dist[i] === 0)) {
      bd = dist[i];
      v = i;
    }
    if (v < 0) break;
    done[v] = 1;
    for (let u = 0; u < N; u++) {
      if (!stand[u] || done[u]) continue;
      if (!reach(u, v, false)) continue;
      const d = bd + cost(u, v);
      if (d < dist[u]) dist[u] = d;
    }
  }
  const field = new Float64Array(N).fill(1e6);
  for (let c = 0; c < N; c++) {
    if (stand[c] || dist[c] === 0) {
      field[c] = dist[c];
      continue;
    }
    if (!pass(c % C, (c / C) | 0)) continue;
    let best = Infinity;
    for (let u = 0; u < N; u++) {
      if (!stand[u] || dist[u] === Infinity) continue;
      if (!reach(c, u, true)) continue;
      const d = dist[u] + cost(c, u);
      if (d < best) best = d;
    }
    field[c] = best === Infinity ? 1e6 : best;
  }
  return (P) => {
    const tx = G.clamp(Math.floor(P.cx / T), 0, C - 1),
      ty = G.clamp(Math.floor((P.y + P.h - 1) / T), 0, RW - 1);
    return field[ty * C + tx] * T;
  };
}

function solve(G, o) {
  const def = G.ROOMS[o.room];
  const goal = o.goal || def.goal || Object.keys(def.exits || {}).find((d) => d === 'right') || Object.keys(def.exits || {})[0];
  const start = makeStart(G, o);
  G.god = !!o.god;
  const ACT = [];
  const shoots = o.shoot === 'action' ? [0, 1] : [o.shoot === 'always' ? 1 : 0];
  for (const dir of [-1, 0, 1]) for (const j of [0, 1]) for (const s of shoots) ACT.push({ dir, j, s });
  const K = o.k;
  let frames = 0;

  function sim(seq) {
    const r = new Runner(G, o.room, Object.assign({ diff: o.diff }, start));
    let res = { r, dead: false, done: false };
    for (let i = 0; i < seq.length; i++) {
      const a = ACT[seq[i]];
      for (let k = 0; k < K; k++) {
        r.step({ left: a.dir < 0, right: a.dir > 0, jump: !!a.j, shoot: !!a.s });
        frames++;
        if (r.deaths.length) {
          res.dead = true;
          res.cause = r.deaths[0].cause;
          return res;
        }
        if (r.exited) {
          res.done = r.exited === goal;
          res.exit = r.exited;
          if (!res.done) res.dead = true; // 別の出口はゴールではない
          return res;
        }
        if (goal === 'boss' && r.W.boss && r.W.boss.defeated) {
          res.done = true;
          return res;
        }
        if (goal === 'flag' && r.W.vars.goal) {
          res.done = true;
          return res;
        }
      }
    }
    return res;
  }
  let field = null;
  if (def.solverH) {
    field = null;
  } else if (def.solverGoalPos) {
    const [gx, gy] = def.solverGoalPos;
    field = (P) => Math.hypot(P.cx - gx, (P.cy - gy) * 1.5);
  } else if (['right', 'left', 'up', 'down'].includes(goal)) {
    const r0 = new Runner(G, o.room, Object.assign({ diff: o.diff }, start));
    field = buildField(G, r0.W, goal);
  }
  function h(W) {
    const P = W.player;
    if (def.solverH) return def.solverH(W);
    if (field) {
      const edge = goal === 'right' ? G.W - P.cx : goal === 'left' ? P.cx : goal === 'up' ? P.cy : G.H - P.cy;
      return field(P) + Math.min(edge, 20) * 0.2;
    }
    if (goal === 'right') return G.W - P.cx;
    if (goal === 'left') return P.cx;
    if (goal === 'up') return P.cy + Math.abs(P.cx - (def.goalX || P.cx)) * 0.3;
    if (goal === 'down') return G.H - P.cy;
    if (goal === 'boss') return W.boss ? W.boss.hp * 8 : 500;
    if (def.goalPos) return Math.hypot(P.cx - def.goalPos[0], P.cy - def.goalPos[1]);
    return 0;
  }
  function key(W) {
    const P = W.player;
    let trig = 0;
    W.triggers.forEach((t, i) => {
      if (t.done) trig |= 1 << i % 30;
    });
    const tb = Math.floor(W.time / (o.tbucket || 45));
    const bul = W.bullets.map((b) => ((b.x >> 4) << 8) | (b.y >> 4)).join(':');
    return [P.x >> 1, P.y >> 1, Math.round(P.vy * 2), P.djump ? 1 : 0, P.jumpHeld ? 1 : 0, P.coyote > 0 ? 1 : 0, W.gravity, trig, tb, W.vars.phase || 0, bul].join(',');
  }
  const seen = new Set();
  const heap = new Heap();
  const root = { seq: [], f: 0 };
  heap.push(root);
  let exp = 0;
  const causes = {};
  let best = null;
  while (heap.size && exp < o.max) {
    const node = heap.pop();
    exp++;
    for (let ai = 0; ai < ACT.length; ai++) {
      const seq = node.seq.concat([ai]);
      const res = sim(seq);
      if (res.done) return { ok: true, seq, exp, frames, goal, ACT, K, causes };
      if (res.dead) {
        const c = res.cause || '(別の出口)';
        causes[c] = (causes[c] || 0) + 1;
        continue;
      }
      const W = res.r.W;
      const k = key(W);
      if (seen.has(k)) continue;
      seen.add(k);
      const hv = h(W);
      if (!best || hv < best.h) best = { h: hv, x: W.player.x, y: W.player.y, t: W.time };
      heap.push({ seq, f: hv / 1.7 + seq.length * K * o.w });
    }
    if (!o.quiet && exp % 2000 === 0) console.log(`  ...exp ${exp} open ${heap.size} best h=${best && best.h.toFixed(0)} @(${best && best.x},${best && best.y}) frames=${frames}`);
  }
  return { ok: false, exp, frames, goal, best, causes };
}

function describe(res) {
  if (!res.ok) return res;
  const out = [];
  let prev = null,
    n = 0;
  for (const ai of res.seq) {
    const a = res.ACT[ai];
    const s = (a.dir < 0 ? 'L' : a.dir > 0 ? 'R' : '-') + (a.j ? 'J' : '') + (a.s ? 'S' : '');
    if (s === prev) n++;
    else {
      if (prev) out.push(prev + '*' + n * res.K);
      prev = s;
      n = 1;
    }
  }
  out.push(prev + '*' + n * res.K);
  return out.join(' ');
}

// 見つけた入力列を少しずつ揺らして再生し、成功率を測る（人間でも通せる余裕があるかの目安）
function robustness(G, o, res, trials) {
  const def = G.ROOMS[o.room];
  const start = makeStart(G, o);
  const rng = new G.RNG(1234);
  // 入力をフレーム列に展開
  const frames = [];
  for (const ai of res.seq) for (let k = 0; k < res.K; k++) frames.push(res.ACT[ai]);
  let ok = 0;
  for (let t = 0; t < trials; t++) {
    // 入力が変わる境目を ±2 フレームずらす
    const seq = frames.slice();
    for (let i = 1; i < seq.length; i++) {
      if (seq[i] !== seq[i - 1] && rng.chance(0.8)) {
        const d = rng.int(-2, 2);
        if (d > 0) for (let k = 0; k < d && i + k < seq.length; k++) seq[i + k] = seq[i - 1];
        else if (d < 0) for (let k = 1; k <= -d && i - k > 0; k++) seq[i - k] = seq[i];
      }
    }
    const r = new Runner(G, o.room, Object.assign({ diff: o.diff }, start));
    let done = false;
    for (let i = 0; i < seq.length + 240 && !done; i++) {
      const a = seq[Math.min(i, seq.length - 1)];
      r.step({ left: a.dir < 0, right: a.dir > 0, jump: !!a.j && i < seq.length, shoot: !!a.s });
      if (r.deaths.length) break;
      if (r.exited) {
        done = r.exited === res.goal;
        break;
      }
      if (res.goal === 'boss' && r.W.boss && r.W.boss.defeated) done = true;
      if (res.goal === 'flag' && r.W.vars.goal) done = true;
    }
    if (done) ok++;
  }
  return ok / trials;
}

module.exports = { solve, describe, robustness };

if (require.main === module) {
  const o = parseArgs(process.argv.slice(2));
  const G = load();
  const t0 = Date.now();
  const res = solve(G, o);
  const dt = ((Date.now() - t0) / 1000).toFixed(1);
  if (res.ok) {
    console.log(`[OK] ${o.room} from ${o.from} -> ${res.goal}: ${res.seq.length * res.K} frames, exp=${res.exp}, sim=${res.frames} (${dt}s)`);
    console.log('  path: ' + describe(res));
    if (o.robust) console.log(`  robustness: ${(robustness(G, o, res, o.robust) * 100).toFixed(0)}% (入力タイミング±2fで再生)`);
  } else {
    console.log(`[FAIL] ${o.room} from ${o.from} -> ${res.goal}: exp=${res.exp} (${dt}s) best=${JSON.stringify(res.best)}`);
  }
  const c = Object.entries(res.causes).sort((a, b) => b[1] - a[1]).slice(0, 6);
  if (c.length) console.log('  deaths seen: ' + c.map(([k, v]) => `${k}×${v}`).join(' / '));
  process.exit(res.ok ? 0 : 1);
}
