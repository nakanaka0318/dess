// 6面（エリア11・12）宇宙のウソつき：騙しの罠だらけの宇宙と、「連続プレイヤー殺人事件」の推理
//  - 犯人の立てた看板には三日月（☾）の署名がある
//  - 6面で死ぬと、死体が犯人の手がかり（ダイイングメッセージ）を書き残す。死ぬほど核心に近づく
//  - 容疑者4人の証言と「犯人だけがウソをつく」のルールから、最後の部屋で犯人を撃って告発する
(function () {
  'use strict';
  const G = globalThis.G;
  const T = G.T;
  const R = G.ROOMS;
  const Ent = G.Ent;
  const shotHint = () => (G.isTouch ? 'SHOT' : 'X');
  const SIG = '\n　　　　　☾';

  // ---------------------------------------------------------------------
  // 事件の資料
  // ---------------------------------------------------------------------
  const DYING = [
    'は……はんにんは……まるい……',
    'はんにんは……ウソを……つく……（しってる）',
    'はんにんは……よるに……あらわれる……',
    'はんにんは……ちきゅうの……まわりを……まわって……',
    'はんにんは……つ……',
    'おなか……すいた……',
    'つぎは……ジャンプ……しない……',
    'ここまで……よんでくれて……ありがとう……',
    'はんにんは……つ……（さっきも かいた）',
  ];
  const DM_CORE = 5;
  const dyingFor = (i) => DYING[i < DM_CORE ? i : DM_CORE + ((i - DM_CORE) % (DYING.length - DM_CORE))];
  G.DYING = DYING;
  G.dyingFor = dyingFor;
  G.TESTIMONY = [
    { who: 'moon', name: '月', text: '犯人は太陽だよ。' },
    { who: 'sun', name: '太陽', text: '犯人は、宇宙人か月のどちらかだ。' },
    { who: 'saturn', name: '土星', text: '太陽は、本当のことを言っている。' },
    { who: 'alien', name: '宇宙人', text: 'ワレワレハ、ハンニンデハ、ナイ。' },
  ];
  G.CASE_RULE = '犯人だけがウソをつく。犯人でない者は、本当のことしか言わない。';

  // 6面の部屋の共通処理
  function six(W) {
    const game = W.game;
    W.vars.ov = null;
    W.onPlayerDeath = () => {
      if (!game || !game.flags) return;
      const i = game.flags.dm || 0;
      game.dyingMsg = dyingFor(i);
      game.flags.dm = i + 1;
    };
  }
  function room(id, def) {
    const setup = def.setup;
    R[id] = Object.assign({}, def, {
      setup(W, opts) {
        six(W);
        if (setup) setup(W, opts || {});
      },
      drawUI(ctx, W, UI) {
        if (G.Render.drawFake6) G.Render.drawFake6(ctx, W, UI);
        if (def.drawUI) def.drawUI(ctx, W, UI);
      },
    });
  }
  // にせの画面（GAME OVER・PAUSE・STAGE CLEAR・ヒント）
  function fake(W, kind, d, o) {
    const ov = Object.assign({ kind, t: 0, d }, o || {});
    W.vars.ov = ov;
    W.run(function* () {
      while (ov.t < ov.d) {
        ov.t++;
        yield;
      }
      if (W.vars.ov === ov) W.vars.ov = null;
    });
    return ov;
  }
  G.fake6 = fake;
  const talk = (W, who, text, d, o) => W.say(text, 0, 0, d || 100, Object.assign({ follow: who, dy: -4 }, o));
  const ai = (W, text, d) => W.say(text, 240, 30, d || 110, { plain: true, size: 11, color: '#9ae8ff' });

  // ---------------------------------------------------------------------
  // 6面の小物
  // ---------------------------------------------------------------------
  // ついてくる月（いい人そうに見える）
  class Buddy extends Ent {
    constructor(W, cx, cy) {
      super(W, cx - 10, cy - 10, 20, 20);
      this.r = 10;
      this.face = 'calm';
      this.layer = 3;
    }
    tick() {
      if (this.tw || this.pin) return;
      const P = this.W.player;
      const tx = P.cx - P.face * 28 - this.r,
        ty = Math.max(14, P.y - 40) - this.r + Math.sin(this.t * 0.06) * 3;
      this.x += (tx - this.x) * 0.05;
      this.y += (ty - this.y) * 0.05;
    }
    draw(ctx) {
      G.Moon.prototype.draw.call(this, ctx);
    }
  }
  G.Buddy = Buddy;
  const buddy = (W) => W.add(new Buddy(W, W.player.cx - 28, W.player.y - 40));

  // 容疑者（月・太陽・土星・宇宙人）
  class Npc extends Ent {
    constructor(W, cx, cy, kind, o) {
      o = o || {};
      const r = o.r || 14;
      super(W, cx - r, cy - r, r * 2, r * 2);
      this.r = r;
      this.kind = kind;
      this.face = o.face || 'calm';
      this.sunny = kind === 'sun';
      this.layer = 2;
      this.baseY = this.y;
      this.float = o.float !== false;
    }
    tick() {
      if (!this.tw && this.float) this.y = this.baseY + Math.sin(this.t * 0.05 + this.x) * 2;
    }
    hits(rect) {
      return this.hazard && G.rectCircle(rect, this.cx, this.cy, this.r - 2);
    }
    // 床に立って撃っても当たるよう、下に長い
    shotBox() {
      return { x: this.x - 2, y: this.y - 2, w: this.w + 4, h: Math.max(this.h + 4, 244 - this.y) };
    }
    draw(ctx) {
      G.Render.drawNpc(ctx, this);
    }
  }
  G.Npc = Npc;

  // ★1UP（宇宙機雷）。real なら本物の1UP（撃つと爆発する）
  class OneUp extends Ent {
    constructor(W, cx, cy, o) {
      super(W, cx - 7, cy - 7, 14, 14);
      this.real = !!o.real;
      this.hazard = !this.real;
      this.shootable = true;
      this.cause = o.cause;
      this.blastCause = o.blastCause;
      this.layer = 2;
      this.baseY = this.y;
    }
    tick() {
      this.y = this.baseY + Math.sin(this.t * 0.1) * 2;
      const W = this.W,
        P = W.player;
      if (this.real && P.alive && G.overlap(P, this)) {
        this.alive = false;
        G.sfx('fanfare');
        W.say('1UP！（このゲームに残機はない）', this.cx, this.y - 6, 90, { plain: true, size: 9, color: '#9affc0' });
      }
    }
    hits(r) {
      return this.hazard && G.overlap(r, { x: this.x + 2, y: this.y + 2, w: this.w - 4, h: this.h - 4 });
    }
    onShot() {
      const W = this.W;
      this.alive = false;
      if (this.real) {
        W.burst(this.cx, this.cy, 60, ['#ffd84a', '#ff5a10', '#ffffff'], 4, { g: 0.08 });
        W.hbox(this.cx - 70, this.cy - 60, 140, 80, { kind: 'blast', life: 10, cause: this.blastCause });
        W.shake = 14;
        G.sfx('explode');
      } else {
        W.burst(this.cx, this.cy, 16, ['#ffd84a', '#ffffff'], 2, { g: 0.05 });
        W.say('ポン', this.cx, this.y - 4, 40, { plain: true, size: 9, color: '#ffe9a8' });
        G.sfx('pop');
      }
      return true;
    }
    draw(ctx) {
      G.Render.drawOneUp(ctx, this);
    }
  }

  // 寝たふりのUFO：真下を歩くと起きて吸い上げる
  class Ufo extends Ent {
    constructor(W, cx, cy, zone) {
      super(W, cx - 20, cy - 8, 40, 16);
      this.zone = zone;
      this.state = 'sleep';
      this.timer = 0;
      this.layer = 3;
      this.baseX = this.x;
    }
    tick() {
      const W = this.W,
        P = W.player;
      const inZone = P.alive && P.cx > this.zone[0] && P.cx < this.zone[1];
      if (this.state === 'sleep') {
        if (inZone && P.onGround) {
          this.state = 'wake';
          this.timer = 8;
          G.sfx('warn');
        }
      } else if (this.state === 'wake') {
        if (--this.timer <= 0) {
          this.state = 'beam';
          this.timer = 80;
          G.sfx('laser');
        }
      } else if (this.state === 'beam') {
        if (inZone && P.y < 250) {
          P.vy = -3.4;
          P.djump = false;
          P.x += (this.cx - P.cx) * 0.25;
        }
        if (--this.timer <= 0) this.state = 'sleep';
      }
      this.x = this.baseX + Math.sin(this.t * 0.03) * 3;
    }
    draw(ctx) {
      G.Render.drawUfo(ctx, this);
    }
  }
  G.Ufo = Ufo;

  // 背景の惑星（遠いと思ったら近かった）
  class Planet extends Ent {
    constructor(W, cx, cy, r) {
      super(W, cx - r, cy - r, r * 2, r * 2);
      this.r = r;
      this.scale = 0.3;
      this.layer = -1.5;
      this.pcx = cx;
      this.pcy = cy;
      this.cause = '遠くの惑星だと思った。遠近法にだまされた。';
    }
    get cx() {
      return this.pcx;
    }
    get cy() {
      return this.pcy;
    }
    hits(rect) {
      return this.hazard && G.rectCircle(rect, this.pcx, this.pcy, this.r * this.scale - 3);
    }
    draw(ctx) {
      G.Render.drawPlanet(ctx, this);
    }
  }

  // 掃除ロボット：跳び越えようとすると跳ねて吸い込む
  class Vacuum extends Ent {
    constructor(W, x, min, max) {
      super(W, x, 230, 18, 10);
      this.hazard = true;
      this.shootable = true;
      this.hp = 3;
      this.dir = -1;
      this.min = min;
      this.max = max;
      this.vyy = 0;
      this.hurtT = 0;
      this.layer = 2;
      this.cause = '掃除ロボットに、ゴミと判定された。';
    }
    tick() {
      const P = this.W.player;
      if (this.hurtT > 0) this.hurtT--;
      const ground = this.y >= 230;
      if (ground) {
        this.x += this.dir * 0.8;
        if (this.x < this.min) this.dir = 1;
        if (this.x > this.max) this.dir = -1;
        if (P.alive && !P.onGround && P.y + P.h < this.y && Math.abs(P.cx - this.cx) < 22) this.vyy = -5.4;
      }
      if (this.vyy || !ground) {
        this.vyy += 0.25;
        this.y += this.vyy;
        if (this.y >= 230) {
          this.y = 230;
          this.vyy = 0;
        }
      }
    }
    onShot() {
      this.hp--;
      this.hurtT = 6;
      G.sfx('hit');
      if (this.hp <= 0) {
        this.alive = false;
        this.W.burst(this.cx, this.cy, 20, ['#c8d0e0', '#ffd84a', '#ffffff'], 2.5, { g: 0.15 });
        this.W.say('ピー……', this.cx, this.y - 4, 50, { plain: true, size: 9, color: '#c8d0e0' });
        G.sfx('explode');
      }
      return true;
    }
    draw(ctx) {
      G.Render.drawVacuum(ctx, this);
    }
  }

  // きみに化けた宇宙人：鏡写しに動く（ジャンプもまねる）
  class Double extends Ent {
    constructor(W, x, y) {
      super(W, x, y, 8, 14);
      this.hazard = true;
      this.shootable = true;
      this.face = -1;
      this.layer = 2;
      this.mirror = null;
      this.cause = '宇宙人がきみに化けていた。ジャンプもまねされる。';
    }
    tick() {
      const P = this.W.player;
      if (!P.alive) return;
      if (this.mirror == null) {
        if (P.onGround && P.y > 200) this.mirror = (P.cx + this.cx) / 2;
        return;
      }
      const tx = 2 * this.mirror - P.cx - this.w / 2;
      this.x += G.clamp(tx - this.x, -2, 2);
      this.y = P.y;
      this.face = -P.face;
      this.air = !P.onGround;
    }
    onShot() {
      this.alive = false;
      this.W.burst(this.cx, this.cy, 24, ['#7aff9a', '#ffffff'], 2.5, { g: 0.05 });
      this.W.say('バレタカ', this.cx, this.y - 6, 60, { plain: true, size: 10, color: '#7aff9a' });
      G.sfx('explode');
      return true;
    }
    draw(ctx) {
      G.Render.drawDouble(ctx, this);
    }
  }

  // =====================================================================
  // AREA 11 嘘つき銀河
  // =====================================================================
  room('11-1', {
    hint: '★1UPは撃って消す（跳び越えると星が降る）。GAME OVERはにせもの：何も押さずに歩き続ける。「床あり」の床は偽物なので跳び越え、着地したらすぐもう一度跳ぶ。',
    area: 11,
    name: '11-1 宇宙港',
    theme: 'galaxy',
    bg: 'nebula',
    exits: { right: '11-2' },
    map: [
      '########################',
      '#......................#',
      '#......................#',
      '#......................#',
      '#......................#',
      '#......................#',
      '#..........######......#',
      '#..........######......#',
      '#..........vvvvvv......#',
      '#.......................',
      '#.......................',
      '#.@S....................',
      '##################FFF###',
      '##################^^^###',
    ],
    spikeCauseFn(W) {
      if (W.player.y < 200) return W.vars.ov && W.vars.ov.kind === 'gameover' ? 'リトライしようとして、ジャンプした。' : '天井のトゲ。宇宙にも天井はある。';
      return '「床あり。安全。」と書いてあった。';
    },
    setup(W, opts) {
      const game = W.game;
      const m = buddy(W);
      W.door(1, 10, { to: '10-T', spawn: [4, 12], label: '↩' });
      W.sign(4, 11, '宇宙のルール\n犯人だけが、ウソをつく。\n（宇宙ステーション管理AI）', { range: 30 });
      if (!opts.respawn && !(game && game.flags.caseOpened)) {
        if (game) game.flags.caseOpened = true;
        const deaths = (game && game.deaths) || 0;
        W.run(function* () {
          yield 30;
          ai(W, '……ピンポンパンポーン。', 80);
          yield 80;
          ai(W, `ようこそ、宇宙へ。あなたはこれまでに ${deaths} 回、殺されています。`, 130);
          yield 130;
          ai(W, 'これは「連続プレイヤー殺人事件」です。\n犯人は、この宇宙のどこかにいます。', 150);
          yield 150;
          talk(W, m, 'こわいね。だいじょうぶ、\nぼくがついてるよ。', 110);
        });
      }
      // ① ★1UP……ではなく宇宙機雷（撃てば消える）
      W.add(new OneUp(W, 150, 230, { cause: '1UPではなかった。宇宙機雷だった。' }));
      // ①' 跳び越えると、背景の星が降ってくる
      W.trigPx(112, 0, 70, 280, (P) => {
        const st = W.fruit(P.cx + 40, -10, { kind: 'star', r: 7, cause: '星は背景じゃなかった。' });
        st.vel(0, 6.5, 0, 0.2);
        G.sfx('whoosh');
      }, { cond: (P) => !P.onGround && P.vy < 0 });
      // ② にせの GAME OVER：あわててジャンプ（リトライ）すると天井のトゲ
      W.trigPx(242, 0, 16, 280, (P) => {
        fake(W, 'gameover', 140, { cause: '宇宙の寒さで、凍りついた。', reveal: 104 });
        W.hidePlayer = 46;
        W.burst(P.cx, P.cy, 40, ['#ff2040', '#ff6a8a', '#ffd0d8'], 2.5, { g: 0.15 });
        W.shake = 10;
        G.sfx('death');
      }, { cond: (P) => P.onGround });
      W.onStep = () => {
        if (W.hidePlayer > 0) W.hidePlayer--;
        // にせの GAME OVER 中に「リトライ」（ジャンプ・ショット）を押すと……
        const ov = W.vars.ov,
          P = W.player;
        if (ov && ov.kind === 'gameover' && ov.t < ov.reveal && P.alive && (P.vy < -1 || W.bullets.some((b) => !b.hostile))) {
          W.vars.ov = null;
          W.hidePlayer = 0;
          W.kill(P.vy < -1 ? 'リトライしようとして、ジャンプした。' : 'リトライしようとして、撃った。');
        }
      };
      // ③ 「床あり。安全。」の床は偽物。月も太鼓判
      W.sign(17, 11, '出口 →\n床あり。安全。' + SIG, { range: 30 });
      W.trigPx(296, 0, 20, 280, () => talk(W, m, 'この先はふつうの床だよ。\nまっすぐ歩いてね！', 110));
      // ④ 着地したら出口の前でトゲ
      const ex = W.spike(22, 11, 'u', { hidden: true, cause: '宇宙港の出国審査に落ちた。' });
      W.trigPx(420, 0, 40, 280, () => W.after(3, () => ex.pop(3)), { cond: (P) => P.onGround });
    },
  });

  room('11-2', {
    hint: '「！」の後は右から隕石が来るので立ち止まって跳び越える。UFOの下は歩かずに跳び越える。低い足場は偽物（月はウソつき）：高い足場へ2段ジャンプし、すぐ降りる。ワープゾーンは跳び越える。',
    area: 11,
    name: '11-2 流星の道',
    theme: 'galaxy',
    bg: 'nebula',
    exits: { left: '11-1', right: '11-3' },
    map: [
      '########################',
      '#.......vvvvvv.........#',
      '#......................#',
      '#......................#',
      '#......................#',
      '#......................#',
      '#......................#',
      '#......................#',
      '#................--....#',
      '........................',
      '........................',
      '..S............FF.......',
      '##############......##.#',
      '##############^^^^^^##^#',
    ],
    spikeCauseFn(W) {
      const P = W.player;
      if (P.y < 120) return 'UFOは寝たふりをしていた。';
      if (P.cx > 425) return 'ワープ先は、あの世だった。';
      if (P.cx > 292 && P.cx < 348) return '月を信じた。';
      return 'あと一歩、届かなかった。';
    },
    setup(W) {
      const m = buddy(W);
      W.after(20, () => talk(W, m, 'ねえ、犯人のことだけど……\n太陽に決まってるよ。あいつ、いつもギラギラしてるし。', 160));
      // ① 「！」は左に出るのに、隕石は右から
      W.trigPx(70, 0, 30, 280, () => {
        const w = W.text(36, 150, '！', { size: 24, color: '#ff4a6a' });
        G.sfx('warn');
        W.after(40, () => (w.alive = false));
        W.after(30, () => {
          const r = W.fruit(500, 230, { kind: 'rock', r: 8, cause: '「！」は反対側に出ていた。' });
          r.vel(-4.2, 0);
          G.sfx('whoosh');
        });
      }, { cond: (P) => P.onGround });
      // ② 寝たふりのUFO
      W.add(new Ufo(W, 210, 54, [184, 236]));
      // ③ 低い足場は偽物（月がウソをつく）
      W.trigPx(250, 0, 16, 280, () => talk(W, m, 'あ、その低い足場は本物だよ！\n安心して乗ってね。', 120));
      // ③' 高い足場で立ち止まると流れ星
      let stand = 0;
      W.onStep = () => {
        const P = W.player;
        if (P.alive && P.onGround && P.y < 170 && P.cx > 330 && P.cx < 390) {
          if (++stand === 30) {
            const s = W.fruit(P.cx, -10, { kind: 'star', r: 7, cause: '流れ星は、立ち止まった人をねらう。' });
            s.vel(0, 6, 0, 0.3);
            G.sfx('whoosh');
          }
        } else stand = 0;
      };
      // ④ ワープゾーン（あの世行き）
      W.sign(20, 11, '↓ ワープゾーン\n（安全）' + SIG, { range: 26 });
    },
  });

  room('11-3', {
    hint: '遠くの惑星は落ちてくる。手前で待ち、惑星が帰ってから進む。PAUSEはにせもの：止まらず歩き続ける。オーブには触らず、壁はそのまま歩いて通れる（太陽は本当のことを言う）。看板は倒れてくるので跳び越える。',
    area: 11,
    name: '11-3 にせものの宇宙',
    theme: 'galaxy',
    bg: 'nebula',
    exits: { left: '11-2', right: '11-4' },
    map: [
      '########################',
      '#vvvvvvvvvvvvvvvvvvvvvv#',
      '#......................#',
      '#......................#',
      '#......................#',
      '#..............F.......#',
      '#..............F.......#',
      '#..............F.......#',
      '#..............F.......#',
      '...............F........',
      '...............F........',
      '..S............F........',
      '########################',
      '########################',
    ],
    spikeCauseFn(W) {
      return W.gravity === -1 ? '天井にもトゲがあった。オーブの看板を信じた。' : 'トゲの宇宙。';
    },
    setup(W) {
      const m = buddy(W);
      // ① 遠くの惑星……が落ちてくる
      const pl = W.add(new Planet(W, 250, 70, 34));
      W.trigPx(100, 0, 12, 280, () => {
        W.run(function* () {
          G.sfx('rumble');
          for (let i = 1; i <= 44; i++) {
            const k = i / 44;
            pl.scale = 0.3 + 0.7 * k * k;
            pl.pcx = 250 - 50 * k;
            pl.pcy = 70 + 136 * k * k;
            pl.hazard = pl.scale > 0.8;
            pl.layer = pl.scale > 0.6 ? 3 : -1.5;
            yield;
          }
          W.shake = 16;
          G.sfx('stomp');
          yield 50;
          pl.hazard = false;
          W.say('……失礼しました。', pl.pcx, pl.pcy - 40, 60, { plain: true, size: 10, color: '#c8d4f0' });
          for (let i = 44; i >= 0; i--) {
            const k = i / 44;
            pl.scale = 0.3 + 0.7 * k * k;
            pl.pcx = 250 - 50 * k;
            pl.pcy = 70 + 136 * k * k;
            pl.layer = pl.scale > 0.6 ? 3 : -1.5;
            yield;
          }
        });
      }, { cond: (P) => P.onGround });
      // ② 太陽の証言（太陽は本当のことしか言わない）
      const sun = W.add(new Npc(W, 380, 58, 'sun', { r: 14 }));
      W.trigPx(140, 0, 16, 280, () => {
        talk(W, sun, '犯人は、宇宙人か月の\nどちらかだ。', 130);
        W.after(140, () => talk(W, sun, 'それと、その壁は\n歩いて通れるぞ。', 110));
        W.after(260, () => talk(W, m, '太陽なんか信じちゃダメ！\nオーブを使って！', 110));
      });
      // ③ にせの PAUSE：止まると、上からレーザー
      W.trigPx(236, 0, 14, 280, (P) => {
        fake(W, 'pause', 100);
        G.sfx('select');
        W.laser(P.cx - 16, 0, 32, 240, { warn: 40, dur: 18, cause: 'ポーズ中でも、時間は止まらない。' });
      }, { cond: (P) => P.onGround });
      // ④ 重力反転のオーブ（天井にもトゲ）。壁は歩いて通れる
      W.orb(250, 196, { dir: 2 });
      W.sign(11, 11, 'オーブで重力反転！\n天井を歩いて壁を越えよう' + SIG, { range: 24 });
      // ⑤ 倒れてくる看板
      const sg = W.sign(20, 11, '出口まで\nあと少し' + SIG, { range: 26 });
      W.trigPx(370, 0, 80, 280, () => {
        W.after(18, () => {
          sg.alive = false;
          W.decor(352, 228, 'fallensign');
          W.hbox(352, 220, 58, 20, { kind: 'none', life: 8, cause: '看板が倒れてきた。' });
          W.shake = 6;
          G.sfx('thud');
        });
      }, { cond: (P) => P.onGround });
    },
  });

  room('11-4', {
    hint: '手前の小惑星はホログラム。土星の環（動く足場）は乗ると少しで落ちるので、すぐ次の環へ。向こう岸の左端は崩れる（土星の言うとおり）。最後の1UPは本物：撃たずに取る。',
    area: 11,
    name: '11-4 土星の環',
    theme: 'galaxy',
    bg: 'nebula',
    exits: { left: '11-3', right: '12-1' },
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
      '........................',
      '........................',
      '..S...FF................',
      '#####..............#####',
      '#####^^^^^^^^^^^^^^^####',
    ],
    spikeCauseFn(W) {
      const x = W.player.cx;
      if (W.vars.holo) return '小惑星はホログラムだった。';
      if (x > 370) return '土星の言うとおりだった。';
      return W.vars.ringFell ? '土星の環は、重さに耐えられなかった。' : '土星の環に乗りそこねた。';
    },
    setup(W) {
      const m = buddy(W);
      const sat = W.add(new Npc(W, 240, 56, 'saturn', { r: 16 }));
      W.after(20, () => {
        talk(W, sat, '太陽は、本当のことを\n言っている。', 130);
        W.after(140, () => talk(W, sat, 'それと、向こう岸の床は\n左のはしが崩れるよ。', 120));
        W.after(270, () => talk(W, m, '……。', 60));
      });
      // ① 手前の小惑星（F）はホログラム
      W.onStep = () => {
        const P = W.player;
        if (!W.vars.ringFell && P.cx > 118 && P.cx < 162 && P.y + P.h > 222 && P.y + P.h < 236) W.vars.holo = true;
      };
      // ② 土星の環：乗ると少しして落ちる
      const ring = (ty, x0, x1, ph) => {
        const b = W.block(Math.round(x0 / T), ty, 3, 1, { oneway: true, code: 3, keep: true, style: 'ring' });
        b.x = x0;
        W.run(function* () {
          yield ph;
          for (;;) {
            if (!b.alive || b.falling) return;
            b.tweenTo(x1, b.y, 70, 'inOutQuad');
            yield 72;
            if (!b.alive || b.falling) return;
            b.tweenTo(x0, b.y, 70, 'inOutQuad');
            yield 72;
          }
        });
        b.onStep = () => {
          if (b.falling) return;
          W.after(80, () => {
            b.falling = true;
            b.shakeT = 10;
            W.vars.ringFell = true;
            W.after(10, () => {
              b.stop();
              b.drop(0.4);
            });
          });
        };
        return b;
      };
      ring(10, 110, 196, 0);
      ring(8, 320, 240, 0);
      // ③ 向こう岸の左のはしは崩れる
      const edge = W.tileToBlock(19, 12, { keep: true });
      edge.onStep = () => edge.crumble(6);
      // ④ 最後の1UPは本物（撃つと爆発する）
      W.add(new OneUp(W, 444, 230, { real: true, blastCause: '今度は本物の1UPだった。撃つと爆発する。' }));
    },
  });

  // =====================================================================
  // AREA 12 宇宙ステーション
  // =====================================================================
  room('12-1', {
    hint: '掃除ロボットは跳び越えると跳ねるので3発撃って壊す。「出口」はエアロック（宇宙へ放り出される）。エレベーターに乗り、上の通路の高さで右へ跳び移る。通路ではレーザーを跳んでよける。',
    area: 12,
    name: '12-1 エアロック',
    theme: 'station',
    bg: 'station',
    exits: { left: '11-4', right: '12-2' },
    map: [
      '########################',
      '#vvvvvvvvvvvvvvvvvv....#',
      '#......................#',
      '#.......................',
      '#.......................',
      '#.......................',
      '#................-------',
      '#......................#',
      '#......................#',
      '.......................#',
      '.......................#',
      '..S....................#',
      '########################',
      '########################',
    ],
    spikeCauseFn: () => 'エレベーターは、屋上まで行った。',
    setup(W, opts) {
      if (!opts.respawn) W.after(20, () => ai(W, '宇宙ステーション《アリバイ》へようこそ。\n当ステーションは、とても安全です。', 140));
      // ① 掃除ロボット
      W.add(new Vacuum(W, 200, 90, 220));
      W.sign(4, 11, '掃除ロボット\n（ゴミだけを吸います）', { range: 26 });
      // ② 「出口」はエアロック
      W.door(21, 10, { to: '12-1', spawn: [2, 11], label: '出口', kill: 'エアロックの外は宇宙だった。' });
      W.sign(19, 11, '出口はこちら →' + SIG, { range: 26 });
      // ③ エレベーター：乗ると上がっていき、天井のトゲまで行く
      const ev = W.block(13, 11, 3, 1, { oneway: true, code: 3, keep: true, style: 'lift' });
      let going = false;
      ev.onStep = () => {
        if (going) return;
        going = true;
        G.sfx('switch');
        W.after(20, () => {
          ev.tweenTo(ev.x, 30, 190, 'linear', () => W.after(40, () => ev.tweenTo(ev.x, 220, 120, 'linear', () => (going = false))));
        });
      };
      W.sign(12, 11, 'エレベーター\n（2階にとまります）', { range: 26 });
      // ④ 上の通路のレーザー（セキュリティ解除済み……ではない）
      W.sign(18, 5, 'セキュリティ\n解除済み' + SIG, { range: 30 });
      W.trigPx(336, 80, 140, 44, () => {
        W.laser(336, 102, 144, 14, { warn: 30, dur: 24, cause: 'セキュリティは、解除されていなかった。' });
        G.sfx('charge');
      }, { cond: (P) => P.onGround });
    },
  });

  room('12-2', {
    hint: 'もう一人の自分は鏡写しに動く（ジャンプもまねる）ので撃つ。STAGE CLEAR はにせもの：見えたらすぐ上の足場へ。宇宙人は本当のことを言う：右の床のトゲは跳び越える。',
    area: 12,
    name: '12-2 宇宙人の部屋',
    theme: 'station',
    bg: 'station',
    exits: { left: '12-1', right: '12-3' },
    map: [
      '########################',
      '#......................#',
      '#......................#',
      '.......................#',
      '.......................#',
      '..S....................#',
      '----............---....#',
      '#......................#',
      '#......................#',
      '#.......................',
      '#.........----..........',
      '#.......................',
      '########################',
      '########^^^^^^^^^#######',
    ],
    spikeCauseFn(W) {
      return W.player.cx > 400 ? '宇宙人は、本当のことを言っていた。' : 'クリアしたと思った？';
    },
    setup(W) {
      // ① きみに化けた宇宙人
      W.add(new Double(W, 196, 226));
      // ② にせの STAGE CLEAR：床が抜ける
      const floor = [];
      for (let tx = 8; tx <= 16; tx++) floor.push(W.tileToBlock(tx, 12, { keep: true }));
      W.trigPx(170, 0, 20, 280, () => {
        fake(W, 'clear', 150);
        G.sfx('fanfare');
        W.after(46, () => floor.forEach((b, i) => W.after(i * 2, () => b.crumble(6))));
      }, { cond: (P) => P.onGround && P.y > 200 });
      // ③ 宇宙人の証言（宇宙人は本当のことしか言わない）
      const al = W.add(new Npc(W, 370, 106, 'alien', { r: 12 }));
      W.trigPx(330, 0, 16, 280, () => {
        talk(W, al, 'ワレワレハ、ハンニンデハ、ナイ。', 130);
        W.after(136, () => talk(W, al, 'ソコノ ユカ、アブナイ。\n（ほんとうダヨ）', 110));
      });
      // ④ 宇宙人の言うとおり、右の床にトゲ
      const sp = W.spike(21, 11, 'u', { hidden: true, cause: '宇宙人は、本当のことを言っていた。' });
      W.trigPx(414, 0, 30, 280, () => W.after(2, () => sp.pop(3)), { cond: (P) => P.onGround });
    },
  });

  room('12-3', {
    hint: '自爆のカウントダウンはウソ。急ぐと床が抜けるので、0になるまで待ってから穴を跳び越える。停電中は動かない。天井が落ちてくるので一度近づいて落とし、跳び越える。',
    area: 12,
    name: '12-3 管制室',
    theme: 'station',
    bg: 'station',
    exits: { left: '12-2', right: '12-X' },
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
      '........................',
      '........................',
      '..S.....................',
      '########################',
      '##############^^^#######',
    ],
    spikeCauseFn(W) {
      return W.player.cx < 350 ? '急いだ結果が、これだ。' : '停電中に、動いてはいけない。';
    },
    setup(W) {
      // ① 自爆カウントダウン（ウソ）。急ぐと床が抜ける
      const pit = [14, 15, 16].map((tx) => W.tileToBlock(tx, 12, { keep: true }));
      W.trigPx(60, 0, 20, 280, () => {
        fake(W, 'hint', 280, { text: 'ヒント：自爆する前に、急いで右へ！' + '　☾' });
        G.sfx('warn');
        W.run(function* () {
          for (let n = 10; n >= 0; n--) {
            W.vars.count = n;
            G.sfx(n <= 3 ? 'warn' : 'select');
            if (n === 4) pit.forEach((b) => b.crumble(4));
            yield 22;
          }
          W.vars.count = null;
          W.say('……ウソ。', 240, 110, 80, { plain: true, size: 18, color: '#ff6a8a' });
        });
      }, { cond: (P) => P.onGround });
      // ② 停電中に動くと、闇の中のトゲ
      const ds = [19, 20].map((tx) => W.spike(tx, 11, 'u', { hidden: true, keep: true, cause: '停電中に、動いてはいけない。' }));
      W.trigPx(352, 0, 12, 280, () => {
        W.vars.dark = 90;
        G.sfx('crumble');
        W.after(4, () => ds.forEach((s) => s.pop(2, false)));
        W.after(90, () =>
          ds.forEach((s) => {
            s.popped = false;
            s.hazard = false;
            s.oy = 20;
          })
        );
      }, { cond: (P) => P.onGround });
      W.onStep = () => {
        if (W.vars.dark > 0) W.vars.dark--;
      };
      // ③ 予言のモニター：「次の死因：落下」……落ちてくるのは天井
      W.decor(300, 44, 'monitor', { text: '次の死因：落下' });
      const th = W.block(21, 2, 2, 2, { style: 'thwomp', keep: true, squishCause: '予言は外れた。もっとひどい死に方だった。' });
      W.trigPx(404, 0, 16, 280, () => {
        W.after(14, () => {
          th.tweenTo(th.x, 200, 16, 'inQuad', () => {
            W.shake = 12;
            G.sfx('stomp');
          });
        });
      }, { cond: (P) => P.onGround });
    },
    drawFg(ctx, W) {
      if (W.vars.dark > 0) {
        const flick = W.vars.dark < 60 && W.vars.dark > 54;
        G.Render.drawDarkness(ctx, W, flick ? 0.3 : 0.95);
      }
    },
    drawUI(ctx, W, UI) {
      if (W.vars.count != null) G.Render.drawCountdown(ctx, W.vars.count, UI);
    },
  });

  // =====================================================================
  // 推理の間：犯人を撃って告発する → 真犯人との対決
  // =====================================================================
  const REBUT = {
    sun: { cause: '冤罪。太陽が犯人なら、土星の証言（太陽は本当のことを言う）までウソになる。', line: '異議あり！\nわたしが犯人なら、土星もウソつきになるぞ！' },
    saturn: { cause: '冤罪。土星が犯人なら、月の証言（犯人は太陽）が本当になってしまう。', line: '異議あり！\nぼくが犯人なら、月の証言が本当になっちゃう！' },
    alien: { cause: '冤罪。宇宙人が犯人なら、月の証言（犯人は太陽）が本当になってしまう。', line: 'イギアリ！\nワレワレガ ハンニンナラ、月ノ証言ガ 本当ニナル！' },
  };
  room('12-X', {
    hint: 'ウソつきが1人だけになるのは誰が犯人の時？ 月が犯人なら月の証言だけがウソになる。対決では、月の予告はウソ（予告された場所だけが安全）。',
    area: 12,
    name: '推理の間',
    theme: 'station',
    bg: 'deduce',
    music: null,
    exits: { left: '12-3' },
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
      '.......................#',
      '.......................#',
      '..S....................#',
      '########################',
      '########################',
    ],
    setup(W, opts) {
      const game = W.game;
      const flags = (game && game.flags) || {};
      if (flags.trueMoonDead) {
        W.vars.peace = true;
        W.add(new Npc(W, 160, 120, 'sun', { r: 14 }));
        W.add(new Npc(W, 320, 110, 'saturn', { r: 16 }));
        W.sign(10, 11, '月のいない夜空は、\nすこしさみしい。', { range: 30 });
        return;
      }
      // 対決が始まったら入口を閉じる
      const closeGate = () => {
        if (W.vars.gate) return;
        W.vars.gate = W.block(0, 9, 1, 3, { style: 'gate', keep: true });
        G.sfx('stomp');
      };
      if (flags.culpritFound) {
        closeGate();
        G.BOSSES.trueMoon(W, opts, true);
        return;
      }
      W.vars.board = true;
      W.sign(4, 11, `犯人だと思う者を\n${shotHint()} で撃て。\n（まちがえたら……）`, { range: 30 });
      const sus = {
        alien: W.add(new Npc(W, 150, 210, 'alien', { r: 12 })),
        sun: W.add(new Npc(W, 230, 206, 'sun', { r: 14 })),
        moon: W.add(new Npc(W, 310, 206, 'moon', { r: 14 })),
        saturn: W.add(new Npc(W, 390, 206, 'saturn', { r: 16 })),
      };
      let busy = false;
      for (const k of Object.keys(sus)) {
        const n = sus[k];
        n.shootable = true;
        n.label = { moon: '月', sun: '太陽', saturn: '土星', alien: '宇宙人' }[k];
        n.onShot = () => {
          if (busy) return true;
          busy = true;
          W.vars.board = false;
          if (k === 'moon') {
            if (W.game) {
              W.game.flags.culpritFound = true;
              if (W.game.save) W.game.save(W.id, 2, 11);
            }
            for (const o of Object.values(sus)) if (o !== n) o.alive = false;
            closeGate();
            G.BOSSES.trueMoon(W, opts, false, n);
            return true;
          }
          // まちがい：反論されて退場
          G.sfx('trap');
          W.text(240, 120, '異議あり！', { size: 22, color: '#ff4a6a' });
          n.face = 'angry';
          talk(W, n, REBUT[k].line, 120);
          W.run(function* () {
            yield 110;
            n.hazard = true;
            n.cause = REBUT[k].cause;
            n.float = false;
            const P = W.player;
            for (let i = 0; i < 80 && P.alive; i++) {
              n.x += (P.cx - n.cx) * 0.12;
              n.y += (P.cy - n.cy) * 0.12;
              yield;
            }
          });
          return true;
        };
      }
    },
    drawUI(ctx, W, UI) {
      if (W.vars.board) G.Render.drawCaseBoard(ctx, W, UI);
      if (W.vars.fakeWarn || W.vars.shadowX != null) G.Render.drawLieWarn(ctx, W);
    },
  });
})();
