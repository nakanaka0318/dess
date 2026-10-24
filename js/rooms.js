// 部屋（ステージ）定義
// マップ記号: # 地面  B 別素材の地面  - すり抜け足場  ^v<> トゲ  S セーブ  s やさしい時のみのセーブ  @ 開始位置
// それ以外の文字は setup() から W.mark() で参照できる目印（空白扱い）
(function () {
  'use strict';
  const G = globalThis.G;
  const T = G.T;

  G.START_ROOM = '1-1';
  G.AREAS = {
    1: { title: 'AREA 1  はじまりの草原', sub: '〜 リンゴは上にも落ちる 〜', music: 'grass' },
    2: { title: 'AREA 2  ひみつの洞窟', sub: '〜 天井を見上げるな 〜', music: 'cave' },
    3: { title: 'AREA 3  うそつき城', sub: '〜 看板を信じるな 〜', music: 'castle' },
    4: { title: 'AREA 4  月への階段', sub: '〜 あと少しで月に手が届く 〜', music: 'sky' },
  };
  const R = (G.ROOMS = {});

  // 罠のタイミング調整表（tools/traps.js で「初見なら死ぬ／知っていれば避けられる」を確認しながら決めた値）
  // trig* は作動する位置、delay は作動してから動き出すまでの無言の待ち、g は落下の加速度
  const TUNE = (G.TUNE = Object.assign(
    {
      c11_trig: 138, c11_delay: 6, c11_g: 1.0, // 1-1 木のリンゴ
      m12_trig: 326, m12_delay: 7, m12_g: 1.0, // 1-2 落ちる月
      m13_delay: 14, // 1-3 岩棚を砕く月
      s13_delay: 34, // 1-3 着地後の天井トゲ
      i3_delay: 16, // 2-2 穴を跳ぶとつらら
      a32_delay: 13, a32_g: 1.0, // 3-2 上に落ちるリンゴ
      a43_delay: 16, // 4-3 月のリンゴ
      st41_tele: 14, // 4-1 狙い撃ちの流れ星
    },
    G.TUNE || {}
  ));
  const P = () => G.game; // eslint-disable-line no-unused-vars
  const Block = G.Block;
  const touchHint = () => (G.isTouch ? 'JUMP' : 'Shift / Z');
  const shotHint = () => (G.isTouch ? 'SHOT' : 'X');

  // =====================================================================
  // AREA 1 はじまりの草原
  // =====================================================================
  R['1-1'] = {
    hint: 'リンゴは近づくと動き出す。立ち止まって様子を見よう。',
    area: 1,
    name: '1-1 はじまり',
    theme: 'grass',
    bg: 'day',
    exits: { right: '1-2' },
    map: [
      '........................',
      '........................',
      '........................',
      '........................',
      '........................',
      '........................',
      '........................',
      '........................',
      '........................',
      '........................',
      '........................',
      '.@.S....................',
      '##########...#######...#',
      '##########^^^#######^^^#',
    ],
    setup(W) {
      W.decor(150, 110, 'tree', { h: 130 });
      W.decor(260, 220, 'bush');
      W.decor(90, 220, 'flower');
      W.decor(300, 220, 'flower');
      W.decor(380, 220, 'grass');
      W.decor(40, 220, 'grass');
      W.sign(5, 11, `◀ ▶ で移動\n${touchHint()} でジャンプ（空中でもう1回）\n${shotHint()} でショット`);
      W.sign(15, 11, 'この先 安全です', { range: 30 });

      // ① 木のリンゴが落ちてくる（真下に来た瞬間に一気に落ちる）
      const a1 = W.fruit(172, 152, { cause: 'リンゴは落ちてくるものだ。', splat: true });
      W.trigPx(TUNE.c11_trig, 0, 10, 280, () => {
        W.after(TUNE.c11_delay, () => {
          a1.vel(0, 0.5, 0, TUNE.c11_g);
          G.sfx('whoosh');
        });
      });
      // ② 穴の中のリンゴが上に飛ぶ（近づくと少し遅れて発射）
      const a2 = W.fruit(230, 254, { cause: 'リンゴは上にも落ちる。' });
      W.trigPx(176, 0, 30, 280, () => {
        W.after(19, () => {
          a2.vel(0, -7);
          G.sfx('whoosh');
        });
      });
      // ③ 「安全」の看板の先で地面からトゲ
      W.popSpike(17, 11, 'u', [17, 9, 1, 3], { cause: '看板は嘘をつく。' });
    },
  };

  R['1-2'] = {
    hint: '橋の4つ目は飛び越えよう。月が落ちたら転がり去るまで待とう。',
    area: 1,
    name: '1-2 月が見ている',
    theme: 'grass',
    bg: 'day',
    exits: { left: '1-1', right: '1-3' },
    map: [
      '........................',
      '........................',
      '........................',
      '........................',
      '........................',
      '........................',
      '........................',
      '........................',
      '........................',
      '........................',
      '........................',
      '.S..........s...........',
      '###BBBBBBBB#############',
      '###^^^^^^^^#############',
    ],
    setup(W) {
      W.decor(420, 220, 'bush');
      W.decor(250, 220, 'flower');
      W.decor(330, 220, 'grass');
      // 橋：4つ目は踏むと抜ける、7つ目は少しして崩れる
      const fake = W.tileToBlock(6, 12);
      fake.onStep = () => {
        fake.drop(0.4);
        G.sfx('crumble');
      };
      const slow = W.tileToBlock(9, 12);
      slow.onStep = () => slow.crumble(22);
      // 月
      const moon = W.moon(370, 62, { r: 22, keep: true, cause: '月が落ちてきた。' });
      moon.layer = -1.5;
      W.trigPx(TUNE.m12_trig, 0, 200, 280, () => {
        moon.face = 'grin';
        W.after(TUNE.m12_delay, () => {
          moon.layer = 3;
          G.sfx('trap');
          moon.vel(0, 1, 0, TUNE.m12_g);
          moon.maxV = 14;
          moon.bounceFloor = 240;
          moon.offscreenKill = 80;
          moon.onLand = () => {
            moon.vx = 2.6;
            moon.face = 'calm';
          };
        });
      });
    },
  };

  R['1-3'] = {
    hint: 'トゲの手前で小ジャンプすると先に飛んでいく。右上の足場では一呼吸。',
    area: 1,
    name: '1-3 天井に注意',
    theme: 'grass',
    bg: 'dusk',
    exits: { left: '1-2', up: '1-4' },
    goal: 'up',
    map: [
      '#......#################',
      '#......................#',
      '#......................#',
      '#......................#',
      '#########..............#',
      '#...................s..#',
      '#............##.....##.#',
      '#......................#',
      '#................##....#',
      '#......................#',
      '............##.........#',
      '..S....................#',
      '###########^^^^^^^^^^^^#',
      '########################',
    ],
    setup(W) {
      W.decor(80, 220, 'bush');
      W.decor(160, 60, 'flower');
      W.decor(140, 60, 'grass');
      // ① 飛び越えようとすると跳ねるトゲ（近くで小ジャンプすれば先に飛んでいく）
      const js = W.spike(6, 11, 'u', { cause: 'トゲもジャンプする。' });
      W.trigPx(0, 0, 480, 280, () => {
        js.vel(0, -6);
        G.sfx('pop');
      }, { cond: (P) => !P.onGround && Math.abs(P.cx - js.cx) < 48 && P.y > 150 });
      // ② 右上の足場に乗ると、少しして天井のトゲが落ちる（すぐ跳ぶと空中で刺さる）
      const cs = W.spike(17, 1, 'd', { cause: '着地したら一呼吸。' });
      W.trig(20, 4, 2, 2, () => {
        W.after(TUNE.s13_delay, () => {
          cs.shakeT = 4;
          cs.vel(0, 1, 0, 1.0);
          G.sfx('trap');
        });
      }, { cond: (P) => P.onGround });
      cs.tick = function () {
        G.Spike.prototype.tick.call(this);
        if (this.shakeT > 0) {
          this.shakeT--;
          this.ox = this.shakeT % 4 < 2 ? -1 : 1;
        } else if (!this.popT) this.ox = 0;
      };
      // ③ 岩棚に乗ってしばらくすると、穴の真下にいる者めがけて月が降ってくる（棚の右端だけは安全）
      W.trigPx(0, 0, 180, 80, (P) => {
        W.after(TUNE.m13_delay, () => {
          const cx = G.clamp(W.player.cx, 46, 114);
          const m = W.moon(cx, -30, { r: 26, cause: '月が降ってきた。上から来るとは。', face: 'grin' });
          m.vel(0, 4, 0, 1.0);
          m.maxV = 13;
          G.sfx('whoosh');
          G.sfx('rumble');
          W.shake = 12;
          let broke = false;
          m.tick = function () {
            if (!broke && this.y + this.h >= 84) {
              broke = true;
              for (let tx = 1; tx <= 5; tx++) if ((tx + 1) * T > this.x + 4 && tx * T < this.x + this.w - 4) W.setTile(tx, 4, 0);
              W.burst(this.cx, 88, 50, ['#7a4a2a', '#4cb43c', '#5e3820'], 3, { g: 0.2, life: 50 });
              W.shake = 14;
              G.sfx('thud');
            }
          };
        });
      }, { cond: (P) => P.y < 80 && P.onGround });
    },
  };

  R['1-4'] = {
    hint: '本物のセーブは手前の1つだけ。トゲの壁より先に走り抜けよう。',
    area: 1,
    name: '1-4 にせもの',
    theme: 'grass',
    bg: 'dusk',
    exits: { down: '1-3', right: '2-1' },
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
      '#...S..f................',
      '#...######..##..##..####',
      '#...######^^##^^##^^####',
    ],
    setup(W) {
      W.decor(440, 220, 'flower');
      W.decor(260, 220, 'grass');
      const f = W.mark('f');
      W.save(f.tx, f.ty, { fake: true }).cause = 'セーブポイントだと思った？';
      W.sign(5, 11, 'この先にも\nセーブポイントあり', { range: 30 });
      // 偽セーブを越えるとトゲの壁が迫る
      const wall = [];
      W.trigPx(190, 0, 20, 280, () => {
        G.sfx('rumble');
        W.shake = 20;
        for (let ty = 1; ty <= 11; ty++) {
          const s = W.spikePx(-40, ty * T, 'r', { keep: true, cause: 'トゲの壁は待ってくれない。' });
          s.vel(1.45, 0);
          wall.push(s);
          const b = W.blockPx(-60, ty * T, 20, 20, { solid: false, keep: true, code: 2 });
          b.vel(1.45, 0);
        }
      });
    },
  };

  // ドッスン（天井から落ちてくる顔つき岩）
  function thwomp(W, tx, ty, o) {
    o = o || {};
    const b = W.block(tx, ty, o.w || 2, o.h || 2, { style: 'thwomp', keep: true, squishCause: o.cause || 'ドッスンに潰された。' });
    b.home = b.y;
    b.spikesBelow = !!o.spikes;
    const floorY = o.floorY || 240;
    W.run(function* () {
      for (;;) {
        yield () => W.player.alive && o.when(W.player, b);
        if (o.fake && !b.faked) {
          b.faked = true;
          b.angry = true;
          b.shakeT = o.fake;
          G.sfx('trap');
          yield o.fake;
          b.angry = false;
          continue;
        }
        b.angry = true;
        if (o.shake) {
          b.shakeT = o.shake;
          G.sfx('trap');
          yield o.shake;
        }
        b.vel(0, o.v0 || 1, 0, o.acc || 0.7);
        b.maxV = 10;
        yield () => b.y + b.h >= floorY;
        b.stop();
        b.y = floorY - b.h;
        b.yr = 0;
        W.shake = 8;
        G.sfx('stomp');
        W.burst(b.cx, floorY, 10, ['#8a7a9a', '#5a4a6a'], 1.5, { up: 1, g: 0.1, life: 25 });
        yield o.stay || 40;
        if (o.double) {
          // 少しだけ上がって油断させてから、もう一度落ちる
          b.vel(0, -1);
          yield () => b.y <= floorY - b.h - o.double;
          b.stop();
          b.shakeT = 6;
          yield 6;
          b.vel(0, 2, 0, 0.9);
          yield () => b.y + b.h >= floorY;
          b.stop();
          b.y = floorY - b.h;
          b.yr = 0;
          W.shake = 8;
          G.sfx('stomp');
          yield o.stay || 40;
        }
        b.vel(0, -(o.up || 1));
        yield () => b.y <= b.home;
        b.stop();
        b.y = b.home;
        b.yr = 0;
        b.angry = false;
        yield o.cool || 20;
      }
    });
    return b;
  }

  // =====================================================================
  // AREA 2 ひみつの洞窟
  // =====================================================================
  R['2-1'] = {
    hint: 'ドッスンは落ちて上がる途中にくぐろう。2つ目は二度落ちる。',
    area: 2,
    name: '2-1 落石注意',
    theme: 'cave',
    exits: { left: '1-4', down: '2-2' },
    goal: 'down',
    map: [
      '########################',
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
      '.S.......s.............#',
      '####################...#',
      '####################...#',
    ],
    setup(W) {
      W.decor(100, 220, 'crystal');
      W.decor(200, 220, 'mushroom');
      W.decor(300, 220, 'rock');
      W.decor(440, 100, 'crystal');
      W.sign(3, 11, '落石注意\n（上を見て歩こう）');
      // ① 近づくと落ちる（止まれば手前に落ちる）
      thwomp(W, 6, 5, { shake: 8, when: (P, b) => P.cx > b.x - 30 && P.cx < b.x + b.w + 8 });
      // ② 落ちて少し上がり、くぐろうとした所にもう一度落ちる
      thwomp(W, 11, 5, { shake: 4, double: 34, when: (P, b) => P.cx > b.x - 30 && P.cx < b.x + b.w });
      // ③ 近づくと震えるだけ。安心して真下で止まると落ちてくる
      thwomp(W, 16, 5, { fake: 40, acc: 0.9, when: (P, b) => (b.faked ? P.cx > b.x + 20 && P.cx < b.x + b.w + 4 : P.cx > b.x - 40 && P.cx < b.x) });
    },
  };

  R['2-2'] = {
    hint: '縦穴は真ん中を落ちよう。つららは一歩踏み込んで落としてから進もう。',
    area: 2,
    name: '2-2 つらら',
    theme: 'cave',
    exits: { up: '2-1', left: '2-3' },
    goal: 'left',
    map: [
      '####################...#',
      '####################...#',
      '####################...#',
      '####################...#',
      '####################...#',
      '####################...#',
      '####################...#',
      '####################...#',
      '#.vvvvvv...............#',
      '#......................#',
      '#......................#',
      '.....................S.#',
      '########.###############',
      '########^###############',
    ],
    setup(W) {
      W.decor(380, 220, 'crystal');
      W.decor(300, 220, 'mushroom');
      W.decor(20, 220, 'rock');
      // 縦穴：壁からトゲが飛び出す（真ん中は安全）
      for (const [tx, ty, d] of [[20, 3, 'r'], [22, 5, 'l'], [20, 7, 'r']]) {
        W.popSpike(tx, ty, d, [20, ty - 1, 3, 1], { cause: '壁ぎわは危ない。', frames: 3 });
      }
      // ベルトコンベア（右へ流れる）
      W.block(2, 12, 6, 1, { style: 'conveyor', conveyor: 1.2, keep: true });
      // つらら① 普通に落ちる
      const i1 = W.spike(17, 8, 'd', { pal: 'ice', cause: 'つららが落ちてきた。' });
      W.trigPx(0, 0, 480, 280, () => i1.vel(0, 0, 0, 0.5), { cond: (P) => P.cx < i1.cx + 26 && P.y > 150 });
      // つらら② 少し遅れて落ちる（立ち止まると刺さる）
      const i2 = W.spike(14, 8, 'd', { pal: 'ice', cause: '立ち止まったのが運の尽き。' });
      W.trigPx(0, 0, 480, 280, () => W.after(34, () => i2.vel(0, 0, 0, 0.5)), { cond: (P) => P.cx < i2.cx + 26 && P.y > 150 });
      // 床から石筍
      W.popSpike(12, 11, 'u', [12, 10, 1, 2], { cause: 'つららは下からも生える。', pal: 'ice' });
      // つらら③ 穴を飛び越えようとすると落ちる
      const i3 = W.spike(8, 8, 'd', { pal: 'ice', cause: 'ジャンプした瞬間を狙われた。' });
      W.trigPx(0, 0, 480, 280, () => W.after(TUNE.i3_delay, () => i3.vel(0, 1, 0, 1.0)), { cond: (P) => P.cx < 212 && P.cx > 150 });
      W.sign(10, 11, '止まるな\n跳びすぎるな', { range: 26 });
    },
  };

  R['2-3'] = {
    hint: '崩れる床では止まらない。前から来る岩は地面で飛び越えよう。',
    area: 2,
    name: '2-3 くずれる床',
    theme: 'cave',
    exits: { right: '2-2', left: '2-4' },
    goal: 'left',
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
      '#......................#',
      '#......................#',
      '...................S....',
      '###cccc.cccc.cccc#######',
      '###^^^^^^^^^^^^^^#######',
    ],
    setup(W) {
      W.decor(440, 220, 'crystal');
      W.decor(410, 220, 'mushroom');
      W.decor(20, 220, 'crystal');
      W.sign(18, 11, 'この先 床がもろい');
      let started = false;
      for (const m of W.marks('c')) {
        const b = W.block(m.tx, m.ty, 1, 1, { code: 2, keep: true });
        b.onStep = () => {
          b.crumble(14);
          if (!started) {
            started = true;
            // 背後から大岩
            const big = W.rock(520, 240 - 28, { r: 28, cause: '大岩に轢かれた。走れ！' });
            big.vel(-1.55, 0);
            G.sfx('rumble');
            W.shake = 30;
            big.tick = function () {
              G.Rock.prototype.tick.call(this);
              if (this.cx < 265 && this.ay === 0) {
                this.ay = 0.3;
                G.sfx('whoosh');
              }
            };
          }
        };
      }
      // 出口の手前：前からも岩が転がってくる
      W.trig(2, 0, 1, 14, () => {
        const r = W.rock(-20, 240 - 14, { r: 14, cause: '前からも来るとは。' });
        r.vel(1.7, 0);
        G.sfx('rumble');
      });
    },
  };

  R['2-4'] = {
    hint: 'リンゴの動きは毎回同じ。ハテナブロックは叩かなくていい。',
    area: 2,
    name: '2-4 チェリーパーティ',
    theme: 'cave',
    exits: { right: '2-3', left: '2-B' },
    goal: 'left',
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
      '..S..........m.......S..',
      '####...######...########',
      '####^^^######^^^########',
    ],
    setup(W) {
      W.decor(160, 220, 'crystal');
      W.decor(360, 220, 'mushroom');
      W.sign(19, 11, 'パーティ会場\nこちら ←');
      const cherries = [
        [100, 60, 1.3, 1.0], [300, 150, -1.0, 1.25], [200, 200, 1.6, -0.7], [420, 40, -1.4, -1.1],
      ];
      for (const [x, y, vx, vy] of cherries) {
        const f = W.fruit(x, y, { keep: true, cause: 'パーティで浮かれすぎた。' });
        f.vel(vx, vy);
        f.bounds = { x0: 20, y0: 20, x1: 460, y1: 238 };
      }
      // ハテナブロック：叩くと巨大リンゴ
      const q = W.mark('m');
      const mb = W.block(q.tx, 8, 1, 1, { style: 'mystery', keep: true });
      mb.onBonk = () => {
        if (mb.used) return;
        mb.used = true;
        G.sfx('pop');
        const big = W.fruit(mb.cx, mb.y - 14, { r: 14, cause: 'いいものが出ると思った？' });
        big.vel(0, -3, 0, 0.18);
        big.splat = true;
        big.offscreenKill = 120;
      };
    },
  };

  R['2-B'] = {
    hint: '突進は足場の上かジャンプでかわす。着地の後は転がるリンゴに注意。',
    area: 2,
    name: 'BOSS デリシャス・キング',
    theme: 'cave',
    exits: { right: '2-4', left: '3-1' },
    goal: 'left',
    map: [
      '########################',
      '########################',
      '#......................#',
      '#......................#',
      '#......................#',
      '#......................#',
      '#......................#',
      '#......................#',
      '#..----..........----..#',
      '#......................#',
      '#......................#',
      '#.......................',
      '########################',
      '########################',
    ],
    setup(W, opts) {
      W.decor(40, 40, 'crystal');
      W.decor(420, 40, 'crystal');
      W.decor(120, 220, 'mushroom');
      W.decor(330, 220, 'rock');
      const openLeft = (fx) => {
        for (let ty = 9; ty <= 11; ty++) W.setTile(0, ty, 0);
        if (fx) {
          W.burst(10, 200, 30, ['#5f4e78', '#352a46', '#9ad0ff'], 2.5, { g: 0.15 });
          G.sfx('crumble');
        }
      };
      if (W.game && W.game.flags.kingDead) {
        openLeft(false);
        W.save(2, 11);
        W.sign(4, 11, '王は眠る。\nこの先、うそつき城');
        return;
      }
      W.closeGate = () => {
        const g = W.block(23, 6, 1, 3, { style: 'gate', keep: true });
        g.tweenTo(g.x, 180, 18, 'outBounce');
        G.sfx('stomp');
      };
      W.sign(14, 11, 'ただのリンゴです', { range: 40 });
      G.BOSSES.king(W, opts);
      W.onBossCleared = () => {
        openLeft(true);
        W.save(2, 11);
        for (const e of W.ents) if (e instanceof G.Sign) e.alive = false;
      };
    },
  };

  // =====================================================================
  // AREA 3 うそつき城
  // =====================================================================
  R['3-1'] = {
    hint: '看板は本当とウソが交互。低い天井の下ではジャンプしない。',
    area: 3,
    name: '3-1 うそつき看板',
    theme: 'castle',
    exits: { right: '2-B', left: '3-2' },
    goal: 'left',
    map: [
      '########################',
      '########################',
      '########################',
      '########################',
      '#......................#',
      '#......................#',
      '#......................#',
      '#......................#',
      '#..............#####...#',
      '#.......................',
      '#.......................',
      '.....................S..',
      '########FF##############',
      '########^^##############',
    ],
    setup(W) {
      W.decor(60, 120, 'window');
      W.decor(400, 120, 'window');
      W.decor(240, 110, 'banner');
      W.decor(130, 200, 'torch');
      W.decor(440, 200, 'torch');
      // A：正直な看板（低い天井の下でジャンプするとトゲ）
      W.sign(20, 11, 'ここではジャンプ禁止', { range: 30 });
      const ceil = [];
      for (let tx = 15; tx <= 19; tx++) ceil.push(W.spike(tx, 9, 'd', { hidden: true, cause: '看板は本当のことも言う。' }));
      W.trigPx(296, 0, 108, 280, () => ceil.forEach((c) => c.pop(3)), { cond: (P) => !P.onGround && P.vy < 0 });
      // B：うそつき看板（トゲなし→ある）
      W.sign(14, 11, 'この先 トゲなし', { range: 30 });
      W.popSpike(12, 11, 'u', [12, 9, 1, 3], { cause: '看板を信じた結果がこれだ。' });
      // C：うそつき看板（偽物のブロック）
      W.sign(10, 11, 'このブロックは本物です', { range: 30 });
      // D：正直な看板（後ろからトゲが飛んでくる）
      W.sign(5, 11, 'うしろに注意', { range: 30 });
      W.trig(4, 0, 1, 14, () => {
        const s = W.spikePx(500, 220, 'l', { cause: 'うしろに注意と書いてあったのに。' });
        s.vel(-5, 0);
        G.sfx('whoosh');
      });
    },
  };

  R['3-2'] = {
    hint: '天井の真ん中のオーブは罠。ジャンプで飛び越えよう。',
    area: 3,
    name: '3-2 さかさまの間',
    theme: 'castle',
    exits: { right: '3-1', left: '3-3' },
    goal: 'left',
    map: [
      '########################',
      '#...........vv.........#',
      '#......................#',
      '#......................#',
      '#......................#',
      '#......................#',
      '#......................#',
      '#......................#',
      '#......................#',
      '#......................#',
      '#......................#',
      '.....................S..',
      '###^^^^^^^^^^^^^^^######',
      '########################',
    ],
    setup(W) {
      W.decor(440, 200, 'torch');
      W.decor(20, 200, 'torch');
      W.decor(230, 100, 'chain', { len: 60 });
      W.sign(19, 11, 'オーブにさわると\n重力が反転する', { range: 30 });
      W.orb(370, 190, { dir: 2 });
      // 天井から落ちる（上に）リンゴ
      const a = W.fruit(300, 252, { cause: 'さかさまの世界ではリンゴも上に落ちる。' });
      W.trigPx(0, 0, 480, 280, () => W.after(TUNE.a32_delay, () => a.vel(0, -1, 0, -TUNE.a32_g)), {
        cond: (P) => W.gravity === -1 && P.onGround && P.cx < 352,
      });
      // 罠のオーブ（穴の真上で元に戻る）
      W.orb(170, 30, { dir: 1 });
      W.text(170, 62, 'このオーブで帰れます', { size: 9, color: '#c58cff' });
      // 本物の出口側オーブ
      W.orb(50, 30, { dir: 1 });
    },
    pitCause: '重力に裏切られた。',
    // 検証ソルバー用の距離の目安（ゲームには影響しない）
    solverH(W) {
      const P = W.player;
      if (W.gravity === -1) return Math.hypot(P.cx - 50, P.cy - 30) + 60;
      if (P.cx < 100) return P.cx;
      return Math.hypot(P.cx - 370, P.cy - 190) + 500;
    },
  };

  R['3-3'] = {
    hint: '火の玉が沈んだ瞬間に跳ぼう。最上段は看板から離れた右端へ。',
    area: 3,
    name: '3-3 マグマの塔',
    theme: 'castle',
    exits: { right: '3-2', up: '3-4' },
    goal: 'up',
    map: [
      '#########...############',
      '#......................#',
      '#......................#',
      '#......................#',
      '#.......----...........#',
      '#>.....................#',
      '#>.cccc................#',
      '#.........s............#',
      '#........----..........#',
      '#......................#',
      '#..............----....#',
      '#....................S..',
      '########################',
      '########################',
    ],
    setup(W) {
      W.decor(440, 200, 'torch');
      W.decor(20, 40, 'banner');
      W.decor(400, 60, 'window');
      const lava = W.lava(300, { speed: 0 });
      // 崩れる足場
      const c = W.mark('c');
      const cp = W.block(c.tx, c.ty, 4, 1, { oneway: true, code: 3, keep: true });
      cp.onStep = () => cp.crumble(18);
      // 一休みすると…
      W.sign(9, 3, 'ここで一休み', { range: 24 });
      const hs = [W.spike(9, 3, 'u', { invisible: true, cause: '休んでいる暇はない。' }), W.spike(10, 3, 'u', { invisible: true, cause: '休んでいる暇はない。' })];
      W.trigPx(180, 40, 40, 40, () => {
        hs.forEach((h) => h.show());
        G.sfx('pop');
      }, { cond: (P) => P.onGround });
      // マグマ上昇開始
      W.trigPx(0, 0, 480, 210, () => {
        lava.speed = 0.45;
        G.sfx('rumble');
        W.shake = 20;
        W.say('マグマが上がってきた！', 240, 150, 70, { plain: true, size: 11, color: '#ffb070' });
      }, { cond: (P) => P.onGround });
      // 最上段に来ると本気を出す
      W.trigPx(0, 0, 480, 90, () => {
        lava.speed = 1.4;
        W.say('ゴボゴボゴボ…', 240, 200, 60, { plain: true, size: 11, color: '#ffb070' });
        G.sfx('rumble');
      }, { cond: (P) => P.onGround });
      // マグマから跳ねる火の玉
      const fb = W.hbox(262, 300, 14, 14, { kind: 'fire', cause: '火の玉に焼かれた。' });
      fb.offscreenKill = false;
      W.run(function* () {
        for (;;) {
          yield 70;
          fb.y = Math.min(lava.y, 290);
          fb.vel(0, -6.2, 0, 0.18);
          yield () => fb.vy > 0 && fb.y > lava.y;
          fb.stop();
          fb.y = 400;
        }
      });
    },
  };

  R['3-4'] = {
    hint: 'エンドロールの行に乗り、天井が近づいたら下の行へ降りよう。',
    area: 3,
    name: '3-4 THE END',
    theme: 'castle',
    music: null,
    exits: { down: '3-3', right: '4-1' },
    goal: 'right',
    map: [
      '########################',
      '#.......................',
      '#.......................',
      '#.......................',
      '#.................######',
      '#......................#',
      '#......................#',
      '#......................#',
      '#......................#',
      '#......................#',
      '#......................#',
      '#.........---...S......#',
      '#########...############',
      '#########...############',
    ],
    pitCause: 'エンドロールの下は奈落だった。',
    solverGoalPos: [470, 50],
    setup(W) {
      W.decor(60, 150, 'banner');
      W.decor(400, 150, 'banner');
      W.decor(40, 200, 'torch');
      W.decor(420, 200, 'torch');
      const LINES = [
        [150, 180, 'STAFF ROLL', []],
        [40, 200, 'ゲームデザイン …… Claude', [0]],
        [250, 200, 'プログラム …… Claude', [8, 9]],
        [100, 240, 'トゲの配置 …… Claude', [5, 6]],
        [280, 180, 'リンゴ …… デリシャスフルーツ', []],
        [60, 220, '月 …… 月（友情出演）', [0, 1]],
        [200, 260, '……というのはウソ', []],
      ];
      let party = false;
      W.onStep = () => {
        if (party && W.time % 3 === 0 && !G.headless)
          W.addP({ x: W.rng.range(0, 480), y: -4, vx: G.fx.range(-0.5, 0.5), vy: G.fx.range(0.6, 1.4), g: 0.01, life: 300, c: G.fx.pick(['#ff3a5a', '#ffd84a', '#7affc8', '#8ab4ff', '#ffffff']), s: 2 });
      };
      W.trigPx(0, 0, 480, 250, () => {
        W.run(function* () {
          party = true;
          G.music(null);
          G.sfx('fanfare');
          const t1 = W.text(240, 60, 'THE END', { size: 30, color: '#ffe9a8' });
          const t2 = W.text(240, 92, 'Thank you for playing!', { size: 12, color: '#ffffff' });
          yield 60;
          G.music('ending');
          yield 120;
          t1.alpha = t2.alpha = 0;
          W.say('スタッフロールを\nご覧ください', 240, 150, 120, {});
          for (let i = 0; i < LINES.length; i++) {
            const [x, w, text, spikes] = LINES[i];
            const b = W.blockPx(x, 290, w, 10, { oneway: true, style: 'credit', keep: true, layer: -1 });
            b.uiLabel = text;
            b.squishCause = 'スタッフロールに押しつぶされた。';
            const last = i === LINES.length - 1;
            const kids = spikes.map((o) => W.spikePx(x + o * 20, 270, 'u', { keep: true, cause: 'スタッフロールにもトゲはある。', pal: 'gold' }));
            b.vel(0, -0.55);
            b.tick = function () {
              Block.prototype.tick.call(this);
              for (let k = 0; k < kids.length; k++) {
                kids[k].x = this.x + spikes[k] * 20;
                kids[k].y = this.y - 20;
              }
              if (last && this.y <= 80) {
                this.stop();
                this.y = 80;
                this.yr = 0;
              }
              if (!last && this.y < 12) {
                this.alive = false;
                kids.forEach((s) => (s.alive = false));
              }
            };
            if (i === 0) {
              // 最初の行が床を通り過ぎたら床が崩れる
              W.run(function* () {
                yield () => b.y < 246;
                W.shake = 24;
                G.sfx('rumble');
                W.say('足元にご注意ください', 240, 120, 60, { plain: true, size: 11, color: '#ffe9a8' });
                yield 24;
                for (let tx = 1; tx <= 22; tx++)
                  for (let ty = 11; ty <= 13; ty++) if (W.tile(tx, ty)) W.setTile(tx, ty, 0);
                W.exits.down = null;
                W.burst(240, 250, 80, ['#5b5970', '#3a384a', '#77758e'], 3, { g: 0.2, spread: 200, life: 60 });
                G.sfx('crumble');
              });
            }
            if (last) {
              W.after(60, () => {
                G.music(null);
                G.sfx('scratch');
                W.say('……というのはウソ。\nまだまだ続くよ！', 330, 70, 150, {});
                party = false;
              });
              W.after(200, () => G.music('castle'));
            }
            yield 75;
          }
        });
      }, { cond: (P) => P.onGround });
    },
  };

  // =====================================================================
  // AREA 4 月への階段
  // =====================================================================
  R['4-1'] = {
    hint: '流れ星は早めに見て避けよう。消える雲には長く乗らない。',
    area: 4,
    name: '4-1 星降る夜',
    theme: 'sky',
    exits: { left: '3-4', right: '4-2' },
    goal: 'right',
    map: [
      '########################',
      '.......................#',
      '.......................#',
      '.......................#',
      '####...................#',
      '#......................#',
      '#.....---......---.....#',
      '#......................#',
      '#..........ccc.........#',
      '#......................#',
      '#......................#',
      '#...................S...',
      '#...................####',
      '#.......................',
    ],
    pitCause: '星の海に落ちた。',
    setup(W) {
      W.decor(380, 70, 'moonbg', { r: 30, face: 'calm', alpha: 0.9 });
      W.say('……まだ来るな。', 380, 34, 120, {});
      // 消える雲
      const c = W.mark('c');
      const cloud = W.block(c.tx, c.ty, 3, 1, { oneway: true, style: 'cloud', keep: true });
      cloud.h = 8;
      cloud.onStep = () => {
        if (cloud.fading) return;
        cloud.fading = true;
        W.after(22, () => {
          cloud.collidable = false;
          cloud.visible = false;
          W.burst(cloud.cx, cloud.cy, 14, ['#ffffff', '#c8d4f0'], 1.2, { g: 0, life: 20 });
          W.after(150, () => {
            cloud.collidable = true;
            cloud.visible = true;
            cloud.fading = false;
          });
        });
      };
      // 流れ星の雨
      W.run(function* () {
        yield 30;
        for (;;) {
          const x = W.rng.range(60, 520);
          const st = W.fruit(x, -10, { kind: 'star', r: 6, cause: '流れ星に願う暇もなかった。' });
          st.vel(-0.8, 2.0);
          st.trail = true;
          yield 58;
        }
      });
      // 狙い撃ちの流れ星
      W.trigPx(290, 0, 90, 140, () => {
        W.run(function* () {
          const mk = W.text(468, 12, '✦', { size: 14, color: '#fff27a' });
          G.sfx('charge');
          yield TUNE.st41_tele;
          mk.alive = false;
          const P = W.player;
          const sx = 470,
            sy = 10;
          const dx = P.cx - sx,
            dy = P.cy - sy;
          const d = Math.hypot(dx, dy) || 1;
          const st = W.fruit(sx, sy, { kind: 'star', r: 8, cause: '狙われていた。立ち止まると危ない。' });
          st.vel((dx / d) * 6.5, (dy / d) * 6.5);
          G.sfx('whoosh');
        });
      }, { cond: (P) => P.onGround });
    },
  };

  R['4-2'] = {
    hint: '床から撃つと鏡で跳ね返る。左の足場の上から撃とう。',
    area: 4,
    name: '4-2 鏡の間',
    theme: 'sky',
    exits: { left: '4-1', right: '4-3' },
    goal: 'right',
    // 検証ソルバー用の距離の目安（ゲームには影響しない）
    solverH(W) {
      const P = W.player;
      if (!W.vars.phase) {
        let h = Math.hypot(P.cx - 120, P.cy - 153) + 600;
        for (const b of W.bullets) {
          if (b.vy < 0) h = Math.min(h, 300 + b.y);
          else if (b.hostile && b.vx > 0 && b.y < 70) h = Math.min(h, 200 + (400 - b.x));
          else if (!b.hostile && b.vx > 0 && Math.abs(b.y - 150) < 10) h = Math.min(h, 450 + (290 - b.x) * 0.3);
        }
        return h;
      }
      return 480 - P.cx;
    },
    map: [
      '########################',
      '#....................#.#',
      '#....................#.#',
      '#....................#.#',
      '#....................#.#',
      '#....................#.#',
      '#....................#.#',
      '#....................#.#',
      '#...----.............#.#',
      '#......................#',
      '#......................#',
      '.S......................',
      '########################',
      '########################',
    ],
    setup(W) {
      W.decor(240, 60, 'moonbg', { r: 20, face: 'none', alpha: 0.5 });
      W.sign(3, 11, 'スイッチを撃って\n扉を開けよう', { range: 30 });
      W.mirror(16, 11, '|');
      W.mirror(14, 7, '/');
      W.mirror(14, 2, '/');
      const gate = W.block(21, 9, 1, 3, { style: 'gate', keep: true });
      W.switchAt(19, 2, () => {
        W.vars.phase = 1;
        gate.tweenTo(gate.x, gate.y - 70, 40, 'inOutQuad', () => gate.kill());
        G.sfx('rumble');
        W.say('ゴゴゴ…', 430, 170, 60, { plain: true, size: 10, color: '#ffe9a8' });
      });
    },
  };

  R['4-3'] = {
    hint: 'ジャンプ台は罠。旗には触れず、リンゴが落ちてから穴へ。',
    area: 4,
    name: '4-3 最後の階段',
    theme: 'sky',
    exits: { left: '4-2', up: '4-B' },
    goal: 'up',
    map: [
      '############...#########',
      '#......................#',
      '#......................#',
      '#..........#######.....#',
      '#.....###............s.#',
      '#.....vvv...........####',
      '#......................#',
      '#......................#',
      '#.........###..........#',
      '#......................#',
      '#......................#',
      '.S.....................#',
      '########################',
      '########################',
    ],
    setup(W) {
      W.decor(60, 200, 'crystal');
      // 踏むと天井のトゲへ一直線のジャンプ台
      W.spring(7, 11, { power: 7.4 });
      W.sign(4, 11, '大ジャンプ台！\n上までひとっとび', { range: 30 });
      // 往復する足場
      const m = W.block(13, 7, 3, 1, { code: 2, keep: true });
      W.run(function* () {
        for (;;) {
          m.tweenTo(320, m.y, 90, 'inOutQuad');
          yield 120;
          m.tweenTo(260, m.y, 90, 'inOutQuad');
          yield 120;
        }
      });
      // 偽のゴール旗
      const flag = W.decor(16 * 20, 2 * 20, 'goalflag');
      const fs = W.spike(16, 2, 'u', { invisible: true, cause: 'ゴールだと思った？', pal: 'gold', size: 20 });
      W.trig(16, 1, 1, 2, () => {
        flag.alive = false;
        fs.show();
        G.sfx('pop');
      });
      // 穴の下に来たところへ月がリンゴを落とし、のぞいて笑う
      W.trigPx(220, 0, 80, 60, () => {
        W.after(TUNE.a43_delay, () => {
          const a = W.fruit(270, -8, { cause: '月からの贈り物。', splat: true });
          a.vel(0, 4, 0, 0.8);
          G.sfx('whoosh');
          W.after(14, () => {
            const peek = W.decor(260, -18, 'moonbg', { r: 24, face: 'grin', layer: 5 });
            peek.tweenTo(260, 4, 16, 'outQuad');
            W.say('ククク…', 260, 30, 50, {});
            W.after(56, () => peek.tweenTo(260, -40, 24, 'inQuad', () => peek.kill()));
          });
        });
      }, { cond: (P) => P.onGround });
    },
  };

  R['4-B'] = {
    hint: '月落としは影から離れて衝撃波を飛び越える。足場の上から撃とう。',
    area: 4,
    name: 'FINAL  THE MOON',
    theme: 'moon',
    bg: 'space',
    music: null,
    exits: { down: '4-3' },
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
      '#.S.........---........#',
      '############...#########',
      '############...#########',
    ],
    setup(W, opts) {
      W.sealFloor = () => {
        for (let tx = 12; tx <= 14; tx++) for (let ty = 12; ty <= 13; ty++) W.setTile(tx, ty, 1);
        W.exits.down = null;
      };
      G.BOSSES.moon(W, opts);
    },
  };
})();
