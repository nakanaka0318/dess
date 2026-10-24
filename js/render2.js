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
})();
