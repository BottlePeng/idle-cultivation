'use strict';
/* 把游戏根目录的 index.html / css / js 同步到 www/ 供 Neutralino build 使用 */
const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '../..');
const WWW = path.resolve(__dirname, 'www');

function cpDir(src, dst) {
  fs.rmSync(dst, { recursive: true, force: true });
  fs.cpSync(src, dst, { recursive: true });
}
function cpFile(src, dst) {
  fs.mkdirSync(path.dirname(dst), { recursive: true });
  fs.copyFileSync(src, dst);
}

console.log('== sync-game.js 同步游戏文件到 www/ ==');
cpFile(path.join(ROOT, 'index.html'), path.join(WWW, 'index.html'));
cpDir(path.join(ROOT, 'css'), path.join(WWW, 'css'));
cpDir(path.join(ROOT, 'js'), path.join(WWW, 'js'));
// 保留 www/neutralino.js（Neutralino client lib）
// 同步游戏文档目录（可选，不进 exe 但方便调试）
if (fs.existsSync(path.join(ROOT, 'document'))) {
  cpDir(path.join(ROOT, 'document'), path.join(WWW, 'document'));
}
console.log('同步完成');
