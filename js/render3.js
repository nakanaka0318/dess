// 6面の描画：テーマ・背景・容疑者・小物・にせの画面・推理メモ
(function () {
  'use strict';
  const G = globalThis.G;
  const R = G.Render;
  const SW = G.W,
    SH = G.H;
  const hash2 = R.hash2;
  const circle = R.circle;

  Object.assign(G.THEMES, {
    galaxy: {
      solid: { base: '#2a2458', dk: '#1a1640', lt: '#3e3680', edge: '#0c0a22', top: '#7a6cff', topLt: '#c8bcff', topDk: '#4a3cc0' },
      alt: { base: '#3a2a6a', dk: '#22184a', lt: '#5a4a9a' },
      plat: { base: '#9a8cff', dk: '#5a4ac0', lt: '#d8d0ff' },
    },
    station: {
      solid: { base: '#5a6070', dk: '#3a3e4a', lt: '#7a8090', edge: '#1e2028', top: '#ffcf4a', topLt: '#fff0a0', topDk: '#2a2a30' },
      alt: { base: '#3a4a5a', dk: '#22303e', lt: '#5a7088' },
      plat: { base: '#9aa4b8', dk: '#5a6478', lt: '#d0d8e8' },
    },
  });

  // ---------------- 背景 ----------------
  const cache = new Map();
  function staticBg(kind, fn) {
    let c = cache.get(kind);
    if (!c) {
      c = G.mkCanvas(SW, SH);
      fn(c.getContext('2d'));
      cache.set(kind, c);
    }
    return c;
  }
  function grad(x, stops) {
    const g = x.createLinearGradient(0, 0, 0, SH);
    stops.forEach((s, i) => g.addColorStop(i / (stops.length - 1), s));
    x.fillStyle = g;
    x.fillRect(0, 0, SW, SH);
  }
  function stars(x, n, seed) {
    for (let i = 0; i < n; i++) {
      x.fillStyle = hash2(i, 5, seed) > 0.85 ? '#ffffff' : hash2(i, 6, seed) > 0.5 ? '#9aa0e0' : '#e0a0ff';
      x.fillRect(Math.round(hash2(i, 1, seed) * SW), Math.round(hash2(i, 2, seed) * SH), 1, 1);
    }
  }
  G.BGS.nebula = function (ctx, W, t) {
    ctx.drawImage(
      staticBg('nebula', (x) => {
        grad(x, ['#05031a', '#140a3a', '#2a0e40']);
        // 星雲
        for (let i = 0; i < 40; i++) {
          const cx = hash2(i, 1, 61) * SW,
            cy = hash2(i, 2, 61) * SH * 0.8,
            r = 20 + hash2(i, 3, 61) * 50;
          const g = x.createRadialGradient(cx, cy, 0, cx, cy, r);
          const col = hash2(i, 4, 61) > 0.5 ? '255,90,200' : '90,140,255';
          g.addColorStop(0, `rgba(${col},0.10)`);
          g.addColorStop(1, `rgba(${col},0)`);
          x.fillStyle = g;
          x.fillRect(cx - r, cy - r, r * 2, r * 2);
        }
        stars(x, 160, 62);
      }),
      0,
      0
    );
    // またたく星（どれかは本物かもしれない）
    for (let i = 0; i < 18; i++) {
      if ((t + i * 37) % 120 < 60) continue;
      ctx.fillStyle = '#ffffff';
      const sx = Math.round(hash2(i, 7, 63) * SW),
        sy = Math.round(hash2(i, 8, 63) * SH * 0.7);
      ctx.fillRect(sx - 1, sy, 3, 1);
      ctx.fillRect(sx, sy - 1, 1, 3);
    }
  };
  G.BGS.station = function (ctx, W, t) {
    ctx.drawImage(
      staticBg('station', (x) => {
        grad(x, ['#1a1e28', '#222836', '#1a1e28']);
        // 壁のパネル
        x.fillStyle = '#262c3a';
        for (let yy = 0; yy < SH; yy += 40) for (let xx = 0; xx < SW; xx += 60) x.fillRect(xx + 2, yy + 2, 56, 36);
        x.fillStyle = '#2e3646';
        for (let yy = 0; yy < SH; yy += 40) for (let xx = 0; xx < SW; xx += 60) x.fillRect(xx + 2, yy + 2, 56, 2);
        // 窓（宇宙）
        for (const wx of [90, 250, 410]) {
          x.fillStyle = '#0a0c14';
          x.fillRect(wx - 34, 56, 68, 44);
          x.fillStyle = '#05031a';
          x.fillRect(wx - 30, 60, 60, 36);
          for (let i = 0; i < 14; i++) {
            x.fillStyle = hash2(i, wx, 71) > 0.7 ? '#ffffff' : '#7a80c0';
            x.fillRect(wx - 30 + Math.round(hash2(i, 1, wx) * 60), 60 + Math.round(hash2(i, 2, wx) * 36), 1, 1);
          }
        }
        // 地球（真ん中の窓）
        x.fillStyle = '#2a5ac8';
        x.beginPath();
        x.arc(262, 92, 16, Math.PI, Math.PI * 2);
        x.fill();
        x.fillStyle = '#3aa04a';
        x.fillRect(252, 82, 8, 4);
      }),
      0,
      0
    );
    // 警告灯
    if (Math.floor(t / 40) % 2) {
      ctx.fillStyle = 'rgba(255,60,60,0.5)';
      ctx.fillRect(14, 30, 6, 4);
      ctx.fillRect(460, 30, 6, 4);
    }
  };
  G.BGS.deduce = function (ctx, W, t) {
    ctx.drawImage(
      staticBg('deduce', (x) => {
        grad(x, ['#0e0a1e', '#1a1030', '#120c22']);
        stars(x, 60, 81);
        // スポットライト
        for (const sx of [150, 230, 310, 390]) {
          const g = x.createLinearGradient(sx, 0, sx, 240);
          g.addColorStop(0, 'rgba(255,240,180,0.0)');
          g.addColorStop(1, 'rgba(255,240,180,0.10)');
          x.fillStyle = g;
          x.beginPath();
          x.moveTo(sx - 6, 0);
          x.lineTo(sx + 6, 0);
          x.lineTo(sx + 30, 240);
          x.lineTo(sx - 30, 240);
          x.fill();
        }
      }),
      0,
      0
    );
  };

  // ---------------- 装飾 ----------------
  Object.assign(G.DECOR, {
    fallensign(ctx, d, x, y) {
      ctx.fillStyle = '#3a200c';
      ctx.fillRect(x, y + 2, 40, 10);
      ctx.fillStyle = '#c08850';
      ctx.fillRect(x + 1, y + 3, 38, 8);
      ctx.fillStyle = '#4a2c14';
      ctx.fillRect(x + 40, y + 6, 18, 3);
    },
    monitor(ctx, d, x, y, t) {
      ctx.fillStyle = '#1a1e28';
      ctx.fillRect(x - 4, y - 4, 108, 40);
      ctx.fillStyle = '#062010';
      ctx.fillRect(x, y, 100, 32);
      ctx.fillStyle = 'rgba(80,255,140,0.08)';
      for (let i = 0; i < 32; i += 2) ctx.fillRect(x, y + i, 100, 1);
      ctx.fillStyle = '#5aff9a';
      ctx.font = '8px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('死因予報', x + 50, y + 11);
      if (Math.floor(t / 20) % 4) ctx.fillText(d.o.text || '', x + 50, y + 24);
      ctx.textAlign = 'left';
    },
  });

  // ---------------- 足場・当たり ----------------
  const baseBlock = R.drawBlock;
  R.drawBlock = function (ctx, b, x, y) {
    if (b.style === 'ring') {
      ctx.fillStyle = 'rgba(230,200,140,0.35)';
      ctx.fillRect(x - 2, y - 1, b.w + 4, 8);
      ctx.fillStyle = '#e8c890';
      ctx.fillRect(x, y, b.w, 3);
      ctx.fillStyle = '#b08a50';
      ctx.fillRect(x, y + 3, b.w, 2);
      ctx.fillStyle = '#fff0c8';
      for (let i = 2; i < b.w; i += 7) ctx.fillRect(x + i, y + 1, 2, 1);
      return;
    }
    if (b.style === 'lift') {
      ctx.fillStyle = '#3a3e4a';
      ctx.fillRect(x, y, b.w, 8);
      ctx.fillStyle = '#ffcf4a';
      for (let i = 0; i < b.w; i += 8) ctx.fillRect(x + i, y, 4, 2);
      ctx.fillStyle = '#7a8090';
      ctx.fillRect(x + 2, y + 3, b.w - 4, 3);
      ctx.fillStyle = '#9aa4b8';
      ctx.fillRect(x + b.w / 2 - 1, 0, 2, y);
      return;
    }
    baseBlock(ctx, b, x, y);
  };
  const baseHazard = R.drawHazardBox;
  R.drawHazardBox = function (ctx, h) {
    if (h.kind === 'none') return;
    if (h.kind === 'blast') {
      const k = h.t / 10;
      ctx.fillStyle = `rgba(255,200,80,${0.5 * (1 - k)})`;
      ctx.beginPath();
      ctx.ellipse(h.x + h.w / 2, h.y + h.h / 2, h.w / 2, h.h / 2, 0, 0, Math.PI * 2);
      ctx.fill();
      return;
    }
    baseHazard(ctx, h);
  };
  const baseFruit = R.drawFruitKind;
  R.drawFruitKind = function (ctx, f) {
    if (f.kind === 'crescent') {
      const cx = Math.round(f.cx),
        cy = Math.round(f.cy);
      ctx.fillStyle = 'rgba(255,240,160,0.3)';
      circle(ctx, cx, cy, f.r + 2);
      ctx.fillStyle = '#fff2a8';
      circle(ctx, cx, cy, f.r);
      ctx.fillStyle = '#3a2a6a';
      circle(ctx, cx + 2, cy - 1, f.r - 1);
      return true;
    }
    return baseFruit ? baseFruit(ctx, f) : false;
  };

  // ---------------- 容疑者 ----------------
  R.drawNpc = function (ctx, n) {
    const cx = Math.round(n.cx),
      cy = Math.round(n.cy);
    const t = n.W.time;
    if (n.kind === 'moon') {
      const img = G.SPR.moon(n.r, n.face);
      ctx.drawImage(img, cx - img.width / 2, cy - img.height / 2);
    } else if (n.kind === 'sun') {
      R.drawSun(ctx, cx, cy, n.r, n.face, t, false, t * 0.01);
    } else if (n.kind === 'saturn') {
      const r = n.r;
      // 環（うしろ）
      ctx.strokeStyle = '#d8b878';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.ellipse(cx, cy, r * 1.8, r * 0.5, -0.25, Math.PI, Math.PI * 2);
      ctx.stroke();
      ctx.fillStyle = '#c89a5a';
      circle(ctx, cx, cy, r);
      ctx.fillStyle = '#e8c890';
      circle(ctx, cx - r * 0.2, cy - r * 0.25, r * 0.7);
      ctx.fillStyle = '#b07c40';
      ctx.fillRect(cx - r + 2, cy + 2, r * 2 - 4, 2);
      // 環（まえ）
      ctx.beginPath();
      ctx.ellipse(cx, cy, r * 1.8, r * 0.5, -0.25, 0, Math.PI);
      ctx.stroke();
      ctx.lineWidth = 1;
      // 顔
      ctx.fillStyle = '#4a2a10';
      const angry = n.face === 'angry';
      ctx.fillRect(cx - 6, cy - 3 + (angry ? 1 : 0), 3, angry ? 2 : 3);
      ctx.fillRect(cx + 3, cy - 3 + (angry ? 1 : 0), 3, angry ? 2 : 3);
      ctx.fillRect(cx - 3, cy + 5, 6, 1);
    } else if (n.kind === 'alien') {
      const r = n.r;
      ctx.fillStyle = '#5ad87a';
      ctx.beginPath();
      ctx.ellipse(cx, cy - 2, r, r * 0.95, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(cx - 3, cy + r - 4, 6, 8);
      ctx.fillRect(cx - 7, cy + r + 2, 14, 3);
      ctx.fillStyle = '#0a0a14';
      ctx.beginPath();
      ctx.ellipse(cx - 5, cy - 1, 4, 2.6, -0.4, 0, Math.PI * 2);
      ctx.ellipse(cx + 5, cy - 1, 4, 2.6, 0.4, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#5ad87a';
      ctx.fillRect(cx - 1, cy - r - 6, 2, 6);
      ctx.fillStyle = Math.floor(t / 20) % 2 ? '#ff5a7a' : '#ffe96a';
      ctx.fillRect(cx - 2, cy - r - 8, 4, 3);
    }
    if (n.hurtT > 0) {
      ctx.fillStyle = 'rgba(255,255,255,0.4)';
      circle(ctx, cx, cy, n.r);
    }
  };

  R.drawOneUp = function (ctx, o) {
    const cx = Math.round(o.cx),
      cy = Math.round(o.cy);
    const t = o.W.time;
    ctx.fillStyle = `rgba(255,240,120,${0.25 + Math.sin(t * 0.15) * 0.1})`;
    circle(ctx, cx, cy, 9);
    ctx.fillStyle = '#ffd84a';
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + (i / 5) * Math.PI * 2;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * 8, cy + Math.sin(a) * 8);
      ctx.lineTo(cx + Math.cos(a + 0.6) * 3, cy + Math.sin(a + 0.6) * 3);
      ctx.lineTo(cx + Math.cos(a - 0.6) * 3, cy + Math.sin(a - 0.6) * 3);
      ctx.fill();
    }
    circle(ctx, cx, cy, 3);
    G.SPR.tiny(ctx, '1UP', cx - 6, cy - 16, '#9affc0', 1);
  };

  R.drawUfo = function (ctx, u) {
    const x = Math.round(u.x),
      y = Math.round(u.y);
    if (u.state === 'beam') {
      ctx.fillStyle = `rgba(160,255,200,${0.22 + Math.sin(u.t * 0.4) * 0.06})`;
      ctx.beginPath();
      ctx.moveTo(x + 12, y + 14);
      ctx.lineTo(x + 28, y + 14);
      ctx.lineTo(u.zone[1], 240);
      ctx.lineTo(u.zone[0], 240);
      ctx.fill();
    }
    ctx.fillStyle = '#9aa4b8';
    ctx.beginPath();
    ctx.ellipse(x + 20, y + 10, 20, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#c8f0ff';
    ctx.beginPath();
    ctx.ellipse(x + 20, y + 5, 9, 7, 0, Math.PI, Math.PI * 2);
    ctx.fill();
    for (let i = 0; i < 4; i++) {
      ctx.fillStyle = (Math.floor(u.t / 8) + i) % 2 ? '#ffe96a' : '#ff5a7a';
      ctx.fillRect(x + 5 + i * 9, y + 10, 3, 2);
    }
    if (u.state === 'sleep') G.SPR.tiny(ctx, 'Zz', x + 34, y - 6 - (Math.floor(u.t / 20) % 2) * 2, '#c8d4f0', 1);
    if (u.state === 'wake') G.SPR.tiny(ctx, '!', x + 19, y - 10, '#ff5a7a', 2);
  };

  R.drawPlanet = function (ctx, p) {
    const r = p.r * p.scale;
    const cx = Math.round(p.pcx),
      cy = Math.round(p.pcy);
    ctx.fillStyle = '#7a3aa8';
    circle(ctx, cx, cy, r);
    ctx.fillStyle = '#a05ad0';
    circle(ctx, cx - r * 0.2, cy - r * 0.2, r * 0.75);
    ctx.fillStyle = '#5a2a80';
    ctx.fillRect(cx - r, Math.round(cy + r * 0.2), Math.round(r * 2), Math.max(1, Math.round(r * 0.15)));
    ctx.fillRect(cx - r * 0.8, Math.round(cy - r * 0.4), Math.round(r * 1.6), Math.max(1, Math.round(r * 0.1)));
    if (p.scale > 0.6) {
      // 近づくと顔が見える
      ctx.fillStyle = '#2a0a40';
      ctx.fillRect(cx - r * 0.4, cy - r * 0.1, r * 0.15, r * 0.15);
      ctx.fillRect(cx + r * 0.25, cy - r * 0.1, r * 0.15, r * 0.15);
      ctx.fillRect(cx - r * 0.2, cy + r * 0.35, r * 0.4, r * 0.08);
    }
  };

  R.drawVacuum = function (ctx, v) {
    const x = Math.round(v.x),
      y = Math.round(v.y);
    ctx.fillStyle = v.hurtT > 0 ? '#ffffff' : '#c8d0e0';
    ctx.beginPath();
    ctx.ellipse(x + 9, y + 6, 9, 5, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#3a3e4a';
    ctx.fillRect(x + 2, y + 7, 14, 2);
    ctx.fillStyle = Math.floor(v.t / 10) % 2 ? '#5aff9a' : '#2a8a4a';
    ctx.fillRect(x + 8, y + 2, 3, 2);
  };

  R.drawDouble = function (ctx, d) {
    const frame = d.air ? 'jump' : 'idle' + (Math.floor(d.W.time / 32) % 2);
    const img = G.SPR.kid(frame, d.face, 1);
    ctx.drawImage(img, Math.round(d.x) - 3, Math.round(d.y) - 2);
    // よく見ると、目が緑
    ctx.fillStyle = '#5aff7a';
    ctx.fillRect(Math.round(d.x) + (d.face > 0 ? 5 : 1), Math.round(d.y) + 3, 1, 1);
  };

  // ---------------- にせの画面 ----------------
  R.drawFake6 = function (ctx, W, UI) {
    const ov = W.vars.ov;
    if (!ov) return;
    const t = ov.t;
    if (ov.kind === 'gameover') {
      if (ov.reveal && t > ov.reveal) {
        const a = Math.max(0, 1 - (t - ov.reveal) / 30);
        ctx.globalAlpha = a;
        UI.textOut(ctx, '……というのはウソ。', SW / 2, 120, 16, '#ff9aaa', 'center');
        ctx.globalAlpha = 1;
        return;
      }
      const a = Math.min(1, t / 8);
      ctx.fillStyle = `rgba(20,0,8,${0.35 * a})`;
      ctx.fillRect(0, 0, SW, SH);
      const sc = t < 6 ? 10 - t * 0.67 : 6;
      ctx.globalAlpha = a;
      UI.pixText(ctx, 'GAME OVER', SW / 2, 92 - (sc * 5) / 2, Math.round(sc), '#ff2a48', '#2a0008');
      UI.textOut(ctx, ov.cause || '', SW / 2, 140, 12, '#ffffff', 'center');
      if (t > 10) {
        ctx.globalAlpha = Math.floor(t / 25) % 2 === 0 ? 1 : 0.55;
        UI.textOut(ctx, G.isTouch ? 'タップ / ジャンプでリトライ' : 'ジャンプ / R でリトライ', SW / 2, 174, 10, '#ffcf4a', 'center');
      }
      ctx.globalAlpha = 1;
    } else if (ov.kind === 'pause') {
      ctx.fillStyle = 'rgba(6,4,20,0.55)';
      ctx.fillRect(0, 0, SW, SH);
      UI.pixText(ctx, 'PAUSE', SW / 2, 70, 5, '#ffe9a8', '#2a1a00');
      UI.textOut(ctx, '▶ つづける', SW / 2, 130, 12, '#ffcf4a', 'center');
      UI.textOut(ctx, '  タイトルへ', SW / 2, 152, 12, '#c8c0e8', 'center');
    } else if (ov.kind === 'clear') {
      const a = Math.min(1, t / 10);
      ctx.fillStyle = `rgba(6,4,20,${0.5 * a})`;
      ctx.fillRect(0, 0, SW, SH);
      ctx.globalAlpha = a;
      UI.pixText(ctx, 'STAGE 6 CLEAR!', SW / 2, 74, 4, '#ffe9a8', '#2a1a00');
      UI.textOut(ctx, 'おめでとう！ 事件は解決した！', SW / 2, 120, 12, '#ffffff', 'center');
      if (t > 60) UI.textOut(ctx, '（してない）', SW / 2, 142, 10, '#ff9aaa', 'center');
      ctx.globalAlpha = 1;
    } else if (ov.kind === 'hint') {
      ctx.fillStyle = 'rgba(10,6,18,0.7)';
      ctx.fillRect(20, 228, SW - 40, 24);
      UI.textOut(ctx, ov.text || '', SW / 2, 240, 9, '#9affc0', 'center', false);
    }
  };

  R.drawCountdown = function (ctx, n, UI) {
    ctx.fillStyle = 'rgba(255,40,60,0.12)';
    ctx.fillRect(0, 0, SW, SH);
    UI.textOut(ctx, '自爆まで', SW / 2, 54, 12, '#ff9aaa', 'center');
    UI.textOut(ctx, String(n), SW / 2, 82, 28, '#ff3a5a', 'center');
  };

  // 推理メモ（推理の間の壁）
  R.drawCaseBoard = function (ctx, W, UI) {
    const x = 70,
      y = 14,
      w = 340,
      h = 118;
    ctx.fillStyle = 'rgba(16,10,30,0.85)';
    ctx.fillRect(x, y, w, h);
    ctx.strokeStyle = 'rgba(255,207,74,0.6)';
    ctx.strokeRect(x + 0.5, y + 0.5, w - 1, h - 1);
    UI.textOut(ctx, '【推理メモ】連続プレイヤー殺人事件', SW / 2, y + 11, 10, '#ffcf4a', 'center', false);
    UI.textOut(ctx, 'ルール：' + G.CASE_RULE, x + 8, y + 27, 8, '#9ae8ff', 'left', false);
    G.TESTIMONY.forEach((s, i) => UI.textOut(ctx, `${s.name}「${s.text}」`, x + 8, y + 43 + i * 13, 9, '#ffffff', 'left', false));
    const n = (W.game && W.game.flags.dm) || 0;
    const last = n > 0 ? G.dyingFor(Math.min(n, 5) - 1) : '（まだない）';
    UI.textOut(ctx, `ダイイングメッセージ（${n}件）：${last}`, x + 8, y + 99, 8, '#ff9aaa', 'left', false);
    UI.textOut(ctx, '※三日月（☾）の署名の看板は、すべてウソだった。', x + 8, y + 111, 8, '#c8c0e8', 'left', false);
  };

  // 月のウソの予告（ここだけが安全）と、月落としの影
  R.drawLieWarn = function (ctx, W) {
    const fw = W.vars.fakeWarn;
    if (fw) {
      const on = Math.floor(W.time / 4) % 2;
      ctx.fillStyle = on ? 'rgba(255,60,90,0.28)' : 'rgba(255,60,90,0.14)';
      ctx.fillRect(fw.x, 0, fw.w, 240);
      ctx.strokeStyle = 'rgba(255,90,120,0.9)';
      ctx.setLineDash([4, 3]);
      ctx.strokeRect(fw.x + 0.5, 0.5, fw.w - 1, 239);
      ctx.setLineDash([]);
      G.UI.textOut(ctx, 'ここを撃つ ☾', fw.x + fw.w / 2, 30, 9, '#ff9aaa', 'center');
    }
    if (W.vars.shadowX != null) {
      ctx.fillStyle = Math.floor(W.time / 3) % 2 ? 'rgba(255,40,80,0.6)' : 'rgba(255,40,80,0.3)';
      ctx.beginPath();
      ctx.ellipse(W.vars.shadowX, 238, 40, 4, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  };

  // =====================================================================
  // 寄り道と追加の仕掛け
  // =====================================================================
  R.drawSecretApple = function (ctx, a) {
    const cx = Math.round(a.cx),
      cy = Math.round(a.cy);
    const t = a.W.time;
    ctx.fillStyle = `rgba(255,220,90,${0.25 + Math.sin(t * 0.12) * 0.1})`;
    circle(ctx, cx, cy, 11);
    ctx.fillStyle = '#c8102e';
    circle(ctx, cx, cy + 1, 6);
    ctx.fillStyle = '#ff4a5a';
    circle(ctx, cx - 1, cy, 4);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(cx - 3, cy - 2, 2, 2);
    ctx.fillStyle = '#5a3418';
    ctx.fillRect(cx, cy - 8, 1, 4);
    ctx.fillStyle = '#3aa04a';
    ctx.fillRect(cx + 1, cy - 8, 4, 2);
    // ひみつの「？」
    if (Math.floor(t / 20) % 2) G.SPR.tiny(ctx, '?', cx + 6, cy - 12, '#ffe96a', 1);
  };
  R.drawChest = function (ctx, c) {
    const x = Math.round(c.x),
      y = Math.round(c.y);
    const open = c.state === 'open';
    const bite = c.state === 'bite';
    const lid = bite ? -4 - (Math.floor(c.t / 4) % 2) * 3 : open ? -8 : 0;
    ctx.fillStyle = c.hurtT > 0 ? '#ffffff' : '#8a5a2a';
    ctx.fillRect(x, y + 6, c.w, c.h - 6);
    ctx.fillStyle = '#c08850';
    ctx.fillRect(x + 1, y + 7, c.w - 2, c.h - 8);
    ctx.fillStyle = '#ffd84a';
    ctx.fillRect(x, y + 9, c.w, 2);
    // ふた
    ctx.fillStyle = '#8a5a2a';
    ctx.fillRect(x, y + lid, c.w, 7);
    ctx.fillStyle = '#a06a34';
    ctx.fillRect(x + 1, y + lid + 1, c.w - 2, 5);
    ctx.fillStyle = '#ffd84a';
    ctx.fillRect(x + c.w / 2 - 1, y + lid + 4, 3, 4);
    if (c.mimic) {
      // よく見ると歯がある
      ctx.fillStyle = '#ffffff';
      for (let i = 2; i < c.w - 2; i += 4) ctx.fillRect(x + i, y + 6, 2, bite ? 3 : 1);
      if (bite) {
        ctx.fillStyle = '#3a0010';
        ctx.fillRect(x + 1, y + lid + 7, c.w - 2, 6 - lid);
        ctx.fillStyle = '#ff3355';
        ctx.fillRect(x + 4, y + 5, 3, 2);
        ctx.fillRect(x + c.w - 7, y + 5, 3, 2);
      }
    }
  };
  R.drawPickup = function (ctx, p) {
    const x = Math.round(p.x),
      y = Math.round(p.y);
    if (p.kind === 'helmet') {
      ctx.fillStyle = '#ffd84a';
      ctx.beginPath();
      ctx.arc(x + 7, y + 10, 7, Math.PI, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(x - 1, y + 9, 16, 3);
      ctx.fillStyle = '#c89a10';
      ctx.fillRect(x + 6, y + 3, 2, 6);
    }
  };
  const baseHazard2 = R.drawHazardBox;
  R.drawHazardBox = function (ctx, h) {
    if (h.kind === 'flowerbite') {
      const x = Math.round(h.x),
        y = Math.round(h.y);
      const k = Math.min(1, h.t / 4);
      const top = y + h.h - h.h * k;
      ctx.fillStyle = '#2e7a2a';
      ctx.fillRect(x + h.w / 2 - 1, top + 10, 3, h.h);
      ctx.fillStyle = '#ff3a6a';
      circle(ctx, x + h.w / 2, top + 6, 9);
      ctx.fillStyle = '#ffffff';
      for (let i = -6; i <= 4; i += 4) ctx.fillRect(x + h.w / 2 + i, top + 6, 2, 3);
      ctx.fillStyle = '#3a0010';
      ctx.fillRect(x + h.w / 2 - 6, top + 4, 12, 2);
      return;
    }
    baseHazard2(ctx, h);
  };

  // ---------------- 2面の寄り道 ----------------
  R.drawQuickSand = function (ctx, q) {
    const x = Math.round(q.x),
      y = Math.round(q.y);
    const t = q.W.time;
    ctx.fillStyle = '#c8944a';
    ctx.fillRect(x, y, q.w, q.h);
    ctx.fillStyle = '#e0b06a';
    for (let i = 0; i < q.w; i += 6) ctx.fillRect(x + i, y + ((i + Math.floor(t / 8)) % 3), 4, 1);
    ctx.fillStyle = '#a87a38';
    for (let i = 0; i < 10; i++) {
      const px = x + ((i * 37 + Math.floor(t * 0.3)) % q.w),
        py = y + 6 + ((i * 13) % (q.h - 8));
      ctx.fillRect(px, py, 2, 1);
    }
    // 渦
    ctx.strokeStyle = 'rgba(120,80,30,0.5)';
    ctx.beginPath();
    ctx.ellipse(x + q.w / 2, y + 4, q.w / 4 + Math.sin(t * 0.05) * 3, 2, 0, 0, Math.PI * 2);
    ctx.stroke();
  };
  R.drawScarab = function (ctx, s) {
    const cx = Math.round(s.cx),
      cy = Math.round(s.cy);
    ctx.fillStyle = s.lit ? '#5ad8ff' : '#2a6a8a';
    ctx.beginPath();
    ctx.ellipse(cx, cy, 5, 6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = s.lit ? '#ffffff' : '#5aa0c0';
    ctx.fillRect(cx - 1, cy - 6, 2, 12);
    ctx.fillRect(cx - 7, cy - 2, 3, 1);
    ctx.fillRect(cx + 4, cy - 2, 3, 1);
    ctx.fillRect(cx - 7, cy + 2, 3, 1);
    ctx.fillRect(cx + 4, cy + 2, 3, 1);
  };
  R.drawTablet = function (ctx, t) {
    const x = Math.round(t.x),
      y = Math.round(t.y);
    ctx.fillStyle = '#6a5a3a';
    ctx.fillRect(x, y, t.w, t.h);
    ctx.fillStyle = '#a89068';
    ctx.fillRect(x + 1, y + 1, t.w - 2, t.h - 2);
    ctx.fillStyle = '#6a5a3a';
    for (let i = 5; i < t.h - 3; i += 4) ctx.fillRect(x + 4, y + i, t.w - 8, 1);
  };
  Object.assign(G.DECOR, {
    sphinx(ctx, d, x, y, t) {
      ctx.fillStyle = '#b08a50';
      ctx.fillRect(x - 60, y + 40, 150, 40);
      ctx.fillRect(x - 10, y, 60, 60);
      ctx.fillStyle = '#d8b070';
      ctx.fillRect(x - 6, y + 4, 52, 40);
      // 頭巾
      ctx.fillStyle = '#4a6ac8';
      ctx.fillRect(x - 14, y - 6, 68, 10);
      ctx.fillRect(x - 14, y + 4, 8, 40);
      ctx.fillRect(x + 46, y + 4, 8, 40);
      ctx.fillStyle = '#ffd84a';
      for (let i = 0; i < 68; i += 8) ctx.fillRect(x - 14 + i, y - 6, 4, 10);
      // 顔
      ctx.fillStyle = '#3a2410';
      ctx.fillRect(x + 6, y + 18, 8, 3);
      ctx.fillRect(x + 26, y + 18, 8, 3);
      ctx.fillRect(x + 12, y + 34, 16, 2);
      const blink = Math.floor(t / 90) % 6 === 0;
      if (!blink) {
        ctx.fillStyle = '#ff3040';
        ctx.fillRect(x + 9, y + 18, 2, 2);
        ctx.fillRect(x + 29, y + 18, 2, 2);
      }
    },
  });
  const baseHazard3 = R.drawHazardBox;
  R.drawHazardBox = function (ctx, h) {
    if (h.kind === 'curse') {
      const x = Math.round(h.x),
        y = Math.round(h.y);
      ctx.fillStyle = '#5a4220';
      ctx.fillRect(x, -10, h.w, y + h.h - 10 + 10);
      ctx.fillStyle = '#e8e0d0';
      for (let i = 0; i < h.w; i += 10) {
        ctx.beginPath();
        ctx.moveTo(x + i, y + h.h - 10);
        ctx.lineTo(x + i + 10, y + h.h - 10);
        ctx.lineTo(x + i + 5, y + h.h);
        ctx.fill();
      }
      return;
    }
    baseHazard3(ctx, h);
  };
})();
