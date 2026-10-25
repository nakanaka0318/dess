// 4面のボス：THE SAVE POINT（すべての黒幕）と、まさかの結末
(function () {
  'use strict';
  const G = globalThis.G;
  const SW = G.W;
  const FLOOR = 240;

  class SaveBoss extends G.Boss {
    constructor(W, cx, cy) {
      super(W, cx - 30, cy - 30, 60, 60, { hp: 150, name: 'THE SAVE POINT' });
      this.face = 'grin';
      this.cause = 'セーブポイントにぶつかった。セーブはされなかった。';
      this.glitch = 0;
    }
    hits(rect) {
      return this.hazard && G.overlap(rect, { x: this.x + 6, y: this.y + 6, w: this.w - 12, h: this.h - 12 });
    }
    // 足場の上から撃った弾が届くよう、下に少し広い
    shotBox() {
      return { x: this.x - 4, y: this.y - 4, w: this.w + 8, h: this.h + 32 };
    }
    tick() {
      super.tick();
      if (this.glitch > 0) this.glitch--;
    }
    draw(ctx) {
      G.Render.drawSaveBoss(ctx, this);
    }
  }
  G.SaveBoss = SaveBoss;

  G.BOSSES.savepoint = function (W, opts) {
    const P = W.player;
    const rng = W.rng;
    const HOMEY = 112;
    const b = W.add(new SaveBoss(W, 240, -60));
    const phase2 = () => b.hp < b.maxHp / 2;
    const deaths = (W.game && W.game.deaths) || 0;
    const shot = (x, y, kind, r, cause) => {
      const f = W.fruit(x, y, { kind, r, cause });
      f.bossShot = true;
      return f;
    };
    function* goTo(cx, cy, d, ease) {
      b.tweenTo(cx - 30, cy - 30, d, ease || 'inOutQuad');
      yield d;
    }
    // ミニセーブポイントの雨（▼の場所に落ちる）
    function* shower() {
      const n = phase2() ? 8 : 6;
      const xs = [];
      for (let i = 0; i < n; i++) xs.push(rng.range(30, 450));
      const marks = xs.map((x) => W.text(x, 30, '▼', { size: 9, color: '#9affc0' }));
      G.sfx('warn');
      yield 40;
      marks.forEach((m) => (m.alive = false));
      for (let i = 0; i < n; i++) {
        const f = shot(xs[i], -10, 'minisave', 7, 'ミニセーブポイントに押しつぶされた。');
        f.vel(0, 2, 0, 0.08);
        f.maxV = 4;
        if (i % 2) yield 6;
      }
      yield 50;
    }
    // 上書き保存：プレイヤーのいる高さを横一直線に
    function* overwrite() {
      const onPlat = P.y < 190;
      const y = onPlat ? 146 : 222;
      W.say('上書き保存します', 0, 0, 40, { follow: b, dy: -4 });
      W.laser(0, y - 2, 480, 16, { warn: 46, dur: 22, cause: '上書き保存された。', color: '#9affc0' });
      G.sfx('charge');
      yield 74;
      if (phase2()) {
        W.laser(0, onPlat ? 220 : 144, 480, 16, { warn: 40, dur: 22, cause: '上書き保存された。', color: '#9affc0' });
        G.sfx('charge');
        yield 66;
      }
    }
    // オートセーブ：S の輪（輪ごとに隙間がずれる）
    function* autosave() {
      yield* goTo(240, HOMEY, 30);
      for (let w = 0; w < (phase2() ? 3 : 2); w++) {
        G.sfx('charge');
        yield 22;
        const n = 12,
          off = (w % 2) * (Math.PI / n);
        for (let i = 0; i < n; i++) {
          const a = off + (i / n) * Math.PI * 2;
          const f = shot(b.cx, b.cy, 'sbullet', 5, 'オートセーブに巻きこまれた。');
          f.vel(Math.cos(a) * 1.5, Math.sin(a) * 1.5);
        }
        G.sfx('explode');
        yield 40;
      }
    }
    // ロード：消えて別の場所に現れる。残った影が弾ける（後半）
    function* load() {
      const ox = b.cx,
        oy = b.cy;
      b.visible = false;
      b.hazard = false;
      W.say('ロード中……', ox, oy - 34, 40, { plain: true, size: 10, color: '#9affc0' });
      G.sfx('reveal');
      yield 30;
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        const f = shot(ox, oy, 'sbullet', 5, 'ロードに失敗した。');
        f.vel(Math.cos(a) * 1.6, Math.sin(a) * 1.6);
      }
      G.sfx('explode');
      const nx = P.cx < 240 ? rng.range(300, 400) : rng.range(80, 180);
      b.x = nx - 30;
      b.y = HOMEY - 30;
      b.visible = true;
      b.hazard = true;
      yield 40;
    }
    // データ破損：画面がちらつき、ERR が飛んでくる（後半）
    function* corrupt() {
      W.say('データが破損しています', 0, 0, 50, { follow: b, dy: -4 });
      for (let v = 0; v < 3; v++) {
        b.glitch = 20;
        W.flash = 4;
        W.flashColor = '#9affc0';
        G.sfx('scratch');
        yield 20;
        const a0 = Math.atan2(P.cy - b.cy, P.cx - b.cx);
        for (const da of [-0.25, 0, 0.25]) {
          const f = shot(b.cx, b.cy, 'err', 6, 'ERROR：あなたは死にました。');
          f.vel(Math.cos(a0 + da) * 2, Math.sin(a0 + da) * 2);
        }
        yield 30;
      }
    }
    function* drift() {
      yield* goTo(G.clamp(P.cx + rng.range(-110, 110), 90, 390), HOMEY + rng.range(-6, 4), 46);
    }

    W.run(function* () {
      const quick = opts.respawn && W.game && W.game.flags.saveBossSeen;
      yield () => P.alive && P.onGround;
      G.music(null);
      // 小さな月が待っている
      const moon = W.add(new G.Moon(W, 240, 90, { r: 14, hazard: false, keep: true, face: 'calm' }));
      if (!quick) {
        yield 30;
        W.say('やあ。ぼくは月。', moon.cx, moon.y - 6, 80, {});
        yield 80;
        W.say('リンゴを落としていたのは、ぼくじゃない。', moon.cx, moon.y - 6, 90, {});
        yield 90;
        W.say(`きみが ${deaths} 回死ぬたびに\n同じ場所へ戻していた"あいつ"がいる。`, moon.cx, moon.y - 6, 110, {});
        yield 110;
        moon.face = 'shock';
        W.say('……来た！', moon.cx, moon.y - 6, 50, {});
        yield 40;
      }
      moon.tweenTo(30, 30, 30, 'outQuad');
      yield* goTo(240, HOMEY, 50, 'outBounce');
      W.shake = 20;
      G.sfx('stomp');
      if (!quick) {
        W.say('そう、私だ。セーブポイントだ！', 0, 0, 90, { follow: b, dy: -4 });
        yield 90;
        W.say('何度でもやり直させ、何度でも死なせる。\nそれが私の楽しみだったのだ！', 0, 0, 110, { follow: b, dy: -4 });
        yield 100;
      } else {
        W.say(`おかえり。${deaths} 回目のやり直しだ。`, 0, 0, 60, { follow: b, dy: -4 });
        yield 50;
      }
      if (W.game) W.game.flags.saveBossSeen = true;
      G.sfx('roar');
      W.shake = 30;
      G.music('last');
      b.showBar = true;
      b.hazard = true;
      b.vulnerable = true;
      W.autoFire = true;
      if (W.easy) W.lives = 3;
      let last = '';
      for (;;) {
        const pool = phase2() ? ['shower', 'overwrite', 'autosave', 'load', 'corrupt'] : ['shower', 'overwrite', 'autosave'];
        let p;
        do p = rng.pick(pool);
        while (p === last);
        last = p;
        if (p === 'shower') yield* shower();
        else if (p === 'overwrite') yield* overwrite();
        else if (p === 'autosave') yield* autosave();
        else if (p === 'load') yield* load();
        else yield* corrupt();
        if (p !== 'load') yield* drift();
        yield phase2() ? 14 : 22;
      }
    }, b.ai);

    b.onDefeat = () => {
      G.music(null);
      W.autoFire = false;
      W.god = true;
      W.lives = null;
      W.invuln = 0;
      G.BOSSES.clearShots(W, b);
      G.BOSSES.markDead(W, 'saveBossDead', 2, 11);
      W.run(function* () {
        b.visible = true;
        b.face = 'hurt';
        b.tweenTo(240 - 30, 100 - 30, 30, 'outQuad');
        yield 30;
        W.say('セーブデータを……\n道連れにしてやる……！', 0, 0, 90, { follow: b, dy: -4 });
        for (let i = 0; i < 90; i++) {
          b.shakeX = i % 2 ? 2 : -2;
          b.glitch = 4;
          yield 1;
        }
        W.burst(b.cx, b.cy, 120, ['#9affc0', '#ffffff', '#3a8a5a'], 5, { g: 0.08, life: 60 });
        G.sfx('bigexplode');
        W.flash = 20;
        W.shake = 30;
        b.alive = false;
        b.visible = false;
        b.showBar = false;
        yield 40;
        // 偽のセーブデータ消去画面
        W.vars.fakeDeleteText = 'セーブデータを消去しています……';
        for (let i = 0; i <= 100; i++) {
          W.vars.fakeDelete = i;
          if (i % 10 === 0) G.sfx('select');
          yield i > 90 ? 6 : 2;
        }
        W.vars.fakeDeleteText = 'セーブデータを消去しました。';
        G.sfx('scratch');
        yield 90;
        W.vars.fakeDeleteText = '……というのはウソ。';
        yield 90;
        W.vars.fakeDelete = null;
        W.god = !!G.god;
        yield 20;
        yield* G.BOSSES.truthEnding(W);
      });
    };
    return b;
  };

  // まさかの結末：月と仲直り……したと思ったら
  G.BOSSES.truthEnding = function* (W) {
    const P = W.player;
    G.music('ending');
    let moon = W.ents.find((e) => e instanceof G.Moon && e.alive);
    if (!moon) moon = W.add(new G.Moon(W, 240, -30, { r: 14, hazard: false, keep: true, face: 'calm' }));
    moon.hazard = false;
    moon.tweenTo(240 - moon.r, 80 - moon.r, 50, 'outQuad');
    yield 60;
    moon.face = 'calm';
    W.say('ありがとう。', moon.cx, moon.y - 6, 70, {});
    yield 70;
    W.say('これからは仲良くしよう。\nもう二度と、落ちたりしないよ。', moon.cx, moon.y - 6, 120, {});
    yield 120;
    moon.face = 'shock';
    W.say('……あっ。', moon.cx, moon.y - 6, 40, {});
    yield 30;
    // うっかり落ちてくる（どこへ逃げても追いかけてくる）
    for (let i = 0; i < 26; i++) {
      moon.x += (P.cx - moon.cx) * 0.25;
      moon.y += 4 + i * 0.6;
      yield 1;
      if (moon.cy >= P.y) break;
    }
    W.shake = 30;
    W.flash = 20;
    W.flashColor = '#ffffff';
    G.sfx('thud');
    P.alive = false;
    W.burst(P.cx, P.cy, 30, ['#fffbe0', '#ff3355', '#ffffff'], 3, { g: 0.1 });
    W.say('ゴメン', moon.cx, moon.y - 8, 90, {});
    yield 100;
    if (W.game) {
      if (W.game.stageClear) W.game.stageClear();
    }
  };
})();
