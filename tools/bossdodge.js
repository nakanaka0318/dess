// ボス戦の難しさの目安：弾や体当たりの軌道を予測して避ける自動操縦ボットで戦わせ、被弾回数を数える
// 人間の上手な回避とは違うが、極端に避けられない攻撃がないかの確認に使う
// 使い方: node tools/bossdodge.js [2-B|4-B] [--easy]
'use strict';
const { load, Runner, spawnAt } = require('./headless');
const G = load();
G.autoShot = true;
const args = process.argv.slice(2);
const easy = args.includes('--easy');
const ids = args.filter((a) => !a.startsWith('--'));

function hazardsAt(W, t) {
  const out = [];
  // 月のウソの予告：予告された場所の外側がすべて危ない
  const fw = W.vars.fakeWarn;
  if (fw) {
    out.push({ c: false, x: -20, y: 0, w: fw.x + 20, h: 240 });
    out.push({ c: false, x: fw.x + fw.w, y: 0, w: 500, h: 240 });
  }
  for (const e of W.ents) {
    if (!e.alive) continue;
    if (e instanceof G.Fruit && e.hazard) {
      out.push({ c: true, x: e.cx + e.vx * t + 0.5 * e.ax * t * t, y: e.cy + e.vy * t + 0.5 * e.ay * t * t, r: e.r });
    } else if (e instanceof G.HazardBox) {
      out.push({ c: false, x: e.x + e.vx * t, y: e.y + e.vy * t, w: e.w, h: e.h });
    } else if (e instanceof G.Laser) {
      const left = e.phase === 'warn' ? e.warn - e.t : 0;
      const end = e.warn + e.dur - e.t;
      if (t >= left - 2 && t <= end) out.push({ c: false, x: e.x, y: e.y, w: e.w, h: e.h });
    } else if (e instanceof G.Spike && e.hazard) {
      out.push({ c: false, x: e.x + e.ox + 3, y: e.y + e.oy + 3, w: e.w - 6, h: e.h - 6 });
    } else if (e instanceof G.Lava) {
      out.push({ c: false, x: 0, y: e.y + 4, w: 480, h: 400 });
    } else if (e instanceof G.Moon && e.hazard) {
      out.push({ c: true, x: e.cx + e.vx * t, y: e.cy + e.vy * t, r: e.r - 2 });
    } else if (e instanceof G.Boss && e.hazard && (e instanceof G.CactusBoss || e instanceof G.TreeBoss)) {
      const hb = e instanceof G.TreeBoss ? e.trunk() : { x: e.x + 5, y: e.y + 4, w: e.w - 10, h: e.h - 4 };
      out.push({ c: false, x: hb.x + e.vx * t, y: hb.y + e.vy * t, w: hb.w, h: hb.h });
    } else if (e instanceof G.Boss && e.hazard) {
      let x = e.cx,
        y = e.cy;
      if (e.tw) {
        const k = Math.min(1, (e.tw.t + t) / e.tw.d);
        x = e.tw.x0 + (e.tw.x1 - e.tw.x0) * k + e.w / 2;
        y = e.tw.y0 + (e.tw.y1 - e.tw.y0) * k + e.h / 2;
      } else {
        x += e.vx * t;
        y += e.vy * t + 0.5 * e.ay * t * t;
      }
      const r = e instanceof G.MoonBoss || e instanceof G.SunBoss ? e.r - 6 : e instanceof G.BlackHole ? e.r * e.size - 4 : e.rr - 3;
      out.push({ c: true, x, y, r });
    }
  }
  return out;
}

// プレイヤーの未来位置（簡易物理）
function planPath(P, plan, H) {
  const path = [];
  let x = P.x,
    y = P.y,
    vy = P.onGround ? 0 : P.vy;
  const ground = P.onGround ? P.y : 240 - P.h;
  let jumping = false;
  for (let t = 1; t <= H; t++) {
    if (t === 1 && plan.jump && P.onGround) {
      vy = -4.6;
      jumping = true;
    }
    x = G.clamp(x + plan.dir * 1.7, 20, 452);
    if (jumping || !P.onGround) {
      vy = Math.min(5.2, vy + 0.18);
      y += vy;
      if (y >= ground && vy > 0) {
        y = ground;
        vy = 0;
        jumping = false;
      }
    }
    path.push({ x, y });
  }
  return path;
}

function hit(p, h, m) {
  const r = { x: p.x - m, y: p.y - m, w: 8 + m * 2, h: 14 + m * 2 };
  return h.c ? G.rectCircle(r, h.x, h.y, h.r) : G.overlap(r, h);
}

function fight(id) {
  const ENTRY = { '5-B': 30, '6-B': 30, '7-B': 30, '8-B': 100 };
  const FLAGS = { '12-X': { culpritFound: true } };
  const r = new Runner(G, id, { spawn: ENTRY[id] ? { x: ENTRY[id], y: 226, face: 1 } : spawnAt(G, id, id === '2-B' ? '@' : 'S'), diff: easy ? 'easy' : 'normal', flags: Object.assign({}, FLAGS[id]) });
  const W = r.W;
  if (id === '2-B') {
    W.player.x = 440;
    W.player.y = 226;
  }
  let hits = 0,
    inv = 0;
  const causes = {};
  W.kill = (c) => {
    if (inv > 0) return;
    hits++;
    inv = 45;
    causes[c] = (causes[c] || 0) + 1;
  };
  const PLANS = [];
  for (const dir of [0, -1, 1]) for (const jump of [false, true]) PLANS.push({ dir, jump });
  let cur = PLANS[0],
    hold = 0,
    t = 0;
  for (; t < 60 * 60 * 8; t++) {
    if (inv > 0) inv--;
    const P = W.player,
      b = W.boss;
    if (!b || b.defeated) break;
    if (hold <= 0) {
      const H = 34;
      const fut = [];
      for (let k = 1; k <= H; k++) fut.push(hazardsAt(W, k));
      // 撃ちやすい位置（ボスと同じ高さ・少し離れた場所）
      let want = !b.vulnerable ? (id === '2-B' || ENTRY[id] ? 200 : P.cx) : G.clamp(b.cx + (P.cx < b.cx ? -90 : 90), 30, 450);
      if (b.vulnerable && (id === '7-B' || id === '8-B')) want = id === '8-B' ? 200 : G.clamp(b.cx + (P.cx < b.cx ? -150 : 150), 30, 450);
      let best = null;
      for (const pl of PLANS) {
        const path = planPath(P, pl, H);
        let first = H + 1;
        for (let k = 0; k < H; k++) {
          if (fut[k].some((h) => hit(path[k], h, 2))) {
            first = k;
            break;
          }
        }
        const end = path[path.length - 1];
        const score = first * 100 - Math.abs(end.x + 4 - want) * 0.5 - (pl.jump ? 8 : 0);
        if (!best || score > best.score) best = { pl, score };
      }
      cur = best.pl;
      hold = 2;
    }
    hold--;
    const inp = { left: cur.dir < 0, right: cur.dir > 0, jump: cur.jump };
    // ボスの方を向く（撃つため）
    if (!cur.dir && t % 16 === 0 && b.vulnerable) {
      inp.right = b.cx > P.cx;
      inp.left = b.cx < P.cx;
    }
    r.step(inp);
  }
  return { t, defeated: !!(W.boss && W.boss.defeated), hits, causes, hp: W.boss.hp };
}

for (const id of ids.length ? ids : ['2-B', '4-B']) {
  const res = fight(id);
  console.log(`${id}${easy ? '(easy)' : ''}: ${res.defeated ? '撃破' : '未撃破(HP' + res.hp + ')'} ${(res.t / 60).toFixed(0)}秒  被弾 ${res.hits}回`);
  console.log('   ' + Object.entries(res.causes).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k}×${v}`).join(' / '));
}
