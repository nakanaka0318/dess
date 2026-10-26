// 超高難易度エリア（各ステージに1つ）：騙しは少なめで、とにかく難しい。ゴールに黄色い三角（収集要素）
//  入口の「極」の扉は、そのステージをクリアした後のボス部屋などに現れる
(function () {
  'use strict';
  const G = globalThis.G;
  const T = G.T;
  const R = G.ROOMS;
  const Ent = G.Ent;
  const addTo = G.addTo;

  G.TRIS = 6;
  G.triCount = (flags) => {
    let n = 0;
    for (let i = 1; i <= G.TRIS; i++) if (flags && flags['tri' + i]) n++;
    return n;
  };

  // 黄色い三角
  class Triangle extends Ent {
    constructor(W, cx, cy, n) {
      super(W, cx - 8, cy - 8, 16, 16);
      this.n = n;
      this.layer = 3;
      this.baseY = this.y;
    }
    tick() {
      this.y = this.baseY + Math.sin(this.t * 0.07) * 2;
      const W = this.W,
        P = W.player;
      if (!P.alive || !G.overlap(P, this)) return;
      this.alive = false;
      W.vars.goal = true;
      let k = 1;
      if (W.game) {
        W.game.flags['tri' + this.n] = true;
        k = G.triCount(W.game.flags);
        if (W.game.stats) W.game.stats['tri' + this.n] = true;
        if (W.game.writePersist) W.game.writePersist();
      }
      G.sfx('fanfare');
      W.flash = 10;
      W.flashColor = '#fff2a8';
      W.burst(this.cx, this.cy, 60, ['#ffe040', '#fff8c0', '#ffffff'], 3, { g: 0, life: 50 });
      W.say(`黄色い三角を手に入れた！（${k}/${G.TRIS}）`, 240, 70, 160, { plain: true, size: 14, color: '#ffe040' });
      if (this.onGet) this.onGet();
    }
    draw(ctx) {
      G.Render.drawTriangle(ctx, this);
    }
  }
  G.Triangle = Triangle;
  G.World.prototype.triangle = function (cx, cy, n) {
    if (this.game && this.game.flags['tri' + n]) {
      this.text(cx, cy, '（取った）', { size: 8, color: '#a89cc8' });
      this.vars.goal = true;
      return null;
    }
    return this.add(new Triangle(this, cx, cy, n));
  };

  // 極エリア（AREA 101〜106）
  const EXA = {
    1: ['極1  トゲの試練', '〜 リンゴとトゲと、きみだけ 〜', 'castle'],
    2: ['極2  灼熱の試練', '〜 流砂と炎 〜', 'temple'],
    3: ['極3  無重力の試練', '〜 上も下も、出口もない 〜', 'void'],
    4: ['極4  月面の試練', '〜 赤と青 〜', 'farside'],
    5: ['極5  天空の試練', '〜 落ちたら、そこからやり直し 〜', 'tower'],
    6: ['極6  宇宙の試練', '〜 息を止めて 〜', 'last'],
  };
  for (const n of Object.keys(EXA)) G.AREAS[100 + +n] = { stage: +n, title: 'EX ' + EXA[n][0], sub: EXA[n][1], music: EXA[n][2] };

  // 入口の扉（ボス部屋の左の足場の上など）
  function exDoor(W, n, tx, ty) {
    if (W.vars.exDoor) return;
    W.vars.exDoor = true;
    W.door(tx, ty, { to: 'EX' + n + '-1', spawn: [1, 11], label: '極' });
    const got = W.game && W.game.flags['tri' + n];
    W.text(tx * T + 10, ty * T - 8, got ? '超高難易度（▲取った）' : '超高難易度', { size: 8, color: '#ffe040' });
  }
  G.exDoor = exDoor;
  // ボス部屋：クリア後（openNext のあと）に、左の足場の上へ扉
  const bossRooms = [['4-B', 1, 'stage1Clear'], ['6-B', 2, 'stage2Clear'], ['8-B', 3, 'treeDead'], ['9-X', 4, 'stage4Clear']];
  for (const [id, n, flag] of bossRooms) {
    addTo(id, (W) => {
      const put = () => exDoor(W, n, 4, 6);
      if (W.game && W.game.flags[flag]) put();
      const base = W.openNext;
      if (base)
        W.openNext = (fx) => {
          base(fx);
          put();
        };
    });
  }
  addTo('10-T', (W) => {
    const put = () => exDoor(W, 5, 21, 11);
    if (W.game && W.game.flags.stage5Clear) put();
    const base = W.openNext;
    if (base)
      W.openNext = (fx) => {
        base(fx);
        put();
      };
  });
  // 6面：一度ゲームをクリアすると、11-1 のスタート地点の上の足場に扉
  {
    const d = R['11-1'];
    d.map = d.map.map((row, i) => (i === 8 ? '#---' + row.slice(4) : row));
  }
  addTo('11-1', (W) => {
    const g = W.game;
    if (g && ((g.stats && g.stats.clears > 0) || g.flags.trueMoonDead)) exDoor(W, 6, 2, 6);
  });

  // 極エリアの部屋（2画面目のゴールに黄色い三角。取ると帰りの扉）
  function exRoom(n, k, def) {
    const id = 'EX' + n + '-' + k;
    const setup = def.setup;
    R[id] = Object.assign({ area: 100 + n }, def, {
      setup(W, opts) {
        if (setup) setup(W, opts || {});
      },
    });
    return R[id];
  }
  G.exRoom = exRoom;
  // ゴール：黄色い三角と、帰りの扉
  function goal(W, n, cx, cy, back) {
    const t = W.triangle(cx, cy, n);
    const door = () => W.door(back.tx, back.ty, { to: back.to, spawn: back.spawn, label: '↩' });
    if (t) t.onGet = () => W.after(40, door);
    else door();
  }
  G.exGoal = goal;

  // =====================================================================
  // 極1 トゲの試練（1面：トゲ・リンゴ・崩れる床）
  // =====================================================================
  exRoom(1, 1, {
    name: '極1-1 針の回廊',
    hint: '天井のトゲがあるので2段ジャンプは禁止。1マスの柱へ、ふつうのジャンプで正確に。',
    theme: 'castle',
    exits: { right: 'EX1-2' },
    map: [
      '########################',
      '########################',
      '########################',
      '########################',
      '#......................#',
      '#......................#',
      '#......................#',
      '#vvvvvvvvvvvvvvvvvvvvvv#',
      '#......................#',
      '#.......................',
      '#.......................',
      '#.S.....................',
      '####^^^#^^^#^^^#^^^#^^##',
      '########################',
    ],
    spikeCauseFn: (W) => (W.player.y < 180 ? '2段ジャンプは禁止と言ったのに。' : '1マスの柱は、せまい。'),
    setup(W) {
      W.sign(3, 11, '極1：2段ジャンプ禁止', { range: 24 });
    },
  });
  exRoom(1, 2, {
    name: '極1-2 リンゴの雨',
    hint: '崩れる橋の上で止まらない。リンゴは決まった順に落ちてくるので、リズムを覚えよう。',
    theme: 'castle',
    exits: { left: 'EX1-1' },
    goal: 'flag',
    goalPos: [450, 220],
    map: [
      '########################',
      '#......................#',
      '#......................#',
      '#......................#',
      '#......................#',
      '#......................#',
      '#......................#',
      '#......................#',
      '####vvvvvvvvvvvvvvvv...#',
      '.......................#',
      '.......................#',
      '..S....................#',
      '####BBBBBBBBBBBBBBBB####',
      '####^^^^^^^^^^^^^^^^####',
    ],
    spikeCauseFn: (W) => (W.player.y < 200 ? '低い天井。跳びすぎた。' : '崩れる橋の上では、止まってはいけない。'),
    setup(W) {
      for (let tx = 4; tx <= 19; tx++) {
        const b = W.tileToBlock(tx, 12, { keep: true });
        b.onStep = () => b.crumble(10);
      }
      // リンゴは決まった周期で、決まった列に落ちる
      const cols = [7, 11, 15, 9, 13, 17];
      W.run(function* () {
        let i = 0;
        for (;;) {
          const x = cols[i % cols.length] * T + 10;
          const a = W.fruit(x, 28, { cause: 'リンゴの雨に打たれた。', splat: true });
          a.vel(0, 3.5, 0, 0.3);
          i++;
          yield 15;
        }
      });
      goal(W, 1, 450, 220, { tx: 21, ty: 10, to: '4-B', spawn: [6, 11] });
    },
  });

  // ---------------------------------------------------------------------
  // 共通の小道具
  // ---------------------------------------------------------------------
  const fire = (W, tx, o) => W.laser(tx * T + 4, 40, 12, 200, { warn: o.warn || 18, dur: o.dur || 22, cause: o.cause || '炎の波に飲まれた。', color: '#ff7a20' });
  const o2tank = (W, cx, cy) =>
    W.add(
      new G.Pickup(W, cx, cy, 'o2', () => {
        W.vars.o2 = 1;
        G.sfx('save');
      })
    );
  const o2UI = (ctx, W, UI) => {
    if (W.vars.o2 != null) G.Render.drawO2(ctx, W.vars.o2, UI);
  };

  // =====================================================================
  // 極2 灼熱の試練（2面：炎・流砂・砂嵐）
  // =====================================================================
  exRoom(2, 1, {
    name: '極2-1 炎の波',
    hint: '炎は左から順に波のように噴く。流砂に落ちたらジャンプ連打。波のすぐ後ろを追いかけよう。',
    theme: 'temple',
    bg: 'temple',
    exits: { right: 'EX2-2' },
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
      '#.......................',
      '#.......................',
      '#.S.....................',
      '#####..####..####..#####',
      '#####^^####^^####^^#####',
    ],
    spikeCauseFn: () => '流砂の底は、トゲだった。',
    setup(W) {
      W.sign(3, 11, '極2：炎の波', { range: 24 });
      for (const x of [100, 220, 340]) W.quicksand(x, 238, 40, 30);
      const jets = [4, 8, 10, 14, 16, 20];
      for (const tx of jets) W.decor(tx * T, 11 * T, 'vent');
      W.run(function* () {
        yield 30;
        for (;;) {
          for (const tx of jets) {
            fire(W, tx, { dur: 26 });
            yield 11;
          }
          yield 22;
        }
      });
    },
  });
  exRoom(2, 2, {
    name: '極2-2 流砂の海',
    hint: '流砂の海に立つ石の柱を渡る。砂嵐は空中にいる時だけ吹く。風がやんでから跳ぼう。',
    theme: 'desert',
    bg: 'desert',
    exits: { left: 'EX2-1' },
    goal: 'flag',
    goalPos: [450, 220],
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
      '.......................#',
      '.......................#',
      '..S....#....#...#......#',
      '###....#....#...#....###',
      '###^^^^#^^^^#^^^#^^^^###',
    ],
    spikeCauseFn: () => '流砂の海に沈んだ。',
    setup(W) {
      W.quicksand(60, 238, 360, 34);
      W.windAir = true;
      W.run(function* () {
        yield 60;
        for (;;) {
          W.vars.windWarn = 1;
          yield 30;
          W.vars.windWarn = 0;
          W.windX = -1.3;
          yield 70;
          W.windX = 0;
          yield 90;
        }
      });
      goal(W, 2, 450, 220, { tx: 21, ty: 10, to: '6-B', spawn: [6, 11] });
    },
    drawFg(ctx, W) {
      G.Render.drawSandstorm(ctx, W);
    },
  });

  // =====================================================================
  // 極3 無重力の試練（3面：低重力・重力反転・ワームホール）
  // =====================================================================
  exRoom(3, 1, {
    name: '極3-1 天井歩き',
    hint: 'オーブで天井へ。止まったまま反転すると天井のトゲ。走りながら反転し、右のオーブで床へ戻る。',
    theme: 'void',
    bg: 'void',
    exits: { right: 'EX3-2' },
    map: [
      '########################',
      '#vvvvvvv...vv...vvvvvvv#',
      '#......................#',
      '#......................#',
      '#.........^^^^.........#',
      '#.........####.........#',
      '#.........vvvv.........#',
      '#......................#',
      '#......................#',
      '#.......................',
      '#.......................',
      '#.S.....^^^^^^^^..^^....',
      '########################',
      '########################',
    ],
    spikeCauseFn: (W) => (W.gravity === -1 ? '天井にもトゲ。' : '床のトゲ。重力はいつも下とは限らない。'),
    // 検証ソルバー用の距離の目安（ゲームには影響しない）
    solverH(W) {
      const P = W.player;
      if (W.gravity === -1) return 300 + Math.hypot(P.cx - 350, P.cy - 50);
      if (!W.vars.flipped) return 600 + Math.hypot(P.cx - 130, P.cy - 210);
      return 480 - P.cx;
    },
    setup(W) {
      W.gravScale = 0.7;
      W.onStep = () => {
        if (W.gravity === -1) W.vars.flipped = true;
      };
      W.orb(130, 210, {});
      W.orb(350, 50, {});
    },
  });
  exRoom(3, 2, {
    name: '極3-2 ワームホール連鎖',
    hint: '左のワームホールで1つ目の足場へ。低重力で2つ目の足場へ跳び、上のワームホールで三角の足場の上へ。',
    theme: 'void',
    bg: 'void',
    exits: { left: 'EX3-1' },
    goal: 'flag',
    goalPos: [440, 160],
    map: [
      '########################',
      '#vvvvvvvvvvvvvvvvvvvvvv#',
      '#......................#',
      '#......................#',
      '#...............##.....#',
      '#......................#',
      '#......................#',
      '#........##............#',
      '#......................#',
      '.....................###',
      '.......................#',
      '..S....................#',
      '###^^^^^^^^^^^^^^^^^^^^#',
      '########################',
    ],
    spikeCauseFn: (W) => (W.player.y < 100 ? '低重力。跳びすぎた。' : '宇宙の底のトゲ。'),
    setup(W) {
      W.gravScale = 0.7;
      W.wormholes([92, 168], [200, 104], '#4ab0ff');
      W.wormholes([336, 44], [432, 120], '#ffd84a');
      for (const [x, y] of [[260, 120], [280, 180], [390, 60], [380, 200]]) W.spikePx(x - 10, y - 10, 'u', { keep: true, cause: '宇宙をただようトゲ。', pal: 'crystal' });
      goal(W, 3, 440, 164, { tx: 21, ty: 7, to: '8-B', spawn: [6, 11] });
    },
  });

  // =====================================================================
  // 極4 月面の試練（4面：赤青ブロック）
  // =====================================================================
  exRoom(4, 1, {
    name: '極4-1 赤と青の橋',
    hint: '2段ジャンプは天井のトゲ。橋のはしで跳んだ瞬間に右のスイッチを撃つと、空中で色が切り替わる。',
    theme: 'moon',
    bg: 'farside',
    exits: { right: 'EX4-2' },
    map: [
      '########################',
      '########################',
      '########################',
      '########################',
      '########################',
      '########################',
      '########################',
      '#vvvvvvvvvvvvvvvvvvvvvv#',
      '#......................#',
      '#.......................',
      '#.......................',
      '#.S.....................',
      '###....................#',
      '###^^^^^^^^^^^^^^^^^^^^#',
    ],
    spikeCauseFn: (W) => (W.player.y < 180 ? '月の重力でも、2段ジャンプは天井まで届く。' : '赤と青をまちがえた。'),
    solverH: (W) => 480 - W.player.cx,
    setup(W) {
      W.vars.tog = 0;
      const seg = (a, b, c) => {
        const l = [];
        for (let tx = a; tx <= b; tx++) l.push([tx, 12]);
        W.toggles(l, c);
      };
      seg(3, 7, 'red');
      seg(8, 12, 'blue');
      seg(13, 17, 'red');
      seg(18, 22, 'blue');
      W.add(new G.ToggleSwitch(W, 11, 11));
      W.add(new G.ToggleSwitch(W, 23, 11));
    },
  });
  exRoom(4, 2, {
    name: '極4-2 赤と青の塔',
    hint: '足場は赤と青が交互。跳んでいる間に、その高さのスイッチを撃って次の色に切り替える。',
    theme: 'moon',
    bg: 'farside',
    exits: { left: 'EX4-1' },
    goal: 'flag',
    goalPos: [430, 30],
    map: [
      '########################',
      '#......................#',
      '#..................###.#',
      '#......................#',
      '#......................#',
      '#......................#',
      '#......................#',
      '#......................#',
      '#......................#',
      '.......................#',
      '.......................#',
      '..S....................#',
      '#####^^^^^^^^^^^^^^^^^^#',
      '########################',
    ],
    spikeCauseFn: () => '赤と青をまちがえた。',
    setup(W) {
      W.vars.tog = 0;
      W.toggles([[6, 10], [7, 10], [8, 10]], 'red');
      W.toggles([[10, 8], [11, 8], [12, 8]], 'blue');
      W.toggles([[14, 6], [15, 6], [16, 6]], 'red');
      W.toggles([[17, 4], [18, 4]], 'blue');
      for (const [tx, ty] of [[13, 9], [17, 7], [21, 5], [22, 3]]) W.add(new G.ToggleSwitch(W, tx, ty));
      goal(W, 4, 430, 26, { tx: 20, ty: 0, to: '9-X', spawn: [6, 11] });
    },
  });

  // =====================================================================
  // 極5 天空の試練（5面：風・崩れる足場・風船）
  // =====================================================================
  exRoom(5, 1, {
    name: '極5-1 風の柱',
    hint: '1マスの柱を、風がやんでいる間に登る。崩れる柱には長く立たない。',
    theme: 'sky',
    bg: 'dusk',
    exits: { up: 'EX5-2' },
    goal: 'up',
    map: [
      '#########...############',
      '#......................#',
      '#..........#...........#',
      '#......................#',
      '#..............#.......#',
      '#......................#',
      '#..........#...........#',
      '#......................#',
      '#......#...............#',
      '#......................#',
      '#..........#...........#',
      '#.S....................#',
      '########################',
      '########################',
    ],
    spikeCauseFn: () => '風に流された。',
    setup(W) {
      W.windAir = true;
      for (const [tx, ty] of [[11, 6], [16, 4]]) {
        const b = W.tileToBlock(tx, ty, { keep: true });
        b.onStep = () => b.crumble(18);
      }
      W.run(function* () {
        yield 50;
        for (;;) {
          W.vars.windWarn = 1;
          yield 30;
          W.vars.windWarn = 0;
          W.windX = 1.4;
          yield 60;
          W.windX = 0;
          yield 100;
        }
      });
    },
    drawFg(ctx, W) {
      G.Render.drawTowerWind(ctx, W);
    },
  });
  exRoom(5, 2, {
    name: '極5-2 風船の煙突',
    hint: '足場の左はしから風船へ。すぐ左へ寄せて、トゲの棚のすき間を左右に縫って上へ。風は左右から交互。',
    theme: 'sky',
    bg: 'night',
    exits: { down: 'EX5-1' },
    goal: 'flag',
    goalPos: [270, 40],
    map: [
      '########################',
      '#########......#########',
      '#########......#########',
      '#########......#########',
      '#########..^^^^#########',
      '#########......#########',
      '#########......#########',
      '#########^^^^..#########',
      '#########......#########',
      '#########......#########',
      '#########..^^^^#########',
      '#########....S.#########',
      '#########...############',
      '#########...############',
    ],
    spikeCauseFn: () => '風船は、トゲに弱い。きみも。',
    setup(W) {
      W.balloon(204, 238, { dur: 420 });
      // 煙突の中は、左右から交互に風
      W.windAir = true;
      W.run(function* () {
        for (;;) {
          W.windX = 0.4;
          yield 70;
          W.windX = -0.4;
          yield 70;
        }
      });
      goal(W, 5, 270, 40, { tx: 10, ty: 1, to: '10-T', spawn: [17, 12] });
    },
  });

  // =====================================================================
  // 極6 宇宙の試練（6面：酸素・レーザー・UFO・土星の環）
  // =====================================================================
  exRoom(6, 1, {
    name: '極6-1 息を止めて',
    hint: '酸素は約4秒。ボンベを取りながら、床をなめるレーザーを跳び越え、UFOの下は跳んで越える。',
    theme: 'station',
    bg: 'station',
    exits: { right: 'EX6-2' },
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
      '#.......................',
      '#.......................',
      '#.S.....................',
      '#####..######...####..##',
      '#####^^######^^^####^^##',
    ],
    spikeCauseFn: (W) => (W.player.y < 100 ? 'UFOに吸い上げられた。' : '宇宙の穴に落ちた。'),
    setup(W) {
      // セーブ地点から出たら、酸素とレーザーが始まる
      G.oxygen(W, 240);
      W.vars.o2 = null;
      o2tank(W, 170, 230);
      o2tank(W, 330, 230);
      W.add(new G.Ufo(W, 250, 60, [226, 274]));
      W.run(function* () {
        yield () => W.player.cx > 70;
        W.vars.o2 = 1;
        yield 30;
        for (;;) {
          W.laser(0, 228, 480, 10, { warn: 24, dur: 14, cause: '床をなめるレーザー。跳べばよかった。', color: '#5ad8ff' });
          G.sfx('charge');
          yield 70;
        }
      });
    },
    drawUI: o2UI,
  });
  exRoom(6, 2, {
    name: '極6-2 土星の環',
    hint: '環は乗ると少しで落ちる。酸素がなくなる前に、環から環へ。最後の環から三角の足場へ。',
    theme: 'galaxy',
    bg: 'nebula',
    exits: { left: 'EX6-1' },
    goal: 'flag',
    goalPos: [450, 140],
    map: [
      '########################',
      '#......................#',
      '#......................#',
      '#......................#',
      '#......................#',
      '#......................#',
      '#....................###',
      '#......................#',
      '#......................#',
      '.......................#',
      '.......................#',
      '..S....................#',
      '###^^^^^^^^^^^^^^^^^^^^#',
      '########################',
    ],
    spikeCauseFn: () => '土星の環から落ちた。',
    setup(W) {
      G.oxygen(W, 420);
      W.vars.o2 = null;
      W.trigPx(70, 0, 20, 280, () => (W.vars.o2 = 1));
      const ring = (ty, x0, x1, ph, dur) => {
        const b = W.block(Math.round(x0 / T), ty, 3, 1, { oneway: true, code: 3, keep: true, style: 'ring' });
        b.x = x0;
        W.run(function* () {
          yield ph;
          for (;;) {
            if (!b.alive || b.falling) return;
            b.tweenTo(x1, b.y, dur, 'inOutQuad');
            yield dur + 2;
            if (!b.alive || b.falling) return;
            b.tweenTo(x0, b.y, dur, 'inOutQuad');
            yield dur + 2;
          }
        });
        b.onStep = () => {
          if (b.falling) return;
          W.after(50, () => {
            b.falling = true;
            b.stop();
            b.drop(0.4);
          });
        };
      };
      ring(10, 70, 150, 0, 50);
      ring(8, 210, 150, 0, 50);
      ring(6, 230, 330, 25, 60);
      goal(W, 6, 450, 106, { tx: 21, ty: 4, to: '11-1', spawn: [4, 11] });
    },
    drawUI: o2UI,
  });
})();
