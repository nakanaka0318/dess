// 「人間らしい攻略手順」を少しずつ揺らして何度も再生し、成功率を測る
// 罠を一度知ったプレイヤーが、無理なタイミングを要求されずに突破できるかの確認用
// 使い方: node tools/human.js [roomId ...]
'use strict';
const { load, Runner, spawnAt } = require('./headless');
const G = load();

// 手順の記法
//  { go: x }                       x 座標（中心）まで歩く
//  { wait: n }                     n フレーム待つ
//  { jump: 'R'|'L'|0, hold, dj, djHold, steer }  ジャンプ（dj フレーム後に2段目）。着地まで steer 方向に入力
//  { until: fn, dir }              条件を満たすまで dir 方向に入力
//  { shoot: n }                    n フレーム撃つ
// 跳んだ時の放物線と流れ星の予測軌道が重ならない瞬間まで待つ
function jumpClear(W, P, dir) {
  const stars = W.ents.filter((e) => e.alive && e.kind === 'star');
  for (let t = 0; t <= 60; t += 2) {
    const x = P.x + dir * G.PHYS.RUN * t;
    const y = P.y - Math.max(0, 4.6 * t - 0.09 * t * t);
    for (const s of stars) if (G.rectCircle({ x, y, w: P.w, h: P.h }, s.cx + s.vx * t, s.cy + s.vy * t, s.r + 4)) return false;
  }
  return true;
}
const STAR_SAFE = { until: (W, P) => jumpClear(W, P, 1), dir: 0 };
const S = {
  '1-1': {
    from: '@',
    steps: [
      { go: 142 }, { wait: 40 }, // 木の手前で一歩踏み込んで止まり、リンゴを先に落とさせる
      { go: 196 }, { wait: 45 }, // 穴の縁で待ってリンゴを先に飛ばす
      { jump: 'R', hold: 14 },
      { go: 318 }, { jump: 'R', hold: 12 }, // 偽看板の先のトゲを飛び越える
      { go: 396 }, { jump: 'R', hold: 16, dj: 14, djHold: 12 }, { go: 500 }, // 見えないブロックの上を2段ジャンプで越える
    ],
  },
  '1-2': {
    from: 'S',
    steps: [{ go: 50 }, { jump: 'R', hold: 10 }, { go: 104 }, { jump: 'R', hold: 12 }, { go: 160 }, { jump: 'R', hold: 10 }, { go: 290 }, { go: 330 }, { wait: 90 },
      { go: 404 }, { jump: 'R', hold: 16, dj: 20, djHold: 12 }, { go: 500 }], // 戻ってくる月を跳び越える
  },
  '1-3': {
    from: 'S',
    steps: [
      { go: 92 }, { jump: 0, hold: 6 }, { wait: 30 }, // 小ジャンプでトゲを先に飛ばす
      { go: 214 }, { jump: 'R', hold: 14, steerFrames: 24 }, // P1
      { go: 272 }, { jump: 'R', hold: 16, dj: 18, djHold: 14, steerFrames: 50 }, // P2
      { go: 374 }, { jump: 'R', hold: 14, steerFrames: 22 }, // P3
      { go: 412 }, { wait: 70 }, // 天井のトゲが落ちるのを待つ
      { go: 406 }, { jump: 'L', hold: 16, dj: 22, djHold: 14, steerFrames: 64 }, // P4
      { go: 266 }, { jump: 'L', hold: 16, dj: 20, djHold: 16 }, // 岩棚
      { go: 152 }, { wait: 72 }, // 棚の右端（穴の外）で止まり、月が通り過ぎるのを待つ
      { go: 126 }, { jump: 0, hold: 16, dj: 18, djHold: 16 },
    ],
    goal: 'up',
  },
  '1-4': {
    from: 'S',
    steps: [{ go: 122 }, { jump: 'R', hold: 12 }, { go: 192 }, { jump: 'R', hold: 12 }, { go: 272 }, { jump: 'R', hold: 12 }, { go: 352 }, { jump: 'R', hold: 12 }, { go: 500 }],
  },
  '2-1': {
    from: 'S',
    steps: [
      { jump: 'R', hold: 8 }, // ヘルメットは拾わない
      { go: 96 }, { wait: 40 }, { go: 180 }, // ドッスン①を落とさせて、上がり始めたらくぐる
      { go: 196 }, // ドッスン②は二度落ちるので戻るまで待つ（その間に後ろから来るリンゴを跳び越える）
      { until: (W, P) => W.ents.some((e) => e instanceof G.Fruit && e.cx < P.cx && e.cx > P.cx - 34), dir: 0 },
      { jump: 0, hold: 12 }, { wait: 40 },
      { go: 278 }, { wait: 60 }, { go: 410 }, // ③は止まらず駆け抜ける
      { go: 420 },
    ],
    goal: 'down',
  },
  '2-2': {
    from: 'S',
    steps: [
      { go: 378 }, { go: 372 }, { go: 386 }, { wait: 30 }, // つらら①を落とさせる
      { go: 312 }, { go: 330 }, { wait: 60 }, // ②は遅れて落ちるので一度引き返して待つ
      { go: 276 }, { jump: 'L', hold: 12 }, // 石筍の上を飛ぶ
      { go: 206 }, { wait: 50 }, // 穴の手前で止まって③を先に落とさせる
      { go: 186 }, { jump: 'L', hold: 4 }, // 小ジャンプでベルトへ
      { jump: 'L', hold: 7 }, { jump: 'L', hold: 7 }, // ベルトは本気を出すので低く跳んで渡る（天井はトゲ）
      { go: -20 },
    ],
    goal: 'left',
  },
  '2-3': {
    from: 'S',
    steps: [
      { go: 248 }, { jump: 'L', hold: 10 }, { go: 168 }, { jump: 'L', hold: 10 },
      { go: 50 }, // 崩れる床の上では止まらず、地面まで行ってから
      { until: (W, P) => W.ents.some((e) => e instanceof G.Rock && e.r === 14 && e.cx > P.cx - 46), dir: 0 },
      { jump: 0, hold: 16 }, { go: -20 }, // 前からの岩を飛び越える
    ],
    goal: 'left',
  },
  '3-1': {
    from: 'S',
    // シャンデリアは一歩踏み込んで先に落とさせる
    steps: [{ go: 384 }, { shoot: 20 }, { wait: 10 }, { go: 276 }, { jump: 'L', hold: 12, steerFrames: 30 }, { go: 234 }, { wait: 40 }, { go: 212 }, { jump: 'L', hold: 14 }, { go: 90 }, { until: (W, P) => W.ents.some((e) => e instanceof G.Spike && e.vx < 0 && e.x < P.cx + 70), dir: 0 }, { jump: 'L', hold: 16, dj: 28, djHold: 12 }, { go: -20 }], // 前から来るトゲは2段目で越える
    goal: 'left',
  },
  '3-2': {
    from: 'S',
    steps: [
      { go: 370 }, { jump: 0, hold: 14 }, { wait: 50 }, // オーブで天井へ
      { go: 348 }, { wait: 60 }, // 天井を一歩進んで止まり、上に落ちるリンゴを先に通す
      { go: 290 }, { jump: 'L', hold: 10 }, // 天井のトゲ
      { go: 196 }, { jump: 'L', hold: 14 }, // 罠オーブを飛び越える
      { go: 108 }, { jump: 'L', hold: 8 }, // さかさまの床から出るトゲを跳び越える
      { go: 54 }, { wait: 40 }, { go: -20 },
    ],
    goal: 'left',
  },
  '3-3': {
    from: 'S',
    steps: [
      { go: 312 }, { jump: 'L', hold: 14, steerFrames: 6 }, { go: 312 },
      { until: (W) => W.ents.some((e) => e.kind === 'fire' && e.y > 300), dir: 0 }, // 火の玉が沈んだ瞬間に跳ぶ
      { go: 306 }, { jump: 'L', hold: 16, steerFrames: 40 }, { go: 184 }, { jump: 'L', hold: 16, steerFrames: 40 }, // P2→P3
      { go: 128 }, { jump: 'R', hold: 16, dj: 24, djHold: 10, steerFrames: 56 }, // P3→P4（トゲを避けて右端に着地）
      { go: 226 }, { wait: 4 }, { jump: 0, hold: 16, dj: 20, djHold: 16 },
    ],
    goal: 'up',
  },
  '4-1': {
    from: 'left',
    dodge: true,
    steps: [
      { go: 70 }, STAR_SAFE, { jump: 'R', hold: 12 },
      { go: 170 }, STAR_SAFE, { jump: 'R', hold: 12 },
      { go: 270 }, STAR_SAFE, { jump: 'R', hold: 14 },
      { go: 330 }, { wait: 45 }, { go: 350 }, STAR_SAFE, { jump: 'R', hold: 10 }, { go: 500 },
    ],
  },
  '4-2': {
    from: 'S',
    steps: [{ go: 110 }, { jump: 0, hold: 16, dj: 18, djHold: 14 }, { wait: 30 }, { go: 120 }, { go: 124 }, { shoot: 4 }, { wait: 90 }, { go: 418 }, { jump: 'R', hold: 12 }, { go: 500 }], // 扉の先の偽の床を跳び越える
  },
  '4-3': {
    from: 'S',
    steps: [
      { go: 118 }, { jump: 'R', hold: 12 }, // バネを飛び越える
      { go: 184 }, { jump: 0, hold: 16, dj: 18, djHold: 14, steer: 'R', steerStart: 22, steerFrames: 16 }, // A へ
      { until: (W, P) => W.ents.some((e) => e.solid && e.code === 2 && e.x < 270), dir: 0 },
      { go: 248 }, { jump: 'R', hold: 12 }, // 動く足場へ
      { until: (W, P) => W.ents.some((e) => e.solid && e.code === 2 && e.x > 310), dir: 0 },
      { go: 350 }, { jump: 'R', hold: 16 }, // B へ
      { go: 412 }, { jump: 'L', hold: 16 }, // C の右端へ
      { go: 346 }, { jump: 'L', hold: 10, steerFrames: 22 }, // 偽のゴール旗を飛び越える
      { go: 300 }, { wait: 90 }, // 月が落とすリンゴを待つ
      { go: 270 }, { jump: 0, hold: 16, dj: 18, djHold: 14 },
    ],
    goal: 'up',
  },
  // ひみつの部屋
  '1-S': {
    from: 'S',
    steps: [
      { go: 404 }, { shoot: 20 }, { wait: 10 }, // ミミックは撃って倒す
      { jump: 'L', hold: 12 }, { go: 210 }, // 人食い花を跳び越えて、真ん中の宝箱を開ける
      { wait: 30 }, { jump: 0, hold: 10 }, // ひみつのリンゴ
      { go: 270 }, { wait: 60 }, // 降ってくるリンゴをよける
      { go: 350 }, { jump: 'R', hold: 12 }, { go: 500 },
    ],
    check: (W) => W.game.flags.secret1,
  },
  // 6面
  '11-1': {
    from: 'S',
    steps: [
      { go: 100 }, { shoot: 4 }, // ★1UP（機雷）は撃って消す
      { go: 352 }, { until: (W) => !W.vars.ov || W.vars.ov.t >= W.vars.ov.reveal, dir: 0 }, // にせの GAME OVER の間は跳ばない（押すとリトライ扱い）
      { jump: 'R', hold: 12 }, { jump: 'R', hold: 14 }, // 偽の床を越え、着地したらすぐ出口のトゲを越える
    ],
  },
  '11-2': {
    from: 'S',
    steps: [
      { go: 90 }, { until: (W, P) => W.ents.some((e) => e.alive && e.kind === 'rock' && e.x < P.x + 46), dir: 0 }, { jump: 0, hold: 14 }, // 右からの隕石
      { go: 172 }, { jump: 'R', hold: 16 }, // UFO の下は跳び越える
      { go: 266 }, { jump: 'R', hold: 16, dj: 22, djHold: 14 }, // 高い足場へ（低い足場は偽物）
      { jump: 'R', hold: 8 }, { go: 428 }, { jump: 'R', hold: 12 }, // すぐ降りて、ワープゾーンを跳び越える
    ],
  },
  '11-3': {
    from: 'S',
    steps: [
      { go: 104 }, { go: 80 }, { wait: 150 }, // 惑星を落とさせて、帰るのを待つ
      { go: 356 }, // にせの PAUSE でも止まらない。壁はそのまま通れる
      { jump: 'R', hold: 16 }, { go: 500 }, // 倒れる看板を跳び越える
    ],
  },
  '11-4': {
    from: 'S',
    steps: [
      { go: 88 },
      { until: (W) => W.ents.some((e) => e.alive && e.style === 'ring' && e.y === 200 && e.x < 114), dir: 0 }, { jump: 'R', hold: 16, steerFrames: 22 }, // 環Aが左に来たら乗る
      { until: (W) => W.ents.some((e) => e.alive && e.style === 'ring' && e.y === 200 && e.x > 188), dir: 0 }, { jump: 'R', hold: 16, steerFrames: 34 }, // 右端で環Bへ
      { until: (W) => W.ents.some((e) => e.alive && e.style === 'ring' && e.y === 160 && e.x > 312), dir: 'R' }, { jump: 'R', hold: 14 }, // 向こう岸の左のはしを避けて
      { go: 500 }, // 本物の1UPは撃たずに取る
    ],
  },
  '12-1': {
    from: 'S',
    steps: [
      { go: 70 }, { shoot: 30 }, { wait: 10 }, // 掃除ロボットは撃って壊す（セーブポイントの上で撃つと弾がセーブに当たる）
      { go: 244 }, { jump: 'R', hold: 10, steerFrames: 14 }, // エレベーターに乗る
      { go: 306 }, { until: (W, P) => P.y + P.h <= 140, dir: 0 }, { jump: 'R', hold: 16 }, // 通路の高さで跳び移る
      { go: 392 }, { wait: 6 }, { jump: 'R', hold: 16 }, { go: 500 }, // レーザーを跳んでよけて出口へ
    ],
  },
  '12-2': {
    from: 'S',
    steps: [
      { go: 92 }, { until: (W, P) => P.onGround && P.y > 200, dir: 0 }, { shoot: 10 }, { wait: 10 }, // もう一人の自分を撃つ
      { go: 176 }, { jump: 'R', hold: 12 }, // にせの STAGE CLEAR が出たら足場へ
      { go: 268 }, { jump: 'R', hold: 14 }, // 抜けた床を越える
      { go: 400 }, { jump: 'R', hold: 14 }, { go: 500 }, // 宇宙人の言うとおり、トゲを越える
    ],
  },
  '12-3': {
    from: 'S',
    steps: [
      { go: 70 }, { until: (W) => W.vars.count === null, dir: 0 }, // 自爆カウントダウンが終わるまで待つ
      { go: 274 }, { jump: 'R', hold: 16 }, // 抜けた床を越える
      { go: 350 }, { wait: 100 }, // 停電させて、その間は動かない
      { go: 408 }, { go: 380 }, { wait: 40 }, { jump: 'R', hold: 16 }, { go: 500 }, // 天井を落とさせてから越える
    ],
  },
};

// 星の軌道を少し先まで予測して、当たらない向き（進む・止まる・戻る）を選ぶ
function dodgeDir(W, P, want) {
  const stars = W.ents.filter((e) => e.alive && e.kind === 'star');
  if (!stars.length) return want;
  const onGround = (x) => W.solidAt(x, P.y + 1, P.w, P.h) || W.onewayAt(x, P.w, P.y + P.h, 1);
  const safe = (dir) => {
    let x = P.x;
    for (let t = 1; t <= 36; t++) {
      const nx = x + dir * G.PHYS.RUN;
      if (P.onGround && dir && !onGround(Math.round(nx))) return false; // 足場から落ちない
      x = nx;
      for (const s of stars) {
        const sx = s.cx + s.vx * t,
          sy = s.cy + s.vy * t;
        if (G.rectCircle({ x, y: P.y, w: P.w, h: P.h }, sx, sy, s.r + 3)) return false;
      }
    }
    return true;
  };
  for (const dir of [want, 0, -want]) if (safe(dir)) return dir;
  return want;
}

const TRACE = process.argv.includes('--trace');
// 画面内で危険物が動き出した（または現れた）か
const watched = new WeakMap();
function alarm(W) {
  let a = false;
  for (const e of W.ents) {
    if (!e.alive) continue;
    const danger = e.hazard || e.style === 'thwomp' || e instanceof G.Moon;
    if (!danger) continue;
    const moving = !!(e.vx || e.vy || e.ax || e.ay || e.tw || e.shakeT > 0 || e.popT > 0);
    const prev = watched.get(e);
    if (prev === undefined && W.time > 2 && e.t <= 1) a = true; // 新しく現れた
    else if (prev === false && moving) a = true;
    watched.set(e, moving);
  }
  return a;
}
function run(id, script, rng, onEnd) {
  const from = script.from || 'S';
  let opts;
  if (script.enter) opts = { enter: Object.assign({ vy: 0, djump: true, face: 1 }, script.enter) };
  else if (from === 'left') opts = { enter: { x: 1, y: 3 * 20 + 20 - 14, vy: 0, djump: true, face: 1 } };
  else opts = { spawn: spawnAt(G, id, from) };
  const r = new Runner(G, id, opts);
  const W = r.W;
  const jit = (n, a) => n + (rng ? rng.int(-a, a) : 0);
  for (const st0 of script.steps) {
    const st = Object.assign({}, st0);
    let guard = 0;
    const step = (inp) => {
      r.step(inp);
      return r.deaths.length || r.exited;
    };
    if (st.go != null) {
      const tx = jit(st.go, 2);
      let alarmAt = -1;
      while (Math.abs(W.player.cx - tx) > 1.5 && guard++ < 900) {
        const P = W.player;
        const d = tx - P.cx;
        let mv = Math.sign(d);
        if (script.dodge) mv = dodgeDir(W, P, mv);
        // 反応する初見プレイヤー：何かが動き出したのを見てから react フレーム後に立ち止まる
        if (script.react) {
          if (alarmAt === -1 && alarm(W)) alarmAt = W.time;
          if (alarmAt >= 0 && W.time - alarmAt >= script.react) {
            // 立ち止まって様子を見てから、また進む
            let dead = false;
            for (let i = 0; i < 70 && !dead; i++) dead = step({});
            if (dead) break;
            alarmAt = -2;
            continue;
          }
        }
        if (step({ left: mv < 0, right: mv > 0 })) break;
      }
    } else if (st.wait != null) {
      const n = Math.max(0, jit(st.wait, 3));
      for (let i = 0; i < n; i++) if (step({})) break;
    } else if (st.jump != null) {
      const hold = Math.max(1, jit(st.hold, 2));
      const dj = st.dj ? jit(st.dj, 2) : 0;
      const djHold = st.djHold ? jit(st.djHold, 2) : 0;
      const steer = st.steer || st.jump;
      let f = 0,
        left = false;
      while (guard++ < 400) {
        const P = W.player;
        const sf = st.steerFrames == null ? 9999 : st.steerFrames;
        const ss = st.steerStart || 0;
        const on = f >= ss && f < ss + sf;
        const inp = { left: steer === 'L' && on, right: steer === 'R' && on };
        if (f < hold) inp.jump = true;
        if (dj && f >= dj && f < dj + djHold) inp.jump = true;
        if (f === dj) inp.jump = false; // 押し直し
        if (step(inp)) break;
        f++;
        if (!P.onGround) left = true;
        if (left && P.onGround && f > 4) break;
      }
    } else if (st.until) {
      while (!st.until(W, W.player) && guard++ < 900) if (step({ left: st.dir === 'L', right: st.dir === 'R' })) break;
    } else if (st.shoot) {
      for (let i = 0; i < st.shoot; i++) if (step({ shoot: i % 2 === 0 })) break;
    }
    if (TRACE && !rng) console.log('   ', JSON.stringify(st0, (k, v) => (typeof v === 'function' ? 'fn' : v)), '→', W.player.x, W.player.y, 't=' + W.time, r.deaths[0] ? 'DEAD ' + r.deaths[0].cause : '');
    if (r.deaths.length || r.exited) break;
  }
  // 最後に出口方向へ少し進めてみる
  for (let i = 0; i < 120 && !r.deaths.length && !r.exited; i++) r.step({});
  const goal = script.goal || 'right';
  if (onEnd) onEnd(W);
  const okGoal = r.exited === goal && (!script.check || script.check(W));
  return { ok: okGoal, death: r.deaths[0] && r.deaths[0].cause, exit: r.exited, pos: [W.player.x, W.player.y] };
}

module.exports = { run, S, G, STAR_SAFE };
if (require.main !== module) return;

const only = process.argv.slice(2).filter((a) => !a.startsWith('--'));
let bad = 0;
for (const id of Object.keys(S)) {
  if (only.length && !only.includes(id)) continue;
  const base = run(id, S[id], null);
  const rng = new G.RNG(99);
  let ok = 0;
  const causes = {};
  const N = 40;
  for (let i = 0; i < N; i++) {
    const r = run(id, S[id], rng);
    if (r.ok) ok++;
    else causes[r.death || r.exit || 'stuck'] = (causes[r.death || r.exit || 'stuck'] || 0) + 1;
  }
  const pct = Math.round((ok / N) * 100);
  if (!base.ok || pct < 70) bad++;
  console.log(`${id}: 基準手順 ${base.ok ? 'OK' : 'NG(' + (base.death || base.exit || 'stuck@' + base.pos) + ')'}  揺らし成功率 ${pct}%  ${Object.entries(causes).map(([k, v]) => k + '×' + v).join(' / ')}`);
}
process.exit(bad ? 1 : 0);
