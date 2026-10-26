// ひみつの部屋の確認：入口から入れるか、ひみつのリンゴを取って戻れるか（全ステージ分）
// 使い方: node tools/secret-test.js
'use strict';
const { run, S, G } = require('./human');
let fail = 0;
const ok = (c, msg) => {
  console.log((c ? '[OK] ' : '[NG] ') + msg);
  if (!c) fail++;
};
const flagsOf = (W) => (W.game && W.game.flags) || {};

// 入口
ok(run('1-1', { from: '@', steps: [{ go: -20 }], goal: 'left' }).ok, '1面：はじまりの部屋を左へ → 1-S');
for (const key of ['5-3 王の墓', '7-1 ワームホール', '9-1 餅屋']) {
  const r = run(S[key].room, S[key], null);
  ok(r.ok, `入口 ${key} → ${r.exit || r.death}`);
}
// ひみつのリンゴ
for (const [id, n] of [['1-S', 1], ['5-S', 2], ['8-S', 3]]) {
  let f = {};
  const r = run(id, S[id], null, (W) => (f = flagsOf(W)));
  ok(r.ok && f['secret' + n], `${id}: ひみつのリンゴ ${n} を取って戻れる (${r.exit || r.death})`);
}
// 9-S：代金は1デス（死んでもリンゴは手に入る）
{
  let f = {};
  const r = run('9-S', { from: 'S', steps: [{ go: 120 }, { shoot: 2 }, { wait: 10 }, { go: 400 }, { wait: 80 }] }, null, (W) => (f = flagsOf(W)));
  ok(/代金/.test(r.death || '') && f.secret4, `9-S: 代金を払ってひみつのリンゴ 4 (${r.death})`);
}
// スイッチを2回撃つと青い床が消える
{
  const r = run('9-S', { from: 'S', steps: [{ go: 120 }, { shoot: 2 }, { wait: 10 }, { go: 290 }, { go: 280 }, { shoot: 2 }, { wait: 60 }] }, null);
  ok(/2回撃つと/.test(r.death || ''), `9-S: 床の上でもう一度撃つと落ちる (${r.death})`);
}

if (fail) {
  console.log(`${fail} 件失敗`);
  process.exit(1);
}
console.log('ひみつの部屋：すべてOK');
