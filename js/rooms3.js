// 4面（エリア9）月の裏側：真ん中の部屋から東・南・北へ分かれ、謎を解いて「月のかけら」を3つ集める
(function () {
  'use strict';
  const G = globalThis.G;
  const T = G.T;
  const R = G.ROOMS;
  const Ent = G.Ent;
  const shotHint = () => (G.isTouch ? 'SHOT' : 'X');

  // ---------------------------------------------------------------------
  // 4面の小物
  // ---------------------------------------------------------------------
  // 扉：開いていれば触れると別の部屋へ。kill を渡すと入った瞬間に死ぬ扉（ハズレ）
  class Door extends Ent {
    constructor(W, tx, ty, o) {
      super(W, tx * T, ty * T, T, T * 2);
      this.to = o.to;
      this.spawn = o.spawn;
      this.open = o.open !== false;
      this.label = o.label || '';
      this.kill = o.kill;
      this.locked = o.locked;
      this.big = !!o.big;
      this.layer = -0.8;
      this.used = false;
      if (this.big) {
        this.x -= T / 2;
        this.w = T * 2;
      }
    }
    tick() {
      const W = this.W,
        P = W.player;
      if (this.used || !P.alive) return;
      const hit = G.overlap(P, { x: this.x + 4, y: this.y + 4, w: this.w - 8, h: this.h - 4 });
      if (!hit) return;
      if (!this.open) {
        if (this.locked) W.kill(this.locked);
        return;
      }
      this.used = true;
      if (this.kill) return W.kill(this.kill);
      G.sfx('door');
      W.vars.goal = this.to;
      if (W.game && W.game.warp) W.game.warp(this.to, this.spawn[0], this.spawn[1]);
    }
    draw(ctx) {
      G.Render.drawDoor(ctx, this);
    }
  }
  G.World.prototype.door = function (tx, ty, o) {
    return this.add(new Door(this, tx, ty, o));
  };

  // 月のかけら（3つ集めると真ん中の扉が開く）
  class Piece extends Ent {
    constructor(W, cx, cy, flag, o) {
      super(W, cx - 7, cy - 7, 14, 14);
      this.flag = flag;
      this.fake = !!(o && o.fake);
      this.layer = o && o.layer != null ? o.layer : 2;
      this.cause = o && o.cause;
    }
    tick() {
      const W = this.W,
        P = W.player;
      this.y += Math.sin(this.t * 0.08) * 0.15;
      if (!P.alive || !G.overlap(P, this)) return;
      if (this.fake) {
        this.alive = false;
        W.burst(this.cx, this.cy, 40, ['#ff5a10', '#ffd84a', '#ffffff'], 3, { g: 0.1 });
        G.sfx('explode');
        W.kill(this.cause || 'かけらは偽物だった。');
        return;
      }
      this.alive = false;
      if (W.game) {
        W.game.flags[this.flag] = true;
        if (W.game.writePersist) W.game.writePersist();
      }
      const n = ['piece1', 'piece2', 'piece3'].filter((f) => W.game && W.game.flags[f]).length;
      G.sfx('fanfare');
      W.burst(this.cx, this.cy, 30, ['#fff6c0', '#ffd84a', '#ffffff'], 2.5, { g: 0, life: 40 });
      W.say(`月のかけらを手に入れた！（${n}/3）`, 240, 90, 120, { plain: true, size: 13, color: '#fff2a8' });
      if (this.onGet) this.onGet();
    }
    draw(ctx) {
      G.Render.drawPiece(ctx, this);
    }
  }
  G.World.prototype.piece = function (cx, cy, flag, o) {
    if (!(o && o.fake) && this.game && this.game.flags[flag]) return null;
    return this.add(new Piece(this, cx, cy, flag, o));
  };

  // 撃つと点く印つきスイッチ（順番の謎解き用）
  class MarkSwitch extends Ent {
    constructor(W, tx, ty, mark, onHit) {
      super(W, tx * T + 2, ty * T + 2, T - 4, T - 4);
      this.mark = mark;
      this.onHit = onHit;
      this.shootable = true;
      this.on = false;
      this.layer = 1;
    }
    onShot() {
      if (!this.on && this.onHit) this.onHit(this);
      return true;
    }
    draw(ctx) {
      G.Render.drawMarkSwitch(ctx, this);
    }
  }

  const haveAll = (W) => !!(W.game && W.game.flags.piece1 && W.game.flags.piece2 && W.game.flags.piece3);

  // =====================================================================
  // AREA 9 月の裏側
  // =====================================================================
  R['9-1'] = {
    hint: '旗は倒れてくるので、一度近づいて倒させてから跳び越えよう。足場の下はうさぎの餅に注意。',
    area: 9,
    name: '9-1 月の裏側',
    theme: 'moon',
    bg: 'farside',
    exits: { left: '8-B', right: '9-H' },
    edgeOk: ['left'], // 8-B の右の扉は3面クリア後に開く
    map: [
      '########################',
      '#......................#',
      '#......................#',
      '#......................#',
      '#......................#',
      '#......................#',
      '#......................#',
      '#......................#',
      '#.........----.........#',
      '........................',
      '........................',
      '..S.....................',
      '#####...######...#######',
      '#####^^^######^^^#######',
    ],
    setup(W) {
      W.sign(4, 11, '月の裏側へようこそ\n（地球がきれいに見えます）', { range: 30 });
      // ① 人類の旗：そばを通ると進む向きに倒れてくる
      W.decor(9 * T, 9 * T, 'moonflag', { h: 40 });
      const pole = W.hbox(0, 0, 1, 1, { cause: '人類の偉大な一歩に踏まれた。' });
      pole.alive = false;
      W.trigPx(176, 0, 20, 280, () => {
        const dir = W.player.vx < 0 ? -1 : 1;
        W.after(8, () => {
          for (const e of W.ents) if (e.kind === 'moonflag') e.fallen = dir;
          const hb = W.hbox(dir > 0 ? 198 : 122, 226, 60, 14, { kind: 'flagpole', cause: '人類の偉大な一歩に踏まれた。' });
          hb.life = 30;
          W.shake = 6;
          G.sfx('stomp');
        });
      }, { cond: (P) => P.onGround });
      // ② 足場の上のうさぎが餅を落とす
      W.decor(236, 140, 'rabbit');
      W.trigPx(214, 0, 48, 280, () => {
        W.after(6, () => {
          const m = W.fruit(244, 156, { kind: 'mochi', r: 8, cause: 'うさぎの餅つきに巻きこまれた。', splat: true });
          m.vel(0, 2, 0, 0.6);
          G.sfx('whoosh');
        });
      }, { cond: (P) => P.onGround });
      // ③ 2つ目のクレーターを跳ぶと隕石
      W.trigPx(276, 0, 70, 280, () => {
        const r = W.fruit(316, -12, { kind: 'rock', r: 8, cause: 'クレーターは今まさにできるところだった。' });
        r.vel(0, 7);
        G.sfx('whoosh');
      }, { cond: (P) => !P.onGround });
    },
  };

  R['9-H'] = {
    hint: '真ん中の扉はかけらが3つ揃うまで触ると危ない（跳び越えよう）。東は順番、南は重力、北は看板の謎。',
    area: 9,
    name: '9-H 三つの道',
    theme: 'moon',
    bg: 'farside',
    exits: { left: '9-1', right: '9-B1', up: '9-A1', down: '9-C1' },
    map: [
      '###...##################',
      '#......................#',
      '#......................#',
      '#..---.................#',
      '#......................#',
      '#......................#',
      '#.----.................#',
      '#......................#',
      '#......................#',
      '..----..................',
      '........................',
      '.......S................',
      '##################...###',
      '##################...###',
    ],
    setup(W) {
      W.sign(9, 11, '↑北：うそつき看板\n→東：順番の間\n↓南：重力の部屋', { range: 30 });
      const all = haveAll(W);
      W.door(12, 10, {
        to: '9-X', spawn: [2, 11], big: true, open: all,
        locked: 'せっかちは身を滅ぼす。かけらを3つ集めてから。',
      });
      W.vars.sockets = ['piece1', 'piece2', 'piece3'].map((f) => !!(W.game && W.game.flags[f]));
      if (all) W.say('扉が開いている……', 240, 160, 90, { plain: true, size: 11, color: '#fff2a8' });
    },
    drawFg(ctx, W) {
      G.Render.drawSockets(ctx, W, 240, 182);
    },
  };

  // ------------------------- 東 -------------------------
  R['9-B1'] = {
    hint: '「朝に昇り・夜に笑い・願いをかなえる」＝太陽→月→星の順に撃つ。間違えたら足場の上へ逃げよう。',
    area: 9,
    name: '9-B1 順番の間',
    theme: 'moon',
    bg: 'farside',
    exits: { left: '9-H', right: '9-B2' },
    map: [
      '########################',
      '#......................#',
      '#......................#',
      '#......................#',
      '#......................#',
      '#......................#',
      '#..........---.........#',
      '#......................#',
      '#......................#',
      '......---...............',
      '........................',
      '........................',
      '########################',
      '########################',
    ],
    setup(W) {
      W.sign(3, 11, '朝に昇るもの、夜に笑うもの、\n願いをかなえるもの。\nその順に撃て。', { range: 34 });
      const gate = W.block(22, 9, 1, 3, { style: 'gate', keep: true });
      const solved = W.game && W.game.flags.orderSolved;
      if (solved) gate.alive = false;
      const order = ['sun', 'moon', 'star'];
      let got = [];
      const sws = [];
      const spikes = [];
      for (let tx = 1; tx <= 21; tx++) spikes.push(W.spike(tx, 11, 'u', { hidden: true, cause: '順番が違う。', pal: 'crystal' }));
      const reset = () => {
        got = [];
        sws.forEach((s) => (s.on = false));
      };
      const hit = (s) => {
        s.on = true;
        G.sfx('switch');
        got.push(s.mark);
        const ok = got.every((m, i) => m === order[i]);
        if (!ok) {
          G.sfx('trap');
          W.say('ブブーッ', 240, 120, 50, { plain: true, size: 14, color: '#ff6a8a' });
          // 床一面からトゲ（足場の上なら助かる）
          W.after(50, () => spikes.forEach((sp) => sp.pop(3, false)));
          W.after(110, () => {
            spikes.forEach((sp) => {
              sp.popped = false;
              sp.hazard = false;
              sp.oy = 20;
            });
            reset();
          });
          return;
        }
        if (got.length === order.length) {
          G.sfx('fanfare');
          W.say('正解！', 240, 120, 60, { plain: true, size: 14, color: '#9affc0' });
          if (W.game) W.game.flags.orderSolved = true;
          gate.tweenTo(gate.x, gate.y - 70, 40, 'inOutQuad', () => gate.kill());
        }
      };
      if (!solved) {
        sws.push(W.add(new MarkSwitch(W, 3, 8, 'star', hit)));
        sws.push(W.add(new MarkSwitch(W, 20, 5, 'sun', hit)));
        sws.push(W.add(new MarkSwitch(W, 18, 11, 'moon', hit)));
      }
    },
  };

  R['9-B2'] = {
    hint: '目の前のかけらは偽物。本物は右の壁の中（壁はすり抜けられる）。下の穴は南の部屋へ。',
    area: 9,
    name: '9-B2 壁の中',
    theme: 'moon',
    bg: 'farside',
    exits: { left: '9-B1', down: '9-C2' },
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
      '.....................FF#',
      '.....................FF#',
      '.....................FF#',
      '################...#####',
      '################...#####',
    ],
    setup(W) {
      W.sign(4, 11, 'かけらはこの先\n（本物は壁の中）', { range: 30 });
      W.piece(250, 226, 'piece1', { fake: true, cause: 'かけらは偽物だった。看板をよく読もう。' });
      W.piece(450, 230, 'piece1', { layer: -1 });
    },
  };

  // ------------------------- 南 -------------------------
  R['9-C1'] = {
    hint: 'かけらは天井。真ん中の光るオーブは二度ひっくり返る罠。右端の小さなオーブで天井へ。天井の穴から上の部屋へ帰れる。',
    area: 9,
    name: '9-C1 重力の部屋',
    theme: 'moon',
    bg: 'farside',
    exits: { up: '9-H', right: '9-C2' },
    map: [
      '##################...###',
      '#.......vv...v.........#',
      '#......................#',
      '#......................#',
      '#......................#',
      '#......................#',
      '#......................#',
      '#......................#',
      '#......................#',
      '#.......................',
      '#.......................',
      '#.......................',
      '#####^^^^^^^^^^^########',
      '########################',
    ],
    spikeCauseFn: (W) => (W.gravity === -1 || W.vars.flipped ? '天井に落ちた。' : null),
    setup(W) {
      W.sign(20, 11, 'かけらは上にある', { range: 30 });
      // 目立つオーブは二度ひっくり返る罠
      const fake = W.orb(300, 196, { fakeDouble: true });
      fake.big = true;
      // 本物は右端の小さなオーブ（上向き重力にする）
      W.orb(452, 206, { dir: 2 });
      W.onStep = () => {
        if (W.gravity === -1) W.vars.flipped = true;
      };
      W.piece(46, 36, 'piece2');
    },
  };

  R['9-C2'] = {
    hint: '看板の前ではなく、離れた所で5秒じっとしていると足場が現れる。足場を登ると東の部屋へ。',
    area: 9,
    name: '9-C2 待ての間',
    theme: 'moon',
    bg: 'farside',
    exits: { left: '9-C1', up: '9-B2' },
    map: [
      '################...#####',
      '#......................#',
      '#......................#',
      '#......................#',
      '#......................#',
      '#......................#',
      '#......................#',
      '#......................#',
      '#......................#',
      '.......................#',
      '.......................#',
      '.......................#',
      '########################',
      '########################',
    ],
    setup(W) {
      W.sign(9, 11, '動かずに\n5秒待て', { range: 30 });
      const solved = W.game && W.game.flags.waitSolved;
      const steps = [];
      const makeSteps = () => {
        for (const [tx, ty] of [[14, 9], [16, 6], [17, 3]]) steps.push(W.block(tx, ty, 3, 1, { oneway: true, code: 3, keep: true }));
      };
      if (solved) {
        makeSteps();
        return;
      }
      W.vars.wait = 0;
      let dropped = false;
      W.onStep = () => {
        const P = W.player;
        if (W.vars.wait < 0 || !P.alive) return;
        const still = P.onGround && !P.vx && !P.jumpHeld;
        W.vars.wait = still ? W.vars.wait + 1 : 0;
        if (!still) dropped = false;
        // 4秒過ぎたところで看板の前にリンゴ
        if (W.vars.wait === 250 && !dropped) {
          dropped = true;
          const a = W.fruit(190, 28, { cause: '待てと言ったが、そこで待てとは言っていない。', splat: true });
          a.vel(0, 5, 0, 0.6);
        }
        if (W.vars.wait >= 300) {
          W.vars.wait = -1;
          if (W.game) W.game.flags.waitSolved = true;
          G.sfx('fanfare');
          W.say('よく待てました', 240, 120, 60, { plain: true, size: 13, color: '#9affc0' });
          makeSteps();
        }
      };
    },
    drawFg(ctx, W) {
      if (W.vars.wait > 30) G.Render.drawWaitMeter(ctx, W.vars.wait / 300);
    },
  };

  // ------------------------- 北 -------------------------
  R['9-A1'] = {
    hint: '本当のことを言う看板は1つだけ。Aが正しいとBとCが本当になり、Cが正しいとBとCが本当になる。……正解はB。',
    area: 9,
    name: '9-A1 うそつき看板の間',
    theme: 'moon',
    bg: 'farside',
    exits: { down: '9-H' },
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
      '#......................#',
      '###...##################',
      '###...##################',
    ],
    setup(W) {
      W.sign(7, 11, '本当のことを言う看板は\nひとつだけ。\n正しい扉もひとつだけ。', { range: 30 });
      W.sign(9, 11, 'A：正しい扉は\nここだ', { range: 18 });
      W.sign(13, 11, 'B：正しい扉は\nAではない', { range: 18 });
      W.sign(17, 11, 'C：正しい扉は\nBではない', { range: 18 });
      W.door(10, 10, { to: '9-A1', spawn: [1, 11], label: 'A', kill: '扉の先は宇宙だった。息ができない。' });
      W.door(14, 10, { to: '9-A2', spawn: [2, 11], label: 'B' });
      W.door(18, 10, { to: '9-A1', spawn: [1, 11], label: 'C', kill: '扉の先はトゲの壁だった。' });
    },
  };

  R['9-A2'] = {
    hint: 'かけらの下の床は偽物。横の足場から跳んで取ろう。左は秘密の部屋、右の扉で戻れる。',
    area: 9,
    name: '9-A2 月のかけら',
    theme: 'moon',
    bg: 'farside',
    exits: { left: '9-A3' },
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
      '#.......---....---.....#',
      '.......................#',
      '.......................#',
      '..S....................#',
      '##########FFF###########',
      '##########^^^###########',
    ],
    spikeCauseFn: () => 'かけらの下は空洞だった。',
    setup(W) {
      const p = W.piece(236, 176, 'piece3');
      if (p) p.onGet = () => W.say('……それ、ぼくの歯なんだけど', 240, 60, 90, {});
      W.door(21, 10, { to: '9-A1', spawn: [14, 11], label: '↩' });
      W.sign(4, 11, '←ひみつの部屋', { range: 24 });
    },
  };

  R['9-A3'] = {
    hint: 'ボタンは押さない方がいい。',
    area: 9,
    name: '9-A3 開発室',
    theme: 'moon',
    bg: 'farside',
    exits: { right: '9-A2' },
    map: [
      '########################',
      '########################',
      '########################',
      '#......................#',
      '#......................#',
      '#......................#',
      '#......................#',
      '#......................#',
      '#......................#',
      '#.......................',
      '#.......................',
      '#.......S...............',
      '########################',
      '########################',
    ],
    setup(W) {
      W.sign(3, 11, '開発室\n（関係者以外立ち入り禁止）', { range: 30 });
      W.sign(12, 11, 'トゲは全部手作業で\n置きました', { range: 26 });
      W.sign(16, 11, 'リンゴの動きは\n毎回同じです', { range: 26 });
      W.sign(20, 11, `このボタンを${shotHint()}で撃つと\nゲームクリア`, { range: 30 });
      // 押すとクリア……のはずが天井が落ちてくる
      const ceil = W.block(1, 3, 22, 2, { style: 'stone', keep: true, squishCause: 'そんなボタンがあるわけない。' });
      for (let tx = 1; tx <= 22; tx++) for (let ty = 1; ty <= 2; ty++) W.setTile(tx, ty, 1);
      W.switchAt(5, 11, () => {
        G.sfx('fanfare');
        W.text(240, 110, 'GAME CLEAR!!', { size: 22, color: '#ffe9a8' });
        W.after(70, () => {
          ceil.vel(0, 1, 0, 0.6);
          G.sfx('rumble');
        });
      });
    },
  };

  // ------------------------- 月の中心 -------------------------
  R['9-X'] = {
    hint: 'セーブ弾は落ちる所を見てよけ、「上書き」の線からは離れよう。',
    area: 9,
    name: '月の中心',
    theme: 'moon',
    bg: 'farside',
    music: null,
    exits: {},
    goal: 'boss',
    map: [
      '########################',
      '#......................#',
      '#......................#',
      '#......................#',
      '#......................#',
      '#......................#',
      '#......................#',
      '#......................#',
      '#..----..........----..#',
      '#......................#',
      '#......................#',
      '#.S....................#',
      '########################',
      '########################',
    ],
    setup(W, opts) {
      if (W.game && W.game.flags.saveBossDead) {
        W.run(function* () {
          yield 30;
          yield* G.BOSSES.truthEnding(W);
        });
        return;
      }
      G.BOSSES.savepoint(W, opts);
    },
    drawUI(ctx, W, UI) {
      if (W.vars.fakeDelete != null) G.Render.drawFakeDelete(ctx, W.vars.fakeDelete, W.vars.fakeDeleteText);
    },
  };
})();
