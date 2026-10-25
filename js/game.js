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

    // タイトルの設定から、つづきのセーブデータの難易度を変える
    setContinueDiff(diff) {
      if (!this.persist) return;
      this.persist.diff = diff;
      if (diff === 'easy') this.persist.easyUsed = true;
      store.save(this.persist);
    }
    hasContinue() {
      return !!(this.persist && this.persist.room && !this.persist.finished);
    }

    newGame(diff, stage) {
      this.diff = diff || 'normal';
      this.deaths = 0;
      this.playFrames = 0;
      this.flags = {};
      this.roomDeaths = {};
      this.easyUsed = this.diff === 'easy';
      this.startStageNo = stage && G.STAGES[stage] && G.ROOMS[G.STAGES[stage].start] ? stage : 1;
      if (this.startStageNo > 1) {
        // ステージセレクト：そのステージの最初から（前のステージは倒した扱いにして、戻っても戦いにならないように）
        for (let n = 1; n < this.startStageNo; n++) Object.assign(this.flags, G.STAGES[n].clearFlags || {}, { ['stage' + n + 'Clear']: true });
        this.lastArea = null;
        this.startStage(this.startStageNo);
        return;
      }
      const start = G.START_ROOM;
      const m = G.findMark(start, '@');
      this.saveData = { room: start, tx: m.tx, ty: m.ty, initial: true };
      this.writePersist();
      this.enterRoom(start, { spawn: this.spawnFromSave() }, true);
      this.lastArea = null;
      if (this.headless) {
        this.state = 'play';
        this.showArea();
      } else {
        // 短いプロローグ
        this.state = 'intro';
        this.introT = 0;
      }
    }
    continueGame() {
      const p = this.persist;
      this.diff = p.diff || 'normal';
      this.deaths = p.deaths || 0;
      this.playFrames = p.frames || 0;
      this.flags = p.flags || {};
      this.roomDeaths = p.roomDeaths || {};
      this.startStageNo = p.startStage || 1;
      this.easyUsed = !!p.easyUsed || this.diff === 'easy';
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
          roomDeaths: this.roomDeaths, stats: this.stats, finished: false, startStage: this.startStageNo || 1, easyUsed: !!this.easyUsed,
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
        if (a) {
          const st = G.STAGES[a.stage || 1];
          this.areaBanner = { title: a.title, sub: st ? `${st.title}  ${a.sub}` : a.sub, t: 0 };
        }
      }
    }
    stageOf(id) {
      const d = G.ROOMS[id];
      const a = d && G.AREAS[d.area];
      return (a && a.stage) || 1;
    }
    // ステージのボスを倒した：次のステージがあればクリア画面へ、最後ならエンディング
    // 次のステージへはボス部屋の出口が開いて、そのまま歩いて行ける
    stageClear() {
      const n = this.stageOf(this.world.id);
      this.flags['stage' + n + 'Clear'] = true;
      const nx = G.STAGES[n + 1];
      if (!nx || !G.ROOMS[nx.start]) return this.finish();
      if (this.world.openNext) this.world.openNext(true);
      this.clearedStage = n;
      this.stats.stageMax = Math.max(this.stats.stageMax || 1, n + 1);
      this.writePersist();
      this.state = 'stageclear';
      this.clearT = 0;
      this.areaBanner = null;
      if (!this.headless) G.music('ending');
    }
    // クリア画面を閉じて、ボス部屋から歩いて次のステージへ
    resumeAfterClear() {
      this.state = 'play';
      if (!this.headless) G.music(null);
    }
    // 遊んでいる途中で難易度を切り替える
    setDifficulty(diff) {
      this.diff = diff;
      if (diff === 'easy') this.easyUsed = true;
      if (this.world && this.world.setEasy) this.world.setEasy(diff === 'easy');
      this.writePersist();
    }
    startStage(n) {
      const st = G.STAGES[n];
      const m = G.findMark(st.start, '@');
      this.saveData = { room: st.start, tx: m.tx, ty: m.ty };
      this.writePersist();
      this.enterRoom(st.start, { spawn: this.spawnFromSave() });
      this.state = 'play';
      this.lastArea = null;
      this.showArea();
    }
    finish() {
      // エンディング到達
      this.stats.clears = (this.stats.clears || 0) + 1;
      const rec = { deaths: this.deaths, frames: this.playFrames, diff: this.easyUsed ? 'easy' : this.diff };
      // ベスト記録はステージ1から通しで遊んだ時だけ
      if ((this.startStageNo || 1) === 1 && (!this.stats.best || rec.deaths < this.stats.best.deaths)) this.stats.best = rec;
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
        case 'intro':
          this.introT++;
          if ((this.introT > 20 && (inp.jumpP || inp.okP || inp.shootP || inp.retryP)) || this.introT > 330) {
            this.state = 'play';
            this.showArea();
          }
          break;
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
        case 'stageclear':
          this.clearT++;
          this.world.step(G.NO_INPUT);
          if (this.clearT > 100 && (inp.jumpP || inp.okP || inp.shootP)) this.resumeAfterClear();
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
