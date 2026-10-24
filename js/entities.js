// エンティティ群とファクトリ。draw() はブラウザのみで呼ばれる（G.SPR を使用）
(function () {
  'use strict';
  const G = globalThis.G;
  const { T } = G;
  const SW = G.W,
    SH = G.H;
  const Ent = G.Ent;

  // ---------------- トゲ ----------------
  class Spike extends Ent {
    constructor(W, x, y, dir, o) {
      o = o || {};
      const s = o.size || T;
      super(W, x, y, s, s);
      this.dir = dir || 'u';
      this.hazard = true;
      this.cause = o.cause || null;
      this.ox = 0;
      this.oy = 0;
      this.pal = o.pal || W.def.spikePal || null;
      this.layer = 1;
      this.inset = o.inset;
      if (o.hidden) {
        // 地面に埋まっていて pop() で飛び出す
        this.layer = -1;
        const d = { u: [0, s], d: [0, -s], l: [s, 0], r: [-s, 0] }[this.dir];
        this.ox = d[0];
        this.oy = d[1];
        this.armed = false;
        this.hazard = false;
      }
      if (o.invisible) {
        this.visible = false;
        this.hazard = false;
      }
      this.popT = 0;
      this.offscreenKill = o.keep ? false : 200;
    }
    pop(frames, sound) {
      if (this.popped) return this;
      this.popped = true;
      this.hazard = true;
      this.visible = true;
      this.popT = this.popDur = frames || 3;
      this.popFrom = [this.ox, this.oy];
      if (sound !== false) G.sfx('pop');
      return this;
    }
    show() {
      this.visible = true;
      this.hazard = true;
      return this;
    }
    hide() {
      this.visible = false;
      this.hazard = false;
      return this;
    }
    tick() {
      if (this.popT > 0) {
        this.popT--;
        const k = this.popT / this.popDur;
        this.ox = this.popFrom[0] * k;
        this.oy = this.popFrom[1] * k;
      }
      if (this.spin) this.rot = (this.rot || 0) + this.spin;
    }
    hits(r) {
      if (!this.hazard) return false;
      return G.rectTri(r, G.spikeTri(this.x + this.ox, this.y + this.oy, this.w, this.h, this.dir, this.inset));
    }
    draw(ctx) {
      const img = G.SPR.spike(this.dir, this.w, this.pal);
      ctx.drawImage(img, Math.round(this.x + this.ox), Math.round(this.y + this.oy));
    }
  }
  G.Spike = Spike;

  // ---------------- ブロック ----------------
  class Block extends Ent {
    constructor(W, x, y, w, h, o) {
      o = o || {};
      super(W, Math.round(x), Math.round(y), w, h);
      this.solid = o.solid !== false;
      this.fake = !!o.fake;
      if (this.fake) this.solid = false;
      this.invisible = !!o.invisible;
      if (this.invisible) this.visible = false;
      this.oneway = !!o.oneway;
      this.conveyor = o.conveyor || 0;
      this.code = o.code || 1;
      this.style = o.style || null; // null=テーマのタイル
      this.layer = o.layer != null ? o.layer : 0;
      this.squishCause = o.squishCause;
      this.label = o.label || null;
      this.labelColor = o.labelColor;
      this.face = o.face || null;
      this.shakeT = 0;
      this.offscreenKill = o.keep ? false : 120;
      this.color = o.color;
    }
    reveal() {
      if (this.invisible) {
        this.invisible = false;
        this.visible = true;
        G.sfx('reveal');
        this.W.burst(this.cx, this.cy, 10, ['#ffffff', '#bfe8ff'], 1.5, { g: 0, life: 18 });
      }
    }
    // 足場が抜ける（以後すり抜け）
    drop(g) {
      this.solid = false;
      this.collidable = false;
      this.ay = g || 0.35;
      this.maxV = 8;
      this.offscreenKill = 60;
      return this;
    }
    // 震えてから落ちる
    crumble(delay, g) {
      if (this.crumbling) return this;
      this.crumbling = true;
      this.shakeT = delay || 20;
      G.sfx('crumble');
      this.W.after(delay || 20, () => this.drop(g));
      return this;
    }
    tick() {
      if (this.shakeT > 0) this.shakeT--;
    }
    draw(ctx) {
      let x = Math.round(this.x),
        y = Math.round(this.y);
      if (this.shakeT > 0) x += (this.shakeT % 4 < 2 ? -1 : 1);
      G.Render.drawBlock(ctx, this, x, y);
    }
  }
  G.Block = Block;

  // ---------------- デリシャスフルーツ ----------------
  class Fruit extends Ent {
    constructor(W, cx, cy, o) {
      o = o || {};
      const r = o.r || 6;
      super(W, cx - r, cy - r, r * 2, r * 2);
      this.r = r;
      this.hazard = true;
      this.cause = o.cause || 'デリシャスフルーツに当たった。';
      this.bounce = o.bounce || false;
      this.splat = o.splat || false;
      this.kind = o.kind || 'cherry';
      this.offscreenKill = o.keep ? false : 60;
      this.layer = o.layer != null ? o.layer : 2;
      this.wob = 0;
    }
    hits(rect) {
      return this.hazard && G.rectCircle(rect, this.cx, this.cy, this.r - 1);
    }
    tick() {
      if (this.bounce || this.bounds) {
        const b = this.bounds || { x0: 0, y0: 0, x1: SW, y1: SH };
        if ((this.x < b.x0 && this.vx < 0) || (this.x + this.w > b.x1 && this.vx > 0)) this.vx = -this.vx;
        if ((this.y < b.y0 && this.vy < 0) || (this.y + this.h > b.y1 && this.vy > 0)) this.vy = -this.vy;
      }
      if (this.splat && this.vy > 0 && this.W.pointSolid(this.cx, this.cy + 3)) {
        this.W.burst(this.cx, this.y + this.h, 16, ['#ff3355', '#c8102e', '#ffd0d8'], 2.5, { up: 1.5, g: 0.2, life: 30 });
        G.sfx('splat');
        this.alive = false;
      }
    }
    draw(ctx) {
      if (this.kind === 'star' || this.kind === 'rock') {
        const img = this.kind === 'star' ? G.SPR.star(this.r) : G.SPR.rockBall(this.r);
        ctx.drawImage(img, Math.round(this.cx - img.width / 2), Math.round(this.cy - img.height / 2));
      } else G.Render.drawCherry(ctx, this.cx, this.cy, this.r);
    }
  }
  G.Fruit = Fruit;

  // ---------------- 月 ----------------
  class Moon extends Ent {
    constructor(W, cx, cy, o) {
      o = o || {};
      const r = o.r || 24;
      super(W, cx - r, cy - r, r * 2, r * 2);
      this.r = r;
      this.hazard = o.hazard !== false;
      this.cause = o.cause || '月が落ちてきた。';
      this.face = o.face || 'calm';
      this.layer = o.layer != null ? o.layer : 3;
      this.offscreenKill = o.keep ? false : 120;
      this.bounceFloor = o.bounceFloor || 0;
      this.rot = 0;
    }
    hits(rect) {
      return this.hazard && G.rectCircle(rect, this.cx, this.cy, this.r - 2);
    }
    tick() {
      if (this.bounceFloor && this.vy > 0 && this.y + this.h >= this.bounceFloor) {
        this.y = this.bounceFloor - this.h;
        this.vy = -this.vy * 0.55;
        this.W.shake = 10;
        G.sfx('thud');
        if (this.onLand) this.onLand();
      }
    }
    draw(ctx) {
      const img = G.SPR.moon(this.r, this.face);
      ctx.drawImage(img, Math.round(this.cx - img.width / 2), Math.round(this.cy - img.height / 2));
    }
  }
  G.Moon = Moon;

  // ---------------- セーブポイント ----------------
  class SavePoint extends Ent {
    constructor(W, tx, ty, o) {
      o = o || {};
      super(W, tx * T, ty * T, T, T);
      this.fake = !!o.fake;
      this.easy = !!o.easy;
      this.shootable = true;
      this.saveT = 0;
      this.layer = -0.5;
      this.wasIn = null; // 初回フレームは判定のみ（リスポーン直後に重なっていても保存しない）
      this.state = 'idle';
      const g = W.game;
      if (g && g.saveData && g.saveData.room === W.id && g.saveData.tx === tx && g.saveData.ty === ty) this.state = 'saved';
    }
    tick() {
      if (this.saveT > 0) this.saveT--;
      const P = this.W.player;
      const inside = P.alive && G.overlap(P, this);
      if (inside && this.wasIn === false) this.activate();
      this.wasIn = inside;
      if (this.state === 'die') this.dieT++;
    }
    onShot() {
      if (this.state !== 'die') this.activate();
      return true;
    }
    activate() {
      const W = this.W;
      if (this.fake) {
        if (this.state === 'die') return;
        this.state = 'die';
        this.dieT = 0;
        this.hazard = true;
        this.cause = this.cause || 'セーブポイントだと思った？';
        G.sfx('trap');
        return;
      }
      if (this.saveT > 0) return;
      this.saveT = 30;
      this.state = 'saved';
      for (const e of W.ents) if (e instanceof SavePoint && e !== this && e.state === 'saved') e.state = 'idle';
      if (W.game && W.game.save) W.game.save(W.id, this.x / T, this.y / T);
      G.sfx('save');
      W.burst(this.cx, this.cy, 14, ['#7dffb0', '#ffffff', '#ffe066'], 2, { g: 0, life: 24 });
    }
    hitbox() {
      return { x: this.x - 4, y: this.y - 4, w: this.w + 8, h: this.h + 8 };
    }
    draw(ctx) {
      G.Render.drawSave(ctx, this);
    }
  }
  G.SavePoint = SavePoint;

  // ---------------- 看板 ----------------
  class Sign extends Ent {
    constructor(W, tx, ty, text, o) {
      o = o || {};
      super(W, tx * T, ty * T, T, T);
      this.text = text;
      this.layer = -0.6;
      this.range = o.range || 34;
      this.bubble = true;
      this.kind = o.kind || 'sign';
      this.near = 0;
    }
    tick() {
      const P = this.W.player;
      const d = Math.abs(P.cx - this.cx) < this.range && Math.abs(P.cy - this.cy) < 40;
      this.near = G.approach(this.near, d && P.alive ? 1 : 0, 0.12);
    }
    draw(ctx) {
      G.Render.drawSign(ctx, this);
    }
  }
  G.Sign = Sign;

  // ---------------- 装飾 ----------------
  class Decor extends Ent {
    constructor(W, x, y, kind, o) {
      o = o || {};
      super(W, x, y, o.w || T, o.h || T);
      this.kind = kind;
      this.o = o;
      this.layer = o.front ? 6 : o.layer != null ? o.layer : -2;
      this.seed = (x * 7 + y * 13) | 0;
    }
    draw(ctx) {
      G.Render.drawDecor(ctx, this);
    }
  }
  G.Decor = Decor;

  // ---------------- 大きな文字（UIレイヤーに高解像度で描画） ----------------
  class BigText extends Ent {
    constructor(W, x, y, text, o) {
      o = o || {};
      super(W, x, y, 1, 1);
      this.text = text;
      this.size = o.size || 16;
      this.color = o.color || '#ffffff';
      this.align = o.align || 'center';
      this.alpha = o.alpha == null ? 1 : o.alpha;
      this.uiText = true;
      this.outline = o.outline !== false;
      this.visible = true;
      this.bob = o.bob || 0;
    }
  }
  G.BigText = BigText;

  // ---------------- マグマ ----------------
  class Lava extends Ent {
    constructor(W, y, o) {
      o = o || {};
      super(W, 0, y, SW, SH * 2);
      this.hazard = true;
      this.speed = o.speed || 0;
      this.cause = o.cause || 'マグマに飲まれた。熱い。';
      this.color = o.color || 'lava';
      this.layer = 8;
      this.minY = o.minY == null ? -40 : o.minY;
    }
    tick() {
      if (this.speed && this.y > this.minY) this.y -= this.speed;
    }
    hits(r) {
      return r.y + r.h > this.y + 4;
    }
    draw(ctx) {
      G.Render.drawLava(ctx, this);
    }
  }
  G.Lava = Lava;

  // ---------------- 重力反転オーブ ----------------
  class GravOrb extends Ent {
    constructor(W, cx, cy, o) {
      o = o || {};
      super(W, cx - 7, cy - 7, 14, 14);
      this.cd = 0;
      this.layer = 2;
      this.fakeDouble = !!o.fakeDouble;
      this.dirOnly = o.dir || 0; // 1:下向き重力にする 2:上向き 0:反転
    }
    tick() {
      if (this.cd > 0) this.cd--;
      const P = this.W.player;
      if (this.cd === 0 && P.alive && G.overlap(P, this)) {
        const W = this.W;
        const before = W.gravity;
        if (this.dirOnly === 1) W.gravity = 1;
        else if (this.dirOnly === 2) W.gravity = -1;
        else W.gravity = -W.gravity;
        if (W.gravity !== before) {
          P.vy *= 0.3;
          P.djump = true;
          G.sfx('flip');
          W.burst(this.cx, this.cy, 12, ['#c58cff', '#ffffff'], 2, { g: 0, life: 20 });
        }
        this.cd = 40;
        if (this.fakeDouble) {
          W.after(14, () => {
            W.gravity = -W.gravity;
            G.sfx('flip');
          });
        }
      }
    }
    draw(ctx) {
      G.Render.drawOrb(ctx, this);
    }
  }
  G.GravOrb = GravOrb;

  // ---------------- ジャンプ台 ----------------
  class Spring extends Ent {
    constructor(W, tx, ty, o) {
      o = o || {};
      super(W, tx * T + 2, ty * T + 12, T - 4, 8);
      this.power = o.power || 7.2;
      this.squash = 0;
      this.layer = 1;
    }
    tick() {
      if (this.squash > 0) this.squash--;
      const P = this.W.player;
      if (P.alive && this.W.gravity === 1 && P.vy >= 0 && G.overlap(P, { x: this.x, y: this.y - 2, w: this.w, h: 6 })) {
        P.vy = -this.power;
        P.djump = true;
        P.coyote = 0;
        P.onGround = false;
        this.squash = 10;
        G.sfx('spring');
        if (this.onBounce) this.onBounce();
      }
    }
    draw(ctx) {
      G.Render.drawSpring(ctx, this);
    }
  }
  G.Spring = Spring;

  // ---------------- 反射鏡（弾の向きを変える） ----------------
  class Mirror extends Ent {
    constructor(W, tx, ty, type, o) {
      super(W, tx * T, ty * T, T, T);
      this.type = type; // '/', '\\', '|'
      this.shootable = true;
      this.layer = 1;
      this.glow = 0;
    }
    tick() {
      if (this.glow > 0) this.glow--;
    }
    onShot(b) {
      const vx = b.vx,
        vy = b.vy;
      const sp = Math.max(Math.abs(vx), Math.abs(vy));
      let nx = 0,
        ny = 0;
      if (this.type === '|') {
        nx = -vx;
        ny = -vy;
      } else if (this.type === '/') {
        // 右→上, 左→下, 上→右, 下→左
        if (vx > 0) ny = -sp;
        else if (vx < 0) ny = sp;
        else if (vy < 0) nx = sp;
        else nx = -sp;
      } else {
        if (vx > 0) ny = sp;
        else if (vx < 0) ny = -sp;
        else if (vy < 0) nx = -sp;
        else nx = sp;
      }
      b.vx = nx;
      b.vy = ny;
      b.x = this.cx + Math.sign(nx) * 11;
      b.y = this.cy + Math.sign(ny) * 11;
      b.hostile = true;
      b.life = 80;
      b.t = 0;
      this.glow = 10;
      G.sfx('ping');
      return false; // 弾は消えない
    }
    draw(ctx) {
      G.Render.drawMirror(ctx, this);
    }
  }
  G.Mirror = Mirror;

  // ---------------- スイッチ（撃つと作動） ----------------
  class Switch extends Ent {
    constructor(W, tx, ty, fn, o) {
      o = o || {};
      super(W, tx * T + 3, ty * T + 3, T - 6, T - 6);
      this.fn = fn;
      this.shootable = true;
      this.on = false;
      this.layer = 1;
      this.fake = !!o.fake;
    }
    onShot() {
      if (!this.on) {
        this.on = true;
        G.sfx('switch');
        this.W.burst(this.cx, this.cy, 10, ['#ffe066', '#ffffff'], 2, { g: 0 });
        if (this.fn) this.fn(this);
      }
      return true;
    }
    draw(ctx) {
      G.Render.drawSwitch(ctx, this);
    }
  }
  G.Switch = Switch;

  // ---------------- レーザー（予告→発射） ----------------
  class Laser extends Ent {
    constructor(W, x, y, w, h, o) {
      o = o || {};
      super(W, x, y, w, h);
      this.warn = o.warn == null ? 40 : o.warn;
      this.dur = o.dur || 30;
      this.cause = o.cause || 'レーザーで蒸発した。';
      this.color = o.color || '#ff3b6b';
      this.layer = 7;
      this.hazard = false;
      this.phase = 'warn';
      this.vertical = h > w;
    }
    tick() {
      if (this.phase === 'warn' && this.t >= this.warn) {
        this.phase = 'fire';
        this.hazard = true;
        G.sfx('laser');
        this.W.shake = Math.max(this.W.shake, 4);
      }
      if (this.phase === 'fire' && this.t >= this.warn + this.dur) this.alive = false;
    }
    hits(r) {
      if (!this.hazard) return false;
      const s = this.vertical ? { x: this.x + 2, y: this.y, w: this.w - 4, h: this.h } : { x: this.x, y: this.y + 2, w: this.w, h: this.h - 4 };
      return G.overlap(r, s);
    }
    draw(ctx) {
      G.Render.drawLaser(ctx, this);
    }
  }
  G.Laser = Laser;

  // ---------------- 汎用の当たり判定つき矩形（衝撃波など） ----------------
  class HazardBox extends Ent {
    constructor(W, x, y, w, h, o) {
      o = o || {};
      super(W, x, y, w, h);
      this.hazard = true;
      this.cause = o.cause || '何かに当たった。';
      this.kind = o.kind || 'wave';
      this.layer = o.layer || 4;
      this.offscreenKill = 40;
      this.life = o.life || 0;
    }
    tick() {
      if (this.life && this.t >= this.life) this.alive = false;
    }
    draw(ctx) {
      G.Render.drawHazardBox(ctx, this);
    }
  }
  G.HazardBox = HazardBox;

  // ---------------- トゲ岩（転がる） ----------------
  class Rock extends Ent {
    constructor(W, cx, cy, o) {
      o = o || {};
      const r = o.r || 24;
      super(W, cx - r, cy - r, r * 2, r * 2);
      this.r = r;
      this.hazard = true;
      this.cause = o.cause || 'トゲ岩に轢かれた。';
      this.layer = 4;
      this.rot = 0;
      this.offscreenKill = o.keep ? false : 100;
    }
    tick() {
      this.rot += this.vx / this.r;
    }
    hits(rect) {
      return G.rectCircle(rect, this.cx, this.cy, this.r - 2);
    }
    draw(ctx) {
      G.Render.drawRock(ctx, this);
    }
  }
  G.Rock = Rock;

  // ---------------- ファクトリ ----------------
  const WP = G.World.prototype;
  WP.spike = function (tx, ty, dir, o) {
    return this.add(new Spike(this, tx * T, ty * T, dir, o));
  };
  WP.spikePx = function (x, y, dir, o) {
    return this.add(new Spike(this, x, y, dir, o));
  };
  WP.spikeRow = function (tx0, tx1, ty, dir, o) {
    const a = [];
    for (let tx = tx0; tx <= tx1; tx++) a.push(this.spike(tx, ty, dir, o));
    return a;
  };
  WP.block = function (tx, ty, tw, th, o) {
    return this.add(new Block(this, tx * T, ty * T, (tw || 1) * T, (th || 1) * T, o));
  };
  WP.blockPx = function (x, y, w, h, o) {
    return this.add(new Block(this, x, y, w, h, o));
  };
  // マップ上のタイルを動かせるブロックに置き換える
  WP.tileToBlock = function (tx, ty, o) {
    const c = this.tile(tx, ty);
    this.setTile(tx, ty, 0);
    return this.block(tx, ty, 1, 1, Object.assign({ code: c }, o));
  };
  WP.fruit = function (cx, cy, o) {
    return this.add(new Fruit(this, cx, cy, o));
  };
  WP.moon = function (cx, cy, o) {
    return this.add(new Moon(this, cx, cy, o));
  };
  WP.save = function (tx, ty, o) {
    return this.add(new SavePoint(this, tx, ty, o));
  };
  WP.sign = function (tx, ty, text, o) {
    return this.add(new Sign(this, tx, ty, text, o));
  };
  WP.decor = function (x, y, kind, o) {
    return this.add(new Decor(this, x, y, kind, o));
  };
  WP.text = function (x, y, text, o) {
    return this.add(new BigText(this, x, y, text, o));
  };
  WP.lava = function (y, o) {
    return this.add(new Lava(this, y, o));
  };
  WP.orb = function (cx, cy, o) {
    return this.add(new GravOrb(this, cx, cy, o));
  };
  WP.spring = function (tx, ty, o) {
    return this.add(new Spring(this, tx, ty, o));
  };
  WP.mirror = function (tx, ty, type, o) {
    return this.add(new Mirror(this, tx, ty, type, o));
  };
  WP.switchAt = function (tx, ty, fn, o) {
    return this.add(new Switch(this, tx, ty, fn, o));
  };
  WP.laser = function (x, y, w, h, o) {
    return this.add(new Laser(this, x, y, w, h, o));
  };
  WP.rock = function (cx, cy, o) {
    return this.add(new Rock(this, cx, cy, o));
  };
  WP.hbox = function (x, y, w, h, o) {
    return this.add(new HazardBox(this, x, y, w, h, o));
  };
  // プレイヤーが近づいたら（条件付き）トゲが飛び出す
  WP.popSpike = function (tx, ty, dir, area, o) {
    const s = this.spike(tx, ty, dir, Object.assign({ hidden: true }, o));
    this.trig(area[0], area[1], area[2], area[3], () => s.pop(o && o.frames), { cond: o && o.cond });
    return s;
  };
})();
