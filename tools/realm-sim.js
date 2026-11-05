#!/usr/bin/env node
'use strict';

/* =========================================================================
 * 仙途挂机 · 境界修炼耗时模拟
 *
 * 目的：用 js/data.js 的真实境界/动作数据，复刻 js/engine.js 的单动作槽结算，
 *      计算「纯修炼挂机」从前六境开局到目标境界需要多少小时。
 *
 * 复刻的关键逻辑（与 engine.js 对齐）：
 *   - cycleTick：每次动作耗时 = effTime(def,id) / actionSpeed(skill)
 *   - effTime：精通每级 −0.2% 耗时（最多 −20%）
 *   - addXp('cultivation')：修为 = def.xp × xpMul('cultivation')
 *     xpMul = (1 + 大境界数 × 6) × (1 + 悟性 × 1%) × 阵法 × 洞天 × 信徒
 *   - breakthrough：成功率 = clamp(基础 + 悟性 × 1%, 5%, 98%)
 *     失败时 xp = floor(need × (1 − 30%))，丹药/灵石无论成败都扣（本模拟只算时间，
 *     不模拟背包与灵石，前提是丹药已备好）
 *   - 修为封顶于 breakInfo.need；本模拟假定到瓶颈立即突破，不做无意义溢出
 *
 * 说明：脚本以「事件驱动」推进（每完成一次动作算一步），长期平均与 0.1s tick
 *      完全等价，只是不存在 tick 粒度带来的残余误差。
 *
 * 用法：
 *   node tools/realm-sim.js                 # 用当前 js/data.js
 *   node tools/realm-sim.js --data=xxx.js   # 指定另一份 data.js（改前/改后对比）
 *   node tools/realm-sim.js --runs=40        # 蒙特卡洛次数
 *   node tools/realm-sim.js --target=34      # 目标阶数（33=炼虚大圆满，34=太上境一层）
 *   node tools/realm-sim.js --json           # 输出 JSON
 * ========================================================================= */

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const ROOT = path.resolve(__dirname, '..');

function argOf(name, dft) {
  const hit = process.argv.slice(2).find(function (a) { return a.indexOf('--' + name + '=') === 0; });
  return hit ? hit.slice(name.length + 3) : dft;
}
function flag(name) { return process.argv.slice(2).indexOf('--' + name) >= 0; }

/* --------------------------------------------------------------- 载入数据 */
function loadData(file) {
  const src = fs.readFileSync(file, 'utf8');
  const ctx = { module: { exports: {} }, console: console };
  vm.createContext(ctx);
  vm.runInContext(
    src + '\nmodule.exports = { CONFIG, REALM_DEFS, STAGES, ACTIONS, SKILLS, RECIPES,' +
    ' TAISHANG_DEF, TAISHANG_START, TOTAL_STAGES, breakInfo, realmInfo, xpNeed };',
    ctx, { filename: file }
  );
  return ctx.module.exports;
}

/* --------------------------------------------------------------- 通用工具 */
function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
function masteryNeed(lvl) { return Math.floor(20 * Math.pow(lvl, 1.6)); }
function effTime(def, m) { return def.time * (1 - Math.min(0.20, m.lvl * 0.002)); }

/* 用覆盖参数重建前六境阶段表（结构与 js/data.js 的 buildStages 完全一致），
   便于在不改 data.js 的前提下试算不同的 needBase / needMul。 */
function buildStages(D, over) {
  const out = [];
  D.REALM_DEFS.forEach(function (r, ri) {
    const base = (over.bases && isFinite(over.bases[ri])) ? over.bases[ri] : r.needBase;
    const mul = (over.muls && isFinite(over.muls[ri])) ? over.muls[ri] : r.needMul;
    r.stages.forEach(function (sn, si) {
      const lastInRealm = (si === r.stages.length - 1);
      const need = si === 0 ? base : Math.floor(base * Math.pow(mul, si));
      out.push({
        lvl: out.length + 1,
        realmIndex: ri,
        realm: r.name,
        realmIcon: r.icon,
        stageName: sn,
        full: r.name + ' ' + sn,
        isMax: false,
        breakInfo: {
          need: need,
          rate: lastInRealm ? r.rateToNext : r.rate,
          pill: lastInRealm ? r.pill : null,
          gold: lastInRealm ? r.gold : Math.round(r.gold * 0.2),
          boundary: lastInRealm
        }
      });
    });
  });
  return out;
}

function parseNums(s) {
  if (!s) return null;
  return s.split(',').map(function (x) { return Number(x); });
}

/* 可复现随机数（蒙特卡洛跑多次突破判定） */
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/* ------------------------------------------------------- 常驻加成场景定义 */
/* 纯修炼只受「修炼修为倍率」与「动作速度」影响。以下三类加成与游戏内一致：
 *   formCultXp   = formBonus('xp_cult')   （七曜/太玄/灵虚/无虚 四座阵法的修炼速度）
 *   worldCultXp  = worldBonus('cultxp')    （石室/静心堂/养魂井/虚空门）
 *   discipleCultXp = discipleBonus('cultxp')（观星道人 +10%）
 *   speed 类同：formBonus('speed') / worldBonus('speed') / discipleBonus('speed')
 * 代表值均为「小数」，如 0.90 = +90%。 */
const SCENARIOS = {
  /* 裸修：只有境界自带的 ×(1+ri×6) 修为倍率与 +4%/境 动作速度，不加任何外部系统 */
  bare: {
    insight: 0, formCultXp: 0, worldCultXp: 0, discipleCultXp: 0,
    formSpeed: 0, worldSpeed: 0, discipleSpeed: 0
  },
  /* 标准推进口径（主口径）：悟性 10（10 颗悟道丹）+ 阵法 +90% + 洞天 +30% + 观星道人 10% */
  standard: {
    insight: 10, formCultXp: 0.90, worldCultXp: 0.30, discipleCultXp: 0.10,
    formSpeed: 0.06, worldSpeed: 0.04, discipleSpeed: 0
  },
  /* 高投入口径：悟性 30 + 阵法 +170% + 洞天 +80% + 信徒 10%，代表后期堆满常驻加成 */
  invested: {
    insight: 30, formCultXp: 1.70, worldCultXp: 0.80, discipleCultXp: 0.10,
    formSpeed: 0.15, worldSpeed: 0.12, discipleSpeed: 0
  },
  /* 渐进口径（最贴近真实新档）：常驻加成不是开局就有，而是随大境界逐步堆起来。
     ramp[ri] = 该大境界按「标准口径」兑现的比例（0=全无，1=标准口径满额） */
  ramp: {
    insight: 10, formCultXp: 0.90, worldCultXp: 0.30, discipleCultXp: 0.10,
    formSpeed: 0.06, worldSpeed: 0.04, discipleSpeed: 0,
    ramp: [0, 0.3, 0.55, 0.8, 0.95, 1.0]
  }
};

/* ----------------------------------------------------------- 单次进度模拟 */
function simulate(D, stages, sc, opts) {
  const rnd = mulberry32(opts.seed || 1);
  const target = opts.target;
  const cultActs = D.ACTIONS.cultivation;
  const mastery = {};                       // actionId -> { lvl, xp }
  let lvl = 1;
  let xp = 0;
  let total = 0;
  let breaks = 0;
  let fails = 0;

  /* 按大境界分段统计 */
  const byRealm = {};
  D.REALM_DEFS.forEach(function (r) { byRealm[r.name] = { sec: 0, breaks: 0, fails: 0, stages: 0 }; });
  byRealm[D.TAISHANG_DEF.name] = { sec: 0, breaks: 0, fails: 0, stages: 0 };

  const stageRows = [];   // 每一阶的耗时明细

  while (lvl < target) {
    const info = stages[lvl - 1];
    const bi = info.breakInfo;
    if (!bi) break;

    const ri = info.realmIndex;
    /* 常驻加成，ramp 口径下按当前大境界兑现比例。
       与 engine.js 对齐：速度为 1+阵法+洞天+信徒（加法）；
       修为 = (1+悟性×1%) × (1+阵法修为) × (1+洞天cultxp+信徒cultxp) */
    const f = sc.ramp ? sc.ramp[ri] : 1;
    const xpSys = (1 + sc.insight * 0.01) * (1 + sc.formCultXp) *
      (1 + sc.worldCultXp + sc.discipleCultXp);
    const spdSys = 1 + sc.formSpeed + sc.worldSpeed + sc.discipleSpeed;
    const xpBonus = 1 + (xpSys - 1) * f;
    const spdBonus = 1 + (spdSys - 1) * f;
    /* xpMul('cultivation') */
    const xpMul = (1 + ri * D.CONFIG.CULT_XP_PER_REALM) * xpBonus;
    /* actionSpeed('cultivation') */
    const speed = (1 + ri * D.CONFIG.SPEED_REALM_BONUS) * spdBonus;

    /* 选当前等级已解锁、单位时间修为最高的动作（含各自精通） */
    let def = null;
    let bestRate = -1;
    for (let i = 0; i < cultActs.length; i++) {
      const a = cultActs[i];
      if (a.req > lvl) continue;
      const m = mastery[a.id] || (mastery[a.id] = { lvl: 0, xp: 0 });
      const rate = (a.xp * xpMul) / (effTime(a, m) / speed);
      if (rate > bestRate) { bestRate = rate; def = a; }
    }

    const m = mastery[def.id];
    const dt = effTime(def, m) / speed;
    total += dt;
    byRealm[info.realm].sec += dt;
    if (stageRows[lvl - 1] == null) {
      stageRows[lvl - 1] = { lvl: lvl, full: info.full, need: bi.need, sec: 0, tries: 0, fails: 0 };
    }
    stageRows[lvl - 1].sec += dt;

    xp += def.xp * xpMul;

    /* 精通：精通经验 = 动作经验 × 0.6 */
    m.xp += Math.max(1, Math.round(def.xp * D.CONFIG.MASTERY_XP_RATIO));
    let guard = 0;
    while (m.lvl < D.CONFIG.MASTERY_CAP && m.xp >= masteryNeed(m.lvl) && guard++ < 200) {
      m.xp -= masteryNeed(m.lvl);
      m.lvl += 1;
    }

    if (xp < bi.need) continue;

    /* 到瓶颈：立即突破 */
    xp = bi.need;
    breaks += 1;
    byRealm[info.realm].breaks += 1;
    stageRows[lvl - 1].tries += 1;
    const rate = clamp(bi.rate + sc.insight * 0.01, 0.05, 0.98);
    if (rnd() < rate) {
      lvl += 1;
      xp = 0;
    } else {
      fails += 1;
      byRealm[info.realm].fails += 1;
      stageRows[lvl - 1].fails += 1;
      xp = Math.floor(bi.need * (1 - D.CONFIG.BREAK_FAIL_LOSS));
    }
  }

  /* 汇总：未走到的境界记 0 */
  return { totalSec: total, breaks: breaks, fails: fails, byRealm: byRealm, stageRows: stageRows };
}

/* --------------------------------------------------------------- 汇总输出 */
function runScenario(D, stages, name, sc, opts) {
  const runs = opts.runs;
  const totals = [];
  const perRealm = {};
  D.REALM_DEFS.forEach(function (r) { perRealm[r.name] = []; });
  perRealm[D.TAISHANG_DEF.name] = [];
  let breaks = 0, fails = 0;
  const stageAgg = [];

  for (let i = 0; i < runs; i++) {
    const r = simulate(D, stages, sc, { target: opts.target, seed: opts.seed + i * 7919 });
    totals.push(r.totalSec);
    breaks += r.breaks;
    fails += r.fails;
    Object.keys(r.byRealm).forEach(function (k) { perRealm[k].push(r.byRealm[k].sec); });
    r.stageRows.forEach(function (row, si) {
      if (!row) return;
      if (!stageAgg[si]) stageAgg[si] = { lvl: row.lvl, full: row.full, need: row.need, sec: 0, tries: 0, fails: 0 };
      stageAgg[si].sec += row.sec;
      stageAgg[si].tries += row.tries;
      stageAgg[si].fails += row.fails;
    });
  }
  totals.sort(function (a, b) { return a - b; });
  const mean = totals.reduce(function (a, b) { return a + b; }, 0) / totals.length;
  const med = totals[Math.floor(totals.length / 2)];

  const realmMean = {};
  Object.keys(perRealm).forEach(function (k) {
    const arr = perRealm[k];
    realmMean[k] = arr.reduce(function (a, b) { return a + b; }, 0) / arr.length;
  });

  return {
    scenario: name,
    totalH: mean / 3600,
    medianH: med / 3600,
    minH: totals[0] / 3600,
    maxH: totals[totals.length - 1] / 3600,
    breaksAvg: breaks / runs,
    failsAvg: fails / runs,
    realmH: realmMean,
    stageAvg: stageAgg.map(function (r) {
      return r ? { lvl: r.lvl, full: r.full, need: r.need, sec: r.sec / runs,
        tries: r.tries / runs, fails: r.fails / runs } : null;
    })
  };
}

/* --------------------------------------------------- 五项前置技能到 100 级估算 */
/* 说明：这里只算「技能经验 / 动作耗时」本身，忽略材料获取链（炼器/炼丹的真实
 *      成本还要挖矿、熔炼、采药），因此结果是**下限**。 */
function estimateSkills(D, sc, opts) {
  const skills = ['crafting', 'woodcutting', 'fishing', 'alchemy', 'formation'];
  const ri = 5;   // 走到炼虚期时的大境界序号
  const speed = (1 + ri * D.CONFIG.SPEED_REALM_BONUS) *
    (1 + sc.formSpeed + sc.worldSpeed + sc.discipleSpeed);
  /* 非修炼技能的经验倍率：境界 ×6%/境 + 阵法采集经验（此处保守取 1） */
  const xpMul = (1 + ri * D.CONFIG.XP_REALM_BONUS);

  const out = {};
  skills.forEach(function (sid) {
    let lvl = 1;
    let xp = 0;
    let sec = 0;
    const mastery = {};
    const pool = (D.ACTIONS[sid] || []).concat(D.RECIPES[sid] || []);
    while (lvl < 100) {
      const need = D.xpNeed(sid, lvl);
      let def = null, bestRate = -1;
      for (let i = 0; i < pool.length; i++) {
        const a = pool[i];
        if (a.req > lvl) continue;
        const m = mastery[a.id] || (mastery[a.id] = { lvl: 0, xp: 0 });
        const rate = (a.xp * xpMul) / (effTime(a, m) / speed);
        if (rate > bestRate) { bestRate = rate; def = a; }
      }
      if (!def) { lvl += 1; if (lvl >= 100) break; continue; }
      const m = mastery[def.id];
      sec += effTime(def, m) / speed;
      xp += def.xp * xpMul;
      m.xp += Math.max(1, Math.round(def.xp * D.CONFIG.MASTERY_XP_RATIO));
      let guard = 0;
      while (m.lvl < D.CONFIG.MASTERY_CAP && m.xp >= masteryNeed(m.lvl) && guard++ < 200) {
        m.xp -= masteryNeed(m.lvl);
        m.lvl += 1;
      }
      while (xp >= D.xpNeed(sid, lvl) && lvl < 100) {
        xp -= D.xpNeed(sid, lvl);
        lvl += 1;
      }
    }
    out[sid] = sec;
  });
  return out;
}

/* ------------------------------------------------------------------ 主程序 */
const file = path.resolve(process.cwd(), argOf('data', path.join(ROOT, 'js', 'data.js')));
const D = loadData(file);
const runs = Number(argOf('runs', 24));
const target = Number(argOf('target', 34));
const seed = Number(argOf('seed', 20261104));
const over = { bases: parseNums(argOf('bases', '')), muls: parseNums(argOf('muls', '')) };
const stages = buildStages(D, over);

const label = path.relative(ROOT, file) || file;
const results = {};

Object.keys(SCENARIOS).forEach(function (k) {
  results[k] = runScenario(D, stages, k, SCENARIOS[k], { runs: runs, target: target, seed: seed });
});

/* 主口径（渐进口径）的逐阶明细直接取自 runScenario 的均值（见下） */
const skillEst = flag('skills') ? estimateSkills(D, SCENARIOS.standard) : null;

if (flag('json')) {
  console.log(JSON.stringify({ file: label, target: target, runs: runs, results: results }, null, 2));
  process.exit(0);
}

const H = function (sec) { return (sec / 3600).toFixed(2); };
const fmt = function (n) { return n >= 10000 ? (n / 10000).toFixed(2) + '万' : String(n); };

console.log('数据文件: ' + label);
console.log('目标阶数: ' + target + (target === 33 ? '（炼虚大圆满，不含太上境）' : '（太上境 一层）'));
console.log('蒙特卡洛: ' + runs + ' 次');
console.log('');
console.log('=== 总时长（小时） ===');
console.log('口径'.padEnd(10) + '均值'.padStart(10) + '中位'.padStart(10) + 'P0'.padStart(10) + 'P100'.padStart(10) + '突破'.padStart(8) + '失败'.padStart(8));
Object.keys(results).forEach(function (k) {
  const r = results[k];
  console.log(k.padEnd(10) + r.totalH.toFixed(1).padStart(10) + r.medianH.toFixed(1).padStart(10) +
    r.minH.toFixed(1).padStart(10) + r.maxH.toFixed(1).padStart(10) +
    r.breaksAvg.toFixed(1).padStart(8) + r.failsAvg.toFixed(1).padStart(8));
});
console.log('');
console.log('=== 分段耗时（小时，各口径） ===');
const sk = Object.keys(results);
console.log('大境界'.padEnd(10) + sk.map(function (k) { return k.padStart(11); }).join(''));
Object.keys(results.standard.realmH).forEach(function (k) {
  console.log(k.padEnd(10) + sk.map(function (s) {
    return (results[s].realmH[k] / 3600).toFixed(1).padStart(11);
  }).join(''));
});
console.log('');
console.log('=== 主口径（ramp）逐阶明细（蒙特卡洛均值） ===');
console.log('阶'.padStart(4) + '  ' + '境界'.padEnd(16) + '需求'.padStart(12) + '耗时(h)'.padStart(10) + '突破/失败'.padStart(12));
results.ramp.stageAvg.forEach(function (r) {
  if (!r) return;
  console.log(String(r.lvl).padStart(4) + '  ' + r.full.padEnd(16) + fmt(r.need).padStart(12) +
    H(r.sec).padStart(10) + (r.tries.toFixed(1) + '/' + r.fails.toFixed(1)).padStart(12));
});

if (skillEst) {
  const NAMES = { crafting: '炼器', woodcutting: '伐木', fishing: '钓鱼', alchemy: '炼丹', formation: '阵法' };
  let sum = 0;
  console.log('');
  console.log('=== 炼虚大圆满前置「五行技能各 100 级」估算（不含材料链，下限） ===');
  Object.keys(skillEst).forEach(function (k) {
    sum += skillEst[k];
    console.log(NAMES[k].padEnd(6) + H(skillEst[k]).padStart(10) + ' h');
  });
  console.log('合计'.padEnd(6) + H(sum).padStart(10) + ' h');
}
