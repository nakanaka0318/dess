// 入力：キーボード／タッチパッド／ゲームパッド
(function () {
  'use strict';
  const G = globalThis.G;

  const KEYMAP = {
    ArrowLeft: 'left', KeyA: 'left',
    ArrowRight: 'right', KeyD: 'right',
    ArrowUp: 'up', KeyW: 'up',
    ArrowDown: 'down', KeyS: 'down',
    ShiftLeft: 'jump', ShiftRight: 'jump', Space: 'jump', KeyZ: 'jump',
    KeyX: 'shoot', KeyJ: 'shoot', KeyC: 'shoot',
    KeyR: 'retry',
    Escape: 'pause', KeyP: 'pause',
    Enter: 'ok',
  };
  const BTNS = ['left', 'right', 'up', 'down', 'jump', 'shoot', 'retry', 'pause', 'ok'];

  const kb = {},
    touch = {},
    pad = {};
  const latchP = {},
    latchR = {};
  const prev = {};
  BTNS.forEach((b) => {
    kb[b] = touch[b] = pad[b] = prev[b] = false;
    latchP[b] = latchR[b] = false;
  });

  const state = { taps: [] };
  BTNS.forEach((b) => {
    state[b] = false;
    state[b + 'P'] = false;
    state[b + 'R'] = false;
  });
  G.input = state;

  function press(src, b, v) {
    if (src[b] === v) return;
    src[b] = v;
    if (v) latchP[b] = true;
    else latchR[b] = true;
  }

  // ---------------- キーボード ----------------
  window.addEventListener('keydown', (e) => {
    const b = KEYMAP[e.code];
    if (G.onAnyInput) G.onAnyInput();
    if (!b) return;
    e.preventDefault();
    if (e.repeat) return;
    press(kb, b, true);
  });
  window.addEventListener('keyup', (e) => {
    const b = KEYMAP[e.code];
    if (!b) return;
    e.preventDefault();
    press(kb, b, false);
  });
  window.addEventListener('blur', () => {
    BTNS.forEach((b) => {
      press(kb, b, false);
      press(touch, b, false);
    });
    pointers.clear();
    refreshTouchVisual();
  });

  // ---------------- タッチパッド ----------------
  // ボタン配置は main.js の layout() が G.padLayout に設定する
  const pointers = new Map(); // pointerId -> {group, btn}
  const btnEls = {};
  G.registerPadButtons = (els) => Object.assign(btnEls, els);

  function nearest(names, x, y) {
    let best = null,
      bd = Infinity;
    for (const n of names) {
      const b = G.padLayout && G.padLayout[n];
      if (!b) continue;
      const d = Math.hypot(x - b.x, y - b.y);
      if (d < bd) {
        bd = d;
        best = n;
      }
    }
    return { name: best, d: bd };
  }
  function classify(x, y) {
    const L = G.padLayout;
    if (!L || !L.visible) return null;
    for (const n of ['pause', 'retry']) {
      const b = L[n];
      if (b && Math.abs(x - b.x) < b.r + 12 && Math.abs(y - b.y) < b.r + 12) return { group: 'sys', btn: n };
    }
    if (L.moveZone && inRect(x, y, L.moveZone)) {
      const mid = (L.left.x + L.right.x) / 2;
      return { group: 'move', btn: x < mid ? 'left' : 'right' };
    }
    if (L.actZone && inRect(x, y, L.actZone)) {
      return { group: 'act', btn: nearest(['jump', 'shoot'], x, y).name };
    }
    return null;
  }
  function inRect(x, y, r) {
    return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
  }
  function recompute() {
    const want = {};
    for (const p of pointers.values()) if (p.btn) want[p.btn] = true;
    for (const b of ['left', 'right', 'jump', 'shoot', 'retry', 'pause']) press(touch, b, !!want[b]);
    refreshTouchVisual();
  }
  function refreshTouchVisual() {
    for (const n in btnEls) {
      const on = !!touch[n];
      if (btnEls[n].classList.contains('on') !== on) btnEls[n].classList.toggle('on', on);
    }
  }
  function toLogical(cx, cy) {
    const v = G.view;
    if (!v) return null;
    return { x: (cx - v.x) / v.s, y: (cy - v.y) / v.s };
  }

  function onDown(e) {
    if (G.onAnyInput) G.onAnyInput();
    const c = classify(e.clientX, e.clientY);
    if (c) {
      pointers.set(e.pointerId, c);
      recompute();
    } else {
      pointers.set(e.pointerId, { group: 'tap', btn: null });
      const p = toLogical(e.clientX, e.clientY);
      if (p) state.taps.push(p);
    }
    if (e.pointerType !== 'mouse') e.preventDefault();
  }
  function onMove(e) {
    const p = pointers.get(e.pointerId);
    if (!p) return;
    if (p.group === 'move') {
      const L = G.padLayout;
      const mid = (L.left.x + L.right.x) / 2;
      const nb = e.clientX < mid ? 'left' : 'right';
      if (nb !== p.btn) {
        p.btn = nb;
        recompute();
      }
    } else if (p.group === 'act') {
      const n = nearest(['jump', 'shoot'], e.clientX, e.clientY);
      if (n.name !== p.btn) {
        p.btn = n.name;
        recompute();
      }
    }
    if (e.pointerType !== 'mouse') e.preventDefault();
  }
  function onUp(e) {
    if (!pointers.has(e.pointerId)) return;
    pointers.delete(e.pointerId);
    recompute();
  }
  const opt = { passive: false };
  window.addEventListener('pointerdown', onDown, opt);
  window.addEventListener('pointermove', onMove, opt);
  window.addEventListener('pointerup', onUp, opt);
  window.addEventListener('pointercancel', onUp, opt);
  // iOS のダブルタップズーム・スクロール抑止
  for (const ev of ['touchstart', 'touchmove', 'touchend']) {
    window.addEventListener(
      ev,
      (e) => {
        if (e.target && e.target.closest && e.target.closest('.allow-touch')) return;
        e.preventDefault();
      },
      opt
    );
  }
  window.addEventListener('gesturestart', (e) => e.preventDefault(), opt);
  window.addEventListener('contextmenu', (e) => e.preventDefault());

  G.clearTouches = () => {
    pointers.clear();
    recompute();
  };

  // ---------------- ゲームパッド ----------------
  function pollPad() {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    let gp = null;
    for (const p of pads) if (p && p.connected) {
      gp = p;
      break;
    }
    const v = {};
    if (gp) {
      const ax = gp.axes[0] || 0,
        ay = gp.axes[1] || 0;
      const bt = (i) => gp.buttons[i] && gp.buttons[i].pressed;
      v.left = ax < -0.45 || bt(14);
      v.right = ax > 0.45 || bt(15);
      v.up = ay < -0.6 || bt(12);
      v.down = ay > 0.6 || bt(13);
      v.jump = bt(0) || bt(3);
      v.shoot = bt(2) || bt(1) || bt(5) || bt(7);
      v.retry = bt(8) || bt(4);
      v.pause = bt(9);
      v.ok = bt(0);
    }
    for (const b of BTNS) press(pad, b, !!v[b]);
  }

  // 1ステップごとに呼ぶ
  G.pollInput = function () {
    pollPad();
    for (const b of BTNS) {
      const held = kb[b] || touch[b] || pad[b];
      state[b] = held;
      state[b + 'P'] = latchP[b] || (held && !prev[b]);
      state[b + 'R'] = latchR[b] || (!held && prev[b]);
      latchP[b] = latchR[b] = false;
      prev[b] = held;
    }
    state.anyP = state.jumpP || state.shootP || state.okP || state.retryP;
  };
  G.consumeTaps = function () {
    const t = state.taps;
    state.taps = [];
    return t;
  };
})();
