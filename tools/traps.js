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
  { id: '2-1', name: 'ドッスン②（二度落ち）', from: 'S', steps: [{ jump: 'R', hold: 8 }, { go: 96 }, { wait: 40 }, { go: 180 }, { go: 196 }, { wait: 50 }, { go: 420 }], expect: /ドッスン/ },
  { id: '2-1', name: 'ドッスン③（真下で止まる）', base: '2-1', replaceTail: [{ go: 352 }, { wait: 60 }], expect: /ドッスン/ },
  { id: '2-2', name: 'つらら①', from: 'S', steps: [{ go: -20 }], expect: /つららが/ },
  { id: '2-2', name: 'つらら②（真下で待つ）', from: 'S', steps: [{ go: 378 }, { go: 372 }, { go: 386 }, { wait: 30 }, { go: 290 }, { wait: 60 }], expect: /立ち止まった/ },
  { id: '2-2', name: '穴を跳ぶとつらら', from: 'S', steps: [{ go: 378 }, { go: 372 }, { go: 386 }, { wait: 30 }, { go: 312 }, { go: 330 }, { wait: 60 }, { go: 276 }, { jump: 'L', hold: 12 }, { go: 186 }, { jump: 'L', hold: 4 }, { go: -20 }], expect: /ジャンプした瞬間/ },
  { id: '3-2', name: '上に落ちるリンゴ', base: '3-2', cut: 'wait60', expect: /さかさま/ },
  { id: '4-3', name: '月のリンゴ', base: '4-3', cut: 'wait90', expect: /月からの贈り物/ },
  // 1面に追加した理不尽
  { id: '1-1', name: '見えないブロック', from: '@', steps: [{ go: 142 }, { wait: 40 }, { go: 196 }, { wait: 45 }, { jump: 'R', hold: 14 }, { go: 318 }, { jump: 'R', hold: 12 }, { go: 392 }, { jump: 'R', hold: 20 }, { go: 500 }], expect: /見えない/ },
  { id: '1-2', name: '戻ってくる月', from: 'S', steps: [{ go: 50 }, { jump: 'R', hold: 10 }, { go: 104 }, { jump: 'R', hold: 12 }, { go: 160 }, { jump: 'R', hold: 10 }, { go: 290 }, { go: 330 }, { wait: 90 }, { go: 500 }], expect: /戻って/ },
  { id: '1-3', name: '抜ける足場', from: 'S', steps: [{ go: 92 }, { jump: 0, hold: 6 }, { wait: 30 }, { go: 214 }, { jump: 'R', hold: 14, steerFrames: 24 }, { go: 272 }, { jump: 'R', hold: 16, dj: 18, djHold: 14, steerFrames: 50 }, { wait: 40 }, { go: 374 }], expect: /トゲ|刺さ|痛い|鋭い|仲良く|触れて|裏切ら|そこに|やあ/ },
  { id: '1-4', name: 'セーブ直後のリンゴ', enter: { x: 86, y: 262, vy: -5 }, steps: [{ wait: 90 }], expect: /セーブした直後/ },
  { id: '2-1', name: '後ろから転がるリンゴ', from: 'S', steps: [{ jump: 'R', hold: 8 }, { go: 96 }, { wait: 40 }, { go: 180 }, { go: 196 }, { wait: 200 }], expect: /上ばかり/ },
  { id: '2-2', name: '本気のベルト', from: 'S', steps: [{ go: 378 }, { go: 372 }, { go: 386 }, { wait: 30 }, { go: 312 }, { go: 330 }, { wait: 60 }, { go: 276 }, { jump: 'L', hold: 12 }, { go: 206 }, { wait: 50 }, { go: 186 }, { jump: 'L', hold: 4 }, { go: -20 }], expect: /本気を出した/ },
  { id: '2-4', name: '着地点のトゲ', enter: { x: 146, y: 226 }, steps: [{ jump: 'L', hold: 16 }, { go: -20 }], goal: 'left', expect: /気がゆるんだ/ },
  { id: '3-1', name: '前からのトゲ', base: '3-1', replaceJump: { jump: 'L', hold: 16 }, expect: /前に注意/ },
  { id: '3-4', name: 'THE END の文字', enter: { x: 206, y: 262, vy: -5 }, steps: [{ wait: 240 }], expect: /THE END/ },
  // 1面後半に追加
  { id: '3-1', name: 'シャンデリア', from: 'S', steps: [{ go: 384 }, { shoot: 20 }, { wait: 10 }, { go: 276 }, { jump: 'L', hold: 12, steerFrames: 30 }, { go: 212 }, { jump: 'L', hold: 14 }, { go: 90 }], expect: /シャンデリア/ },
  { id: '3-2', name: 'さかさまの床のトゲ', base: '3-2', cutStep: { go: 108 }, expect: /さかさまの床/ },
  { id: '3-4', name: 'Thank you の文字', enter: { x: 206, y: 262, vy: -5 }, steps: [{ go: 340 }, { wait: 50 }, { go: 240 }, { wait: 200 }], expect: /Thank you/ },
  { id: '4-1', name: '願いごとの看板', enter: { x: 1, y: 66 }, steps: [{ go: 70 }, { jump: 'R', hold: 12 }, { go: 130 }, { wait: 120 }], expect: /願いごと|流れ星/ },
  { id: '4-2', name: '扉の先の落とし穴', base: '4-2', cutStep: { go: 418 }, expect: /落とし穴/ },
  { id: '4-3', name: '月のおかわり', base: '4-3', replaceWait: { from: 90, to: 40 }, expect: /おかわり|贈り物/ },
  // 2面
  { id: '5-1', name: 'だるまサボテン', from: '@', steps: [{ go: 124 }, { jump: 'R', hold: 14 }, { go: 196 }, { jump: 'R', hold: 14 }, { go: 500 }], expect: /だるまさん|ハゲワシ/ },
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
  { id: '5-1', name: 'ハゲワシ', enter: { x: 96, y: 226 }, steps: [{ go: 108 }, { wait: 150 }], expect: /ハゲワシ/ },
  { id: '5-2', name: '砂の中のヘビ', enter: { x: 150, y: 226 }, steps: [{ go: 236 }], expect: /ヘビ/ },
  { id: '5-3', name: '出口の大岩', enter: { x: 420, y: 226 }, steps: [{ go: 500 }], expect: /大岩/ },
  { id: '6-1', name: '太陽の目の真下', enter: { x: 226, y: 226 }, steps: [{ go: 240 }, { wait: 60 }], expect: /太陽の目/ },
  { id: '6-3', name: '燃える看板', enter: { x: 150, y: 226 }, steps: [{ go: 190 }, { wait: 90 }], expect: /看板が燃えた/ },
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
  { id: '7-1', name: '宇宙のトランポリン', enter: { x: 214, y: 226 }, steps: [{ go: 276 }, { wait: 120 }], expect: /トランポリン/ },
  {
    id: '7-2', name: 'まだ終わらない反転', from: 'S',
    steps: [
      { go: 92 }, { jump: 'R', hold: 12 },
      { until: (W, P) => P.cx > 206, dir: 'L' }, { jump: 'L', hold: 14 }, // 反転中は左で右へ
      { until: (W, P) => !W.reverse, dir: 'L' }, { wait: 4 }, { jump: 'R', hold: 16 }, { go: 500 }, // 解けたと思ってすぐ跳ぶ
    ],
    expect: /反転/,
  },
  { id: '7-3', name: '光った時だけのトゲ', enter: { x: 366, y: 186 }, steps: [{ wait: 140 }], expect: /光った瞬間/ },
  { id: '8-1', name: '禁断の果実', enter: { x: 380, y: 226 }, steps: [{ go: 500 }], expect: /禁断/ },
  { id: '8-2', name: '果物かご', enter: { x: 344, y: 226 }, steps: [{ go: 380 }, { wait: 60 }], expect: /果物かご/ },
  // 4面
  { id: '9-1', name: '倒れる旗', from: 'S', steps: [{ go: 92 }, { jump: 'R', hold: 12 }, { go: 500 }], expect: /人類/ },
  { id: '9-1', name: 'うさぎの餅', enter: { x: 196, y: 226 }, steps: [{ go: 500 }], expect: /うさぎ/ },
  { id: '9-1', name: '隕石', enter: { x: 250, y: 226 }, steps: [{ go: 272 }, { jump: 'R', hold: 14 }, { go: 500 }], expect: /クレーター/ },
  { id: '9-H', name: '鍵のかかった扉', enter: { x: 20, y: 226 }, steps: [{ go: 500 }], expect: /せっかち/ },
  { id: '9-B1', name: '順番ちがい', enter: { x: 20, y: 226 }, steps: [{ go: 300 }, { shoot: 20 }, { wait: 80 }], expect: /順番/ },
  { id: '9-B2', name: '偽のかけら', enter: { x: 20, y: 226 }, steps: [{ go: 500 }], expect: /偽物/ },
  { id: '9-C2', name: '看板の前で待つ', enter: { x: 20, y: 226 }, steps: [{ go: 190 }, { wait: 300 }], expect: /そこで待て/ },
  { id: '9-A1', name: '扉A', enter: { x: 140, y: 226 }, steps: [{ go: 210 }], goal: 'warp:9-A2', expect: /宇宙/ },
  { id: '9-A2', name: 'かけらの下', from: 'S', steps: [{ go: 500 }], expect: /空洞/ },
  { id: '9-A3', name: 'クリアボタン', from: 'S', steps: [{ go: 140 }, { go: 136 }, { shoot: 6 }, { wait: 200 }], expect: /ボタン/ },
  { id: '8-3', name: '看板もハズレ', enter: { x: 370, y: 226 }, steps: [{ go: 410 }, { wait: 60 }], expect: /看板も/ },
  // 寄り道・追加の罠（1面）
  { id: '1-S', name: '人食い花', from: 'S', steps: [{ go: -20 }], goal: 'left', expect: /花畑/ },
  { id: '1-S', name: 'ミミック', enter: { x: 360, y: 226, face: -1 }, steps: [{ go: -20 }], goal: 'left', expect: /ミミック/ },
  { id: '2-1', name: 'ヘルメット', from: 'S', steps: [{ go: 80 }, { wait: 60 }], expect: /ヘルメット/ },
  { id: '3-1', name: 'ジャンプ禁止の下の宝箱', from: 'S', steps: [{ go: -20 }], goal: 'left', expect: /ミミック/ },
  // 寄り道・追加の罠（2面）
  { id: '5-1', name: '流砂', enter: { x: 116, y: 226 }, steps: [{ go: 500 }], expect: /流砂/ },
  { id: '5-S', name: 'スフィンクスのなぞなぞ', from: 'S', steps: [{ go: 100 }, { shoot: 4 }, { wait: 120 }], expect: /スフィンクス/ },
  { id: '6-3', name: 'お供え物', enter: { x: 130, y: 226, face: -1 }, steps: [{ go: 60 }, { wait: 60 }], goal: 'left', expect: /お供え物/ },
  // 寄り道・追加の罠（3面）
  { id: '8-2', name: '戻ってくる弾', from: 'S', steps: [{ go: 70 }, { shoot: 6 }, { wait: 60 }], expect: /万有引力で戻って/ },
  { id: '8-S', name: '赤いワームホール', from: 'S', steps: [{ go: 500 }], expect: /ワームホールの出口/ },
  // 6面
  { id: '11-1', name: '★1UP（機雷）', from: 'S', steps: [{ go: 500 }], expect: /機雷/ },
  { id: '11-1', name: '背景の星', from: 'S', steps: [{ go: 122 }, { jump: 'R', hold: 16 }, { go: 500 }], expect: /星は背景/ },
  { id: '11-1', name: 'にせの GAME OVER', enter: { x: 200, y: 226 }, steps: [{ go: 250 }, { wait: 24 }, { jump: 0, hold: 10 }, { wait: 40 }], expect: /リトライしよう/ },
  { id: '11-1', name: '床あり。安全。', enter: { x: 320, y: 226 }, steps: [{ go: 500 }], expect: /床あり/ },
  { id: '11-1', name: '出国審査', enter: { x: 330, y: 226 }, steps: [{ go: 352 }, { jump: 'R', hold: 15 }, { go: 500 }], expect: /出国審査/ },
  { id: '11-2', name: '反対側の隕石', from: 'S', steps: [{ go: 500 }], expect: /反対側|寝たふり/ },
  { id: '11-2', name: '寝たふりのUFO', enter: { x: 150, y: 226 }, steps: [{ go: 500 }], expect: /寝たふり/ },
  { id: '11-2', name: '月の太鼓判', enter: { x: 250, y: 226 }, steps: [{ go: 268 }, { jump: 'R', hold: 12 }, { wait: 30 }, { go: 500 }], expect: /月を信じた/ },
  { id: '11-2', name: '立ち止まると流れ星', enter: { x: 352, y: 146 }, steps: [{ wait: 90 }], expect: /立ち止まった/ },
  { id: '11-2', name: 'ワープゾーン', enter: { x: 404, y: 226 }, steps: [{ go: 500 }], expect: /あの世/ },
  { id: '11-3', name: '遠くの惑星', from: 'S', steps: [{ go: 500 }], expect: /遠近法/ },
  { id: '11-3', name: 'にせの PAUSE', enter: { x: 200, y: 226 }, steps: [{ go: 244 }, { wait: 70 }], expect: /ポーズ/ },
  { id: '11-3', name: '重力反転オーブ', enter: { x: 252, y: 226 }, steps: [{ jump: 0, hold: 10 }, { wait: 80 }], expect: /オーブ/ },
  { id: '11-3', name: '倒れる看板', enter: { x: 330, y: 226 }, steps: [{ go: 500 }], expect: /看板が倒れて/ },
  { id: '11-4', name: '小惑星のホログラム', from: 'S', steps: [{ go: 100 }, { jump: 'R', hold: 10 }, { wait: 40 }], expect: /ホログラム/ },
  {
    id: '11-4', name: '土星の環', from: 'S',
    steps: [{ go: 88 }, { until: (W) => W.ents.some((e) => e.alive && e.style === 'ring' && e.y === 200 && e.x < 114), dir: 0 }, { jump: 'R', hold: 16, steerFrames: 22 }, { wait: 160 }],
    expect: /重さに耐え/,
  },
  { id: '11-4', name: '向こう岸の左のはし', enter: { x: 420, y: 226 }, steps: [{ go: 386 }, { wait: 40 }], expect: /土星の言うとおり/ },
  { id: '11-4', name: '本物の1UPを撃つ', enter: { x: 380, y: 226 }, steps: [{ shoot: 6 }, { wait: 20 }], expect: /本物の1UP/ },
  { id: '12-1', name: '掃除ロボット', from: 'S', steps: [{ go: 100 }, { jump: 'R', hold: 16 }, { go: 500 }], expect: /掃除ロボット/ },
  { id: '12-1', name: '出口（エアロック）', enter: { x: 360, y: 226 }, steps: [{ go: 500 }], expect: /エアロック/ },
  { id: '12-1', name: 'エレベーター', from: 'S', steps: [{ go: 70 }, { shoot: 30 }, { wait: 10 }, { go: 244 }, { jump: 'R', hold: 10, steerFrames: 14 }, { wait: 320 }], expect: /屋上/ },
  { id: '12-1', name: 'セキュリティ解除済み', enter: { x: 350, y: 106 }, steps: [{ go: 380 }, { wait: 60 }], expect: /セキュリティ/ },
  { id: '12-2', name: 'きみに化けた宇宙人', from: 'S', steps: [{ go: 92 }, { until: (W, P) => P.onGround && P.y > 200, dir: 0 }, { go: 300 }], expect: /化けて/ },
  { id: '12-2', name: '化けた宇宙人（跳ぶ）', from: 'S', steps: [{ go: 92 }, { until: (W, P) => P.onGround && P.y > 200, dir: 0 }, { go: 120 }, { jump: 'R', hold: 16 }, { go: 300 }], expect: /化けて/ },
  { id: '12-2', name: 'にせの STAGE CLEAR', enter: { x: 140, y: 226 }, steps: [{ shoot: 6 }, { wait: 10 }, { go: 500 }], expect: /クリアしたと/ },
  { id: '12-2', name: '宇宙人の忠告', enter: { x: 360, y: 226 }, steps: [{ go: 500 }], expect: /本当のこと/ },
  { id: '12-3', name: '自爆カウントダウン', from: 'S', steps: [{ go: 500 }], expect: /急いだ/ },
  { id: '12-3', name: '停電', enter: { x: 346, y: 226 }, steps: [{ go: 500 }], expect: /停電/ },
  { id: '12-3', name: '予言のモニター', enter: { x: 384, y: 226 }, steps: [{ go: 500 }], expect: /予言/ },
  { id: '12-X', name: '冤罪', from: 'S', steps: [{ go: 70 }, { shoot: 4 }, { wait: 300 }], expect: /冤罪/ },
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
  if (n.cutStep) {
    // 指定した手順とその直後のジャンプを抜く（罠を知らずに歩き抜ける）
    const i = steps.findIndex((s) => s.go === n.cutStep.go);
    steps.splice(i, 2);
  }
  if (n.replaceWait) {
    const i = steps.findIndex((s) => s.wait === n.replaceWait.from);
    steps[i] = { wait: n.replaceWait.to };
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
