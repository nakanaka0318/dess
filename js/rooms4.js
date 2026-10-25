// 5面（エリア10）天まで届け：上へ上へと積み重なった塔。踏み外すと下の画面へ落ちていき、
// 着地した場所に自動でセーブされる（一番下まで落ちれば、実質はじめから）
(function () {
  'use strict';
  const G = globalThis.G;
  const T = G.T;
  const R = G.ROOMS;

  // 塔のマップを足場の一覧から作る（左右は壁、上下は穴でつながっている）
  //  plats: [列, 幅, 行, 文字]  文字は # 足場（下からは頭を打つ）/ - すり抜け足場（下の画面から跳び上がってくる入口）/ F 偽物 / B 崩れる
  function towerMap(o) {
    const rows = [];
    for (let r = 0; r < 14; r++) rows.push(['#'].concat(new Array(22).fill('.'), ['#']));
    const floorRows = o.floor === 'low' ? [13] : [12, 13];
    if (o.floor) for (const r of floorRows) for (let c = 1; c <= 22; c++) rows[r][c] = '#';
    if (o.floorHole) for (const r of floorRows) for (let c = o.floorHole[0]; c <= o.floorHole[1]; c++) rows[r][c] = '.';
    if (o.ceilHole) for (let c = 1; c <= 22; c++) rows[0][c] = c >= o.ceilHole[0] && c <= o.ceilHole[1] ? '.' : '#';
    for (const [c, w, r, ch] of o.plats || []) for (let i = 0; i < w; i++) rows[r][c + i] = ch || '#';
    for (const [c, r, ch] of o.marks || []) rows[r][c] = ch;
    return rows.map((a) => a.join(''));
  }

  const FALL_LINES = [
    '落ちることも、登山のうち。',
    'おかえり。',
    '重力は、いつでもきみの味方だ。……いや、敵か。',
    'また同じ景色だね。',
    'あきらめなければ、いつか届く。たぶん。',
    '壺に入っていなくてよかったね。',
    'さっきの場所、けっこう高かったのに。',
    '人生も、塔も、落ちてからが本番だ。',
  ];

  // 塔の部屋の共通処理：着地するたびに自動セーブ、高さの表示、落ちてきた時のひとこと
  function tower(W, k, opts) {
    W.vars.tower = k;
    let wasGround = false;
    const game = W.game;
    const prev = W.onStep;
    W.onStep = () => {
      if (prev) prev();
      const P = W.player;
      if (!P.alive) return;
      const h = Math.max(0, Math.round(((k - 1) * 280 + (280 - (P.y + P.h))) / 10));
      W.vars.height = h;
      if (game && game.flags) game.flags.towerMax = Math.max(game.flags.towerMax || 0, h);
      if (P.onGround && !wasGround) {
        // 動かない地形の上に着地した時だけ、その場所をセーブ
        const tx = Math.floor(P.cx / T),
          ty = Math.floor((P.y + P.h - 1) / T);
        const below = W.tile(tx, ty + 1);
        if ((below === 1 || below === 2 || below === 3) && game && game.save) {
          const sd = game.saveData;
          if (!sd || sd.room !== W.id || sd.tx !== tx || sd.ty !== ty) game.save(W.id, tx, ty);
        }
      }
      wasGround = P.onGround;
    };
    // 上の画面から落ちてきた
    if (opts && opts.enter && opts.enter.dir === 'down' && game && game.flags) {
      const max = game.flags.towerMax || 0;
      if (max > k * 28 + 12) {
        const i = (game.flags.fallLine = ((game.flags.fallLine || 0) + 1) % FALL_LINES.length);
        W.say(FALL_LINES[i], 240, 60, 150, { plain: true, size: 12, color: '#ffe9a8' });
      }
    }
  }

  const bgOf = (k) => (k <= 3 ? 'day' : k <= 6 ? 'dusk' : 'night');
  const room = (k, o) => {
    R['10-' + k] = Object.assign(
      {
        area: 10,
        theme: 'sky',
        bg: bgOf(k),
        exits: k === 1 ? { up: '10-2' } : { up: k === 8 ? '10-T' : '10-' + (k + 1), down: '10-' + (k - 1) },
        goal: 'up',
        drawFg(ctx, W) {
          G.Render.drawHeight(ctx, W);
          if (o.fg) o.fg(ctx, W);
        },
      },
      o
    );
  };

  room(1, {
    hint: '着地した場所に自動でセーブされる。落ちたらそこからやり直し。',
    name: '10-1 塔のふもと',
    map: towerMap({ floor: true, plats: [[5, 2, 10], [9, 2, 8], [13, 2, 6], [17, 2, 4], [20, 2, 2]], marks: [[3, 11, '@'], [20, 1, 'T']] }),
    setup(W, opts) {
      tower(W, 1, opts);
      W.sign(5, 11, 'ここから天まで、まっすぐ上へ。\n落ちたら、落ちた場所からやり直し。', { range: 40 });
      W.door(1, 10, { to: '9-X', spawn: [18, 11], label: '←' });
      W.decor(200, 216, 'pot');
    },
  });

  room(2, {
    hint: '1マスの足場は乗ると崩れる。止まらずに次へ。',
    name: '10-2 崩れる足場',
    map: towerMap({ plats: [[19, 3, 11, '-'], [15, 1, 9, 'B'], [11, 2, 7], [7, 1, 5], [3, 2, 3], [6, 2, 1]], marks: [[20, 10, 'E'], [6, 0, 'T']] }),
    setup(W, opts) {
      tower(W, 2, opts);
      const b = W.tileToBlock(15, 9, { keep: true });
      b.onStep = () => b.crumble(18);
    },
  });

  room(3, {
    hint: '空中では風に流される。風がやんでから跳ぼう。',
    name: '10-3 風の階',
    map: towerMap({ plats: [[5, 3, 11, '-'], [9, 2, 9], [13, 1, 7], [17, 2, 6], [20, 2, 4], [16, 1, 2], [12, 2, 1]], marks: [[6, 10, 'E'], [12, 0, 'T']] }),
    setup(W, opts) {
      tower(W, 3, opts);
      W.windAir = true;
      W.run(function* () {
        yield 40;
        for (;;) {
          W.vars.windWarn = 1;
          yield 40;
          W.vars.windWarn = 0;
          W.windX = -1.1;
          yield 70;
          W.windX = 0;
          yield 110;
        }
      });
    },
    fg(ctx, W) {
      G.Render.drawTowerWind(ctx, W);
    },
  });

  room(4, {
    hint: '動く足場が近くに来た時に乗り移ろう。',
    name: '10-4 動く足場',
    map: towerMap({ plats: [[11, 3, 11, '-'], [2, 2, 5], [6, 1, 3], [10, 2, 1]], marks: [[12, 10, 'E'], [10, 0, 'T']] }),
    setup(W, opts) {
      tower(W, 4, opts);
      const m = W.block(3, 8, 3, 1, { oneway: true, code: 3, keep: true });
      W.run(function* () {
        for (;;) {
          m.tweenTo(200, m.y, 110, 'inOutQuad');
          yield 130;
          m.tweenTo(60, m.y, 110, 'inOutQuad');
          yield 130;
        }
      });
    },
  });

  room(5, {
    hint: 'ジャンプ台で上のすり抜け足場まで飛ぼう。',
    name: '10-5 ジャンプ台',
    map: towerMap({ plats: [[9, 3, 11, '-'], [12, 2, 11], [12, 3, 3, '-'], [16, 1, 1]], marks: [[10, 10, 'E'], [16, 0, 'T']] }),
    setup(W, opts) {
      tower(W, 5, opts);
      W.spring(13, 10, { power: 7.4 });
      W.sign(9, 10, 'このジャンプ台は\n本当に安全です', { range: 30 });
    },
  });

  room(6, {
    hint: '空気が薄くて体がふわふわする。1マスの足場には横から乗ろう。',
    name: '10-6 空気が薄い',
    map: towerMap({ plats: [[15, 3, 11, '-'], [12, 1, 8], [8, 1, 5], [12, 1, 2]], marks: [[16, 10, 'E'], [12, 1, 'T']] }),
    setup(W, opts) {
      tower(W, 6, opts);
      W.gravScale = 0.65;
      W.say('空気が薄い……', 240, 40, 80, { plain: true, size: 10, color: '#c8d4f0' });
    },
  });

  room(7, {
    hint: '「近道」は罠（塔のふもとへ戻される）。右の足場を登ろう。',
    name: '10-7 近道あります',
    map: towerMap({ plats: [[11, 3, 11, '-'], [7, 2, 9, 'F'], [2, 3, 9], [16, 2, 9], [20, 2, 7], [16, 1, 5], [12, 2, 3], [16, 2, 1]], marks: [[12, 10, 'E'], [16, 0, 'T']] }),
    setup(W, opts) {
      tower(W, 7, opts);
      W.door(3, 7, { to: '10-1', spawn: [3, 11], label: '近道' });
      W.sign(10, 10, '← 近道\n（頂上まで一瞬）', { range: 30 });
    },
  });

  room(8, {
    hint: 'あと少し。1マスの足場は2段ジャンプで横から。',
    name: '10-8 あと少し',
    map: towerMap({ ceilHole: [11, 13], plats: [[15, 3, 11, '-'], [11, 1, 8], [7, 1, 5], [11, 1, 2]], marks: [[16, 10, 'E'], [11, 1, 'T']] }),
    setup(W, opts) {
      tower(W, 8, opts);
    },
  });

  // 頂上
  R['10-T'] = {
    hint: '頂上の木に近づこう。',
    area: 10,
    name: '10-T てっぺん',
    theme: 'sky',
    bg: 'space',
    music: 'ending',
    exits: { down: '10-8' },
    goal: 'flag',
    map: towerMap({ floor: 'low', floorHole: [11, 13] }),
    drawFg(ctx, W) {
      G.Render.drawHeight(ctx, W);
    },
    setup(W, opts) {
      tower(W, 9, opts);
      W.decor(360, 120, 'appletree', { h: 140 });
      W.add(new G.Moon(W, 90, 120, { r: 16, hazard: false, keep: true, face: 'calm' }));
      const sun = W.add(new G.Moon(W, 150, 70, { r: 14, hazard: false, keep: true, face: 'calm' }));
      sun.sunny = true;
      W.text(240, 40, 'てっぺん', { size: 16, color: '#ffe9a8' });
      // 5面クリア後：てっぺんの先、宇宙への扉が開く（6面へ）
      W.openNext = (fx) => {
        W.inputLock = 0;
        W.door(3, 11, { to: '11-1', spawn: [2, 11], label: '宇' });
        W.sign(5, 12, '宇宙への扉\n（STAGE 6）', { range: 30 });
        if (fx) W.after(30, () => W.say('……あれ？ あんな所に扉が。\nぼくも一緒に行くよ。', 90, 96, 150, {}));
      };
      if (W.game && W.game.flags.stage5Clear) {
        W.openNext(false);
        return;
      }
      W.trigPx(330, 0, 100, 280, () => {
        W.run(function* () {
          const P = W.player;
          W.inputLock = 600;
          W.say('よくぞ登ってきたね。', 90, 96, 90, {});
          yield 90;
          W.say('ここが世界でいちばん高い場所。\nリンゴの木の、ふるさとだよ。', 150, 48, 110, {});
          yield 110;
          // 最後のリンゴ
          const a = W.fruit(P.cx, -10, { kind: 'gold', r: 6, keep: true });
          a.hazard = false;
          a.vel(0, 2, 0, 0.15);
          yield () => a.cy >= P.y - 4;
          a.vel(-1.4, -3, 0, 0.2);
          G.sfx('bonk');
          W.say('コツン', P.cx, P.y - 6, 60, { plain: true, size: 10, color: '#ffffff' });
          yield 60;
          W.say('……今度は、死ななかった。', P.cx, P.y - 10, 90, {});
          G.sfx('fanfare');
          yield 120;
          W.vars.goal = true;
          if (W.game && W.game.stageClear) W.game.stageClear();
        });
      }, { cond: (P) => P.onGround });
    },
  };
})();
