// 起動・レイアウト・メインループ・タイトル画面
(function () {
  'use strict';
  const G = globalThis.G;
  const SW = G.W,
    SH = G.H;
  const STEP = 1000 / 60;

  const canvas = document.getElementById('screen');
  const ctx = canvas.getContext('2d');
  const world = G.mkCanvas(SW, SH);
  const wctx = world.getContext('2d');
  wctx.imageSmoothingEnabled = false;
  let dpr = 1;

  const params = new URLSearchParams(location.search);
  const DEBUG = params.has('debug');

  G.isTouch = 'ontouchstart' in window || (navigator.maxTouchPoints || 0) > 0;
  window.addEventListener(
    'pointerdown',
    (e) => {
      if (e.pointerType === 'touch' && !G.isTouch) {
        G.isTouch = true;
        layout();
      }
    },
    { capture: true }
  );

  // ---------------- タッチパッド ----------------
  const pad = document.getElementById('pad');
  const els = {};
  for (const n of ['left', 'right', 'jump', 'shoot', 'retry', 'pause']) els[n] = document.getElementById('b-' + n);
  G.registerPadButtons(els);

  function readSafe() {
    const cs = getComputedStyle(document.documentElement);
    const v = (n) => parseFloat(cs.getPropertyValue(n)) || 0;
    return { t: v('--sat'), r: v('--sar'), b: v('--sab'), l: v('--sal') };
  }

  function place(el, b) {
    el.style.left = b.x - b.r + 'px';
    el.style.top = b.y - b.r + 'px';
    el.style.width = el.style.height = b.r * 2 + 'px';
    el.style.fontSize = Math.max(10, b.r * 0.42) + 'px';
  }

  function layout() {
    const vw = window.innerWidth,
      vh = window.innerHeight;
    const safe = readSafe();
    dpr = Math.min(window.devicePixelRatio || 1, 3);
    canvas.width = Math.round(vw * dpr);
    canvas.height = Math.round(vh * dpr);
    canvas.style.width = vw + 'px';
    canvas.style.height = vh + 'px';
    const touch = G.isTouch;
    const portrait = vh > vw * 1.05;
    const L = { visible: touch };
    let gx, gy, gw, gh;
    if (touch && portrait) {
      gw = vw - safe.l - safe.r;
      gh = (gw * SH) / SW;
      gx = safe.l;
      gy = safe.t + Math.max(10, (vh - safe.t - safe.b) * 0.05);
      const padTop = gy + gh + 8;
      const ph = vh - safe.b - padTop;
      const r = G.clamp(Math.min(vw * 0.12, ph * 0.17), 28, 58);
      const by = padTop + Math.max(ph * 0.55, r * 2.2);
      L.left = { x: safe.l + 16 + r, y: by, r };
      L.right = { x: L.left.x + r * 2 + 12, y: by, r };
      L.jump = { x: vw - safe.r - 16 - r * 1.15, y: by - r * 0.45, r: r * 1.15 };
      L.shoot = { x: L.jump.x - r * 2.35, y: by + r * 0.5, r };
      L.retry = { x: vw - safe.r - 30, y: padTop + 26, r: 19 };
      L.pause = { x: L.retry.x - 48, y: padTop + 26, r: 19 };
      L.moveZone = { x: 0, y: padTop + 52, w: vw * 0.5, h: vh - padTop };
      L.actZone = { x: vw * 0.5, y: padTop + 52, w: vw * 0.5, h: vh - padTop };
      L.portrait = true;
    } else {
      const s = Math.min((vw - safe.l - safe.r) / SW, (vh - safe.t - safe.b) / SH);
      gw = SW * s;
      gh = SH * s;
      gx = safe.l + (vw - safe.l - safe.r - gw) / 2;
      gy = safe.t + (vh - safe.t - safe.b - gh) / 2;
      if (touch) {
        const r = G.clamp(vh * 0.105, 26, 54);
        const by = vh - safe.b - 14 - r;
        L.left = { x: safe.l + 14 + r, y: by, r };
        L.right = { x: L.left.x + r * 2 + 10, y: by, r };
        L.jump = { x: vw - safe.r - 14 - r * 1.12, y: vh - safe.b - 16 - r * 1.12, r: r * 1.12 };
        L.shoot = { x: L.jump.x - r * 2.3, y: L.jump.y + r * 0.35, r };
        L.retry = { x: vw - safe.r - 24, y: safe.t + 22, r: 16 };
        L.pause = { x: L.retry.x - 42, y: safe.t + 22, r: 16 };
        L.moveZone = { x: 0, y: vh * 0.28, w: vw * 0.42, h: vh * 0.72 };
        L.actZone = { x: vw * 0.58, y: vh * 0.28, w: vw * 0.42, h: vh * 0.72 };
      }
    }
    G.view = { x: gx, y: gy, s: gw / SW, w: gw, h: gh };
    G.padLayout = L;
    pad.classList.toggle('hidden', !touch);
    pad.classList.toggle('portrait', !!L.portrait);
    if (touch) for (const n in els) place(els[n], L[n]);
    updatePadVisibility();
  }
  function updatePadVisibility() {
    const playing = game && (game.state === 'play' || game.state === 'dead');
    const show = G.isTouch && playing;
    pad.classList.toggle('off', !show);
    if (G.padLayout) G.padLayout.visible = show;
  }
  window.addEventListener('resize', layout);
  window.addEventListener('orientationchange', () => setTimeout(layout, 120));

  G.toggleFullscreen = function () {
    const d = document,
      el = d.documentElement;
    try {
      if (!d.fullscreenElement && !d.webkitFullscreenElement) {
        const req = el.requestFullscreen || el.webkitRequestFullscreen;
        if (req) {
          const p = req.call(el);
          if (p && p.then)
            p.then(() => {
              if (screen.orientation && screen.orientation.lock) screen.orientation.lock('landscape').catch(() => {});
            }).catch(() => {});
        }
      } else {
        const ex = d.exitFullscreen || d.webkitExitFullscreen;
        if (ex) ex.call(d);
      }
    } catch (e) {}
  };

  // ---------------- ゲーム ----------------
  const game = new G.Game();
  window.__game = game;
  G.game = game;

  G.autoShot = G.Audio.settings.autoShot !== false;
  G.setAutoShot = (on) => {
    G.Audio.settings.autoShot = on;
    G.autoShot = on;
    G.Audio.saveSettings();
  };

  function titleMenus() {
    const A = G.Audio;
    game.titleMode = game.titleMode || 'main';
    if (game.titleMode === 'main') {
      game.titleMenu = new G.UI.Menu([
        { label: 'はじめから', action: () => setTitleMode('diff') },
        { label: 'つづきから', disabled: !game.hasContinue(), action: () => startGame(() => game.continueGame()) },
        { label: 'せってい', action: () => setTitleMode('settings') },
      ]);
      if (game.hasContinue()) game.titleMenu.sel = 1;
    } else if (game.titleMode === 'diff') {
      game.titleMenu = new G.UI.Menu(
        [
          { label: 'ふつう', action: () => startGame(() => game.newGame('normal')) },
          { label: 'やさしい（セーブ多め）', action: () => startGame(() => game.newGame('easy')) },
          { label: 'もどる', action: () => setTitleMode('main') },
        ],
        { back: () => setTitleMode('main') }
      );
    } else if (game.titleMode === 'settings') {
      let confirmDel = false;
      game.titleMenu = new G.UI.Menu(
        [
          { label: () => 'BGM: ' + (A.settings.bgm ? 'ON' : 'OFF'), action: () => A.setBgm(!A.settings.bgm) },
          { label: () => '効果音: ' + (A.settings.se ? 'ON' : 'OFF'), action: () => A.setSe(!A.settings.se) },
          { label: () => 'ボス戦オートショット: ' + (G.autoShot ? 'ON' : 'OFF'), action: () => G.setAutoShot(!G.autoShot) },
          { label: '全画面きりかえ', action: () => G.toggleFullscreen() },
          {
            label: () => (confirmDel ? 'もう一度押すと消去' : 'セーブデータ消去'),
            action: () => {
              if (!confirmDel) {
                confirmDel = true;
                return;
              }
              try {
                localStorage.removeItem('iwktm_save_v1');
              } catch (e) {}
              game.persist = null;
              game.stats = { clears: 0, best: null };
              confirmDel = false;
              setTitleMode('main');
            },
          },
          { label: 'もどる', action: () => setTitleMode('main') },
        ],
        { back: () => setTitleMode('main') }
      );
    }
  }
  function setTitleMode(m) {
    game.titleMode = m;
    titleMenus();
  }
  function startGame(fn) {
    fn();
    game.titleScene = null;
    updatePadVisibility();
  }
  G.toTitle = function () {
    game.state = 'title';
    game.world = null;
    game._pauseMenu = null;
    game.titleMode = 'main';
    game.titleScene = { t: 0 };
    titleMenus();
    G.music('title');
    updatePadVisibility();
  };

  // タイトル画面の背景シーン（放置すると月が落ちてくる）
  function updateTitleScene() {
    const ts = game.titleScene;
    ts.t++;
    if (!ts.gag && ts.t === 60 * 40) {
      ts.gag = 'fall';
      ts.moonY = -60;
      ts.vy = 0;
      G.sfx('whoosh');
    }
    if (ts.gag === 'fall') {
      ts.vy += 0.35;
      ts.moonY += ts.vy;
      if (ts.moonY >= 214) {
        ts.gag = 'dead';
        ts.gagT = 0;
        ts.gagText = 'タイトル画面でも油断してはいけない。';
        G.sfx('death');
        G.sfx('thud');
        ts.blood = [];
        for (let i = 0; i < 70; i++) {
          const a = G.fx.range(0, Math.PI * 2),
            s = G.fx.range(0.5, 4);
          ts.blood.push({ x: 240, y: 230, vx: Math.cos(a) * s, vy: Math.sin(a) * s - 2, life: 200 });
        }
      }
    } else if (ts.gag === 'dead') {
      ts.gagT++;
      for (const b of ts.blood) {
        if (b.y < 240) {
          b.vy += 0.2;
          b.x += b.vx;
          b.y += b.vy;
        }
      }
      if (ts.gagT > 220) game.titleScene = { t: 0 };
    }
  }
  function drawTitleScene(c) {
    const ts = game.titleScene || { t: 0 };
    const t = ts.t;
    const g = c.createLinearGradient(0, 0, 0, SH);
    g.addColorStop(0, '#05041a');
    g.addColorStop(0.6, '#1a1250');
    g.addColorStop(1, '#3a2470');
    c.fillStyle = g;
    c.fillRect(0, 0, SW, SH);
    for (let i = 0; i < 110; i++) {
      const x = G.Render.hash2(i, 1, 9) * SW,
        y = G.Render.hash2(i, 2, 9) * SH * 0.85;
      const tw = Math.sin(t * 0.04 + i * 2.1);
      c.fillStyle = tw > 0.5 ? '#ffffff' : tw > -0.4 ? '#a8b0ff' : '#5a5aa0';
      c.fillRect(Math.round(x), Math.round(y), 1, 1);
    }
    // 月
    if (ts.gag !== 'fall' && ts.gag !== 'dead') {
      const blink = t % 300 > 290;
      const img = G.SPR.moon(40, blink ? 'grin' : 'calm');
      c.drawImage(img, 380 - img.width / 2, 70 + Math.round(Math.sin(t * 0.02) * 3) - img.height / 2);
    }
    // 丘
    c.fillStyle = '#1a1038';
    c.beginPath();
    c.moveTo(0, SH);
    for (let x = 0; x <= SW; x += 4) c.lineTo(x, 236 + Math.sin(x * 0.012) * 8 + Math.sin(x * 0.04) * 3);
    c.lineTo(SW, SH);
    c.fill();
    c.fillStyle = '#120a28';
    c.fillRect(0, 244, SW, SH - 244);
    // 主人公
    if (ts.gag !== 'dead') c.drawImage(G.SPR.kid(Math.floor(t / 32) % 2 ? 'idle1' : 'idle0', 1, 1), 233, 228);
    if (ts.gag === 'fall' || ts.gag === 'dead') {
      const img = G.SPR.moon(40, ts.gag === 'dead' ? 'grin' : 'shock');
      c.drawImage(img, 240 - img.width / 2, Math.round(ts.moonY) - img.height / 2);
    }
    if (ts.blood)
      for (const b of ts.blood) {
        c.fillStyle = '#c8102e';
        c.fillRect(Math.round(b.x), Math.round(b.y), 1, 1);
      }
  }

  // ---------------- ループ ----------------
  function update() {
    G.pollInput();
    const inp = G.input;
    const taps = G.consumeTaps();
    if (game.state === 'title') {
      updateTitleScene();
      if (!(game.titleScene.gag === 'dead')) game.titleMenu.update(inp, taps);
    } else if (game.state === 'pause') {
      G.UI.pauseMenu(game).update(inp, taps);
      game.frame++;
    } else if (game.state === 'ending') {
      game.endT++;
      game.frame++;
      game.world.step(G.NO_INPUT);
      if (game.endT > 240 && (inp.jumpP || inp.okP || inp.shootP || taps.length)) G.toTitle();
    } else {
      if (game.state === 'dead' && taps.length && game.deadT > 10) game.retry();
      game.update(inp);
    }
    updatePadVisibility();
  }

  function render() {
    const v = G.view;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#07040e';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    let sx = 0,
      sy = 0;
    if (game.state === 'title') drawTitleScene(wctx);
    else if (game.world) {
      G.Render.drawWorld(wctx, game.world);
      const sh = game.world.shake;
      if (sh > 0) {
        sx = Math.round((G.fx.next() - 0.5) * Math.min(sh, 10) * 0.7);
        sy = Math.round((G.fx.next() - 0.5) * Math.min(sh, 10) * 0.7);
      }
    }
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(world, (v.x + sx * v.s) * dpr, (v.y + sy * v.s) * dpr, v.w * dpr, v.h * dpr);
    ctx.setTransform(v.s * dpr, 0, 0, v.s * dpr, v.x * dpr, v.y * dpr);
    ctx.imageSmoothingEnabled = true;
    G.UI.draw(ctx, game);
    if (G.padLayout && G.padLayout.portrait) {
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.strokeStyle = 'rgba(255,207,74,0.25)';
      ctx.lineWidth = 1;
      ctx.strokeRect(v.x + 0.5, v.y - 0.5, v.w - 1, v.h + 1);
    }
  }

  let last = performance.now(),
    acc = 0;
  function frame(now) {
    acc += Math.min(100, now - last);
    last = now;
    let n = 0;
    while (acc >= STEP && n < 5) {
      update();
      acc -= STEP;
      n++;
    }
    if (n === 5) acc = 0;
    render();
    requestAnimationFrame(frame);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      if (game.state === 'play') {
        game.state = 'pause';
        game._pauseMenu = null;
      }
      if (G.Audio.ctx) G.Audio.ctx.suspend();
    } else if (G.Audio.ctx) G.Audio.ctx.resume();
  });

  function boot() {
    layout();
    G.toTitle();
    if (DEBUG) {
      if (params.get('god')) G.god = true;
      const room = params.get('room');
      if (room && G.ROOMS[room]) {
        game.newGame(params.has('easy') ? 'easy' : 'normal');
        const m = G.findMark(room, 'S');
        game.saveData = m && G.ROOMS[room].map[m.ty][m.tx] === 'S' ? { room, tx: m.tx, ty: m.ty } : { room, tx: 1, ty: 11 };
        if (params.get('x')) game.saveData = { room, tx: +params.get('x'), ty: +params.get('y') };
        game.retry();
        game.titleScene = null;
        game.lastArea = null;
        game.areaBanner = null;
        game.showArea();
      }
    }
    requestAnimationFrame((t) => {
      last = t;
      requestAnimationFrame(frame);
    });
  }
  // フォント読み込みを少し待ってから開始
  const fontReady = document.fonts && document.fonts.load ? document.fonts.load('12px "DotGothic16"').catch(() => {}) : Promise.resolve();
  Promise.race([fontReady, new Promise((r) => setTimeout(r, 1500))]).then(boot);
})();
