// 2面・3面のボス：サボテン将軍（2面中ボス） / THE SUN（2面ボス）
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
      super(W, cx - 18, FLOOR - 76, 36, 76, { hp: 70, name: 'サボテン将軍' });
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
      const n = phase2() ? 11 : 8;
      for (let i = 0; i < n; i++) {
        const vx = -2.6 + (5.2 * i) / (n - 1) + rng.range(-0.25, 0.25);
        needle(c.cx, c.y + 6, vx, -5.2 - rng.range(0, 1), 0.15, '針の雨に打たれた。');
      }
      G.sfx('explode');
      yield 20;
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
        for (let k = 0; k < 2; k++) needle(c.cx + dir * (20 + k * 10), y, dir * 3.6, 0, 0, kind === 'low' ? '足もとの針を跳べなかった。' : '高い針に跳びこんだ。');
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
      for (let w = 0; w < 2; w++) {
        c.bloom = 1;
        G.sfx('charge');
        yield 30;
        const n = 12,
          off = w * (Math.PI / 12) + rng.range(0, 0.3);
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
        const pool = phase2() ? ['rain', 'volley', 'wave', 'leap', 'bloom'] : ['rain', 'volley', 'wave', 'leap'];
        let p;
        do p = rng.pick(pool);
        while (p === last);
        last = p;
        if (p === 'rain') yield* rain();
        else if (p === 'volley') yield* volley();
        else if (p === 'wave') yield* wave();
        else if (p === 'leap') yield* leap();
        else yield* bloom();
        yield phase2() ? 16 : 26;
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
      super(W, cx - 38, cy - 38, 76, 76, { hp: 180, name: 'THE SUN' });
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
    const fire = (x, y, r, cause) => {
      const f = W.fruit(x, y, { kind: 'fire', r, cause });
      f.bossShot = true;
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
      const n = phase() === 1 ? 2 : 3;
      for (let i = 0; i < n; i++) {
        const tx = G.clamp(P.cx + (i - (n - 1) / 2) * 70 + rng.range(-12, 12), 20, 460);
        const T = 48;
        const f = fire(s.cx, s.cy + 20, 9, 'フレアの直撃を受けた。');
        const g = 0.16;
        f.vel((tx - s.cx) / T, (FLOOR - 8 - (s.cy + 20) - 0.5 * g * T * T) / T, 0, g);
        f.tick = function () {
          if (this.vy > 0 && this.cy >= FLOOR - 8) {
            this.alive = false;
            G.sfx('explode');
            W.burst(this.cx, FLOOR, 10, ['#ff7a20', '#ffd84a'], 2, { up: 1.5, g: 0.15, life: 20 });
            for (let k = 0; k < 5; k++) {
              const a = -Math.PI * (0.15 + (0.7 * k) / 4);
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
      const rings = phase() === 3 ? 4 : 3;
      for (let w = 0; w < rings; w++) {
        s.face = 'rage';
        G.sfx('charge');
        yield 22;
        const n = 14,
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
      for (let k = 0; k < (phase() === 3 ? 4 : 3); k++) {
        yield 30;
        const dx = P.cx - s.cx,
          dy = P.cy - s.cy;
        const d = Math.hypot(dx, dy) || 1;
        const f = fire(s.cx, s.cy, 6, '狙い撃ちの火球に焼かれた。');
        f.vel((dx / d) * 3.2, (dy / d) * 3.2);
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
        const pool = ph === 1 ? ['flare', 'beam', 'corona'] : ph === 2 ? ['flare', 'beam', 'corona', 'heat'] : ['flare', 'beam', 'corona', 'heat', 'eclipse'];
        let p;
        do p = rng.pick(pool);
        while (p === last);
        last = p;
        if (p === 'flare') yield* flare();
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
})();
