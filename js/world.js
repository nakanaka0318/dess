// ワールド（部屋）・プレイヤー・エンティティ基底・弾・パーティクル
// DOM非依存。描画は render.js / entities.js の draw() が担当する。
(function () {
  'use strict';
  const G = globalThis.G;
  const { T, COLS, ROWS, PHYS } = G;
  const SW = G.W,
    SH = G.H;

  const TILE = { EMPTY: 0, SOLID: 1, ALT: 2, PLAT: 3, SU: 10, SD: 11, SL: 12, SR: 13 };
  G.TILE = TILE;
  // F は「見た目は地面、実はすり抜ける」偽ブロック
  const CHARS = { '#': 1, B: 2, '-': 3, F: 4, '^': 10, v: 11, '<': 12, '>': 13 };
  const SPIKE_DIR = { 10: 'u', 11: 'd', 12: 'l', 13: 'r' };
  G.SPIKE_DIR = SPIKE_DIR;
  const isSolidCode = (c) => c === 1 || c === 2;
  G.isSolidCode = isSolidCode;

  function strHash(s) {
    let h = 2166136261;
    for (let i = 0; i < s.length; i++) {
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  // ------------------------------------------------------------------
  // エンティティ基底
  // ------------------------------------------------------------------
  class Ent {
    constructor(W, x, y, w, h) {
      this.W = W;
      this.x = x;
      this.y = y;
      this.w = w;
      this.h = h;
      this.vx = 0;
      this.vy = 0;
      this.ax = 0;
      this.ay = 0;
      this.xr = 0;
      this.yr = 0;
      this.maxV = 99;
      this.alive = true;
      this.visible = true;
      this.layer = 0;
      this.solid = false;
      this.oneway = false;
      this.collidable = true;
      this.hazard = false;
      this.shootable = false;
      this.cause = null;
      this.t = 0;
      this.tw = null;
      this.ridden = false;
      this.offscreenKill = false;
    }
    get cx() {
      return this.x + this.w / 2;
    }
    get cy() {
      return this.y + this.h / 2;
    }
    update() {
      this.t++;
      if (this.tick) this.tick();
      if (!this.alive) return;
      let dx = 0,
        dy = 0;
      if (this.tw) {
        const tw = this.tw;
        tw.t++;
        const k = tw.e(Math.min(1, tw.t / tw.d));
        const nx = tw.x0 + (tw.x1 - tw.x0) * k;
        const ny = tw.y0 + (tw.y1 - tw.y0) * k;
        dx = nx - (this.x + this.xr);
        dy = ny - (this.y + this.yr);
        if (tw.t >= tw.d) {
          this.tw = null;
          if (tw.then) tw.then.call(this);
        }
      } else {
        this.vx += this.ax;
        this.vy += this.ay;
        if (this.vx > this.maxV) this.vx = this.maxV;
        if (this.vx < -this.maxV) this.vx = -this.maxV;
        if (this.vy > this.maxV) this.vy = this.maxV;
        if (this.vy < -this.maxV) this.vy = -this.maxV;
        dx = this.vx;
        dy = this.vy;
      }
      if (dx || dy) this.move(dx, dy);
      if (this.solid && this.collidable) {
        const P = this.W.player;
        if (P.alive && P.isRiding(this)) {
          if (!this.ridden) {
            this.ridden = true;
            if (this.onStep) this.onStep(P);
          }
          this.rideT = (this.rideT || 0) + 1;
        } else {
          this.ridden = false;
          this.rideT = 0;
        }
      }
      if (this.offscreenKill) {
        const m = this.offscreenKill === true ? 80 : this.offscreenKill;
        if (this.x > SW + m || this.x + this.w < -m || this.y > SH + m || this.y + this.h < -m - 200)
          this.alive = false;
      }
    }
    move(dx, dy) {
      if (this.solid) this.solidMove(dx, dy);
      else {
        this.x += dx;
        this.y += dy;
      }
    }
    // Celeste 方式のソリッド移動：乗っているプレイヤーを運び、重なれば押し出す
    solidMove(dx, dy) {
      const W = this.W,
        P = W.player;
      this.xr += dx;
      this.yr += dy;
      const mx = Math.round(this.xr),
        my = Math.round(this.yr);
      if (!mx && !my) return;
      const riding = P.alive && this.collidable && P.isRiding(this);
      const wasCol = this.collidable;
      if (mx) {
        this.xr -= mx;
        this.x += mx;
        if (wasCol && P.alive) {
          this.collidable = false;
          if (!this.oneway && G.overlap(P, this)) {
            const amt = mx > 0 ? this.x + this.w - P.x : this.x - (P.x + P.w);
            P.moveX(amt, () => P.squish(this));
          } else if (riding) P.moveX(mx);
          this.collidable = wasCol;
        }
      }
      if (my) {
        this.yr -= my;
        const oldTop = this.y;
        this.y += my;
        if (wasCol && P.alive) {
          this.collidable = false;
          if (this.oneway) {
            // 上昇する一方通行足場：足元を通過したら持ち上げる
            const g = W.gravity;
            const xo = P.x + P.w > this.x && P.x < this.x + this.w;
            if (g === 1 && xo) {
              const feet = P.y + P.h;
              if (riding) P.moveY(my, () => (my < 0 ? P.squish(this) : null));
              else if (my < 0 && feet > this.y && feet <= oldTop) P.moveY(this.y - feet, () => P.squish(this));
            }
          } else if (G.overlap(P, this)) {
            const amt = my > 0 ? this.y + this.h - P.y : this.y - (P.y + P.h);
            P.moveY(amt, () => P.squish(this));
            if (my > 0 && W.gravity === 1 && P.vy < 0) P.vy = 0;
          } else if (riding) P.moveY(my);
          this.collidable = wasCol;
        }
      }
    }
    tweenTo(x, y, d, ease, then) {
      this.tw = {
        x0: this.x + this.xr,
        y0: this.y + this.yr,
        x1: x,
        y1: y,
        t: 0,
        d: Math.max(1, d),
        e: G.ease[ease || 'inOutQuad'],
        then,
      };
      this.vx = this.vy = this.ax = this.ay = 0;
      return this;
    }
    tweenBy(dx, dy, d, ease, then) {
      return this.tweenTo(this.x + this.xr + dx, this.y + this.yr + dy, d, ease, then);
    }
    stop() {
      this.vx = this.vy = this.ax = this.ay = 0;
      this.tw = null;
      return this;
    }
    vel(vx, vy, ax, ay) {
      this.tw = null;
      this.vx = vx || 0;
      this.vy = vy || 0;
      this.ax = ax || 0;
      this.ay = ay || 0;
      return this;
    }
    kill() {
      this.alive = false;
    }
    hits(r) {
      return G.overlap(r, this.hitbox ? this.hitbox() : this);
    }
    draw() {}
  }
  G.Ent = Ent;

  // ------------------------------------------------------------------
  // プレイヤー
  // ------------------------------------------------------------------
  class Player {
    constructor(W, x, y) {
      this.W = W;
      this.x = Math.round(x);
      this.y = Math.round(y);
      this.w = PHYS.PW;
      this.h = PHYS.PH;
      this.xr = 0;
      this.yr = 0;
      this.vx = 0;
      this.vy = 0;
      this.face = 1;
      this.alive = true;
      this.djump = true;
      this.coyote = 0;
      this.jbuf = 0;
      this.onGround = false;
      this.shootCd = 0;
      this.runT = 0;
      this.landT = 0;
      this.jumpHeld = false;
      this.extVX = 0;
    }
    get cx() {
      return this.x + this.w / 2;
    }
    get cy() {
      return this.y + this.h / 2;
    }
    collideAt(x, y) {
      const r = this.W.solidAt(x, y, this.w, this.h);
      if (r && r !== true && r.invisible) r.reveal();
      return r;
    }
    onewayAt(dir) {
      const g = this.W.gravity;
      if (dir !== g) return false;
      return this.W.onewayAt(this.x, this.w, g === 1 ? this.y + this.h : this.y, g);
    }
    moveX(amt, onCol) {
      this.xr += amt;
      let m = Math.round(this.xr);
      if (!m) return false;
      this.xr -= m;
      const s = Math.sign(m);
      while (m) {
        if (!this.collideAt(this.x + s, this.y)) {
          this.x += s;
          m -= s;
        } else {
          this.xr = 0;
          if (onCol) onCol();
          return true;
        }
      }
      return false;
    }
    moveY(amt, onCol) {
      this.yr += amt;
      let m = Math.round(this.yr);
      if (!m) return false;
      this.yr -= m;
      const s = Math.sign(m);
      while (m) {
        const hit = this.collideAt(this.x, this.y + s) || this.onewayAt(s);
        if (!hit) {
          this.y += s;
          m -= s;
        } else {
          this.yr = 0;
          if (hit !== true && hit.onBonk && s === -this.W.gravity) hit.onBonk(this);
          if (onCol) onCol();
          return true;
        }
      }
      return false;
    }
    isRiding(e) {
      if (this.x + this.w <= e.x || this.x >= e.x + e.w) return false;
      return this.W.gravity === 1 ? this.y + this.h === e.y : this.y === e.y + e.h;
    }
    grounded() {
      const g = this.W.gravity;
      return !!(this.collideAt(this.x, this.y + g) || this.onewayAt(g));
    }
    squish(by) {
      this.W.kill((by && by.squishCause) || '圧死。ぺちゃんこ。');
    }
    hitbox() {
      return { x: this.x, y: this.y, w: this.w, h: this.h };
    }
    update(inp) {
      if (!this.alive) return;
      const W = this.W,
        g = W.gravity;
      const lock = W.inputLock > 0;
      const L = !lock && inp.left,
        R = !lock && inp.right;
      const jP = !lock && inp.jumpP,
        jR = lock || inp.jumpR,
        jH = !lock && inp.jump;
      let dir = (R ? 1 : 0) - (L ? 1 : 0);
      if (W.reverse) dir = -dir;
      if (dir) this.face = dir;

      const wasGround = this.onGround;
      this.onGround = this.grounded();
      if (this.onGround) {
        this.coyote = PHYS.COYOTE;
        this.djump = true;
        if (!wasGround && this.vy * g >= 0) {
          this.landT = 6;
          W.dust(this.cx, g === 1 ? this.y + this.h : this.y, 3);
        }
      } else if (this.coyote > 0) this.coyote--;

      if (jP) this.jbuf = PHYS.BUFFER;
      let jumpedNow = false;
      if (this.jbuf > 0) {
        if (this.coyote > 0) {
          this.vy = -PHYS.JUMP * g;
          this.coyote = 0;
          this.jbuf = 0;
          this.onGround = false;
          jumpedNow = true;
          G.sfx('jump');
        } else if (this.djump) {
          this.vy = -PHYS.DJUMP * g;
          this.djump = false;
          this.jbuf = 0;
          jumpedNow = true;
          G.sfx('djump');
          W.puff(this.cx, g === 1 ? this.y + this.h : this.y);
        } else this.jbuf--;
        // 先行入力で跳んだ時、既にボタンを離していれば小ジャンプ
        if (jumpedNow && !jH) this.vy *= PHYS.CUT;
      }
      if (jR && !jumpedNow && this.vy * g < 0) this.vy *= PHYS.CUT;

      if (this.onGround && this.vy * g >= 0) {
        this.vy = 0;
      } else {
        this.vy += PHYS.GRAV * g * (W.gravScale || 1);
        if (this.vy * g > PHYS.MAXFALL) this.vy = PHYS.MAXFALL * g;
      }

      // 足場の影響（ベルトコンベア等）
      let ex = W.windX || 0;
      if (this.onGround) {
        for (const e of W.ents) {
          if (e.alive && e.solid && e.conveyor && e.collidable && this.isRiding(e)) {
            ex += e.conveyor;
            break;
          }
        }
      }
      this.vx = dir * PHYS.RUN;
      this.moveX(this.vx + ex);
      this.moveY(this.vy, () => {
        if (this.vy * g < 0) G.sfx('bonk');
        this.vy = 0;
      });

      if (dir && this.onGround) this.runT++;
      else this.runT = 0;
      if (this.landT > 0) this.landT--;

      // ショット（押しっぱなしで連射）
      if (this.shootCd > 0) this.shootCd--;
      const sP = !lock && inp.shootP,
        sH = !lock && (inp.shoot || (W.autoFire && G.autoShot));
      if (!W.noShoot && (sP || (sH && this.shootCd <= 0))) {
        if (W.bullets.filter((b) => !b.hostile).length < 4) {
          W.bullets.push(new Bullet(W, this.cx + this.face * 5, this.y + (g === 1 ? 7 : 6), this.face));
          G.sfx('shoot');
          this.shootCd = 9;
        }
      }
      this.jumpHeld = jH;
    }
  }
  G.Player = Player;

  // ------------------------------------------------------------------
  // 弾
  // ------------------------------------------------------------------
  class Bullet {
    constructor(W, x, y, dir) {
      this.W = W;
      this.x = x;
      this.y = y;
      this.vx = 6 * dir;
      this.vy = 0;
      this.life = 46;
      this.alive = true;
      this.hostile = false;
      this.t = 0;
    }
    box() {
      return { x: this.x - 2, y: this.y - 2, w: 4, h: 4 };
    }
    update() {
      const W = this.W;
      this.t++;
      // 高速なので2分割で判定
      for (let k = 0; k < 2 && this.alive; k++) {
        this.x += this.vx / 2;
        this.y += this.vy / 2;
        if (this.x < -10 || this.x > SW + 10 || this.y < -10 || this.y > SH + 10) {
          this.alive = false;
          return;
        }
        const hit = W.pointSolid(this.x, this.y);
        if (hit) {
          if (hit !== true && hit.invisible) hit.reveal();
          if (hit !== true && hit.onShot && hit.shootable) {
            if (hit.onShot(this) !== false) this.alive = false;
          } else this.alive = false;
          if (!this.alive) W.spark(this.x, this.y);
          return;
        }
        const b = this.box();
        for (const e of W.ents) {
          if (!e.alive || !e.shootable) continue;
          const sb = e.shotBox ? e.shotBox() : e;
          if (G.overlap(b, sb)) {
            if (e.onShot(this) !== false) {
              this.alive = false;
              return;
            }
          }
        }
        if (this.hostile && W.player.alive && this.t > 3 && G.overlap(b, W.player)) {
          W.kill('自分の弾で死んだ。反射には気をつけよう。');
          this.alive = false;
          return;
        }
      }
      if (--this.life <= 0) this.alive = false;
    }
  }
  G.Bullet = Bullet;

  // ------------------------------------------------------------------
  // ワールド（1画面＝1部屋）
  // ------------------------------------------------------------------
  class World {
    constructor(game, id, opts) {
      opts = opts || {};
      const def = G.ROOMS[id];
      if (!def) throw new Error('room not found: ' + id);
      this.game = game;
      this.id = id;
      this.def = def;
      this.opts = opts;
      this.theme = def.theme || 'grass';
      this.exits = Object.assign({}, def.exits || {});
      this.easy = !!(game && game.diff === 'easy');
      this.rng = new G.RNG(strHash(id) ^ (opts.seed || 0));
      this.time = 0;
      this.ents = [];
      this.cos = [];
      this.triggers = [];
      this.bullets = [];
      this.particles = [];
      this.texts = [];
      this.gravity = 1;
      this.gravScale = 1;
      this.windX = 0;
      this.reverse = false;
      this.inputLock = 0;
      this.noShoot = false;
      this.shake = 0;
      this.flash = 0;
      this.flashColor = '#ffffff';
      this.dark = 0;
      this.tilesDirty = true;
      this.vars = {};
      this.god = !!G.god;
      this.lives = null; // ボス戦の残機（やさしいモードのみ）
      this.invuln = 0;
      this.marksMap = {};
      this.spawnPoint = null;
      this.parse(def.map);

      let px, py, face = 1;
      if (opts.enter) {
        px = opts.enter.x;
        py = opts.enter.y;
        face = opts.enter.face;
      } else if (opts.spawn) {
        px = opts.spawn.x;
        py = opts.spawn.y;
        face = opts.spawn.face || 1;
      } else {
        const m = this.mark('@') || { x: T, y: (ROWS - 3) * T };
        px = m.x + (T - PHYS.PW) / 2;
        py = m.y + T - PHYS.PH;
      }
      this.player = new Player(this, px, py);
      this.player.face = face;
      if (opts.enter) {
        const e = opts.enter;
        this.player.vy = e.vy;
        this.player.djump = e.djump;
        this.player.xr = e.xr || 0;
        this.player.yr = e.yr || 0;
        this.player.jumpHeld = e.jumpHeld;
      }
      if (def.setup) def.setup(this, opts);
    }

    parse(map) {
      if (!map || map.length !== ROWS) throw new Error(`${this.id}: map rows ${map && map.length}`);
      this.tiles = new Uint8Array(COLS * ROWS);
      for (let ty = 0; ty < ROWS; ty++) {
        const row = map[ty];
        if (row.length !== COLS) throw new Error(`${this.id}: row ${ty} has ${row.length} cols`);
        for (let tx = 0; tx < COLS; tx++) {
          const ch = row[tx];
          const code = CHARS[ch];
          if (code) this.tiles[ty * COLS + tx] = code;
          else if (ch !== '.' && ch !== ' ') {
            (this.marksMap[ch] = this.marksMap[ch] || []).push({ tx, ty, x: tx * T, y: ty * T });
          }
        }
      }
      for (const m of this.marksMap.S || []) this.add(new G.SavePoint(this, m.tx, m.ty));
      if (this.easy) for (const m of this.marksMap.s || []) this.add(new G.SavePoint(this, m.tx, m.ty, { easy: true }));
    }
    mark(ch) {
      const a = this.marksMap[ch];
      return a ? a[0] : null;
    }
    marks(ch) {
      return this.marksMap[ch] || [];
    }

    // ---- タイル ----
    tile(tx, ty) {
      if (tx < 0) return this.exits.left ? 0 : 1;
      if (tx >= COLS) return this.exits.right ? 0 : 1;
      if (ty < 0) return this.exits.up ? 0 : 1;
      if (ty >= ROWS) return 0;
      return this.tiles[ty * COLS + tx];
    }
    setTile(tx, ty, code) {
      if (tx < 0 || ty < 0 || tx >= COLS || ty >= ROWS) return;
      this.tiles[ty * COLS + tx] = code;
      this.tilesDirty = true;
    }
    solidAt(x, y, w, h) {
      const tx0 = Math.floor(x / T),
        tx1 = Math.floor((x + w - 0.001) / T);
      const ty0 = Math.floor(y / T),
        ty1 = Math.floor((y + h - 0.001) / T);
      for (let ty = ty0; ty <= ty1; ty++)
        for (let tx = tx0; tx <= tx1; tx++) if (isSolidCode(this.tile(tx, ty))) return true;
      for (const e of this.ents) {
        if (e.solid && e.collidable && !e.oneway && e.alive && x < e.x + e.w && x + w > e.x && y < e.y + e.h && y + h > e.y)
          return e;
      }
      return false;
    }
    onewayAt(x, w, feet, g) {
      const tx0 = Math.floor(x / T),
        tx1 = Math.floor((x + w - 0.001) / T);
      if (feet % T === 0) {
        const ty = g === 1 ? feet / T : feet / T - 1;
        if (ty >= 0 && ty < ROWS)
          for (let tx = tx0; tx <= tx1; tx++) if (this.tile(tx, ty) === TILE.PLAT) return true;
      }
      for (const e of this.ents) {
        if (!e.alive || !e.oneway || !e.collidable) continue;
        if (x + w <= e.x || x >= e.x + e.w) continue;
        if (g === 1 ? e.y === feet : e.y + e.h === feet) return e;
      }
      return false;
    }
    pointSolid(x, y) {
      const tx = Math.floor(x / T),
        ty = Math.floor(y / T);
      if (tx >= 0 && tx < COLS && ty >= 0 && ty < ROWS && isSolidCode(this.tiles[ty * COLS + tx])) return true;
      for (const e of this.ents) {
        if (e.alive && e.solid && !e.oneway && (e.collidable || e.invisible) && x >= e.x && x < e.x + e.w && y >= e.y && y < e.y + e.h)
          return e;
      }
      return false;
    }
    tileHazard(r) {
      const tx0 = Math.max(0, Math.floor(r.x / T)),
        tx1 = Math.min(COLS - 1, Math.floor((r.x + r.w - 0.001) / T));
      const ty0 = Math.max(0, Math.floor(r.y / T)),
        ty1 = Math.min(ROWS - 1, Math.floor((r.y + r.h - 0.001) / T));
      for (let ty = ty0; ty <= ty1; ty++)
        for (let tx = tx0; tx <= tx1; tx++) {
          const c = this.tiles[ty * COLS + tx];
          if (c >= 10 && G.rectTri(r, G.spikeTri(tx * T, ty * T, T, T, SPIKE_DIR[c]))) return true;
        }
      return false;
    }

    // ---- エンティティ・スクリプト ----
    add(e) {
      this.ents.push(e);
      return e;
    }
    run(gen, owner) {
      const co = { it: gen.call(this, this), wait: 0, owner, done: false };
      this.cos.push(co);
      return co;
    }
    after(frames, fn) {
      return this.run(function* () {
        yield frames;
        fn();
      });
    }
    trig(tx, ty, tw, th, fn, o) {
      return this.trigPx(tx * T, ty * T, tw * T, th * T, fn, o);
    }
    trigPx(x, y, w, h, fn, o) {
      o = o || {};
      const t = { x, y, w, h, fn, once: o.once !== false, cond: o.cond, done: false, inside: false, enterOnly: o.enter };
      this.triggers.push(t);
      return t;
    }
    stepCos() {
      for (let i = 0; i < this.cos.length; i++) {
        const c = this.cos[i];
        if (c.done) continue;
        if (c.owner && !c.owner.alive) {
          c.done = true;
          continue;
        }
        if (typeof c.wait === 'function') {
          if (!c.wait()) continue;
        } else if (c.wait > 0) {
          c.wait--;
          continue;
        }
        const r = c.it.next();
        if (r.done) c.done = true;
        else c.wait = r.value === undefined ? 0 : r.value;
      }
      if (this.cos.length > 32) this.cos = this.cos.filter((c) => !c.done);
    }

    kill(cause) {
      const P = this.player;
      if (!P.alive || this.god || this.invuln > 0) return;
      // やさしいモードのボス戦：残機があれば1つ減らして耐える
      if (this.lives != null && this.lives > 1) {
        this.lives--;
        this.invuln = 100;
        this.shake = 10;
        this.flash = 5;
        this.flashColor = '#ff6a8a';
        P.vy = -3.2 * this.gravity;
        P.djump = true;
        G.sfx('hurt');
        G.vibrate(30);
        this.say(`のこり ${this.lives}`, P.cx, P.y - 4, 60, { plain: true, size: 11, color: '#ff9aaa' });
        this.burst(P.cx, P.cy, 14, ['#ff6a8a', '#ffffff'], 2, { g: 0.05, life: 20 });
        return;
      }
      P.alive = false;
      this.deathCause = cause || 'トゲに刺さった。';
      this.blood(P.cx, P.cy);
      this.shake = 14;
      this.flash = 6;
      this.flashColor = '#ff2040';
      G.sfx('death');
      G.vibrate(60);
      if (this.onPlayerDeath) this.onPlayerDeath();
      if (this.game && this.game.onDeath) this.game.onDeath(this.deathCause);
    }

    step(inp) {
      this.time++;
      if (this.inputLock > 0) this.inputLock--;
      if (this.invuln > 0) this.invuln--;
      this.playerBlink = this.invuln > 0;
      this.stepCos();
      for (let i = 0; i < this.ents.length; i++) {
        const e = this.ents[i];
        if (e.alive) e.update();
      }
      const P = this.player;
      P.update(inp);
      for (const b of this.bullets) if (b.alive) b.update();
      if (P.alive) {
        for (const t of this.triggers) {
          if (t.done) continue;
          const inside = G.overlap(P, t);
          if (inside && (!t.enterOnly || !t.inside) && (!t.cond || t.cond(P))) {
            if (t.once) t.done = true;
            t.fn(P);
          }
          t.inside = inside;
        }
      }
      if (P.alive) {
        const r = P.hitbox();
        if (this.tileHazard(r)) this.kill(this.def.spikeCause || G.pickSpikeCause(this));
        else {
          for (const e of this.ents) {
            if (e.alive && e.hazard && e.hits(r)) {
              this.kill(typeof e.cause === 'function' ? e.cause() : e.cause);
              break;
            }
          }
        }
      }
      if (P.alive) this.checkExits();
      if (this.ents.length > 8 && this.time % 30 === 0) this.ents = this.ents.filter((e) => e.alive);
      this.bullets = this.bullets.filter((b) => b.alive);
      if (this.onStep) this.onStep();
      this.updateParticles();
      if (this.shake > 0) this.shake--;
      if (this.flash > 0) this.flash--;
    }

    checkExits() {
      const P = this.player;
      const cx = P.x + P.w / 2,
        cy = P.y + P.h / 2;
      const go = (dir) => this.game && this.game.changeRoom && this.game.changeRoom(dir);
      if (cx >= SW && this.exits.right) return go('right');
      if (cx < 0 && this.exits.left) return go('left');
      if (cy < 0 && this.exits.up) return go('up');
      if (P.y >= SH) {
        if (this.exits.down) return go('down');
        this.kill(this.def.pitCause || '奈落へ落ちた。');
      }
      if (P.y + P.h <= -4 && this.gravity === -1 && !this.exits.up) this.kill('空へ落ちた。');
    }

    // ---- パーティクル（演出のみ。ヘッドレスでは無効） ----
    addP(p) {
      if (G.headless) return;
      if (this.particles.length > 600) this.particles.shift();
      this.particles.push(p);
    }
    blood(x, y) {
      if (G.headless) return;
      const R = G.fx;
      for (let i = 0; i < 90; i++) {
        const a = R.range(0, Math.PI * 2),
          s = R.range(0.5, 5.5);
        this.addP({
          x, y, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 1.5, g: 0.2, life: 400 + R.int(0, 200),
          c: R.chance(0.7) ? '#c8102e' : R.chance(0.5) ? '#ff3344' : '#7a0018', s: R.chance(0.3) ? 2 : 1, stick: true,
        });
      }
      for (let i = 0; i < 6; i++) {
        this.addP({ x, y, vx: R.range(-2, 2), vy: R.range(-4, -1), g: 0.25, life: 600, c: '#ffd6b0', s: 2, stick: true });
      }
    }
    dust(x, y, n) {
      if (G.headless) return;
      const R = G.fx;
      for (let i = 0; i < n; i++)
        this.addP({ x: x + R.range(-4, 4), y: y - 1, vx: R.range(-0.6, 0.6), vy: R.range(-0.6, -0.1), g: 0, life: 14, c: 'rgba(255,255,255,0.6)', s: 1, fade: true });
    }
    puff(x, y) {
      if (G.headless) return;
      const R = G.fx;
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        this.addP({ x, y, vx: Math.cos(a) * 1.2, vy: Math.sin(a) * 0.5 + 0.3, g: 0, life: 16, c: 'rgba(200,230,255,0.8)', s: 1, fade: true });
      }
    }
    spark(x, y, c) {
      if (G.headless) return;
      const R = G.fx;
      for (let i = 0; i < 5; i++)
        this.addP({ x, y, vx: R.range(-1.5, 1.5), vy: R.range(-1.5, 1.5), g: 0, life: 10, c: c || '#fff6a0', s: 1, fade: true });
    }
    burst(x, y, n, colors, speed, opts) {
      if (G.headless) return;
      const R = G.fx;
      opts = opts || {};
      for (let i = 0; i < n; i++) {
        const a = R.range(0, Math.PI * 2),
          s = R.range(0.3, speed || 3);
        this.addP({
          x: x + R.range(-(opts.spread || 0), opts.spread || 0), y: y + R.range(-(opts.spread || 0), opts.spread || 0),
          vx: Math.cos(a) * s, vy: Math.sin(a) * s - (opts.up || 0), g: opts.g == null ? 0.1 : opts.g,
          life: opts.life || R.int(20, 50), c: R.pick(colors), s: opts.size || R.int(1, 2), fade: opts.fade !== false, stick: opts.stick,
        });
      }
    }
    updateParticles() {
      const ps = this.particles;
      for (let i = ps.length - 1; i >= 0; i--) {
        const p = ps[i];
        p.life--;
        if (p.life <= 0) {
          ps.splice(i, 1);
          continue;
        }
        if (p.stuck) continue;
        p.vy += p.g || 0;
        if (p.vy > 6) p.vy = 6;
        const nx = p.x + p.vx,
          ny = p.y + p.vy;
        if (p.stick) {
          const tx = Math.floor(nx / T),
            ty = Math.floor(ny / T);
          if (tx >= 0 && tx < COLS && ty >= 0 && ty < ROWS && isSolidCode(this.tiles[ty * COLS + tx])) {
            p.stuck = true;
            continue;
          }
        }
        p.x = nx;
        p.y = ny;
        if (p.y > SH + 20) p.life = 0;
      }
    }

    // 画面テキスト（吹き出し等）
    say(text, x, y, frames, opts) {
      const t = Object.assign({ text, x, y, life: frames || 120, max: frames || 120 }, opts || {});
      this.texts.push(t);
      return t;
    }
  }
  G.World = World;

  G.SPIKE_CAUSES = [
    'トゲに刺さった。',
    'トゲは痛い。知ってた。',
    'トゲに触れてはいけない。',
    'トゲの先端は鋭い。',
    'トゲと仲良くなれなかった。',
  ];
  G.pickSpikeCause = (W) => G.SPIKE_CAUSES[(W.time + (W.game ? W.game.deaths : 0)) % G.SPIKE_CAUSES.length];
})();
