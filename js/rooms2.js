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
    hint: 'ハゲワシは急降下を見てから一歩引こう。サボテンには背中を見せず、向き合って撃とう。光る床は蜃気楼。穴の柱が引っこんでから跳び、出口の手前では一度止まろう。',
    area: 5,
    name: '5-1 蜃気楼',
    theme: 'desert',
    bg: 'desert',
    exits: { left: '4-B', right: '5-2' },
    edgeOk: ['left'], // 4-B の右の扉は1面クリア後に開く
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
      // ⓪ ハゲワシ：上空を飛んできて、歩いている先へ急降下（止まっていると真上から）
      W.trigPx(100, 0, 20, 280, () => {
        const b = W.fruit(500, 70, { kind: 'bird', r: 7, cause: 'ハゲワシに狙われた。' });
        b.vel(-2.6, 0);
        b.dived = false;
        b.offscreenKill = 60;
        b.tick = function () {
          const P = W.player;
          if (!this.dived && P.alive && Math.abs(P.cx - this.cx) < 70) {
            this.dived = true;
            const tx = P.cx + P.vx * 26,
              ty = 232;
            const dx = tx - this.cx,
              dy = ty - this.cy;
            const d = Math.hypot(dx, dy) || 1;
            this.vel((dx / d) * 4.2, (dy / d) * 4.2);
            G.sfx('whoosh');
          }
        };
        G.sfx('warn');
      }, { cond: (P) => P.onGround });
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
    hint: '砂嵐は空中にいる時だけ流される。風がやんでから跳ぼう。2つ目の島の真ん中には立たない。右の足場は罠。最後の穴の手前で一度跳んで、下降気流をやり過ごそう。',
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
      '..S.....s...............',
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
      // ⓪ 2つ目の島の真ん中（10列目）に立つと砂からヘビ
      W.popSpike(10, 11, 'u', [10, 9, 1, 3], { cause: '砂の中にヘビがいた。', cond: (P) => P.onGround, pal: 'gold' });
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
    hint: '床の板は踏まない。お宝には触らない。ミイラが起きたら立ち止まらず、落とし穴は大きく跳び越えよう。出口の手前では大岩を跳ぼう。',
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
      // ⑤ 出口の手前で大岩が転がってくる
      W.trigPx(432, 0, 20, 280, () => {
        const r = W.rock(500, 240 - 12, { r: 12, cause: 'ピラミッドといえば大岩。' });
        r.vel(-3, 0);
        G.sfx('rumble');
      }, { cond: (P) => P.onGround });
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
    hint: '炎は左から順に噴く。太陽の目の真下では待たない。止まりすぎても焼かれる。最後の通気口は近づいて一度噴かせてから通ろう。',
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
        // 入口のセーブ付近では数えない（リスポーン直後に焼かれないように）
        if (P.alive && P.onGround && !P.vx && P.cx > 80) W.vars.still = (W.vars.still || 0) + 1;
        else W.vars.still = 0;
        // ⑤ 太陽のレリーフの真下に立つと火の玉
        if (!W.vars.eyeCd && P.alive && P.onGround && Math.abs(P.cx - 240) < 16) {
          W.vars.eyeCd = 100;
          W.after(8, () => {
            const f = W.fruit(240, 66, { kind: 'fire', r: 6, cause: '太陽の目の真下に立っていた。' });
            f.vel(0, 4.5);
            G.sfx('shoot');
          });
        }
        if (W.vars.eyeCd > 0) W.vars.eyeCd--;
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
    hint: '昇る足場は途中で急加速するので、早めに右の足場へ。火の玉は落ちた直後に。出口のトゲは一度出させて引っこむのを待とう。',
    spikeCauseFn: (W) => (W.vars.liftFast && W.player.y < 60 ? 'エレベーターが急加速した。' : null),
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
        // 半分を過ぎると急加速
        if (this.going && this.y < 150 && !W.vars.liftFast) {
          W.vars.liftFast = true;
          this.vel(0, -2.4);
          G.sfx('trap');
        }
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
    hint: '着地は穴の左側に。看板の前で立ち止まらない。天井は近づくと落ちるので、一度落とさせて上がる途中でくぐろう。出口からは何か転がってくる。',
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
      W.sign(9, 11, 'この先 太陽\n（よく読んでね）', { range: 30 });
      // 看板の前で立ち止まると看板が燃える
      let read = 0;
      W.onStep = () => {
        const P = W.player;
        if (read < 0 || !P.alive) return;
        if (Math.abs(P.cx - 190) < 24 && P.onGround) read++;
        else read = 0;
        if (read > 40) {
          read = -1;
          const f = W.hbox(172, 196, 36, 44, { kind: 'flame', cause: '看板が燃えた。太陽の神殿だから。' });
          f.life = 60;
          G.sfx('explode');
        }
      };
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
    exits: { left: '6-3', right: '7-1' },
    edgeOk: ['right'], // 右の扉は2面クリア後に開く
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
      // 2面クリア後：右の扉が開いて3面の宇宙へ
      W.openNext = (fx) => {
        for (let ty = 9; ty <= 11; ty++) W.setTile(23, ty, 0);
        for (const e of W.ents) if (e.style === 'gate') e.alive = false;
        W.sign(21, 11, 'この先 さかさまの宇宙\n（STAGE 3）→', { range: 34 });
        if (fx) {
          W.burst(470, 200, 30, ['#ffd84a', '#ff9a4a', '#ffffff'], 2.5, { g: 0.15 });
          G.sfx('crumble');
        }
      };
      if (W.game && W.game.flags.stage2Clear) {
        W.openNext(false);
        W.save(2, 11);
        W.text(240, 80, '日の沈んだ神殿', { size: 14, color: '#ffe0c0' });
        return;
      }
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
  // =====================================================================
  // AREA 7 さかさまの宇宙
  // =====================================================================
  R['7-1'] = {
    hint: '低重力なので跳びすぎると天井のトゲに届く。最初の穴の手前で一度跳んで重力を戻させ、元に戻ってから渡ろう。2つ目の穴の手前のジャンプ台は踏まない。',
    area: 7,
    name: '7-1 無重力',
    theme: 'void',
    bg: 'void',
    exits: { left: '6-B', right: '7-2' },
    edgeOk: ['left'], // 6-B の右の扉は2面クリア後に開く
    map: [
      '########################',
      '########################',
      '########################',
      '########################',
      '#vvvvvvvvvvvvvvvvvvvvvv#',
      '#......................#',
      '#......................#',
      '#......................#',
      '#......................#',
      '........................',
      '........................',
      '.@.S.......s............',
      '#####.....####.....#####',
      '#####^^^^^####^^^^^#####',
    ],
    spikeCauseFn: (W) => {
      if (W.vars.boing && W.player.y < 120) return '宇宙のトランポリン。跳びすぎた。';
      return W.gravScale > 0.9 && W.player.cx < 220 ? '重力が急に戻った。' : null;
    },
    setup(W) {
      W.gravScale = 0.45;
      W.sign(4, 11, 'ここは無重力\n（跳びすぎ注意）', { range: 30 });
      W.vars.gLabel = 0;
      // ① 最初の穴を跳ぶと重力が戻る（60フレーム）
      W.trigPx(84, 0, 116, 280, () => {
        W.gravScale = 1;
        W.vars.gLabel = 60;
        G.sfx('trap');
        W.say('GRAVITY ×1.0', 150, 130, 50, { plain: true, size: 11, color: '#ff9af0' });
        W.after(60, () => (W.gravScale = 0.45));
      }, { cond: (P) => !P.onGround });
      W.onStep = () => {
        if (W.vars.gLabel > 0) W.vars.gLabel--;
      };
      // ①' 2つ目の穴の手前にジャンプ台：低重力なので天井のトゲまで飛ばされる
      const sp = W.spring(13, 11, { power: 5.2 });
      sp.onBounce = () => (W.vars.boing = true);
      // ② 2つ目の穴の上を漂うトゲ
      for (const [x, ph] of [[296, 0], [344, 0.5]]) {
        const sp = W.spikePx(x, 160, 'u', { keep: true, cause: '宇宙をただようトゲ。', pal: 'crystal' });
        sp.base = 160;
        sp.ph = ph;
        sp.tick = function () {
          G.Spike.prototype.tick.call(this);
          this.y = this.base + Math.sin(W.time * 0.035 + this.ph) * 46;
        };
      }
      // ③ 出口の手前でスペースデブリ
      W.trigPx(400, 0, 30, 280, () => {
        const r = W.fruit(500, 232, { kind: 'rock', r: 7, cause: 'スペースデブリが飛んできた。' });
        r.vel(-4.2, 0);
        G.sfx('whoosh');
      }, { cond: (P) => P.onGround });
    },
    drawFg(ctx, W) {
      if (W.gravScale > 0.9) G.Render.drawGravNote(ctx, W);
    },
  };

  R['7-2'] = {
    hint: '左右反転は看板より手前から始まる。反転中は左を押すと右へ進む。穴の手前で解けた後、もう一度だけ反転するので、それが終わってから跳ぼう。',
    area: 7,
    name: '7-2 さかさま回廊',
    theme: 'void',
    bg: 'void',
    exits: { left: '7-1', right: '7-3' },
    map: [
      '########################',
      '########################',
      '#vvvvvvvvvvvvvvvvvvvvvv#',
      '#......................#',
      '#......................#',
      '#......................#',
      '#......................#',
      '#......................#',
      '#......................#',
      '........................',
      '........................',
      '..S..........s..........',
      '#####..####..####...####',
      '#####^^####^^####^^^####',
    ],
    spikeCauseFn: (W) => {
      const x = W.player.cx;
      if (x < 150) return W.vars.revSeen ? '左右反転は看板より手前から始まっていた。' : null;
      if (x > 330) return W.vars.revAgain ? '反転はまだ終わっていなかった。' : '反転は空中で解けた。';
      return W.reverse ? 'さかさまの世界で迷子になった。' : null;
    },
    setup(W) {
      W.sign(9, 11, 'ここから左右反転 →', { range: 30 });
      W.sign(16, 11, '← 反転おわり', { range: 24 });
      // ① 反転は看板の手前（最初の穴を越えた所）から始まり、穴の手前で解ける
      W.onStep = () => {
        const P = W.player;
        if (!P.alive) return;
        if (!W.reverse && P.onGround && P.cx > 146 && P.cx < 200 && !W.vars.revDone) {
          W.reverse = true;
          W.vars.revSeen = true;
          G.sfx('flip');
          W.say('左右反転！', P.cx, P.y - 8, 40, { plain: true, size: 10, color: '#ff9af0' });
        }
        if (W.reverse && P.cx >= 338 && !W.vars.revDone) {
          W.reverse = false;
          W.vars.revDone = true;
          G.sfx('flip');
          // 終わったと見せかけて、少しするともう一度だけ反転する
          W.after(24, () => {
            W.reverse = true;
            W.vars.revAgain = true;
            G.sfx('flip');
            W.after(36, () => {
              W.reverse = false;
              G.sfx('flip');
            });
          });
        }
      };
      // ② 反転中に天井のトゲが1本落ちてくる
      const cs = W.spike(14, 2, 'd', { cause: '天井まで反転していた。', pal: 'crystal' });
      W.setTile(14, 2, 0);
      W.trigPx(254, 0, 26, 280, () => {
        cs.vel(0, 4, 0, 1.0);
        G.sfx('trap');
      });
    },
    drawFg(ctx, W) {
      if (W.reverse) G.Render.drawReverseNote(ctx, W);
    },
  };

  R['7-3'] = {
    hint: '暗闇は光った瞬間に足場を覚えよう。真ん中の低い足場は乗ると抜ける。最後の足場は左端を避け、黒いリンゴに注意。',
    spikeCauseFn: (W) => (W.vars.midGone ? '暗闇の足場は抜けるもの。' : '暗くて見えなかった。'),
    area: 7,
    name: '7-3 闇の星座',
    theme: 'void',
    bg: 'void',
    exits: { left: '7-2', right: '7-B' },
    map: [
      '########################',
      '#......................#',
      '#......................#',
      '#......................#',
      '#......................#',
      '#......................#',
      '#......................#',
      '#.........---..........#',
      '#......................#',
      '...........---..........',
      '.....---.........---....',
      '..S.....................',
      '####^^^^^^^^^^^^^^^^####',
      '########################',
    ],
    setup(W) {
      W.vars.flashT = 0;
      // 100フレームごとに一瞬だけ明るくなる
      W.run(function* () {
        yield 30;
        for (;;) {
          W.vars.flashT = 14;
          G.sfx('reveal');
          yield 100;
        }
      });
      W.onStep = () => {
        if (W.vars.flashT > 0) W.vars.flashT--;
      };
      // ① 真ん中の低い足場（11〜13列目）は乗ると抜ける。上の足場（10〜12列目）が本物
      const mids = [11, 12, 13].map((tx) => W.tileToBlock(tx, 9, { oneway: true }));
      let gone = false;
      for (const b of mids)
        b.onStep = () => {
          if (gone) return;
          gone = true;
          W.vars.midGone = true;
          W.after(8, () => mids.forEach((m) => m.drop(0.5)));
        };
      // ①' 最後の足場の左端には、光った瞬間だけ現れるトゲ
      const fs = W.spike(18, 9, 'u', { cause: '光った瞬間だけ現れるトゲ。', pal: 'crystal' });
      fs.tick = function () {
        G.Spike.prototype.tick.call(this);
        const on = W.vars.flashT > 0;
        this.visible = on;
        this.hazard = on;
      };
      // ② 最後の足場の上を黒いリンゴがゆっくり往復する（光った時と近くでしか見えない）
      const dark = W.fruit(370, 180, { kind: 'dark', r: 6, keep: true, cause: '暗闇に黒いリンゴ。見えるわけがない。' });
      dark.tick = function () {
        this.x = 364 + Math.sin(W.time * 0.03) * 34 - this.r;
      };
      W.sign(1, 11, '暗いので\n足もとに注意', { range: 30 });
    },
    drawFg(ctx, W) {
      G.Render.drawDarkness(ctx, W, W.vars.flashT > 0 ? 0.15 : 0.93);
    },
  };

  R['7-B'] = {
    hint: '吸い込まれないよう外側へ歩き続けよう。吐き出しの後は向きを変えて逃げる。倒しても最後に吐き出す物がある。',
    area: 7,
    name: '中ボス ブラックホール',
    theme: 'void',
    bg: 'void',
    music: null,
    exits: { left: '7-3', right: '8-1' },
    edgeOk: ['right'], // 右の壁は撃破後に開く
    goal: 'right',
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
      '.......................#',
      '.......................#',
      '.......................#',
      '########################',
      '########################',
    ],
    setup(W, opts) {
      const openRight = (fx) => {
        for (let ty = 9; ty <= 11; ty++) W.setTile(23, ty, 0);
        if (fx) {
          W.burst(470, 200, 30, ['#c070ff', '#f0c0ff', '#ffffff'], 2.5, { g: 0.15 });
          G.sfx('crumble');
        }
      };
      if (W.game && W.game.flags.holeDead) {
        openRight(false);
        W.save(20, 11);
        W.sign(18, 11, '静かになった。\nこの先、ニュートンの庭');
        return;
      }
      W.closeGate = () => {
        const g = W.block(0, 6, 1, 3, { style: 'gate', keep: true });
        g.tweenTo(g.x, 180, 18, 'outBounce');
        G.sfx('stomp');
      };
      G.BOSSES.blackhole(W, opts);
      W.onBossCleared = () => {
        openRight(true);
        W.save(20, 11);
      };
    },
  };

  // =====================================================================
  // AREA 8 ニュートンの庭
  // =====================================================================
  R['8-1'] = {
    hint: '1本目の木は一歩入って戻り、リンゴを先に落とそう。大きな木は撃つと穴の上に倒れて橋になる。丸太の上ではリンゴを、出口の手前では金のリンゴを跳び越えよう。',
    area: 8,
    name: '8-1 ニュートンの庭',
    theme: 'garden',
    bg: 'garden',
    exits: { left: '7-B', right: '8-2' },
    edgeOk: ['left'], // 7-B の右の壁は撃破後に開く
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
      '........................',
      '........................',
      '..S.....................',
      '##########........######',
      '##########^^^^^^^^######',
    ],
    spikeCauseFn: (W) => (W.vars.bridge ? null : '跳べる距離ではない。'),
    // 検証ソルバー用の距離の目安（ゲームには影響しない）：まず木を撃って倒し、それから右へ
    solverH(W) {
      const P = W.player;
      if (W.vars.bridge) return 480 - P.cx;
      const tree = W.ents.find((e) => e instanceof BigTree);
      if (!tree) return 600;
      if (tree.state !== 'stand') return 700 - tree.rot * 150 + Math.abs(P.cx - 80) * 0.2; // 倒れきるまで待つ
      let h = 1000 + tree.hp * 200 + Math.abs(P.cx - 150);
      for (const b of W.bullets) if (!b.hostile && b.vx > 0 && b.x < tree.x && b.y > tree.y + 60) h -= 60;
      return h;
    },
    setup(W) {
      W.decor(20, 200, 'hedge');
      W.decor(440, 200, 'hedge');
      W.sign(5, 11, 'ニュートンの庭\n（リンゴに注意）', { range: 30 });
      // ① 1本目の木：真下に来ると一瞬でリンゴが落ちる
      W.decor(80, 100, 'appletree', { h: 140 });
      const a1 = W.fruit(112, 132, { cause: 'リンゴは落ちる。ニュートンもそう言っていた。', splat: true });
      W.trigPx(98, 0, 30, 280, () => a1.vel(0, 4, 0, 1.2));
      // ② 大きな木：撃つと穴の上に倒れて橋になる。近づくとリンゴを横に飛ばしてくる
      const tree = W.add(new BigTree(W, 182, 240));
      W.trigPx(130, 0, 20, 280, () => {
        const a = W.fruit(176, 232, { cause: 'リンゴは横にも落ちる。' });
        a.vel(-5, 0);
        G.sfx('whoosh');
      }, { cond: (P) => P.onGround });
      tree.onFall = () => {
        W.vars.bridge = true;
        W.block(10, 12, 8, 1, { oneway: true, keep: true, style: 'log' }).h = 8;
        // ③ 丸太に乗ると、向こう端からリンゴが転がってくる
        W.trigPx(196, 0, 30, 280, () => {
          const r = W.fruit(370, 233, { cause: '丸太の上をリンゴが転がってきた。' });
          r.vel(-2.4, 0);
          G.sfx('whoosh');
        }, { cond: (P) => P.onGround });
      };
      W.sign(8, 11, '木こり募集中', { range: 24 });
      // 出口の手前に禁断の果実
      W.fruit(410, 232, { kind: 'gold', r: 6, keep: true, cause: '禁断の果実に手を出した。' });
    },
  };

  // 撃つと倒れる大きな木（倒れた先が橋になる）
  class BigTree extends Ent {
    constructor(W, x, floorY) {
      super(W, x - 8, floorY - 180, 16, 180);
      this.shootable = true;
      this.hp = 4;
      this.rot = 0;
      this.layer = -0.7;
      this.state = 'stand';
      this.hurtT = 0;
    }
    shotBox() {
      return { x: this.x - 4, y: this.y + 60, w: this.w + 8, h: 120 };
    }
    onShot() {
      if (this.state !== 'stand') return false;
      this.hp--;
      this.hurtT = 4;
      G.sfx('hit');
      if (this.hp <= 0) {
        this.state = 'fall';
        G.sfx('crumble');
        this.W.say('メキメキ…', this.cx, this.y + 40, 40, { plain: true, size: 10, color: '#c0ff90' });
      }
      return true;
    }
    tick() {
      if (this.hurtT > 0) this.hurtT--;
      if (this.state === 'fall') {
        this.rot = Math.min(Math.PI / 2, this.rot + 0.008 + this.rot * 0.06);
        if (this.rot >= Math.PI / 2) {
          this.state = 'down';
          this.W.shake = 16;
          G.sfx('stomp');
          this.W.burst(this.x + 180, 236, 30, ['#3a8a3a', '#7ad05a', '#8a5a2a'], 2.5, { up: 2, g: 0.15, life: 30 });
          if (this.onFall) this.onFall();
        }
      }
    }
    draw(ctx) {
      G.Render.drawBigTree(ctx, this);
    }
  }

  R['8-2'] = {
    hint: '重力が強いので2段ジャンプで渡ろう。リンゴは引き寄せられてくるので、一度左へ逃げて落ちるのを待とう。3つ目の島には長居しない。',
    area: 8,
    name: '8-2 万有引力',
    theme: 'garden',
    bg: 'garden',
    exits: { left: '8-1', right: '8-3' },
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
      '..S.......s.............',
      '######...#####...####..#',
      '######^^^#####^^^####^^#',
    ],
    spikeCauseFn: () => '重力に負けた。',
    setup(W) {
      W.gravScale = 1.3;
      W.sign(4, 11, 'この先 重力強め', { range: 30 });
      // 3つ目の島に立つと、果物かごがひっくり返る
      W.decor(340, 0, 'branch');
      W.trigPx(340, 0, 80, 280, () => {
        W.after(10, () => {
          for (let i = 0; i < 5; i++) {
            const a = W.fruit(350 + i * 15, -10 - (i % 2) * 14, { cause: '果物かごをひっくり返された。', splat: true });
            a.vel(0, 3, 0, 0.4);
          }
          G.sfx('whoosh');
        });
      }, { cond: (P) => P.onGround });
      // リンゴは近づくとプレイヤーに引き寄せられ、しばらくすると普通に落ちる
      for (const x of [170, 300, 430]) {
        W.decor(x - 40, 0, 'branch');
        const a = W.fruit(x, 28, { keep: true, cause: '万有引力の法則。' });
        a.state = 'hang';
        a.tick = function () {
          G.Fruit.prototype.tick.call(this);
          const P = W.player;
          if (this.state === 'hang' && P.alive && Math.abs(P.cx - this.cx) < 80) {
            this.state = 'pull';
            this.pullT = 0;
            G.sfx('charge');
          }
          if (this.state === 'pull') {
            const dx = P.cx - this.cx,
              dy = P.cy - this.cy;
            const d = Math.hypot(dx, dy) || 1;
            this.vx += (dx / d) * 0.09;
            this.vy += (dy / d) * 0.09;
            const v = Math.hypot(this.vx, this.vy);
            if (v > 1.5) {
              this.vx *= 1.5 / v;
              this.vy *= 1.5 / v;
            }
            if (++this.pullT > 110) {
              this.state = 'fall';
              this.vel(0, 0, 0, 0.3);
            }
          }
          if (this.y > 300) this.alive = false;
        };
      }
    },
  };

  R['8-3'] = {
    hint: 'セーブポイントは撃って確かめよう（本物は1つ）。手紙と右の看板の前では立ち止まらない。最後の足場ではリンゴが落ちてから跳ぼう。',
    area: 8,
    name: '8-3 最後のセーブ',
    theme: 'garden',
    bg: 'garden',
    exits: { left: '8-2', up: '8-B' },
    goal: 'up',
    map: [
      '#...####################',
      '#......................#',
      '#......................#',
      '#......................#',
      '#--....................#',
      '#......................#',
      '#......................#',
      '#...--.................#',
      '#......................#',
      '.......................#',
      '..--...................#',
      '.......................#',
      '########################',
      '########################',
    ],
    setup(W) {
      W.sign(20, 11, '本物のセーブは\nひとつだけ', { range: 30 });
      // この看板もハズレ：読んでいると爆発する
      let readS = 0;
      W.run(function* () {
        for (;;) {
          const P = W.player;
          if (P.alive && P.onGround && Math.abs(P.cx - 410) < 24) readS++;
          else readS = 0;
          if (readS > 30) break;
          yield 1;
        }
        const ex = W.hbox(392, 200, 36, 40, { kind: 'flame', cause: '看板もハズレだった。' });
        ex.life = 40;
        W.burst(410, 220, 30, ['#ffd84a', '#ff5a10', '#ffffff'], 3, { g: 0.1 });
        G.sfx('explode');
      });
      // ① 5つのセーブのうち本物は1つ（14列目）。偽物に触れると爆発
      for (const tx of [6, 9, 12, 14, 17]) {
        const sp = W.save(tx, 11, { fake: tx !== 14 });
        if (sp.fake) sp.cause = 'ハズレ。セーブポイントは撃って確かめよう。';
      }
      // ② 手紙を読んでいると花火が上がり、火の粉が降ってくる
      W.sign(4, 11, 'ここまで来たあなたへ\nおめでとう！', { range: 26, kind: 'letter' });
      let read = 0,
        fired = false;
      W.onStep = () => {
        const P = W.player;
        if (fired || !P.alive) return;
        if (Math.abs(P.cx - 90) < 26 && P.onGround) read++;
        else read = 0;
        if (read > 40) {
          fired = true;
          G.sfx('fanfare');
          for (let i = 0; i < 3; i++) {
            const x = P.cx + (i - 1) * 24;
            const rk = W.fruit(x, 250, { kind: 'spark', r: 3, cause: '祝福の花火に焼かれた。' });
            rk.vel(0, -6, 0, 0.12);
            rk.tick = function () {
              if (this.vy >= -0.5 && this.alive) {
                this.alive = false;
                G.sfx('explode');
                for (let k = 0; k < 8; k++) {
                  const a = (k / 8) * Math.PI * 2;
                  const sp = W.fruit(this.cx, this.cy, { kind: 'spark', r: 3, cause: '祝福の花火に焼かれた。' });
                  sp.vel(Math.cos(a) * 1.4, Math.sin(a) * 1.4 - 0.5, 0, 0.06);
                }
              }
            };
          }
        }
      };
      // ③ 最後の足場に乗ると、出口からリンゴが落ちてくる
      W.trigPx(20, 60, 40, 30, () => {
        W.after(16, () => {
          const a = W.fruit(50, -10, { cause: 'ラスボスの前の前座。' });
          a.vel(0, 4, 0, 0.6);
          G.sfx('whoosh');
        });
      }, { cond: (P) => P.onGround });
    },
  };

  R['8-B'] = {
    hint: '重力が反転したら天井に立つ。根っこの波は跳び、葉っぱの嵐は低い所で。幹の顔を撃とう。',
    area: 8,
    name: '3面ボス ニュートンの樹',
    theme: 'garden',
    bg: 'garden',
    music: null,
    exits: { down: '8-3', right: '9-1' },
    edgeOk: ['right'], // 右の扉は3面クリア後に開く
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
      '#..----.....----.......#',
      '#......................#',
      '#......................#',
      '#......................#',
      '#...####################',
      '#...####################',
    ],
    setup(W, opts) {
      W.sealFloor = () => {
        for (let tx = 1; tx <= 3; tx++) for (let ty = 12; ty <= 13; ty++) W.setTile(tx, ty, 1);
        W.exits.down = null;
      };
      // 3面クリア後：右の扉が開いて4面（月の裏側）へ
      W.openNext = (fx) => {
        for (let ty = 9; ty <= 11; ty++) W.setTile(23, ty, 0);
        W.sign(21, 11, 'この先 月の裏側\n（STAGE 4）→', { range: 34 });
        if (fx) {
          W.burst(470, 200, 30, ['#7ad05a', '#ffe9a8', '#ffffff'], 2.5, { g: 0.15 });
          G.sfx('crumble');
        }
      };
      if (W.game && W.game.flags.treeDead) {
        W.openNext(false);
        W.save(5, 11);
        W.decor(330, 200, 'stump');
        W.text(240, 80, '切り株だけが残った', { size: 14, color: '#e8e2ff' });
        // 倒した直後に落ちた場合は、ここでクリア扱いにする
        if (!W.game.flags.stage3Clear) W.after(30, () => W.game.stageClear && W.game.stageClear());
        return;
      }
      G.BOSSES.tree(W, opts);
    },
  };
})();
