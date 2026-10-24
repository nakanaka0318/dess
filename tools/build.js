// 配布用ビルド：CSS と JS をすべて埋め込んだ 1 ファイル版を作る
//  dist/index.html    … そのまま開けば遊べる単体 HTML
//  dist/artifact.html … claude.ai の Artifact 用（<html>/<head>/<body> を除いた本文）
'use strict';
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
let html = read('index.html');

html = html.replace(/<link rel="stylesheet" href="css\/style\.css">/, () => `<style>\n${read('css/style.css')}\n</style>`);
html = html.replace(/<script src="(js\/[^"]+)"><\/script>/g, (_, src) => `<script>\n${read(src).replace(/<\/script/gi, '<\\/script')}\n</script>`);

fs.mkdirSync(path.join(root, 'dist'), { recursive: true });
fs.writeFileSync(path.join(root, 'dist/index.html'), html);

// Artifact 版：ドキュメントの骨組みは公開時に付与されるので本文だけにする
let art = html
  .replace(/<!doctype html>\s*/i, '')
  .replace(/<html[^>]*>\s*/i, '')
  .replace(/<\/html>\s*/i, '')
  .replace(/<head>\s*/i, '')
  .replace(/<\/head>\s*/i, '')
  .replace(/<body>\s*/i, '')
  .replace(/<\/body>\s*/i, '')
  .replace(/<meta charset="utf-8">\s*/i, '')
  .replace(/<meta name="viewport"[^>]*>\s*/i, '');
// <title> を先頭に
const title = (art.match(/<title>[^<]*<\/title>/) || [''])[0];
art = title + '\n' + art.replace(title, '');
fs.writeFileSync(path.join(root, 'dist/artifact.html'), art);

const kb = (s) => (Buffer.byteLength(s) / 1024).toFixed(0) + 'KB';
console.log(`dist/index.html ${kb(html)} / dist/artifact.html ${kb(art)}`);
