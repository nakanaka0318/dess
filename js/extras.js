// 寄り道と追加の罠：各ステージに「ひみつの部屋」（ひみつのリンゴが1つずつ）と、新しい仕掛け・死に方を足す
//  既存の部屋への追加は addTo() で setup の後ろにつなげる（元の部屋の定義はそのまま）
(function () {
  'use strict';
  const G = globalThis.G;
  const T = G.T;
  const R = G.ROOMS;
  const Ent = G.Ent;
  const shotHint = () => (G.isTouch ? 'SHOT' : 'X');

  // ---------------------------------------------------------------------
  // 共通
  // ---------------------------------------------------------------------
  G.SECRETS = 6;
  G.secretCount = (flags) => {
    let n = 0;
    for (let i = 1; i <= G.SECRETS; i++) if (flags && flags['secret' + i]) n++;
    return n;
  };
  // 既存の部屋に罠や入口を足す
  function addTo(id, fn, o) {
    const d = R[id];
    const base = d.setup;
    d.setup = function (W, opts) {
      if (base) base.call(this, W, opts);
      fn(W, opts || {});
    };
    if (o && o.hint) d.hint = d.hint + o.hint;
    if (o && o.cause) {
      const bc = d.spikeCauseFn;
      d.spikeCauseFn = (W) => o.cause(W) || (bc ? bc(W) : null);
    }
    if (o && o.exits) d.exits = Object.assign({}, d.exits, o.exits);
  }
  G.addTo = addTo;

  // ひみつのリンゴ
  class SecretApple extends Ent {
    constructor(W, cx, cy, n) {
      super(W, cx - 7, cy - 7, 14, 14);
      this.n = n;
      this.layer = 3;
      this.baseY = this.y;
    }
    tick() {
      if (!this.tw) this.y = this.baseY + Math.sin(this.t * 0.08) * 2;
      const W = this.W,
        P = W.player;
      if (!P.alive || !G.overlap(P, this)) return;
      this.alive = false;
      let k = 1;
      if (W.game) {
        W.game.flags['secret' + this.n] = true;
        k = G.secretCount(W.game.flags);
        if (W.game.writePersist) W.game.writePersist();
      }
      G.sfx('fanfare');
      W.burst(this.cx, this.cy, 40, ['#ffd84a', '#ff3355', '#ffffff'], 2.5, { g: 0, life: 40 });
      W.say(`ひみつのリンゴを手に入れた！（${k}/${G.SECRETS}）`, 240, 70, 140, { plain: true, size: 13, color: '#fff2a8' });
      if (this.onGet) this.onGet();
    }
    draw(ctx) {
      G.Render.drawSecretApple(ctx, this);
    }
  }
  G.SecretApple = SecretApple;
  G.World.prototype.secret = function (cx, cy, n) {
    if (this.game && this.game.flags['secret' + n]) {
      this.text(cx, cy, '（取った）', { size: 8, color: '#a89cc8' });
      return null;
    }
    return this.add(new SecretApple(this, cx, cy, n));
  };

  // 宝箱（ミミックは歯が見えている。撃てば倒せる）
  class Chest extends Ent {
    constructor(W, tx, ty, o) {
      super(W, tx * T + 1, ty * T + 4, T - 2, T - 4);
      this.mimic = !!o.mimic;
      this.cause = o.cause || '宝箱だと思った？ ミミックだった。';
      this.shootable = true;
      this.hp = 3;
      this.layer = 1;
      this.state = 'shut';
      this.hurtT = 0;
      this.vyy = 0;
      this.floorY = this.y;
      this.onOpen = o.onOpen;
    }
    tick() {
      const W = this.W,
        P = W.player;
      if (this.hurtT > 0) this.hurtT--;
      if (this.mimic) {
        if (this.state === 'shut' && P.alive && P.onGround && Math.abs(P.cx - this.cx) < 28 && Math.abs(P.cy - this.cy) < 24) {
          this.state = 'bite';
          this.hazard = true;
          this.wait = 6;
          G.sfx('trap');
        }
        if (this.state === 'bite') {
          if (this.wait > 0) this.wait--;
          else if (this.vyy === 0 && this.y >= this.floorY) {
            this.vyy = -3;
            this.dir = Math.sign(P.cx - this.cx) || 1;
            G.sfx('stomp');
          }
          if (this.vyy || this.y < this.floorY) {
            this.vyy += 0.25;
            this.y += this.vyy;
            this.x += this.dir * 3;
            if (this.y >= this.floorY) {
              this.y = this.floorY;
              this.vyy = 0;
              this.wait = 14;
            }
          }
        }
      } else if (this.state === 'shut' && P.alive && G.overlap(P, this)) this.open();
    }
    open() {
      this.state = 'open';
      G.sfx('reveal');
      this.W.burst(this.cx, this.y, 16, ['#ffd84a', '#ffffff'], 2, { g: 0.05, life: 24 });
      if (this.onOpen) this.onOpen(this);
    }
    onShot() {
      if (!this.mimic) {
        if (this.state === 'shut') this.open();
        return true;
      }
      this.hp--;
      this.hurtT = 6;
      G.sfx('hit');
      if (this.hp <= 0) {
        this.alive = false;
        this.W.burst(this.cx, this.cy, 24, ['#c08850', '#ffd84a', '#ffffff'], 2.5, { g: 0.15 });
        this.W.say('ミミックをたおした', this.cx, this.y - 6, 50, { plain: true, size: 9, color: '#ffe9a8' });
        G.sfx('explode');
      }
      return true;
    }
    hits(r) {
      return this.hazard && G.overlap(r, { x: this.x + 2, y: this.y + 2, w: this.w - 4, h: this.h - 2 });
    }
    draw(ctx) {
      G.Render.drawChest(ctx, this);
    }
  }
  G.Chest = Chest;
  G.World.prototype.chest = function (tx, ty, o) {
    return this.add(new Chest(this, tx, ty, o || {}));
  };

  // 拾えるもの（さわると onGet）
  class Pickup extends Ent {
    constructor(W, cx, cy, kind, onGet) {
      super(W, cx - 7, cy - 7, 14, 14);
      this.kind = kind;
      this.onGet = onGet;
      this.layer = 2;
    }
    tick() {
      const P = this.W.player;
      if (P.alive && G.overlap(P, this)) {
        this.alive = false;
        this.onGet(this);
      }
    }
    draw(ctx) {
      G.Render.drawPickup(ctx, this);
    }
  }
  G.Pickup = Pickup;

  // =====================================================================
  // STAGE 1：はじまりの草原の左には……
  // =====================================================================
  addTo('1-1', () => {}, { exits: { left: '1-S' } });
  R['1-S'] = {
    hint: '本物の宝箱は歯がない真ん中の1つ。ミミックは撃って倒す。手前の花は跳び越える。リンゴを取ったら上からもう1個降ってくるので動く。',
    area: 1,
    name: '1-S ひみつの花畑',
    theme: 'grass',
    bg: 'day',
    exits: { right: '1-1' },
    map: [
      '#.......................',
      '#.......................',
      '#.......................',
      '#.......................',
      '#.......................',
      '#.......................',
      '#.......................',
      '#.......................',
      '#.......................',
      '#.......................',
      '#.......................',
      '#....................S..',
      '########################',
      '########################',
    ],
    setup(W) {
      for (const [x, k] of [[30, 'flower'], [70, 'grass'], [120, 'flower'], [180, 'flower'], [250, 'grass'], [300, 'flower'], [430, 'flower']]) W.decor(x, 220, k);
      W.decor(40, 110, 'tree', { h: 130 });
      W.sign(20, 11, 'ひみつの花畑\n（ここは平和です）', { range: 30 });
      // ① 平和な花畑の、人食い花
      W.decor(372, 220, 'flower');
      W.trigPx(370, 0, 20, 280, () => {
        W.after(4, () => {
          W.hbox(366, 206, 24, 34, { kind: 'flowerbite', life: 24, cause: '花畑は平和じゃなかった。' });
          G.sfx('stomp');
        });
      }, { cond: (P) => P.onGround });
      // ② 本物の宝箱はひとつだけ（ミミックは歯が見えている）
      W.sign(17, 11, '本物の宝箱はひとつだけ。\nミミックは、よく見ると歯がある。', { range: 26 });
      W.chest(15, 11, { mimic: true });
      W.chest(5, 11, { mimic: true });
      W.chest(10, 11, {
        onOpen: (c) => {
          const a = W.secret(c.cx, c.y - 4, 1);
          if (!a) return;
          a.tweenTo(a.x, c.y - 40, 30, 'outQuad', function () {
            this.baseY = this.y;
          });
          // ③ ひみつのリンゴの次は、ふつうのリンゴ
          a.onGet = () =>
            W.after(36, () => {
              const f = W.fruit(W.player.cx, -10, { cause: 'ひみつのリンゴの次は、ふつうのリンゴ。', splat: true });
              f.vel(0, 3, 0, 0.5);
              G.sfx('whoosh');
            });
        },
      });
    },
  };

  // 新しい仕掛け：ミミック（うそつき城の、ジャンプ禁止の天井の下）
  addTo(
    '3-1',
    (W) => {
      W.chest(17, 11, { mimic: true, cause: 'ジャンプ禁止の下の宝箱は、ミミックだった。' });
    },
    { hint: 'ジャンプ禁止の下の宝箱はミミック。跳ばずに撃って倒そう。' }
  );

  // 新しい死に方：ヘルメット（安全第一……のはずが）
  addTo(
    '2-1',
    (W) => {
      const sg = W.ents.find((e) => e instanceof G.Sign && /落石注意/.test(e.text));
      if (sg) sg.text = '落石注意\n（ヘルメットを着用しよう）';
      W.add(
        new Pickup(W, 56, 232, 'helmet', () => {
          W.vars.helmet = true;
          W.say('安全第一！', W.player.cx, W.player.y - 6, 50, { plain: true, size: 10, color: '#ffe96a' });
          G.sfx('save');
          W.after(24, () => {
            const P = W.player;
            const r = W.rock(P.cx, -30, { r: 22, cause: 'ヘルメットでは防げない大きさだった。' });
            r.vel(0, 6, 0, 0.4);
            G.sfx('rumble');
          });
        })
      );
    },
    { hint: 'ヘルメットは拾わずに跳び越える。' }
  );

  // にせもの部屋の看板（にせものの部屋なので……）
  addTo('1-4', (W) => {
    W.sign(9, 11, 'はじまりの部屋の左には\nなにもない（ほんとう）', { range: 24 });
  });

  // =====================================================================
  // STAGE 2：流砂と、スフィンクスの間
  // =====================================================================
  // 新しい仕掛け：流砂（ゆっくり沈む。連打で這い上がれるが、足が重い）
  class QuickSand extends Ent {
    constructor(W, x, y, w, h) {
      super(W, x, y, w, h);
      this.layer = 5;
    }
    tick() {
      const P = this.W.player;
      if (!P.alive) return;
      const inside = P.x + P.w > this.x && P.x < this.x + this.w && P.y + P.h > this.y + 2 && P.y < this.y + this.h;
      if (!inside) return;
      if (P.vy > 0.45) P.vy = 0.45;
      if (P.vy < -3.4) P.vy = -3.4;
      P.coyote = 3;
      if (P.vx) P.moveX(-P.vx * 0.5);
      if (this.t % 12 === 0) this.W.dust(P.cx, this.y, 2);
    }
    draw(ctx) {
      G.Render.drawQuickSand(ctx, this);
    }
  }
  G.QuickSand = QuickSand;
  G.World.prototype.quicksand = function (x, y, w, h) {
    return this.add(new QuickSand(this, x, y, w, h));
  };
  const inSand = (W) => W.ents.some((e) => e instanceof QuickSand && W.player.cx > e.x && W.player.cx < e.x + e.w && W.player.y + W.player.h > e.y);

  addTo(
    '5-1',
    (W) => {
      W.quicksand(140, 238, 40, 30);
      const sg = W.ents.find((e) => e instanceof G.Sign && /ようこそ 2面へ/.test(e.text));
      if (sg) sg.text += '\n（最初の穴は流砂。落ちたらジャンプ連打）';
    },
    { hint: '最初の穴は流砂。落ちてもジャンプ連打で這い上がれる。', cause: (W) => (inSand(W) ? '流砂に飲まれた。' : null) }
  );

  // スカラベ（撃つと隠し扉が開く）
  class Scarab extends Ent {
    constructor(W, cx, cy, onHit) {
      super(W, cx - 6, cy - 6, 12, 12);
      this.shootable = true;
      this.onHit = onHit;
      this.layer = -0.5;
      this.lit = false;
    }
    shotBox() {
      return { x: this.x - 3, y: this.y - 4, w: this.w + 6, h: this.h + 8 };
    }
    onShot() {
      if (!this.lit) {
        this.lit = true;
        G.sfx('switch');
        this.W.burst(this.cx, this.cy, 16, ['#5ad8ff', '#ffffff'], 2, { g: 0, life: 24 });
        if (this.onHit) this.onHit();
      }
      return true;
    }
    draw(ctx) {
      G.Render.drawScarab(ctx, this);
    }
  }

  // 5-3：壁の高いところのスカラベを撃つと、王の墓の扉が開く
  addTo('5-3', (W) => {
    const opened = W.game && W.game.flags.tombOpen;
    const door = W.door(1, 10, { to: '5-S', spawn: [2, 11], label: '王', open: !!opened });
    W.add(
      new Scarab(W, 200, 146, () => {
        door.open = true;
        if (W.game) W.game.flags.tombOpen = true;
        W.say('ゴゴゴ……（左の扉が開いた）', 120, 170, 90, { plain: true, size: 10, color: '#9ae8ff' });
        G.sfx('rumble');
      })
    );
    if (opened) W.ents.filter((e) => e instanceof Scarab).forEach((e) => (e.lit = true));
  });

  // なぞなぞの石板
  class Tablet extends Ent {
    constructor(W, cx, cy, label, onHit) {
      super(W, cx - 9, cy - 11, 18, 22);
      this.shootable = true;
      this.label = label;
      this.onHit = onHit;
      this.layer = 0;
      W.text(cx, cy - 18, label, { size: 9, color: '#ffe9a8' });
    }
    onShot() {
      if (this.onHit) this.onHit(this);
      return true;
    }
    draw(ctx) {
      G.Render.drawTablet(ctx, this);
    }
  }

  R['5-S'] = {
    hint: '答えは「人間」（真ん中の高さの石板を跳びながら撃つ）。流砂はジャンプ連打で渡る。リンゴを取ると天井が下りてくるので、すぐ左の扉へ戻る。',
    area: 5,
    name: '5-S スフィンクスの間',
    theme: 'temple',
    bg: 'temple',
    exits: {},
    goal: 'flag',
    map: [
      '########################',
      '########################',
      '#......................#',
      '#......................#',
      '#......................#',
      '#......................#',
      '#......................#',
      '#......................#',
      '#......................#',
      '#......................#',
      '#......................#',
      '#...S..................#',
      '##########......########',
      '##########^^^^^^########',
    ],
    spikeCauseFn: () => '流砂に飲まれた。',
    setup(W) {
      const game = W.game;
      W.door(1, 10, { to: '5-3', spawn: [3, 11], label: '↩' });
      W.decor(40, 150, 'torch');
      W.decor(440, 150, 'torch');
      W.decor(300, 60, 'sphinx');
      W.quicksand(200, 238, 120, 34);
      const solved = game && game.flags.riddleSolved;
      const gate = W.block(9, 9, 1, 3, { style: 'gate', keep: true });
      if (solved) gate.alive = false;
      else {
        W.sign(5, 11, 'スフィンクス「朝は4本、昼は2本、\n夜は3本の足で歩くものは？\n答えの石板を撃て」', { range: 30 });
        const answer = (t) => {
          if (W.vars.answered) return;
          W.vars.answered = true;
          if (t.label === '人間') {
            G.sfx('fanfare');
            W.say('正解。……つまらない。', 300, 70, 90, {});
            if (game) game.flags.riddleSolved = true;
            gate.tweenTo(gate.x, gate.y - 70, 40, 'inOutQuad', () => gate.kill());
            return;
          }
          G.sfx('trap');
          W.say(t.label === 'イヌ' ? '犬は朝も夜も4本だ。' : 'イスは歩かない。', 300, 70, 70, {});
          W.after(50, () => {
            W.laser(W.player.cx - 14, 0, 28, 240, { warn: 6, dur: 30, cause: '不正解。スフィンクスに食べられた。', color: '#ffd84a' });
            G.sfx('charge');
          });
        };
        W.add(new Tablet(W, 150, 230, 'イヌ', answer));
        W.add(new Tablet(W, 166, 186, '人間', answer));
        W.add(new Tablet(W, 150, 146, 'イス', answer));
      }
      // ひみつのリンゴと、ファラオの呪い
      const a = W.secret(400, 230, 2);
      if (a)
        a.onGet = () => {
          W.say('呪いだ……ファラオの呪いだ……！', 240, 100, 120, { plain: true, size: 12, color: '#ff9aaa' });
          G.sfx('rumble');
          const c = W.hbox(20, -30, 440, 30, { kind: 'curse', cause: 'ファラオの呪いだ……！' });
          c.offscreenKill = false;
          c.vel(0, 0.45);
        };
    },
  };

  // 6-3：お供え物（ご自由にどうぞ）
  addTo('6-3', (W) => {
    const f = W.fruit(70, 232, { kind: 'gold', r: 6, keep: true });
    f.hazard = false;
    W.sign(5, 11, 'お供え物\n（ご自由にどうぞ）', { range: 24 });
    W.trigPx(62, 220, 16, 20, () => {
      f.alive = false;
      W.say('……。', 200, 70, 40, { plain: true, size: 12, color: '#ffd84a' });
      W.after(10, () => {
        W.laser(W.player.cx - 12, 0, 24, 240, { warn: 14, dur: 24, cause: 'お供え物は、神様のもの。', color: '#ffd84a' });
        G.sfx('charge');
      });
    });
  });

  // =====================================================================
  // STAGE 3：ワームホールと、ニュートンのリンゴ倉庫
  // =====================================================================
  // 新しい仕掛け：ワームホール（同じ色の出口へ。勢いはそのまま）。warp を渡すと別の部屋へ
  class Wormhole extends Ent {
    constructor(W, cx, cy, o) {
      super(W, cx - 10, cy - 10, 20, 20);
      this.color = o.color || '#c070ff';
      this.warp = o.warp;
      this.exitOnly = !!o.exitOnly;
      this.layer = 1;
      this.cd = 0;
    }
    tick() {
      if (this.cd > 0) this.cd--;
      const W = this.W,
        P = W.player;
      if (this.exitOnly || this.cd || !P.alive || !G.rectCircle(P, this.cx, this.cy, 7)) return;
      G.sfx('flip');
      W.burst(this.cx, this.cy, 16, [this.color, '#ffffff'], 2, { g: 0, life: 20 });
      if (this.warp) {
        this.cd = 999;
        if (W.game && W.game.warp) W.game.warp(this.warp[0], this.warp[1], this.warp[2]);
        return;
      }
      const o = this.to;
      P.x = o.cx - P.w / 2;
      P.y = o.cy - P.h / 2;
      P.xr = P.yr = 0;
      o.cd = 30;
      this.cd = 30;
      W.burst(o.cx, o.cy, 16, [o.color, '#ffffff'], 2, { g: 0, life: 20 });
    }
    draw(ctx) {
      G.Render.drawWormhole(ctx, this);
    }
  }
  G.Wormhole = Wormhole;
  G.World.prototype.wormholes = function (a, b, color) {
    const A = this.add(new Wormhole(this, a[0], a[1], { color }));
    const B = this.add(new Wormhole(this, b[0], b[1], { color, exitOnly: true }));
    A.to = B;
    return [A, B];
  };

  // 7-1：出口の上にただようワームホール（低重力で軽く跳ぶと届く）
  addTo('7-1', (W) => {
    W.add(new Wormhole(W, 440, 168, { color: '#ffd84a', warp: ['8-S', 2, 11] }));
  });

  R['8-S'] = {
    hint: '赤いワームホールの出口は穴の上。青い方（少し跳ぶ）で棚へ。リンゴを取ると重力が反転するので、天井のトゲのない所（穴の右側）の下へ。帰りは穴の右の黄色いワームホール。',
    area: 8,
    name: '8-S ニュートンのリンゴ倉庫',
    theme: 'garden',
    bg: 'garden',
    exits: {},
    goal: 'flag',
    map: [
      '########################',
      '#vvvvvvvvvv....vvvvvvvv#',
      '#......................#',
      '#......................#',
      '#.................----.#',
      '#......................#',
      '#......................#',
      '#......................#',
      '#......................#',
      '#......................#',
      '#......................#',
      '#...S..................#',
      '###########..###########',
      '###########^^###########',
    ],
    spikeCauseFn(W) {
      if (W.gravity === -1) return 'リンゴは上に落ちることもある。きみも。';
      if (W.vars.flipped) return '重力が戻った。落ちる場所も考えよう。';
      return 'ワームホールの出口を確認しなかった。';
    },
    setup(W) {
      W.sign(2, 11, 'ニュートンのリンゴ倉庫\n（在庫：∞）', { range: 26 });
      for (const [x, y] of [[300, 200], [330, 200], [315, 180], [440, 200]]) W.decor(x, y, 'crate');
      // 帰り道（7-1 へ）
      W.add(new Wormhole(W, 340, 230, { color: '#ffd84a', warp: ['7-1', 21, 11] }));
      // 赤：出口は穴の上 / 青：出口は棚の上
      W.wormholes([120, 230], [240, 250], '#ff4a6a');
      W.wormholes([196, 192], [400, 50], '#4ab0ff');
      // ひみつのリンゴ。取ると重力が反転する
      const a = W.secret(398, 70, 3);
      if (a)
        a.onGet = () =>
          W.run(function* () {
            W.say('ニュートン「リンゴは、上に落ちることもある」', 240, 110, 120, { plain: true, size: 11, color: '#c8f0a0' });
            for (const n of [3, 2, 1]) {
              W.say(String(n), 240, 140, 40, { plain: true, size: 20, color: '#ff9aaa' });
              G.sfx('warn');
              yield 40;
            }
            W.gravity = -1;
            W.vars.flipped = true;
            G.sfx('flip');
            yield 200;
            W.gravity = 1;
            G.sfx('flip');
          });
    },
  };

  // 8-2：撃った弾まで引き寄せられて戻ってくる
  addTo(
    '8-2',
    (W) => {
      const prev = W.onStep;
      W.onStep = () => {
        if (prev) prev();
        const P = W.player;
        for (const b of W.bullets) {
          if (b.hostile || b.t < 8) continue;
          b.life = Math.max(b.life, 30);
          b.vx -= Math.sign(b.vx) * 0.6;
          if (Math.abs(b.vx) < 0.7) {
            b.hostile = true;
            b.cause = '撃った弾が、万有引力で戻ってきた。';
            b.vx = Math.sign(P.cx - b.x) * 5;
            b.vy = (P.cy - b.y) * 0.05;
          }
        }
      };
    },
    { hint: 'この部屋で撃った弾は戻ってくる。撃たないこと。' }
  );

  // 7-3：懐中電灯（いちばん暗い所で電池が切れる）
  {
    const d = R['7-3'];
    const base = d.drawFg;
    d.drawFg = (ctx, W) => (W.vars.torch === 1 ? G.Render.drawDarkness(ctx, W, 0.35) : base(ctx, W));
  }
  addTo(
    '7-3',
    (W) => {
      W.add(
        new Pickup(W, 92, 230, 'torch', () => {
          W.vars.torch = 1;
          W.say('懐中電灯を手に入れた！', W.player.cx, W.player.y - 8, 60, { plain: true, size: 10, color: '#ffe96a' });
          G.sfx('save');
        })
      );
      const prev = W.onStep;
      W.onStep = () => {
        if (prev) prev();
        const P = W.player;
        if (W.vars.torch === 1 && P.cx > 210) {
          W.vars.torch = -1;
          W.vars.torchOut = W.time;
          W.vars.flashT = 0;
          W.say('……電池切れ', P.cx, P.y - 8, 60, { plain: true, size: 10, color: '#a89cc8' });
          G.sfx('crumble');
        }
        // 電池が切れた直後は、光ってもよく見えない
        if (W.vars.torchOut && W.time - W.vars.torchOut < 100) W.vars.flashT = 0;
      };
    },
    { hint: '懐中電灯は真ん中で電池が切れる。拾わないか、切れる前に覚えておこう。', cause: (W) => (W.vars.torchOut && W.time - W.vars.torchOut < 120 ? 'ちょうど電池が切れた。' : null) }
  );

  // =====================================================================
  // STAGE 4：赤青ブロックと、うさぎの餅屋
  // =====================================================================
  // 新しい仕掛け：赤青ブロック（スイッチを撃つたびに、固い色が入れかわる）
  class ToggleBlock extends Ent {
    constructor(W, tx, ty, color) {
      super(W, tx * T, ty * T, T, T);
      this.color = color;
      this.layer = 0;
      this.solid = false;
      this.collidable = false;
    }
    tick() {
      const W = this.W,
        P = W.player;
      const want = (W.vars.tog || 0) === (this.color === 'red' ? 0 : 1);
      if (want && !this.solid) {
        // プレイヤーと重なっている間は固くならない（埋まらないように）
        if (P.alive && G.overlap(P, this)) return;
        this.solid = this.collidable = true;
      } else if (!want && this.solid) this.solid = this.collidable = false;
    }
    draw(ctx) {
      G.Render.drawToggle(ctx, this);
    }
  }
  class ToggleSwitch extends Ent {
    constructor(W, tx, ty) {
      super(W, tx * T + 3, ty * T + 3, T - 6, T - 6);
      this.shootable = true;
      this.layer = 1;
      this.cd = 0;
    }
    tick() {
      if (this.cd > 0) this.cd--;
    }
    onShot() {
      if (this.cd) return true;
      this.cd = 12;
      this.W.vars.tog = 1 - (this.W.vars.tog || 0);
      G.sfx('switch');
      return true;
    }
    draw(ctx) {
      G.Render.drawToggleSwitch(ctx, this);
    }
  }
  G.World.prototype.toggles = function (list, color) {
    for (const [tx, ty] of list) this.add(new ToggleBlock(this, tx, ty, color));
  };

  // 9-1：うさぎの足場の上に、餅屋の扉
  addTo('9-1', (W) => {
    W.door(10, 6, { to: '9-S', spawn: [2, 11], label: '餅' });
    // 地球に見とれていると、人工衛星が落ちてくる
    let look = 0;
    const prev = W.onStep;
    W.onStep = () => {
      if (prev) prev();
      const P = W.player;
      if (look < 0 || !P.alive) return;
      look = P.onGround && !P.vx && Math.abs(P.cx - 90) < 30 ? look + 1 : 0;
      if (look > 100) {
        look = -1;
        const s = W.fruit(P.cx, -14, { kind: 'rock', r: 8, cause: '地球に見とれていた。人工衛星が落ちてきた。' });
        s.vel(0, 5, 0, 0.3);
        G.sfx('whoosh');
      }
    };
  }, { hint: '看板の前で地球に見とれていると人工衛星が落ちてくる。' });

  R['9-S'] = {
    hint: 'スイッチを1回撃つと赤い壁が消えて青い床が出る。床の上でもう1回撃つと落ちる。ひみつのリンゴの代金は1デス（死んでも手に入る）。',
    area: 9,
    name: '9-S うさぎの餅屋',
    theme: 'moon',
    bg: 'farside',
    exits: {},
    goal: 'flag',
    map: [
      '########################',
      '#......................#',
      '#......................#',
      '#......................#',
      '#......................#',
      '#......................#',
      '#......................#',
      '#......................#',
      '#......................#',
      '#......................#',
      '#......................#',
      '#...S..................#',
      '############....########',
      '############^^^^########',
    ],
    spikeCauseFn: (W) => (W.vars.togFlips > 1 ? 'スイッチは2回撃つと元に戻る。' : '青い床は、まだなかった。'),
    setup(W) {
      W.door(1, 10, { to: '9-1', spawn: [11, 7], label: '↩' });
      W.sign(6, 11, 'うさぎの餅屋\n（スイッチを撃って\nお入りください）', { range: 26 });
      W.vars.tog = 0;
      W.vars.togFlips = 0;
      const sw = W.add(new ToggleSwitch(W, 8, 11));
      const base = sw.onShot.bind(sw);
      sw.onShot = (b) => {
        if (!sw.cd) W.vars.togFlips++;
        return base(b);
      };
      W.toggles([[10, 9], [10, 10], [10, 11]], 'red');
      W.toggles([[12, 12], [13, 12], [14, 12], [15, 12]], 'blue');
      W.decor(400, 196, 'shop');
      W.decor(424, 210, 'rabbit');
      const got = W.game && W.game.flags.secret4;
      W.sign(18, 11, got ? 'まいどあり！' : 'ひみつのリンゴ\n1こ　1デス\n（ベルをさわってね）', { range: 26 });
      if (!got) {
        // 売り物（さわっても取れない。ベルでお支払い）
        const apple = W.secret(440, 176, 4);
        if (apple) {
          apple.layer = 1;
          apple.tick = function () {
            this.y = this.baseY + Math.sin(this.t * 0.08) * 2;
          };
        }
        // ベル：さわると「お支払い」
        W.add(
          new Pickup(W, 400, 232, 'bell', () => {
            if (W.game) {
              W.game.flags.secret4 = true;
              if (W.game.writePersist) W.game.writePersist();
            }
            if (apple) apple.alive = false;
            G.sfx('fanfare');
            W.say(`まいど！ ひみつのリンゴ（${W.game ? G.secretCount(W.game.flags) : 1}/${G.SECRETS}）`, 400, 150, 90, { plain: true, size: 11, color: '#fff2a8' });
            W.after(40, () => W.kill('代金を支払った。（1デス）'));
          })
        );
      }
    },
  };

  // 9-A3 開発室：無敵モードのスイッチ
  addTo(
    '9-A3',
    (W) => {
      W.sign(14, 11, '無敵モード\n（撃つとON）', { range: 20 });
      const sw = W.add(new ToggleSwitch(W, 15, 11));
      sw.onShot = () => {
        if (sw.used) return true;
        sw.used = true;
        G.sfx('fanfare');
        W.text(240, 110, '無敵モード ON', { size: 18, color: '#9affc0' });
        W.after(60, () => {
          const r = W.rock(W.player.cx, -30, { r: 16, cause: '無敵モードはウソだった。開発室なので。' });
          r.vel(0, 4, 0, 0.4);
          G.sfx('whoosh');
        });
        return true;
      };
    },
    { hint: '無敵モードのスイッチも撃たない方がいい。' }
  );

  // =====================================================================
  // STAGE 5：風船と、塔の屋根裏
  // =====================================================================
  // 新しい仕掛け：風船（さわるとつかまって上へ。ジャンプで手をはなす。popAt があると途中で割れる）
  class Balloon extends Ent {
    constructor(W, cx, cy, o) {
      super(W, cx - 8, cy - 10, 16, 20);
      this.dur = o.dur || 170;
      this.popAt = o.popAt || 0;
      this.color = o.color || '#ff5a7a';
      this.layer = 3;
      this.held = false;
      this.baseY = this.y;
    }
    tick() {
      const W = this.W,
        P = W.player;
      if (!this.held) {
        this.y = this.baseY + Math.sin(this.t * 0.06) * 3;
        if (P.alive && G.overlap(P, this)) {
          this.held = true;
          this.t0 = this.t;
          G.sfx('boing');
        }
        return;
      }
      const k = this.t - this.t0;
      const pop = this.popAt && k >= this.popAt;
      if (!P.alive || P.vy < -1.6 || k > this.dur || pop) {
        this.alive = false;
        if (pop || k > this.dur) {
          G.sfx('pop');
          W.burst(this.cx, this.cy, 14, [this.color, '#ffffff'], 2, { g: 0.05, life: 20 });
          W.say('パン！', this.cx, this.y - 4, 40, { plain: true, size: 11, color: '#ffffff' });
        }
        return;
      }
      P.vy = -1.25;
      this.x = P.cx - 8;
      this.y = P.y - 24;
    }
    draw(ctx) {
      G.Render.drawBalloon(ctx, this);
    }
  }
  G.Balloon = Balloon;
  G.World.prototype.balloon = function (cx, cy, o) {
    return this.add(new Balloon(this, cx, cy, o || {}));
  };

  // 10-4：入口の右の風船で、右の壁の上のすき間へ（屋根裏）
  {
    const d = R['10-4'];
    d.map = d.map.map((row, i) => (i === 2 || i === 3 ? row.slice(0, 23) + '.' : row));
  }
  addTo('10-4', (W) => W.balloon(330, 196, {}), { exits: { right: '10-S' }, hint: '入口の右の風船につかまると、右の壁の上のすき間まで上がれる（寄り道）。' });

  // 10-6：「らくらく上昇」の風船は途中で割れる
  addTo('10-6', (W) => {
    W.balloon(258, 196, { popAt: 60, color: '#7ad0ff' });
    W.sign(13, 10, '← らくらく上昇\n（風船）', { range: 30 });
  }, { hint: '「らくらく上昇」の風船は途中で割れる。' });

  // 10-3：高い所に立つとカラスが飛んでくる
  addTo(
    '10-3',
    (W) => {
      const prev = W.onStep;
      W.onStep = () => {
        if (prev) prev();
        const P = W.player;
        if (W.vars.crow || !P.alive || !P.onGround || P.y + P.h > 140) return;
        W.vars.crow = true;
        W.say('カァ！', 450, P.cy - 14, 40, { plain: true, size: 11, color: '#ffffff' });
        G.sfx('warn');
        const y = P.cy;
        W.after(30, () => {
          const c = W.fruit(500, y, { kind: 'crow', r: 7, cause: 'カラスにつつかれた。塔の上はカラスの縄張り。' });
          c.vel(-3, 0);
          G.sfx('whoosh');
        });
      };
    },
    { hint: '高い足場に乗るとカラスが来る。通り過ぎるのを待とう。' }
  );

  // ネズミ
  class Rat extends Ent {
    constructor(W, x, y, dir) {
      super(W, x, y, 12, 7);
      this.hazard = true;
      this.dir = dir;
      this.layer = 2;
      this.cause = 'ネズミにかじられた。屋根裏だから。';
    }
    tick() {
      this.x += this.dir * 2.2;
      if (this.x < -20 || this.x > 500) this.alive = false;
    }
    draw(ctx) {
      G.Render.drawRat(ctx, this);
    }
  }

  R['10-S'] = {
    hint: '天井が低いので小さく跳ぶ。ネズミは小ジャンプで越える。「非常口」は塔のふもと行き。帰りは左のすき間から。',
    area: 10,
    name: '10-S 塔の屋根裏',
    theme: 'sky',
    bg: 'dusk',
    exits: { left: '10-4' },
    map: [
      '########################',
      '########################',
      '.......................#',
      '...S...................#',
      '########################',
      '########################',
      '########################',
      '########################',
      '########################',
      '########################',
      '########################',
      '########################',
      '########################',
      '########################',
    ],
    setup(W) {
      W.sign(5, 3, '塔の屋根裏\n（天井が低い）', { range: 24 });
      W.decor(170, 56, 'pot');
      W.sign(10, 3, '前の挑戦者の忘れ物', { range: 24 });
      W.decor(250, 52, 'crate');
      W.door(22, 2, { to: '10-1', spawn: [3, 11], label: '非' });
      W.sign(20, 3, '非常口\n（下まで一瞬）', { range: 20 });
      W.secret(350, 70, 5);
      // ひみつのリンゴに近づくと、ネズミ
      W.trigPx(300, 0, 20, 280, () => {
        W.add(new Rat(W, 480, 73, -1));
        G.sfx('warn');
        W.say('チュー', 440, 50, 40, { plain: true, size: 10, color: '#ffffff' });
      }, { cond: (P) => P.onGround });
    },
  };

  // =====================================================================
  // STAGE 6：酸素メーターと、月の秘密基地
  // =====================================================================
  // 新しい仕掛け：酸素メーター（空気のない部屋。ボンベで回復、0になると死ぬ）
  function oxygen(W, frames) {
    W.vars.o2 = 1;
    W.vars.o2Rate = 1 / frames;
    const prev = W.onStep;
    W.onStep = () => {
      if (prev) prev();
      const P = W.player;
      if (!P.alive || W.vars.o2 == null) return;
      W.vars.o2 = Math.max(0, W.vars.o2 - W.vars.o2Rate);
      if (W.vars.o2 < 0.3 && W.time % 30 === 0) G.sfx('warn');
      if (W.vars.o2 <= 0) W.kill('酸素が切れた。秘密基地に空気はなかった。');
    };
  }
  G.oxygen = oxygen;
  const o2Tank = (W, cx, cy) =>
    W.add(
      new Pickup(W, cx, cy, 'o2', () => {
        W.vars.o2 = 1;
        G.sfx('save');
        W.say('酸素 満タン', cx, cy - 12, 40, { plain: true, size: 9, color: '#9ae8ff' });
      })
    );

  // 12-2：宇宙人の足場に通気口（秘密基地へ）。宇宙人はさわるとシビれる（本当にそう言っている）
  addTo(
    '12-2',
    (W) => {
      W.door(17, 4, { to: '12-S', spawn: [2, 11], label: '通' });
      const al = W.ents.find((e) => e instanceof G.Npc && e.kind === 'alien');
      if (al) {
        al.x = 392 - al.r;
        al.baseY = al.y;
        al.hazard = true;
        al.cause = 'ほんとうにシビれた。（宇宙人はウソをつかない）';
        W.trigPx(300, 0, 16, 120, () => W.say('サワルト、シビレルヨ。', 0, 0, 90, { follow: al, dy: -4 }));
      }
    },
    { hint: '宇宙人にさわるとシビれる（本当）。宇宙人の足場の通気口は寄り道。' }
  );

  R['12-S'] = {
    hint: '酸素はボンベで回復。日記を読みすぎない。「本物」と書いた☾の看板のリンゴは偽物。本物は奥。',
    area: 12,
    name: '12-S 月の秘密基地',
    theme: 'station',
    bg: 'deduce',
    exits: {},
    goal: 'flag',
    map: [
      '########################',
      '########################',
      '########################',
      '########################',
      '#......................#',
      '#......................#',
      '#......................#',
      '#......................#',
      '#......................#',
      '#......................#',
      '#......................#',
      '#...S..................#',
      '########################',
      '########################',
    ],
    setup(W) {
      oxygen(W, 360);
      W.door(1, 10, { to: '12-2', spawn: [17, 11], label: '↩' });
      W.sign(6, 11, '月の日記①\nきょうもプレイヤーが\nリンゴで死んだ。たのしい。', { range: 22 });
      W.sign(9, 11, '月の日記②\nセーブポイントくんと\n作戦会議。', { range: 22 });
      W.sign(15, 11, '月の日記③\nばれそうになったら\n太陽のせいにしよう。', { range: 22 });
      o2Tank(W, 230, 228);
      o2Tank(W, 360, 228);
      // ニセのひみつのリンゴ（☾の署名）
      W.sign(12, 11, 'ひみつのリンゴ\n（本物）' + '\n　　　　☾', { range: 22 });
      const fakeA = W.fruit(274, 230, { kind: 'gold', r: 6, keep: true, cause: 'ニセのひみつのリンゴ。署名を見ればわかったのに。' });
      fakeA.hazard = false;
      W.trigPx(268, 220, 14, 20, () => {
        fakeA.alive = false;
        W.burst(274, 230, 50, ['#ff5a10', '#ffd84a', '#ffffff'], 3.5, { g: 0.1 });
        G.sfx('explode');
        W.kill('ニセのひみつのリンゴ。署名を見ればわかったのに。');
      });
      W.secret(440, 226, 6);
      W.sign(20, 11, '（ここには何もない）', { range: 20 });
    },
    drawUI(ctx, W, UI) {
      if (W.vars.o2 != null) G.Render.drawO2(ctx, W.vars.o2, UI);
    },
  };

  // 12-3：管制室のコーヒー（撃つとこぼれて床に電気）
  addTo(
    '12-3',
    (W) => {
      W.sign(5, 11, '管制官のコーヒー\n（撃たないでね）', { range: 24 });
      const cup = W.add(new Pickup(W, 130, 232, 'coffee', () => {}));
      cup.shootable = true;
      cup.tick = () => {};
      cup.onShot = () => {
        cup.alive = false;
        G.sfx('splat');
        W.say('バチバチッ', 160, 200, 50, { plain: true, size: 11, color: '#9ae8ff' });
        W.after(12, () => {
          W.hbox(0, 230, 300, 10, { kind: 'zap', life: 40, cause: '管制室でコーヒーをこぼしてはいけない。' });
          G.sfx('laser');
        });
        return true;
      };
    },
    { hint: 'コーヒーは撃たない。' }
  );
})();
