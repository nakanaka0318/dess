// ゲーム全体の状態管理（タイトル／プレイ／死亡／ポーズ／エンディング、セーブ）
(function () {
  'use strict';
  const G = globalThis.G;
  const { T, PHYS } = G;
  const SAVE_KEY = 'iwktm_save_v1';

  const store = {
    load() {
      try {
        return JSON.parse(localStorage.getItem(SAVE_KEY) || 'null');
      } catch (e) {
        return null;
      }
    },
    save(d) {
      try {
        localStorage.setItem(SAVE_KEY, JSON.stringify(d));
      } catch (e) {}
    },
  };

  class Game {
    constructor(opts) {
      opts = opts || {};
      this.headless = !!opts.headless;
      this.state = 'title';
      this.frame = 0;
      this.world = null;
      this.diff = 'normal';
      this.deaths = 0;
      this.playFrames = 0;
      this.saveData = null;
      this.flags = {};
      this.deadT = 0;
      this.areaBanner = null;
      this.roomDeaths = {};
      this.persist = this.headless ? null : store.load();
      this.stats = this.persist && this.persist.stats ? this.persist.stats : { clears: 0, best: null };
    }

    hasContinue() {
      return !!(this.persist && this.persist.room && !this.persist.finished);
    }

    newGame(diff) {
      this.diff = diff || 'normal';
      this.deaths = 0;
      this.playFrames = 0;
      this.flags = {};
      this.roomDeaths = {};
      const start = G.START_ROOM;
      const m = G.findMark(start, '@');
      this.saveData = { room: start, tx: m.tx, ty: m.ty, initial: true };
      this.writePersist();
      this.enterRoom(start, { spawn: this.spawnFromSave() }, true);
      this.state = 'play';
      this.lastArea = null;
      this.showArea();
    }
    continueGame() {
      const p = this.persist;
      this.diff = p.diff || 'normal';
      this.deaths = p.deaths || 0;
      this.playFrames = p.frames || 0;
      this.flags = p.flags || {};
      this.roomDeaths = p.roomDeaths || {};
      this.saveData = { room: p.room, tx: p.tx, ty: p.ty };
      if (!G.ROOMS[p.room]) {
        const m = G.findMark(G.START_ROOM, '@');
        this.saveData = { room: G.START_ROOM, tx: m.tx, ty: m.ty };
      }
      this.enterRoom(this.saveData.room, { spawn: this.spawnFromSave(), respawn: true }, true);
      this.state = 'play';
      this.lastArea = null;
      this.showArea();
    }
    spawnFromSave() {
      const s = this.saveData;
      return { x: s.tx * T + (T - PHYS.PW) / 2, y: s.ty * T + T - PHYS.PH, face: 1 };
    }
    writePersist(extra) {
      if (this.headless) return;
      const s = this.saveData || {};
      this.persist = Object.assign(
        {
          room: s.room, tx: s.tx, ty: s.ty, diff: this.diff, deaths: this.deaths, frames: this.playFrames, flags: this.flags,
          roomDeaths: this.roomDeaths, stats: this.stats, finished: false,
        },
        extra || {}
      );
      store.save(this.persist);
    }

    enterRoom(id, opts, noMusic) {
      this.world = new G.World(this, id, opts);
      const def = G.ROOMS[id];
      if (!this.headless) {
        const mus = def.music || (G.AREAS[def.area] || {}).music;
        if (mus !== undefined) G.music(mus);
      }
      return this.world;
    }

    // ---- World からの通知 ----
    save(room, tx, ty) {
      this.saveData = { room, tx, ty };
      this.writePersist();
    }
    onDeath(cause) {
      this.deaths++;
      const id = this.world.id;
      this.roomDeaths[id] = (this.roomDeaths[id] || 0) + 1;
      this.state = 'dead';
      this.deadT = 0;
      this.areaBanner = null;
      this.cause = cause;
      if (!this.headless) {
        G.Audio.duck();
        this.writePersist();
      }
    }
    changeRoom(dir) {
      const W = this.world,
        P = W.player;
      const nid = W.exits[dir];
      if (!nid) return;
      const SW = G.W,
        SH = G.H;
      let x = P.x,
        y = P.y;
      if (dir === 'right') x -= SW;
      if (dir === 'left') x += SW;
      if (dir === 'up') y += SH;
      if (dir === 'down') y -= SH;
      // 下から上の部屋へ抜けた時は床に届くよう少し押し上げる
      const vy = dir === 'up' ? Math.min(P.vy, -5) : P.vy;
      const enter = { x, y, vy, djump: P.djump, face: P.face, xr: P.xr, yr: P.yr, jumpHeld: P.jumpHeld, from: W.id, dir };
      this.enterRoom(nid, { enter });
      this.showArea();
    }
    retry() {
      if (!this.saveData) return;
      this.enterRoom(this.saveData.room, { spawn: this.spawnFromSave(), respawn: true });
      this.state = 'play';
    }
    showArea() {
      const def = this.world.def;
      if (def.area && def.area !== this.lastArea) {
        this.lastArea = def.area;
        const a = G.AREAS[def.area];
        if (a) this.areaBanner = { title: a.title, sub: a.sub, t: 0 };
      }
    }
    finish() {
      // エンディング到達
      this.stats.clears = (this.stats.clears || 0) + 1;
      const rec = { deaths: this.deaths, frames: this.playFrames, diff: this.diff };
      if (!this.stats.best || rec.deaths < this.stats.best.deaths) this.stats.best = rec;
      this.writePersist({ finished: true });
      this.state = 'ending';
      this.endT = 0;
      this.areaBanner = null;
      G.music('ending');
    }

    update(inp) {
      this.frame++;
      if (this.areaBanner) {
        this.areaBanner.t++;
        if (this.areaBanner.t > 200) this.areaBanner = null;
      }
      switch (this.state) {
        case 'play':
          if (inp.pauseP) {
            this.state = 'pause';
            this.menuSel = 0;
            G.sfx('select');
            return;
          }
          if (inp.retryP) {
            this.retry();
            return;
          }
          this.world.step(inp);
          this.playFrames++;
          if (this.playFrames % 600 === 0) this.writePersist();
          break;
        case 'dead':
          this.deadT++;
          this.world.step(G.NO_INPUT);
          if (this.deadT > 10 && (inp.jumpP || inp.retryP || inp.shootP || inp.okP)) this.retry();
          break;
        default:
          break;
      }
    }
  }
  G.Game = Game;
  G.NO_INPUT = {
    left: false, right: false, jump: false, shoot: false, jumpP: false, jumpR: false, shootP: false, shootR: false, retryP: false, pauseP: false,
  };

  G.findMark = function (id, ch) {
    const map = G.ROOMS[id].map;
    for (let ty = 0; ty < map.length; ty++) {
      const tx = map[ty].indexOf(ch);
      if (tx >= 0) return { tx, ty };
    }
    return { tx: 1, ty: 11 };
  };
})();
