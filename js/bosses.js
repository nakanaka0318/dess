// ボス：デリシャス・キング（中ボス）と THE MOON（ラスボス）
(function () {
  'use strict';
  const G = globalThis.G;
  G.BOSSES = G.BOSSES || {};
  const SW = G.W,
    SH = G.H;

  class Boss extends G.Ent {
    constructor(W, x, y, w, h, o) {
      super(W, x, y, w, h);
      this.maxHp = this.hp = o.hp;
      this.name = o.name;
      this.shootable = true;
      this.hazard = false;
      this.vulnerable = false;
      this.showBar = false;
      this.hurtT = 0;
      this.defeated = false;
      this.layer = 3;
      this.ai = { alive: true };
      W.boss = this;
    }
    tick() {
      if (this.hurtT > 0) this.hurtT--;
    }
    onShot(b) {
      if (this.defeated) return false;
      if (!this.vulnerable) {
        this.W.spark(b.x, b.y, '#9aa0b0');
        G.sfx('hit');
        return true;
      }
      this.hp -= b.dmg || 1;
      this.hurtT = 4;
      G.sfx('bosshit');
      this.W.spark(b.x, b.y, '#ffffff');
      if (this.hp <= 0) {
        this.hp = 0;
        this.defeat();
      }
      return true;
    }
    defeat() {
      this.defeated = true;
      this.hazard = false;
      this.vulnerable = false;
      this.ai.alive = false;
      this.stop();
      if (this.onDefeat) this.onDefeat();
    }
  }
  G.Boss = Boss;

  // ------------------------------------------------------------------
  // デリシャス・キング
  // ------------------------------------------------------------------
  class King extends Boss {
    constructor(W, cx, cy) {
      super(W, cx - 26, cy - 26, 52, 52, { hp: W.easy ? 40 : 60, name: 'デリシャス・キング' });
      this.r = 26;
      this.scale = 0.25;
      this.cause = 'デリシャス・キングに押しつぶされた。';
      this.look = 0;
    }
    get rr() {
      return this.r * this.scale;
    }
    hits(rect) {
      return this.hazard && G.rectCircle(rect, this.cx, this.cy, this.rr - 3);
    }
    shotBox() {
      const r = this.rr;
      return { x: this.cx - r, y: this.cy - r, w: r * 2, h: r * 2 };
    }
    tick() {
      super.tick();
      this.look = G.approach(this.look, Math.sign(this.W.player.cx - this.cx), 0.2);
    }
    draw(ctx) {
      G.Render.drawKing(ctx, this);
    }
  }
  G.King = King;

  G.BOSSES.king = function (W, opts) {
    const FLOOR = 240;
    const k = W.add(new King(W, 240, FLOOR - 7));
    k.scale = 0.27;
    const rng = W.rng;
    const P = W.player;
    const setPos = (cx, cy) => {
      k.x = cx - 26;
      k.y = cy - 26;
    };
    const floorCy = () => FLOOR - 26;

    function* hop(tx) {
      const T = 50;
      k.vel((tx - k.cx) / T, -6.25, 0, 0.25);
      G.sfx('boing');
      yield () => k.vy > 0 && k.y + k.h >= FLOOR;
      k.stop();
      k.y = FLOOR - k.h;
      W.shake = 8;
      G.sfx('stomp');
      W.burst(k.cx, FLOOR, 12, ['#ff3355', '#c8102e'], 2, { up: 1.5, g: 0.15, life: 25 });
      for (const d of [-1, 1]) {
        const f = W.fruit(k.cx + d * 20, FLOOR - 6, { cause: '転がるリンゴにつまずいた。' });
        f.vel(d * (k.hp < k.maxHp / 2 ? 2.6 : 2.2), 0);
      }
    }
    function* bounce() {
      const n = k.hp < k.maxHp / 2 ? 4 : 3;
      for (let i = 0; i < n; i++) {
        const tx = G.clamp(P.cx + rng.range(-30, 30), 50, SW - 50);
        yield* hop(tx);
        yield 14;
      }
    }
    // 高い所を経由して移動する（プレイヤーの横をすり抜けて体当たりしないように）
    const HIGH = 50;
    function* travel(cx, cy, d) {
      d = d || 60;
      if (k.cy > HIGH + 30) {
        k.tweenTo(k.x, HIGH - 26, Math.round(d * 0.35), 'outQuad');
        yield Math.round(d * 0.35);
      }
      k.tweenTo(cx - 26, HIGH - 26, Math.round(d * 0.4), 'inOutQuad');
      yield Math.round(d * 0.4);
      if (cy !== HIGH) {
        k.tweenTo(cx - 26, cy - 26, Math.round(d * 0.3), 'inQuad');
        yield Math.round(d * 0.3);
      }
    }
    // プレイヤーから離れた位置に着地する
    function* land() {
      const tx = P.cx < SW / 2 ? SW - 90 : 90;
      k.tweenTo(tx - 26, k.y, 26, 'inOutQuad');
      yield 26;
      k.charging = true;
      yield 10;
      k.charging = false;
      k.tweenTo(k.x, FLOOR - 52, 22, 'inQuad');
      yield 22;
      W.shake = 6;
      G.sfx('stomp');
    }
    function* shower() {
      yield* travel(240, 60, 60);
      const n = k.hp < k.maxHp / 2 ? 16 : 11;
      for (let i = 0; i < n; i++) {
        const f = W.fruit(k.cx, k.cy + 10, { cause: 'リンゴの雨に打たれた。', splat: true });
        f.vel(rng.range(-2.6, 2.6), rng.range(-2.4, -0.8), 0, 0.12);
        f.maxV = 6;
        G.sfx('shoot');
        yield 9;
      }
      yield 20;
      yield* land();
    }
    function* charge() {
      const side = P.cx < SW / 2 ? 1 : -1; // プレイヤーと反対側へ
      const sx = side > 0 ? SW - 52 : 52;
      yield* travel(sx, FLOOR - 26, 64);
      k.charging = true;
      G.sfx('warn');
      W.say('！', 0, 0, 40, { follow: k, dy: -6, plain: true, size: 16, color: '#ff3a5a' });
      yield k.hp < k.maxHp / 2 ? 30 : 42;
      k.vel(-side * 6.2, 0);
      G.sfx('whoosh');
      yield () => (side > 0 ? k.cx < 52 : k.cx > SW - 52);
      k.stop();
      k.charging = false;
      W.shake = 10;
      G.sfx('stomp');
    }
    function* ring() {
      yield* travel(240, 100, 56);
      for (let w = 0; w < 2; w++) {
        k.inflate = 20;
        G.sfx('charge');
        yield 24;
        const n = 12,
          off = w * (Math.PI / 12);
        for (let i = 0; i < n; i++) {
          const a = off + (i / n) * Math.PI * 2;
          const f = W.fruit(k.cx, k.cy, { cause: 'リンゴの輪をくぐれなかった。' });
          f.vel(Math.cos(a) * 1.7, Math.sin(a) * 1.7);
        }
        G.sfx('explode');
        yield 46;
      }
      k.tweenTo(k.x, HIGH - 26, 20, 'outQuad');
      yield 20;
      yield* land();
    }

    W.run(function* () {
      // 登場演出：ただのリンゴが巨大化する
      const quick = opts.respawn && W.game && W.game.flags.kingSeen;
      yield () => P.cx < 330;
      W.closeGate && W.closeGate();
      G.music(null);
      if (!quick) {
        W.say('……', 0, 0, 60, { follow: k, dy: -4 });
        yield 70;
      }
      G.sfx('roar');
      W.shake = 40;
      for (let i = 0; i <= 30; i++) {
        k.scale = 0.27 + (i / 30) * 0.73;
        setPos(240, FLOOR - 26 * k.scale);
        yield 1;
      }
      setPos(240, floorCy());
      k.scale = 1;
      for (const e of W.ents) if (e instanceof G.Sign) e.alive = false;
      if (!quick) {
        W.say('われこそは デリシャス・キング！\nリンゴの恨み、思い知るがいい！', 0, 0, 120, { follow: k, dy: -6 });
        yield 110;
      }
      if (W.game) W.game.flags.kingSeen = true;
      G.music('boss');
      k.showBar = true;
      k.hazard = true;
      k.vulnerable = true;
      W.autoFire = true;
      let last = '';
      for (;;) {
        const phase2 = k.hp < k.maxHp / 2;
        const pool = phase2 ? ['bounce', 'shower', 'charge', 'ring'] : ['bounce', 'shower', 'charge'];
        let p;
        do p = rng.pick(pool);
        while (p === last);
        last = p;
        if (p === 'bounce') yield* bounce();
        else if (p === 'shower') yield* shower();
        else if (p === 'charge') yield* charge();
        else yield* ring();
        yield phase2 ? 18 : 30;
      }
    }, k.ai);

    k.onDefeat = () => {
      G.music(null);
      W.autoFire = false;
      // 残っているリンゴを消す
      for (const e of W.ents) if (e instanceof G.Fruit) {
        W.burst(e.cx, e.cy, 6, ['#ff3355', '#ffd0d8'], 1.5, { g: 0.1 });
        e.alive = false;
      }
      W.run(function* () {
        for (let i = 0; i < 40; i++) {
          k.shakeX = (i % 2 ? 2 : -2);
          if (i % 6 === 0) {
            W.burst(k.cx + rng.range(-20, 20), k.cy + rng.range(-20, 20), 14, ['#ff3355', '#ffffff', '#ffd84a'], 2.5, { g: 0.05 });
            G.sfx('explode');
          }
          yield 2;
        }
        W.burst(k.cx, k.cy, 120, ['#ff3355', '#c8102e', '#ffd0d8', '#ffd84a'], 5, { g: 0.12, life: 60 });
        W.flash = 10;
        W.flashColor = '#ffffff';
        W.shake = 30;
        G.sfx('bigexplode');
        k.alive = false;
        k.visible = false;
        k.showBar = false;
        yield 50;
        G.sfx('fanfare');
        W.text(240, 90, 'デリシャス・キング をたおした！', { size: 15, color: '#ffe9a8' });
        if (W.game) W.game.flags.kingDead = true;
        yield 60;
        if (W.onBossCleared) W.onBossCleared();
      });
    };
    return k;
  };

  // ------------------------------------------------------------------
  // THE MOON（ラスボス）
  // ------------------------------------------------------------------
  class MoonBoss extends Boss {
    constructor(W, cx, cy, hp) {
      super(W, cx - 44, cy - 44, 88, 88, { hp, name: 'THE MOON' });
      this.r = 44;
      this.face = 'grin';
      this.cause = '月に触れてしまった。';
      this.shakeX = 0;
    }
    hits(rect) {
      return this.hazard && G.rectCircle(rect, this.cx, this.cy, this.r - 6);
    }
    // 弾の当たり判定は光の輪のぶん少し広い（足場の上から撃てるように）
    shotBox() {
      return { x: this.cx - this.r - 6, y: this.cy - this.r - 6, w: this.r * 2 + 12, h: this.r * 2 + 22 };
    }
    draw(ctx) {
      G.Render.drawMoonBoss(ctx, this);
    }
  }
  G.MoonBoss = MoonBoss;

  // 月落としの着弾予告（床の影）
  class Shadow extends G.Ent {
    constructor(W, x) {
      super(W, x, 236, 1, 1);
      this.layer = 2;
      this.lock = false;
    }
    draw(ctx) {
      const w = 40 + Math.sin(this.t * 0.3) * 4;
      ctx.fillStyle = this.lock ? (Math.floor(this.t / 3) % 2 ? 'rgba(255,40,80,0.7)' : 'rgba(255,40,80,0.35)') : 'rgba(10,0,30,0.5)';
      ctx.beginPath();
      ctx.ellipse(Math.round(this.x), 238, w, 4, 0, 0, Math.PI * 2);
      ctx.fill();
      if (this.lock) G.SPR.tiny(ctx, '!', Math.round(this.x) - 1, 222, '#ff3a5a');
    }
  }

  G.BOSSES.moon = function (W, opts) {
    const FLOOR = 240;
    const HOMEY = 104;
    const P = W.player;
    const rng = W.rng;
    const m = W.add(new MoonBoss(W, 240, -90, W.easy ? 110 : 160));
    const phase = () => (m.hp > m.maxHp * 0.66 ? 1 : m.hp > m.maxHp * 0.33 ? 2 : 3);
    const deaths = (W.game && W.game.deaths) || 0;

    function* goTo(cx, cy, d, ease) {
      m.tweenTo(cx - m.r, cy - m.r, d, ease || 'inOutQuad');
      yield d;
    }
    function* drift() {
      const tx = G.clamp(P.cx + rng.range(-120, 120), 100, 380);
      yield* goTo(tx, HOMEY + rng.range(-6, 2), phase() === 3 ? 34 : 48);
    }
    function* crater() {
      const n = [3, 5, 7][phase() - 1];
      m.face = 'angry';
      G.sfx('charge');
      yield 26;
      const vol = phase() === 1 ? 1 : 2;
      for (let v = 0; v < vol; v++) {
        const a0 = Math.atan2(P.cy - m.cy, P.cx - m.cx);
        for (let i = 0; i < n; i++) {
          const a = a0 + (i - (n - 1) / 2) * 0.24;
          const r = W.fruit(m.cx + Math.cos(a) * 36, m.cy + Math.sin(a) * 36, { kind: 'rock', r: 6, cause: '月の石が直撃した。' });
          r.vel(Math.cos(a) * 2.5, Math.sin(a) * 2.5);
        }
        G.sfx('explode');
        yield 34;
      }
      m.face = 'grin';
      yield 16;
    }
    function* starRain() {
      const n = [8, 11, 14][phase() - 1];
      const xs = [];
      for (let i = 0; i < n; i++) xs.push(rng.range(28, 452));
      const marks = xs.map((x) => W.text(x, 30, '▼', { size: 9, color: '#fff27a' }));
      G.sfx('warn');
      m.face = 'calm';
      yield 40;
      marks.forEach((k) => (k.alive = false));
      for (let i = 0; i < n; i++) {
        const st = W.fruit(xs[i], -8, { kind: 'star', r: 6, cause: '星くずに打たれた。' });
        st.vel(0, 3.1);
        st.trail = true;
        if (i % 2) yield 5;
      }
      m.face = 'grin';
      yield 30;
    }
    function* moonDrop(count, stun) {
      m.face = 'grin';
      yield* goTo(m.cx, -150, 36, 'inQuad');
      for (let k = 0; k < count; k++) {
        const sh = W.add(new Shadow(W, P.cx));
        const follow = phase() === 3 ? 44 : 60;
        for (let i = 0; i < follow; i++) {
          sh.x = G.approach(sh.x, P.cx, 3.2);
          yield 1;
        }
        sh.lock = true;
        G.sfx('warn');
        yield 16;
        m.x = sh.x - m.r;
        m.y = -110;
        m.face = 'rage';
        m.vel(0, 11);
        yield () => m.y + m.h >= FLOOR;
        m.stop();
        m.y = FLOOR - m.h;
        sh.alive = false;
        W.shake = 22;
        G.sfx('thud');
        G.sfx('stomp');
        W.burst(m.cx, FLOOR, 30, ['#c8c8d8', '#8a8a9e', '#fffbe0'], 3, { up: 2, g: 0.15, life: 30 });
        const sp = phase() === 3 ? 3.4 : 2.8;
        for (const d of [-1, 1]) {
          const wv = W.hbox(m.cx + d * 40 - 6, FLOOR - 12, 12, 12, { kind: 'wave', cause: '衝撃波に足をすくわれた。' });
          wv.vel(d * sp, 0);
        }
        if (k < count - 1) {
          yield 22;
          yield* goTo(m.cx, -150, 26, 'inQuad');
        }
      }
      m.face = 'shock';
      yield stun || (phase() === 3 ? 60 : 80);
      m.face = 'grin';
      yield* goTo(G.clamp(m.cx, 100, 380), HOMEY, 46);
    }
    function* satellites() {
      yield* goTo(240, HOMEY, 30);
      const n = 8;
      const fr = [];
      for (let i = 0; i < n; i++) fr.push(W.fruit(m.cx, m.cy, { r: 7, keep: true, cause: 'リンゴ衛星に撃墜された。' }));
      G.sfx('charge');
      let ang = 0;
      const sp = phase() === 3 ? 0.045 : 0.034;
      for (let t = 0; t < 230; t++) {
        ang += sp;
        const rad = Math.min(t * 1.2, 66 + Math.sin(t * 0.035) * 34);
        for (let i = 0; i < n; i++) {
          const a = ang + (i / n) * Math.PI * 2;
          fr[i].x = m.cx + Math.cos(a) * rad - fr[i].r;
          fr[i].y = m.cy + Math.sin(a) * rad - fr[i].r;
        }
        yield 1;
      }
      for (let i = 0; i < n; i++) {
        const a = ang + (i / n) * Math.PI * 2;
        fr[i].vel(Math.cos(a) * 2.2, Math.sin(a) * 2.2);
        fr[i].offscreenKill = 60;
      }
      G.sfx('explode');
      yield 30;
    }
    function* lasers() {
      m.face = 'angry';
      const n = phase() === 3 ? 5 : 3;
      const xs = [P.cx];
      for (let i = 1; i < n; i++) xs.push(rng.range(30, 450));
      for (const x of xs) W.laser(Math.round(x) - 6, 0, 12, FLOOR, { warn: 46, dur: 22, cause: '月光線に焼かれた。' });
      G.sfx('charge');
      yield 74;
      if (phase() === 3) {
        // 足場の高さを薙ぎ払う
        W.laser(0, 146, 480, 12, { warn: 46, dur: 22, cause: '足場の上も安全ではない。' });
        G.sfx('charge');
        yield 74;
      }
      m.face = 'grin';
    }
    function* spiral() {
      yield* goTo(240, HOMEY - 10, 30);
      m.face = 'rage';
      G.sfx('roar');
      yield 30;
      let a = rng.range(0, 6.28);
      for (let t = 0; t < 170; t++) {
        if (t % 5 === 0) {
          for (let arm = 0; arm < 3; arm++) {
            const ang = a + (arm / 3) * Math.PI * 2;
            const st = W.fruit(m.cx + Math.cos(ang) * 30, m.cy + Math.sin(ang) * 30, { kind: 'star', r: 5, cause: '月の渦に巻き込まれた。' });
            st.vel(Math.cos(ang) * 1.9, Math.sin(ang) * 1.9);
          }
          if (t % 15 === 0) G.sfx('shoot');
        }
        a += 0.105;
        yield 1;
      }
      m.face = 'grin';
      yield 30;
    }
    function* desperation() {
      m.vulnerable = false;
      m.face = 'rage';
      W.shake = 40;
      G.sfx('roar');
      W.say('まだだ…まだ終わらんぞ！', 0, 0, 80, { follow: m, dy: -4 });
      yield 80;
      m.vulnerable = true;
      yield* moonDrop(3, 150);
    }

    W.run(function* () {
      const quick = opts.respawn && W.game && W.game.flags.moonSeen;
      yield quick ? 20 : 40;
      // 床の穴をふさぐ（プレイヤーが穴の中にいない時に）
      yield () => P.alive && P.onGround && P.y + P.h <= 240;
      W.sealFloor && W.sealFloor();
      G.music(null);
      m.face = 'calm';
      yield* goTo(240, HOMEY, quick ? 40 : 90, 'outQuad');
      if (!quick) {
        W.say('よくぞここまで来た、小さき者よ。', 0, 0, 100, { follow: m, dy: -4 });
        yield 100;
        W.say(`ここに来るまでに ${deaths} 回死んだようだな。`, 0, 0, 100, { follow: m, dy: -4 });
        yield 100;
        m.face = 'grin';
        W.say('その執念に敬意を表して――\n全力で叩き落としてくれよう！', 0, 0, 110, { follow: m, dy: -4 });
        yield 100;
      } else {
        m.face = 'grin';
        W.say(`また来たか。これで ${deaths} 回目の死だな。`, 0, 0, 70, { follow: m, dy: -4 });
        yield 60;
      }
      if (W.game) W.game.flags.moonSeen = true;
      G.sfx('roar');
      W.shake = 30;
      G.music('final');
      m.showBar = true;
      m.hazard = true;
      m.vulnerable = true;
      W.autoFire = true;
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
          W.flashColor = '#ffe9a8';
          W.say(ph === 2 ? 'なかなかやるな…！' : 'ならば本気を見せてやろう！', 0, 0, 70, { follow: m, dy: -4 });
          yield* goTo(240, HOMEY, 40);
          yield 20;
        }
        if (!desp && m.hp < m.maxHp * 0.1) {
          desp = true;
          yield* desperation();
          continue;
        }
        const pool = ph === 1 ? ['crater', 'star', 'drop'] : ph === 2 ? ['crater', 'star', 'drop', 'sat', 'laser'] : ['crater', 'sat', 'laser', 'spiral', 'drop'];
        let p;
        do p = rng.pick(pool);
        while (p === last);
        last = p;
        if (p === 'crater') yield* crater();
        else if (p === 'star') yield* starRain();
        else if (p === 'drop') yield* moonDrop(ph === 3 ? 2 : 1);
        else if (p === 'sat') yield* satellites();
        else if (p === 'laser') yield* lasers();
        else yield* spiral();
        yield* drift();
        yield ph === 1 ? 24 : 12;
      }
    }, m.ai);

    m.onDefeat = () => {
      G.music(null);
      W.autoFire = false;
      W.god = true;
      for (const e of W.ents) {
        if (e === m) continue;
        if (e instanceof G.Fruit || e instanceof G.Laser || e instanceof G.HazardBox || e instanceof Shadow) {
          W.spark(e.cx, e.cy, '#ffffff');
          e.alive = false;
        }
      }
      W.run(function* () {
        m.face = 'hurt';
        // 画面外で倒されても見えるように中央へ
        m.tweenTo(240 - m.r, 110 - m.r, 30, 'outQuad');
        yield 30;
        for (let i = 0; i < 100; i++) {
          m.shakeX = i % 2 ? 3 : -3;
          if (i % 8 === 0) {
            W.burst(m.cx + rng.range(-36, 36), m.cy + rng.range(-36, 36), 18, ['#fffbe0', '#efe6b0', '#ffffff', '#ffd84a'], 3, { g: 0.05 });
            G.sfx('explode');
          }
          yield 1;
        }
        W.flash = 24;
        W.flashColor = '#ffffff';
        W.shake = 50;
        G.sfx('bigexplode');
        W.burst(m.cx, m.cy, 220, ['#fffbe0', '#efe6b0', '#c9bd80', '#ffffff', '#ffd84a'], 6, { g: 0.08, life: 90 });
        m.alive = false;
        m.visible = false;
        m.showBar = false;
        yield 100;
        // 最後のかけら……
        const piece = W.fruit(P.cx, -12, { r: 6, cause: '' });
        piece.hazard = false;
        piece.vel(0, 1, 0, 0.25);
        yield () => !P.alive || piece.cy >= P.y - 6;
        piece.vel(P.face > 0 ? 2.4 : -2.4, -4.2, 0, 0.22);
        G.sfx('boing');
        W.say('ぽよん', P.cx, P.y - 6, 50, { plain: true, size: 10, color: '#ffffff' });
        yield 70;
        G.sfx('fanfare');
        W.text(240, 80, 'THE MOON をたおした！', { size: 16, color: '#ffe9a8' });
        W.text(240, 104, '空が、静かになった。', { size: 11, color: '#e8e2ff' });
        yield 200;
        if (W.game && W.game.finish) W.game.finish();
      });
    };
    return m;
  };
})();
