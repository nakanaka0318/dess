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
  // 2面
  { id: '5-1', name: 'だるまサボテン', from: '@', steps: [{ go: 124 }, { jump: 'R', hold: 14 }, { go: 196 }, { jump: 'R', hold: 14 }, { go: 500 }], expect: /だるまさん/ },
  { id: '5-1', name: '砂の柱', enter: { x: 310, y: 226 }, steps: [{ go: 352 }, { jump: 'R', hold: 12 }, { go: 500 }], expect: /砂の中/ },
  { id: '5-1', name: '先回りの日差し', enter: { x: 410, y: 226 }, steps: [{ go: 500 }], expect: /先回り/ },
  { id: '5-2', name: '砂嵐', from: 'S', steps: [{ wait: 100 }, { go: 74 }, { jump: 'R', hold: 16 }, { go: 500 }], expect: /砂嵐/ },
  { id: '5-2', name: '蜃気楼の足場', enter: { x: 226, y: 226 }, steps: [{ wait: 160 }, { go: 236 }, { jump: 'R', hold: 14 }, { wait: 30 }, { go: 500 }], expect: /蜃気楼|トゲ|刺さ|痛い|鋭い|仲良く|触れて/ },
  { id: '5-2', name: '下降気流', enter: { x: 340, y: 226 }, steps: [{ go: 372 }, { jump: 'R', hold: 14 }, { go: 500 }], expect: /下降気流/ },
  { id: '5-3', name: '床の板', from: 'S', steps: [{ go: 500 }], expect: /罠を踏んだ/ },
  { id: '5-3', name: 'お宝', enter: { x: 180, y: 226 }, steps: [{ go: 500 }], expect: /お宝/ },
  { id: '5-3', name: '落とし穴', enter: { x: 300, y: 226 }, steps: [{ go: 500 }], expect: /落とし穴/ },
  { id: '6-1', name: 'フェイントの炎', enter: { x: 300, y: 226 }, steps: [{ go: 500 }], expect: /フェイント/ },
  { id: '6-2', name: '出口のトゲ', enter: { x: 236, y: 66 }, steps: [{ jump: 0, hold: 16, dj: 18, djHold: 14 }, { wait: 30 }], goal: 'up', expect: /出口にも/ },
  { id: '6-3', name: '落ちる天井', from: 'S', steps: [{ go: 500 }], expect: /天井/ },
  // 3面
  { id: '7-1', name: '重力が戻る', from: 'S', steps: [{ go: 92 }, { jump: 'R', hold: 12 }, { go: 500 }], expect: /重力が急に/ },
  { id: '7-1', name: 'スペースデブリ', enter: { x: 384, y: 226 }, steps: [{ go: 500 }], expect: /デブリ/ },
  { id: '7-2', name: '早すぎる左右反転', from: 'S', steps: [{ go: 92 }, { jump: 'R', hold: 12 }, { go: 500 }], expect: /左右反転/ },
  { id: '7-2', name: '天井のトゲ', enter: { x: 262, y: 226 }, steps: [{ go: 330 }, { wait: 30 }], expect: /天井まで/ },
  { id: '7-3', name: '抜ける足場', from: 'S', steps: [{ go: 74 }, { jump: 'R', hold: 12 }, { go: 156 }, { jump: 'R', hold: 12 }, { wait: 60 }], expect: /抜ける|暗くて/ },
  { id: '8-1', name: '木のリンゴ', from: 'S', steps: [{ go: 500 }], expect: /ニュートンも/ },
  { id: '8-1', name: '横に落ちるリンゴ', enter: { x: 128, y: 226 }, steps: [{ go: 500 }], expect: /横にも/ },
  { id: '8-1', name: '跳べない穴', enter: { x: 156, y: 226 }, steps: [{ go: 196 }, { jump: 'R', hold: 16, dj: 20, djHold: 14 }, { go: 500 }], expect: /跳べる距離/ },
  { id: '8-3', name: '偽セーブ', enter: { x: 30, y: 226 }, steps: [{ go: 500 }], expect: /ハズレ/ },
  { id: '8-3', name: '手紙', enter: { x: 30, y: 226 }, steps: [{ go: 90 }, { wait: 150 }], expect: /花火/ },
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
