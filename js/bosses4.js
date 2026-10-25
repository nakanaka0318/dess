// 6面のボス：THE TRUE MOON（連続プレイヤー殺人事件の真犯人）と、ほんとうの結末
(function () {
  'use strict';
  const G = globalThis.G;
  const FLOOR = 240;
  const talk = (W, who, text, d) => W.say(text, 0, 0, d || 100, { follow: who, dy: -4 });

  class TrueMoon extends G.MoonBoss {
    constructor(W, cx, cy) {
      super(W, cx, cy, 280);
      this.name = 'THE TRUE MOON';
      this.cause = '真犯人に触れてしまった。';
      this.visible = false;
    }
  }
  G.TrueMoon = TrueMoon;

  G.BOSSES.trueMoon = function (W, opts, quick, npc) {
    const P = W.player;
    const rng = W.rng;
    const HOMEY = 100;
    const m = W.add(new TrueMoon(W, npc ? npc.cx : 240, npc ? npc.cy : -60));
    const phase2 = () => m.hp < m.maxHp / 2;
    const deaths = (W.game && W.game.deaths) || 0;
    const shot = (x, y, kind, r, cause) => {
      const f = W.fruit(x, y, { kind, r, cause });
      f.bossShot = true;
      return f;
    };
    function* goTo(cx, cy, d, ease) {
      m.tweenTo(cx - m.r, cy - m.r, d, ease || 'inOutQuad');
      yield d;
    }
    function* drift() {
      yield* goTo(G.clamp(P.cx + rng.range(-110, 110), 90, 390), HOMEY + rng.range(-6, 4), phase2() ? 34 : 44);
    }
    // ウソの予告：予告した場所「以外」を焼く（予告された場所だけが安全）
    let lies = 0;
    function* lieLaser() {
      const safeX = G.clamp(P.cx + rng.range(-80, 80), 40, 440);
      const L = safeX - 30,
        Rr = safeX + 30;
      W.vars.fakeWarn = { x: L, w: 60 };
      if (lies++ === 0) talk(W, m, 'ここを撃つよ。予告どおりにね！', 60);
      G.sfx('charge');
      yield phase2() ? 44 : 54;
      W.vars.fakeWarn = null;
      const cause = '月の予告は、ウソだった。';
      for (let x = 0; x < L; x += 40) W.laser(x, 0, Math.min(40, L - x), FLOOR, { warn: 6, dur: 22, cause, color: '#ffe9a8' });
      for (let x = Rr; x < G.W; x += 40) W.laser(x, 0, Math.min(40, G.W - x), FLOOR, { warn: 6, dur: 22, cause, color: '#ffe9a8' });
      yield 36;
    }
    // 満ち欠け：三日月の弾がらせんに
    function* phases() {
      yield* goTo(240, HOMEY, 30);
      const n = phase2() ? 36 : 26;
      const sp = phase2() ? 1.8 : 1.5;
      for (let w = 0; w < n; w++) {
        const a = w * 0.43;
        for (let k = 0; k < 2; k++) {
          const aa = a + k * Math.PI;
          const f = shot(m.cx, m.cy, 'crescent', 5, '月の満ち欠けに巻きこまれた。');
          f.vel(Math.cos(aa) * sp, Math.sin(aa) * sp);
        }
        yield 5;
      }
      yield 30;
    }
    // リンゴの雨（すべては、ここから始まった）
    function* apples() {
      const n = phase2() ? 9 : 7;
      const xs = [];
      for (let i = 0; i < n; i++) xs.push(20 + ((i + rng.range(0, 0.8)) / n) * 440);
      const marks = xs.map((x) => W.text(x, 30, '▼', { size: 9, color: '#ff6a8a' }));
      G.sfx('warn');
      yield 36;
      marks.forEach((t) => (t.alive = false));
      for (let i = 0; i < n; i++) {
        const f = shot(xs[i], -10, 'cherry', 6, '最初の死因と、同じだった。');
        f.vel(0, 1.5, 0, 0.12);
        f.maxV = 4.5;
        if (i % 2) yield 5;
      }
      yield 60;
    }
    // 月落とし（1面の、あの月）
    let slams = 0;
    function* slam() {
      const x = G.clamp(P.cx, 60, 420);
      yield* goTo(x, HOMEY - 20, 26);
      if (slams++ === 0) talk(W, m, '落ちてあげる。', 40);
      W.vars.shadowX = x;
      G.sfx('warn');
      yield phase2() ? 18 : 26;
      m.tweenTo(x - m.r, FLOOR - m.r * 2, 16, 'inQuad');
      yield 16;
      W.vars.shadowX = null;
      W.shake = 20;
      G.sfx('stomp');
      for (const d of [-1, 1]) {
        const f = shot(x + d * (m.r + 4), 233, 'star', 6, '月落としの衝撃波。');
        f.vel(d * 2.3, 0);
      }
      yield 30;
      yield* goTo(x, HOMEY, 36);
    }
    // ミニセーブポイントの雨（4面の黒幕も、ぼくが作った）
    function* saves() {
      talk(W, m, 'セーブポイントも、ぼくが作ったんだ。', 70);
      const xs = [];
      for (let i = 0; i < 7; i++) xs.push(rng.range(30, 450));
      const marks = xs.map((x) => W.text(x, 30, '▼', { size: 9, color: '#9affc0' }));
      G.sfx('warn');
      yield 40;
      marks.forEach((t) => (t.alive = false));
      for (let i = 0; i < xs.length; i++) {
        const f = shot(xs[i], -10, 'minisave', 7, 'ミニセーブポイントに押しつぶされた。');
        f.vel(0, 2, 0, 0.08);
        f.maxV = 4;
        if (i % 2) yield 6;
      }
      yield 50;
    }
    // にせの GAME OVER（その間も弾は止まらない）
    function* fakeOver() {
      if (G.fake6) G.fake6(W, 'gameover', 120, { cause: '真犯人に負けた。', reveal: 92 });
      G.sfx('death');
      yield 20;
      for (let w = 0; w < 3; w++) {
        const n = 10,
          off = (w % 2) * (Math.PI / n);
        for (let i = 0; i < n; i++) {
          const a = off + (i / n) * Math.PI * 2;
          const f = shot(m.cx, m.cy, 'crescent', 5, 'ゲームオーバーの画面の向こうから撃たれた。');
          f.vel(Math.cos(a) * 1.4, Math.sin(a) * 1.4);
        }
        G.sfx('explode');
        yield 36;
      }
    }

    W.run(function* () {
      yield () => P.alive && P.onGround;
      G.music(null);
      if (!quick && npc) {
        npc.face = 'shock';
        talk(W, npc, '……どうして、わかったの？', 90);
        yield 90;
        npc.face = 'calm';
        talk(W, npc, 'ウソをついていたのは、ぼくだけ……か。', 90);
        yield 90;
        npc.face = 'grin';
        talk(W, npc, 'そうさ。リンゴを落としたのも、\nセーブポイントを作ったのも、ぜんぶぼく。', 130);
        yield 130;
        talk(W, npc, `きみが ${deaths} 回死ぬところ、\nぜんぶ見てたよ。楽しかったなあ。`, 120);
        yield 120;
        talk(W, npc, 'I WANNA KILL THE MOON……\nタイトルどおりだね。やれるものならね！', 130);
        yield 120;
        W.flash = 20;
        W.flashColor = '#fff6c0';
        G.sfx('bigexplode');
        m.x = npc.cx - m.r;
        m.y = npc.cy - m.r;
        npc.alive = false;
      } else {
        m.x = 240 - m.r;
        m.y = -100;
      }
      m.visible = true;
      m.face = 'grin';
      yield* goTo(240, HOMEY, 50, 'outBack');
      if (quick) {
        talk(W, m, `おかえり。${deaths} 回目だね。\n何度でも死なせてあげる。`, 80);
        yield 60;
      }
      G.sfx('roar');
      W.shake = 30;
      G.music('truemoon');
      m.showBar = true;
      m.hazard = true;
      m.vulnerable = true;
      W.autoFire = true;
      if (W.easy) W.lives = 3;
      yield* lieLaser();
      let last = 'lie';
      for (;;) {
        const pool = phase2() ? ['lie', 'phases', 'apples', 'slam', 'saves', 'over'] : ['lie', 'phases', 'apples', 'slam'];
        let p;
        do p = rng.pick(pool);
        while (p === last);
        last = p;
        if (phase2() && !m.angry) {
          m.angry = true;
          m.face = 'rage';
          talk(W, m, 'もう、手加減しないよ。', 60);
          G.sfx('roar');
          yield 40;
        }
        if (p === 'lie') yield* lieLaser();
        else if (p === 'phases') yield* phases();
        else if (p === 'apples') yield* apples();
        else if (p === 'slam') yield* slam();
        else if (p === 'saves') yield* saves();
        else yield* fakeOver();
        if (p !== 'slam') yield* drift();
        yield phase2() ? 12 : 20;
      }
    }, m.ai);

    m.onDefeat = () => {
      G.music(null);
      W.autoFire = false;
      W.god = true;
      W.lives = null;
      W.invuln = 0;
      W.vars.fakeWarn = null;
      W.vars.shadowX = null;
      W.vars.ov = null;
      G.BOSSES.clearShots(W, m);
      G.BOSSES.markDead(W, 'trueMoonDead', 2, 11);
      W.run(function* () {
        m.face = 'hurt';
        m.tweenTo(240 - m.r, 110 - m.r, 30, 'outQuad');
        yield 30;
        talk(W, m, 'うそ……ぼくが、負けるなんて……', 90);
        for (let i = 0; i < 90; i++) {
          m.shakeX = i % 2 ? 2 : -2;
          if (i % 12 === 0) {
            W.burst(m.cx + rng.range(-30, 30), m.cy + rng.range(-30, 30), 14, ['#fff6c0', '#ffffff', '#c8c8d8'], 2.5, { g: 0.05 });
            G.sfx('explode');
          }
          yield 1;
        }
        talk(W, m, 'ねえ……ぼくがいなくなったら、\n夜は真っ暗だよ……？', 110);
        yield 110;
        W.burst(m.cx, m.cy, 160, ['#fff6c0', '#ffffff', '#c8c8d8', '#ffd84a'], 5, { g: 0.06, life: 70 });
        G.sfx('bigexplode');
        W.flash = 24;
        W.flashColor = '#ffffff';
        W.shake = 30;
        m.alive = false;
        m.visible = false;
        m.showBar = false;
        yield 70;
        G.music('ending');
        const sun = W.add(new G.Npc(W, 520, 90, 'sun', { r: 14 }));
        sun.tweenTo(380 - sun.r, 90 - sun.r, 60, 'outQuad');
        yield 60;
        talk(W, sun, '心配するな。夜はわたしが照らそう。\n……いや、夜は休みだった。', 130);
        yield 130;
        const sat = W.add(new G.Npc(W, -40, 110, 'saturn', { r: 16 }));
        sat.tweenTo(100 - sat.r, 110 - sat.r, 60, 'outQuad');
        yield 60;
        talk(W, sat, 'じゃあ、あれを月のかわりにしよう。', 100);
        yield 60;
        // 夜空に、リンゴがのぼる
        const a = W.fruit(240, 250, { kind: 'gold', r: 10, keep: true });
        a.hazard = false;
        a.tweenTo(240 - a.r, 60 - a.r, 120, 'outQuad');
        G.sfx('fanfare');
        yield 130;
        W.text(240, 120, 'I KILLED THE MOON', { size: 20, color: '#ffe9a8' });
        yield 160;
        W.god = !!G.god;
        if (W.game) {
          W.game.endingNote = '最後の死因：なし。ついに月を殺した。（夜空には、リンゴがのぼった）';
          if (W.game.stageClear) W.game.stageClear();
        }
      });
    };
    return m;
  };
})();
