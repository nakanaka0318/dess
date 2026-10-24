// 罠の「初見殺し度」の確認：罠を知らないプレイヤー（ふつうに走り抜ける）は死に、
// 罠を知っているプレイヤー（human.js の手順）は突破できるか
// 使い方: node tools/traps.js [roomId ...]
'use strict';
const { run, S, G } = require('./human');

// 罠を知らない人の動き。expect は死因（正規表現）
const NAIVE = [
  { id: '1-1', name: '木のリンゴ', from: '@', steps: [{ go: 500 }], expect: /落ちてくる/ },
  { id: '1-1', name: '穴のリンゴ', from: '@', steps: [{ go: 142 }, { wait: 40 }, { go: 192 }, { jump: 'R', hold: 14 }, { go: 500 }], expect: /上にも/ },
  { id: '1-1', name: '穴のリンゴ(手前で跳ぶ)', from: '@', steps: [{ go: 142 }, { wait: 40 }, { go: 184 }, { jump: 'R', hold: 16 }, { go: 500 }], expect: /上にも/ },
  { id: '1-1', name: '看板の先のトゲ', from: '@', steps: [{ go: 142 }, { wait: 40 }, { go: 196 }, { wait: 45 }, { jump: 'R', hold: 14 }, { go: 500 }], expect: /看板/ },
  { id: '1-2', name: '抜ける橋', from: 'S', steps: [{ go: 500 }], expect: /トゲ/ },
  { id: '1-2', name: '落ちる月', from: 'S', steps: [{ go: 104 }, { jump: 'R', hold: 12 }, { go: 500 }], expect: /月/ },
  { id: '1-3', name: '跳ねるトゲ', from: 'S', steps: [{ go: 108 }, { jump: 'R', hold: 14 }, { go: 214 }], expect: /トゲもジャンプ/ },
  { id: '1-3', name: '天井のトゲ', base: '1-3', cut: 'wait70', expect: /一呼吸/ },
  { id: '1-3', name: '岩棚を砕く月', base: '1-3', cut: 'wait72', expect: /月|奈落/ },
  { id: '2-1', name: 'ドッスン①', from: 'S', steps: [{ go: 420 }], expect: /ドッスン/ },
  { id: '2-1', name: 'ドッスン②（二度落ち）', from: 'S', steps: [{ go: 96 }, { wait: 40 }, { go: 180 }, { go: 196 }, { wait: 50 }, { go: 420 }], expect: /ドッスン/ },
  { id: '2-1', name: 'ドッスン③（真下で止まる）', base: '2-1', replaceTail: [{ go: 352 }, { wait: 60 }], expect: /ドッスン/ },
  { id: '2-2', name: 'つらら①', from: 'S', steps: [{ go: -20 }], expect: /つららが/ },
  { id: '2-2', name: 'つらら②（真下で待つ）', from: 'S', steps: [{ go: 378 }, { go: 372 }, { go: 386 }, { wait: 30 }, { go: 290 }, { wait: 60 }], expect: /立ち止まった/ },
  { id: '2-2', name: '穴を跳ぶとつらら', from: 'S', steps: [{ go: 378 }, { go: 372 }, { go: 386 }, { wait: 30 }, { go: 312 }, { go: 330 }, { wait: 60 }, { go: 276 }, { jump: 'L', hold: 12 }, { go: 186 }, { jump: 'L', hold: 4 }, { go: -20 }], expect: /ジャンプした瞬間/ },
  { id: '3-2', name: '上に落ちるリンゴ', base: '3-2', cut: 'wait60', expect: /さかさま/ },
  { id: '4-3', name: '月のリンゴ', base: '4-3', cut: 'wait90', expect: /月からの贈り物/ },
  // 1面に追加した理不尽
  { id: '1-1', name: '見えないブロック', from: '@', steps: [{ go: 142 }, { wait: 40 }, { go: 196 }, { wait: 45 }, { jump: 'R', hold: 14 }, { go: 318 }, { jump: 'R', hold: 12 }, { go: 392 }, { jump: 'R', hold: 20 }, { go: 500 }], expect: /見えない/ },
  { id: '1-2', name: '戻ってくる月', from: 'S', steps: [{ go: 50 }, { jump: 'R', hold: 10 }, { go: 104 }, { jump: 'R', hold: 12 }, { go: 160 }, { jump: 'R', hold: 10 }, { go: 290 }, { go: 330 }, { wait: 90 }, { go: 500 }], expect: /戻って/ },
  { id: '1-3', name: '抜ける足場', from: 'S', steps: [{ go: 92 }, { jump: 0, hold: 6 }, { wait: 30 }, { go: 214 }, { jump: 'R', hold: 14, steerFrames: 24 }, { go: 272 }, { jump: 'R', hold: 16, dj: 18, djHold: 14, steerFrames: 50 }, { wait: 40 }, { go: 374 }], expect: /トゲ|刺さ|痛い|鋭い|仲良く|触れて/ },
  { id: '1-4', name: 'セーブ直後のリンゴ', enter: { x: 86, y: 262, vy: -5 }, steps: [{ wait: 90 }], expect: /セーブした直後/ },
  { id: '2-1', name: '後ろから転がるリンゴ', from: 'S', steps: [{ go: 96 }, { wait: 40 }, { go: 180 }, { go: 196 }, { wait: 200 }], expect: /上ばかり/ },
  { id: '2-2', name: '本気のベルト', from: 'S', steps: [{ go: 378 }, { go: 372 }, { go: 386 }, { wait: 30 }, { go: 312 }, { go: 330 }, { wait: 60 }, { go: 276 }, { jump: 'L', hold: 12 }, { go: 206 }, { wait: 50 }, { go: 186 }, { jump: 'L', hold: 4 }, { go: -20 }], expect: /本気を出した/ },
  { id: '2-4', name: '着地点のトゲ', enter: { x: 146, y: 226 }, steps: [{ jump: 'L', hold: 16 }, { go: -20 }], goal: 'left', expect: /気がゆるんだ/ },
  { id: '3-1', name: '前からのトゲ', base: '3-1', replaceJump: { jump: 'L', hold: 16 }, expect: /前に注意/ },
  { id: '3-4', name: 'THE END の文字', enter: { x: 206, y: 262, vy: -5 }, steps: [{ wait: 240 }], expect: /THE END/ },
];

// human.js の手順を途中まで使う（cut: 指定した wait を消してすぐ進む）
function derive(n) {
  const base = S[n.base];
  let steps = base.steps.slice();
  if (n.cut) {
    const w = +n.cut.replace('wait', '');
    const i = steps.findIndex((s) => s.wait === w);
    steps.splice(i, 1);
  }
  if (n.replaceJump) {
    const i = steps.map((s) => !!s.dj).lastIndexOf(true);
    steps[i] = n.replaceJump;
  }
  if (n.replaceTail) {
    const i = steps.findIndex((s) => s.go === 278);
    steps = steps.slice(0, i).concat(n.replaceTail);
  }
  return Object.assign({}, base, { steps });
}

// 人が「何か動いた」と気づいてから止まるまでのフレーム数（0.25秒）
const REACT = 15;
function evalNaive(n, N) {
  const script = Object.assign(n.base ? derive(n) : { from: n.from, steps: n.steps, goal: n.goal, enter: n.enter }, { react: REACT });
  const rng = new G.RNG(7);
  let hit = 0;
  const seen = {};
  for (let i = 0; i < N; i++) {
    const r = run(n.id, script, i === 0 ? null : rng);
    const c = r.death || (r.ok ? '(突破)' : r.exit || 'stuck');
    seen[c] = (seen[c] || 0) + 1;
    if (r.death && n.expect.test(r.death)) hit++;
  }
  return { pct: Math.round((hit / N) * 100), seen };
}
module.exports = { NAIVE, evalNaive };
if (require.main !== module) return;

const only = process.argv.slice(2).filter((a) => !a.startsWith('--'));
let bad = 0;
for (const n of NAIVE) {
  if (only.length && !only.includes(n.id)) continue;
  const script = Object.assign(n.base ? derive(n) : { from: n.from, steps: n.steps, goal: n.goal, enter: n.enter }, { react: REACT });
  const rng = new G.RNG(7);
  let hit = 0;
  const N = 20;
  const seen = {};
  for (let i = 0; i < N; i++) {
    const r = run(n.id, script, i === 0 ? null : rng);
    const c = r.death || (r.ok ? '(突破)' : r.exit || 'stuck');
    seen[c] = (seen[c] || 0) + 1;
    if (r.death && n.expect.test(r.death)) hit++;
  }
  const pct = Math.round((hit / N) * 100);
  if (pct < 70) bad++;
  console.log(`${n.id} ${n.name}: 初見で死ぬ率 ${pct}%  ${Object.entries(seen).map(([k, v]) => k + '×' + v).join(' / ')}`);
}
process.exit(bad ? 1 : 0);
