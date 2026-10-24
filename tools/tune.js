// 罠のタイミングを振って「初見で死ぬ率」と「知っていれば突破できる率」を並べる
// 使い方: node tools/tune.js <roomId> <TUNEのキー> <値1,値2,...>
'use strict';
const { run, S, G } = require('./human');
const { NAIVE, evalNaive } = require('./traps');
const [id, key, vals] = process.argv.slice(2);
for (const v of vals.split(',').map(Number)) {
  G.TUNE[key] = v;
  const naive = NAIVE.filter((n) => n.id === id).map((n) => `${n.name} ${evalNaive(n, 12).pct}%`);
  const rng = new G.RNG(99);
  let ok = 0;
  for (let i = 0; i < 24; i++) if (run(id, S[id], i === 0 ? null : rng).ok) ok++;
  console.log(`${key}=${v}  初見: ${naive.join(' / ')}  知っている人: ${Math.round((ok / 24) * 100)}%`);
}
