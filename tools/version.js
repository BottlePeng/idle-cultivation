#!/usr/bin/env node
'use strict';

/* =========================================================================
 * 仙途挂机 · 版本号工具
 * 版本号的唯一来源是 js/data.js 里的 const VERSION = 'x.y.z';
 * 本脚本只做三件事：读取、按规则递增、同步到 Electron 打包配置。
 *
 * 用法：
 *   node tools/version.js            查看当前版本
 *   node tools/version.js patch      小更新：bug 修复等，不影响存档        → x.y.(z+1)
 *   node tools/version.js minor      机制更新：新增/改动机制，影响存档    → x.(y+1).0
 *   node tools/version.js major      大型更新：DLC / 全新机制，需重开游戏  → (x+1).0.0
 *   node tools/version.js sync       只同步版本到打包配置（打包前自动执行）
 * ========================================================================= */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DATA_FILE = path.join(ROOT, 'js', 'data.js');
const ELECTRON_PKG = path.join(ROOT, 'packaging', 'electron', 'package.json');
const VERSION_RE = /const VERSION = '(\d+)\.(\d+)\.(\d+)';/;

function readVersion() {
  const src = fs.readFileSync(DATA_FILE, 'utf8');
  const m = src.match(VERSION_RE);
  if (!m) throw new Error("未在 js/data.js 找到 `const VERSION = 'x.y.z';`");
  return { major: Number(m[1]), minor: Number(m[2]), patch: Number(m[3]) };
}

function writeVersion(v) {
  const text = v.major + '.' + v.minor + '.' + v.patch;
  const src = fs.readFileSync(DATA_FILE, 'utf8');
  fs.writeFileSync(DATA_FILE, src.replace(VERSION_RE, "const VERSION = '" + text + "';"), 'utf8');
  return text;
}

/* 把版本写进 Electron 的 package.json —— electron-builder 的 artifactName
   用的是 ${version}，所以 exe 文件名会自动变成 IdleCultivation-<ver>-Portable.exe */
function syncElectron(text) {
  if (!fs.existsSync(ELECTRON_PKG)) return null;
  /* 去掉可能的 UTF-8 BOM —— Windows 编辑器另存有时会加，JSON.parse 会报错 */
  const raw = fs.readFileSync(ELECTRON_PKG, 'utf8').replace(/^\uFEFF/, '');
  const pkg = JSON.parse(raw);
  if (pkg.version === text) return null;
  pkg.version = text;
  fs.writeFileSync(ELECTRON_PKG, JSON.stringify(pkg, null, 2) + '\n', 'utf8');
  return text;
}

function main() {
  const arg = (process.argv[2] || 'show').toLowerCase();
  let v = readVersion();
  const before = v.major + '.' + v.minor + '.' + v.patch;

  if (arg === 'patch') {
    v.patch += 1;
  } else if (arg === 'minor') {
    v.minor += 1;
    v.patch = 0;
  } else if (arg === 'major') {
    v.major += 1;
    v.minor = 0;
    v.patch = 0;
  } else if (arg !== 'show' && arg !== 'sync') {
    console.error('未知参数：' + arg + '\n用法：node tools/version.js [show|patch|minor|major|sync]');
    process.exit(1);
  }

  const text = (arg === 'show' || arg === 'sync') ? before : writeVersion(v);
  const synced = syncElectron(text);

  if (arg === 'show' || arg === 'sync') {
    console.log('当前版本 v' + text);
  } else {
    console.log('版本 v' + before + ' → v' + text + '（' + arg + '）');
  }
  if (synced) console.log('已同步 packaging/electron/package.json → ' + synced);
  else if (fs.existsSync(ELECTRON_PKG)) console.log('打包配置版本已一致，无需同步');
}

main();
