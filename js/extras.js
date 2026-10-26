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
})();
