// UI レイヤー（高解像度）：HUD・吹き出し・タイトル・死亡画面・ポーズ・エンディング
(function () {
  'use strict';
  const G = globalThis.G;
  const SW = G.W,
    SH = G.H;
  const FONT = '"DotGothic16", "Hiragino Kaku Gothic ProN", "Noto Sans JP", "Yu Gothic", sans-serif';
  const UI = (G.UI = {});

  function font(px) {
    return `${px}px ${FONT}`;
  }
  function textOut(ctx, s, x, y, size, col, align, outline, ow) {
    ctx.font = font(size);
    ctx.textAlign = align || 'left';
    ctx.textBaseline = 'middle';
    if (outline !== false) {
      ctx.lineJoin = 'round';
      ctx.lineWidth = ow || Math.max(2, size / 4);
      ctx.strokeStyle = outline || '#0a0612';
      ctx.strokeText(s, x, y);
    }
    ctx.fillStyle = col || '#fff';
    ctx.fillText(s, x, y);
  }
  UI.textOut = textOut;
  function pixText(ctx, s, x, y, scale, col, outlineCol) {
    const w = G.SPR.tinyWidth(s, scale);
    const x0 = Math.round(x - w / 2);
    if (outlineCol) {
      for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, 1], [-1, 1], [1, -1]])
        G.SPR.tiny(ctx, s, x0 + dx * Math.max(1, scale / 3), y + dy * Math.max(1, scale / 3), outlineCol, scale);
    }
    G.SPR.tiny(ctx, s, x0, y, col, scale);
  }
  UI.pixText = pixText;

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  function bubble(ctx, text, cx, by, alpha, opts) {
    opts = opts || {};
    const size = opts.size || 9;
    ctx.font = font(size);
    const lines = String(text).split('\n');
    let w = 0;
    for (const l of lines) w = Math.max(w, ctx.measureText(l).width);
    const pad = 5,
      lh = size + 3;
    const bw = w + pad * 2,
      bh = lines.length * lh + pad * 2 - 3;
    let x = Math.round(cx - bw / 2);
    x = Math.max(3, Math.min(SW - bw - 3, x));
    let y = Math.round(by - bh - 6);
    if (y < 3) y = 3;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = opts.bg || 'rgba(255,253,240,0.96)';
    ctx.strokeStyle = opts.border || '#2a1a10';
    ctx.lineWidth = 1;
    roundRect(ctx, x + 0.5, y + 0.5, bw, bh, 3);
    ctx.fill();
    ctx.stroke();
    // しっぽ
    const tx = G.clamp(cx, x + 6, x + bw - 6);
    ctx.beginPath();
    ctx.moveTo(tx - 3, y + bh);
    ctx.lineTo(tx, y + bh + 4);
    ctx.lineTo(tx + 3, y + bh);
    ctx.fill();
    ctx.fillStyle = opts.color || '#2a1a10';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    lines.forEach((l, i) => ctx.fillText(l, x + bw / 2, y + pad + i * lh + size / 2));
    ctx.globalAlpha = 1;
  }

  // メニューを描く座標系（縦持ちではゲーム画面の下の広い領域に大きく描く）
  G.menuView = function () {
    const L = G.padLayout,
      v = G.view;
    if (L && L.portrait) {
      const vw = window.innerWidth,
        vh = window.innerHeight;
      const s = Math.min(vw / 300, 2);
      return { x: (vw - 300 * s) / 2, y: L.padTop + 12, s, w: 300, h: (vh - L.padTop - 12) / s, portrait: true };
    }
    return { x: v.x, y: v.y, s: v.s, w: SW, h: SH, portrait: false };
  };
  function withMenuView(ctx, fn) {
    const mv = G.menuView();
    const d = G.dpr || 1;
    ctx.save();
    ctx.setTransform(mv.s * d, 0, 0, mv.s * d, mv.x * d, mv.y * d);
    fn(mv);
    ctx.restore();
  }
  UI.withMenuView = withMenuView;

  // ---------------- メニュー ----------------
  class Menu {
    constructor(items, opts) {
      this.items = items;
      this.sel = 0;
      this.opts = opts || {};
      this.rects = [];
      this.t = 0;
    }
    update(inp, taps) {
      this.t++;
      const n = this.items.length;
      const step = (d) => {
        let i = this.sel;
        for (let k = 0; k < n; k++) {
          i = (i + d + n) % n;
          if (!this.items[i].disabled) break;
        }
        this.sel = i;
        G.sfx('select');
      };
      if (inp.upP || (this.opts.lr && inp.leftP)) step(-1);
      if (inp.downP || (this.opts.lr && inp.rightP)) step(1);
      if (inp.okP || inp.jumpP) return this.fire(this.sel);
      if (this.opts.back && (inp.pauseP || inp.shootP)) {
        G.sfx('select');
        return this.opts.back();
      }
      const mv = G.menuView();
      for (const t0 of taps) {
        const tp = { x: (t0.cx - mv.x) / mv.s, y: (t0.cy - mv.y) / mv.s };
        for (let i = 0; i < this.rects.length; i++) {
          const r = this.rects[i];
          if (r && tp.x >= r.x && tp.x <= r.x + r.w && tp.y >= r.y && tp.y <= r.y + r.h) {
            this.sel = i;
            return this.fire(i);
          }
        }
      }
    }
    fire(i) {
      const it = this.items[i];
      if (!it || it.disabled) return;
      G.sfx('ok');
      it.action && it.action();
    }
    draw(ctx, cx, y0, gap, size) {
      size = size || 13;
      gap = gap || 22;
      this.rects = [];
      this.items.forEach((it, i) => {
        const y = y0 + i * gap;
        const label = typeof it.label === 'function' ? it.label() : it.label;
        ctx.font = font(size);
        const w = Math.max(110, ctx.measureText(label).width + 30);
        const r = { x: cx - w / 2, y: y - gap / 2 + 1, w, h: gap - 2 };
        this.rects.push(r);
        const on = i === this.sel;
        if (on) {
          ctx.fillStyle = 'rgba(255,207,74,0.16)';
          roundRect(ctx, r.x, r.y, r.w, r.h, 4);
          ctx.fill();
          ctx.strokeStyle = 'rgba(255,207,74,0.7)';
          ctx.lineWidth = 1;
          ctx.stroke();
          const bob = Math.sin(this.t * 0.2) * 1.5;
          G.SPR.tiny(ctx, '>', r.x + 6 + bob, y - 2.5, '#ffcf4a', 1);
        }
        textOut(ctx, label, cx, y + 1, size, it.disabled ? '#6a6680' : on ? '#ffe9a8' : '#e8e2ff', 'center');
      });
    }
  }
  UI.Menu = Menu;

  // ---------------- HUD ----------------
  function drawHUD(ctx, game) {
    const W = game.world;
    // 左上：デス数とタイム
    ctx.fillStyle = 'rgba(10,6,18,0.55)';
    roundRect(ctx, 4, 4, 92, 15, 3);
    ctx.fill();
    drawSkull(ctx, 8, 7);
    textOut(ctx, String(game.deaths), 20, 12, 10, '#ffffff', 'left', false);
    textOut(ctx, G.fmtTime(game.playFrames), 92, 12, 9, '#c8c0e8', 'right', false);
    if (W && W.def.name && !(W.boss && W.boss.showBar)) {
      ctx.globalAlpha = 0.75;
      textOut(ctx, W.def.name, 100, 12, 8, '#e8e2ff', 'left', '#0a0612', 2);
      ctx.globalAlpha = 1;
    }
    if (game.diff === 'easy') G.SPR.tiny(ctx, 'EASY', 8, 22, '#7ad0ff');
  }
  function drawSkull(ctx, x, y) {
    ctx.fillStyle = '#f0ecff';
    ctx.fillRect(x + 1, y, 6, 5);
    ctx.fillRect(x, y + 1, 8, 3);
    ctx.fillRect(x + 2, y + 5, 4, 2);
    ctx.fillStyle = '#1a1028';
    ctx.fillRect(x + 1, y + 2, 2, 2);
    ctx.fillRect(x + 5, y + 2, 2, 2);
    ctx.fillRect(x + 3, y + 5, 1, 1);
    ctx.fillRect(x + 4, y + 6, 1, 1);
  }
  UI.drawSkull = drawSkull;

  function drawBossBar(ctx, W) {
    const b = W.boss;
    if (!b || !b.showBar) return;
    const w = 220,
      x = (SW - w) / 2,
      y = 24;
    const k = Math.max(0, b.hp / b.maxHp);
    b.barK = b.barK == null ? k : G.approach(b.barK, k, 0.004);
    ctx.fillStyle = 'rgba(10,6,18,0.75)';
    ctx.fillRect(x - 2, y - 2, w + 4, 9);
    ctx.fillStyle = '#5a1020';
    ctx.fillRect(x, y, w * b.barK, 5);
    ctx.fillStyle = b.hurtT > 0 ? '#ffffff' : '#ff3a5a';
    ctx.fillRect(x, y, w * k, 5);
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    ctx.fillRect(x, y, w * k, 1);
    textOut(ctx, b.name, SW / 2, y - 7, 9, '#ffe9a8', 'center');
    if (W.lives != null) drawLives(ctx, W, 34, 33);
  }
  // 残機のハート
  function drawLives(ctx, W, cx, y) {
    const n = 3;
    const x0 = Math.round(cx);
    ctx.fillStyle = 'rgba(10,6,18,0.55)';
    roundRect(ctx, x0 - 30, y - 3, 30 + n * 12 + 4, 15, 3);
    ctx.fill();
    for (let i = 0; i < n; i++) {
      const on = i < W.lives;
      const blink = !on && W.invuln > 0 && i === W.lives && Math.floor(W.time / 4) % 2;
      drawHeart(ctx, x0 + i * 12, y, on || blink ? '#ff4a6a' : 'rgba(255,255,255,0.18)');
    }
    textOut(ctx, '残機', x0 - 4, y + 4.5, 8, '#ffb0c0', 'right', false);
  }
  function drawHeart(ctx, x, y, col) {
    ctx.fillStyle = '#2a0010';
    ctx.fillRect(x, y + 1, 9, 4);
    ctx.fillRect(x + 1, y, 3, 7);
    ctx.fillRect(x + 5, y, 3, 7);
    ctx.fillRect(x + 2, y + 6, 5, 2);
    ctx.fillRect(x + 3, y + 8, 3, 1);
    ctx.fillStyle = col;
    ctx.fillRect(x + 1, y + 1, 3, 4);
    ctx.fillRect(x + 5, y + 1, 3, 4);
    ctx.fillRect(x + 2, y + 5, 5, 1);
    ctx.fillRect(x + 3, y + 6, 3, 1);
    ctx.fillRect(x + 4, y + 7, 1, 1);
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    ctx.fillRect(x + 2, y + 2, 1, 1);
  }

  function drawWorldUI(ctx, W) {
    // 看板の吹き出し
    for (const e of W.ents) {
      if (!e.alive) continue;
      if (e.bubble && e.near > 0.02) bubble(ctx, e.text, e.cx, e.y + 2, e.near);
      if (e.uiLabel && e.visible) textOut(ctx, e.uiLabel, e.cx, e.y + e.h / 2 + 0.5, 8, '#ffe9a8', 'center', '#140c28', 2);
      if (e.uiText && e.visible && e.alpha > 0) {
        ctx.globalAlpha = Math.min(1, e.alpha);
        const yy = e.y + (e.bob ? Math.sin(W.time * 0.08) * e.bob : 0);
        textOut(ctx, e.text, e.x, yy, e.size, e.color, e.align, e.outline ? '#0a0612' : false, e.size / 3.5);
        ctx.globalAlpha = 1;
      }
    }
    for (let i = W.texts.length - 1; i >= 0; i--) {
      const t = W.texts[i];
      t.life--;
      if (t.life <= 0) {
        W.texts.splice(i, 1);
        continue;
      }
      const a = Math.min(1, t.life / 15, (t.max - t.life + 1) / 6);
      const x = t.follow ? t.follow.cx + (t.dx || 0) : t.x;
      const y = t.follow ? t.follow.y + (t.dy || 0) : t.y;
      if (t.plain) {
        ctx.globalAlpha = a;
        textOut(ctx, t.text, x, y, t.size || 10, t.color || '#fff', 'center');
        ctx.globalAlpha = 1;
      } else bubble(ctx, t.text, x, y, a, t);
    }
  }

  function drawAreaBanner(ctx, game) {
    const b = game.areaBanner;
    if (!b) return;
    const a = Math.min(1, b.t / 20, (200 - b.t) / 30);
    if (a <= 0) return;
    ctx.globalAlpha = a;
    const y = 70;
    ctx.fillStyle = 'rgba(8,4,16,0.6)';
    ctx.fillRect(0, y - 22, SW, 44);
    ctx.fillStyle = 'rgba(255,207,74,0.7)';
    ctx.fillRect(0, y - 22, SW, 1);
    ctx.fillRect(0, y + 21, SW, 1);
    textOut(ctx, b.title, SW / 2, y - 5, 17, '#ffe9a8', 'center');
    textOut(ctx, b.sub, SW / 2, y + 12, 9, '#c8c0e8', 'center');
    ctx.globalAlpha = 1;
  }

  // ---------------- 死亡画面 ----------------
  function drawDeath(ctx, game) {
    const t = game.deadT;
    const a = Math.min(1, t / 8);
    ctx.fillStyle = `rgba(20,0,8,${0.35 * a})`;
    ctx.fillRect(0, 0, SW, SH);
    const sc = t < 6 ? 10 - t * 0.67 : 6;
    ctx.globalAlpha = a;
    pixText(ctx, 'GAME OVER', SW / 2, 92 - (sc * 5) / 2, Math.round(sc), '#ff2a48', '#2a0008');
    textOut(ctx, game.cause || '', SW / 2, 140, 12, '#ffffff', 'center');
    if (t > 10) {
      const blink = Math.floor(t / 25) % 2 === 0;
      ctx.globalAlpha = blink ? 1 : 0.55;
      textOut(ctx, G.isTouch ? 'タップ / ジャンプでリトライ' : 'ジャンプ / R でリトライ', SW / 2, 172, 10, '#ffcf4a', 'center');
    }
    ctx.globalAlpha = a;
    const rd = game.roomDeaths[game.world.id] || 0;
    textOut(ctx, `この部屋で ${rd} 回目の死`, SW / 2, 192, 8, '#b8a8d8', 'center');
    if (game.deaths % 50 === 0 && game.deaths > 0) textOut(ctx, `祝 ${game.deaths} デス達成！`, SW / 2, 212, 11, '#ffcf4a', 'center');
    const hint = game.world.def.hint;
    if (hint && rd >= 3) {
      ctx.fillStyle = 'rgba(10,6,18,0.7)';
      roundRect(ctx, 20, 228, SW - 40, 24, 4);
      ctx.fill();
      textOut(ctx, 'ヒント：' + hint, SW / 2, 240, 9, '#9affc0', 'center', false);
    }
    ctx.globalAlpha = 1;
  }

  // ---------------- ポーズ ----------------
  function pauseMenu(game) {
    if (game._pauseMenu) return game._pauseMenu;
    const A = G.Audio;
    const m = new Menu(
      [
        { label: 'つづける', action: () => (game.state = 'play') },
        { label: 'セーブ地点からやり直す', action: () => game.retry() },
        {
          label: () => '難易度: ' + (game.diff === 'easy' ? 'やさしい（ボス戦3機）' : 'ふつう'),
          action: () => game.setDifficulty(game.diff === 'easy' ? 'normal' : 'easy'),
        },
        { label: () => 'BGM: ' + (A.settings.bgm ? 'ON' : 'OFF'), action: () => A.setBgm(!A.settings.bgm) },
        { label: () => '効果音: ' + (A.settings.se ? 'ON' : 'OFF'), action: () => A.setSe(!A.settings.se) },
        { label: () => 'ボス戦オートショット: ' + (G.autoShot ? 'ON' : 'OFF'), action: () => G.setAutoShot(!G.autoShot) },
        { label: '全画面きりかえ', action: () => G.toggleFullscreen && G.toggleFullscreen() },
        { label: 'タイトルへ', action: () => G.toTitle() },
      ],
      { back: () => (game.state = 'play') }
    );
    game._pauseMenu = m;
    return m;
  }
  UI.pauseMenu = pauseMenu;
  function drawPause(ctx, game) {
    ctx.fillStyle = 'rgba(8,4,16,0.72)';
    ctx.fillRect(0, 0, SW, SH);
    const m = pauseMenu(game);
    const info = `デス ${game.deaths}  /  ${G.fmtTime(game.playFrames)}  /  ${game.diff === 'easy' ? 'やさしい' : 'ふつう'}`;
    if (G.menuView().portrait) {
      pixText(ctx, 'PAUSE', SW / 2, 110, 6, '#ffcf4a', '#2a1a00');
      textOut(ctx, info, SW / 2, 160, 11, '#a89cc8', 'center');
      withMenuView(ctx, (mv) => m.draw(ctx, mv.w / 2, 40, 34, 15));
    } else {
      pixText(ctx, 'PAUSE', SW / 2, 34, 4, '#ffcf4a', '#2a1a00');
      m.draw(ctx, SW / 2, 70, 21, 12);
      textOut(ctx, info, SW / 2, 250, 9, '#a89cc8', 'center');
    }
  }

  // ---------------- エンディング ----------------
  const CREDITS = [
    ['THANK YOU', 'FOR PLAYING!'],
    ['I WANNA KILL THE MOON', ''],
    ['ゲームデザイン・プログラム・ドット絵・音楽', 'Claude'],
    ['トゲの設置', 'Claude（反省していない）'],
    ['リンゴ', 'デリシャスフルーツ株式会社'],
    ['月', '月（友情出演）'],
    ['太陽', '太陽（特別出演）'],
    ['重力', 'アイザック・ニュートン'],
    ['真犯人', 'セーブポイント'],
    ['月', 'いいやつだった'],
    ['テストプレイ', 'あなた'],
    ['', ''],
  ];
  function rankFor(d) {
    if (d === 0) return ['神', '本当に人間ですか？'];
    if (d < 50) return ['月面着陸者', '見事な腕前。'];
    if (d < 150) return ['ウサギ級', '月までひとっとび。'];
    if (d < 400) return ['死にゲーマー', '死んで覚えた。立派です。'];
    if (d < 800) return ['ゾンビ', 'それでも諦めなかった。'];
    return ['不死鳥', '何度でも蘇る魂。'];
  }
  function drawEnding(ctx, game) {
    const t = game.endT;
    ctx.fillStyle = `rgba(6,4,20,${Math.min(0.85, t / 120)})`;
    ctx.fillRect(0, 0, SW, SH);
    const a = Math.min(1, t / 60);
    ctx.globalAlpha = a;
    pixText(ctx, 'THE END', SW / 2, 26, 5, '#ffe9a8', '#2a1a00');
    const [rank, note] = rankFor(game.deaths);
    textOut(ctx, `デス数  ${game.deaths}`, SW / 2, 74, 13, '#ffffff', 'center');
    textOut(ctx, `クリアタイム  ${G.fmtTime(game.playFrames)}`, SW / 2, 94, 13, '#ffffff', 'center');
    textOut(ctx, `難易度  ${game.diff === 'easy' ? 'やさしい' : game.easyUsed ? 'ふつう（途中やさしい）' : 'ふつう'}`, SW / 2, 114, 11, '#c8c0e8', 'center');
    textOut(ctx, `称号「${rank}」`, SW / 2, 140, 15, '#ffcf4a', 'center');
    textOut(ctx, note, SW / 2, 160, 10, '#e8e2ff', 'center');
    if (game.endingNote) textOut(ctx, game.endingNote, SW / 2, 58, 9, '#ff9aaa', 'center');
    ctx.globalAlpha = 1;
    // スタッフロール
    const sy = 280 - Math.max(0, t - 120) * 0.35;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 176, SW, 80);
    ctx.clip();
    CREDITS.forEach((c, i) => {
      const y = sy + i * 34;
      textOut(ctx, c[0], SW / 2, y, 9, '#a89cc8', 'center');
      textOut(ctx, c[1], SW / 2, y + 13, 11, '#ffffff', 'center');
    });
    ctx.restore();
    if (t > 240) {
      ctx.globalAlpha = Math.floor(t / 30) % 2 ? 1 : 0.5;
      textOut(ctx, G.isTouch ? 'タップでタイトルへ' : 'ジャンプでタイトルへ', SW / 2, 266, 9, '#ffcf4a', 'center');
      ctx.globalAlpha = 1;
    }
  }

  // ---------------- ステージクリア ----------------
  function drawStageClear(ctx, game) {
    const t = game.clearT;
    ctx.fillStyle = `rgba(6,4,20,${Math.min(0.82, t / 50)})`;
    ctx.fillRect(0, 0, SW, SH);
    const a = Math.min(1, t / 30);
    ctx.globalAlpha = a;
    const n = game.clearedStage;
    const sc = t < 12 ? 9 - t * 0.33 : 5;
    pixText(ctx, `STAGE ${n} CLEAR`, SW / 2, 50 - (sc * 5) / 2, Math.round(sc), '#ffe9a8', '#2a1a00');
    textOut(ctx, `ここまでのデス  ${game.deaths}`, SW / 2, 96, 12, '#ffffff', 'center');
    textOut(ctx, `プレイ時間  ${G.fmtTime(game.playFrames)}`, SW / 2, 114, 11, '#c8c0e8', 'center');
    const next = G.STAGES[n + 1];
    if (next && t > 40) {
      ctx.globalAlpha = Math.min(1, (t - 40) / 30);
      textOut(ctx, `NEXT ▶ ${next.title}  ${next.name}`, SW / 2, 150, 14, '#ffcf4a', 'center');
      (next.story || []).forEach((line, i) => textOut(ctx, line, SW / 2, 176 + i * 18, 11, '#e8e2ff', 'center'));
    }
    if (t > 100) {
      ctx.globalAlpha = Math.floor(t / 25) % 2 ? 1 : 0.55;
      textOut(ctx, G.isTouch ? 'タップで次のステージへ' : 'ジャンプで次のステージへ', SW / 2, 252, 10, '#ffcf4a', 'center');
    }
    ctx.globalAlpha = 1;
  }

  // ---------------- タイトル ----------------
  function drawLogo(ctx, t) {
    const y0 = 34;
    const wob = (i) => Math.round(Math.sin(t * 0.06 + i * 0.6) * 1.5);
    const line1 = 'I WANNA KILL';
    const s1 = 4;
    const cx0 = SW / 2 - 24;
    let x = cx0 - G.SPR.tinyWidth(line1, s1) / 2;
    for (let i = 0; i < line1.length; i++) {
      const ch = line1[i];
      G.SPR.tiny(ctx, ch, x + 2, y0 + wob(i) + 2, '#1a0a24', s1);
      G.SPR.tiny(ctx, ch, x, y0 + wob(i), '#ffe9a8', s1);
      x += (G.SPR.glyphW(ch, s1) + 1) * s1;
    }
    // THE MOON（O の部分が月）
    const line2 = 'THE MOON';
    const s2 = 6;
    x = cx0 - G.SPR.tinyWidth(line2, s2) / 2;
    const y2 = y0 + 30;
    for (let i = 0; i < line2.length; i++) {
      const ch = line2[i];
      if (ch === 'O') {
        const img = G.SPR.moon(12, i === 5 ? 'grin' : 'calm');
        ctx.drawImage(img, Math.round(x + (G.SPR.glyphW('O', s2) * s2) / 2 - img.width / 2), Math.round(y2 + 15 + wob(i) - img.height / 2));
      } else {
        G.SPR.tiny(ctx, ch, x + 3, y2 + wob(i) + 3, '#3a0010', s2);
        G.SPR.tiny(ctx, ch, x, y2 + wob(i), '#ff3a5a', s2);
      }
      x += (G.SPR.glyphW(ch, s2) + 1) * s2;
    }
    textOut(ctx, '〜 理不尽だらけの死にゲー 〜', cx0, y2 + 46, 10, '#e8e2ff', 'center');
  }

  // ---------------- アップデート履歴 ----------------
  const UPDATES = [
    ['2026/10/25', '不具合の修正', ['5-2 やさしいモードのセーブがヘビのトゲと同じマスで詰む問題を修正', '2-1・6-1 でセーブ直後に罠が動く問題を修正', 'タイトル右上にアップデート履歴を追加']],
    ['2026/10/25', '4面「月の裏側」を追加', ['分かれ道と謎解き（順番スイッチ・壁の中・重力・待て・うそつき看板）', '月のかけらを3つ集めて真犯人と対決', 'まさかの結末']],
    ['2026/10/25', 'ボスの調整', ['THE SUN の弾を遅く・少なく', 'ニュートンの樹の「果実の扇」を遅く・少なく']],
    ['2026/10/25', '遊びやすさ', ['ポーズ画面から途中でも難易度を変えられるように', 'ボス部屋の扉から次のステージへ歩いて行けるように']],
    ['2026/10/25', '罠とボスの強化', ['1面後半・2面・3面に理不尽な罠と死因を追加', '2面・3面のボスを弾幕で強化']],
    ['2026/10/24', '3面「すべての元凶」を追加', ['さかさまの宇宙・ニュートンの庭', '中ボス ブラックホール／ボス ニュートンの樹']],
    ['2026/10/24', '2面「太陽を沈めろ」を追加', ['灼熱の砂漠・太陽の神殿', '中ボス サボテン将軍／ボス THE SUN']],
    ['2026/10/24', 'ステージ制に', ['デリシャス・キングが1面の中ボス、THE MOON が1面ボスに', '1面に理不尽な罠を追加', '月の最後のかけらでも死ぬように']],
    ['2026/10/24', '不具合の修正', ['画面を移動した時に壁や床に埋まらないように']],
    ['2026/10/23', '罠の調整', ['落ちてくる罠を初見殺しらしく', 'やさしいモードのボス戦は残機3']],
    ['2026/10/23', '公開', ['I WANNA KILL THE MOON 公開']],
  ];
  G.UPDATES = UPDATES;
  // タイトル右上のボタン（UI座標）
  UI.historyButton = { x: SW - 74, y: 5, w: 68, h: 16 };
  function drawHistoryButton(ctx, t) {
    const b = UI.historyButton;
    ctx.fillStyle = 'rgba(20,12,40,0.75)';
    roundRect(ctx, b.x, b.y, b.w, b.h, 4);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,207,74,0.7)';
    ctx.lineWidth = 1;
    ctx.stroke();
    textOut(ctx, 'アップデート履歴', b.x + b.w / 2, b.y + b.h / 2 + 1, 8, '#ffe9a8', 'center', false);
    // 新しい更新の印
    if (Math.floor(t / 30) % 2) {
      ctx.fillStyle = '#ff3a5a';
      ctx.fillRect(b.x + b.w - 4, b.y - 1, 4, 4);
    }
  }
  function drawHistory(ctx, game) {
    ctx.fillStyle = 'rgba(6,4,16,0.92)';
    ctx.fillRect(0, 0, SW, SH);
    textOut(ctx, 'アップデート履歴', SW / 2, 18, 14, '#ffe9a8', 'center');
    textOut(ctx, '×', SW - 16, 16, 14, '#ffffff', 'center');
    // 本文（スクロール）
    const top = 34,
      bottom = SH - 22;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, top, SW, bottom - top);
    ctx.clip();
    let y = top + 10 - (game.histScroll || 0);
    for (const [date, title, lines] of UPDATES) {
      textOut(ctx, date, 40, y, 8, '#a89cc8', 'left', false);
      textOut(ctx, title, 104, y, 11, '#ffcf4a', 'left', false);
      y += 15;
      for (const l of lines) {
        textOut(ctx, '・' + l, 112, y, 9, '#e8e2ff', 'left', false);
        y += 12;
      }
      y += 7;
    }
    ctx.restore();
    game.histMax = Math.max(0, y + (game.histScroll || 0) - bottom + 10);
    ctx.globalAlpha = 0.7;
    textOut(ctx, G.isTouch ? '上下にスワイプでスクロール ／ タップでとじる' : '↑↓ でスクロール ／ ジャンプ・ショットでとじる', SW / 2, SH - 10, 8, '#a89cc8', 'center');
    ctx.globalAlpha = 1;
  }
  UI.drawHistory = drawHistory;

  UI.drawTitle = function (ctx, game) {
    const ts = game.titleScene;
    if (game.titleMode === 'history') return drawHistory(ctx, game);
    drawLogo(ctx, ts ? ts.t : 0);
    if (!(ts && ts.gag)) drawHistoryButton(ctx, ts ? ts.t : 0);
    if (ts && ts.gag) {
      textOut(ctx, ts.gagText, SW / 2, 200, 11, '#ffffff', 'center');
      return;
    }
    const m = game.titleMenu;
    withMenuView(ctx, (mv) => {
      const big = mv.portrait;
      const y0 = big ? 50 : 160;
      if (m) m.draw(ctx, mv.w / 2, y0, big ? 36 : 21, big ? 16 : 12);
      if (game.titleMode === 'diff') textOut(ctx, '難易度をえらんでください', mv.w / 2, y0 - (big ? 34 : 20), big ? 12 : 10, '#c8c0e8', 'center');
      if (game.titleMode === 'stage') textOut(ctx, 'ステージをえらんでください', mv.w / 2, y0 - (big ? 34 : 20), big ? 12 : 10, '#c8c0e8', 'center');
    });
    const st = game.stats;
    if (st && st.clears > 0) {
      textOut(ctx, `★ クリア ${st.clears}回  ベスト ${st.best ? st.best.deaths + 'デス' : '-'}`, SW / 2, 270, 8, '#ffcf4a', 'center');
    } else {
      ctx.globalAlpha = 0.6;
      textOut(ctx, G.isTouch ? '横画面がおすすめ' : '←→ 移動  Shift/Z ジャンプ  X ショット  R リトライ', SW / 2, 270, 8, '#c8c0e8', 'center');
      ctx.globalAlpha = 1;
    }
  };

  // ---------------- プロローグ ----------------
  const INTRO = ['ある夜、月が笑った。', 'そして――落ちてきた。', '何度死んでもかまわない。', '月を、倒せ。'];
  function drawIntro(ctx, game) {
    const t = game.introT;
    const out = Math.max(0, Math.min(1, (330 - t) / 30));
    ctx.fillStyle = `rgba(4,2,12,${0.94 * out})`;
    ctx.fillRect(0, 0, SW, SH);
    INTRO.forEach((line, i) => {
      const a = Math.max(0, Math.min(1, (t - 20 - i * 55) / 25)) * out;
      if (a <= 0) return;
      ctx.globalAlpha = a;
      textOut(ctx, line, SW / 2, 90 + i * 28, i === 3 ? 16 : 12, i === 3 ? '#ffcf4a' : '#e8e2ff', 'center');
    });
    ctx.globalAlpha = (0.4 + Math.sin(t * 0.1) * 0.2) * out;
    textOut(ctx, G.isTouch ? 'タップでスキップ' : 'ジャンプでスキップ', SW / 2, 250, 9, '#a89cc8', 'center');
    ctx.globalAlpha = 1;
  }

  // ---------------- まとめ ----------------
  UI.draw = function (ctx, game) {
    if (game.state === 'title') return UI.drawTitle(ctx, game);
    const W = game.world;
    const over = game.state === 'ending' || game.state === 'stageclear';
    if (W && !over) {
      drawWorldUI(ctx, W);
      drawBossBar(ctx, W);
    }
    if (!over && !(G.padLayout && G.padLayout.portrait)) drawHUD(ctx, game);
    drawAreaBanner(ctx, game);
    if (game.state === 'intro') drawIntro(ctx, game);
    if (game.state === 'dead') drawDeath(ctx, game);
    if (game.state === 'pause') drawPause(ctx, game);
    if (game.state === 'ending') drawEnding(ctx, game);
    if (game.state === 'stageclear') drawStageClear(ctx, game);
    if (W && W.def.drawUI) W.def.drawUI(ctx, W, UI);
  };
})();
