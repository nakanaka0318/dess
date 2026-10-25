// 2面・3面の描画：テーマ・背景・装飾・ボス（ブラウザのみ）
(function () {
  'use strict';
  const G = globalThis.G;
  const R = G.Render;
  const SW = G.W,
    SH = G.H;
  const hash2 = R.hash2;
  const circle = R.circle;

  // ---------------- テーマ ----------------
  Object.assign(G.THEMES, {
    desert: {
      solid: { base: '#d8a85a', dk: '#b07c38', lt: '#f0c878', edge: '#6a4418', top: '#f4d48a', topLt: '#fff0c0', topDk: '#c89048' },
      alt: { base: '#c08a50', dk: '#7a5228', lt: '#e8b878' },
      plat: { base: '#a0703c', dk: '#5a3a18', lt: '#d09a5c' },
    },
    temple: {
      solid: { base: '#8a6a3a', dk: '#5a4220', lt: '#b08a50', edge: '#2e1e0a', top: '#e8c060', topLt: '#fff0a0', topDk: '#a07a28' },
      alt: { base: '#6a3a2a', dk: '#3e2016', lt: '#9a5a3e' },
      plat: { base: '#d8b060', dk: '#8a6a28', lt: '#fff0a0' },
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
  function hills(x, baseY, amp, col, seed, freq) {
    x.fillStyle = col;
    x.beginPath();
    x.moveTo(0, SH);
    for (let i = 0; i <= SW; i += 4) x.lineTo(i, Math.round(baseY + Math.sin(i * freq + seed) * amp + Math.sin(i * freq * 2.3 + seed * 2) * amp * 0.4));
    x.lineTo(SW, SH);
    x.fill();
  }
  // 背景の太陽（顔つき。2面ではずっとこちらを見ている）
  function bgSun(ctx, x, y, r, t, mood) {
    ctx.fillStyle = 'rgba(255,220,120,0.18)';
    circle(ctx, x, y, r + 10 + Math.sin(t * 0.05) * 2);
    ctx.fillStyle = '#ffe070';
    circle(ctx, x, y, r);
    ctx.fillStyle = '#fff4b0';
    circle(ctx, x - r * 0.25, y - r * 0.25, r * 0.5);
    const ink = '#a0501a';
    const P = G.game && G.game.world && G.game.world.player;
    const lx = P ? G.clamp((P.cx - x) / 80, -2, 2) : 0;
    ctx.fillStyle = ink;
    ctx.fillRect(Math.round(x - r * 0.4 + lx), Math.round(y - r * 0.15), 3, 3);
    ctx.fillRect(Math.round(x + r * 0.25 + lx), Math.round(y - r * 0.15), 3, 3);
    if (mood === 'grin') {
      ctx.fillRect(Math.round(x - r * 0.35), Math.round(y + r * 0.3), Math.round(r * 0.7), 2);
      ctx.fillRect(Math.round(x - r * 0.4), Math.round(y + r * 0.22), 2, 2);
      ctx.fillRect(Math.round(x + r * 0.33), Math.round(y + r * 0.22), 2, 2);
    } else ctx.fillRect(Math.round(x - 3), Math.round(y + r * 0.3), 6, 2);
  }
  G.BGS = G.BGS || {};
  G.BGS.desert = function (ctx, W, t) {
    ctx.drawImage(
      staticBg('desert', (x) => {
        grad(x, ['#ff9a4a', '#ffc070', '#ffe2a8']);
        hills(x, 196, 14, '#e8b070', 1.1, 0.011);
        hills(x, 222, 10, '#d89a58', 3.4, 0.017);
      }),
      0,
      0
    );
    bgSun(ctx, 400, 54, 26, t, 'grin');
    // かげろう
    ctx.fillStyle = 'rgba(255,240,200,0.12)';
    for (let i = 0; i < 6; i++) {
      const y = 150 + i * 14;
      const off = Math.sin(t * 0.04 + i) * 8;
      ctx.fillRect(Math.round(off), y, SW, 1);
    }
  };
  G.BGS.temple = function (ctx, W, t) {
    ctx.drawImage(
      staticBg('temple', (x) => {
        grad(x, ['#1c1208', '#2c1c0c', '#3a2610']);
        x.fillStyle = '#34220e';
        for (let yy = 0; yy < SH; yy += 16)
          for (let xx = (yy / 16) % 2 ? -16 : 0; xx < SW; xx += 32) x.fillRect(xx + 1, yy + 1, 30, 14);
        // 太陽のレリーフ
        x.strokeStyle = 'rgba(232,192,96,0.18)';
        x.lineWidth = 2;
        for (const cx of [90, 390]) {
          x.beginPath();
          x.arc(cx, 90, 22, 0, Math.PI * 2);
          x.stroke();
          for (let k = 0; k < 12; k++) {
            const a = (k / 12) * Math.PI * 2;
            x.beginPath();
            x.moveTo(cx + Math.cos(a) * 28, 90 + Math.sin(a) * 28);
            x.lineTo(cx + Math.cos(a) * 36, 90 + Math.sin(a) * 36);
            x.stroke();
          }
        }
      }),
      0,
      0
    );
    // ほこりと光
    for (let i = 0; i < 16; i++) {
      const x = (hash2(i, 9, 4) * SW + Math.sin(t * 0.01 + i) * 10) % SW;
      const y = (hash2(i, 8, 4) * SH + t * 0.12 * (0.5 + hash2(i, 7, 4))) % SH;
      ctx.fillStyle = 'rgba(255,220,140,0.25)';
      ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
    }
  };
  G.BGS.sunset = function (ctx, W, t) {
    ctx.drawImage(
      staticBg('sunset', (x) => {
        grad(x, ['#3a1a4a', '#c04a4a', '#ffa050']);
        hills(x, 214, 10, '#5a2a3a', 2.2, 0.014);
        // 神殿の屋根の柱
        x.fillStyle = '#2a1410';
        for (const px of [30, 120, 360, 450]) x.fillRect(px - 6, 120, 12, 120);
      }),
      0,
      0
    );
  };

  // ---------------- 装飾 ----------------
  G.DECOR = G.DECOR || {};
  Object.assign(G.DECOR, {
    palm(ctx, d, x, y) {
      ctx.fillStyle = '#7a4a24';
      for (let i = 0; i < 60; i += 4) ctx.fillRect(x + 8 + Math.round(Math.sin(i * 0.05) * 3), y + i, 5, 4);
      ctx.fillStyle = '#2f8a3a';
      for (let k = 0; k < 5; k++) {
        const a = -Math.PI / 2 + (k - 2) * 0.7;
        for (let i = 0; i < 18; i++) ctx.fillRect(x + 10 + Math.round(Math.cos(a) * i), y + Math.round(Math.sin(a) * i * 0.5 + i * 0.25 * Math.abs(k - 2)), 3, 2);
      }
    },
    skull(ctx, d, x, y) {
      ctx.fillStyle = '#f0e8d0';
      ctx.fillRect(x + 4, y + 8, 10, 8);
      ctx.fillRect(x + 6, y + 16, 6, 3);
      ctx.fillStyle = '#3a2a18';
      ctx.fillRect(x + 6, y + 11, 2, 2);
      ctx.fillRect(x + 10, y + 11, 2, 2);
      ctx.fillStyle = '#e0d4b0';
      ctx.fillRect(x + 14, y + 16, 8, 2);
    },
    cactusbg(ctx, d, x, y) {
      const s = d.o.small ? 0.6 : 1;
      const h = Math.round(40 * s);
      ctx.fillStyle = '#3a8a3a';
      ctx.fillRect(x + 6, y + 40 - h, Math.round(8 * s) + 2, h);
      ctx.fillRect(x, y + 40 - h * 0.7, 4, h * 0.3);
      ctx.fillRect(x, y + 40 - h * 0.7, 8, 3);
      ctx.fillRect(x + 16, y + 40 - h * 0.85, 4, h * 0.35);
      ctx.fillRect(x + 12, y + 40 - h * 0.55, 8, 3);
      ctx.fillStyle = '#5ab04a';
      ctx.fillRect(x + 8, y + 40 - h, 2, h);
    },
    plate(ctx, d, x, y) {
      ctx.fillStyle = '#5a4220';
      ctx.fillRect(x + 2, y + 17, 16, 3);
      ctx.fillStyle = '#c8a050';
      ctx.fillRect(x + 3, y + 17, 14, 1);
    },
    coffin(ctx, d, x, y) {
      ctx.fillStyle = '#3a2410';
      ctx.fillRect(x + 1, y, 18, 40);
      ctx.fillStyle = '#c89a3a';
      ctx.fillRect(x + 3, y + 2, 14, 36);
      ctx.fillStyle = '#2a4a8a';
      ctx.fillRect(x + 5, y + 6, 10, 4);
      ctx.fillStyle = '#3a2410';
      ctx.fillRect(x + 7, y + 12, 2, 2);
      ctx.fillRect(x + 11, y + 12, 2, 2);
      ctx.fillRect(x + 8, y + 18, 4, 1);
    },
    hiero(ctx, d, x, y) {
      ctx.fillStyle = 'rgba(232,192,96,0.35)';
      const glyphs = ['○', '△', '〜', '☆', '□'];
      for (let i = 0; i < 10; i++) G.SPR.tiny(ctx, i % 2 ? 'I' : 'O', x - 100 + i * 20, y + ((i * 7) % 3) * 4, 'rgba(232,192,96,0.35)');
      void glyphs;
    },
    sunrelief(ctx, d, x, y, t) {
      const W = d.W;
      const still = Math.max(0, (W.vars && W.vars.still) || 0);
      const r = d.o.small ? 10 : 14;
      ctx.fillStyle = '#5a4220';
      circle(ctx, x + 8, y + 8, r + 3);
      ctx.fillStyle = '#c89a3a';
      circle(ctx, x + 8, y + 8, r);
      for (let k = 0; k < 8; k++) {
        const a = (k / 8) * Math.PI * 2;
        ctx.fillRect(Math.round(x + 8 + Math.cos(a) * (r + 5)) - 1, Math.round(y + 8 + Math.sin(a) * (r + 5)) - 1, 3, 3);
      }
      // 止まっているほど目が赤く光る
      const k = Math.min(1, still / 110);
      ctx.fillStyle = k > 0.5 && Math.floor(t / 4) % 2 ? '#ff3a3a' : `rgb(${90 + k * 160},${50},${20})`;
      ctx.fillRect(x + 3, y + 5, 3, 3);
      ctx.fillRect(x + 10, y + 5, 3, 3);
      ctx.fillStyle = '#5a4220';
      ctx.fillRect(x + 4, y + 13, 8, 1);
    },
    vent(ctx, d, x, y) {
      ctx.fillStyle = '#2a1a0a';
      ctx.fillRect(x + 3, y + 16, 14, 4);
      ctx.fillStyle = '#ff7a20';
      ctx.fillRect(x + 5, y + 17, 10, 1);
    },
  });

  // ---------------- 小物 ----------------
  R.drawWalker = function (ctx, w) {
    const x = Math.round(w.x),
      y = Math.round(w.y);
    const wob = w.moving ? (Math.floor(w.W.time / 4) % 2 ? 1 : -1) : 0;
    if (w.kind === 'mummy') {
      ctx.fillStyle = '#d8ccb0';
      ctx.fillRect(x + 2, y + 2, 10, 18);
      ctx.fillRect(x + 1 + wob, y + 8, 12, 3);
      ctx.fillStyle = '#9a8a6a';
      for (let i = 4; i < 20; i += 4) ctx.fillRect(x + 2, y + i, 10, 1);
      ctx.fillStyle = '#ff3a3a';
      ctx.fillRect(x + 4, y + 4, 2, 2);
      ctx.fillRect(x + 8, y + 4, 2, 2);
      return;
    }
    // サボテン
    ctx.fillStyle = w.hurtT > 0 ? '#ffffff' : '#2f7a2f';
    ctx.fillRect(x + 3, y + 1 + wob, 8, 19);
    ctx.fillRect(x, y + 7 + wob, 3, 6);
    ctx.fillRect(x + 11, y + 5 + wob, 3, 7);
    ctx.fillStyle = '#5ab04a';
    ctx.fillRect(x + 5, y + 2 + wob, 2, 17);
    ctx.fillStyle = '#e8f0c0';
    for (let i = 3; i < 19; i += 4) {
      ctx.fillRect(x + 2, y + i + wob, 1, 1);
      ctx.fillRect(x + 11, y + i + 2 + wob, 1, 1);
    }
    // 顔（動いている時はにやり）
    ctx.fillStyle = '#10300f';
    ctx.fillRect(x + 4, y + 6 + wob, 2, 2);
    ctx.fillRect(x + 8, y + 6 + wob, 2, 2);
    if (w.moving) ctx.fillRect(x + 4, y + 11 + wob, 6, 1);
  };

  R.drawFruitKind = function (ctx, f) {
    const cx = Math.round(f.cx),
      cy = Math.round(f.cy);
    if (f.kind === 'needle') {
      const a = Math.atan2(f.vy, f.vx || 0.0001);
      ctx.strokeStyle = '#f4f0c0';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(cx - Math.cos(a) * 5, cy - Math.sin(a) * 5);
      ctx.lineTo(cx + Math.cos(a) * 5, cy + Math.sin(a) * 5);
      ctx.stroke();
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(Math.round(cx + Math.cos(a) * 5) - 1, Math.round(cy + Math.sin(a) * 5) - 1, 2, 2);
      return true;
    }
    if (f.kind === 'gold') {
      ctx.fillStyle = 'rgba(255,230,120,' + (0.25 + Math.sin(f.W.time * 0.1) * 0.1) + ')';
      circle(ctx, cx, cy, f.r + 5);
      ctx.fillStyle = '#c89a10';
      circle(ctx, cx, cy, f.r);
      ctx.fillStyle = '#ffe060';
      circle(ctx, cx - 1, cy - 1, f.r - 2);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(cx - 3, cy - 3, 2, 2);
      ctx.fillStyle = '#4a8a2a';
      ctx.fillRect(cx, cy - f.r - 3, 2, 3);
      return true;
    }
    if (f.kind === 'fire') {
      const fl = Math.sin(f.t * 0.5) * 1;
      ctx.fillStyle = 'rgba(255,120,30,0.3)';
      circle(ctx, cx, cy, f.r + 3 + fl);
      ctx.fillStyle = '#ff5a10';
      circle(ctx, cx, cy, f.r);
      ctx.fillStyle = '#ffd84a';
      circle(ctx, cx, cy, Math.max(1, f.r - 3));
      return true;
    }
    if (f.kind === 'bird') {
      const flap = Math.floor(f.t / 5) % 2;
      const d = f.vx < 0 ? -1 : 1;
      ctx.fillStyle = '#4a2a1a';
      ctx.fillRect(cx - 5, cy - 2, 10, 5);
      ctx.fillRect(cx - 10, cy - (flap ? 5 : -1), 7, 3);
      ctx.fillRect(cx + 3, cy - (flap ? 5 : -1), 7, 3);
      ctx.fillStyle = '#e8d8c0';
      ctx.fillRect(cx + d * 5 - 2, cy - 4, 4, 4);
      ctx.fillStyle = '#ffb030';
      ctx.fillRect(cx + d * 8 - 1, cy - 2, 3, 2);
      return true;
    }
    if (f.kind === 'seed') {
      ctx.fillStyle = '#ff7ab0';
      circle(ctx, cx, cy, f.r);
      ctx.fillStyle = '#ffd0e8';
      ctx.fillRect(cx - 1, cy - 1, 2, 2);
      return true;
    }
    return false;
  };

  R.drawGlow = function (ctx, x, y, r, k) {
    ctx.fillStyle = `rgba(255,170,60,${0.15 + (Math.floor(k / 3) % 2) * 0.25})`;
    circle(ctx, x, y, r);
  };

  R.drawSandstorm = function (ctx, W) {
    const t = W.time;
    const gust = W.windX < 0;
    const n = W.vars.windWarn ? 14 : gust ? (W.windX < -2 ? 90 : 60) : 0;
    for (let i = 0; i < n; i++) {
      const sp = gust ? 6 + hash2(i, 3, 9) * 4 : 2;
      const x = SW - ((hash2(i, 1, 9) * SW + t * sp) % (SW + 40));
      const y = hash2(i, 2, 9) * SH;
      ctx.fillStyle = 'rgba(255,220,150,0.55)';
      ctx.fillRect(Math.round(x), Math.round(y), gust ? 6 : 3, 1);
    }
    if (gust) {
      ctx.fillStyle = `rgba(230,170,90,${W.windX < -2 ? 0.22 : 0.12})`;
      ctx.fillRect(0, 0, SW, SH);
    }
  };

  const baseHazard = R.drawHazardBox;
  R.drawHazardBox = function (ctx, h) {
    if (h.kind === 'chandelier') {
      const x = Math.round(h.x),
        y = Math.round(h.y);
      ctx.fillStyle = '#8a6a20';
      ctx.fillRect(x, y + 6, h.w, 3);
      ctx.fillRect(x + h.w / 2 - 1, y - 2, 2, 8);
      ctx.fillStyle = '#ffd84a';
      for (let i = 0; i < 4; i++) {
        ctx.fillRect(x + 1 + i * 7, y + 2, 2, 4);
        ctx.fillStyle = Math.floor((h.W.time + i * 5) / 6) % 2 ? '#ffffff' : '#ff9a30';
        ctx.fillRect(x + 1 + i * 7, y, 2, 2);
        ctx.fillStyle = '#ffd84a';
      }
      ctx.fillStyle = '#c8a040';
      ctx.fillRect(x + 4, y + 9, h.w - 8, 3);
      ctx.fillRect(x + 9, y + 12, h.w - 18, 2);
      return;
    }
    if (h.kind === 'flame') {
      const x = Math.round(h.x),
        y = Math.round(h.y);
      for (let i = 0; i < 6; i++) {
        const fx = x + 3 + i * 5,
          fh = 24 + Math.sin(h.t * 0.6 + i) * 8;
        ctx.fillStyle = '#ff5a10';
        ctx.fillRect(fx, y + h.h - fh, 5, fh);
        ctx.fillStyle = '#ffd84a';
        ctx.fillRect(fx + 1, y + h.h - fh * 0.6, 3, fh * 0.6);
      }
      return;
    }
    if (h.kind === 'pillar') {
      const x = Math.round(h.x),
        y = Math.round(h.y);
      ctx.fillStyle = '#b07c38';
      ctx.fillRect(x, y + 10, h.w, h.h);
      ctx.fillStyle = '#d8a85a';
      ctx.fillRect(x + 3, y + 10, h.w - 6, h.h);
      const img = G.SPR.spike('u', 10, 'gold');
      for (let i = 0; i < h.w; i += 10) ctx.drawImage(img, x + i, y);
      return;
    }
    return baseHazard(ctx, h);
  };

  const baseRock = R.drawRock;
  R.drawRock = function (ctx, r) {
    if (!r.fire) return baseRock(ctx, r);
    const cx = Math.round(r.cx),
      cy = Math.round(r.cy);
    ctx.fillStyle = 'rgba(255,120,30,0.3)';
    circle(ctx, cx, cy, r.r + 4);
    ctx.fillStyle = '#ff5a10';
    circle(ctx, cx, cy, r.r);
    ctx.fillStyle = '#ffd84a';
    circle(ctx, cx + Math.cos(r.rot) * 3, cy + Math.sin(r.rot) * 3, r.r - 4);
  };

  // 太陽（沈んだあと転がってくる太陽は Moon エンティティを流用）
  const baseMoonDraw = G.Moon.prototype.draw;
  G.Moon.prototype.draw = function (ctx) {
    if (!this.sunny) return baseMoonDraw.call(this, ctx);
    drawSun(ctx, this.cx, this.cy, this.r, this.face, this.W.time, false, this.x * 0.05);
  };

  function drawSun(ctx, cx, cy, r, face, t, dark, spin) {
    cx = Math.round(cx);
    cy = Math.round(cy);
    const rays = 12;
    ctx.fillStyle = dark ? 'rgba(40,20,60,0.9)' : '#ffb020';
    for (let i = 0; i < rays; i++) {
      const a = spin + (i / rays) * Math.PI * 2;
      const l = r + 8 + Math.sin(t * 0.2 + i) * 2;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * l, cy + Math.sin(a) * l);
      ctx.lineTo(cx + Math.cos(a + 0.18) * (r - 2), cy + Math.sin(a + 0.18) * (r - 2));
      ctx.lineTo(cx + Math.cos(a - 0.18) * (r - 2), cy + Math.sin(a - 0.18) * (r - 2));
      ctx.fill();
    }
    if (dark) {
      ctx.fillStyle = '#ffd84a';
      circle(ctx, cx, cy, r + 1);
      ctx.fillStyle = '#100818';
      circle(ctx, cx, cy, r - 2);
    } else {
      ctx.fillStyle = '#ff8a10';
      circle(ctx, cx, cy, r);
      ctx.fillStyle = '#ffc030';
      circle(ctx, cx, cy, r - 3);
      ctx.fillStyle = '#ffe680';
      circle(ctx, cx - r * 0.25, cy - r * 0.25, r * 0.45);
    }
    // 顔
    const k = r / 24;
    const px = (fx, fy, w, h, col) => {
      ctx.fillStyle = col;
      ctx.fillRect(Math.round(cx + fx * k), Math.round(cy + fy * k), Math.max(1, Math.round(w * k)), Math.max(1, Math.round(h * k)));
    };
    const ink = dark ? '#ffd84a' : '#7a2a00';
    if (face === 'calm') {
      px(-11, -4, 6, 2, ink);
      px(5, -4, 6, 2, ink);
      px(-5, 7, 10, 2, ink);
    } else if (face === 'hurt') {
      px(-11, -6, 6, 2, ink);
      px(-9, -8, 2, 6, ink);
      px(5, -6, 6, 2, ink);
      px(7, -8, 2, 6, ink);
      px(-4, 6, 8, 5, ink);
    } else {
      // grin / angry / rage
      px(-12, -8, 3, 2, ink);
      px(-9, -6, 3, 2, ink);
      px(-11, -5, 5, 4, ink);
      px(9, -8, 3, 2, ink);
      px(6, -6, 3, 2, ink);
      px(6, -5, 5, 4, ink);
      const eye = face === 'rage' ? '#ffffff' : '#ff3040';
      px(-9, -4, 2, 2, eye);
      px(7, -4, 2, 2, eye);
      px(-12, 4, 24, 2, ink);
      px(-10, 6, 20, 2, ink);
      px(-7, 8, 14, 2, ink);
      for (let i = -9; i <= 7; i += 4) px(i, 4, 2, 2, '#fff6d0');
    }
  }
  R.drawSun = drawSun;

  R.drawSunBoss = function (ctx, s) {
    const cx = s.cx + (s.shakeX || 0),
      cy = s.cy;
    const t = s.W.time;
    if (!s.dark) {
      ctx.fillStyle = `rgba(255,170,60,${0.12 + Math.sin(t * 0.08) * 0.04})`;
      circle(ctx, cx, cy, s.r + 18);
    }
    drawSun(ctx, cx, cy, s.r, s.face, t, s.dark, s.spin);
    if (s.hurtT > 0) {
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      circle(ctx, cx, cy, s.r - 1);
    }
    if (!s.vulnerable && s.showBar && !s.defeated) {
      ctx.strokeStyle = 'rgba(255,240,200,0.7)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(Math.round(cx), Math.round(cy), s.r + 4 + Math.sin(t * 0.3), 0, Math.PI * 2);
      ctx.stroke();
    }
  };

  R.drawCactusBoss = function (ctx, c) {
    const s = c.scale;
    const bottom = Math.round(c.y + c.h);
    const cx = Math.round(c.cx + (c.shakeX || 0));
    const h = Math.round(c.h * s),
      w = Math.round(c.w * s);
    ctx.save();
    if (c.tilt) {
      ctx.translate(cx, bottom);
      ctx.rotate((c.tilt * Math.PI) / 2);
      ctx.translate(-cx, -bottom);
    }
    const top = bottom - h;
    const green = c.hurtT > 0 ? '#ffffff' : '#2f7a2f';
    // 腕
    const armY = c.arm > 0 ? -0.15 : c.arm < 0 ? 0.25 : 0.05;
    ctx.fillStyle = green;
    const ah = Math.round(22 * s);
    for (const d of [-1, 1]) {
      const ax = cx + d * Math.round(w / 2 + 6 * s);
      const ay = Math.round(top + h * (0.35 + armY));
      ctx.fillRect(Math.min(cx + d * Math.round(w / 2), ax), ay + Math.round(ah * 0.6), Math.round(8 * s) + 2, Math.round(6 * s));
      ctx.fillRect(ax - Math.round(4 * s), ay - (c.arm > 0 ? ah : 0), Math.round(8 * s), ah);
    }
    // 胴
    ctx.fillRect(cx - Math.round(w / 2), top + Math.round(6 * s), w, h - Math.round(6 * s));
    ctx.fillRect(cx - Math.round(w / 2) + 3, top, w - 6, Math.round(8 * s));
    ctx.fillStyle = '#5ab04a';
    for (let i = -1; i <= 1; i++) ctx.fillRect(cx + Math.round(i * w * 0.28) - 1, top + 4, 2, h - 6);
    ctx.fillStyle = '#f0f0c8';
    for (let i = 0; i < 14; i++) ctx.fillRect(cx - Math.round(w / 2) - 1 + ((i * 7) % (w + 2)), top + 6 + ((i * 13) % Math.max(4, h - 10)), 2, 1);
    // 顔
    if (s > 0.6) {
      ctx.fillStyle = '#10300f';
      ctx.fillRect(cx - 10, top + 16, 6, 6);
      ctx.fillRect(cx + 4, top + 16, 6, 6);
      ctx.fillStyle = c.vulnerable ? '#ff3040' : '#ffffff';
      ctx.fillRect(cx - 8, top + 18, 2, 2);
      ctx.fillRect(cx + 6, top + 18, 2, 2);
      ctx.fillStyle = '#10300f';
      ctx.fillRect(cx - 12, top + 12, 8, 2);
      ctx.fillRect(cx + 4, top + 12, 8, 2);
      ctx.fillRect(cx - 7, top + 28, 14, 3);
      // ひげ
      ctx.fillStyle = '#f0e8d0';
      ctx.fillRect(cx - 9, top + 25, 6, 2);
      ctx.fillRect(cx + 3, top + 25, 6, 2);
    }
    // 花
    ctx.fillStyle = c.bloom ? '#ff4a8a' : '#ff9ac0';
    const fr = Math.round((c.bloom ? 8 : 4) * s) + 1;
    for (let k = 0; k < 5; k++) {
      const a = (k / 5) * Math.PI * 2 + c.W.time * 0.02;
      circle(ctx, cx + Math.cos(a) * fr, top - 2 + Math.sin(a) * fr * 0.6, Math.max(1, fr * 0.6));
    }
    ctx.fillStyle = '#ffe060';
    circle(ctx, cx, top - 2, Math.max(1, fr * 0.5));
    ctx.restore();
  };
  // =====================================================================
  // 3面
  // =====================================================================
  Object.assign(G.THEMES, {
    void: {
      solid: { base: '#3a2a5a', dk: '#22183a', lt: '#5a4a8a', edge: '#0c0818', top: '#c070ff', topLt: '#f0c0ff', topDk: '#7a3ab0' },
      alt: { base: '#1a4a5a', dk: '#0c2a36', lt: '#3ab0c8' },
      plat: { base: '#e0d0ff', dk: '#8a7ab0', lt: '#ffffff' },
    },
    garden: {
      solid: { base: '#5a3a24', dk: '#3e2616', lt: '#7a5232', edge: '#1e120a', top: '#4cb43c', topLt: '#9ae86a', topDk: '#2e7a2a' },
      alt: { base: '#3a7a3a', dk: '#22562a', lt: '#5aa04a' },
      plat: { base: '#a87a4a', dk: '#5a3a1a', lt: '#d8a870' },
    },
  });

  G.BGS.void = function (ctx, W, t) {
    ctx.drawImage(
      staticBg('void', (x) => {
        grad(x, ['#08031a', '#140830', '#20103e']);
      }),
      0,
      0
    );
    // 動くグリッドと星
    ctx.strokeStyle = 'rgba(192,112,255,0.10)';
    ctx.lineWidth = 1;
    const off = (t * 0.3) % 40;
    for (let x = -40 + off; x < SW; x += 40) {
      ctx.beginPath();
      ctx.moveTo(Math.round(x) + 0.5, 0);
      ctx.lineTo(Math.round(x) + 0.5, SH);
      ctx.stroke();
    }
    for (let y = -40 + off; y < SH; y += 40) {
      ctx.beginPath();
      ctx.moveTo(0, Math.round(y) + 0.5);
      ctx.lineTo(SW, Math.round(y) + 0.5);
      ctx.stroke();
    }
    for (let i = 0; i < 70; i++) {
      const x = hash2(i, 1, 21) * SW,
        y = (hash2(i, 2, 21) * SH - t * 0.1 * (0.3 + hash2(i, 3, 21)) + SH * 4) % SH;
      const tw = Math.sin(t * 0.06 + i);
      ctx.fillStyle = tw > 0.4 ? '#ffffff' : '#a090e0';
      ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
    }
  };
  G.BGS.garden = function (ctx, W, t) {
    ctx.drawImage(
      staticBg('garden', (x) => {
        grad(x, ['#0c1630', '#1a2c4a', '#2a4a5a']);
        for (let i = 0; i < 60; i++) {
          x.fillStyle = hash2(i, 5, 31) > 0.7 ? '#ffffff' : '#8aa0d0';
          x.fillRect(Math.round(hash2(i, 1, 31) * SW), Math.round(hash2(i, 2, 31) * 140), 1, 1);
        }
        hills(x, 200, 12, '#1a3a2a', 2.1, 0.013);
        // 遠くの大きなリンゴの木
        x.fillStyle = '#12301e';
        x.fillRect(236, 90, 10, 120);
        for (const [cx, cy, r] of [[240, 80, 46], [200, 96, 30], [282, 96, 30]]) {
          x.beginPath();
          x.arc(cx, cy, r, 0, Math.PI * 2);
          x.fill();
        }
        x.fillStyle = '#5a1a2a';
        for (let i = 0; i < 14; i++) x.fillRect(196 + Math.round(hash2(i, 7, 31) * 90), 50 + Math.round(hash2(i, 8, 31) * 70), 3, 3);
        hills(x, 222, 8, '#14301e', 4.2, 0.02);
      }),
      0,
      0
    );
    // ほたる
    for (let i = 0; i < 10; i++) {
      const x = (hash2(i, 9, 33) * SW + Math.sin(t * 0.02 + i) * 20 + SW) % SW;
      const y = 120 + hash2(i, 8, 33) * 100 + Math.cos(t * 0.03 + i * 2) * 10;
      ctx.fillStyle = `rgba(220,255,140,${0.3 + Math.sin(t * 0.1 + i) * 0.3})`;
      ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
    }
  };

  Object.assign(G.DECOR, {
    hedge(ctx, d, x, y) {
      ctx.fillStyle = '#1f5a2a';
      ctx.fillRect(x, y + 6, 24, 14);
      ctx.fillStyle = '#2f7a3a';
      for (let i = 0; i < 4; i++) circle(ctx, x + 4 + i * 6, y + 7, 5);
    },
    appletree(ctx, d, x, y) {
      const h = d.o.h || 140;
      ctx.fillStyle = '#5a3418';
      ctx.fillRect(x + 24, y + 50, 12, h - 50);
      ctx.fillStyle = '#7a4a24';
      ctx.fillRect(x + 26, y + 50, 3, h - 50);
      const blobs = [[30, 30, 28], [10, 40, 18], [50, 40, 18], [30, 12, 18]];
      ctx.fillStyle = '#1f6a2a';
      for (const b of blobs) circle(ctx, x + b[0], y + b[1] + 1, b[2]);
      ctx.fillStyle = '#2f9a3a';
      for (const b of blobs) circle(ctx, x + b[0], y + b[1], b[2] - 1);
      ctx.fillStyle = '#c8102e';
      for (let i = 0; i < 6; i++) circle(ctx, x + 8 + ((i * 17) % 46), y + 18 + ((i * 11) % 30), 2);
    },
    branch(ctx, d, x, y) {
      ctx.fillStyle = '#5a3418';
      ctx.fillRect(x, y + 16, 80, 5);
      ctx.fillRect(x + 38, y + 16, 4, 10);
      ctx.fillStyle = '#2f9a3a';
      for (let i = 0; i < 5; i++) circle(ctx, x + 8 + i * 16, y + 14, 6);
    },
  });

  const baseFruitKind = R.drawFruitKind;
  R.drawFruitKind = function (ctx, f) {
    if (baseFruitKind(ctx, f)) return true;
    const cx = Math.round(f.cx),
      cy = Math.round(f.cy);
    if (f.kind === 'dark') {
      ctx.fillStyle = '#100818';
      circle(ctx, cx, cy, f.r);
      ctx.fillStyle = '#3a2a5a';
      ctx.fillRect(cx - 2, cy - 2, 2, 2);
      ctx.fillStyle = '#ff3a5a';
      ctx.fillRect(cx - 2, cy, 1, 1);
      ctx.fillRect(cx + 1, cy, 1, 1);
      return true;
    }
    if (f.kind === 'leaf') {
      ctx.fillStyle = '#5ac44a';
      ctx.fillRect(cx - 4, cy - 1, 8, 3);
      ctx.fillRect(cx - 2, cy - 2, 4, 5);
      ctx.fillStyle = '#2e7a2a';
      ctx.fillRect(cx - 3, cy, 6, 1);
      return true;
    }
    if (f.kind === 'spark') {
      ctx.fillStyle = Math.floor(f.t / 3) % 2 ? '#ffd84a' : '#ff6a8a';
      ctx.fillRect(cx - 2, cy - 2, 4, 4);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(cx - 1, cy - 1, 2, 2);
      return true;
    }
    return false;
  };

  const baseBlock = R.drawBlock;
  R.drawBlock = function (ctx, b, x, y) {
    if (b.style === 'log') {
      ctx.fillStyle = '#4a2c14';
      ctx.fillRect(x, y, b.w, b.h);
      ctx.fillStyle = '#8a5a2a';
      ctx.fillRect(x, y + 1, b.w, b.h - 3);
      ctx.fillStyle = '#a87a4a';
      for (let i = 6; i < b.w; i += 22) ctx.fillRect(x + i, y + 2, 8, 1);
      return;
    }
    return baseBlock(ctx, b, x, y);
  };

  R.drawGravNote = function (ctx, W) {
    if (Math.floor(W.time / 8) % 2) return;
    G.SPR.tiny(ctx, 'G×1.0', 8, 30, '#ff9af0', 2);
  };
  R.drawReverseNote = function (ctx, W) {
    ctx.fillStyle = 'rgba(255,154,240,0.07)';
    ctx.fillRect(0, 0, SW, SH);
    G.SPR.tiny(ctx, '<>?', 8, 30, '#ff9af0', 2);
  };
  // 暗闇：プレイヤーの周りだけ見える
  R.drawDarkness = function (ctx, W, a) {
    const P = W.player;
    const cx = P.cx,
      cy = P.cy;
    ctx.save();
    ctx.fillStyle = `rgba(4,2,12,${a})`;
    ctx.beginPath();
    ctx.rect(0, 0, SW, SH);
    ctx.arc(cx, cy, 38, 0, Math.PI * 2, true);
    ctx.fill();
    ctx.fillStyle = `rgba(4,2,12,${a * 0.5})`;
    ctx.beginPath();
    ctx.arc(cx, cy, 38, 0, Math.PI * 2);
    ctx.arc(cx, cy, 26, 0, Math.PI * 2, true);
    ctx.fill();
    ctx.restore();
  };

  R.drawBlackHole = function (ctx, h) {
    const cx = Math.round(h.cx + (h.shakeX || 0)),
      cy = Math.round(h.cy);
    const r = h.r * h.size;
    if (h.white) {
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      circle(ctx, cx, cy, 30 + Math.sin(h.W.time * 0.3) * 4);
      ctx.fillStyle = '#ffffff';
      circle(ctx, cx, cy, 16);
      return;
    }
    // 降着円盤
    for (let k = 0; k < 3; k++) {
      ctx.strokeStyle = ['rgba(192,112,255,0.55)', 'rgba(255,154,240,0.45)', 'rgba(255,216,120,0.35)'][k];
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.ellipse(cx, cy, r * (1.9 + k * 0.45), r * (0.55 + k * 0.12), h.spin * (k % 2 ? -0.5 : 0.3), 0, Math.PI * 2);
      ctx.stroke();
    }
    for (let i = 0; i < 10; i++) {
      const a = h.spin * 2 + (i / 10) * Math.PI * 2;
      const d = r * (1.3 + ((i * 7) % 5) * 0.15);
      ctx.fillStyle = i % 2 ? '#f0c0ff' : '#ffd878';
      ctx.fillRect(Math.round(cx + Math.cos(a) * d), Math.round(cy + Math.sin(a) * d * 0.5), 2, 2);
    }
    ctx.fillStyle = h.hurtT > 0 ? '#ffffff' : '#000000';
    circle(ctx, cx, cy, r);
    ctx.strokeStyle = '#c070ff';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(cx, cy, r + 1, 0, Math.PI * 2);
    ctx.stroke();
    if (h.size > 0.6) {
      ctx.fillStyle = '#ff3a5a';
      ctx.fillRect(cx - 7, cy - 3, 3, 2);
      ctx.fillRect(cx + 4, cy - 3, 3, 2);
      ctx.fillStyle = '#c070ff';
      ctx.fillRect(cx - 5, cy + 5, 10, 1);
    }
  };

  R.drawBigTree = function (ctx, tr) {
    const bx = Math.round(tr.cx),
      by = Math.round(tr.y + tr.h);
    ctx.save();
    ctx.translate(bx, by);
    ctx.rotate(tr.rot);
    ctx.fillStyle = tr.hurtT > 0 ? '#ffffff' : '#5a3418';
    ctx.fillRect(-6, -180, 12, 180);
    ctx.fillStyle = '#7a4a24';
    ctx.fillRect(-4, -180, 3, 180);
    const blobs = [[0, -186, 22], [-16, -172, 14], [16, -172, 14], [0, -206, 14]];
    ctx.fillStyle = '#1f6a2a';
    for (const b of blobs) circle(ctx, b[0], b[1] + 1, b[2]);
    ctx.fillStyle = '#2f9a3a';
    for (const b of blobs) circle(ctx, b[0], b[1], b[2] - 1);
    ctx.fillStyle = '#c8102e';
    for (let i = 0; i < 5; i++) circle(ctx, -14 + ((i * 13) % 30), -196 + ((i * 9) % 26), 2);
    ctx.restore();
  };

  R.drawTreeBoss = function (ctx, t) {
    const cx = Math.round(t.cx + (t.shakeX || 0));
    const base = Math.round(t.y + t.h);
    const sway = Math.sin(t.sway) * 3;
    ctx.save();
    if (t.rot) {
      ctx.translate(cx, base);
      ctx.rotate(t.rot);
      ctx.translate(-cx, -base);
    }
    // 根
    ctx.fillStyle = '#4a2c14';
    ctx.fillRect(cx - 34, base - 8, 68, 8);
    ctx.fillRect(cx - 44, base - 4, 14, 4);
    ctx.fillRect(cx + 30, base - 4, 14, 4);
    // 幹
    const top = t.y + 70;
    ctx.fillStyle = t.hurtT > 0 ? '#ffffff' : '#6a4020';
    ctx.fillRect(cx - 20, top, 40, base - top);
    ctx.fillStyle = '#8a5a2a';
    ctx.fillRect(cx - 14, top, 6, base - top);
    ctx.fillStyle = '#4a2c14';
    for (let y = top + 10; y < base; y += 18) ctx.fillRect(cx - 18 + ((y * 7) % 20), y, 8, 2);
    // 葉
    const blobs = [[0, 30, 46], [-40, 50, 30], [40, 50, 30], [-20, 10, 28], [22, 8, 28], [0, -4, 22]];
    ctx.fillStyle = '#16521f';
    for (const b of blobs) circle(ctx, cx + b[0] + sway, t.y + b[1] + 2, b[2]);
    ctx.fillStyle = '#2f8a34';
    for (const b of blobs) circle(ctx, cx + b[0] + sway, t.y + b[1], b[2] - 2);
    ctx.fillStyle = '#5ac44a';
    for (const b of blobs) circle(ctx, cx + b[0] - 6 + sway, t.y + b[1] - 6, Math.max(3, b[2] - 18));
    ctx.fillStyle = '#c8102e';
    for (let i = 0; i < 12; i++) circle(ctx, cx - 60 + ((i * 37) % 120) + sway, t.y + 6 + ((i * 23) % 64), 3);
    // 顔（幹）
    const fy = top + 40;
    const ink = '#2a1608';
    ctx.fillStyle = ink;
    if (t.face === 'hurt') {
      ctx.fillRect(cx - 12, fy, 8, 2);
      ctx.fillRect(cx + 4, fy, 8, 2);
      ctx.fillRect(cx - 6, fy + 16, 12, 6);
    } else {
      ctx.fillRect(cx - 13, fy - 2, 9, 7);
      ctx.fillRect(cx + 4, fy - 2, 9, 7);
      ctx.fillStyle = t.face === 'rage' || t.face === 'angry' ? '#ff3a3a' : '#ffe9a8';
      ctx.fillRect(cx - 10, fy, 3, 3);
      ctx.fillRect(cx + 7, fy, 3, 3);
      ctx.fillStyle = ink;
      ctx.fillRect(cx - 15, fy - 6, 10, 2);
      ctx.fillRect(cx + 5, fy - 6, 10, 2);
      if (t.face === 'grin' || t.face === 'rage') {
        ctx.fillRect(cx - 10, fy + 16, 20, 3);
        ctx.fillStyle = '#ffe9a8';
        for (let i = -8; i < 9; i += 4) ctx.fillRect(cx + i, fy + 16, 2, 2);
      } else ctx.fillRect(cx - 6, fy + 18, 12, 2);
      // ひげ（ニュートン風）
      ctx.fillStyle = '#e8e2d0';
      ctx.fillRect(cx - 16, fy + 8, 6, 14);
      ctx.fillRect(cx + 10, fy + 8, 6, 14);
    }
    ctx.restore();
  };
  // =====================================================================
  // 4面
  // =====================================================================
  G.BGS.farside = function (ctx, W, t) {
    ctx.drawImage(
      staticBg('farside', (x) => {
        grad(x, ['#020108', '#06041a', '#0e0a28']);
        for (let i = 0; i < 120; i++) {
          x.fillStyle = hash2(i, 5, 41) > 0.8 ? '#ffffff' : '#7a80c0';
          x.fillRect(Math.round(hash2(i, 1, 41) * SW), Math.round(hash2(i, 2, 41) * SH), 1, 1);
        }
        // 地球
        const ex = 380,
          ey = 70,
          er = 26;
        x.fillStyle = 'rgba(120,180,255,0.15)';
        x.beginPath();
        x.arc(ex, ey, er + 6, 0, Math.PI * 2);
        x.fill();
        x.fillStyle = '#2a5ac8';
        x.beginPath();
        x.arc(ex, ey, er, 0, Math.PI * 2);
        x.fill();
        x.fillStyle = '#3aa04a';
        for (const [dx, dy, r] of [[-8, -6, 9], [6, 4, 7], [-2, 12, 5], [10, -12, 4]]) {
          x.beginPath();
          x.arc(ex + dx, ey + dy, r, 0, Math.PI * 2);
          x.fill();
        }
        x.fillStyle = 'rgba(255,255,255,0.7)';
        x.fillRect(ex - 14, ey - 20, 12, 2);
        x.fillRect(ex + 2, ey + 16, 10, 2);
        x.fillStyle = 'rgba(0,0,20,0.45)';
        x.beginPath();
        x.arc(ex + 9, ey, er, -Math.PI / 2, Math.PI / 2);
        x.fill();
      }),
      0,
      0
    );
  };

  Object.assign(G.DECOR, {
    moonflag(ctx, d, x, y) {
      ctx.save();
      if (d.fallen) {
        ctx.translate(x + 10, y + 40);
        ctx.rotate((d.fallen * Math.PI) / 2);
        ctx.translate(-x - 10, -y - 40);
      }
      ctx.fillStyle = '#d0d0e0';
      ctx.fillRect(x + 9, y - 10, 2, 50);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x + 11, y - 10, 18, 12);
      ctx.fillStyle = '#ff3a5a';
      for (let i = 0; i < 3; i++) ctx.fillRect(x + 11, y - 9 + i * 4, 18, 2);
      ctx.fillStyle = '#2a4aa8';
      ctx.fillRect(x + 11, y - 10, 7, 6);
      ctx.restore();
    },
    rabbit(ctx, d, x, y, t) {
      const up = Math.floor(t / 12) % 2;
      ctx.fillStyle = '#f4f0f8';
      ctx.fillRect(x, y + 6, 12, 10);
      ctx.fillRect(x + 2, y - 4, 3, 10);
      ctx.fillRect(x + 7, y - 4, 3, 10);
      ctx.fillStyle = '#ff6a8a';
      ctx.fillRect(x + 3, y + 9, 2, 2);
      // 杵と臼
      ctx.fillStyle = '#8a5a2a';
      ctx.fillRect(x + 16, y + 12, 14, 8);
      ctx.fillRect(x + 12, y + (up ? -2 : 4), 3, 12);
      ctx.fillStyle = '#fff6e8';
      ctx.fillRect(x + 18, y + 10, 10, 3);
    },
    stump(ctx, d, x, y) {
      ctx.fillStyle = '#5a3418';
      ctx.fillRect(x, y + 20, 40, 20);
      ctx.fillStyle = '#c8a070';
      ctx.fillRect(x + 2, y + 18, 36, 4);
      ctx.fillStyle = '#8a5a2a';
      ctx.fillRect(x + 12, y + 19, 16, 2);
    },
  });

  const baseFruitKind3 = R.drawFruitKind;
  R.drawFruitKind = function (ctx, f) {
    if (baseFruitKind3(ctx, f)) return true;
    const cx = Math.round(f.cx),
      cy = Math.round(f.cy);
    if (f.kind === 'mochi') {
      ctx.fillStyle = '#fff6e8';
      ctx.fillRect(cx - 8, cy - 5, 16, 11);
      ctx.fillRect(cx - 6, cy - 7, 12, 14);
      ctx.fillStyle = '#e8dcc8';
      ctx.fillRect(cx - 6, cy + 4, 12, 2);
      return true;
    }
    if (f.kind === 'minisave' || f.kind === 'sbullet') {
      const s = f.kind === 'minisave' ? 14 : 9;
      ctx.fillStyle = '#1a3a2a';
      ctx.fillRect(cx - s / 2, cy - s / 2, s, s);
      ctx.fillStyle = '#4ae08a';
      ctx.fillRect(cx - s / 2 + 1, cy - s / 2 + 1, s - 2, s - 2);
      G.SPR.tiny(ctx, 'S', cx - 1, cy - 2, '#ffffff');
      return true;
    }
    if (f.kind === 'err') {
      ctx.fillStyle = '#ff3a5a';
      ctx.fillRect(cx - 8, cy - 4, 16, 8);
      G.SPR.tiny(ctx, 'ERR', cx - 6, cy - 2, '#ffffff');
      return true;
    }
    return false;
  };
  const baseHazard3 = R.drawHazardBox;
  R.drawHazardBox = function (ctx, h) {
    if (h.kind === 'flagpole') return;
    return baseHazard3(ctx, h);
  };

  R.drawDoor = function (ctx, d) {
    const x = Math.round(d.x),
      y = Math.round(d.y);
    const t = d.W.time;
    ctx.fillStyle = '#1a1a2a';
    ctx.fillRect(x, y, d.w, d.h);
    if (d.open) {
      ctx.fillStyle = d.big ? `rgba(255,240,160,${0.6 + Math.sin(t * 0.1) * 0.2})` : '#3a2a5a';
      ctx.fillRect(x + 3, y + 3, d.w - 6, d.h - 3);
      if (!d.big) {
        ctx.fillStyle = '#6a5a9a';
        ctx.fillRect(x + 3, y + 3, d.w - 6, 2);
        ctx.fillStyle = '#ffd84a';
        ctx.fillRect(x + d.w - 7, y + d.h / 2, 2, 3);
      }
    } else {
      // 鍵のかかった扉（ビリビリ）
      ctx.fillStyle = '#4a4a6a';
      ctx.fillRect(x + 3, y + 3, d.w - 6, d.h - 3);
      ctx.fillStyle = Math.floor(t / 4) % 2 ? '#9ad0ff' : '#ffffff';
      for (let i = 0; i < 4; i++) ctx.fillRect(x + 4 + ((i * 9 + t) % (d.w - 8)), y + 6 + i * 8, 4, 1);
    }
    if (d.label) G.SPR.tiny(ctx, d.label, x + d.w / 2 - 1, y - 7, '#ffe9a8');
  };
  R.drawPiece = function (ctx, p) {
    const cx = Math.round(p.cx),
      cy = Math.round(p.cy);
    const t = p.W.time;
    ctx.fillStyle = `rgba(255,240,160,${0.25 + Math.sin(t * 0.1) * 0.12})`;
    circle(ctx, cx, cy, 10);
    ctx.fillStyle = '#fff6c0';
    ctx.beginPath();
    ctx.moveTo(cx, cy - 7);
    ctx.lineTo(cx + 6, cy);
    ctx.lineTo(cx, cy + 7);
    ctx.lineTo(cx - 6, cy);
    ctx.fill();
    ctx.fillStyle = '#ffd84a';
    ctx.fillRect(cx - 1, cy - 4, 2, 8);
  };
  R.drawMarkSwitch = function (ctx, s) {
    const x = Math.round(s.x),
      y = Math.round(s.y);
    ctx.fillStyle = '#20202c';
    ctx.fillRect(x, y, s.w, s.h);
    ctx.fillStyle = s.on ? '#ffe9a8' : '#4a4a6a';
    ctx.fillRect(x + 1, y + 1, s.w - 2, s.h - 2);
    const cx = x + s.w / 2,
      cy = y + s.h / 2;
    if (s.mark === 'sun') {
      ctx.fillStyle = '#ff8a10';
      circle(ctx, cx, cy, 4);
      for (let k = 0; k < 8; k++) ctx.fillRect(Math.round(cx + Math.cos(k * 0.785) * 6) - 1, Math.round(cy + Math.sin(k * 0.785) * 6) - 1, 2, 2);
    } else if (s.mark === 'moon') {
      ctx.fillStyle = '#fffbe0';
      circle(ctx, cx, cy, 5);
      ctx.fillStyle = s.on ? '#ffe9a8' : '#4a4a6a';
      circle(ctx, cx + 3, cy - 2, 4);
    } else {
      ctx.fillStyle = '#fff27a';
      ctx.beginPath();
      for (let k = 0; k < 10; k++) {
        const a = -Math.PI / 2 + (k * Math.PI) / 5,
          r = k % 2 ? 2.5 : 6;
        ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
      }
      ctx.fill();
    }
  };
  R.drawSockets = function (ctx, W, cx, y) {
    const got = W.vars.sockets || [];
    for (let i = 0; i < 3; i++) {
      const x = cx - 24 + i * 24;
      ctx.fillStyle = '#20202c';
      circle(ctx, x, y, 7);
      if (got[i]) {
        ctx.fillStyle = '#fff6c0';
        ctx.beginPath();
        ctx.moveTo(x, y - 6);
        ctx.lineTo(x + 5, y);
        ctx.lineTo(x, y + 6);
        ctx.lineTo(x - 5, y);
        ctx.fill();
      } else {
        ctx.strokeStyle = '#6a6a8a';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.arc(x, y, 5, 0, Math.PI * 2);
        ctx.stroke();
      }
    }
  };
  R.drawWaitMeter = function (ctx, k) {
    ctx.fillStyle = 'rgba(10,6,18,0.7)';
    ctx.fillRect(190, 30, 100, 8);
    ctx.fillStyle = k > 0.8 ? '#ff6a8a' : '#9affc0';
    ctx.fillRect(191, 31, Math.round(98 * Math.min(1, k)), 6);
    G.SPR.tiny(ctx, String(Math.ceil(5 - Math.min(1, k) * 5)), 237, 20, '#ffffff', 2);
  };
  // 偽のセーブデータ消去画面（UIレイヤー）
  R.drawFakeDelete = function (ctx, pct, text) {
    const W0 = G.W,
      H0 = G.H;
    ctx.fillStyle = 'rgba(0,0,0,0.85)';
    ctx.fillRect(0, 0, W0, H0);
    ctx.fillStyle = '#d8d8e0';
    ctx.fillRect(110, 100, 260, 80);
    ctx.fillStyle = '#20307a';
    ctx.fillRect(110, 100, 260, 14);
    ctx.fillStyle = '#ffffff';
    ctx.font = '9px "DotGothic16", monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('システム', 116, 107);
    ctx.fillStyle = '#101018';
    ctx.font = '11px "DotGothic16", monospace';
    ctx.fillText(text || '', 122, 132);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(122, 150, 236, 12);
    ctx.fillStyle = '#2a8a4a';
    ctx.fillRect(123, 151, Math.round(234 * pct / 100), 10);
    ctx.fillStyle = '#101018';
    ctx.textAlign = 'right';
    ctx.fillText(`${pct}%`, 358, 172);
    ctx.textAlign = 'left';
  };
  R.drawSaveBoss = function (ctx, b) {
    if (!b.visible) return;
    const x = Math.round(b.x + (b.shakeX || 0) + (b.glitch > 0 ? (b.glitch % 3) - 1 : 0) * 3),
      y = Math.round(b.y);
    ctx.fillStyle = 'rgba(154,255,192,0.15)';
    ctx.fillRect(x - 6, y - 6, b.w + 12, b.h + 12);
    ctx.fillStyle = '#0e2a1a';
    ctx.fillRect(x, y, b.w, b.h);
    ctx.fillStyle = b.hurtT > 0 ? '#ffffff' : '#3ad07a';
    ctx.fillRect(x + 3, y + 3, b.w - 6, b.h - 6);
    ctx.fillStyle = '#9affc0';
    ctx.fillRect(x + 3, y + 3, b.w - 6, 4);
    G.SPR.tiny(ctx, 'SAVE', x + 10, y + b.h - 16, '#ffffff', 2);
    // 顔
    ctx.fillStyle = '#0e2a1a';
    ctx.fillRect(x + 12, y + 14, 10, 8);
    ctx.fillRect(x + 38, y + 14, 10, 8);
    ctx.fillStyle = b.face === 'hurt' ? '#ffffff' : '#ff3040';
    ctx.fillRect(x + 16, y + 17, 3, 3);
    ctx.fillRect(x + 42, y + 17, 3, 3);
    ctx.fillStyle = '#0e2a1a';
    ctx.fillRect(x + 10, y + 10, 12, 2);
    ctx.fillRect(x + 38, y + 10, 12, 2);
    ctx.fillRect(x + 18, y + 28, 24, 3);
    if (b.glitch > 0) {
      ctx.fillStyle = 'rgba(255,58,90,0.5)';
      ctx.fillRect(x, y + ((b.glitch * 7) % b.h), b.w, 3);
    }
  };

  // =====================================================================
  // 5面：天まで届け
  // =====================================================================
  // 高さメーター（右端の縦棒に、いまの高さと最高記録）
  R.drawHeight = function (ctx, W) {
    const P = W.player,
      k = W.vars.tower || 1;
    const h = Math.max(0, Math.round(((k - 1) * SH + (SH - (P.y + P.h))) / 10));
    const max = Math.max(h, (W.game && W.game.flags && W.game.flags.towerMax) || 0);
    const top = 9 * 28;
    const bx = SW - 12,
      by = 24,
      bh = 120;
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(bx - 1, by - 1, 6, bh + 2);
    ctx.fillStyle = 'rgba(255,255,255,0.25)';
    ctx.fillRect(bx, by, 4, bh);
    const yOf = (v) => Math.round(by + bh - (Math.min(v, top) / top) * bh);
    ctx.fillStyle = '#ffd770';
    ctx.fillRect(bx - 3, yOf(max), 10, 1);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(bx - 1, yOf(h) - 1, 6, 3);
    ctx.font = '8px monospace';
    ctx.textAlign = 'right';
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillText(`${h}m`, bx - 3, yOf(h) + 4);
    ctx.fillStyle = '#ffffff';
    ctx.fillText(`${h}m`, bx - 4, yOf(h) + 3);
    ctx.fillStyle = '#ffd770';
    ctx.fillText('天', bx + 5, by - 4);
    ctx.textAlign = 'left';
  };
  // 塔の風（白い筋）
  R.drawTowerWind = function (ctx, W) {
    const t = W.time;
    const gust = W.windX < 0;
    const n = W.vars.windWarn ? 10 : gust ? 50 : 0;
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    for (let i = 0; i < n; i++) {
      const sp = gust ? 7 + hash2(i, 3, 12) * 4 : 2;
      const x = SW - ((hash2(i, 1, 12) * SW + t * sp) % (SW + 40));
      const y = hash2(i, 2, 12) * SH;
      ctx.fillRect(Math.round(x), Math.round(y), gust ? 10 : 4, 1);
    }
  };
  Object.assign(G.DECOR, {
    // 壺（とハンマー）
    pot(ctx, d, x, y) {
      ctx.fillStyle = '#5a3a20';
      ctx.fillRect(x + 2, y + 6, 20, 18);
      ctx.fillRect(x, y + 10, 24, 10);
      ctx.fillStyle = '#7a5230';
      ctx.fillRect(x + 4, y + 8, 6, 12);
      ctx.fillStyle = '#3a2410';
      ctx.fillRect(x + 4, y + 4, 16, 3);
      ctx.fillStyle = '#9a9aa8';
      ctx.fillRect(x + 20, y - 14, 2, 22);
      ctx.fillStyle = '#c8c8d4';
      ctx.fillRect(x + 16, y - 18, 10, 5);
    },
  });
})();
