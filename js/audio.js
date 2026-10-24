// サウンド：WebAudio で効果音とチップチューンBGMを合成
(function () {
  'use strict';
  const G = globalThis.G;
  const A = (G.Audio = {
    ctx: null,
    settings: { bgm: true, se: true },
    cur: null,
    curName: null,
  });

  try {
    const s = JSON.parse(localStorage.getItem('iwktm_settings') || 'null');
    if (s) Object.assign(A.settings, s);
  } catch (e) {}
  A.saveSettings = () => {
    try {
      localStorage.setItem('iwktm_settings', JSON.stringify(A.settings));
    } catch (e) {}
  };

  const waves = {};
  let noiseBuf = null;

  A.unlock = function () {
    if (!A.ctx) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      try {
        A.ctx = new AC();
      } catch (e) {
        return;
      }
      const c = A.ctx;
      A.master = c.createGain();
      A.master.gain.value = 0.9;
      const comp = c.createDynamicsCompressor();
      comp.threshold.value = -14;
      comp.ratio.value = 4;
      A.master.connect(comp).connect(c.destination);
      A.sfxGain = c.createGain();
      A.sfxGain.gain.value = A.settings.se ? 0.55 : 0;
      A.sfxGain.connect(A.master);
      A.bgmGain = c.createGain();
      A.bgmGain.gain.value = A.settings.bgm ? 0.42 : 0;
      A.bgmGain.connect(A.master);
      for (const d of [0.125, 0.25, 0.5]) waves[d] = pulseWave(c, d);
      noiseBuf = c.createBuffer(1, c.sampleRate * 1, c.sampleRate);
      const data = noiseBuf.getChannelData(0);
      for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
      // 無音を鳴らして iOS のロックを解除
      const b = c.createBuffer(1, 1, 22050);
      const src = c.createBufferSource();
      src.buffer = b;
      src.connect(c.destination);
      src.start(0);
      setInterval(schedule, 25);
      if (A.pending) {
        const p = A.pending;
        A.pending = null;
        A.play(p);
      }
    }
    if (A.ctx.state === 'suspended') A.ctx.resume();
  };
  for (const ev of ['pointerdown', 'pointerup', 'touchend', 'keydown']) window.addEventListener(ev, A.unlock, { passive: true });

  function pulseWave(c, duty) {
    const n = 64;
    const re = new Float32Array(n),
      im = new Float32Array(n);
    for (let i = 1; i < n; i++) re[i] = ((2 / (i * Math.PI)) * Math.sin(i * Math.PI * duty));
    return c.createPeriodicWave(re, im);
  }

  A.setBgm = (on) => {
    A.settings.bgm = on;
    A.saveSettings();
    if (A.bgmGain) A.bgmGain.gain.setTargetAtTime(on ? 0.42 : 0, A.ctx.currentTime, 0.05);
  };
  A.setSe = (on) => {
    A.settings.se = on;
    A.saveSettings();
    if (A.sfxGain) A.sfxGain.gain.setTargetAtTime(on ? 0.55 : 0, A.ctx.currentTime, 0.05);
  };

  // ---------------- 効果音 ----------------
  function tone(o) {
    const c = A.ctx;
    const t = c.currentTime + (o.delay || 0);
    const osc = c.createOscillator();
    if (o.duty) osc.setPeriodicWave(waves[o.duty]);
    else osc.type = o.type || 'square';
    osc.frequency.setValueAtTime(o.f0, t);
    if (o.f1) {
      if (o.lin) osc.frequency.linearRampToValueAtTime(o.f1, t + o.dur);
      else osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.f1), t + o.dur);
    }
    const g = c.createGain();
    const v = o.vol == null ? 0.2 : o.vol;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(v, t + (o.att || 0.003));
    if (o.hold) g.gain.setValueAtTime(v, t + o.hold);
    g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
    osc.connect(g).connect(o.out || A.sfxGain);
    osc.start(t);
    osc.stop(t + o.dur + 0.05);
  }
  function noise(o) {
    const c = A.ctx;
    const t = c.currentTime + (o.delay || 0);
    const src = c.createBufferSource();
    src.buffer = noiseBuf;
    src.loop = true;
    const f = c.createBiquadFilter();
    f.type = o.ft || 'lowpass';
    f.frequency.setValueAtTime(o.f0 || 3000, t);
    if (o.f1) f.frequency.exponentialRampToValueAtTime(o.f1, t + o.dur);
    f.Q.value = o.q || 1;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(o.vol || 0.2, t + (o.att || 0.002));
    g.gain.exponentialRampToValueAtTime(0.0001, t + o.dur);
    src.connect(f).connect(g).connect(o.out || A.sfxGain);
    src.start(t, Math.random() * 0.5);
    src.stop(t + o.dur + 0.05);
  }

  const lastPlay = {};
  const SFX = {
    jump: () => tone({ duty: 0.5, f0: 280, f1: 560, dur: 0.09, vol: 0.12 }),
    djump: () => tone({ duty: 0.25, f0: 420, f1: 900, dur: 0.1, vol: 0.12 }),
    shoot: () => tone({ duty: 0.25, f0: 1100, f1: 500, dur: 0.05, vol: 0.06 }),
    bonk: () => tone({ type: 'triangle', f0: 180, f1: 90, dur: 0.06, vol: 0.18 }),
    death: () => {
      noise({ f0: 4000, f1: 200, dur: 0.45, vol: 0.32 });
      tone({ duty: 0.5, f0: 520, f1: 50, dur: 0.5, vol: 0.18 });
      tone({ type: 'sine', f0: 90, f1: 30, dur: 0.4, vol: 0.4 });
    },
    save: () => {
      [784, 988, 1175, 1568].forEach((f, i) => tone({ duty: 0.25, f0: f, dur: 0.12, vol: 0.1, delay: i * 0.05 }));
    },
    pop: () => tone({ duty: 0.5, f0: 900, f1: 300, dur: 0.06, vol: 0.12 }),
    trap: () => {
      noise({ ft: 'bandpass', f0: 600, f1: 3000, dur: 0.18, vol: 0.18, q: 2 });
    },
    whoosh: () => noise({ ft: 'bandpass', f0: 3000, f1: 400, dur: 0.25, vol: 0.15, q: 1.5 }),
    thud: () => {
      tone({ type: 'sine', f0: 140, f1: 35, dur: 0.3, vol: 0.5 });
      noise({ f0: 900, f1: 100, dur: 0.25, vol: 0.25 });
    },
    boing: () => tone({ type: 'sine', f0: 200, f1: 620, dur: 0.18, vol: 0.25 }),
    splat: () => noise({ f0: 2500, f1: 300, dur: 0.12, vol: 0.18 }),
    crumble: () => noise({ ft: 'bandpass', f0: 500, dur: 0.25, vol: 0.18, q: 0.8 }),
    reveal: () => tone({ type: 'triangle', f0: 1200, f1: 1600, dur: 0.08, vol: 0.12 }),
    hit: () => tone({ duty: 0.125, f0: 260, f1: 160, dur: 0.05, vol: 0.12 }),
    bosshit: () => {
      tone({ duty: 0.5, f0: 200, f1: 120, dur: 0.07, vol: 0.12 });
    },
    explode: () => {
      noise({ f0: 2000, f1: 60, dur: 0.7, vol: 0.4 });
      tone({ type: 'sine', f0: 110, f1: 30, dur: 0.6, vol: 0.4 });
    },
    bigexplode: () => {
      noise({ f0: 3000, f1: 40, dur: 1.6, vol: 0.5 });
      tone({ type: 'sine', f0: 90, f1: 20, dur: 1.4, vol: 0.5 });
      tone({ duty: 0.5, f0: 300, f1: 40, dur: 1.2, vol: 0.12 });
    },
    select: () => tone({ duty: 0.25, f0: 660, dur: 0.04, vol: 0.08 }),
    ok: () => {
      tone({ duty: 0.25, f0: 880, dur: 0.06, vol: 0.1 });
      tone({ duty: 0.25, f0: 1320, dur: 0.1, vol: 0.1, delay: 0.06 });
    },
    flip: () => tone({ type: 'sine', f0: 300, f1: 900, dur: 0.15, vol: 0.2 }),
    spring: () => tone({ type: 'square', f0: 200, f1: 800, dur: 0.15, vol: 0.12 }),
    ping: () => tone({ type: 'triangle', f0: 1800, f1: 2400, dur: 0.07, vol: 0.12 }),
    switch: () => {
      tone({ duty: 0.5, f0: 500, dur: 0.05, vol: 0.12 });
      tone({ duty: 0.5, f0: 750, dur: 0.08, vol: 0.12, delay: 0.05 });
    },
    laser: () => {
      noise({ ft: 'highpass', f0: 1500, dur: 0.35, vol: 0.15 });
      tone({ type: 'sawtooth', f0: 900, f1: 300, dur: 0.35, vol: 0.08 });
    },
    charge: () => tone({ type: 'sine', f0: 200, f1: 1200, dur: 0.6, vol: 0.12, lin: true }),
    warn: () => {
      tone({ duty: 0.5, f0: 880, dur: 0.12, vol: 0.1 });
      tone({ duty: 0.5, f0: 660, dur: 0.12, vol: 0.1, delay: 0.14 });
    },
    rumble: () => noise({ f0: 200, dur: 0.8, vol: 0.3, att: 0.2 }),
    scratch: () => {
      noise({ ft: 'bandpass', f0: 1200, f1: 300, dur: 0.35, vol: 0.4, q: 3 });
      tone({ type: 'sawtooth', f0: 600, f1: 80, dur: 0.35, vol: 0.12 });
    },
    blip: () => tone({ duty: 0.5, f0: 1500, dur: 0.02, vol: 0.04 }),
    stomp: () => {
      tone({ type: 'sine', f0: 100, f1: 30, dur: 0.35, vol: 0.55 });
      noise({ f0: 600, f1: 80, dur: 0.35, vol: 0.3 });
    },
    fanfare: () => {
      const n = [523, 659, 784, 1047, 784, 1047];
      n.forEach((f, i) => tone({ duty: 0.25, f0: f, dur: i === 5 ? 0.6 : 0.14, vol: 0.12, delay: i * 0.12 }));
    },
    roar: () => {
      tone({ type: 'sawtooth', f0: 120, f1: 60, dur: 0.9, vol: 0.18 });
      noise({ ft: 'bandpass', f0: 400, dur: 0.9, vol: 0.2, q: 1 });
    },
  };
  G.sfx = function (name) {
    if (!A.ctx || !A.settings.se) return;
    const now = A.ctx.currentTime;
    if (lastPlay[name] && now - lastPlay[name] < 0.03) return;
    lastPlay[name] = now;
    const f = SFX[name];
    if (f) f();
  };
  G.vibrate = function (ms) {
    try {
      if (navigator.vibrate) navigator.vibrate(ms);
    } catch (e) {}
  };

  // ---------------- BGM シーケンサ ----------------
  const NOTE = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  function freq(tok) {
    const m = /^([A-G])([#b]?)(\d)$/.exec(tok);
    if (!m) return null;
    let n = NOTE[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0) + (+m[3] + 1) * 12;
    return 440 * Math.pow(2, (n - 69) / 12);
  }
  // "(a b)*2" の繰り返し展開
  function expand(s) {
    let prev;
    do {
      prev = s;
      s = s.replace(/\(([^()]*)\)\*(\d+)/g, (_, body, n) => Array(+n).fill(body).join(' '));
    } while (s !== prev);
    return s.replace(/\|/g, ' ').trim().split(/\s+/);
  }
  function compile(song) {
    const out = { bpm: song.bpm, ch: [] };
    for (const ch of song.ch) {
      const toks = expand(ch.seq);
      const evs = [];
      for (let i = 0; i < toks.length; i++) {
        const t = toks[i];
        if (t === '.' || t === '-') continue;
        let len = 1;
        while (i + len < toks.length && toks[i + len] === '.') len++;
        evs.push({ step: i, tok: t, f: ch.inst === 'drum' ? null : freq(t), len });
      }
      const byStep = new Array(toks.length);
      for (const e of evs) (byStep[e.step] = byStep[e.step] || []).push(e);
      out.ch.push({ inst: ch.inst, vol: ch.vol, len: toks.length, byStep, gate: ch.gate || 0.9 });
    }
    return out;
  }
  const compiled = {};

  A.play = function (name) {
    if (!name) return A.stop();
    if (A.curName === name) return;
    if (!A.ctx) {
      A.pending = name;
      return;
    }
    const songDef = G.SONGS[name];
    if (!songDef) return;
    const song = compiled[name] || (compiled[name] = compile(songDef));
    A.stop(0.25);
    const g = A.ctx.createGain();
    g.gain.value = 1;
    g.connect(A.bgmGain);
    A.cur = { song, gain: g, step: 0, next: A.ctx.currentTime + 0.08, name };
    A.curName = name;
  };
  A.stop = function (fade) {
    if (A.cur && A.ctx) {
      const g = A.cur.gain;
      const t = A.ctx.currentTime;
      g.gain.setValueAtTime(g.gain.value, t);
      g.gain.linearRampToValueAtTime(0.0001, t + (fade || 0.05));
      setTimeout(() => g.disconnect(), ((fade || 0.05) + 0.3) * 1000);
    }
    A.cur = null;
    A.curName = null;
  };
  A.duck = function () {
    if (!A.cur || !A.ctx) return;
    const g = A.cur.gain.gain,
      t = A.ctx.currentTime;
    g.cancelScheduledValues(t);
    g.setValueAtTime(0.25, t);
    g.linearRampToValueAtTime(1, t + 0.9);
  };
  G.music = (n) => A.play(n);

  function schedule() {
    const c = A.ctx;
    if (!c || !A.cur) return;
    const cur = A.cur;
    const sd = 60 / cur.song.bpm / 4;
    while (cur.next < c.currentTime + 0.12) {
      for (const ch of cur.song.ch) {
        const evs = ch.byStep[cur.step % ch.len];
        if (evs) for (const e of evs) playNote(ch, e, cur.next, sd, cur.gain);
      }
      cur.step++;
      cur.next += sd;
    }
  }

  function playNote(ch, e, t, sd, out) {
    const c = A.ctx;
    if (ch.inst === 'drum') {
      const v = ch.vol;
      if (e.tok === 'k') {
        const o = c.createOscillator(),
          g = c.createGain();
        o.type = 'sine';
        o.frequency.setValueAtTime(150, t);
        o.frequency.exponentialRampToValueAtTime(40, t + 0.12);
        g.gain.setValueAtTime(v * 1.6, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.14);
        o.connect(g).connect(out);
        o.start(t);
        o.stop(t + 0.16);
      } else {
        const src = c.createBufferSource();
        src.buffer = noiseBuf;
        const f = c.createBiquadFilter(),
          g = c.createGain();
        const dur = e.tok === 's' ? 0.12 : e.tok === 'o' ? 0.14 : 0.035;
        f.type = e.tok === 's' ? 'bandpass' : 'highpass';
        f.frequency.value = e.tok === 's' ? 1800 : 7000;
        g.gain.setValueAtTime(v * (e.tok === 's' ? 1.1 : 0.45), t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
        src.connect(f).connect(g).connect(out);
        src.start(t, Math.random() * 0.5);
        src.stop(t + dur + 0.02);
      }
      return;
    }
    if (!e.f) return;
    const o = c.createOscillator();
    if (ch.inst === 'tri') o.type = 'triangle';
    else if (ch.inst === 'saw') o.type = 'sawtooth';
    else if (ch.inst === 'sine') o.type = 'sine';
    else o.setPeriodicWave(waves[{ sq12: 0.125, sq25: 0.25, sq50: 0.5 }[ch.inst] || 0.25]);
    o.frequency.setValueAtTime(e.f, t);
    const g = c.createGain();
    const dur = e.len * sd * ch.gate;
    const v = ch.vol;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.linearRampToValueAtTime(v, t + 0.006);
    g.gain.setTargetAtTime(v * 0.7, t + 0.02, 0.08);
    g.gain.setValueAtTime(v * 0.7, t + Math.max(0.02, dur - 0.02));
    g.gain.linearRampToValueAtTime(0.0001, t + dur + 0.03);
    o.connect(g).connect(out);
    o.start(t);
    o.stop(t + dur + 0.06);
  }
})();
