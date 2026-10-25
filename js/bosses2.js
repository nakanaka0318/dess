// 2面・3面のボス：サボテン将軍（2面中ボス） / THE SUN（2面ボス） / ブラックホール（3面中ボス） / ニュートンの樹（ラスボス）
(function () {
  'use strict';
  const G = globalThis.G;
  const SW = G.W;
  const FLOOR = 240;

  // 撃破後の共通処理：撃破を記録してセーブ（この後の演出で死んでも戦い直しにはならない）
  function markDead(W, flag, tx, ty) {
    if (!W.game) return;
    W.game.flags[flag] = true;
    if (W.game.save) W.game.save(W.id, tx, ty);
  }
  function clearShots(W, keep) {
    for (const e of W.ents) {
      if (e === keep || e instanceof G.Boss) continue;
      if (e instanceof G.Fruit || e instanceof G.Laser || e instanceof G.HazardBox || (e instanceof G.Spike && e.bossShot)) {
        W.spark(e.cx, e.cy, '#ffffff');
        e.alive = false;
      }
    }
  }
  G.BOSSES.markDead = markDead;
  G.BOSSES.clearShots = clearShots;

  // ------------------------------------------------------------------
  // サボテン将軍
  // ------------------------------------------------------------------
  class CactusBoss extends G.Boss {
    constructor(W, cx) {
      super(W, cx - 18, FLOOR - 76, 36, 76, { hp: 90, name: 'サボテン将軍' });
      this.scale = 0.3;
      this.cause = 'サボテン将軍にハグされた。';
      this.arm = 0; // 腕の上げ具合（-1 下 / 1 上）
      this.bloom = 0;
      this.tilt = 0;
    }
    // 見た目の高さは scale で変わる（足もとは this.y + this.h）
    hits(rect) {
      if (!this.hazard) return false;
      const h = this.h * this.scale,
        b = this.y + this.h;
      return G.overlap(rect, { x: this.x + 5, y: b - h + 4, w: this.w - 10, h: h - 4 });
    }
    shotBox() {
      const h = this.h * this.scale,
        b = this.y + this.h;
      return { x: this.x - 4, y: b - h - 6, w: this.w + 8, h: h + 6 };
    }
    draw(ctx) {
      G.Render.drawCactusBoss(ctx, this);
    }
  }
  G.CactusBoss = CactusBoss;

  G.BOSSES.cactus = function (W, opts) {
    const P = W.player;
    const rng = W.rng;
    const c = W.add(new CactusBoss(W, 380));
    const phase2 = () => c.hp < c.maxHp / 2;
    const needle = (x, y, vx, vy, ay, cause) => {
      const n = W.fruit(x, y, { kind: 'needle', r: 4, cause: cause || 'サボテンの針が刺さった。' });
      n.vel(vx, vy, 0, ay || 0);
      n.bossShot = true;
      n.maxV = 7;
      return n;
    };

    // 針の雨：上に撃ち上げた針が広がって降ってくる
    function* rain() {
      c.arm = 1;
      G.sfx('charge');
      yield 26;
      const n = phase2() ? 16 : 12;
      for (let w = 0; w < (phase2() ? 2 : 1); w++) {
        for (let i = 0; i < n; i++) {
          const vx = -2.8 + (5.6 * i) / (n - 1) + rng.range(-0.2, 0.2) + w * 0.18;
          needle(c.cx, c.y + 6, vx, -5.2 - rng.range(0, 1), 0.15, '針の雨に打たれた。');
        }
        G.sfx('explode');
        yield 26;
      }
      c.arm = 0;
      yield 60;
    }
    // 横一列の針：低い（跳ぶ）／高い（地面で待つ）を交互に
    function* volley() {
      const order = phase2() ? ['low', 'high', 'low', 'low'] : ['low', 'high', 'low'];
      for (const kind of order) {
        c.arm = kind === 'low' ? -1 : 1;
        G.sfx('warn');
        yield phase2() ? 22 : 28;
        const dir = P.cx < c.cx ? -1 : 1;
        const y = kind === 'low' ? FLOOR - 6 : FLOOR - 36;
        for (let k = 0; k < 3; k++) needle(c.cx + dir * (20 + k * 10), y, dir * 4.2, 0, 0, kind === 'low' ? '足もとの針を跳べなかった。' : '高い針に跳びこんだ。');
        // 反対側にも少し遅れて飛ばす
        W.after(10, () => {
          if (!c.defeated) for (let k = 0; k < 2; k++) needle(c.cx - dir * (20 + k * 10), y, -dir * 3.4, 0, 0, '背中側にも針は飛ぶ。');
        });
        G.sfx('shoot');
        yield 34;
      }
      c.arm = 0;
      yield 20;
    }
    // 床から順番にトゲが生える
    function* wave() {
      W.shake = 16;
      G.sfx('rumble');
      c.arm = -1;
      yield 30;
      const dir = P.cx < c.cx ? -1 : 1;
      const tx0 = Math.floor(c.cx / 20) + dir * 2;
      for (let tx = tx0; tx >= 1 && tx <= 22; tx += dir) {
        const s = W.spike(tx, 11, 'u', { hidden: true, cause: '地面から針が生えてきた。' });
        s.bossShot = true;
        s.pop(3, false);
        W.after(22, () => (s.alive = false));
        if (tx % 2 === 0) G.sfx('pop');
        yield phase2() ? 5 : 6;
      }
      c.arm = 0;
      yield 30;
    }
    // 反対側へ大ジャンプ。着地で衝撃波
    function* leap() {
      const tx = c.cx > SW / 2 ? rng.pick([90, 150]) : rng.pick([330, 390]);
      const dur = 56;
      c.vel((tx - c.cx) / dur, -5.6, 0, 0.2);
      c.arm = 1;
      G.sfx('boing');
      // 後半は空中から全方位に針をばらまく
      if (phase2()) {
        yield () => c.vy >= 0;
        for (let i = 0; i < 12; i++) {
          const a = (i / 12) * Math.PI * 2 + rng.range(0, 0.4);
          needle(c.cx, c.y + 30, Math.cos(a) * 2.4, Math.sin(a) * 2.4, 0.04, '空からの針に刺さった。');
        }
        G.sfx('explode');
      }
      yield () => c.vy > 0 && c.y + c.h >= FLOOR;
      c.stop();
      c.y = FLOOR - c.h;
      c.arm = 0;
      W.shake = 14;
      G.sfx('stomp');
      W.burst(c.cx, FLOOR, 16, ['#d8a85a', '#f0c878'], 2, { up: 1.5, g: 0.15, life: 25 });
      W.after(10, () => {
        if (c.defeated) return;
        for (const d of [-1, 1]) {
          const wv = W.hbox(c.cx + d * 18 - 6, FLOOR - 10, 12, 10, { kind: 'wave', cause: '砂の衝撃波に足をすくわれた。' });
          wv.vel(d * 2.6, 0);
        }
      });
      yield 50;
    }
    // 頭の花が咲いて種をまき散らす（後半）
    function* bloom() {
      for (let w = 0; w < 3; w++) {
        c.bloom = 1;
        G.sfx('charge');
        yield 26;
        const n = 16,
          off = w * (Math.PI / 16) + rng.range(0, 0.3);
        for (let i = 0; i < n; i++) {
          const a = off + (i / n) * Math.PI * 2;
          const s = W.fruit(c.cx, c.y + 4, { kind: 'seed', r: 4, cause: 'サボテンの花に見とれた。' });
          s.vel(Math.cos(a) * 2, Math.sin(a) * 2);
          s.bossShot = true;
        }
        G.sfx('explode');
        c.bloom = 0;
        yield 44;
      }
    }

    // 針の竜巻：体から渦を巻いて針が飛び出す
    function* spin() {
      c.arm = 1;
      G.sfx('charge');
      yield 24;
      const arms = phase2() ? 3 : 2;
      let a = rng.range(0, 6.28);
      for (let t = 0; t < 130; t++) {
        if (t % 6 === 0) {
          for (let k = 0; k < arms; k++) {
            const ang = a + (k / arms) * Math.PI * 2;
            needle(c.cx, c.y + 30, Math.cos(ang) * 2, Math.sin(ang) * 2, 0, '針の竜巻に巻きこまれた。');
          }
          if (t % 18 === 0) G.sfx('shoot');
        }
        a += 0.08;
        yield 1;
      }
      c.arm = 0;
      yield 30;
    }

    W.run(function* () {
      const quick = opts.respawn && W.game && W.game.flags.cactusSeen;
      yield () => P.cx > 150 && P.onGround;
      W.closeGate && W.closeGate();
      G.music(null);
      if (!quick) {
        W.say('……', 0, 0, 50, { follow: c, dy: -4 });
        yield 60;
      }
      G.sfx('roar');
      W.shake = 36;
      for (let i = 0; i <= 30; i++) {
        c.scale = 0.3 + (i / 30) * 0.7;
        yield 1;
      }
      for (const e of W.ents) if (e instanceof G.Sign) e.alive = false;
      if (!quick) {
        W.say('われこそは サボテン将軍！\n月の仇、とらせてもらう！', 0, 0, 110, { follow: c, dy: -8 });
        yield 100;
      }
      if (W.game) W.game.flags.cactusSeen = true;
      G.music('boss');
      c.showBar = true;
      c.hazard = true;
      c.vulnerable = true;
      W.autoFire = true;
      if (W.easy) W.lives = 3;
      let last = '';
      for (;;) {
        const pool = phase2() ? ['rain', 'volley', 'wave', 'leap', 'bloom', 'spin'] : ['rain', 'volley', 'wave', 'leap', 'spin'];
        let p;
        do p = rng.pick(pool);
        while (p === last);
        last = p;
        if (p === 'spin') yield* spin();
        else if (p === 'rain') yield* rain();
        else if (p === 'volley') yield* volley();
        else if (p === 'wave') yield* wave();
        else if (p === 'leap') yield* leap();
        else yield* bloom();
        yield phase2() ? 10 : 18;
      }
    }, c.ai);

    c.onDefeat = () => {
      G.music(null);
      W.autoFire = false;
      W.lives = null;
      W.invuln = 0;
      clearShots(W, c);
      markDead(W, 'cactusDead', 2, 11);
      W.run(function* () {
        for (let i = 0; i < 40; i++) {
          c.shakeX = i % 2 ? 2 : -2;
          if (i % 8 === 0) {
            W.burst(c.cx + rng.range(-14, 14), c.y + rng.range(10, 60), 12, ['#4aa040', '#8ae060', '#ffffff'], 2, { g: 0.05 });
            G.sfx('explode');
          }
          yield 2;
        }
        c.shakeX = 0;
        c.showBar = false;
        // プレイヤーのいる方へ倒れてくる
        const dir = P.cx < c.cx ? -1 : 1;
        W.say('む、無念……', 0, 0, 50, { follow: c, dy: -8 });
        yield 40;
        for (let i = 1; i <= 12; i++) {
          c.tilt = (dir * i) / 12;
          yield 1;
        }
        const x0 = dir > 0 ? c.cx : c.cx - 80;
        const hb = W.hbox(x0, FLOOR - 22, 80, 22, { kind: 'fallen', cause: 'サボテン将軍が倒れてきた。' });
        hb.visible = false;
        hb.life = 24;
        W.shake = 18;
        G.sfx('stomp');
        W.burst(c.cx + dir * 40, FLOOR - 6, 30, ['#d8a85a', '#f0c878', '#4aa040'], 2.5, { up: 2, g: 0.15, life: 30 });
        yield 30;
        W.burst(c.cx + dir * 30, FLOOR - 16, 80, ['#4aa040', '#8ae060', '#ffe9a8'], 4, { g: 0.1, life: 50 });
        G.sfx('bigexplode');
        c.alive = false;
        c.visible = false;
        yield 40;
        G.sfx('fanfare');
        W.text(240, 90, 'サボテン将軍 をたおした！', { size: 15, color: '#ffe9a8' });
        yield 60;
        if (W.onBossCleared) W.onBossCleared();
      });
    };
    return c;
  };

  // ------------------------------------------------------------------
  // THE SUN
  // ------------------------------------------------------------------
  class SunBoss extends G.Boss {
    constructor(W, cx, cy) {
      super(W, cx - 38, cy - 38, 76, 76, { hp: 200, name: 'THE SUN' });
      this.r = 38;
      this.face = 'grin';
      this.cause = '太陽に触れてしまった。熱い。';
      this.dark = false;
      this.spin = 0;
    }
    hits(rect) {
      return this.hazard && G.rectCircle(rect, this.cx, this.cy, this.r - 6);
    }
    shotBox() {
      return { x: this.cx - this.r - 6, y: this.cy - this.r - 6, w: this.r * 2 + 12, h: this.r * 2 + 24 };
    }
    tick() {
      super.tick();
      this.spin += this.dark ? 0.005 : 0.02;
    }
    draw(ctx) {
      G.Render.drawSunBoss(ctx, this);
    }
  }
  G.SunBoss = SunBoss;

  G.BOSSES.sun = function (W, opts) {
    const P = W.player;
    const rng = W.rng;
    const HOMEY = 106; // 足場の上から撃った弾が届く高さ
    const s = W.add(new SunBoss(W, 240, -80));
    const phase = () => (s.hp > s.maxHp * 0.66 ? 1 : s.hp > s.maxHp * 0.33 ? 2 : 3);
    const deaths = (W.game && W.game.deaths) || 0;
    // 太陽の弾はすべて遅め（軌道は同じまま速さだけ落とす：速度×SLOW、加速度×SLOW²）
    const SLOW = 0.7;
    const fire = (x, y, r, cause) => {
      const f = W.fruit(x, y, { kind: 'fire', r, cause });
      f.bossShot = true;
      f.vel = function (vx, vy, ax, ay) {
        return G.Ent.prototype.vel.call(this, (vx || 0) * SLOW, (vy || 0) * SLOW, (ax || 0) * SLOW * SLOW, (ay || 0) * SLOW * SLOW);
      };
      return f;
    };
    function* goTo(cx, cy, d, ease) {
      s.tweenTo(cx - s.r, cy - s.r, d, ease || 'inOutQuad');
      yield d;
    }
    function* drift() {
      yield* goTo(G.clamp(P.cx + rng.range(-120, 120), 90, 390), HOMEY + rng.range(-8, 4), phase() === 3 ? 34 : 46);
    }
    // フレア：放物線の火球が床で弾ける
    function* flare() {
      s.face = 'angry';
      G.sfx('charge');
      yield 24;
      const n = [2, 3, 3][phase() - 1];
      for (let i = 0; i < n; i++) {
        const tx = G.clamp(P.cx + (i - (n - 1) / 2) * 60 + rng.range(-12, 12), 20, 460);
        const T = 48;
        const f = fire(s.cx, s.cy + 20, 9, 'フレアの直撃を受けた。');
        const g = 0.16;
        f.vel((tx - s.cx) / T, (FLOOR - 8 - (s.cy + 20) - 0.5 * g * T * T) / T, 0, g);
        f.tick = function () {
          if (this.vy > 0 && this.cy >= FLOOR - 8) {
            this.alive = false;
            G.sfx('explode');
            W.burst(this.cx, FLOOR, 10, ['#ff7a20', '#ffd84a'], 2, { up: 1.5, g: 0.15, life: 20 });
            for (let k = 0; k < 4; k++) {
              const a = -Math.PI * (0.12 + (0.76 * k) / 3);
              const b = fire(this.cx, FLOOR - 10, 4, '弾けたフレアに焼かれた。');
              b.vel(Math.cos(a) * 2.1, Math.sin(a) * 2.6, 0, 0.12);
            }
          }
        };
        G.sfx('shoot');
        yield 16;
      }
      s.face = 'grin';
      yield 60;
    }
    // 光線：細い予告線の場所に太い光が落ちる
    function* beam() {
      s.face = 'angry';
      const n = phase() === 1 ? 2 : phase() === 2 ? 3 : 4;
      const xs = [P.cx];
      for (let i = 1; i < n; i++) xs.push(rng.range(30, 450));
      for (const x of xs) W.laser(Math.round(x) - 7, 0, 14, FLOOR, { warn: 44, dur: 22, cause: '日光に焼かれた。', color: '#ffb030' });
      G.sfx('charge');
      yield 72;
      if (phase() === 3) {
        W.laser(0, 146, 480, 12, { warn: 44, dur: 22, cause: '足場の高さを焼き払われた。', color: '#ffb030' });
        G.sfx('charge');
        yield 72;
      }
      s.face = 'grin';
    }
    // コロナ：火の輪が広がる（輪ごとに隙間の位置がずれる）
    function* corona() {
      yield* goTo(240, HOMEY, 30);
      const rings = phase() === 3 ? 3 : 2;
      for (let w = 0; w < rings; w++) {
        s.face = 'rage';
        G.sfx('charge');
        yield 20;
        const n = 12,
          off = (w % 2) * (Math.PI / n);
        for (let i = 0; i < n; i++) {
          const a = off + (i / n) * Math.PI * 2;
          const f = fire(s.cx + Math.cos(a) * 30, s.cy + Math.sin(a) * 30, 5, 'コロナの輪をくぐれなかった。');
          f.vel(Math.cos(a) * 1.7, Math.sin(a) * 1.7);
        }
        G.sfx('explode');
        yield 34;
      }
      s.face = 'grin';
      yield 30;
    }
    // 太陽の渦：何本もの腕が回転しながら火の玉をまき散らす
    function* spiral() {
      yield* goTo(240, HOMEY - 6, 30);
      s.face = 'rage';
      G.sfx('roar');
      yield 26;
      const arms = phase() === 3 ? 3 : 2;
      const dirSpin = rng.chance(0.5) ? 1 : -1;
      let a = rng.range(0, 6.28);
      for (let t = 0; t < 160; t++) {
        if (t % 9 === 0) {
          for (let k = 0; k < arms; k++) {
            const ang = a + (k / arms) * Math.PI * 2;
            const f = fire(s.cx + Math.cos(ang) * 30, s.cy + Math.sin(ang) * 30, 4, '太陽の渦に巻きこまれた。');
            f.vel(Math.cos(ang) * 1.8, Math.sin(ang) * 1.8);
          }
          if (t % 18 === 0) G.sfx('shoot');
        }
        a += 0.075 * dirSpin;
        yield 1;
      }
      s.face = 'grin';
      yield 30;
    }
    // 太陽風：こちらを狙った扇状の火の玉を連射
    function* wind() {
      s.face = 'angry';
      G.sfx('charge');
      yield 20;
      const volleys = phase() === 3 ? 4 : 3;
      for (let v = 0; v < volleys; v++) {
        const a0 = Math.atan2(P.cy - s.cy, P.cx - s.cx);
        const n = v % 2 ? 4 : 5;
        for (let i = 0; i < n; i++) {
          const a = a0 + (i - (n - 1) / 2) * 0.2;
          const f = fire(s.cx + Math.cos(a) * 34, s.cy + Math.sin(a) * 34, 4, '太陽風に吹き飛ばされた。');
          f.vel(Math.cos(a) * 2.6, Math.sin(a) * 2.6);
        }
        G.sfx('shoot');
        yield 20;
      }
      s.face = 'grin';
      yield 30;
    }
    // 熱波：床にマグマがせり上がる。足場の上で狙い撃ちをかわす
    function* heat() {
      yield* goTo(240, 60, 30);
      W.say('ほら、熱くなってきただろう？', 0, 0, 70, { follow: s, dy: -4 });
      G.sfx('rumble');
      W.shake = 20;
      const lava = W.lava(300, { speed: 0, cause: '床が焼けていた。', minY: 0 });
      lava.bossShot = true;
      for (let i = 0; i < 80; i++) {
        lava.y = 300 - (i / 80) * 88; // 212 まで
        yield 1;
      }
      for (let k = 0; k < (phase() === 3 ? 3 : 3); k++) {
        yield 26;
        const a0 = Math.atan2(P.cy - s.cy, P.cx - s.cx);
        for (const da of [-0.18, 0.18]) {
          const f = fire(s.cx, s.cy, 5, '狙い撃ちの火球に焼かれた。');
          f.vel(Math.cos(a0 + da) * 3, Math.sin(a0 + da) * 3);
        }
        G.sfx('shoot');
      }
      yield 50;
      for (let i = 0; i < 60; i++) {
        lava.y = 212 + (i / 60) * 90;
        yield 1;
      }
      lava.alive = false;
    }
    // 日食：暗闇の中で狙い撃ち（後半）
    function* eclipse() {
      yield* goTo(240, HOMEY, 30);
      W.say('日食の時間だ。', 0, 0, 60, { follow: s, dy: -4 });
      yield 40;
      s.dark = true;
      for (let i = 0; i < 20; i++) {
        W.dark = (i / 20) * 0.6;
        yield 1;
      }
      // 暗闇の中でゆっくり回る火の輪
      W.run(function* () {
        let a = 0;
        for (let t = 0; t < 200 && s.dark && !s.defeated; t++) {
          if (t % 30 === 0) {
            for (let k = 0; k < 6; k++) {
              const ang = a + (k / 8) * Math.PI * 2;
              const f = fire(s.cx, s.cy, 4, '暗闇の火の輪にふれた。');
              f.vel(Math.cos(ang) * 1.3, Math.sin(ang) * 1.3);
              f.layer = 9;
            }
            a += 0.2;
          }
          yield 1;
        }
      });
      for (let k = 0; k < 5; k++) {
        G.sfx('warn');
        yield 26;
        const dx = P.cx - s.cx,
          dy = P.cy - s.cy;
        const d = Math.hypot(dx, dy) || 1;
        const f = fire(s.cx, s.cy, 6, '暗闇から火球が飛んできた。');
        f.vel((dx / d) * 3.6, (dy / d) * 3.6);
        f.layer = 9;
        G.sfx('shoot');
        yield 14;
      }
      yield 30;
      for (let i = 0; i < 20; i++) {
        W.dark = 0.6 * (1 - i / 20);
        yield 1;
      }
      W.dark = 0;
      s.dark = false;
    }
    // 最後のあがき：地面に降りて転がる
    function* desperation() {
      s.vulnerable = false;
      s.face = 'rage';
      W.shake = 40;
      G.sfx('roar');
      W.say('沈んでなるものかぁぁ！', 0, 0, 80, { follow: s, dy: -4 });
      yield 70;
      s.vulnerable = true;
      for (let k = 0; k < 2; k++) {
        const from = P.cx < 240 ? 1 : -1; // プレイヤーと反対側から
        yield* goTo(from > 0 ? SW + 60 : -60, FLOOR - s.r, 30, 'inQuad');
        W.say('！', from > 0 ? 450 : 30, 200, 40, { plain: true, size: 16, color: '#ff3a5a' });
        G.sfx('warn');
        yield 40;
        s.vel(-from * 3.4, 0);
        G.sfx('rumble');
        yield () => (from > 0 ? s.cx < -60 : s.cx > SW + 60);
        s.stop();
      }
      yield* goTo(240, HOMEY, 50, 'outQuad');
      s.face = 'grin';
    }

    W.run(function* () {
      const quick = opts.respawn && W.game && W.game.flags.sunSeen;
      yield () => P.alive && P.onGround && P.cx > 60;
      W.closeGate && W.closeGate();
      G.music(null);
      s.face = 'calm';
      yield* goTo(240, HOMEY, quick ? 40 : 90, 'outQuad');
      if (!quick) {
        W.say('よくも月を消してくれたな。', 0, 0, 90, { follow: s, dy: -4 });
        yield 90;
        W.say(`${deaths} 回も死んでまだ懲りないか。`, 0, 0, 90, { follow: s, dy: -4 });
        yield 90;
        s.face = 'grin';
        W.say('この太陽が、焼きつくしてくれる！', 0, 0, 90, { follow: s, dy: -4 });
        yield 80;
      } else {
        s.face = 'grin';
        W.say(`おかえり。${deaths} 回目だな。`, 0, 0, 60, { follow: s, dy: -4 });
        yield 50;
      }
      if (W.game) W.game.flags.sunSeen = true;
      G.sfx('roar');
      W.shake = 30;
      G.music('final');
      s.showBar = true;
      s.hazard = true;
      s.vulnerable = true;
      W.autoFire = true;
      if (W.easy) W.lives = 3;
      let lastPhase = 1,
        desp = false,
        last = '';
      for (;;) {
        const ph = phase();
        if (ph !== lastPhase) {
          lastPhase = ph;
          G.sfx('roar');
          W.shake = 24;
          W.flash = 8;
          W.flashColor = '#ffd84a';
          W.say(ph === 2 ? 'ぐぬぬ、熱くなってきた！' : '本気の太陽を見せてやる！', 0, 0, 70, { follow: s, dy: -4 });
          yield* goTo(240, HOMEY, 40);
          yield 20;
        }
        if (!desp && s.hp < s.maxHp * 0.1) {
          desp = true;
          yield* desperation();
          continue;
        }
        const pool = ph === 1 ? ['flare', 'beam', 'corona', 'spiral'] : ph === 2 ? ['flare', 'beam', 'corona', 'heat', 'spiral', 'wind'] : ['flare', 'beam', 'corona', 'heat', 'eclipse', 'spiral', 'wind'];
        let p;
        do p = rng.pick(pool);
        while (p === last);
        last = p;
        if (p === 'spiral') yield* spiral();
        else if (p === 'wind') yield* wind();
        else if (p === 'flare') yield* flare();
        else if (p === 'beam') yield* beam();
        else if (p === 'corona') yield* corona();
        else if (p === 'heat') yield* heat();
        else yield* eclipse();
        yield* drift();
        yield ph === 1 ? 22 : 12;
      }
    }, s.ai);

    s.onDefeat = () => {
      G.music(null);
      W.autoFire = false;
      W.god = true;
      W.lives = null;
      W.invuln = 0;
      W.dark = 0;
      s.dark = false;
      clearShots(W, s);
      for (const e of W.ents) if (e instanceof G.Lava) e.alive = false;
      W.run(function* () {
        s.face = 'hurt';
        s.tweenTo(240 - s.r, 110 - s.r, 30, 'outQuad');
        yield 30;
        for (let i = 0; i < 80; i++) {
          s.shakeX = i % 2 ? 3 : -3;
          if (i % 8 === 0) {
            W.burst(s.cx + rng.range(-30, 30), s.cy + rng.range(-30, 30), 16, ['#ffd84a', '#ff7a20', '#ffffff'], 3, { g: 0.05 });
            G.sfx('explode');
          }
          yield 1;
        }
        s.shakeX = 0;
        s.showBar = false;
        // 日が沈む
        s.tweenTo(240 - s.r, FLOOR + 40, 120, 'inQuad');
        W.flash = 20;
        W.flashColor = '#ff9a4a';
        yield 120;
        s.alive = false;
        s.visible = false;
        markDead(W, 'sunDead', 2, 11);
        W.god = !!G.god;
        yield 30;
        yield* aftermath(W);
      });
    };
    return s;
  };

  // 太陽を倒した後：沈んだはずの太陽が反対側から転がってくる（リトライ後も同じ）
  function* aftermath(W) {
    const P = W.player;
    G.sfx('fanfare');
    W.text(240, 80, 'THE SUN をたおした！', { size: 16, color: '#ffe9a8' });
    W.text(240, 104, '日が、沈んだ。', { size: 11, color: '#ffe0c0' });
    yield 110;
    const from = P.cx < 240 ? 1 : -1;
    const r = 22;
    const sun = W.add(new G.Moon(W, from > 0 ? SW + 40 : -40, FLOOR - r, { r, keep: true, cause: '日はまた昇る。そして転がる。' }));
    sun.sunny = true;
    sun.face = 'grin';
    W.say('おはよう', from > 0 ? 440 : 40, 190, 50, {});
    G.sfx('rumble');
    yield 16;
    sun.vel(-from * 3.6, 0);
    sun.offscreenKill = 80;
    yield () => !P.alive || !sun.alive;
    if (!P.alive) return;
    yield 40;
    if (W.game && W.game.stageClear) W.game.stageClear();
  }
  G.BOSSES.sunAftermath = aftermath;
  // ------------------------------------------------------------------
  // ブラックホール（3面中ボス）：プレイヤーも弾も吸い寄せる
  // ------------------------------------------------------------------
  class BlackHole extends G.Boss {
    constructor(W, cx, cy) {
      super(W, cx - 22, cy - 22, 44, 44, { hp: 140, name: 'ブラックホール' });
      this.r = 22;
      this.size = 0.15;
      this.spin = 0;
      this.cause = '吸い込まれた。スパゲッティになった。';
    }
    hits(rect) {
      return this.hazard && G.rectCircle(rect, this.cx, this.cy, this.r * this.size - 4);
    }
    shotBox() {
      const r = this.r * this.size + 6;
      return { x: this.cx - r, y: this.cy - r, w: r * 2, h: r * 2 };
    }
    tick() {
      super.tick();
      this.spin += 0.05;
      // 弾も吸い寄せられて曲がる
      if (this.vulnerable)
        for (const b of this.W.bullets) {
          if (b.hostile) continue;
          const dx = this.cx - b.x,
            dy = this.cy - b.y;
          const d = Math.hypot(dx, dy) || 1;
          // 近いほど強く曲がる（周回せずに吸いこまれる）
          const k = 0.45 + 40 / d;
          b.vx += (dx / d) * k;
          b.vy += (dy / d) * k;
          const v = Math.hypot(b.vx, b.vy) || 1;
          b.vx *= 6 / v;
          b.vy *= 6 / v;
          // 後ろ向きに撃った弾もしばらくは戻ってこられるように（ただし永遠には回らない）
          b.bhT = (b.bhT || 0) + 1;
          if (b.bhT < 90) b.life = Math.max(b.life, 8);
        }
    }
    draw(ctx) {
      G.Render.drawBlackHole(ctx, this);
    }
  }
  G.BlackHole = BlackHole;

  G.BOSSES.blackhole = function (W, opts) {
    const P = W.player;
    const rng = W.rng;
    const h = W.add(new BlackHole(W, 240, 120));
    let pullBase = 0;
    const phase2 = () => h.hp < h.maxHp / 2;
    W.windAir = false;
    W.onStep = () => {
      // 中心からの距離が近いほど強く吸い寄せる
      if (!pullBase || !P.alive) {
        W.windX = 0;
        return;
      }
      const dx = h.cx - P.cx;
      const d = Math.max(30, Math.hypot(dx, h.cy - P.cy));
      W.windX = Math.sign(dx) * pullBase * G.clamp(140 / d, 0.5, 1.6);
    };
    const debris = (x, y, vx, vy, kind, cause) => {
      const f = W.fruit(x, y, { kind: kind || 'rock', r: 5, cause: cause || '宇宙のゴミが当たった。' });
      f.vel(vx, vy);
      f.bossShot = true;
      return f;
    };
    // 渦を巻いて飛び出すゴミ
    function* spiral() {
      G.sfx('charge');
      yield 20;
      let a = rng.range(0, 6.28);
      const arms = phase2() ? 4 : 3;
      for (let t = 0; t < 150; t++) {
        if (t % 6 === 0) {
          for (let k = 0; k < arms; k++) {
            const ang = a + (k / arms) * Math.PI * 2;
            debris(h.cx + Math.cos(ang) * 16, h.cy + Math.sin(ang) * 16, Math.cos(ang) * 1.6, Math.sin(ang) * 1.6);
          }
        }
        a += 0.06;
        yield 1;
      }
      yield 30;
    }
    // 強く吸い込む。画面の端から星が中心へ飛んでくる
    function* inhale() {
      W.say('スゥゥゥ……', 0, 0, 50, { follow: h, dy: -12 });
      G.sfx('rumble');
      pullBase = phase2() ? 1.0 : 0.9;
      for (let t = 0; t < 130; t++) {
        if (t % 11 === 0) {
          const side = rng.chance(0.5) ? -1 : 1;
          const y = rng.range(150, 236);
          const x = side < 0 ? -8 : 488;
          const dx = h.cx - x,
            dy = h.cy - y;
          const d = Math.hypot(dx, dy);
          debris(x, y, (dx / d) * 2.2, (dy / d) * 2.2, 'star', '吸い込まれる星にぶつかった。');
        }
        yield 1;
      }
      pullBase = 0.55;
      yield 30;
    }
    // 吐き出し：星の輪（輪ごとに隙間がずれる）
    function* exhale() {
      for (let w = 0; w < (phase2() ? 4 : 3); w++) {
        h.size = 1.25;
        G.sfx('charge');
        yield 18;
        h.size = 1;
        const n = 16,
          off = (w % 2) * (Math.PI / n);
        for (let i = 0; i < n; i++) {
          const a = off + (i / n) * Math.PI * 2;
          debris(h.cx, h.cy, Math.cos(a) * 1.8, Math.sin(a) * 1.8, 'star', '吐き出された星に当たった。');
        }
        G.sfx('explode');
        yield 40;
      }
    }
    // 降着円盤：周りを回る星の輪が広がり、一斉に飛び散る
    function* disk() {
      G.sfx('charge');
      const n = phase2() ? 18 : 14;
      const ring = [];
      for (let i = 0; i < n; i++) {
        const f = W.fruit(h.cx, h.cy, { kind: 'star', r: 4, keep: true, cause: '降着円盤に巻きこまれた。' });
        f.bossShot = true;
        ring.push(f);
      }
      let a = 0;
      for (let t = 0; t < 90; t++) {
        a += 0.05;
        const rad = 20 + t * 0.9;
        ring.forEach((f, i) => {
          const ang = a + (i / n) * Math.PI * 2;
          f.x = h.cx + Math.cos(ang) * rad - f.r;
          f.y = h.cy + Math.sin(ang) * rad * 0.8 - f.r;
        });
        yield 1;
      }
      G.sfx('explode');
      ring.forEach((f, i) => {
        const ang = a + (i / n) * Math.PI * 2;
        // 接線方向へ飛ばす
        f.vel(Math.cos(ang + Math.PI / 2) * 1.6 + Math.cos(ang) * 0.8, Math.sin(ang + Math.PI / 2) * 1.6 + Math.sin(ang) * 0.8);
        f.offscreenKill = 60;
      });
      yield 50;
    }
    // ジェット：中心から反対向きの2本の流れが回転しながら噴き出す（後半）
    function* jets() {
      W.say('ゴォォォ！', 0, 0, 40, { follow: h, dy: -14 });
      G.sfx('roar');
      yield 24;
      let a = rng.range(0, 6.28);
      const spin = rng.chance(0.5) ? 0.022 : -0.022;
      for (let t = 0; t < 160; t++) {
        if (t % 4 === 0) {
          for (const d of [0, Math.PI]) {
            const ang = a + d;
            debris(h.cx + Math.cos(ang) * 14, h.cy + Math.sin(ang) * 14, Math.cos(ang) * 2.6, Math.sin(ang) * 2.6, 'star', 'ジェットの直撃を受けた。');
          }
        }
        a += spin;
        yield 1;
      }
      yield 30;
    }
    // 後半：ゆっくり横に動く
    function* drift() {
      const tx = G.clamp(P.cx < 240 ? rng.range(260, 340) : rng.range(140, 220), 140, 340);
      h.tweenTo(tx - h.r, h.y, 80, 'inOutQuad');
      yield 80;
    }

    W.run(function* () {
      const quick = opts.respawn && W.game && W.game.flags.holeSeen;
      yield () => P.alive && P.onGround && P.cx > 70;
      W.closeGate && W.closeGate();
      G.music(null);
      G.sfx('rumble');
      for (let i = 0; i <= 50; i++) {
        h.size = 0.15 + (i / 50) * 0.85;
        yield 1;
      }
      if (!quick) {
        W.say('……ゴゴゴ……', 0, 0, 60, { follow: h, dy: -14 });
        yield 60;
        W.say('すべてを吸いこむ。\n月も、太陽も、おまえも。', 0, 0, 100, { follow: h, dy: -14 });
        yield 90;
      }
      if (W.game) W.game.flags.holeSeen = true;
      G.music('boss');
      h.showBar = true;
      h.hazard = true;
      h.vulnerable = true;
      W.autoFire = true;
      pullBase = 0.55;
      if (W.easy) W.lives = 3;
      let last = '';
      for (;;) {
        const pool = phase2() ? ['spiral', 'inhale', 'exhale', 'drift', 'disk', 'jets'] : ['spiral', 'inhale', 'exhale', 'disk'];
        let p;
        do p = rng.pick(pool);
        while (p === last);
        last = p;
        if (p === 'disk') yield* disk();
        else if (p === 'jets') yield* jets();
        else if (p === 'spiral') yield* spiral();
        else if (p === 'inhale') yield* inhale();
        else if (p === 'exhale') yield* exhale();
        else yield* drift();
        yield phase2() ? 10 : 18;
      }
    }, h.ai);

    h.onDefeat = () => {
      G.music(null);
      W.autoFire = false;
      W.lives = null;
      W.invuln = 0;
      pullBase = 0;
      W.windX = 0;
      clearShots(W, h);
      markDead(W, 'holeDead', 2, 11);
      W.run(function* () {
        for (let i = 0; i < 50; i++) {
          h.size = Math.max(0.1, 1 - i / 50);
          h.shakeX = i % 2 ? 2 : -2;
          yield 1;
        }
        h.showBar = false;
        W.say('……ゲプッ', h.cx, h.cy - 14, 50, {});
        yield 50;
        // ホワイトホール：今まで吸いこんだ物を全部吐き出す
        W.flash = 16;
        W.flashColor = '#ffffff';
        W.shake = 30;
        G.sfx('bigexplode');
        W.text(240, 60, 'ホワイトホール！', { size: 16, color: '#ffffff' });
        h.white = true;
        const items = [
          ['moon', 16, '吐き出された月に当たった。'], ['sun', 14, '吐き出された太陽に当たった。'], ['cherry', 10, 'デリシャス・キングのかけらに当たった。'],
          ['cherry', 6, '吐き出されたリンゴに当たった。'], ['cherry', 6, '吐き出されたリンゴに当たった。'], ['rock', 8, '吐き出された岩に当たった。'],
          ['needle', 4, '吐き出されたサボテンの針。'], ['cherry', 6, '吐き出されたリンゴに当たった。'],
        ];
        for (let i = 0; i < items.length; i++) {
          const [k, r, cause] = items[i];
          const a = -Math.PI / 2 + (i - (items.length - 1) / 2) * 0.36;
          let e;
          if (k === 'moon' || k === 'sun') {
            e = W.add(new G.Moon(W, h.cx, h.cy, { r, cause, face: k === 'moon' ? 'grin' : 'shock' }));
            e.sunny = k === 'sun';
            e.offscreenKill = 80;
          } else e = W.fruit(h.cx, h.cy, { kind: k, r, cause });
          if (k === 'moon') {
            // 月だけはこちらを狙って落ちてくる
            const T = 50;
            e.cause = 'ホワイトホールから月が出てきた。まだ生きていた。';
            e.vel((P.cx - h.cx) / T, (240 - r - h.cy - 0.5 * 0.12 * T * T) / T, 0, 0.12);
          } else e.vel(Math.cos(a) * 2.6, Math.sin(a) * 2.6 - 1, 0, 0.12);
          yield 6;
        }
        yield 150;
        h.alive = false;
        h.visible = false;
        G.sfx('fanfare');
        W.text(240, 90, 'ブラックホール をたおした！', { size: 15, color: '#ffe9a8' });
        yield 60;
        if (W.onBossCleared) W.onBossCleared();
      });
    };
    return h;
  };

  // ------------------------------------------------------------------
  // ニュートンの樹（ラスボス）：重力を操る
  // ------------------------------------------------------------------
  class TreeBoss extends G.Boss {
    constructor(W, cx) {
      super(W, cx - 55, 30, 110, 210, { hp: 250, name: 'ニュートンの樹' });
      this.face = 'calm';
      this.sway = 0;
      this.rot = 0;
      this.cause = 'ニュートンの樹にぶつかった。';
      this.layer = 1;
    }
    trunk() {
      return { x: this.cx - 18, y: this.y + 80, w: 36, h: this.h - 80 };
    }
    hits(rect) {
      return this.hazard && G.overlap(rect, this.trunk());
    }
    shotBox() {
      const t = this.trunk();
      return { x: t.x - 8, y: t.y - 10, w: t.w + 16, h: t.h + 10 };
    }
    tick() {
      super.tick();
      this.sway += 0.03;
    }
    draw(ctx) {
      G.Render.drawTreeBoss(ctx, this);
    }
  }
  G.TreeBoss = TreeBoss;

  G.BOSSES.tree = function (W, opts) {
    const P = W.player;
    const rng = W.rng;
    const t = W.add(new TreeBoss(W, 418));
    const phase = () => (t.hp > t.maxHp * 0.66 ? 1 : t.hp > t.maxHp * 0.33 ? 2 : 3);
    const deaths = (W.game && W.game.deaths) || 0;
    const apple = (x, y, r, cause) => {
      const f = W.fruit(x, y, { r: r || 6, cause: cause || 'ニュートンのリンゴが落ちてきた。' });
      f.bossShot = true;
      return f;
    };
    // リンゴの雨（重力の向きに落ちる）
    function* rain() {
      t.face = 'grin';
      const n = [10, 13, 16][phase() - 1];
      const xs = [];
      for (let i = 0; i < n; i++) xs.push(rng.range(24, 380));
      const g = W.gravity;
      const marks = xs.map((x) => W.text(x, g > 0 ? 30 : 250, g > 0 ? '▼' : '▲', { size: 9, color: '#ff6a8a' }));
      G.sfx('warn');
      yield 36;
      marks.forEach((m) => (m.alive = false));
      for (let i = 0; i < n; i++) {
        const a = apple(xs[i], g > 0 ? -8 : 288);
        a.vel(0, g * 1.5, 0, g * 0.12);
        a.maxV = 5;
        if (i % 2) yield 6;
      }
      yield 40;
    }
    // 根っこの波（床か天井を走る）
    function* roots() {
      t.face = 'angry';
      W.shake = 14;
      G.sfx('rumble');
      yield 26;
      const g = W.gravity;
      for (let tx = 18; tx >= 1; tx--) {
        const s = W.spike(tx, g > 0 ? 11 : 1, g > 0 ? 'u' : 'd', { hidden: true, cause: '根っこにつまずいた。', pal: 'dark' });
        s.bossShot = true;
        s.pop(3, false);
        W.after(22, () => (s.alive = false));
        if (tx % 2 === 0) G.sfx('pop');
        yield phase() === 3 ? 4 : 5;
      }
      t.face = 'calm';
      yield 30;
    }
    // 葉っぱの嵐：左向きの風と葉っぱ
    function* leaves() {
      t.face = 'grin';
      W.say('葉っぱカッター！', 0, 0, 50, { follow: t, dy: -6 });
      W.windX = -0.7;
      for (let k = 0; k < 150; k++) {
        if (k % 7 === 0) {
          const y = rng.range(30, 236);
          const lf = W.fruit(480, y, { kind: 'leaf', r: 4, cause: '葉っぱで切れた。' });
          lf.base = y;
          lf.vel(-2.6, 0);
          lf.bossShot = true;
          lf.tick = function () {
            this.y = this.base + Math.sin(this.t * 0.12) * 10 - this.r;
          };
        }
        yield 1;
      }
      W.windX = 0;
      yield 30;
    }
    // 果実の扇：枝からこちらを狙って扇状にリンゴを投げる
    function* fan() {
      t.face = 'grin';
      for (let v = 0; v < (phase() === 3 ? 4 : 3); v++) {
        G.sfx('charge');
        yield 18;
        const sx = t.cx - 50,
          sy = t.y + 50;
        const a0 = Math.atan2(P.cy - sy, P.cx - sx);
        const n = 9;
        for (let i = 0; i < n; i++) {
          const a = a0 + (i - (n - 1) / 2) * 0.13;
          const f = apple(sx, sy, 5, '扇状のリンゴに当たった。');
          f.vel(Math.cos(a) * 3, Math.sin(a) * 3 - 0.6, 0, 0.03 * W.gravity);
        }
        G.sfx('shoot');
        yield 26;
      }
      t.face = 'calm';
      yield 20;
    }
    // 種マシンガン：狙い撃ちの種を連射
    function* seeds() {
      t.face = 'angry';
      W.say('タネマシンガン！', 0, 0, 40, { follow: t, dy: -6 });
      yield 24;
      for (let k = 0; k < (phase() === 3 ? 36 : 26); k++) {
        const sx = t.cx - 20,
          sy = t.y + 110;
        const a = Math.atan2(P.cy - sy, P.cx - sx) + rng.range(-0.12, 0.12);
        const f = W.fruit(sx, sy, { kind: 'seed', r: 3, cause: '種マシンガンに撃ち抜かれた。' });
        f.vel(Math.cos(a) * 3.4, Math.sin(a) * 3.4);
        f.bossShot = true;
        if (k % 3 === 0) G.sfx('shoot');
        yield 4;
      }
      t.face = 'calm';
      yield 30;
    }
    // 引力反転：しばらく上下がさかさまになる
    function* flip() {
      W.say('引力、反転！', 0, 0, 60, { follow: t, dy: -6 });
      G.sfx('charge');
      W.flash = 6;
      W.flashColor = '#c58cff';
      yield 40;
      W.gravity = -1;
      P.vy *= 0.3;
      P.djump = true;
      G.sfx('flip');
      yield 40;
      yield* rain();
      yield* roots();
      if (phase() === 3) yield* seeds();
      W.say('……戻れ！', 0, 0, 40, { follow: t, dy: -6 });
      G.sfx('charge');
      yield 30;
      W.gravity = 1;
      P.vy *= 0.3;
      P.djump = true;
      G.sfx('flip');
      yield 40;
    }
    // 大きなリンゴが転がってくる（後半）
    function* bigApple() {
      t.face = 'rage';
      G.sfx('warn');
      yield 24;
      for (let k = 0; k < 2; k++) {
        const a = apple(t.cx - 40, 240 - 20, 20, '大きなリンゴに轢かれた。');
        a.vel(-3 - k * 0.6, 0);
        a.offscreenKill = 60;
        G.sfx('rumble');
        // 転がりながら小さなリンゴを撒く
        a.tick = function () {
          G.Fruit.prototype.tick.call(this);
          if (this.t % 20 === 0) {
            const b = apple(this.cx, this.cy - 16, 4, '大きなリンゴから小さなリンゴ。');
            b.vel(0.4, -3.2, 0, 0.14);
          }
        };
        yield 70;
      }
      yield 30;
      t.face = 'calm';
    }
    // 最後のあがき：根ごと跳んでくる
    function* desperation() {
      t.vulnerable = false;
      t.face = 'rage';
      W.say('リンゴは……落ちるものだ！', 0, 0, 80, { follow: t, dy: -6 });
      W.shake = 30;
      G.sfx('roar');
      yield 60;
      t.vulnerable = true;
      for (let k = 0; k < 2; k++) {
        const tx = k === 0 ? 220 : 418;
        const dur = 56;
        t.vel((tx - t.cx) / dur, -5.6, 0, 0.2);
        G.sfx('boing');
        yield () => t.vy > 0 && t.y + t.h >= 240;
        t.stop();
        t.y = 240 - t.h;
        W.shake = 20;
        G.sfx('stomp');
        for (const d of [-1, 1]) {
          const wv = W.hbox(t.cx + d * 30 - 6, 230, 12, 10, { kind: 'wave', cause: '樹の着地に足をすくわれた。' });
          wv.vel(d * 2.6, 0);
        }
        yield 60;
      }
      t.face = 'calm';
    }

    W.run(function* () {
      const quick = opts.respawn && W.game && W.game.flags.treeSeen;
      yield () => P.alive && P.onGround && P.y + P.h <= 240;
      W.sealFloor && W.sealFloor();
      G.music(null);
      if (!quick) {
        W.say('よくぞ来た。わしがニュートンの樹じゃ。', 0, 0, 100, { follow: t, dy: -6 });
        yield 100;
        W.say(`ここまでに ${deaths} 回、リンゴやトゲに倒れたな。`, 0, 0, 100, { follow: t, dy: -6 });
        yield 100;
        t.face = 'grin';
        W.say('すべてのリンゴは、わしから落ちる。\n最後のリンゴを受けてみよ！', 0, 0, 110, { follow: t, dy: -6 });
        yield 100;
      } else {
        t.face = 'grin';
        W.say(`また落ちてきたか。${deaths} 回目じゃ。`, 0, 0, 60, { follow: t, dy: -6 });
        yield 50;
      }
      if (W.game) W.game.flags.treeSeen = true;
      G.sfx('roar');
      W.shake = 30;
      G.music('last');
      t.showBar = true;
      t.hazard = true;
      t.vulnerable = true;
      W.autoFire = true;
      if (W.easy) W.lives = 3;
      let lastPhase = 1,
        desp = false,
        last = '';
      for (;;) {
        const ph = phase();
        if (ph !== lastPhase) {
          lastPhase = ph;
          G.sfx('roar');
          W.shake = 24;
          W.flash = 8;
          W.flashColor = '#c0ff90';
          W.say(ph === 2 ? 'ほう、やるのう。' : '万有引力の本気を見せてやろう！', 0, 0, 70, { follow: t, dy: -6 });
          yield 60;
        }
        if (!desp && t.hp < t.maxHp * 0.1) {
          desp = true;
          yield* desperation();
          continue;
        }
        const pool = ph === 1 ? ['rain', 'roots', 'leaves', 'fan'] : ph === 2 ? ['rain', 'roots', 'leaves', 'flip', 'fan', 'seeds'] : ['rain', 'roots', 'flip', 'big', 'leaves', 'fan', 'seeds'];
        let p;
        do p = rng.pick(pool);
        while (p === last);
        last = p;
        if (p === 'fan') yield* fan();
        else if (p === 'seeds') yield* seeds();
        else if (p === 'rain') yield* rain();
        else if (p === 'roots') yield* roots();
        else if (p === 'leaves') yield* leaves();
        else if (p === 'flip') yield* flip();
        else yield* bigApple();
        yield ph === 1 ? 16 : 10;
      }
    }, t.ai);

    t.onDefeat = () => {
      G.music(null);
      W.autoFire = false;
      W.god = true;
      W.lives = null;
      W.invuln = 0;
      W.windX = 0;
      W.gravity = 1;
      clearShots(W, t);
      W.run(function* () {
        t.face = 'hurt';
        for (let i = 0; i < 80; i++) {
          t.shakeX = i % 2 ? 2 : -2;
          if (i % 8 === 0) {
            W.burst(t.cx + rng.range(-40, 40), t.y + rng.range(10, 100), 16, ['#3a8a3a', '#7ad05a', '#ff3355'], 2.5, { g: 0.08 });
            G.sfx('explode');
          }
          yield 1;
        }
        t.shakeX = 0;
        t.showBar = false;
        W.say('見事じゃ……', 0, 0, 60, { follow: t, dy: -6 });
        yield 50;
        // 樹が倒れる
        for (let i = 1; i <= 40; i++) {
          t.rot = (i / 40) * (Math.PI / 2) * (i / 40);
          yield 1;
        }
        W.shake = 30;
        G.sfx('bigexplode');
        W.burst(t.cx + 60, 236, 80, ['#3a8a3a', '#7ad05a', '#8a5a2a', '#ff3355'], 4, { up: 2, g: 0.12, life: 60 });
        yield 60;
        // 最後のリンゴが頭に落ちてきて……
        const last = W.fruit(P.cx, -10, { r: 6, kind: 'gold', keep: true });
        last.hazard = false;
        last.vel(0, 2, 0, 0.15);
        yield () => last.cy >= P.y - 4;
        last.vel(P.face > 0 ? -1.4 : 1.4, -3, 0, 0.2);
        G.sfx('bonk');
        W.say('コツン', P.cx, P.y - 6, 50, { plain: true, size: 10, color: '#ffffff' });
        yield 50;
        W.say('ひらめいた！', P.cx, P.y - 10, 90, {});
        G.sfx('fanfare');
        W.text(240, 80, 'ニュートンの樹 をたおした！', { size: 15, color: '#ffe9a8' });
        W.text(240, 104, 'リンゴは、下に落ちるものだった。', { size: 11, color: '#e8e2ff' });
        if (W.game) W.game.flags.treeDead = true;
        yield 220;
        if (W.game && W.game.stageClear) W.game.stageClear();
      });
    };
    return t;
  };
})();
