'use strict';
/* Neutralino 一键构建脚本
   用法：cd packaging/neutralino && node build.js
   步骤：同步游戏文件到 www/ → neu build --embed-resources → 产物在 dist/
*/
const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

function sh(cmd, opts) {
  console.log('> ' + cmd);
  execSync(cmd, Object.assign({ stdio: 'inherit' }, opts || {}));
}

process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';

const here = __dirname;
process.chdir(here);

if (!fs.existsSync(path.join(here, 'node_modules'))) {
  console.log('== 首次运行，安装依赖 ==');
  sh('npm install @neutralinojs/neu@latest @neutralinojs/lib@latest --registry https://registry.npmmirror.com');
  sh('npx neu update');
}

console.log('\n== 第 1 步：同步游戏文件 ==');
sh('node sync-game.js');

if (!fs.existsSync(path.join(here, 'extensions'))) fs.mkdirSync(path.join(here, 'extensions'));

console.log('\n== 第 2 步：构建 exe ==');
sh('npx neu build --embed-resources');

console.log('\n== 完成！产物在 dist/ 目录 ==');
