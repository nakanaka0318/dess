// ドット絵スプライト生成（すべてコードで描く）
(function () {
  'use strict';
  const G = globalThis.G;
  const cache = new Map();

  function mk(w, h) {
    const c = document.createElement('canvas');
    c.width = w;
    c.height = h;
    return c;
  }
  G.mkCanvas = mk;

  function fromRows(rows, pal) {
    const h = rows.length,
      w = rows[0].length;
    const c = mk(w, h),
      x = c.getContext('2d');
    for (let j = 0; j < h; j++)
      for (let i = 0; i < w; i++) {
        const ch = rows[j][i];
        if (ch === '.' || ch === ' ') continue;
        x.fillStyle = pal[ch] || '#ff00ff';
        x.fillRect(i, j, 1, 1);
      }
    return c;
  }
  function flip(src, h, v) {
    const c = mk(src.width, src.height),
      x = c.getContext('2d');
    x.translate(h ? src.width : 0, v ? src.height : 0);
    x.scale(h ? -1 : 1, v ? -1 : 1);
    x.drawImage(src, 0, 0);
    return c;
  }
  function memo(key, fn) {
    let v = cache.get(key);
    if (!v) {
      v = fn();
      cache.set(key, v);
    }
    return v;
  }
  // ピクセル単位で描くヘルパ
  function pixels(w, h, fn) {
    const c = mk(w, h),
      x = c.getContext('2d');
    const img = x.createImageData(w, h);
    const d = img.data;
    for (let j = 0; j < h; j++)
      for (let i = 0; i < w; i++) {
        const col = fn(i, j);
        if (!col) continue;
        const k = (j * w + i) * 4;
        const n = parseInt(col.slice(1), 16);
        d[k] = (n >> 16) & 255;
        d[k + 1] = (n >> 8) & 255;
        d[k + 2] = n & 255;
        d[k + 3] = 255;
      }
    x.putImageData(img, 0, 0);
    return c;
  }

  // ---------------- 主人公 ----------------
  const KID_PAL = {
    k: '#1b1028', r: '#e8343c', R: '#a01c2c', w: '#ffffff', s: '#ffd7b5', S: '#e8a888', e: '#1b1028',
    b: '#3a6cf0', B: '#2443a8', c: '#d02050', C: '#8c1238', p: '#2a2a48', o: '#6b3a20', g: '#c8ccd8',
    G: '#6a6e80', y: '#ffd84a',
  };
  const HEAD = [
    '....kkkkk.....',
    '...krrrrrk....',
    '..krrrrwrrk...',
    '..kRRRRRRRkkk.',
    '..ksssssesk...',
    '..ksssssesk...',
    '..kSssssssk...',
    '...kkSSSkk....',
  ];
  const TORSO = {
    a: ['.kckbbbbbbk...', 'kcckbbbbBkgggk', 'kcckbbbbBkGGk.', '.kCkbbyybbk...'],
    b: ['.kckbbbbbbk...', 'kcCkbbbbBkgggk', '.cckbbbbBkGGk.', '..CkbbyybbK...'],
    j: ['kckkbbbbbbk...', 'kcckbbbbBkgggk', '.cckbbbbBkGGk.', '..kkbbyybbk...'],
  };
  const LEGS = {
    idle: ['..kkppppppk...', '...kppkppk....', '...kook.kook..', '...kkkk.kkkk..'],
    r0: ['..kkppppppk...', '..kpppk.kppk..', '.kook....kook.', '.kkkk....kkkk.'],
    r1: ['..kkppppppk...', '...kppppk.....', '...kooook.....', '...kkkkkk.....'],
    r2: ['..kkppppppk...', '...kpk.kppk...', '..kook..kook..', '..kkkk..kkkk..'],
    jump: ['..kkppppppk...', '..kppk.kppk...', '..kook.kook...', '..............'],
    fall: ['..kkppppppk...', '..kpk...kpk...', '.kook...kook..', '.kkk.....kkk..'],
  };
  const KID_FRAMES = {
    idle0: ['a', 'idle'],
    idle1: ['b', 'idle'],
    run0: ['a', 'r0'],
    run1: ['b', 'r1'],
    run2: ['a', 'r2'],
    run3: ['b', 'r1'],
    jump: ['j', 'jump'],
    fall: ['j', 'fall'],
  };
  const KID_PAL_FIX = Object.assign({}, KID_PAL, { K: '#1b1028' });
  G.SPR = {
    kid(frame, face, grav) {
      return memo(`kid:${frame}:${face}:${grav}`, () => {
        const f = KID_FRAMES[frame] || KID_FRAMES.idle0;
        const rows = HEAD.concat(TORSO[f[0]], LEGS[f[1]]);
        let c = fromRows(rows, KID_PAL_FIX);
        if (face < 0 || grav < 0) c = flip(c, face < 0, grav < 0);
        return c;
      });
    },

    // ---------------- トゲ ----------------
    spike(dir, size, palName) {
      size = size || 20;
      return memo(`spike:${dir}:${size}:${palName}`, () => {
        const P = SPIKE_PALS[palName] || SPIKE_PALS.steel;
        const s = size;
        const inside = (x, y) => {
          // 上向き三角形 (0,s) (s,s) (s/2,0)
          if (y < 0 || y >= s || x < 0 || x >= s) return false;
          const py = y + 0.5,
            px = x + 0.5;
          const half = (py / s) * (s / 2);
          return Math.abs(px - s / 2) <= half + 0.01;
        };
        const up = pixels(s, s, (x, y) => {
          if (!inside(x, y)) return null;
          if (!inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y - 1) || y === s - 1) return P.o;
          const rel = (x + 0.5 - s / 2) / (s / 2);
          if (rel < -0.25) return P.l;
          if (rel < 0.15) return y < s * 0.5 ? P.l : P.m;
          return P.d;
        });
        if (dir === 'u') return up;
        const c = mk(s, s),
          x = c.getContext('2d');
        x.translate(s / 2, s / 2);
        x.rotate({ d: Math.PI, l: -Math.PI / 2, r: Math.PI / 2 }[dir]);
        x.drawImage(up, -s / 2, -s / 2);
        return c;
      });
    },

    // ---------------- さくらんぼ ----------------
    cherry(r) {
      r = r || 6;
      return memo(`cherry:${r}`, () => {
        const w = r * 2 + 3,
          h = r * 2 + 5 + Math.round(r / 3);
        const cx = r + 1,
          cy = h - r - 1;
        const stemTop = cy - r - 3 - Math.round(r / 4);
        return pixels(w, h, (x, y) => {
          const dx = x + 0.5 - (cx + 0.5),
            dy = y + 0.5 - (cy + 0.5);
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d <= r) {
            if (d > r - 1) return '#4a0010';
            const hx = dx / r + 0.42,
              hy = dy / r + 0.42;
            if (hx * hx + hy * hy < 0.05) return '#ffffff';
            const l = (dx * 0.6 + dy * 0.8) / r;
            if (l > 0.45) return '#a0081c';
            if (l > -0.25) return '#e8152e';
            return '#ff5a66';
          }
          // 茎と葉
          const sx = cx + Math.round(((cy - r - y) / (cy - r - stemTop)) * Math.max(1, r / 3));
          if (y >= stemTop && y < cy - r + 1 && x === sx) return '#2f6b1f';
          if (y >= stemTop && y <= stemTop + 1 && x > sx && x <= sx + Math.max(2, Math.round(r / 2))) return y === stemTop ? '#7ad957' : '#3f9a2f';
          return null;
        });
      });
    },

    star(r) {
      r = r || 6;
      return memo(`star:${r}`, () => {
        const s = r * 2 + 2,
          c = r + 1;
        const pts = [];
        for (let i = 0; i < 10; i++) {
          const a = -Math.PI / 2 + (i * Math.PI) / 5;
          const rr = i % 2 === 0 ? r : r * 0.45;
          pts.push([c + Math.cos(a) * rr, c + Math.sin(a) * rr]);
        }
        const inPoly = (x, y) => {
          let ins = false;
          for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
            const xi = pts[i][0],
              yi = pts[i][1],
              xj = pts[j][0],
              yj = pts[j][1];
            if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) ins = !ins;
          }
          return ins;
        };
        return pixels(s, s, (x, y) => {
          const px = x + 0.5,
            py = y + 0.5;
          if (!inPoly(px, py)) return null;
          if (!inPoly(px - 1, py) || !inPoly(px + 1, py) || !inPoly(px, py - 1) || !inPoly(px, py + 1)) return '#a86a00';
          return py < c - 1 ? '#fff6b0' : px < c ? '#ffe04a' : '#ffc21a';
        });
      });
    },

    rockBall(r) {
      r = r || 6;
      return memo(`rock:${r}`, () => {
        const s = r * 2 + 2,
          c = r + 1;
        return pixels(s, s, (x, y) => {
          const dx = x + 0.5 - c,
            dy = y + 0.5 - c;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d > r) return null;
          if (d > r - 1) return '#2a2434';
          if ((x * 7 + y * 3) % 11 === 0) return '#4a4258';
          const l = (dx * 0.6 + dy * 0.8) / r;
          return l > 0.3 ? '#6a6278' : l > -0.3 ? '#8e86a0' : '#b4aec4';
        });
      });
    },

    // ---------------- 月 ----------------
    moon(r, face) {
      r = Math.round(r || 24);
      face = face || 'calm';
      return memo(`moon:${r}:${face}`, () => {
        const s = r * 2 + 2,
          c = r + 1;
        const craters = [
          [-0.38, -0.3, 0.2], [0.42, 0.28, 0.15], [0.08, 0.6, 0.11], [-0.52, 0.36, 0.12], [0.46, -0.46, 0.1], [-0.05, -0.62, 0.08],
        ];
        const red = face === 'rage';
        const base = red ? ['#ffd2c0', '#f0a090', '#c06060', '#5a1a20'] : ['#fffbe0', '#efe6b0', '#c9bd80', '#4a4030'];
        const cnv = pixels(s, s, (x, y) => {
          const dx = x + 0.5 - c,
            dy = y + 0.5 - c;
          const d = Math.sqrt(dx * dx + dy * dy);
          if (d > r) return null;
          if (d > r - 1.2) return base[3];
          const nx = dx / r,
            ny = dy / r;
          for (const cr of craters) {
            const ex = nx - cr[0],
              ey = ny - cr[1];
            const cd = Math.sqrt(ex * ex + ey * ey);
            if (cd < cr[2]) {
              if (cd > cr[2] - 1.5 / r && ex + ey > 0) return base[0];
              return base[2];
            }
          }
          const l = nx * 0.6 + ny * 0.8;
          if (l > 0.55) return base[2];
          if (l > 0.0) return base[1];
          return base[0];
        });
        if (face !== 'none') drawMoonFace(cnv.getContext('2d'), c, r, face);
        return cnv;
      });
    },

    // ---------------- 3x5 ドットフォント ----------------
    tiny(ctx, str, x, y, color, scale) {
      scale = scale || 1;
      ctx.fillStyle = color || '#fff';
      let cx = x;
      for (const ch of String(str).toUpperCase()) {
        const g = FONT[ch] || FONT[' '];
        const gw = g[0].length;
        for (let j = 0; j < 5; j++)
          for (let i = 0; i < gw; i++) if (g[j][i] === '#') ctx.fillRect(cx + i * scale, y + j * scale, scale, scale);
        cx += (gw + 1) * scale;
      }
    },
    tinyWidth(str, scale) {
      let w = 0;
      for (const ch of String(str).toUpperCase()) w += ((FONT[ch] || FONT[' '])[0].length + 1);
      return (w - 1) * (scale || 1);
    },
    glyphW(ch) {
      return (FONT[String(ch).toUpperCase()] || FONT[' '])[0].length;
    },
  };

  const SPIKE_PALS = {
    steel: { o: '#262838', l: '#f4f7ff', m: '#c8cee2', d: '#7c86a6' },
    red: { o: '#3a0d14', l: '#ffb0b8', m: '#e05868', d: '#8a1e2e' },
    ice: { o: '#183450', l: '#f0fdff', m: '#a8e8ff', d: '#4aa3d8' },
    gold: { o: '#4a3200', l: '#fff6c0', m: '#ffd24a', d: '#c08a10' },
    dark: { o: '#0c0c14', l: '#9a9ab8', m: '#64648a', d: '#3a3a56' },
    crystal: { o: '#2a1850', l: '#f4e8ff', m: '#c7a2ff', d: '#7a50d0' },
  };
  G.SPIKE_PALS = SPIKE_PALS;

  function drawMoonFace(x, c, r, face) {
    const k = r / 24;
    const px = (fx, fy, w, h, col) => {
      x.fillStyle = col;
      x.fillRect(Math.round(c + fx * k), Math.round(c + fy * k), Math.max(1, Math.round(w * k)), Math.max(1, Math.round(h * k)));
    };
    const ink = '#2a2018';
    if (face === 'calm') {
      // 眠そうな目と小さな笑み
      px(-11, -4, 6, 2, ink);
      px(5, -4, 6, 2, ink);
      px(-4, 7, 8, 2, ink);
      px(-6, 5, 2, 2, ink);
      px(4, 5, 2, 2, ink);
      px(-14, 2, 4, 2, '#f0b0a0');
      px(10, 2, 4, 2, '#f0b0a0');
    } else if (face === 'grin' || face === 'rage') {
      // 吊り目とギザ歯の笑み
      px(-12, -8, 3, 2, ink);
      px(-9, -6, 3, 2, ink);
      px(-11, -5, 5, 4, ink);
      px(9, -8, 3, 2, ink);
      px(6, -6, 3, 2, ink);
      px(6, -5, 5, 4, ink);
      px(-9, -4, 2, 2, face === 'rage' ? '#ffee55' : '#ff3040');
      px(7, -4, 2, 2, face === 'rage' ? '#ffee55' : '#ff3040');
      px(-12, 4, 24, 2, ink);
      px(-10, 6, 20, 2, ink);
      px(-7, 8, 14, 2, ink);
      for (let i = -9; i <= 7; i += 4) px(i, 4, 2, 2, '#ffffff');
      px(-11, 3, 2, 2, ink);
      px(9, 3, 2, 2, ink);
    } else if (face === 'angry') {
      px(-13, -10, 8, 2, ink);
      px(5, -10, 8, 2, ink);
      px(-11, -6, 5, 5, ink);
      px(6, -6, 5, 5, ink);
      px(-10, -5, 2, 2, '#ff3040');
      px(7, -5, 2, 2, '#ff3040');
      px(-7, 6, 14, 3, ink);
      px(-9, 8, 2, 2, ink);
      px(7, 8, 2, 2, ink);
    } else if (face === 'hurt') {
      // バツ目
      for (let i = 0; i < 5; i++) {
        px(-12 + i, -7 + i, 1.5, 1.5, ink);
        px(-8 - i + 0, -7 + i, 1.5, 1.5, ink);
        px(6 + i, -7 + i, 1.5, 1.5, ink);
        px(10 - i, -7 + i, 1.5, 1.5, ink);
      }
      px(-5, 5, 10, 6, ink);
      px(-3, 7, 6, 3, '#c04050');
    } else if (face === 'shock') {
      px(-11, -7, 5, 6, '#ffffff');
      px(6, -7, 5, 6, '#ffffff');
      px(-10, -5, 3, 3, ink);
      px(7, -5, 3, 3, ink);
      px(-3, 4, 6, 7, ink);
    }
  }

  const FONT = {};
  const F = {
    A: '.#.#.####.##.#', B: '##.#.###.#.###.', C: '.###..#..#...##', D: '##.#.##.##.###.', E: '####..##.#..###', F: '####..##.#..#..',
    G: '.###..#.##.#.##', H: '#.##.####.##.#', I: '###.#..#..#.###', J: '..#..#..##.#.#.', K: '#.##.###.#.##.#', L: '#..#..#..#..###',
    M: '#.#####.##.##.#', N: '##.#.##.##.##.#', O: '.#.#.##.##.#.#.', P: '##.#.###.#..#..', Q: '.#.#.##.###..##', R: '##.#.###.#.##.#',
    S: '.###...#...###.', T: '###.#..#..#..#.', U: '#.##.##.##.####', V: '#.##.##.##.#.#.', W: '#.##.#######.#', X: '#.##.#.#.#.##.#',
    Y: '#.##.#.#..#..#.', Z: '###..#.#.#..###', 0: '####.##.##.####', 1: '.#.##..#..#.###', 2: '##...#.#.#..###', 3: '##...#.#...###.',
    4: '#.##.####..#..#', 5: '####..##...###.', 6: '.###..####.####', 7: '###..#.#..#..#.', 8: '####.#####.####', 9: '####.####..###.',
    '!': '.#..#..#.....#.', '?': '##...#.#.....#.', ' ': '...............', '-': '......###......', '.': '.............#.',
    ':': '....#.....#....', '/': '..#..#.#.#..#..', "'": '.#..#..........', '+': '....#.###.#....', '>': '#...#...#.#.#..',
    '<': '..#.#.#...#...#',
  };
  for (const k in F) {
    let s = F[k];
    if (s.length === 14) s = s + '#'; // H, M, W の短縮表記
    FONT[k] = [s.slice(0, 3), s.slice(3, 6), s.slice(6, 9), s.slice(9, 12), s.slice(12, 15)];
  }
  // 14文字定義の補正（H/M/W/A は末尾が # で終わる）
  FONT.A = ['.#.', '#.#', '###', '#.#', '#.#'];
  FONT.H = ['#.#', '#.#', '###', '#.#', '#.#'];
  FONT.M = ['#...#', '##.##', '#.#.#', '#...#', '#...#'];
  FONT.W = ['#...#', '#...#', '#.#.#', '##.##', '#...#'];
  FONT.N = ['#..#', '##.#', '#.##', '#..#', '#..#'];
  G.FONT = FONT;
})();
