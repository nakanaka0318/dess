// ワールド描画（低解像度 480x280 のキャンバスに描いてから拡大する）
(function () {
  'use strict';
  const G = globalThis.G;
  const { T, COLS, ROWS } = G;
  const SW = G.W,
    SH = G.H;

  function hash2(x, y, s) {
    let h = (x * 374761393 + y * 668265263 + (s || 0) * 982451653) | 0;
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }

  // ---------------- テーマ ----------------
  const THEMES = {
    grass: {
      solid: { base: '#7a4a2a', dk: '#5e3820', lt: '#94603a', edge: '#3c2414', top: '#4cb43c', topLt: '#8ee35e', topDk: '#2e7a2a' },
      alt: { base: '#a89a88', dk: '#6e6254', lt: '#d4c8b4' },
      plat: { base: '#c08850', dk: '#7a5030', lt: '#e0b078' },
    },
    cave: {
      solid: { base: '#4b3d5e', dk: '#352a46', lt: '#5f4e78', edge: '#1e1629', top: '#4a7ae0', topLt: '#9ad0ff', topDk: '#2c4a9a' },
      alt: { base: '#2f5a78', dk: '#1d3a52', lt: '#6fb6d8' },
      plat: { base: '#8a6a4a', dk: '#4a3420', lt: '#b08a62' },
    },
    castle: {
      solid: { base: '#5b5970', dk: '#3a384a', lt: '#77758e', edge: '#22202e', top: '#9a98b4', topLt: '#c4c2dc', topDk: '#5b5970' },
      alt: { base: '#4a2f4f', dk: '#2e1b33', lt: '#7a5080' },
      plat: { base: '#6a6e80', dk: '#363948', lt: '#a0a6bc' },
    },
    sky: {
      solid: { base: '#cfd6ff', dk: '#9aa4e0', lt: '#eef1ff', edge: '#5a5f9a', top: '#ffd770', topLt: '#fff2b8', topDk: '#c89a2a' },
      alt: { base: '#7a6cff', dk: '#4a3cc0', lt: '#b8aeff' },
      plat: { base: '#ffffff', dk: '#c8d4f0', lt: '#ffffff' },
    },
    moon: {
      solid: { base: '#8a8a9e', dk: '#606074', lt: '#a8a8bc', edge: '#2e2e3e', top: '#c8c8d8', topLt: '#eeeef8', topDk: '#7a7a8e' },
      alt: { base: '#5a4a7a', dk: '#3a2e52', lt: '#8a78b0' },
      plat: { base: '#ffffff', dk: '#c8d4f0', lt: '#ffffff' },
    },
  };
  G.THEMES = THEMES;

  // 1タイル描画（近傍で縁取りを変える）
  function drawTile(ctx, theme, code, tx, ty, solidAt) {
    const th = THEMES[theme] || THEMES.grass;
    const x = tx * T,
      y = ty * T;
    if (code === 1) {
      const c = th.solid;
      ctx.fillStyle = c.base;
      ctx.fillRect(x, y, T, T);
      if (theme === 'castle' || theme === 'temple') {
        // レンガ
        ctx.fillStyle = c.dk;
        const off = ty % 2 ? 10 : 0;
        ctx.fillRect(x, y + 9, T, 1);
        ctx.fillRect(x, y + 19, T, 1);
        ctx.fillRect(x + ((off + 0) % 20), y, 1, 9);
        ctx.fillRect(x + ((off + 10) % 20), y + 10, 1, 9);
        ctx.fillStyle = c.lt;
        ctx.fillRect(x + 1 + ((off + 0) % 20), y, 6, 1);
        ctx.fillRect(x + 1 + ((off + 10) % 20), y + 10, 6, 1);
      } else if (theme === 'sky') {
        ctx.fillStyle = c.lt;
        ctx.fillRect(x + 1, y + 1, T - 2, 2);
        ctx.fillStyle = c.dk;
        ctx.fillRect(x + 1, y + T - 3, T - 2, 2);
        if (hash2(tx, ty, 3) > 0.6) {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(x + 6 + ((hash2(tx, ty, 4) * 8) | 0), y + 7, 2, 2);
        }
      } else {
        for (let i = 0; i < 7; i++) {
          const h = hash2(tx * 7 + i, ty * 5 + i, 1);
          ctx.fillStyle = h > 0.5 ? c.dk : c.lt;
          ctx.fillRect(x + ((hash2(tx, ty, i + 9) * 18) | 0), y + ((hash2(ty, tx, i + 3) * 18) | 0), h > 0.85 ? 2 : 1, 1 + (h > 0.7 ? 1 : 0));
        }
      }
      const up = solidAt(tx, ty - 1),
        dn = solidAt(tx, ty + 1),
        lf = solidAt(tx - 1, ty),
        rt = solidAt(tx + 1, ty);
      ctx.fillStyle = c.edge;
      if (!lf) ctx.fillRect(x, y, 1, T);
      if (!rt) ctx.fillRect(x + T - 1, y, 1, T);
      if (!dn) ctx.fillRect(x, y + T - 1, T, 1);
      if (!up) {
        if (theme === 'grass' || theme === 'cave') {
          ctx.fillStyle = c.topDk;
          ctx.fillRect(x, y, T, 6);
          ctx.fillStyle = c.top;
          ctx.fillRect(x, y, T, 4);
          ctx.fillStyle = c.topLt;
          ctx.fillRect(x, y, T, 1);
          for (let i = 0; i < T; i += 2) {
            const h = hash2(tx * 20 + i, ty, 7);
            if (h > 0.55) {
              ctx.fillStyle = c.topDk;
              ctx.fillRect(x + i, y + 6, 2, 1 + ((h * 3) | 0));
            }
            if (h < 0.18) {
              ctx.fillStyle = c.topLt;
              ctx.fillRect(x + i, y + 1, 1, 1);
            }
          }
          if (theme === 'cave' && hash2(tx, ty, 11) > 0.6) {
            ctx.fillStyle = '#c8f0ff';
            ctx.fillRect(x + ((hash2(tx, ty, 12) * 16) | 0) + 2, y + 2, 1, 1);
          }
        } else {
          ctx.fillStyle = c.top;
          ctx.fillRect(x, y, T, 3);
          ctx.fillStyle = c.topLt;
          ctx.fillRect(x, y, T, 1);
          ctx.fillStyle = c.topDk;
          ctx.fillRect(x, y + 3, T, 1);
        }
      }
    } else if (code === 2) {
      const c = th.alt;
      ctx.fillStyle = c.dk;
      ctx.fillRect(x, y, T, T);
      ctx.fillStyle = c.base;
      ctx.fillRect(x + 1, y + 1, T - 2, T - 2);
      ctx.fillStyle = c.lt;
      ctx.fillRect(x + 1, y + 1, T - 2, 1);
      ctx.fillRect(x + 1, y + 1, 1, T - 2);
      ctx.fillStyle = c.dk;
      if (theme === 'grass') {
        ctx.fillRect(x + 1, y + 10, T - 2, 1);
        ctx.fillRect(x + 10, y + 1, 1, 9);
        ctx.fillRect(x + 5, y + 11, 1, 8);
        ctx.fillRect(x + 15, y + 11, 1, 8);
      } else if (theme === 'cave' || theme === 'sky' || theme === 'moon') {
        ctx.fillStyle = c.lt;
        ctx.fillRect(x + 4, y + 4, 4, 2);
        ctx.fillRect(x + 4, y + 4, 2, 4);
        ctx.fillStyle = c.dk;
        ctx.fillRect(x + 12, y + 13, 4, 2);
      } else {
        ctx.fillRect(x + 3, y + 3, T - 6, 1);
        ctx.fillRect(x + 3, y + T - 4, T - 6, 1);
      }
    } else if (code === 3) {
      const c = th.plat;
      if (theme === 'sky' || theme === 'moon') {
        ctx.fillStyle = c.dk;
        ctx.fillRect(x + 1, y + 2, T - 2, 5);
        ctx.fillStyle = c.base;
        ctx.fillRect(x, y, T, 4);
        ctx.fillRect(x + 3, y - 1, 6, 2);
        ctx.fillRect(x + 11, y - 1, 5, 1);
      } else {
        ctx.fillStyle = c.dk;
        ctx.fillRect(x, y, T, 7);
        ctx.fillStyle = c.base;
        ctx.fillRect(x, y + 1, T, 4);
        ctx.fillStyle = c.lt;
        ctx.fillRect(x, y + 1, T, 1);
        ctx.fillStyle = c.dk;
        ctx.fillRect(x + 3, y + 3, 1, 1);
        ctx.fillRect(x + 16, y + 3, 1, 1);
      }
    } else if (code >= 10) {
      const img = G.SPR.spike(G.SPIKE_DIR[code], T, null);
      ctx.drawImage(img, x, y);
    }
  }

  // ---------------- 背景 ----------------
  const bgCache = new Map();
  function bgStatic(kind) {
    let c = bgCache.get(kind);
    if (c) return c;
    c = G.mkCanvas(SW, SH);
    const x = c.getContext('2d');
    const grad = (stops) => {
      const g = x.createLinearGradient(0, 0, 0, SH);
      stops.forEach((s, i) => g.addColorStop(i / (stops.length - 1), s));
      x.fillStyle = g;
      x.fillRect(0, 0, SW, SH);
    };
    const hills = (baseY, amp, col, seed, freq) => {
      x.fillStyle = col;
      x.beginPath();
      x.moveTo(0, SH);
      for (let i = 0; i <= SW; i += 4) {
        const yy = baseY + Math.sin(i * freq + seed) * amp + Math.sin(i * freq * 2.3 + seed * 2) * amp * 0.4;
        x.lineTo(i, Math.round(yy));
      }
      x.lineTo(SW, SH);
      x.fill();
    };
    if (kind === 'day') {
      grad(['#5fb4ff', '#9ad4ff', '#d8f1ff']);
      hills(170, 18, '#a8d8c0', 1.3, 0.012);
      hills(200, 14, '#7cc49a', 4.1, 0.02);
    } else if (kind === 'dusk') {
      grad(['#3a2a6a', '#b8587a', '#ffb070']);
      hills(175, 16, '#6a4070', 2.2, 0.013);
      hills(205, 12, '#4a2c58', 0.4, 0.022);
    } else if (kind === 'cave') {
      grad(['#120a1c', '#21132e', '#2a1838']);
      x.fillStyle = '#1a1026';
      for (let i = 0; i < 24; i++) {
        const px = hash2(i, 1, 5) * SW,
          w = 10 + hash2(i, 2, 5) * 30,
          h = 20 + hash2(i, 3, 5) * 60;
        x.beginPath();
        x.moveTo(px - w / 2, 0);
        x.lineTo(px + w / 2, 0);
        x.lineTo(px, h);
        x.fill();
      }
      x.fillStyle = '#1e1230';
      for (let i = 0; i < 18; i++) {
        const px = hash2(i, 4, 5) * SW,
          w = 16 + hash2(i, 5, 5) * 40,
          h = 20 + hash2(i, 6, 5) * 50;
        x.beginPath();
        x.moveTo(px - w / 2, SH);
        x.lineTo(px + w / 2, SH);
        x.lineTo(px, SH - h);
        x.fill();
      }
    } else if (kind === 'castle') {
      grad(['#141428', '#1e1e38', '#262444']);
      x.fillStyle = '#2a2a48';
      for (let yy = 0; yy < SH; yy += 16)
        for (let xx = (yy / 16) % 2 ? -16 : 0; xx < SW; xx += 32) {
          x.fillRect(xx + 1, yy + 1, 30, 14);
        }
      x.fillStyle = '#222240';
      for (let yy = 0; yy < SH; yy += 16)
        for (let xx = (yy / 16) % 2 ? -16 : 0; xx < SW; xx += 32) x.fillRect(xx + 1, yy + 13, 30, 2);
    } else if (kind === 'night' || kind === 'space') {
      grad(kind === 'night' ? ['#0a0a2a', '#1a1450', '#3a2a78'] : ['#03020c', '#0a0820', '#170f38']);
      if (kind === 'night') {
        hills(230, 10, '#241a58', 0.7, 0.015);
      }
    }
    bgCache.set(kind, c);
    return c;
  }

  function drawClouds(ctx, t, col, n, yMax, speed) {
    ctx.fillStyle = col;
    for (let i = 0; i < n; i++) {
      const w = 30 + hash2(i, 1, 8) * 40;
      const x = ((hash2(i, 2, 8) * (SW + 100) + t * speed * (0.5 + hash2(i, 3, 8))) % (SW + 100)) - 60;
      const y = 10 + hash2(i, 4, 8) * yMax;
      ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), 6);
      ctx.fillRect(Math.round(x + w * 0.2), Math.round(y - 4), Math.round(w * 0.5), 5);
      ctx.fillRect(Math.round(x + w * 0.45), Math.round(y - 7), Math.round(w * 0.3), 4);
    }
  }
  function drawStars(ctx, t, n, scroll) {
    for (let i = 0; i < n; i++) {
      let x = hash2(i, 1, 2) * SW,
        y = hash2(i, 2, 2) * SH * 0.9;
      if (scroll) y = (y + t * scroll * (0.3 + hash2(i, 5, 2))) % SH;
      const tw = Math.sin(t * 0.05 + i * 1.7);
      const big = hash2(i, 3, 2) > 0.92;
      ctx.fillStyle = tw > 0.6 ? '#ffffff' : tw > -0.3 ? '#bcc4ff' : '#6a70b0';
      ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
      if (big && tw > 0.2) {
        ctx.fillRect(Math.round(x) - 1, Math.round(y), 3, 1);
        ctx.fillRect(Math.round(x), Math.round(y) - 1, 1, 3);
      }
    }
  }

  function drawBackground(ctx, W) {
    const kind = W.def.bg || { grass: 'day', cave: 'cave', castle: 'castle', sky: 'night', moon: 'space' }[W.theme] || W.theme;
    const t = W.game ? W.game.frame : W.time;
    // 2面以降の背景は render2.js で追加
    const ext = G.BGS && G.BGS[kind];
    if (ext) {
      ext(ctx, W, t);
      if (W.def.drawBg) W.def.drawBg(ctx, W, t);
      return;
    }
    ctx.drawImage(bgStatic(kind), 0, 0);
    if (kind === 'day') drawClouds(ctx, t, 'rgba(255,255,255,0.85)', 6, 90, 0.08);
    else if (kind === 'dusk') drawClouds(ctx, t, 'rgba(255,200,180,0.35)', 5, 100, 0.06);
    else if (kind === 'night') {
      drawStars(ctx, t, 90);
      drawClouds(ctx, t, 'rgba(120,110,200,0.25)', 4, 160, 0.05);
    } else if (kind === 'space') drawStars(ctx, t, 140, 0.15);
    else if (kind === 'cave') {
      // ほこり
      for (let i = 0; i < 20; i++) {
        const x = (hash2(i, 9, 1) * SW + Math.sin(t * 0.01 + i) * 10) % SW;
        const y = (hash2(i, 8, 1) * SH + t * 0.15 * (0.5 + hash2(i, 7, 1))) % SH;
        ctx.fillStyle = 'rgba(200,170,255,0.25)';
        ctx.fillRect(Math.round(x), Math.round(y), 1, 1);
      }
    } else if (kind === 'castle') {
      // 窓から差す月光
      ctx.fillStyle = 'rgba(160,170,255,0.05)';
      for (let i = 0; i < 3; i++) {
        const x = 70 + i * 160;
        ctx.beginPath();
        ctx.moveTo(x, 30);
        ctx.lineTo(x + 24, 30);
        ctx.lineTo(x + 70, SH);
        ctx.lineTo(x + 20, SH);
        ctx.fill();
      }
    }
    if (W.def.drawBg) W.def.drawBg(ctx, W, t);
  }

  // ---------------- タイル層キャッシュ ----------------
  let tileCanvas = null,
    tileWorld = null;
  function tileLayer(W) {
    if (!tileCanvas) tileCanvas = G.mkCanvas(SW, SH);
    if (tileWorld !== W || W.tilesDirty) {
      const x = tileCanvas.getContext('2d');
      x.clearRect(0, 0, SW, SH);
      const solidAt = (tx, ty) => {
        if (tx < 0 || tx >= COLS || ty < 0 || ty >= ROWS) return true;
        const c = W.tiles[ty * COLS + tx];
        return G.isSolidCode(c) || c === 4;
      };
      for (let ty = 0; ty < ROWS; ty++)
        for (let tx = 0; tx < COLS; tx++) {
          const c = W.tiles[ty * COLS + tx];
          if (c) drawTile(x, W.theme, c === 4 ? 1 : c, tx, ty, solidAt);
        }
      W.tilesDirty = false;
      tileWorld = W;
    }
    return tileCanvas;
  }

  // ---------------- 個別描画 ----------------
  const R = {};
  G.Render = R;

  R.drawBlock = function (ctx, b, x, y) {
    if (b.style === 'credit') {
      ctx.fillStyle = 'rgba(20,16,40,0.85)';
      ctx.fillRect(x, y, b.w, b.h);
      ctx.fillStyle = '#ffe9a8';
      ctx.fillRect(x, y, b.w, 1);
      ctx.fillStyle = '#6a5a9a';
      ctx.fillRect(x, y + b.h - 1, b.w, 1);
      return;
    }
    if (b.style === 'stone' || b.style === 'thwomp') {
      ctx.fillStyle = '#2a2838';
      ctx.fillRect(x, y, b.w, b.h);
      ctx.fillStyle = '#6c6a84';
      ctx.fillRect(x + 1, y + 1, b.w - 2, b.h - 2);
      ctx.fillStyle = '#8e8ca8';
      ctx.fillRect(x + 1, y + 1, b.w - 2, 2);
      ctx.fillStyle = '#4a4860';
      ctx.fillRect(x + 1, y + b.h - 3, b.w - 2, 2);
      for (let i = 0; i < (b.w * b.h) / 120; i++) {
        ctx.fillRect(x + 3 + ((hash2(i, b.w, 2) * (b.w - 6)) | 0), y + 4 + ((hash2(i, b.h, 3) * (b.h - 8)) | 0), 2, 1);
      }
      if (b.style === 'thwomp') {
        const cx = x + b.w / 2,
          cy = y + b.h / 2;
        const angry = b.angry;
        ctx.fillStyle = '#1a1424';
        ctx.fillRect(cx - 12, cy - 8, 8, 7);
        ctx.fillRect(cx + 4, cy - 8, 8, 7);
        ctx.fillStyle = angry ? '#ff3040' : '#ffffff';
        ctx.fillRect(cx - 9, cy - 6, 3, 3);
        ctx.fillRect(cx + 6, cy - 6, 3, 3);
        ctx.fillStyle = '#1a1424';
        ctx.fillRect(cx - 14, cy - 11, 10, 2);
        ctx.fillRect(cx + 4, cy - 11, 10, 2);
        ctx.fillRect(cx - 8, cy + 4, 16, 3);
        ctx.fillStyle = '#ffffff';
        for (let i = -7; i < 8; i += 4) ctx.fillRect(cx + i, cy + 4, 2, 2);
        // 下向きのトゲ
        if (b.spikesBelow) {
          const img = G.SPR.spike('d', 10, 'steel');
          for (let i = 0; i < b.w; i += 10) ctx.drawImage(img, x + i, y + b.h);
        }
      }
      return;
    }
    if (b.style === 'conveyor') {
      ctx.fillStyle = '#2a2a36';
      ctx.fillRect(x, y, b.w, b.h);
      ctx.fillStyle = '#4a4a5a';
      ctx.fillRect(x + 1, y + 1, b.w - 2, 6);
      const off = Math.floor((b.W.time * b.conveyor * 0.6) % 8 + 8) % 8;
      ctx.fillStyle = '#ffcf4a';
      for (let i = -8; i < b.w; i += 8) {
        const px = x + i + off;
        if (px >= x && px < x + b.w - 3) ctx.fillRect(px, y + 2, 3, 2);
      }
      ctx.fillStyle = '#1a1a22';
      for (let i = 4; i < b.w; i += 10) {
        ctx.fillRect(x + i, y + 10, 4, 4);
      }
      return;
    }
    if (b.style === 'cloud') {
      ctx.fillStyle = b.fading ? 'rgba(255,255,255,0.5)' : '#ffffff';
      ctx.fillRect(x, y + 2, b.w, b.h - 4);
      ctx.fillRect(x + 3, y, b.w - 6, b.h);
      ctx.fillStyle = 'rgba(180,190,240,0.9)';
      ctx.fillRect(x + 2, y + b.h - 3, b.w - 4, 2);
      return;
    }
    if (b.style === 'door') {
      ctx.fillStyle = '#2a1a10';
      ctx.fillRect(x, y, b.w, b.h);
      ctx.fillStyle = '#6a4020';
      ctx.fillRect(x + 2, y + 2, b.w - 4, b.h - 4);
      ctx.fillStyle = '#8a5a30';
      for (let i = 4; i < b.h - 2; i += 8) ctx.fillRect(x + 2, y + i, b.w - 4, 1);
      ctx.fillStyle = '#ffd84a';
      ctx.fillRect(x + b.w - 6, y + b.h / 2, 2, 3);
      return;
    }
    if (b.style === 'gate') {
      ctx.fillStyle = '#20202c';
      ctx.fillRect(x, y, b.w, b.h);
      ctx.fillStyle = '#8a8ea8';
      for (let i = 2; i < b.w; i += 6) ctx.fillRect(x + i, y, 2, b.h);
      ctx.fillRect(x, y + 2, b.w, 2);
      ctx.fillRect(x, y + b.h - 4, b.w, 2);
      return;
    }
    if (b.style === 'mystery') {
      ctx.fillStyle = '#6a3a00';
      ctx.fillRect(x, y, b.w, b.h);
      ctx.fillStyle = b.used ? '#8a6a40' : '#ffb020';
      ctx.fillRect(x + 1, y + 1, b.w - 2, b.h - 2);
      if (!b.used) {
        ctx.fillStyle = '#fff2b0';
        ctx.fillRect(x + 1, y + 1, b.w - 2, 1);
        G.SPR.tiny(ctx, '?', x + 7, y + 5, '#6a3a00', 2);
      }
      return;
    }
    // テーマのタイルで描く
    ctx.save();
    ctx.translate(x - Math.round(b.x), y - Math.round(b.y));
    const tw = Math.round(b.w / T),
      th = Math.round(b.h / T);
    const bx = Math.round(b.x),
      by = Math.round(b.y);
    for (let j = 0; j < th; j++)
      for (let i = 0; i < tw; i++) {
        ctx.save();
        ctx.translate(bx + i * T, by + j * T);
        drawTile(ctx, b.W.theme, b.code, 0, 0, (tx, ty) => tx >= -i && tx < tw - i && ty >= -j && ty < th - j);
        ctx.restore();
      }
    ctx.restore();
    if (b.label) {
      G.SPR.tiny(ctx, b.label, x + Math.round((b.w - G.SPR.tinyWidth(b.label)) / 2), y + Math.round((b.h - 5) / 2), b.labelColor || '#fff');
    }
  };

  R.drawSave = function (ctx, s) {
    const x = Math.round(s.x),
      y = Math.round(s.y);
    const t = s.W.time;
    if (s.state === 'die') {
      // 偽セーブ：トゲが四方に生える
      const k = Math.min(1, s.dieT / 4);
      const sp = (d, px, py) => ctx.drawImage(G.SPR.spike(d, 20, 'red'), Math.round(px), Math.round(py));
      sp('u', x, y - 20 * k);
      sp('d', x, y + 20 * k);
      sp('l', x - 20 * k, y);
      sp('r', x + 20 * k, y);
      ctx.fillStyle = '#3a0010';
      ctx.fillRect(x, y, 20, 20);
      ctx.fillStyle = '#ff2040';
      ctx.fillRect(x + 1, y + 1, 18, 18);
      G.SPR.tiny(ctx, 'DIE', x + 5, y + 8, '#fff');
      return;
    }
    const saved = s.state === 'saved';
    const flash = s.saveT > 0 && s.saveT % 6 < 3;
    ctx.fillStyle = '#10301c';
    ctx.fillRect(x + 1, y + 1, 18, 19);
    ctx.fillStyle = flash ? '#ffffff' : saved ? '#ff4060' : s.easy ? '#3aa0ff' : '#2ec060';
    ctx.fillRect(x + 2, y + 2, 16, 15);
    ctx.fillStyle = flash ? '#ffffff' : saved ? '#ff9aaa' : s.easy ? '#9ad4ff' : '#8affb0';
    ctx.fillRect(x + 2, y + 2, 16, 2);
    ctx.fillStyle = '#0a1a10';
    ctx.fillRect(x + 3, y + 17, 14, 3);
    G.SPR.tiny(ctx, 'SAVE', x + 3, y + 8, flash ? '#ff4060' : '#ffffff');
    if (!saved && Math.floor(t / 20) % 2 === 0) {
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      ctx.fillRect(x + 4, y + 5, 2, 1);
    }
  };

  R.drawSign = function (ctx, s) {
    const x = Math.round(s.x),
      y = Math.round(s.y);
    if (s.kind === 'arrow') {
      ctx.fillStyle = '#5a3a1a';
      ctx.fillRect(x + 9, y + 8, 2, 12);
      ctx.fillStyle = '#ffcf4a';
      ctx.fillRect(x + 2, y + 2, 14, 7);
      ctx.fillRect(x + 16, y + 1, 1, 9);
      ctx.fillRect(x + 17, y + 2, 1, 7);
      ctx.fillRect(x + 18, y + 4, 1, 3);
      return;
    }
    ctx.fillStyle = '#4a2c14';
    ctx.fillRect(x + 9, y + 10, 3, 10);
    ctx.fillStyle = '#3a200c';
    ctx.fillRect(x + 1, y + 2, 18, 10);
    ctx.fillStyle = '#c08850';
    ctx.fillRect(x + 2, y + 3, 16, 8);
    ctx.fillStyle = '#e0b078';
    ctx.fillRect(x + 2, y + 3, 16, 1);
    ctx.fillStyle = '#6a4424';
    ctx.fillRect(x + 4, y + 6, 12, 1);
    ctx.fillRect(x + 4, y + 8, 9, 1);
  };

  R.drawDecor = function (ctx, d) {
    const x = Math.round(d.x),
      y = Math.round(d.y);
    const t = d.W.time;
    switch (d.kind) {
      case 'tree': {
        // 幹と葉（さくらんぼが実る木）
        const th = (d.o.h || 80) - 30;
        ctx.fillStyle = '#5a3418';
        ctx.fillRect(x + 16, y + 30, 8, th);
        ctx.fillRect(x + 12, y + 30 + th - 3, 16, 3);
        ctx.fillStyle = '#7a4a24';
        ctx.fillRect(x + 17, y + 30, 3, th);
        const blobs = [[20, 18, 20], [8, 26, 13], [32, 26, 13], [20, 6, 13], [10, 12, 10], [30, 12, 10]];
        ctx.fillStyle = '#1f6a2a';
        for (const b of blobs) circle(ctx, x + b[0], y + b[1] + 1, b[2]);
        ctx.fillStyle = '#2f9a3a';
        for (const b of blobs) circle(ctx, x + b[0], y + b[1], b[2] - 1);
        ctx.fillStyle = '#5ac44a';
        for (const b of blobs) circle(ctx, x + b[0] - 3, y + b[1] - 3, Math.max(2, b[2] - 8));
        break;
      }
      case 'bush':
        ctx.fillStyle = '#2a7a34';
        circle(ctx, x + 6, y + 14, 6);
        circle(ctx, x + 14, y + 13, 7);
        ctx.fillStyle = '#4ab44a';
        circle(ctx, x + 12, y + 11, 4);
        break;
      case 'flower': {
        ctx.fillStyle = '#2e7a2a';
        ctx.fillRect(x + 9, y + 12, 1, 8);
        const c = ['#ff6a8a', '#ffd84a', '#8ab4ff', '#ffffff'][d.seed & 3];
        ctx.fillStyle = c;
        ctx.fillRect(x + 7, y + 10, 5, 3);
        ctx.fillRect(x + 8, y + 9, 3, 5);
        ctx.fillStyle = '#ffe066';
        ctx.fillRect(x + 9, y + 11, 1, 1);
        break;
      }
      case 'grass':
        ctx.fillStyle = '#3a9a34';
        for (let i = 0; i < 5; i++) ctx.fillRect(x + 2 + i * 4, y + 15 - (i % 2) * 2, 1, 5 + (i % 2) * 2);
        break;
      case 'torch': {
        ctx.fillStyle = '#3a2a1a';
        ctx.fillRect(x + 8, y + 8, 4, 10);
        ctx.fillStyle = '#6a5040';
        ctx.fillRect(x + 6, y + 6, 8, 3);
        const f = Math.sin(t * 0.3 + d.seed) * 1.5;
        ctx.fillStyle = 'rgba(255,160,60,0.12)';
        circle(ctx, x + 10, y + 2, 14 + f);
        ctx.fillStyle = '#ff7a20';
        ctx.fillRect(x + 7, y - 1 + f * 0.3, 6, 7);
        ctx.fillStyle = '#ffd040';
        ctx.fillRect(x + 8, y + 1 + f * 0.3, 4, 4);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(x + 9, y + 3, 2, 2);
        break;
      }
      case 'window':
        ctx.fillStyle = '#0c0c1a';
        ctx.fillRect(x, y, 24, 36);
        ctx.fillStyle = '#2a2a5a';
        ctx.fillRect(x + 2, y + 6, 20, 28);
        ctx.fillRect(x + 6, y + 2, 12, 6);
        ctx.fillStyle = '#fffbe0';
        circle(ctx, x + 15, y + 14, 4);
        ctx.fillStyle = '#0c0c1a';
        ctx.fillRect(x + 11, y + 2, 2, 32);
        ctx.fillRect(x + 2, y + 18, 20, 2);
        break;
      case 'banner':
        ctx.fillStyle = '#5a1020';
        ctx.fillRect(x + 2, y, 16, 34);
        ctx.fillStyle = '#9a2030';
        ctx.fillRect(x + 3, y, 14, 32);
        ctx.fillStyle = '#ffd84a';
        ctx.fillRect(x + 7, y + 10, 6, 6);
        ctx.fillStyle = '#9a2030';
        ctx.fillRect(x + 9, y + 12, 2, 2);
        ctx.fillStyle = '#5a1020';
        ctx.fillRect(x + 3, y + 32, 6, 4);
        ctx.fillRect(x + 11, y + 32, 6, 4);
        break;
      case 'crystal': {
        const c = ['#6ad0ff', '#c58cff', '#7affc8'][d.seed % 3];
        const p = 0.5 + Math.sin(t * 0.05 + d.seed) * 0.5;
        ctx.fillStyle = 'rgba(150,200,255,' + (0.08 + p * 0.08) + ')';
        circle(ctx, x + 10, y + 12, 12);
        ctx.fillStyle = c;
        ctx.fillRect(x + 8, y + 6, 4, 14);
        ctx.fillRect(x + 4, y + 11, 3, 9);
        ctx.fillRect(x + 13, y + 9, 3, 11);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(x + 9, y + 7, 1, 5);
        break;
      }
      case 'mushroom':
        ctx.fillStyle = '#e8dcc8';
        ctx.fillRect(x + 8, y + 13, 4, 7);
        ctx.fillStyle = '#c03050';
        ctx.fillRect(x + 4, y + 9, 12, 5);
        ctx.fillRect(x + 6, y + 7, 8, 2);
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(x + 6, y + 10, 2, 2);
        ctx.fillRect(x + 12, y + 9, 2, 2);
        break;
      case 'chain':
        ctx.fillStyle = '#6a6a7a';
        for (let i = 0; i < (d.o.len || 40); i += 6) ctx.fillRect(x + 9, y + i, 2, 4);
        break;
      case 'pillar':
        ctx.fillStyle = '#3a3850';
        ctx.fillRect(x + 2, y, 16, d.h);
        ctx.fillStyle = '#4e4c68';
        ctx.fillRect(x + 4, y, 3, d.h);
        ctx.fillStyle = '#2a2838';
        ctx.fillRect(x + 14, y, 2, d.h);
        break;
      case 'moonbg': {
        const img = G.SPR.moon(d.o.r || 30, d.o.face || 'none');
        ctx.globalAlpha = d.o.alpha || 1;
        ctx.drawImage(img, x - img.width / 2, y - img.height / 2);
        ctx.globalAlpha = 1;
        break;
      }
      case 'goalflag':
        ctx.fillStyle = '#d0d0e0';
        ctx.fillRect(x + 9, y - 30, 2, 50);
        ctx.fillStyle = '#ff3a5a';
        ctx.fillRect(x + 11, y - 30, 14, 9);
        G.SPR.tiny(ctx, 'GO', x + 13, y - 28, '#fff');
        break;
      case 'rock':
        ctx.fillStyle = '#5a5268';
        ctx.fillRect(x + 3, y + 12, 14, 8);
        ctx.fillRect(x + 5, y + 10, 9, 2);
        ctx.fillStyle = '#7a7290';
        ctx.fillRect(x + 5, y + 12, 5, 2);
        break;
      default:
        if (G.DECOR && G.DECOR[d.kind]) G.DECOR[d.kind](ctx, d, x, y, t);
        break;
    }
  };
  function circle(ctx, x, y, r) {
    ctx.beginPath();
    ctx.arc(Math.round(x), Math.round(y), Math.max(0.5, r), 0, Math.PI * 2);
    ctx.fill();
  }
  R.circle = circle;

  R.drawLava = function (ctx, l) {
    const y = Math.round(l.y);
    const t = l.W.time;
    const cols = l.color === 'acid' ? ['#2a8a2a', '#5ae04a', '#c8ff9a'] : ['#c82a10', '#ff6a1a', '#ffd04a'];
    ctx.fillStyle = cols[0];
    ctx.fillRect(0, y + 4, SW, SH - y + 10);
    ctx.fillStyle = cols[1];
    for (let x = 0; x < SW; x += 2) {
      const h = Math.sin(x * 0.08 + t * 0.12) * 2 + Math.sin(x * 0.03 - t * 0.05) * 2;
      ctx.fillRect(x, Math.round(y + 2 + h), 2, 6);
    }
    ctx.fillStyle = cols[2];
    for (let x = 0; x < SW; x += 2) {
      const h = Math.sin(x * 0.08 + t * 0.12) * 2 + Math.sin(x * 0.03 - t * 0.05) * 2;
      ctx.fillRect(x, Math.round(y + 2 + h), 2, 1);
    }
    for (let i = 0; i < 8; i++) {
      const bx = (hash2(i, 3, 3) * SW + t * 0.3) % SW;
      const by = y + 12 + ((t * 0.4 + i * 20) % 40);
      ctx.fillStyle = cols[2];
      ctx.fillRect(Math.round(bx), Math.round(by), 2, 2);
    }
  };

  R.drawOrb = function (ctx, o) {
    const cx = Math.round(o.cx),
      cy = Math.round(o.cy);
    const p = Math.sin(o.W.time * 0.1) * 1.5;
    ctx.fillStyle = o.cd > 0 ? 'rgba(197,140,255,0.2)' : 'rgba(197,140,255,0.35)';
    circle(ctx, cx, cy, 10 + p);
    ctx.fillStyle = o.cd > 0 ? '#6a4a90' : '#b070ff';
    circle(ctx, cx, cy, 6);
    ctx.fillStyle = '#ffffff';
    // 触れた後の重力の向きを矢印で示す
    const up = o.dirOnly === 2 || (!o.dirOnly && o.W.gravity === 1);
    // 矢印（次に向く方向）
    ctx.fillRect(cx - 1, cy - 3, 2, 6);
    if (up) {
      ctx.fillRect(cx - 3, cy - 2, 6, 1);
      ctx.fillRect(cx - 2, cy - 3, 4, 1);
    } else {
      ctx.fillRect(cx - 3, cy + 1, 6, 1);
      ctx.fillRect(cx - 2, cy + 2, 4, 1);
    }
  };

  R.drawSpring = function (ctx, s) {
    const x = Math.round(s.x),
      y = Math.round(s.y);
    const sq = s.squash > 5 ? 3 : 0;
    ctx.fillStyle = '#3a3a48';
    ctx.fillRect(x, y + 6, s.w, 2);
    ctx.fillStyle = '#c8ccd8';
    for (let i = 0; i < 3; i++) ctx.fillRect(x + 3 + i % 2, y + 2 + sq + i * 2 - (sq ? i : 0), s.w - 6, 1);
    ctx.fillStyle = '#ff3a5a';
    ctx.fillRect(x, y + sq - 1, s.w, 3);
    ctx.fillStyle = '#ff9aaa';
    ctx.fillRect(x, y + sq - 1, s.w, 1);
  };

  R.drawMirror = function (ctx, m) {
    const x = Math.round(m.x),
      y = Math.round(m.y);
    ctx.fillStyle = '#2a2a40';
    ctx.fillRect(x + 1, y + 1, 18, 18);
    ctx.fillStyle = m.glow ? '#ffffff' : '#9ae8ff';
    if (m.type === '|') ctx.fillRect(x + 8, y + 2, 4, 16);
    else
      for (let i = 0; i < 16; i++) {
        const px = m.type === '/' ? x + 2 + i : x + 17 - i;
        ctx.fillRect(px, y + 17 - i, 2, 2);
      }
    ctx.fillStyle = 'rgba(255,255,255,0.6)';
    ctx.fillRect(x + 2, y + 2, 2, 2);
  };

  R.drawSwitch = function (ctx, s) {
    const x = Math.round(s.x),
      y = Math.round(s.y);
    ctx.fillStyle = '#2a2030';
    ctx.fillRect(x, y, s.w, s.h);
    ctx.fillStyle = s.on ? '#4aff8a' : Math.floor(s.W.time / 15) % 2 ? '#ff4a5a' : '#c02a3a';
    ctx.fillRect(x + 2, y + 2, s.w - 4, s.h - 4);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x + 3, y + 3, 2, 2);
  };

  R.drawLaser = function (ctx, l) {
    const x = Math.round(l.x),
      y = Math.round(l.y);
    if (l.phase === 'warn') {
      const blink = Math.floor(l.t / 4) % 2 === 0;
      ctx.fillStyle = blink ? 'rgba(255,60,100,0.45)' : 'rgba(255,60,100,0.18)';
      if (l.vertical) ctx.fillRect(x + l.w / 2 - 1, y, 2, l.h);
      else ctx.fillRect(x, y + l.h / 2 - 1, l.w, 2);
    } else {
      const k = 1 - Math.min(1, (l.t - l.warn) / l.dur) * 0.3;
      ctx.fillStyle = l.color;
      if (l.vertical) ctx.fillRect(x, y, l.w, l.h);
      else ctx.fillRect(x, y, l.w, l.h);
      ctx.fillStyle = '#ffffff';
      if (l.vertical) ctx.fillRect(Math.round(x + l.w / 2 - (l.w * k) / 4), y, Math.max(1, Math.round((l.w * k) / 2)), l.h);
      else ctx.fillRect(x, Math.round(y + l.h / 2 - (l.h * k) / 4), l.w, Math.max(1, Math.round((l.h * k) / 2)));
    }
  };

  R.drawHazardBox = function (ctx, h) {
    const x = Math.round(h.x),
      y = Math.round(h.y);
    if (h.kind === 'wave') {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x, y + h.h - 3, h.w, 3);
      ctx.fillStyle = '#9ae8ff';
      for (let i = 0; i < h.w; i += 4) ctx.fillRect(x + i, y + ((i + h.t) % 8 < 4 ? 0 : 3), 2, h.h - 3);
    } else if (h.kind === 'rock') {
      ctx.fillStyle = '#4a4050';
      ctx.fillRect(x, y, h.w, h.h);
      ctx.fillStyle = '#8a8098';
      ctx.fillRect(x + 1, y + 1, h.w - 2, 2);
    } else if (h.kind === 'fire') {
      ctx.fillStyle = '#ff6a1a';
      ctx.fillRect(x, y, h.w, h.h);
      ctx.fillStyle = '#ffe04a';
      ctx.fillRect(x + 2, y + 2, h.w - 4, h.h - 4);
    } else {
      ctx.fillStyle = '#ff3a5a';
      ctx.fillRect(x, y, h.w, h.h);
    }
  };

  // さくらんぼの本体中心を (cx, cy) に合わせて描く
  R.drawCherry = function (ctx, cx, cy, r) {
    r = Math.max(2, Math.round(r));
    const img = G.SPR.cherry(r);
    ctx.drawImage(img, Math.round(cx - (r + 1)), Math.round(cy - (img.height - r - 1)));
  };

  R.drawKing = function (ctx, k) {
    const s = k.scale;
    const r = Math.max(2, Math.round(k.rr + (k.inflate > 0 ? Math.sin(k.inflate) * 2 : 0)));
    if (k.inflate > 0) k.inflate--;
    const cx = Math.round(k.cx + (k.shakeX || 0)),
      cy = Math.round(k.cy);
    if (k.charging && Math.floor(k.W.time / 3) % 2) {
      ctx.fillStyle = 'rgba(255,60,90,0.35)';
      circle(ctx, cx, cy, r + 4);
    }
    R.drawCherry(ctx, cx, cy, r);
    if (k.hurtT > 0) {
      ctx.fillStyle = 'rgba(255,255,255,0.55)';
      circle(ctx, cx, cy, r - 1);
    }
    if (s < 0.5) return;
    const lx = Math.round(k.look * 2 * s);
    // 目
    for (const d of [-1, 1]) {
      const ex = cx + d * Math.round(9 * s),
        ey = cy - Math.round(3 * s);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(ex - Math.round(4 * s), ey - Math.round(4 * s), Math.round(8 * s), Math.round(9 * s));
      ctx.fillStyle = '#1a0a10';
      ctx.fillRect(ex - Math.round(2 * s) + lx, ey - Math.round(1 * s), Math.round(4 * s), Math.round(5 * s));
      // 怒り眉
      ctx.fillStyle = '#4a0010';
      for (let i = 0; i < 6; i++) ctx.fillRect(ex - d * Math.round((5 - i * 1.6) * s), ey - Math.round((8 - i * 0.6) * s), Math.round(2 * s), Math.round(2 * s));
    }
    // 口
    ctx.fillStyle = '#4a0010';
    if (k.charging || k.inflate > 0) {
      ctx.fillRect(cx - Math.round(5 * s), cy + Math.round(8 * s), Math.round(10 * s), Math.round(7 * s));
      ctx.fillStyle = '#ff9aa8';
      ctx.fillRect(cx - Math.round(3 * s), cy + Math.round(11 * s), Math.round(6 * s), Math.round(3 * s));
    } else {
      ctx.fillRect(cx - Math.round(8 * s), cy + Math.round(11 * s), Math.round(16 * s), Math.round(2 * s));
      ctx.fillRect(cx - Math.round(10 * s), cy + Math.round(13 * s), Math.round(3 * s), Math.round(2 * s));
      ctx.fillRect(cx + Math.round(7 * s), cy + Math.round(13 * s), Math.round(3 * s), Math.round(2 * s));
    }
    // 王冠
    const top = cy - r - Math.round(2 * s);
    const cw = Math.round(22 * s),
      ch = Math.round(9 * s);
    const x0 = cx - Math.round(cw / 2) - 4;
    ctx.fillStyle = '#a86a00';
    ctx.fillRect(x0 - 1, top - 1, cw + 2, Math.round(4 * s) + 2);
    ctx.fillStyle = '#ffd84a';
    ctx.fillRect(x0, top, cw, Math.round(4 * s));
    for (let i = 0; i < 3; i++) {
      const px = x0 + Math.round((i * (cw - 4 * s)) / 2);
      ctx.fillRect(px, top - ch + Math.round(4 * s), Math.round(4 * s), ch - Math.round(4 * s));
      ctx.fillStyle = '#ff3a5a';
      ctx.fillRect(px + Math.round(1 * s), top - ch + Math.round(5 * s), Math.round(2 * s), Math.round(2 * s));
      ctx.fillStyle = '#ffd84a';
    }
  };

  R.drawMoonBoss = function (ctx, m) {
    const cx = Math.round(m.cx + (m.shakeX || 0)),
      cy = Math.round(m.cy);
    const t = m.W.time;
    const glow = m.face === 'rage' ? 'rgba(255,90,90,' : 'rgba(255,250,200,';
    ctx.fillStyle = glow + (0.08 + Math.sin(t * 0.08) * 0.03) + ')';
    circle(ctx, cx, cy, m.r + 12);
    ctx.fillStyle = glow + '0.1)';
    circle(ctx, cx, cy, m.r + 6);
    const img = G.SPR.moon(m.r, m.face);
    ctx.drawImage(img, cx - img.width / 2, cy - img.height / 2);
    if (m.hurtT > 0) {
      ctx.fillStyle = 'rgba(255,255,255,0.5)';
      circle(ctx, cx, cy, m.r - 1);
    }
    if (!m.vulnerable && m.showBar && !m.defeated) {
      ctx.strokeStyle = 'rgba(160,200,255,0.6)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(cx, cy, m.r + 3 + Math.sin(t * 0.3), 0, Math.PI * 2);
      ctx.stroke();
    }
  };

  R.drawRock = function (ctx, r) {
    const cx = Math.round(r.cx),
      cy = Math.round(r.cy);
    // トゲ
    ctx.fillStyle = '#c8cee2';
    const n = 10;
    for (let i = 0; i < n; i++) {
      const a = r.rot + (i / n) * Math.PI * 2;
      const x1 = cx + Math.cos(a) * (r.r + 5),
        y1 = cy + Math.sin(a) * (r.r + 5);
      const a2 = a + 0.22,
        a3 = a - 0.22;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.lineTo(cx + Math.cos(a2) * (r.r - 2), cy + Math.sin(a2) * (r.r - 2));
      ctx.lineTo(cx + Math.cos(a3) * (r.r - 2), cy + Math.sin(a3) * (r.r - 2));
      ctx.fill();
    }
    ctx.fillStyle = '#2a2234';
    circle(ctx, cx, cy, r.r);
    ctx.fillStyle = '#5a5068';
    circle(ctx, cx, cy, r.r - 2);
    ctx.fillStyle = '#7a7090';
    circle(ctx, cx - r.r * 0.3, cy - r.r * 0.3, r.r * 0.45);
    ctx.fillStyle = '#3e364c';
    for (let i = 0; i < 4; i++) {
      const a = r.rot * 1 + i * 1.7;
      circle(ctx, cx + Math.cos(a) * r.r * 0.5, cy + Math.sin(a) * r.r * 0.5, r.r * 0.14);
    }
  };

  // ---------------- 主人公・弾 ----------------
  function drawPlayer(ctx, W) {
    const P = W.player;
    if (!P.alive || W.hidePlayer > 0) return;
    let frame;
    const g = W.gravity;
    if (!P.onGround) frame = P.vy * g < 0 ? 'jump' : 'fall';
    else if (P.runT > 0) frame = 'run' + (Math.floor(P.runT / 5) % 4);
    else frame = 'idle' + (Math.floor(W.time / 32) % 2);
    const img = G.SPR.kid(frame, P.face, g);
    const dy = g === 1 ? -2 : 0;
    if (W.playerBlink && Math.floor(W.time / 3) % 2) return;
    ctx.drawImage(img, P.x - 3, P.y + dy);
  }
  function drawBullets(ctx, W) {
    for (const b of W.bullets) {
      const x = Math.round(b.x),
        y = Math.round(b.y);
      const col = b.hostile ? '#ff5a7a' : '#fff27a';
      ctx.fillStyle = b.hostile ? 'rgba(255,90,122,0.4)' : 'rgba(255,240,120,0.4)';
      ctx.fillRect(x - 2 - Math.sign(b.vx) * 3, y - 1 - Math.sign(b.vy) * 3, 4, 2);
      ctx.fillStyle = col;
      ctx.fillRect(x - 2, y - 1, 4, 3);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(x - 1, y, 2, 1);
    }
  }
  function drawParticles(ctx, W) {
    for (const p of W.particles) {
      if (p.fade) ctx.globalAlpha = Math.min(1, p.life / 12);
      ctx.fillStyle = p.c;
      ctx.fillRect(Math.round(p.x), Math.round(p.y), p.s, p.s);
    }
    ctx.globalAlpha = 1;
  }

  // ワールド全体を描く
  R.drawWorld = function (ctx, W) {
    drawBackground(ctx, W);
    const ents = W.ents.filter((e) => e.alive && e.visible && !e.uiText).sort((a, b) => a.layer - b.layer);
    let i = 0;
    for (; i < ents.length && ents[i].layer < 0; i++) ents[i].draw(ctx);
    ctx.drawImage(tileLayer(W), 0, 0);
    for (; i < ents.length && ents[i].layer < 5; i++) ents[i].draw(ctx);
    drawPlayer(ctx, W);
    for (; i < ents.length; i++) ents[i].draw(ctx);
    drawBullets(ctx, W);
    drawParticles(ctx, W);
    if (W.def.drawFg) W.def.drawFg(ctx, W);
    if (W.dark > 0) {
      ctx.fillStyle = `rgba(0,0,10,${W.dark})`;
      ctx.fillRect(0, 0, SW, SH);
    }
    if (W.flash > 0) {
      ctx.globalAlpha = Math.min(1, W.flash / 6) * 0.55;
      ctx.fillStyle = W.flashColor;
      ctx.fillRect(0, 0, SW, SH);
      ctx.globalAlpha = 1;
    }
  };
  R.drawTile = drawTile;
  R.hash2 = hash2;
})();
