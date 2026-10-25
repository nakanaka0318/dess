// 6面の確認：ステージのつながり・ダイイングメッセージ・推理の間の告発（まちがい／正解）
// 使い方: node tools/stage6-test.js
'use strict';
const { load, Runner, spawnAt } = require('./headless');
const G = load();
let fail = 0;
const ok = (c, msg) => {
  console.log((c ? '[OK] ' : '[NG] ') + msg);
  if (!c) fail++;
};

// 1) 5面クリア後、てっぺんに宇宙への扉
{
  const r = new Runner(G, '10-T', { spawn: { x: 8 * 20 + 6, y: 12 * 20 + 6, face: 1 }, flags: { stage5Clear: true }, respawn: true });
  const door = r.W.ents.find((e) => e.to === '11-1');
  ok(!!door, '10-T: 5面クリア後は宇宙への扉がある');
  for (let i = 0; i < 400 && !r.exited; i++) r.step({ left: r.W.player.cx > door.cx, right: r.W.player.cx < door.cx });
  ok(r.exited === 'warp:11-1', `10-T: 扉から 11-1 へ (${r.exited})`);
}
// 2) 6面で死ぬとダイイングメッセージ（死ぬたびに核心へ）
{
  const flags = {};
  const msgs = [];
  for (let k = 0; k < 6; k++) {
    const r = new Runner(G, '11-1', { spawn: spawnAt(G, '11-1', 'S'), flags, respawn: true });
    for (let i = 0; i < 300 && !r.deaths.length; i++) r.step({ right: true });
    msgs.push(r.game.dyingMsg);
  }
  ok(msgs[0] === G.DYING[0] && msgs[4] === G.DYING[4] && flags.dm === 6, `ダイイングメッセージ: ${msgs[0]} → … → ${msgs[4]}`);
}
// 3) 推理の間：まちがえると冤罪で死ぬ
const SPOT = { alien: 110, sun: 190, moon: 270, saturn: 350 };
function accuse(who, wait) {
  const flags = {};
  const r = new Runner(G, '12-X', { spawn: spawnAt(G, '12-X', 'S'), flags, respawn: true });
  const W = r.W;
  let t = 0;
  while (Math.abs(W.player.cx - SPOT[who]) > 2 && t++ < 300) r.step({ right: W.player.cx < SPOT[who], left: W.player.cx > SPOT[who] });
  r.step({ right: true });
  r.step({});
  r.step({ shoot: true });
  for (let i = 0; i < (wait || 700) && !r.deaths.length; i++) r.step({});
  return { r, flags };
}
for (const who of ['alien', 'sun', 'saturn']) {
  const { r } = accuse(who);
  ok(r.deaths.length && /冤罪/.test(r.deaths[0].cause), `${who} を告発 → ${r.deaths[0] ? r.deaths[0].cause : '死なない'}`);
}
// 4) 正解（月）なら真犯人との対決へ
{
  const { r, flags } = accuse('moon', 540);
  ok(flags.culpritFound && r.W.boss && r.W.boss.name === 'THE TRUE MOON', `月を告発 → 真犯人との対決（${r.deaths.length ? '死亡: ' + r.deaths[0].cause : '演出中は安全'}）`);
  ok(!r.deaths.length, '告発の演出中は死なない');
}
// 5) 推理として一意に月が犯人になるか（証言の総当たり）
{
  const who = ['moon', 'sun', 'saturn', 'alien'];
  const says = {
    moon: (c) => c === 'sun',
    sun: (c) => c === 'alien' || c === 'moon',
    saturn: (c) => says.sun(c), // 「太陽は本当のことを言っている」
    alien: (c) => c !== 'alien',
  };
  // 「犯人だけがウソ」：犯人 c のとき、c の証言だけが偽で、他は真
  const ans = who.filter((c) => who.every((w) => (w === c ? !says[w](c) : says[w](c))));
  ok(ans.length === 1 && ans[0] === 'moon', `証言から導ける犯人: ${ans.join(',')}`);
}

if (fail) {
  console.log(`${fail} 件失敗`);
  process.exit(1);
}
console.log('6面の確認：すべてOK');
