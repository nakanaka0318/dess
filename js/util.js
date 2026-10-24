// 共通ユーティリティ・定数（DOM非依存：ヘッドレス検証でも読み込む）
(function () {
  'use strict';
  const G = (globalThis.G = globalThis.G || {});

  G.T = 20; // タイルサイズ(px)
  G.COLS = 24;
  G.ROWS = 14;
  G.W = G.T * G.COLS; // 480
  G.H = G.T * G.ROWS; // 280

  // プレイヤー物理（60fps 固定ステップ）
  G.PHYS = {
    RUN: 1.7,
    GRAV: 0.18,
    JUMP: 4.6,
    DJUMP: 3.9,
    MAXFALL: 5.2,
    CUT: 0.45, // ジャンプボタンを離した時の上昇速度倍率
    COYOTE: 5, // 足場から離れた後でも地上ジャンプできる猶予
    BUFFER: 6, // 着地直前の先行入力猶予
    PW: 8,
    PH: 14,
  };

  G.clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
  G.lerp = (a, b, t) => a + (b - a) * t;
  G.approach = (v, t, s) => (v < t ? Math.min(v + s, t) : Math.max(v - s, t));

  G.overlap = (a, b) =>
    a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;

  G.rectCircle = (r, cx, cy, rad) => {
    const nx = G.clamp(cx, r.x, r.x + r.w);
    const ny = G.clamp(cy, r.y, r.y + r.h);
    const dx = cx - nx,
      dy = cy - ny;
    return dx * dx + dy * dy < rad * rad;
  };

  // 矩形と三角形の分離軸判定。pts = [x0,y0,x1,y1,x2,y2]
  G.rectTri = (r, p) => {
    const rx0 = r.x,
      ry0 = r.y,
      rx1 = r.x + r.w,
      ry1 = r.y + r.h;
    const minX = Math.min(p[0], p[2], p[4]),
      maxX = Math.max(p[0], p[2], p[4]);
    const minY = Math.min(p[1], p[3], p[5]),
      maxY = Math.max(p[1], p[3], p[5]);
    if (maxX <= rx0 || minX >= rx1 || maxY <= ry0 || minY >= ry1) return false;
    for (let i = 0; i < 3; i++) {
      const ax = p[i * 2],
        ay = p[i * 2 + 1];
      const bx = p[((i + 1) % 3) * 2],
        by = p[((i + 1) % 3) * 2 + 1];
      const nx = by - ay,
        ny = ax - bx; // 辺の法線
      let tMin = Infinity,
        tMax = -Infinity;
      for (let j = 0; j < 3; j++) {
        const d = p[j * 2] * nx + p[j * 2 + 1] * ny;
        if (d < tMin) tMin = d;
        if (d > tMax) tMax = d;
      }
      const c = [rx0 * nx + ry0 * ny, rx1 * nx + ry0 * ny, rx0 * nx + ry1 * ny, rx1 * nx + ry1 * ny];
      const rMin = Math.min(c[0], c[1], c[2], c[3]),
        rMax = Math.max(c[0], c[1], c[2], c[3]);
      if (rMax <= tMin || rMin >= tMax) return false;
    }
    return true;
  };

  // トゲの三角形（inset で少し小さくして理不尽さを和らげる）
  G.spikeTri = (x, y, w, h, dir, inset) => {
    const i = inset == null ? 1.5 : inset;
    switch (dir) {
      case 'u':
        return [x + i, y + h, x + w - i, y + h, x + w / 2, y + i * 1.6];
      case 'd':
        return [x + i, y, x + w - i, y, x + w / 2, y + h - i * 1.6];
      case 'l':
        return [x + w, y + i, x + w, y + h - i, x + i * 1.6, y + h / 2];
      default:
        return [x, y + i, x, y + h - i, x + w - i * 1.6, y + h / 2];
    }
  };

  // 決定論的乱数（mulberry32）
  G.RNG = class {
    constructor(seed) {
      this.s = seed >>> 0 || 1;
    }
    next() {
      let t = (this.s += 0x6d2b79f5);
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }
    range(a, b) {
      return a + (b - a) * this.next();
    }
    int(a, b) {
      return Math.floor(this.range(a, b + 1));
    }
    pick(arr) {
      return arr[Math.floor(this.next() * arr.length)];
    }
    chance(p) {
      return this.next() < p;
    }
  };
  // 演出用（シミュレーション結果に影響しない）乱数
  G.fx = new G.RNG(12345);

  G.ease = {
    linear: (t) => t,
    inQuad: (t) => t * t,
    outQuad: (t) => t * (2 - t),
    inOutQuad: (t) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t),
    inCubic: (t) => t * t * t,
    outCubic: (t) => --t * t * t + 1,
    outBack: (t) => {
      const c = 1.70158;
      return 1 + (c + 1) * Math.pow(t - 1, 3) + c * Math.pow(t - 1, 2);
    },
    outBounce: (t) => {
      const n = 7.5625,
        d = 2.75;
      if (t < 1 / d) return n * t * t;
      if (t < 2 / d) return n * (t -= 1.5 / d) * t + 0.75;
      if (t < 2.5 / d) return n * (t -= 2.25 / d) * t + 0.9375;
      return n * (t -= 2.625 / d) * t + 0.984375;
    },
  };

  // 効果音・振動などのフック（ブラウザ側で差し替える）
  G.sfx = G.sfx || function () {};
  G.music = G.music || function () {};
  G.vibrate = G.vibrate || function () {};

  G.fmtTime = (frames) => {
    const s = Math.floor(frames / 60);
    const h = Math.floor(s / 3600),
      m = Math.floor((s % 3600) / 60),
      sec = s % 60;
    const pad = (n) => String(n).padStart(2, '0');
    return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
  };
})();
