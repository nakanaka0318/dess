// ヘッドレス実行環境：DOM なしでゲームのシミュレーション部分だけを読み込む
'use strict';
const vm = require('vm');
const fs = require('fs');
const path = require('path');

const CORE = ['util', 'world', 'entities', 'bosses', 'bosses2', 'rooms', 'rooms2', 'game'];

function load() {
  const ctx = { console };
  vm.createContext(ctx);
  vm.runInContext('globalThis.G = { headless: true };', ctx);
  for (const f of CORE) {
    const file = path.join(__dirname, '..', 'js', f + '.js');
    vm.runInContext(fs.readFileSync(file, 'utf8'), ctx, { filename: file });
  }
  const G = vm.runInContext('G', ctx);
  G.headless = true;
  return G;
}

const BTN = ['left', 'right', 'jump', 'shoot', 'retry', 'pause'];
class Runner {
  constructor(G, roomId, opts) {
    opts = opts || {};
    this.G = G;
    this.deaths = [];
    this.exits = [];
    const self = this;
    this.game = {
      diff: opts.diff || 'normal',
      flags: opts.flags || {},
      frame: 0,
      deaths: 0,
      save() {},
      onDeath(cause) {
        self.deaths.push({ cause, t: self.W.time, x: self.W.player.x, y: self.W.player.y });
      },
      changeRoom(dir) {
        self.exits.push({ dir, t: self.W.time });
        self.exited = dir;
      },
    };
    const sp = opts.spawn;
    this.W = new G.World(this.game, roomId, sp ? { spawn: sp, respawn: !!opts.respawn } : opts.enter ? { enter: opts.enter } : {});
    this.prev = {};
  }
  step(held) {
    const inp = {};
    for (const b of BTN) {
      const h = !!held[b];
      inp[b] = h;
      inp[b + 'P'] = h && !this.prev[b];
      inp[b + 'R'] = !h && !!this.prev[b];
      this.prev[b] = h;
    }
    this.game.frame++;
    this.W.step(inp);
    return this.W;
  }
}

function spawnAt(G, roomId, ch) {
  const m = G.findMark(roomId, ch || 'S');
  return { x: m.tx * G.T + (G.T - G.PHYS.PW) / 2, y: m.ty * G.T + G.T - G.PHYS.PH, face: 1 };
}

module.exports = { load, Runner, spawnAt };
