// 2面（エリア5〜6）・3面（エリア7〜8）の部屋
// マップ記号は rooms.js と同じ。F は乗ると落ちる偽の床（見た目は地面）
(function () {
  'use strict';
  const G = globalThis.G;
  const T = G.T;
  const R = G.ROOMS;
  const Ent = G.Ent;
  const shotHint = () => (G.isTouch ? 'SHOT' : 'X');

  // ---------------------------------------------------------------------
  // 2面以降の小物
  // ---------------------------------------------------------------------
  // 地面を歩く敵。daruma：背中を向けると追ってくる（見ている間は止まる） walk：決まった向きに歩き続ける
  class Walker extends Ent {
    constructor(W, x, y, o) {
      super(W, x, y, o.w || 14, o.h || 20);
      this.kind = o.kind || 'cactus';
      this.mode = o.mode || 'daruma';
      this.hazard = true;
      this.shootable = o.hp > 0;
      this.hp = o.hp || 0;
      this.cause = o.cause;
      this.speed = o.speed || 2;
      this.dir = o.dir || 1;
      this.stopX = o.stopX;
      this.layer = 2;
      this.fallV = 0;
      this.hurtT = 0;
      this.moving = false;
      this.awake = this.mode !== 'daruma';
      this.offscreenKill = 60;
    }
    tick() {
      const W = this.W,
        P = W.player;
      if (this.hurtT > 0) this.hurtT--;
      let mv = 0;
      if (this.mode === 'daruma') {
        if (!this.awake && P.alive && Math.abs(P.cx - this.cx) < 70) this.awake = true;
        const back = P.alive && Math.sign(P.cx - this.cx) === P.face;
        if (this.awake && back && Math.abs(P.cx - this.cx) > 2) mv = Math.sign(P.cx - this.cx) * this.speed;
      } else if (this.awake) {
        mv = this.dir * this.speed;
        if (this.stopX != null && (this.dir > 0 ? this.cx >= this.stopX : this.cx <= this.stopX)) mv = 0;
      }
      this.moving = !!mv;
      this.x += mv;
      // 足もとに地面がなければ落ちる
      if (!W.solidAt(this.x + 2, this.y + this.h, this.w - 4, 1)) {
        this.fallV = Math.min(6, this.fallV + 0.3);
        this.y += this.fallV;
      } else this.fallV = 0;
      if (this.y > G.H + 20) this.alive = false;
    }
    onShot() {
      if (!this.shootable) return false;
      this.hp--;
      this.hurtT = 4;
      G.sfx('hit');
      if (this.hp <= 0) {
        this.alive = false;
        G.sfx('crumble');
        this.W.burst(this.cx, this.cy, 18, this.kind === 'cactus' ? ['#4aa040', '#8ae060', '#e8d890'] : ['#d8ccb0', '#8a7a60'], 2, { g: 0.15, life: 30 });
      }
      return true;
    }
    draw(ctx) {
      G.Render.drawWalker(ctx, this);
    }
  }
  G.Walker = Walker;
  G.World.prototype.walker = function (x, y, o) {
    return this.add(new Walker(this, x, y, o || {}));
  };

  // 下から突き上げる砂の柱（先端がトゲ）
  function sandPillar(W, tx, tw, topY, o) {
    const p = W.hbox(tx * T + 2, 300, tw * T - 4, 150, { kind: 'pillar', cause: o.cause });
    p.offscreenKill = false;
    p.rise = () => {
      W.run(function* () {
        p.tweenTo(p.x, topY, o.up || 8, 'outQuad');
        G.sfx('pop');
        W.shake = 8;
        yield (o.up || 8) + (o.stay || 40);
        p.tweenTo(p.x, 300, 24, 'inQuad');
      });
    };
    return p;
  }

  // 床の通気口から噴き出す炎（縦のレーザー）
  function fireJet(W, tx, o) {
    return W.laser(tx * T + 4, o.top || 40, 12, 240 - (o.top || 40), { warn: o.warn, dur: o.dur || 30, cause: o.cause || '炎に焼かれた。', color: '#ff7a20' });
  }

  // =====================================================================
  // AREA 5 灼熱の砂漠
  // =====================================================================
  R['5-1'] = {
    hint: 'サボテンには背中を見せず、向き合って撃とう。光る床は蜃気楼。穴の柱が引っこんでから跳び、出口の手前では一度止まろう。',
    area: 5,
    name: '5-1 蜃気楼',
    theme: 'desert',
    bg: 'desert',
    exits: { right: '5-2' },
    map: [
      '.......................#',
      '.......................#',
      '.......................#',
      '.......................#',
      '.......................#',
      '.......................#',
      '.......................#',
      '.......................#',
      '.......................#',
      '........................',
      '........................',
      '.@.S............s.......',
      '#######..####FF###..####',
      '#######^^####^^###^^####',
    ],
    spikeCauseFn: (W) => {
      const x = W.player.cx;
      if (x > 256 && x < 304) return '床は蜃気楼だった。';
      return null;
    },
    setup(W) {
      W.decor(40, 180, 'palm');
      W.decor(170, 222, 'skull');
      W.decor(430, 200, 'cactusbg');
      W.decor(330, 210, 'cactusbg', { small: true });
      W.sign(5, 11, `ようこそ 2面へ\n${shotHint()} で撃てるのを忘れずに`, { range: 30 });
      // ① だるまさんがころんだサボテン：背中を向けると追ってくる。向き合って3発撃てば倒せる
      W.walker(11 * T + 3, 11 * T, { cause: 'だるまさんがころんだ。', hp: 3, speed: 2.6 });
      // ② 13〜14列目の床は蜃気楼（F）
      // ③ 穴の手前に来ると、砂の中から柱が突き上げる
      const pil = sandPillar(W, 18, 2, 166, { cause: '砂の中から何か出てきた。' });
      W.trigPx(330, 0, 30, 280, () => pil.rise(), { cond: (P) => P.onGround });
      // ④ 出口の手前：歩いている先に日差しが落ちる
      W.trigPx(430, 0, 20, 280, () => {
        const x = G.clamp(W.player.cx + 32, 10, 470);
        W.laser(x - 7, 0, 14, 240, { warn: 18, dur: 22, cause: '日差しに先回りされた。', color: '#ffb030' });
        G.sfx('charge');
      }, { cond: (P) => P.onGround });
    },
  };

  R['5-2'] = {
    hint: '砂嵐は空中にいる時だけ流される。風がやんでから跳ぼう。右の足場は罠。最後の穴の手前で一度跳んで、下降気流をやり過ごそう。',
    area: 5,
    name: '5-2 砂嵐',
    theme: 'desert',
    bg: 'desert',
    exits: { left: '5-1', right: '5-3' },
    map: [
      '#......................#',
      '#......................#',
      '#......................#',
      '#......................#',
      '#......................#',
      '#......................#',
      '#......................#',
      '#......................#',
      '#......................#',
      '........................',
      '.....--.......--........',
      '..S.......s.............',
      '####^^^^####^^^^###^^^##',
      '########################',
    ],
    spikeCauseFn: (W) => {
      if (W.gravScale > 1) return '下降気流に叩き落とされた。';
      if (W.vars.platDrop && W.player.cx > 250 && W.player.cx < 330) return '足場は蜃気楼だった。';
      return W.windX < 0 ? '砂嵐に流された。' : null;
    },
    setup(W) {
      W.decor(200, 200, 'skull');
      W.decor(450, 200, 'cactusbg', { small: true });
      W.windAir = true;
      W.sign(1, 11, '砂嵐注意\n（空中で流されます）', { range: 30 });
      W.sign(17, 11, '風がやんだ', { range: 24 });
      W.vars.windWarn = 0;
      // 砂嵐：予告（40）→突風（75）→凪（120）のくり返し
      W.run(function* () {
        yield 50;
        for (;;) {
          W.vars.windWarn = 1;
          G.sfx('rumble');
          yield 40;
          W.vars.windWarn = 0;
          W.vars.gust = 1;
          W.windX = -1.15;
          yield 75;
          W.vars.gust = 0;
          W.windX = 0;
          yield 120;
        }
      });
      // ① 右の足場は蜃気楼：乗ると抜ける
      for (const tx of [14, 15]) {
        const b = W.tileToBlock(tx, 10, { oneway: true });
        b.onStep = () => {
          W.vars.platDrop = true;
          W.after(6, () => b.drop(0.5));
        };
      }
      // ② 最後の穴を跳ぶと下降気流（重力が強くなって届かない）
      W.trigPx(368, 0, 72, 280, () => {
        W.gravScale = 2.4;
        G.sfx('whoosh');
        W.say('ズシッ', 380, 150, 40, { plain: true, size: 11, color: '#ffe0a0' });
        W.after(40, () => (W.gravScale = 1));
      }, { cond: (P) => !P.onGround });
    },
    drawFg(ctx, W) {
      G.Render.drawSandstorm(ctx, W);
    },
  };

  R['5-3'] = {
    hint: '床の板は踏まない。お宝には触らない。ミイラが起きたら立ち止まらず、落とし穴は大きく跳び越えよう。',
    area: 5,
    name: '5-3 ピラミッド',
    theme: 'temple',
    bg: 'temple',
    exits: { left: '5-2', right: '5-B' },
    map: [
      '########################',
      '########################',
      '########################',
      '########################',
      '########################',
      '########################',
      '########################',
      '#......................#',
      '#......................#',
      '........................',
      '........................',
      '..S..........s..........',
      '########################',
      '##################^^^###',
    ],
    spikeCauseFn: (W) => (W.player.cx > 350 && W.player.cx < 430 ? '落とし穴だった。' : null),
    setup(W) {
      W.decor(40, 150, 'torch');
      W.decor(440, 150, 'torch');
      W.decor(240, 146, 'hiero');
      W.sign(4, 11, 'ピラミッドへ ようこそ\n（さわらないでください）', { range: 30 });
      // ① 床の板を踏むと前後から矢
      W.decor(7 * T, 11 * T, 'plate');
      W.trig(7, 11, 1, 1, () => {
        G.sfx('trap');
        const a = W.spikePx(-24, 220, 'r', { cause: '罠を踏んだ。前後から矢。' });
        a.vel(7, 0);
        const b = W.spikePx(484, 220, 'l', { cause: '罠を踏んだ。前後から矢。' });
        b.vel(-7, 0);
      }, { cond: (P) => P.onGround });
      // ② お宝に触ると天井が落ちる
      const gold = W.fruit(230, 232, { kind: 'gold', r: 6, keep: true });
      gold.hazard = false;
      for (let tx = 10; tx <= 12; tx++) for (let ty = 5; ty <= 6; ty++) W.setTile(tx, ty, 0);
      const slab = W.block(10, 5, 3, 2, { keep: true, squishCause: 'お宝に目がくらんだ。' }); // 天井と同じ見た目
      W.trigPx(224, 226, 12, 14, () => {
        gold.alive = false;
        G.sfx('fanfare');
        W.after(4, () => {
          slab.vel(0, 2, 0, 1.2);
          G.sfx('trap');
        });
        W.run(function* () {
          yield () => slab.y + slab.h >= 240;
          slab.stop();
          slab.y = 240 - slab.h;
          W.shake = 14;
          G.sfx('stomp');
        });
      });
      // ③ 棺の前を通るとミイラが起きて追ってくる
      W.decor(15 * T, 9 * T, 'coffin', { h: 40 });
      const mummy = W.walker(15 * T + 3, 10 * T, { kind: 'mummy', mode: 'walk', speed: 1.15, h: 20, w: 14, cause: 'ミイラに抱きしめられた。' });
      mummy.awake = false;
      mummy.visible = false;
      mummy.hazard = false;
      mummy.y = 11 * T;
      W.trigPx(326, 0, 40, 280, () => {
        mummy.awake = true;
        mummy.visible = true;
        mummy.hazard = true;
        G.sfx('rumble');
        W.say('ウゥ……', 310, 190, 40, { plain: true, size: 10, color: '#d8ccb0' });
      });
      // ④ 落とし穴（18〜20列目）
      const door = [18, 19, 20].map((tx) => W.tileToBlock(tx, 12, { keep: true }));
      let opened = false;
      for (const b of door)
        b.onStep = () => {
          if (opened) return;
          opened = true;
          W.after(5, () => door.forEach((d) => d.drop(0.6)));
        };
    },
  };

  R['5-B'] = {
    hint: '針の雨は落ちる場所を見て、低い針は跳び、高い針は地面で待とう。倒した後、倒れてくる方向に立たないこと。',
    area: 5,
    name: '中ボス サボテン将軍',
    theme: 'desert',
    bg: 'desert',
    music: null,
    exits: { left: '5-3', right: '6-1' },
    edgeOk: ['right'], // 右の壁は撃破後に開く
    goal: 'right',
    map: [
      '#......................#',
      '#......................#',
      '#......................#',
      '#......................#',
      '#......................#',
      '#......................#',
      '#......................#',
      '#......................#',
      '#..----..........----..#',
      '.......................#',
      '.......................#',
      '.......................#',
      '########################',
      '########################',
    ],
    setup(W, opts) {
      W.decor(60, 200, 'skull');
      W.decor(400, 200, 'cactusbg', { small: true });
      const openRight = (fx) => {
        for (let ty = 9; ty <= 11; ty++) W.setTile(23, ty, 0);
        if (fx) {
          W.burst(470, 200, 30, ['#d8a85a', '#f0c878', '#ffffff'], 2.5, { g: 0.15 });
          G.sfx('crumble');
        }
      };
      if (W.game && W.game.flags.cactusDead) {
        openRight(false);
        W.save(20, 11);
        W.sign(18, 11, '将軍は眠る。\nこの先、太陽の神殿');
        return;
      }
      W.closeGate = () => {
        const g = W.block(0, 6, 1, 3, { style: 'gate', keep: true });
        g.tweenTo(g.x, 180, 18, 'outBounce');
        G.sfx('stomp');
      };
      W.sign(12, 11, 'ただのサボテンです', { range: 40 });
      G.BOSSES.cactus(W, opts);
      W.onBossCleared = () => {
        openRight(true);
        W.save(20, 11);
        for (const e of W.ents) if (e instanceof G.Sign) e.alive = false;
      };
    },
  };

  // =====================================================================
  // AREA 6 太陽の神殿
  // =====================================================================
  R['6-1'] = {
    hint: '炎は左から順に噴く。止まりすぎると太陽の目に焼かれる。最後の通気口は近づいて一度噴かせてから通ろう。',
    area: 6,
    name: '6-1 炎の回廊',
    theme: 'temple',
    bg: 'temple',
    exits: { left: '5-B', right: '6-2' },
    edgeOk: ['left'], // 5-B の右の壁は撃破後に開く
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
      '........................',
      '........................',
      '..S.....................',
      '########################',
      '########################',
    ],
    setup(W) {
      W.decor(232, 44, 'sunrelief');
      W.decor(40, 150, 'torch');
      W.decor(440, 150, 'torch');
      for (const tx of [6, 10, 14, 18]) W.decor(tx * T, 11 * T, 'vent');
      // ① 炎は左から順番に噴く（150フレーム周期）
      W.run(function* () {
        for (;;) {
          fireJet(W, 6, { warn: 30 });
          yield 50;
          fireJet(W, 10, { warn: 30 });
          yield 50;
          fireJet(W, 14, { warn: 30 });
          yield 50;
        }
      });
      // ② 最後の通気口だけは近づいた瞬間に噴く
      let cool = 0;
      W.onStep = () => {
        if (cool > 0) cool--;
        const P = W.player;
        if (!cool && P.alive && P.cx > 338 && P.cx < 400) {
          fireJet(W, 18, { warn: 6, cause: '最後の炎はフェイントだった。' });
          cool = 150;
        }
        // ③ 止まりすぎると太陽の目が焼いてくる
        if (P.alive && P.onGround && !P.vx) W.vars.still = (W.vars.still || 0) + 1;
        else W.vars.still = 0;
        if (W.vars.still > 110) {
          W.laser(P.cx - 8, 40, 16, 200, { warn: 26, dur: 18, cause: '太陽の視線に焼かれた。止まりすぎ。', color: '#ffd84a' });
          G.sfx('charge');
          W.vars.still = -40;
        }
      };
      // ④ 逃げるセーブポイント
      const sv = W.save(12, 11);
      const hops = [16, 21];
      let n = 0;
      sv.tick = function () {
        if (this.tw) return;
        const P = W.player;
        if (n < hops.length && P.alive && Math.abs(P.cx - this.cx) < 40) {
          this.tweenTo(hops[n] * T, this.y, 26, 'outQuad');
          W.say(n === 0 ? 'いやだ！' : 'こないで！', this.cx, this.y - 6, 40, { plain: true, size: 9, color: '#9affc0' });
          G.sfx('boing');
          n++;
          return;
        }
        if (n === hops.length && !this.tired) {
          this.tired = true;
          W.say('……つかれた', this.cx, this.y - 6, 50, { plain: true, size: 9, color: '#9affc0' });
        }
        G.SavePoint.prototype.tick.call(this);
      };
    },
  };

  R['6-2'] = {
    hint: '昇る足場は上まで乗らずに右の足場へ。火の玉は落ちた直後に。出口のトゲは一度出させて引っこむのを待とう。',
    area: 6,
    name: '6-2 光の縦穴',
    theme: 'temple',
    bg: 'temple',
    exits: { left: '6-1', up: '6-3' },
    goal: 'up',
    map: [
      '###########....#########',
      '#..............vv......#',
      '#......................#',
      '#......................#',
      '#..........---.........#',
      '#......................#',
      '#.................---..#',
      '#......................#',
      '#......................#',
      '.......................#',
      '........---............#',
      '..S....................#',
      '########################',
      '########################',
    ],
    setup(W) {
      W.decor(40, 150, 'torch');
      W.decor(440, 60, 'torch');
      // ① 昇る足場：乗ると止まらずに天井のトゲまで昇る
      const el = W.block(14, 10, 2, 1, { oneway: true, code: 3, keep: true, style: 'lift' });
      el.home = el.y;
      el.onStep = () => {
        if (el.going) return;
        el.going = true;
        G.sfx('rumble');
        el.vel(0, -1.1);
      };
      el.tick = function () {
        G.Block.prototype.tick.call(this);
        if (this.going && this.y <= 40) this.stop();
      };
      // ② 出口から火の玉（予告あり）
      W.vars.glow = 0;
      W.run(function* () {
        yield 40;
        for (;;) {
          W.vars.glow = 24;
          yield 24;
          const f = W.fruit(256, -10, { kind: 'fire', r: 7, cause: '火の玉が落ちてきた。' });
          f.vel(0, 3.6);
          G.sfx('whoosh');
          yield 76;
        }
      });
      W.onStep = () => {
        if (W.vars.glow > 0) W.vars.glow--;
      };
      // ③ 出口の真下まで来ると、出口からトゲ（しばらくすると引っこむ）
      const sp = [11, 12, 13, 14].map((tx) => W.spike(tx, 0, 'd', { hidden: true, keep: true, cause: '出口にもトゲ。' }));
      W.trigPx(220, 0, 80, 70, () => {
        sp.forEach((s) => s.pop(3));
        W.after(60, () =>
          sp.forEach((s) => {
            s.hazard = false;
            s.popped = false;
            s.oy = -20;
            s.visible = false;
          })
        );
      }, { cond: (P) => !P.onGround });
    },
    drawFg(ctx, W) {
      if (W.vars.glow > 0) G.Render.drawGlow(ctx, 256, 4, 18, W.vars.glow);
    },
  };

  R['6-3'] = {
    hint: '着地は穴の左側に。天井は近づくと落ちるので、一度落とさせて上がる途中でくぐろう。出口からは何か転がってくる。',
    area: 6,
    name: '6-3 祭壇',
    theme: 'temple',
    bg: 'temple',
    exits: { down: '6-2', right: '6-B' },
    goal: 'right',
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
      '#.......................',
      '#.......................',
      '#...............S.......',
      '###########...F#########',
      '###########....#########',
    ],
    setup(W) {
      W.decor(40, 150, 'torch');
      W.decor(200, 84, 'sunrelief', { small: true });
      W.sign(15, 11, 'この先 太陽', { range: 30 });
      // ① 穴の右どなりの床は偽物（F）：乗ると下の部屋へ逆戻り
      // ② 天井が落ちてくる（近づくと震えずに一気に）
      const slab = W.block(18, 4, 4, 2, { style: 'stone', keep: true, squishCause: '神殿の天井は落ちるもの。' });
      slab.home = slab.y;
      W.run(function* () {
        for (;;) {
          yield () => W.player.alive && W.player.cx > 346 && W.player.cx < 450;
          slab.vel(0, 2, 0, 1.0);
          slab.maxV = 11;
          yield () => slab.y + slab.h >= 240;
          slab.stop();
          slab.y = 240 - slab.h;
          W.shake = 10;
          G.sfx('stomp');
          yield 30;
          slab.vel(0, -1.2);
          yield () => slab.y <= slab.home;
          slab.stop();
          slab.y = slab.home;
          yield 40;
        }
      });
      // ③ 出口から火の玉が転がってくる
      W.trigPx(440, 0, 20, 280, () => {
        const f = W.rock(500, 240 - 10, { r: 10, cause: 'ボス部屋から何か転がってきた。' });
        f.fire = true;
        f.vel(-3.2, 0);
        G.sfx('whoosh');
      }, { cond: (P) => P.onGround });
    },
  };

  R['6-B'] = {
    hint: '弾は足場の上からなら届く。マグマや転がる太陽は足場でやり過ごす。倒しても終わりではない。',
    area: 6,
    name: '2面ボス THE SUN',
    theme: 'temple',
    bg: 'sunset',
    music: null,
    exits: { left: '6-3' },
    goal: 'boss',
    map: [
      '#......................#',
      '#......................#',
      '#......................#',
      '#......................#',
      '#......................#',
      '#......................#',
      '#......................#',
      '#......................#',
      '#..----..........----..#',
      '.......................#',
      '.......................#',
      '.......................#',
      '########################',
      '########################',
    ],
    setup(W, opts) {
      W.closeGate = () => {
        const g = W.block(0, 6, 1, 3, { style: 'gate', keep: true });
        g.tweenTo(g.x, 180, 18, 'outBounce');
        G.sfx('stomp');
      };
      if (W.game && W.game.flags.sunDead) {
        W.closeGate();
        W.run(function* () {
          yield 40;
          yield* G.BOSSES.sunAftermath(W);
        });
        return;
      }
      G.BOSSES.sun(W, opts);
    },
  };
})();
