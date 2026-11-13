'use strict';

/* =========================================================================
 * 穿越星球 · UI 层
 * 纯 DOM 渲染，无框架。renderAll() 负责"结构 + 数据"，
 * updateBars() 由 tick 高频调用，只改进度条宽度（避免整树重绘）。
 * ========================================================================= */

const $ = function (sel) { return document.querySelector(sel); };

/* 缓存 HTML：内容没变就不重绘。
 * 高频整树重建会让浏览器里的元素引用失效（点击落空、hover 抖动），
 * 这里用"协议签名"（剔除进度条宽度）判断是否真的需要重绘。 */
const _htmlCache = {};
function setHTML(sel, html) {
  const sig = html.replace(/width:[0-9.]+%/g, '');
  if (_htmlCache[sel] === sig) return;
  _htmlCache[sel] = sig;
  const el = $(sel);
  if (el) el.innerHTML = html;
}

function esc(s) {
  return String(s).replace(/[&<>"]/g, function (c) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
  });
}

function fmtDur(sec) {
  if (sec < 60) return sec.toFixed(sec < 10 ? 1 : 0) + ' 秒';
  const m = Math.floor(sec / 60);
  const s = Math.round(sec % 60);
  return m + ' 分 ' + s + ' 秒';
}

function fmtNum(n) {
  n = Number(n) || 0;
  if (n >= 1e15) return (n / 1e15).toFixed(2) + 'Q';
  if (n >= 1e12) return (n / 1e12).toFixed(2) + 'T';
  if (n >= 1e9) return (n / 1e9).toFixed(2) + 'B';
  if (n >= 1000000) return (n / 1000000).toFixed(2) + 'M';
  if (n >= 10000) return (n / 1000).toFixed(1) + 'k';
  return String(Math.floor(n));
}

/* 灵气浓度数值：早期保留整数，后期用 k/M 缩写，保证 (当前/上限) 不撑爆面板 */
function fmtAuraNum(n) {
  n = Math.max(0, Math.round(Number(n) || 0));
  return n >= 100000 ? fmtNum(n) : String(n);
}

/* 每秒恢复速率：小数值保留 1 位小数，大数值用缩写 */
function fmtRate(v) {
  v = Number(v) || 0;
  return v >= 1000 ? fmtNum(v) : (Math.round(v * 10) / 10).toFixed(1);
}

/* 灵石数量：低阶为主，超过 100 枚低阶时折算中阶显示 */
function fmtStones(n) {
  n = Number(n) || 0;
  if (n >= 10000) {
    const zhong = Math.floor(n / 100);
    return fmtNum(zhong) + ' 中阶';
  }
  return fmtNum(n) + ' 低阶';
}

function fmtClock(t) {
  const d = new Date(t);
  const p = function (x) { return x < 10 ? '0' + x : String(x); };
  return p(d.getHours()) + ':' + p(d.getMinutes()) + ':' + p(d.getSeconds());
}

/* 百分比文本：0.03 → +3%，0.012 → +1.2% */
function pctText(v) {
  const n = v * 100;
  const s = Math.abs(n - Math.round(n)) < 0.001 ? String(Math.round(n)) : n.toFixed(1);
  return (v >= 0 ? '+' : '') + s + '%';
}

/* 当前挂机进度（单一动作槽） */
function currentProgress() {
  const act = state.action;
  if (!act) return null;
  if (act.skill === 'planet') {
    const p = state.planet;
    const need = PLANET.SPAWN_BASE;
    /* 用引擎在回填生成周期之前记录的取样值，避免 100ms 采样错过满格 */
    const raw = isFinite(p.cycleCur) ? p.cycleCur : (need - (isFinite(p.timer) ? p.timer : need));
    const cur = Math.max(0, Math.min(need, raw));
    return {
      skill: 'planet', name: '穿越星球 · 巡航', icon: '🪐',
      pct: state.actionWaiting ? 1 : cur / need,
      cur: state.actionWaiting ? need : cur, need: need,
      waiting: state.actionWaiting
    };
  }
  if (act.skill === 'tower') {
    const c = state.skills.combat;
    const t = c.target;
    /* 用「已打掉的血量比例」表示本层进度；层数切换由面板增量刷新 */
    return {
      skill: 'tower', name: '锁妖塔 · 第 ' + c.tower + ' 层', icon: '🗼',
      pct: t && t.maxHp > 0 ? Math.max(0, Math.min(1, 1 - t.hp / t.maxHp)) : 0
    };
  }
  if (act.skill === 'rift') {
    const c = state.skills.combat;
    const t = c.target;
    /* 裂缝同样用「已打掉的血量比例」表示修复进度，进度条可正常走到 100% */
    return {
      skill: 'rift', name: '异界裂缝 · 第 ' + (c.rift >= 0 ? c.rift : state.rift.tier) + ' 层', icon: '🌀',
      pct: t && t.maxHp > 0 ? Math.max(0, Math.min(1, 1 - t.hp / t.maxHp)) : 0
    };
  }
  if (act.skill === 'elem') {
    const c = state.skills.combat;
    const t = c.target;
    const slot = state.elemRifts && state.elemRifts.slots ? state.elemRifts.slots[c.elem] : null;
    const el = findElemRift(t && t.elem) || findElemRift(slot && slot.elem) || ELEM_RIFT.ELEMENTS[0];
    /* 属性裂缝同样用「已打掉的血量比例」表示修复进度，可正常走到 100% */
    return {
      skill: 'elem', name: el.name + '·时空裂缝', icon: el.icon,
      pct: t && t.maxHp > 0 ? Math.max(0, Math.min(1, 1 - t.hp / t.maxHp)) : 0
    };
  }
  if (act.skill === 'riftmon') {
    const c = state.skills.combat;
    const t = c.target;
    const tier = c.riftMon >= 0 ? c.riftMon : (state.riftMon ? riftMonTierClamp(state.riftMon.tier) : 0);
    /* 裂缝怪物同样用「已打掉的血量比例」表示修复进度，可正常走到 100% */
    return {
      skill: 'riftmon', name: RIFT_MON.NAME + ' · 强度 ' + tier, icon: RIFT_MON.ICON,
      pct: t && t.maxHp > 0 ? Math.max(0, Math.min(1, 1 - t.hp / t.maxHp)) : 0
    };
  }
  if (act.skill === 'combat') {
    const c = state.skills.combat;
    if (!c.monster) return null;
    const m = findMonster(c.monster);
    if (!m) return null;
    if (!c.target) return { skill: 'combat', name: '搜寻「' + m.name + '」', pct: 0 };
    return { skill: 'combat', name: '讨伐「' + m.name + '」', pct: 1 };
  }
  const def = findActivity(act.skill, act.id);
  if (!def) return null;
  const t = effTime(def, act.id);
  const raw = isFinite(state.actionCur) ? state.actionCur : state.actionTimer;
  const cur = Math.max(0, Math.min(t, raw));
  return {
    skill: act.skill, name: def.name, icon: def.icon,
    pct: state.actionWaiting ? 1 : cur / t,
    cur: state.actionWaiting ? t : cur, need: t,
    waiting: state.actionWaiting
  };
}

/* ================================================================== 顶栏 */
function renderTop() {
  const st = calcStats();
  const r = realmInfo(state.skills.cultivation.lvl);

  setHTML('#resBar',
    '<div class="res"><span class="rico">💠</span><span class="rval">' + fmtStones(state.gold) + '</span><span class="rname">灵石</span></div>' +
    '<div class="res"><span class="rico">✨</span><span class="rval">' + fmtNum(state.spirit) + '</span><span class="rname">灵力</span></div>' +
    /* 星砂：观星后才显示，避免开局顶栏冗余 */
    (state.stardust > 0 || state.skills.formation.lvl > 1
      ? '<div class="res"><span class="rico">💫</span><span class="rval">' + fmtNum(state.stardust) + '</span><span class="rname">星砂</span></div>'
      : '') +
    /* 生命之种：仅在已获得或已开辟小世界后显示，避免开局顶栏冗余 */
    (state.seed > 0 || smallWorldLevel() > 0
      ? '<div class="res"><span class="rico">🌱</span><span class="rval">' + fmtNum(state.seed) + '</span><span class="rname">生命之种</span></div>'
      : '') +
    '<div class="res"><span class="rico">' + r.realmIcon + '</span><span class="rval">' + r.full + '</span><span class="rname">境界</span></div>' +
    '<div class="res"><span class="rico">⚔️</span><span class="rval">' + st.atkMin + '~' + st.atkMax + '</span><span class="rname">伤害</span></div>' +
    '<div class="res"><span class="rico">🎯</span><span class="rval">' + st.hit + '</span><span class="rname">命中</span></div>' +
    '<div class="res"><span class="rico">🛡️</span><span class="rval">' + Math.round(st.dr * 100) + '%</span><span class="rname">减伤</span></div>');
}

/* =============================================================== 左侧技能栏 */
function renderSidebar() {
  let html = '';

  /* 1. 任务（置顶） */
  let doneN = 0;
  TASKS.forEach(function (t) { const r = state.tasks[t.id]; if (r && r.done && !r.claimed) doneN += 1; });
  const onTask = state.ui.active === 'tasks' ? ' on' : '';
  html +=
    '<button class="skillbtn taskbtn' + onTask + '" data-act="select" data-skill="tasks">' +
    '<span class="sico">📜</span>' +
    '<span class="sinfo"><span class="sname">任务</span><br>' +
    '<span class="slvl">成就与奖励' + (doneN ? ' <span class="badge">' + doneN + '</span>' : '') + '</span></span>' +
    '</button>';

  /* 2. 背包（第二位） */
  const onBag = state.ui.active === 'bag' ? ' on' : '';
  html +=
    '<button class="skillbtn bagbtn' + onBag + '" data-act="select" data-skill="bag">' +
    '<span class="sico">🎒</span>' +
    '<span class="sinfo"><span class="sname">背包</span><br>' +
    '<span class="slvl"><span data-invcount>' + invSlotsUsed() + ' / ' + CONFIG.INV_SLOTS + '</span></span></span>' +
    '</button>';

  /* 3. 市集（第三位） */
  const onShop = state.ui.active === 'shop' ? ' on' : '';
  html +=
    '<button class="skillbtn shopbtn' + onShop + '" data-act="select" data-skill="shop">' +
    '<span class="sico">🏪</span>' +
    '<span class="sinfo"><span class="sname">市集</span><br>' +
    '<span class="slvl">采买 · 出售</span></span>' +
    '</button>';

  /* 3.5 穿越星球（紧随市集，点击面板可加速） */
  const onPlanet = state.ui.active === 'planet' ? ' on' : '';
  const busyPlanet = (state.action && (state.action.skill === 'planet' || state.action.skill === 'rift' || state.action.skill === 'elem' || state.action.skill === 'riftmon')) ? '<span class="dot"></span>' : '';
  const riftBadge = ((state.rift && state.rift.open) || riftMonAlive()) ? ' <span class="badge">!</span>' : '';
  html +=
    '<button class="skillbtn planetbtn' + onPlanet + '" data-act="select" data-skill="planet">' +
    '<span class="sico">🪐</span>' +
    '<span class="sinfo"><span class="sname">穿越星球</span><br>' +
    '<span class="slvl">灵石 · 星砂 · 材料' + busyPlanet + riftBadge + '</span></span>' +
    '</button>';

  /* 4. 修炼 */
  const cult = SKILLS.cultivation;
  const cultS = state.skills.cultivation;
  const onCult = state.ui.active === 'cultivation' ? ' on' : '';
  const busyCult = (state.action && state.action.skill === 'cultivation') ? '<span class="dot"></span>' : '';
  html +=
    '<button class="skillbtn' + onCult + '" data-act="select" data-skill="cultivation">' +
    '<span class="sico">' + cult.icon + '</span>' +
    '<span class="sinfo"><span class="sname">' + cult.name + '</span><br>' +
    '<span class="slvl">' + realmInfo(cultS.lvl).full + busyCult + '</span></span>' +
    '<span class="sbar" data-bar="cultivation"></span>' +
    '</button>';

  /* 5. 战斗 */
  const comb = SKILLS.combat;
  const combS = state.skills.combat;
  const onComb = state.ui.active === 'combat' ? ' on' : '';
  const busyComb = (state.action && state.action.skill === 'combat') ? '<span class="dot"></span>' : '';
  html +=
    '<button class="skillbtn' + onComb + '" data-act="select" data-skill="combat">' +
    '<span class="sico">' + comb.icon + '</span>' +
    '<span class="sinfo"><span class="sname">' + comb.name + '</span><br>' +
    '<span class="slvl">Lv.' + combS.lvl + busyComb + '</span></span>' +
    '<span class="sbar" data-bar="combat"></span>' +
    '</button>';

  /* 5.5 锁妖塔（紧随战斗；层数永久累积，待领奖时给出感叹号） */
  const onTower = state.ui.active === 'tower' ? ' on' : '';
  const busyTower = towerRunning() ? '<span class="dot"></span>' : '';
  const towerBadge = state.tower.pending ? ' <span class="badge">!</span>' : '';
  html +=
    '<button class="skillbtn towerbtn' + onTower + '" data-act="select" data-skill="tower">' +
    '<span class="sico">🗼</span>' +
    '<span class="sinfo"><span class="sname">锁妖塔</span><br>' +
    '<span class="slvl">第 ' + state.tower.current + ' 层 · 最高 ' + state.tower.best +
    busyTower + towerBadge + '</span></span>' +
    '</button>';

  /* 其余技能（跳过 cultivation / combat，已在上面单独渲染） */
  SKILL_ORDER.forEach(function (id) {
    if (id === 'cultivation' || id === 'combat') return;
    const sk = SKILLS[id];
    const s = state.skills[id];
    const on = state.ui.active === id ? ' on' : '';
    const busy = (state.action && state.action.skill === id) ? '<span class="dot"></span>' : '';
    html +=
      '<button class="skillbtn' + on + '" data-act="select" data-skill="' + id + '">' +
      '<span class="sico">' + sk.icon + '</span>' +
      '<span class="sinfo"><span class="sname">' + sk.name + '</span><br>' +
      '<span class="slvl">Lv.' + s.lvl + busy + '</span></span>' +
      '<span class="sbar" data-bar="' + id + '"></span>' +
      '</button>';
  });

  /* 世界 · 洞天（建筑被动收益，不占用动作槽） */
  const onWorld = state.ui.active === 'world' ? ' on' : '';
  html +=
    '<button class="skillbtn worldbtn' + onWorld + '" data-act="select" data-skill="world">' +
    '<span class="sico">🏯</span>' +
    '<span class="sinfo"><span class="sname">世界</span><br>' +
    '<span class="slvl">洞天 · 建设度 ' + worldLevel() + '</span></span>' +
    '</button>';

  /* 信徒（招募 · 上阵，上阵位数 = 招贤殿等级） */
  const onDisc = state.ui.active === 'disciples' ? ' on' : '';
  const dInfo = discipleUnlocked()
    ? ('上阵 ' + discipleEquippedCount() + '/' + discipleSlots() +
       ' · 仓库 ' + discipleTotal() + '/' + discipleStoreCap())
    : '需营造招贤殿';
  html +=
    '<button class="skillbtn discbtn' + onDisc + '" data-act="select" data-skill="disciples">' +
    '<span class="sico">🙏</span>' +
    '<span class="sinfo"><span class="sname">信徒</span><br>' +
    '<span class="slvl">' + dInfo + '</span></span>' +
    '</button>';

  /* 设置（兑换码 + 后续设置落位） */
  const onSet = state.ui.active === 'settings' ? ' on' : '';
  html +=
    '<button class="skillbtn setbtn' + onSet + '" data-act="select" data-skill="settings">' +
    '<span class="sico">🔧</span>' +
    '<span class="sinfo"><span class="sname">设置</span><br>' +
    '<span class="slvl">兑换码 · 通用</span></span>' +
    '</button>';

  /* 测试控制台：仅本次运行兑换成功后出现（DEV 为会话级，不落存档） */
  if (DEV.unlocked) {
    const onDev = state.ui.active === 'devtools' ? ' on' : '';
    html +=
      '<button class="skillbtn devbtn' + onDev + '" data-act="select" data-skill="devtools">' +
      '<span class="sico">🔬</span>' +
      '<span class="sinfo"><span class="sname">测试控制台</span><br>' +
      '<span class="slvl">仅本次运行有效</span></span>' +
      '</button>';
  }

  setHTML('#sidebar', html);
}

/* ============================================================= 中间内容面板 */
function skillHeader(id) {
  const sk = SKILLS[id];
  const li = levelInfo(id);
  const lvlLabel = (id === 'cultivation') ? realmInfo(li.lvl).full : ('Lv.' + li.lvl);

  /* 经验/修为数值放进占位节点，由 updateXpText 增量刷新。
     若把数值直接写进 HTML，每次 tick 数值变化都会让整个面板重绘，
     鼠标悬停状态被反复清空 —— 这就是按钮"闪烁"的根因。 */
  return '<div class="phead"><h2>' + sk.icon + ' ' + sk.name + '</h2>' +
    '<span class="pdesc">' + sk.desc + '</span></div>' +
    '<div class="pxp"><div class="bar"><i class="xpfill" data-xpbar="' + id + '" style="width:' + (li.pct * 100).toFixed(1) + '%"></i></div>' +
    '<div class="xptext">' + lvlLabel + ' · ' +
    (li.max ? '已臻圆满' : '<span data-xp="' + id + '"></span>') + '</div></div>';
}

/* 精通小条（等级与效果文本由 updateXpBars 增量刷新） */
function masteryFxText(id) {
  const m = masteryOf(id);
  const d = Math.min(0.99, m.lvl * CONFIG.MASTERY_DOUBLE_PER_LVL);
  const t = Math.min(0.20, m.lvl * CONFIG.MASTERY_TIME_PER_LVL);
  return '双倍 ' + pctText(d) + ' · 耗时 -' + (t * 100).toFixed(1) + '%';
}

function masteryHTML(id) {
  const mi = masteryInfo(id);
  const pct = mi.max ? 100 : mi.pct * 100;
  return '<span class="mline">精通 <b>Lv.<span data-mlvl="' + id + '">' + mi.lvl + '</span></b>' +
    '<i class="mbar"><b data-mastery="' + id + '" style="width:' + pct.toFixed(1) + '%"></b></i>' +
    '<span class="mfx" data-mfx="' + id + '">' + masteryFxText(id) + '</span></span>';
}

/* 采集 / 修炼动作列表（按所需等级从低到高排列） */
function gatherEntries(list, skillId) {
  const s = state.skills[skillId];
  const sorted = list.slice().sort(function (a, b) { return a.req - b.req; });
  let html = '<div class="grid">';
  sorted.forEach(function (a) {
    const locked = s.lvl < a.req;
    const on = (state.action && state.action.skill === skillId && state.action.id === a.id) ? ' on' : '';
    const out = a.out || {};
    let yieldTxt;
    if (out.id) yieldTxt = '产出 1 × ' + itemIcon(out.id) + itemName(out.id);
    else {
      const parts = [];
      if (out.spirit) parts.push('灵力 +' + out.spirit);
      if (out.heal) parts.push('回复 ' + out.heal + ' 生命');
      if (out.stardust) parts.push('💫 星砂 +' + out.stardust);
      yieldTxt = parts.join(' · ');
    }
    html +=
      '<div class="entry' + on + (locked ? ' locked' : '') + '" data-act="action" data-skill="' + skillId + '" data-id="' + a.id + '">' +
      '<span class="eico">' + a.icon + '</span>' +
      '<span class="emain"><span class="ename">' + a.name +
      (locked ? '<span class="etag">需 Lv.' + a.req + '</span>' : '') + '</span>' +
      '<span class="emeta">' + fmtDur(a.time) + '/次 · 经验 <b>' + a.xp + '</b> · ' + yieldTxt + '</span>' +
      masteryHTML(a.id) + '</span>' +
      '</div>';
  });
  html += '</div>';
  return html;
}

/* 配方列表（带材料检查；按所需等级从低到高排列） */
function recipeEntries(list, skillId) {
  const sorted = list.slice().sort(function (a, b) { return a.req - b.req; });
  let html = '<div class="grid">';
  sorted.forEach(function (r) {
    const s = state.skills[skillId];
    const locked = s.lvl < r.req;
    const on = (state.action && state.action.skill === skillId && state.action.id === r.id) ? ' on' : '';
    let ok = true;
    /* 材料数量用独立节点 + updateBars 增量刷新，避免数量变动重建可点击行 */
    const mats = r.in.map(function (m) {
      if (invCount(m.id) < m.qty) ok = false;
      return '<span class="matneed" data-mat="' + m.id + '" data-req="' + m.qty + '">' +
        itemIcon(m.id) + itemName(m.id) + ' <b class="mhave">0</b>/' + m.qty + '</span>';
    }).join(' · ');

    html +=
      '<div class="entry' + on + (locked ? ' locked' : '') + '" data-act="action" data-skill="' + skillId + '" data-id="' + r.id + '">' +
      '<span class="eico">' + r.icon + '</span>' +
      '<span class="emain"><span class="ename">' + r.name +
      (locked ? '<span class="etag">需 Lv.' + r.req + '</span>' : '') +
      (on ? '<span class="etag">进行中</span>' : (ok ? '' : '<span class="etag">材料不足</span>')) +
      '</span>' +
      '<span class="emeta">' + fmtDur(r.time) + '/次 · 经验 <b>' + r.xp + '</b><br>消耗：' + mats + '<br>产出：' + recipeOutText(r.out) + '</span>' +
      masteryHTML(r.id) + '</span>' +
      '</div>';
  });
  html += '</div>';
  return html;
}

/* 炼器面板：锻造装备 */
function renderCrafting() {
  const list = RECIPES.crafting;
  return '<div class="secttl">锻造 · 法宝护具</div>' + recipeEntries(list, 'crafting');
}

/* 熔炼面板：矿石→锭 + 聚灵 */
function renderSmelting() {
  const list = RECIPES.smelting;
  return '<div class="secttl">熔炼 · 矿石转化 / 聚灵化灵力</div>' + recipeEntries(list, 'smelting');
}

/* 采药面板 */
function renderHerbalism() {
  return '<div class="secttl">采药 · 灵草药材</div>' + gatherEntries(ACTIONS.herbalism, 'herbalism');
}

/* 炼丹面板 */
function renderAlchemy() {
  const pills = RECIPES.alchemy.filter(function (r) { return r.cat === 'pill'; });
  return '<div class="secttl">丹方 · 炼制丹药</div>' + recipeEntries(pills, 'alchemy');
}

/* 修炼面板：境界 + 突破 */
function renderCultivation() {
  const s = state.skills.cultivation;
  const r = realmInfo(s.lvl);
  const bp = breakPreview();
  const li = levelInfo('cultivation');

  let html = '';
  html += '<div class="secttl">当前境界</div>';
  html += '<div class="realmcard" style="--rc:' + r.color + '">' +
    '<span class="rico">' + r.realmIcon + '</span>' +
    '<div class="rmain"><div class="rname">' + r.full + '</div>' +
    '<div class="rdesc">' + r.realmDesc + ' · 第 ' + (r.stageIndexInRealm + 1) + '/' + r.layerCount + ' 阶</div>' +
    '<div class="bar rbar"><i data-realmbar style="width:' + (li.pct * 100).toFixed(1) + '%"></i></div>' +
    '<div class="rsub"><span data-cultxp></span>' +
    ' · 悟性 ' + state.insight + '（每点 修炼+1% / 突破+1%）</div>' +
    '</div></div>';

  /* 五行灵根：属性值 = 对应生计的技能等级 */
  html += '<div class="secttl">灵根五行</div><div class="wxgrid">';
  WUXING.forEach(function (w) {
    html += '<div class="wxcard" style="--wc:' + w.color + '" title="' + w.desc + '">' +
      '<span class="wxicon">' + w.icon + '</span>' +
      '<div class="wxmain"><b>' + w.name + '灵根</b><br><small>Lv.' + state.skills[w.skill].lvl + ' · ' + SKILLS[w.skill].name + '</small></div>' +
      '</div>';
  });
  html += '</div>';

  /* 突破区 */
  html += '<div class="secttl">冲击境界</div>';
  if (bp.max) {
    html += '<div class="breakbox"><div class="btitle">已达修行尽头</div><div class="bnote">已至「' + r.full + '」，仙途至此，再无瓶颈。</div></div>';
  } else {
    /* 三项条件的实时数值同样用占位节点，避免每次 tick 重建突破区 */
    const rows = [];
    rows.push('<span class="' + (bp.xpOk ? 'ok' : 'no') + '" data-breakxp data-need="' + bp.need + '"></span>');
    if (bp.pill) rows.push('<span class="' + (bp.pillOk ? 'ok' : 'no') + '" data-breakpill="' + bp.pill + '"></span>');
    if (bp.gold > 0) rows.push('<span class="' + (bp.goldOk ? 'ok' : 'no') + '" data-breakgold data-need="' + bp.gold + '"></span>');

    let canBreak = bp.xpOk && bp.pillOk && bp.goldOk;
    let wxNote = '';
    if (bp.wx) {
      const wlist = WUXING.map(function (w) {
        const lvl = state.skills[w.skill].lvl;
        const ok = lvl >= 100;
        return '<span class="' + (ok ? 'ok' : 'no') + '">' + w.icon + w.name + ' ' + Math.min(100, lvl) + '/100</span>';
      }).join(' ');
      wxNote = '<div class="bnote">冲击炼虚大圆满需五行灵根全部 Lv.100：<br>' + wlist + '</div>';
      canBreak = canBreak && bp.wx.ok;
    }
    html += '<div class="breakbox' + (canBreak ? ' ready' : '') + '">' +
      '<div class="btitle">下一境界：<b>' + bp.next.full + '</b>' + (bp.boundary ? '<span class="etag warn">跨大境界</span>' : '') + '</div>' +
      '<div class="reqs">' + rows.join('') + '</div>' +
      wxNote +
      '<div class="bnote">突破成功率 <b>' + Math.round(bp.rate * 100) + '%</b>（基础 ' + Math.round((bp.rate - state.insight * 0.01) * 100) + '% + 悟性 +' + state.insight + '%）。失败将损失 ' + Math.round(CONFIG.BREAK_FAIL_LOSS * 100) + '% 修为。</div>' +
      '<button class="btn break-btn' + (canBreak ? '' : ' disabled') + '" data-act="break">' +
      (bp.xpOk ? '冲击突破' : '修为未满') + '</button>' +
      '</div>';
  }

  html += '<div class="secttl">打坐吐纳</div>' + gatherEntries(ACTIONS.cultivation, 'cultivation');
  return html;
}

/* 战斗面板 */
function renderCombat() {
  const c = state.skills.combat;
  const st = calcStats();
  const pr = currentProgress();
  const dg = c.dungeon ? findDungeon(c.dungeon) : null;
  let html = '';

  html += '<div class="secttl">当前对战' +
    (dg ? ' · 秘境「' + dg.name + '」第 ' + (c.floor + 1) + ' / ' + dg.floors.length + ' 波' : '') + '</div>';
  if (c.monster && c.target) {
    const t = c.target;
    const myHit = Math.round(hitChance(st.hit, t.ev) * 100);
    const itsHit = Math.round(hitChance(t.hit, st.ev) * 100);
    html +=
      '<div class="battle">' +
      '<div class="fighter"><div class="fname">你（' + realmInfo(state.skills.cultivation.lvl).full + '）</div>' +
      '<div class="fico">🧙</div><div class="bar"><i class="hpfill" style="width:0%"></i></div>' +
      '<div class="fstat">生命 <b class="hpnum" data-side="me">0 / 0</b>' +
      ' · 伤害 ' + st.atkMin + '~' + st.atkMax + '<br>命中 ' + st.hit + ' · 闪避 ' + st.ev + ' · 减伤 ' + Math.round(st.dr * 100) + '%' +
      '<br>命中率 ' + myHit + '%（对手闪避 ' + t.ev + '）</div></div>' +
      '<div class="vs">⚔<br>VS</div>' +
      '<div class="fighter"><div class="fname">' + t.name + ' Lv.' + t.lvl + '</div>' +
      '<div class="fico">' + t.icon + '</div><div class="bar"><i class="mfill" style="width:0%"></i></div>' +
      '<div class="fstat">生命 <b class="hpnum" data-side="foe">0 / 0</b>' +
      ' · 伤害 ' + t.atkMin + '~' + t.atkMax + '<br>命中 ' + t.hit + ' · 闪避 ' + t.ev + ' · 减伤 ' + Math.round(t.dr * 100) + '%' +
      '<br>其命中率 ' + itsHit + '% · 出手 ' + t.interval + 's</div></div>' +
      '</div>';
  } else if (c.monster) {
    html += '<div class="empty">正在搜寻下一个「' + findMonster(c.monster).name + '」…</div>';
  } else {
    html += '<div class="empty">未选定对手。战斗会循环讨伐，击败后按妖兽各自间隔刷新。</div>';
  }

  html += '<div class="secttl">妖兽名录</div><div class="grid">';
  MONSTERS.slice().sort(function (a, b) { return a.lvl - b.lvl; }).forEach(function (m) {
    const on = (state.action && state.action.skill === 'combat' && state.action.id === m.id) ? ' on' : '';
    const risky = state.skills.combat.lvl + 4 < m.lvl;
    const myHit = Math.round(hitChance(st.hit, m.ev) * 100);
    const itsHit = Math.round(hitChance(m.hit, st.ev) * 100);
    const drops = m.drops.map(function (d) {
      return itemIcon(d.id) + itemName(d.id) + ' ' + Math.round(d.chance * 100) + '%';
    }).join(' · ');
    html +=
      '<div class="entry' + on + '" data-act="monster" data-id="' + m.id + '">' +
      '<span class="eico">' + m.icon + '</span>' +
      '<span class="emain"><span class="ename">' + m.name + ' Lv.' + m.lvl +
      (risky ? '<span class="etag warn">危险</span>' : '') + '</span>' +
      '<span class="emeta">生命 <b>' + m.hp + '</b> · 伤害 ' + m.atkMin + '~' + m.atkMax + ' · 命中 ' + m.hit + ' · 闪避 ' + m.ev + ' · 减伤 ' + Math.round(m.dr * 100) + '%<br>' +
      '我方命中率 <b>' + myHit + '%</b> · 其命中率 ' + itsHit + '% · 经验 ' + m.xp + ' · 灵石 ' + m.gold[0] + '~' + m.gold[1] + '<br>' +
      '掉落：' + drops + '</span>' +
      masteryHTML(m.id) + '</span>' +
      '</div>';
  });
  html += '</div>';

  /* 秘境 · 副本（梅尔沃式波次挑战；隐藏秘境需满足跨技能条件才显形） */
  html += '<div class="secttl">秘境 · 副本</div><div class="grid">';
  DUNGEONS.slice().sort(function (a, b) { return a.req - b.req; }).forEach(function (d) {
    const u = dungeonUnlockInfo(d);
    const clears = state.dungeons[d.id] || 0;
    if (!u.unlocked) {
      html +=
        '<div class="entry locked">' +
        '<span class="eico">❓</span>' +
        '<span class="emain"><span class="ename">？？？<span class="etag">未开启</span></span>' +
        '<span class="emeta">隐藏秘境 · 需' + u.text + '（' + u.have + ' / ' + u.need + '）</span></span>' +
        '</div>';
      return;
    }
    const on = (state.action && state.action.skill === 'combat' && state.action.id === d.id) ? ' on' : '';
    const lvOk = state.skills.combat.lvl >= d.req;
    const floors = d.floors.map(function (fid) {
      const fm = findMonster(fid);
      return fm ? fm.icon + fm.name + ' Lv.' + fm.lvl : fid;
    }).join(' → ');
    const reward = ['💠 ' + fmtNum(d.reward.gold)];
    (d.reward.items || []).forEach(function (it) {
      reward.push(it.qty + ' × ' + itemIcon(it.id) + itemName(it.id));
    });
    if (d.reward.xp) reward.push('战斗经验 ' + fmtNum(d.reward.xp));
    html +=
      '<div class="entry' + on + '" data-act="dungeon" data-id="' + d.id + '">' +
      '<span class="eico">' + d.icon + '</span>' +
      '<span class="emain"><span class="ename">' + d.name +
      (lvOk ? '' : '<span class="etag warn">需战斗 Lv.' + d.req + '</span>') +
      '<span class="etag">通关 ' + clears + ' 次</span></span>' +
      '<span class="emeta">' + esc(d.desc) + '<br>' +
      d.floors.length + ' 波：' + floors + '<br>' +
      '通关奖励：' + reward.join(' · ') + '</span></span>' +
      '</div>';
  });
  html += '</div>';
  return html;
}

/* 任务面板 */
function renderTasks() {
  let html = '<div class="phead"><h2>📜 任务 · 成就</h2><span class="pdesc">达成条件后可领取奖励</span></div>';
  html += '<div class="grid">';
  let claimedN = 0;
  TASKS.forEach(function (t) {
    const rec = state.tasks[t.id] || { done: false, claimed: false };
    if (rec.claimed) claimedN += 1;
    const cls = rec.claimed ? ' done' : (rec.done ? ' ready' : '');
    const reward = [];
    if (t.reward.gold) reward.push('💠 ' + fmtNum(t.reward.gold));
    if (t.reward.spirit) reward.push('✨ ' + fmtNum(t.reward.spirit));
    (t.reward.items || []).forEach(function (i) { reward.push(itemIcon(i.id) + itemName(i.id) + '×' + i.qty); });

    let btn = '<span class="etag">进行中</span>';
    if (rec.claimed) btn = '<span class="etag">已领取</span>';
    else if (rec.done) btn = '<button class="mini gold" data-act="claim" data-id="' + t.id + '">领取</button>';

    html += '<div class="entry taskentry' + cls + '">' +
      '<span class="eico">' + (rec.claimed ? '✅' : (rec.done ? '🎁' : '🔲')) + '</span>' +
      '<span class="emain"><span class="ename">' + t.name + ' ' + btn + '</span>' +
      '<span class="emeta">' + t.desc + '<br>奖励：' + reward.join(' · ') + '</span></span>' +
      '</div>';
  });
  html += '</div>';
  html += '<div class="secttl">进度 ' + claimedN + ' / ' + TASKS.length + '</div>';
  return html;
}

/* 穿越星球面板：中心星球 + 四周飞来的灵石 / 星砂 / 材料 */
/* 星球面板：只渲染一次静态骨架，所有每 tick 变化的值都走 data-* 增量更新。
   飞行物挂在 #planetItems 容器里，由 updatePlanet 按 pid 增删，不再整树重写。 */
function planetNode(it) {
  const node = document.createElement('span');
  node.className = 'pitem ' + (it.kind === 'gold' ? 'k-gold' : it.kind === 'star' ? 'k-star' : 'k-mat');
  node.dataset.pid = String(it.pid);
  if (it.kind === 'gold') { node.title = '灵石'; node.textContent = '💠'; }
  else if (it.kind === 'star') { node.title = '星砂'; node.textContent = '💫'; }
  else { node.title = itemName(it.id); node.textContent = itemIcon(it.id); }
  return node;
}

function renderPlanet() {
  return '<div class="planetwrap" data-act="planetboost">' +
    '<div class="phead"><h2>🪐 穿越星球</h2>' +
    '<span class="pdesc">开启后占用动作槽，每吸收 1 件消耗 ✨ <b data-pg="cost">0</b> 灵力；' +
    '巡航时每生成 1 件消耗 💧 <b data-pg="auracost">0</b> 灵气浓度（穿越后逐次 -10%，下限 ' +
    PLANET.AURA_COST_MIN + '）；停止运转后浓度才恢复。' +
    '每次穿越成功后生成异界裂缝，修复后才能继续穿越。' +
    '点击界面加速：生成与飞行 ×' + PLANET.BOOST_MULT +
    '（每次 +' + PLANET.BOOST_ADD + ' 秒，上限 ' + PLANET.BOOST_BASE_CAP + ' 秒 + ' +
    PLANET.BOOST_GT_BONUS + ' 秒 × 引力塔等级）</span></div>' +
    /* 朝代 / 穿越：只改朝代与计数，不影响星球产出；价格与差额由 updatePlanet 增量写入 */
    '<div class="planetdyn">' +
    '<span class="pbchip">当前朝代 <b data-pg="dynasty">清朝</b></span>' +
    '<span class="pbchip">穿越次数 <b data-pg="cross">0</b></span>' +
    '<span class="pbchip">灵气浓度 <b data-pg="aura">0.0% (0/0)</b>' +
    '<span class="pbgt" data-pg="aurahint"></span></span>' +
    '<button class="pbtn cross" data-act="planetcross" data-planetcross disabled>穿越</button>' +
    '<span class="pbstate" data-pg="crossnote"></span>' +
    '</div>' +
    /* 异界裂缝入口：未修复时穿越被锁定，点击进入裂缝战斗视图 */
    (function () {
      const r = state.rift || { open: true, tier: 0 };
      const open = !!r.open;
      const tier = riftTierClamp(r.tier);
      const next = Math.min(RIFT.MAX_TIER, planetCrossCount() + 1);
      return '<div class="riftcard ' + (open ? 'open' : 'fixed') + '" data-act="riftopen" title="' +
        (open ? '需先修复异界裂缝' : '裂缝已修复，点击查看') + '">' +
        '<span class="rfico">🌀</span>' +
        '<span class="rfmain"><b>异界裂缝 · 第 ' + (open ? tier : next) + ' 层' +
        (open ? '' : '（下一道）') + '</b>' +
        '<span class="rfsub">' + (open
          ? '未修复 · 穿越已锁定，点击进入裂缝修复'
          : '已修复 · 穿越成功后将生成第 ' + next + ' 层裂缝') + '</span></span>' +
        '<span class="rfgo">进入 ›</span>' +
        '</div>';
    })() +
    /* 裂缝怪物：存在时锁定星球运转（不锁穿越），击败后可正常运转 */
    riftMonCardHTML() +
    /* 五行属性裂缝：3 个位置常驻，每 3 小时整轮刷新；修复后该位置留空 */
    elemRiftCardsHTML() +
    '<div class="planetctrl">' +
    '<button class="pbtn" data-act="planetrun" data-planetrun>开启运转</button>' +
    '<span class="pbstate" data-pg="runstate">未开启</span>' +
    '<span class="pbchip">当前灵力 <b data-pg="spirit">0</b></span>' +
    '</div>' +
    '<div class="planetstage" id="planetStage">' +
    '<div class="pglow"></div>' +
    '<div class="pcore"><span class="pring"></span><span class="pball">🪐</span></div>' +
    '<div class="planetitems" id="planetItems"></div>' +
    '</div>' +
    '<div class="planetbar">' +
    '<span class="pbchip">本局收获 💠 <b data-pg="gold">0</b></span>' +
    '<span class="pbchip">💫 <b data-pg="star">0</b></span>' +
    '<span class="pbchip">📦 <b data-pg="mat">0</b></span>' +
    '<span class="pbchip">已收集 <b data-pg="count">0</b> 件</span>' +
    '<span class="pbchip">加速上限 <b data-pg="boostcap">0</b>s<span class="pbgt" data-pg="boostgt"></span></span>' +
    '<span class="pbboost" data-planetboost>点击加速</span>' +
    '</div>' +
    /* 引力塔引导：文案与按钮状态由 updatePlanet 增量写入 */
    '<div class="planetgrav" data-act="goto" data-skill="world" data-id="mystic">' +
    '<span class="pgico">🛰️</span>' +
    '<span class="pgtxt" data-pg="grav"></span>' +
    '<button class="mini" data-planetgravbtn data-act="goto" data-skill="world" data-id="mystic">前往建造</button>' +
    '</div>' +
    '<div class="shopnote">四周随机生成：灵石 50% · 星砂 30% · 已解锁材料 20%（矿石 / 鱼 / 木头 / 草药等）。' +
    '巡航时生成消耗灵气浓度、吸收消耗灵力；浓度不足会暂停生成，停止运转后浓度才恢复。' +
    '「穿越」消耗灵气浓度（首次 💧 10000，之后按 1.6 倍 / 第 11 次起 1.12 倍递增），并让单件浓度消耗逐次 -10%（下限 ' +
    PLANET.AURA_COST_MIN + '）。浓度上限与恢复随引力塔等级和穿越次数一起成长。' +
    '穿越成功后立刻生成异界裂缝；裂缝未修复时穿越按钮置灰，需先修复。' +
    '</div>' +
    '</div>';
}

/* ================================================================== 锁妖塔 */
/* 静态骨架 + data-tower 占位；层数/敌人/按钮状态/奖励预览全部增量写入，
   高频刷新不会触发 #content 子节点重建 */
function renderTower() {
  return '<div class="towerwrap">' +
    '<div class="phead"><h2>🗼 锁妖塔</h2>' +
    '<span class="pdesc">无尽层挑战：每层一场独立战斗，击败后先领奖再进入下一层。' +
    '层数与难度永久累积、永不重置；阵亡只判本次失败，不降层，可原地重试。' +
    '挑战占用全局动作槽：开始时会中断其它动作，切换到其它动作会中断挑战。</span></div>' +
    '<div class="planetdyn">' +
    '<span class="pbchip">当前层 <b data-tower="floor">1</b></span>' +
    '<span class="pbchip">最高已通关 <b data-tower="best">1</b></span>' +
    '<span class="pbchip">状态 <b data-tower="state">未开始</b></span>' +
    '<span class="pbchip">战斗等级 Lv.<b data-tower="clvl">1</b></span>' +
    '</div>' +
    '<div class="towerstage">' +
    '<div class="towerfoe">' +
    '<span class="teicon" data-tower="eicon">👹</span>' +
    '<div class="tebody">' +
    '<div class="tename"><b data-tower="ename">—</b><span data-tower="elvl">第 1 层</span></div>' +
    '<div class="towerhp"><i data-tower="ehpfill"></i></div>' +
    '<div class="tenum" data-tower="ehp">—</div>' +
    '<div class="testats" data-tower="estats">—</div>' +
    '</div></div>' +
    '<div class="toweract">' +
    '<button class="pbtn" data-act="towerstart" data-tower="startbtn">挑战第 1 层</button>' +
    '<button class="pbtn cross" data-act="towerclaim" data-tower="claimbtn">领取奖励</button>' +
    '<span class="pbstate" data-tower="note"></span>' +
    '</div>' +
    '</div>' +
    '<div class="towerrewhead"><span class="secttl" data-tower="rewtitle">第 1 层奖励预览</span>' +
    '<span class="pbchip" data-tower="rewtag"></span></div>' +
    '<div class="towerreward" data-tower="reward"></div>' +
    '<div class="secttl">里程碑与规则</div>' +
    '<div class="shopnote">每 5 层为里程碑：灵石 ×2.5、星砂 ×3，并必掉 1 颗丹药；每 10 层额外追加材料（数量随层数提高）。' +
    '灵石奖励吃阵法 / 洞天 / 信徒的灵石加成，战斗经验走正常经验通道。领取前可预览，领取后不可重复领取；待领奖期间不能开启下一层。</div>' +
    '<div class="secttl">成长公式</div>' +
    '<div class="shopnote">第 f 层妖物（t = f-1）：生命 26×(1+0.30t+0.010×t<sup>1.9</sup>)，' +
    '攻击 5~9×(1+0.03t+0.005×t<sup>1.5</sup>)，命中 14+2.0t，闪避 8+1.2t，' +
    '减伤 min(35%, 2%+0.4%t)，出手间隔 max(1.8s, 2.8-0.002t)。属性只由层数决定，可反复预览。</div>' +
    '</div>';
}

let _towerRewardKey = '';

function towerRewardHTML(rw) {
  const parts = [
    '💠 灵石 <b>+' + fmtNum(rw.gold) + '</b>',
    '💫 星砂 <b>+' + fmtNum(rw.star) + '</b>',
    '⚔️ 战斗经验 <b>+' + fmtNum(rw.xp) + '</b>'
  ];
  rw.items.forEach(function (it) {
    parts.push(itemIcon(it.id) + ' ' + itemName(it.id) + ' <b>×' + it.qty + '</b>');
  });
  return '<div class="trewline">' + parts.join('<span class="trediv">·</span>') + '</div>' +
    (rw.milestone ? '<div class="trewtip">🎖 里程碑：灵石 ×' + TOWER.MILESTONE_GOLD +
      ' · 星砂 ×' + TOWER.MILESTONE_STAR + ' · 必掉丹药</div>' : '');
}

/* force=true：面板刚重建，需要重新填充奖励容器 */
function updateTower(force) {
  if (state.ui.active !== 'tower') return;
  const root = document.querySelector('.towerwrap');
  if (!root) { _towerRewardKey = ''; return; }

  const t = state.tower;
  const running = towerRunning();
  const c = state.skills.combat;
  const live = running && c.target ? c.target : null;
  const floor = live ? c.tower : (t.pending || t.current);
  const foe = live || towerEnemy(floor);
  const st = calcStats();

  function tw(key, txt) {
    const el = root.querySelector('[data-tower="' + key + '"]');
    if (el && el.textContent !== txt) el.textContent = txt;
  }

  tw('floor', String(t.current));
  tw('best', String(t.best));
  tw('clvl', String(state.skills.combat.lvl));
  tw('state', running ? '挑战中' : (t.pending ? '可领奖' : (t.failed ? '已阵亡 · 可重试' : '未开始')));
  tw('eicon', foe.icon);
  tw('ename', foe.name);
  tw('elvl', '第 ' + floor + ' 层');
  tw('ehp', '生命 ' + Math.max(0, Math.ceil(foe.hp)) + ' / ' + foe.maxHp);
  tw('estats', '攻击 ' + foe.atkMin + '~' + foe.atkMax + ' · 命中 ' + Math.round(foe.hit) +
    ' · 闪避 ' + Math.round(foe.ev) + ' · 减伤 ' + Math.round(foe.dr * 100) + '%' +
    ' · 出手 ' + foe.interval.toFixed(1) + 's · 我方命中 ' + Math.round(hitChance(st.hit, foe.ev) * 100) + '%');

  const fill = root.querySelector('[data-tower="ehpfill"]');
  if (fill) fill.style.width = (live ? Math.max(0, Math.min(1, foe.hp / foe.maxHp)) * 100 : 100).toFixed(1) + '%';

  const startBtn = root.querySelector('[data-tower="startbtn"]');
  if (startBtn) {
    const label = running ? '停止挑战' : ('挑战第 ' + t.current + ' 层');
    if (startBtn.textContent !== label) startBtn.textContent = label;
    startBtn.disabled = !running && !!t.pending;
  }
  const claimBtn = root.querySelector('[data-tower="claimbtn"]');
  if (claimBtn) {
    const label = t.pending ? ('领取第 ' + t.pending + ' 层奖励') : '领取奖励';
    if (claimBtn.textContent !== label) claimBtn.textContent = label;
    claimBtn.disabled = !t.pending;
  }

  tw('note', running
    ? '挑战中：击败本层后进入「可领奖」；切换到伐木 / 星球等其它动作会中断挑战。'
    : (t.pending
      ? '已通关第 ' + t.pending + ' 层，领取后进入第 ' + Math.min(TOWER.MAX_FLOOR, t.pending + 1) + ' 层。'
      : (t.failed
        ? '上次挑战阵亡，层数不降、未产生待领奖；疗伤后可再次挑战第 ' + t.current + ' 层。'
        : '层数与最高层永久保存，不因停止、切面板、关游戏或读档重置。')));

  const rwFloor = t.pending || t.current;
  const rw = towerReward(rwFloor);
  tw('rewtitle', '第 ' + rwFloor + ' 层奖励预览');
  tw('rewtag', rw.milestone ? '里程碑层' : (rw.decade ? '材料层' : '常规层'));
  const key = rwFloor + '|' + rw.gold + '|' + rw.star + '|' + rw.xp + '|' +
    rw.items.map(function (it) { return it.id + 'x' + it.qty; }).join(',');
  if (force || key !== _towerRewardKey) {
    const box = root.querySelector('[data-tower="reward"]');
    if (box) box.innerHTML = towerRewardHTML(rw);
    _towerRewardKey = key;
  }
}

/* =============================================================== 异界裂缝 */
/* 独立视图（仍属于穿越星球面板）：静态骨架 + data-rift 占位，增量刷新 */
function renderRift() {
  return '<div class="riftwrap">' +
    '<div class="phead"><h2>🌀 异界裂缝</h2>' +
    '<span class="pdesc">穿越成功后出现的异界裂隙。击败裂缝中的妖物即可完成修复；未修复时无法进行下一次穿越。' +
    '战斗占用全局动作槽，阵亡不惩罚、裂缝保持未修复，疗伤后可原地重试。</span></div>' +
    '<div class="planetdyn">' +
    '<span class="pbchip">裂缝层级 <b data-rift="tier">第 0 层</b></span>' +
    '<span class="pbchip">状态 <b data-rift="state">未修复</b></span>' +
    '<span class="pbchip">穿越限制 <b data-rift="gate">需先修复</b></span>' +
    '<button class="pbtn" data-act="riftback">返回星球</button>' +
    '</div>' +
    '<div class="towerstage riftstage">' +
    '<div class="towerfoe">' +
    '<span class="teicon" data-rift="eicon">🌀</span>' +
    '<div class="tebody">' +
    '<div class="tename"><b data-rift="ename">—</b><span data-rift="elvl">第 0 层</span></div>' +
    '<div class="towerhp"><i data-rift="ehpfill"></i></div>' +
    '<div class="tenum" data-rift="ehp">—</div>' +
    '<div class="testats" data-rift="estats">—</div>' +
    '</div></div>' +
    '<div class="toweract">' +
    '<button class="pbtn" data-act="riftstart" data-rift="startbtn">进入裂缝修复</button>' +
    '<button class="pbtn cross" data-act="riftback">返回星球</button>' +
    '<span class="pbstate" data-rift="note"></span>' +
    '</div>' +
    '</div>' +
    '<div class="towerrewhead"><span class="secttl" data-rift="rewtitle">修复奖励预览</span>' +
    '<span class="pbchip" data-rift="rewtag"></span></div>' +
    '<div class="towerreward" data-rift="reward"></div>' +
    '<div class="secttl">规则</div>' +
    '<div class="shopnote">每次穿越成功后立刻生成下一道裂缝，层级 = 当前穿越次数；裂缝未修复时穿越按钮置灰。' +
    '阵亡只退出战斗，不扣穿越次数、不清空裂缝，回血后可再次进入。' +
    '读档时不恢复进行中的裂缝战斗，但未修复状态会保留。</div>' +
    '<div class="secttl">成长公式</div>' +
    '<div class="shopnote">第 t 层（t = 生成时的穿越次数）：生命 34×(1+0.25t+0.008×t<sup>1.7</sup>)，' +
    '攻击 2~4×(1+0.15t+0.004×t<sup>1.5</sup>)，命中 8+0.9t，闪避 5+0.6t，' +
    '减伤 min(30%, 1%+0.12%t)，出手间隔 max(2.0s, 3.2-0.0015t)。' +
    '单次伤害另有「不超过自身生命上限 18%」的安全上限，保证后期不会被一刀秒。</div>' +
    '</div>';
}

let _riftRewardKey = '';

function riftRewardHTML(rw) {
  return '<div class="trewline">' +
    '💠 灵石 <b>+' + fmtNum(rw.gold) + '</b><span class="trediv">·</span>' +
    '💫 星砂 <b>+' + fmtNum(rw.star) + '</b><span class="trediv">·</span>' +
    '✨ 战斗经验 <b>+' + fmtNum(rw.xp) + '</b></div>' +
    '<div class="trewtip">修复后立刻发放；裂缝标记为已修复，返回星球即可继续穿越。</div>';
}

/* force=true：视图刚重建，需要重新填充奖励容器 */
function updateRift(force) {
  if (state.ui.active !== 'planet' || state.ui.planetView !== 'rift') return;
  const root = document.querySelector('.riftwrap');
  if (!root) { _riftRewardKey = ''; return; }

  const r = state.rift || { open: false, tier: 0 };
  const open = !!r.open;
  const running = riftRunning();
  const c = state.skills.combat;
  const live = running && c.target ? c.target : null;
  const tier = live ? c.rift : riftTierClamp(r.tier);
  const nextTier = Math.min(RIFT.MAX_TIER, planetCrossCount() + 1);
  /* 已修复时展示下一道裂缝的预览，方便玩家判断能否继续穿越 */
  const showTier = live ? tier : (open ? tier : nextTier);
  const foe = live || riftEnemy(showTier);
  const st = calcStats();

  function rw(key, txt) {
    const el = root.querySelector('[data-rift="' + key + '"]');
    if (el && el.textContent !== txt) el.textContent = txt;
  }

  rw('tier', '第 ' + tier + ' 层');
  rw('state', running ? '修复中' : (open ? '未修复' : '已修复'));
  rw('gate', open ? '需先修复' : '可正常穿越');
  rw('eicon', foe.icon);
  rw('ename', foe.name);
  rw('elvl', '第 ' + showTier + ' 层');
  rw('ehp', '生命 ' + Math.max(0, Math.ceil(foe.hp)) + ' / ' + foe.maxHp);
  rw('estats', '攻击 ' + foe.atkMin + '~' + foe.atkMax + ' · 命中 ' + Math.round(foe.hit) +
    ' · 闪避 ' + Math.round(foe.ev) + ' · 减伤 ' + Math.round(foe.dr * 100) + '%' +
    ' · 出手 ' + foe.interval.toFixed(1) + 's · 我方命中 ' + Math.round(hitChance(st.hit, foe.ev) * 100) + '%');

  const fill = root.querySelector('[data-rift="ehpfill"]');
  if (fill) fill.style.width = (live ? Math.max(0, Math.min(1, foe.hp / foe.maxHp)) * 100 : 100).toFixed(1) + '%';

  const startBtn = root.querySelector('[data-rift="startbtn"]');
  if (startBtn) {
    const label = running ? '停止修复' : (open ? '进入裂缝修复' : '裂缝已修复');
    if (startBtn.textContent !== label) startBtn.textContent = label;
    startBtn.disabled = !running && !open;
  }

  rw('note', running
    ? '修复中：击败裂缝即可完成修复；切换到伐木 / 星球 / 锁妖塔等其它动作会中断战斗。'
    : (open
      ? '裂缝未修复，穿越按钮已锁定；阵亡不惩罚，疗伤后可回血再来。'
      : '该裂缝已修复，可返回星球继续穿越；穿越成功后会立刻生成第 ' + nextTier + ' 层裂缝。'));

  const rwr = riftReward(showTier);
  rw('rewtitle', (open ? '第 ' + showTier + ' 层修复奖励预览' : '下一道裂缝（第 ' + showTier + ' 层）奖励预览'));
  rw('rewtag', open ? '未修复' : '已修复 · 下次穿越生成');
  const key = showTier + '|' + rwr.gold + '|' + rwr.star + '|' + rwr.xp;
  if (force || key !== _riftRewardKey) {
    const box = root.querySelector('[data-rift="reward"]');
    if (box) box.innerHTML = riftRewardHTML(rwr);
    _riftRewardKey = key;
  }
}

/* =========================================================== 五行属性裂缝 */
/* 倒计时格式化：HH:MM:SS（超过 24 小时按小时累计，不截断） */
function fmtCd(ms) {
  const s = Math.max(0, Math.ceil(ms / 1000));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  function p2(n) { return (n < 10 ? '0' : '') + n; }
  return p2(h) + ':' + p2(m) + ':' + p2(sec);
}

function elemRiftLeft() {
  const e = state.elemRifts;
  if (!e || !Array.isArray(e.slots)) return 0;
  let n = 0;
  e.slots.forEach(function (s) { if (s && !s.fixed) n += 1; });
  return n;
}

/* 星球主视图的三张属性裂缝卡片：修复后该位置留空，不重建整棵 #content */
function elemRiftCardsHTML() {
  const e = state.elemRifts || { next: 0, slots: [] };
  const slots = Array.isArray(e.slots) ? e.slots : [];
  let cards = '';
  for (let i = 0; i < ELEM_RIFT.SLOTS; i++) {
    const s = slots[i];
    if (!s) {
      cards += '<div class="elemcard empty"><span class="elico">·</span>' +
        '<span class="elmain"><b>空位</b><span class="elsub">等待下一轮刷新</span></span></div>';
      continue;
    }
    const el = findElemRift(s.elem) || ELEM_RIFT.ELEMENTS[0];
    const lv = state.skills[el.skill] ? state.skills[el.skill].lvl : 1;
    if (s.fixed) {
      cards += '<div class="elemcard fixed" style="--ec:' + el.color + '">' +
        '<span class="elico">✅</span>' +
        '<span class="elmain"><b>' + el.name + '·时空裂缝</b>' +
        '<span class="elsub">已修复 · 位置留空至下次刷新</span></span></div>';
    } else {
      cards += '<div class="elemcard open" style="--ec:' + el.color + '" data-act="elemopen" data-idx="' + i +
        '" title="点击查看并进入修复">' +
        '<span class="elico">' + el.icon + '</span>' +
        '<span class="elmain"><b>' + el.name + '·时空裂缝</b>' +
        '<span class="elsub">强度 ' + s.tier + ' · ' + SKILLS[el.skill].name + ' Lv.' + lv + '</span></span>' +
        '<span class="elgo">进入 ›</span></div>';
    }
  }
  return '<div class="elemsec">' +
    '<div class="elemhead"><span class="secttl">五行属性裂缝</span>' +
    '<span class="pbchip">下次刷新 <b data-eg="cd">--:--:--</b></span>' +
    '<span class="pbchip">未修复 <b data-eg="left">0</b>/' + ELEM_RIFT.SLOTS + '</span></div>' +
    '<div class="elemgrid">' + cards + '</div>' +
    '<div class="shopnote">3 道裂缝同时存在、属性随机（允许重复），每 3 小时按真实时间整轮覆盖刷新；' +
    '离线超过 3 小时回来只刷新一轮，不补刷。修复后该位置留空到下次刷新。' +
    '奖励为对应工作的当前档材料，五行裂缝不影响穿越。</div>' +
    '</div>';
}

/* 属性裂缝详情视图（仍属于穿越星球面板）：静态骨架 + data-eg 增量刷新 */
function renderElemRift() {
  return '<div class="elemwrap">' +
    '<div class="phead"><h2>🪐 五行属性裂缝</h2>' +
    '<span class="pdesc">独立于异界裂缝的材料副本：击败裂缝即可修复并获得对应工作的当前档材料，' +
    '不影响穿越门槛。每 3 小时整轮刷新，修复位置留空到下一轮。战斗占用全局动作槽，阵亡不消耗裂缝。</span></div>' +
    '<div class="planetdyn">' +
    '<span class="pbchip">属性 <b data-eg="ename">—</b></span>' +
    '<span class="pbchip">强度 <b data-eg="tier">0</b></span>' +
    '<span class="pbchip">状态 <b data-eg="state">未修复</b></span>' +
    '<span class="pbchip">下次刷新 <b data-eg="cd">--:--:--</b></span>' +
    '<button class="pbtn" data-act="elemback">返回星球</button>' +
    '</div>' +
    '<div class="towerstage elemstage" data-eg="stage">' +
    '<div class="towerfoe">' +
    '<span class="teicon" data-eg="eicon">—</span>' +
    '<div class="tebody">' +
    '<div class="tename"><b data-eg="foename">—</b><span data-eg="elvl">强度 0</span></div>' +
    '<div class="towerhp"><i data-eg="ehpfill"></i></div>' +
    '<div class="tenum" data-eg="ehp">—</div>' +
    '<div class="testats" data-eg="estats">—</div>' +
    '</div></div>' +
    '<div class="toweract">' +
    '<button class="pbtn" data-act="elemstart" data-eg="startbtn">进入裂缝修复</button>' +
    '<button class="pbtn cross" data-act="elemback">返回星球</button>' +
    '<span class="pbstate" data-eg="note"></span>' +
    '</div></div>' +
    '<div class="towerrewhead"><span class="secttl" data-eg="rewtitle">修复奖励预览</span>' +
    '<span class="pbchip" data-eg="rewtag"></span></div>' +
    '<div class="towerreward" data-eg="reward"></div>' +
    '<div class="secttl">规则</div>' +
    '<div class="shopnote">始终存在 3 道裂缝，属性随机（允许重复）；每 3 小时按真实时间整轮覆盖刷新（离线不补刷，回来只刷一轮）。' +
    '修复后该位置留空直到下次刷新，已修复状态会存档。阵亡只退出战斗：裂缝不消耗、不降级，回血后可原地重试。' +
    '读档不恢复进行中的战斗。五行裂缝不影响穿越按钮与异界裂缝状态。</div>' +
    '<div class="secttl">成长公式</div>' +
    '<div class="shopnote">强度 t = round(穿越次数×' + ELEM_RIFT.CROSS_W + ' + (对应工作等级−1)×' + ELEM_RIFT.LVL_W + ')，生成时快照；' +
    '生命 = 30×(1+0.26t+0.007×t<sup>1.6</sup>)，攻击 = 2~4×(1+0.14t+0.003×t<sup>1.45</sup>)，' +
    '命中 = 7+0.9t，闪避 = 4+0.55t，减伤 = min(30%, 1%+0.1%t)，出手间隔 = max(2.0s, 3.0-0.0012t)。' +
    '单次伤害不超过自身生命上限 ' + Math.round(ELEM_RIFT.HIT_CAP * 100) + '%，后期也不会被一刀秒。</div>' +
    '</div>';
}

let _elemRewardKey = '';

function elemRewardHTML(rw) {
  return '<div class="trewline">' + elemRewardText(rw) + '</div>' +
    '<div class="trewtip">修复后立刻发放；该位置留空至下一轮刷新（不占穿越门槛）。</div>';
}

/* force=true：视图刚重建，需要重新填充奖励容器 */
function updateElemRift(force) {
  if (state.ui.active !== 'planet' || state.ui.planetView !== 'elem') return;
  const root = document.querySelector('.elemwrap');
  if (!root) { _elemRewardKey = ''; return; }

  const e = state.elemRifts || { next: 0, slots: [] };
  const idx = Math.max(0, Math.min(ELEM_RIFT.SLOTS - 1, Number(state.ui.elemSlot) || 0));
  const slot = e.slots ? e.slots[idx] : null;
  const running = elemRiftRunning();
  const c = state.skills.combat;
  const live = (running && c.elem === idx && c.target) ? c.target : null;

  const el = findElemRift(live ? live.elem : (slot ? slot.elem : 'metal')) || ELEM_RIFT.ELEMENTS[0];
  const lv = elemSkillLvl(el.id);
  const tier = slot ? slot.tier : 0;
  const fixed = !!(slot && slot.fixed);
  const foe = live || elemEnemy(slot || { elem: el.id, tier: 0 });
  const st = calcStats();

  function ew(key, txt) {
    const node = root.querySelector('[data-eg="' + key + '"]');
    if (node && node.textContent !== txt) node.textContent = txt;
  }

  const stage = root.querySelector('[data-eg="stage"]');
  if (stage && stage.dataset.ec !== el.color) {
    stage.style.setProperty('--ec', el.color);
    stage.dataset.ec = el.color;
  }

  ew('ename', el.name + '·' + el.reward);
  ew('tier', String(tier));
  ew('state', running ? '修复中' : (fixed ? '已修复' : '未修复'));
  ew('eicon', el.icon);
  ew('foename', el.name + '·时空裂缝');
  ew('elvl', '强度 ' + tier);
  ew('ehp', '生命 ' + Math.max(0, Math.ceil(foe.hp)) + ' / ' + foe.maxHp);
  ew('estats', '攻击 ' + foe.atkMin + '~' + foe.atkMax + ' · 命中 ' + Math.round(foe.hit) +
    ' · 闪避 ' + Math.round(foe.ev) + ' · 减伤 ' + Math.round(foe.dr * 100) + '%' +
    ' · 出手 ' + foe.interval.toFixed(1) + 's · 我方命中 ' + Math.round(hitChance(st.hit, foe.ev) * 100) + '%');

  const fill = root.querySelector('[data-eg="ehpfill"]');
  if (fill) fill.style.width = (live ? Math.max(0, Math.min(1, foe.hp / foe.maxHp)) * 100 : 100).toFixed(1) + '%';

  const startBtn = root.querySelector('[data-eg="startbtn"]');
  if (startBtn) {
    const label = running ? '停止修复' : (fixed ? '裂缝已修复' : '进入裂缝修复');
    if (startBtn.textContent !== label) startBtn.textContent = label;
    startBtn.disabled = !running && (fixed || !slot);
  }

  ew('note', running
    ? '修复中：击败裂缝即可完成修复；切换到伐木 / 星球 / 锁妖塔等其它动作会中断战斗。'
    : (fixed
      ? '该裂缝已修复，位置留空至下一轮刷新；返回星球可继续其它玩法。'
      : (slot
        ? '未修复：进入战斗后会中断星球运转等动作；阵亡不消耗裂缝，疗伤后可原地重试。'
        : '该位置已刷新，请返回星球查看新一轮裂缝。')));

  const rw = elemRiftReward(el.id, lv);
  ew('rewtitle', el.name + '·时空裂缝 修复奖励（' + SKILLS[el.skill].name + ' Lv.' + lv + ' 档）');
  ew('rewtag', fixed ? '已修复' : (running ? '修复中' : '未修复'));
  const key = el.id + '|' + rw.id + '|' + rw.qty + '|' + rw.star + '|' + fixed;
  if (force || key !== _elemRewardKey) {
    const box = root.querySelector('[data-eg="reward"]');
    if (box) box.innerHTML = elemRewardHTML(rw);
    _elemRewardKey = key;
  }
}

/* 倒计时 / 未修复数量：每 tick 走 textContent，不触发 #content 重建 */
function updateElemRiftMini() {
  const e = state.elemRifts;
  const txt = (e && isFinite(e.next)) ? fmtCd(e.next - Date.now()) : '--:--:--';
  const cds = document.querySelectorAll('[data-eg="cd"]');
  for (let i = 0; i < cds.length; i++) {
    if (cds[i].textContent !== txt) cds[i].textContent = txt;
  }
  const lefts = document.querySelectorAll('[data-eg="left"]');
  if (lefts.length) {
    const n = String(elemRiftLeft());
    for (let i = 0; i < lefts.length; i++) {
      if (lefts[i].textContent !== n) lefts[i].textContent = n;
    }
  }
}

/* ================================================================== 裂缝怪物 */
/* 星球主视图入口卡：存在时提示运转锁定；已击败显示下次刷新倒计时 */
function riftMonCardHTML() {
  const m = state.riftMon || { alive: false, tier: 0, next: Date.now() };
  const tier = riftMonTierClamp(m.tier);
  if (m.alive) {
    return '<div class="rmcard open" data-act="rmopen" title="点击查看并挑战裂缝怪物">' +
      '<span class="rmico">' + RIFT_MON.ICON + '</span>' +
      '<span class="rmmain"><b>裂缝怪物 · 强度 ' + tier + '</b>' +
      '<span class="rmsub">未击败 · 星球运转已锁定，点击挑战（穿越不受影响）</span></span>' +
      '<span class="rmgo">挑战 ›</span></div>';
  }
  return '<div class="rmcard fixed" data-act="rmopen" title="已击败，等待下一轮刷新">' +
    '<span class="rmico">✅</span>' +
    '<span class="rmmain"><b>裂缝怪物 · 已击败</b>' +
    '<span class="rmsub">下次刷新 <span data-rm="cd">--:--:--</span> · 期间可正常运转</span></span>' +
    '<span class="rmgo">查看 ›</span></div>';
}

/* 裂缝怪物详情视图（仍属于穿越星球面板）：静态骨架 + data-rm 增量刷新 */
function renderRiftMon() {
  return '<div class="rmwrap">' +
    '<div class="phead"><h2>' + RIFT_MON.ICON + ' 裂缝怪物</h2>' +
    '<span class="pdesc">独立于异界裂缝与五行属性裂缝的常驻怪物：同时只存在 1 只，每 24 小时按真实时间刷新。' +
    '未击败时无法开启星球运转（穿越不受影响）；击败后发放灵石 + 星砂，当天不再出现，等下一轮刷新。' +
    '战斗占用全局动作槽，阵亡不消耗怪物、不降强度。</span></div>' +
    '<div class="planetdyn">' +
    '<span class="pbchip">强度 <b data-rm="tier">0</b></span>' +
    '<span class="pbchip">状态 <b data-rm="state">存在</b></span>' +
    '<span class="pbchip">下次刷新 <b data-rm="cd">--:--:--</b></span>' +
    '<button class="pbtn" data-act="rmback">返回星球</button>' +
    '</div>' +
    '<div class="towerstage rmstage" data-rm="stage">' +
    '<div class="towerfoe">' +
    '<span class="teicon" data-rm="eicon">' + RIFT_MON.ICON + '</span>' +
    '<div class="tebody">' +
    '<div class="tename"><b data-rm="foename">' + RIFT_MON.NAME + '</b><span data-rm="elvl">强度 0</span></div>' +
    '<div class="towerhp"><i data-rm="ehpfill"></i></div>' +
    '<div class="tenum" data-rm="ehp">—</div>' +
    '<div class="testats" data-rm="estats">—</div>' +
    '</div></div>' +
    '<div class="toweract">' +
    '<button class="pbtn" data-act="rmstart" data-rm="startbtn">挑战裂缝怪物</button>' +
    '<button class="pbtn cross" data-act="rmback">返回星球</button>' +
    '<span class="pbstate" data-rm="note"></span>' +
    '</div></div>' +
    '<div class="towerrewhead"><span class="secttl" data-rm="rewtitle">击败奖励预览</span>' +
    '<span class="pbchip" data-rm="rewtag"></span></div>' +
    '<div class="towerreward" data-rm="reward"></div>' +
    '<div class="secttl">规则</div>' +
    '<div class="shopnote">同时只存在 1 只裂缝怪物；每 24 小时按真实时间（Date.now）刷新，击败后不立刻重生，' +
    '要等原定刷新时间到来（离线超过 24 小时回来只换一轮，不补刷）。' +
    '怪物存在时「开启运转」置灰并提示「需先击败裂缝怪物」，但不影响穿越按钮与异界裂缝状态。' +
    '战斗占用单一动作槽：与星球运转、锁妖塔、异界裂缝、五行属性裂缝、普通战斗互斥；切换动作会中断挑战并清空战况。' +
    '阵亡只退出战斗：怪物不消耗、强度不降，回血后可原地重试。已击败状态会存档，重开后仍是已击败直到下轮刷新。' +
    '读档不恢复进行中的战斗。</div>' +
    '<div class="secttl">成长公式</div>' +
    '<div class="shopnote">强度 t = 生成时的穿越次数（快照）；生命 = ' + RIFT_MON.HP_BASE +
    '×(1+' + RIFT_MON.HP_LIN + 't+' + RIFT_MON.HP_POW + '×t<sup>' + RIFT_MON.HP_EXP + '</sup>)，攻击 = ' +
    RIFT_MON.ATK_MIN + '~' + RIFT_MON.ATK_MAX + '×(1+' + RIFT_MON.ATK_LIN + 't+' + RIFT_MON.ATK_POW +
    '×t<sup>' + RIFT_MON.ATK_EXP + '</sup>)，命中 = ' + RIFT_MON.HIT_BASE + '+' + RIFT_MON.HIT_LIN +
    't，闪避 = ' + RIFT_MON.EV_BASE + '+' + RIFT_MON.EV_LIN + 't，减伤 = min(' +
    Math.round(RIFT_MON.DR_CAP * 100) + '%, ' + (RIFT_MON.DR_BASE * 100).toFixed(1) + '%+' +
    (RIFT_MON.DR_LIN * 100).toFixed(2) + '%t)，出手间隔 = max(' + RIFT_MON.INTERVAL_MIN.toFixed(1) +
    's, ' + RIFT_MON.INTERVAL_BASE.toFixed(1) + '-' + RIFT_MON.INTERVAL_DECAY + 't)。' +
    '同 t 下各项均不高于异界裂缝；单次伤害不超过自身生命上限 ' + Math.round(RIFT_MON.HIT_CAP * 100) +
    '%，不会被一刀秒。</div>' +
    '</div>';
}

let _rmRewardKey = '';

function riftMonRewardHTML(rw) {
  return '<div class="trewline">灵石 +' + rw.gold + ' · 星砂 +' + rw.star + '</div>' +
    '<div class="trewtip">击败后立刻发放；当天不再出现，等下一轮刷新（24 小时）。</div>';
}

function updateRiftMon(force) {
  if (state.ui.active !== 'planet' || state.ui.planetView !== 'riftmon') return;
  const root = document.querySelector('.rmwrap');
  if (!root) { _rmRewardKey = ''; return; }

  const m = state.riftMon || { alive: false, tier: 0, next: Date.now() };
  const running = riftMonRunning();
  const c = state.skills.combat;
  const live = (running && c.riftMon >= 0 && c.target) ? c.target : null;
  const tier = running ? c.riftMon : riftMonTierClamp(m.tier);
  const foe = live || riftMonEnemy(tier);
  const st = calcStats();

  function rw(key, txt) {
    const node = root.querySelector('[data-rm="' + key + '"]');
    if (node && node.textContent !== txt) node.textContent = txt;
  }

  rw('tier', String(tier));
  rw('state', running ? '挑战中' : (m.alive ? '存在 · 运转锁定' : '已击败'));
  rw('eicon', RIFT_MON.ICON);
  rw('foename', RIFT_MON.NAME);
  rw('elvl', '强度 ' + tier);
  rw('ehp', '生命 ' + Math.max(0, Math.ceil(foe.hp)) + ' / ' + foe.maxHp);
  rw('estats', '攻击 ' + foe.atkMin + '~' + foe.atkMax + ' · 命中 ' + Math.round(foe.hit) +
    ' · 闪避 ' + Math.round(foe.ev) + ' · 减伤 ' + Math.round(foe.dr * 100) + '%' +
    ' · 出手 ' + foe.interval.toFixed(1) + 's · 我方命中 ' + Math.round(hitChance(st.hit, foe.ev) * 100) + '%');

  const fill = root.querySelector('[data-rm="ehpfill"]');
  if (fill) fill.style.width = (live ? Math.max(0, Math.min(1, foe.hp / foe.maxHp)) * 100 : 100).toFixed(1) + '%';

  const startBtn = root.querySelector('[data-rm="startbtn"]');
  if (startBtn) {
    const label = running ? '停止战斗' : (m.alive ? '挑战裂缝怪物' : '已击败');
    if (startBtn.textContent !== label) startBtn.textContent = label;
    startBtn.disabled = !running && !m.alive;
  }

  rw('note', running
    ? '挑战中：击败后解除运转锁定并发放奖励；切换到其它动作会中断战斗并清空战况。'
    : (m.alive
      ? '未击败：可开启战斗，或先去做其它事；星球运转按钮会保持锁定。阵亡不消耗怪物，可回血重试。'
      : '已击败：下一只将在倒计时结束后刷新；期间可正常开启星球运转。'));

  const reward = riftMonReward(tier);
  rw('rewtitle', RIFT_MON.NAME + ' · 强度 ' + tier + ' 击败奖励');
  rw('rewtag', m.alive ? (running ? '挑战中' : '存在') : '已击败');
  const key = tier + '|' + reward.gold + '|' + reward.star + '|' + m.alive;
  if (force || key !== _rmRewardKey) {
    const box = root.querySelector('[data-rm="reward"]');
    if (box) box.innerHTML = riftMonRewardHTML(reward);
    _rmRewardKey = key;
  }
}

/* 倒计时：每 tick 走 textContent，不触发 #content 重建。
   到期但玩家正在星球运转 → 刷新被延后，这里显示等待原因 */
function updateRiftMonMini() {
  const m = state.riftMon;
  let txt = '--:--:--';
  if (m && isFinite(m.next)) {
    if (!m.alive && m.next <= Date.now() && planetRunning()) txt = '等待运转结束';
    else txt = fmtCd(m.next - Date.now());
  }
  const nodes = document.querySelectorAll('[data-rm="cd"]');
  for (let i = 0; i < nodes.length; i++) {
    if (nodes[i].textContent !== txt) nodes[i].textContent = txt;
  }
}

/* 星球视图缓存：几何尺寸、节点引用、文本刷新节流 */
let _planetGeo = null;
let _planetBox = null;
let _planetTextAt = 0;
const _planetNodes = {};
const _planetProg = {};
let _planetGravTxt = '';
let _planetGravBtn = '';

/* 窗口缩放 / 面板重绘后调用：下一帧重新测量舞台尺寸，避免位置漂移 */
function resetPlanetGeo() {
  _planetGeo = null;
}

/* rAF 高频刷新：每帧只写 transform + opacity，不碰 left/top，不重建 DOM。
   force=true 时跳过 10Hz 文本节流（穿越等关键操作后立即刷新百分比/按钮）。 */
function updatePlanet(force) {
  if (state.ui.active !== 'planet') return;
  const stage = document.getElementById('planetStage');
  const box = document.getElementById('planetItems');
  if (!stage || !box) { _planetGeo = null; _planetBox = null; return; }

  if (_planetBox !== box) {
    _planetBox = box;
    _planetGeo = null;
    _planetTextAt = 0;
    _planetGravTxt = '';
    _planetGravBtn = '';
    Object.keys(_planetNodes).forEach(function (k) { delete _planetNodes[k]; });
    Object.keys(_planetProg).forEach(function (k) { delete _planetProg[k]; });
  }
  if (!_planetGeo) {
    const w = stage.clientWidth, h = stage.clientHeight;
    if (w && h) _planetGeo = { w: w, h: h };
  }

  const p = state.planet;
  const list = p.items;
  const now = performance.now();
  const running = planetRunning();
  const speed = running && p.boost > 0 ? PLANET.BOOST_MULT : 1;

  /* 先按 pid 清理已入账 / 已消失的节点，保证与 state.items 一致 */
  const alive = {};
  for (let i = 0; i < list.length; i++) alive[String(list[i].pid)] = true;
  Object.keys(_planetNodes).forEach(function (pid) {
    if (alive[pid]) return;
    const node = _planetNodes[pid];
    if (node && node.parentNode) node.parentNode.removeChild(node);
    delete _planetNodes[pid];
    delete _planetProg[pid];
  });

  /* 再按 pid 补齐新节点，并对已有节点做逐帧位移 */
  for (let i = 0; i < list.length; i++) {
    const it = list[i];
    const pid = String(it.pid);
    let node = _planetNodes[pid];
    if (!node) {
      node = planetNode(it);
      _planetNodes[pid] = node;
      _planetProg[pid] = { prog: it.prog, at: now };
      box.appendChild(node);
    }
    const rec = _planetProg[pid];
    if (rec.prog !== it.prog) { rec.prog = it.prog; rec.at = now; }

    /* 引擎按 100ms 推进 it.prog，视图补上这一小段插值，让位移达到 60fps */
    const lag = Math.min(0.1, (now - rec.at) / 1000);
    let prog = rec.prog + lag * speed / PLANET.FLIGHT_TIME;
    if (prog > 1) prog = 1;

    if (_planetGeo) {
      const k = 1 - prog;
      node.style.transform = 'translate3d(' +
        (Math.cos(it.ang) * it.rad * k * _planetGeo.w).toFixed(1) + 'px,' +
        (Math.sin(it.ang) * it.rad * k * _planetGeo.h).toFixed(1) + 'px,0) translate(-50%,-50%) scale(' +
        (0.55 + prog * 0.75).toFixed(2) + ')';
    }
    const op = (0.45 + prog * 0.55).toFixed(2);
    if (node.style.opacity !== op) node.style.opacity = op;
  }

  /* 文本类数据 10Hz 刷新即可，避免每帧触发额外的排版 */
  if (!force && now - _planetTextAt < 100) return;
  _planetTextAt = now;

  const wrap = stage.closest('.planetwrap');
  if (wrap) {
    const boosting = running && p.boost > 0;
    if (boosting && !wrap.classList.contains('boosting')) wrap.classList.add('boosting');
    else if (!boosting && wrap.classList.contains('boosting')) wrap.classList.remove('boosting');
  }

  const gtLv = state.world.buildings.gravitytower || 0;

  /* 运转状态 / 开启·停止按钮 / 每件灵力 / 当前灵力：全部增量写入 */
  const stateEl = document.querySelector('[data-pg="runstate"]');
  if (stateEl) {
    const stxt = running
      ? (p.waitReason === 'spirit' ? '灵力不足，等待中'
        : p.waitReason === 'aura' ? '浓度不足 · 停止运转可恢复'
          : '运转中')
      : (riftMonAlive() ? '需先击败裂缝怪物' : '未开启');
    if (stateEl.textContent !== stxt) stateEl.textContent = stxt;
    stateEl.classList.toggle('on', running && !state.actionWaiting);
    stateEl.classList.toggle('wait', running && state.actionWaiting);
  }
  const runBtn = document.querySelector('[data-planetrun]');
  if (runBtn) {
    const btxt = running ? '停止运转' : '开启运转';
    if (runBtn.textContent !== btxt) runBtn.textContent = btxt;
    runBtn.classList.toggle('stop', running);
    /* 裂缝怪物未击败 → 运转按钮置灰并给出明确提示（穿越不受影响） */
    const blocked = !running && riftMonAlive();
    if (runBtn.disabled !== blocked) runBtn.disabled = blocked;
    runBtn.classList.toggle('off', blocked);
    runBtn.title = blocked ? '需先击败裂缝怪物' : '';
  }
  if (stateEl) {
    stateEl.classList.toggle('wait', !running && riftMonAlive());
  }
  const costEl = document.querySelector('[data-pg="cost"]');
  if (costEl && costEl.textContent !== String(PLANET.SPIRIT_COST)) costEl.textContent = String(PLANET.SPIRIT_COST);
  const spiritEl = document.querySelector('[data-pg="spirit"]');
  if (spiritEl) {
    const stxt = state.spirit >= 100 ? fmtNum(state.spirit) : state.spirit.toFixed(1);
    if (spiritEl.textContent !== stxt) spiritEl.textContent = stxt;
  }

  /* 灵气浓度：百分比 + (当前/上限) + 当前单件消耗 + 恢复速率，全部走 data-* 增量刷新。
     百分比与括号里的数值都基于同一个整数 current / cap，保证换算一致。 */
  const cross = planetCrossCount();
  const auraCost = planetAuraCost(cross);
  const auraCostTxt = String(Math.round(auraCost * 1000) / 1000);
  const auraCostEl = document.querySelector('[data-pg="auracost"]');
  if (auraCostEl && auraCostEl.textContent !== auraCostTxt) auraCostEl.textContent = auraCostTxt;
  const auraCap = planetAuraCap();
  const aura = Math.max(0, Math.min(auraCap, isFinite(p.aura) ? Number(p.aura) : planetAuraStart()));
  const auraInt = Math.floor(aura);
  const auraPct = auraCap > 0 ? Math.min(100, Math.max(0, auraInt / auraCap * 100)) : 0;
  const auraEl = document.querySelector('[data-pg="aura"]');
  if (auraEl) {
    const atxt = auraPct.toFixed(1) + '% (' + fmtAuraNum(auraInt) + '/' + fmtAuraNum(auraCap) + ')';
    if (auraEl.textContent !== atxt) auraEl.textContent = atxt;
    auraEl.classList.toggle('low', aura < auraCost + PLANET.AURA_MIN);
  }
  const auraHintEl = document.querySelector('[data-pg="aurahint"]');
  if (auraHintEl) {
    const htxt = '单件 −' + auraCostTxt + ' · 恢复 +' + fmtRate(planetAuraRegen()) + '/s（停止运转）';
    if (auraHintEl.textContent !== htxt) auraHintEl.textContent = htxt;
  }

  /* 朝代 / 穿越次数 / 穿越所需浓度与差额：只改文本与按钮可用性，不重建面板。
     穿越的唯一门槛是灵气浓度（不再看灵力），判定与扣除都至少保留 AURA_MIN。 */
  const dynEl = document.querySelector('[data-pg="dynasty"]');
  const dynTxt = planetDynastyName(cross);
  if (dynEl && dynEl.textContent !== dynTxt) dynEl.textContent = dynTxt;
  const crossEl = document.querySelector('[data-pg="cross"]');
  if (crossEl && crossEl.textContent !== String(cross)) crossEl.textContent = String(cross);
  const nextN = cross + 1;
  const crossCost = planetCrossCost(nextN);
  const crossNeed = crossCost + PLANET.AURA_MIN;
  const riftOpen = !!(state.rift && state.rift.open);
  const canCross = aura >= crossNeed && !riftOpen;
  const crossBtn = document.querySelector('[data-planetcross]');
  if (crossBtn) {
    const poor = !canCross;
    if (crossBtn.disabled !== poor) crossBtn.disabled = poor;
    crossBtn.classList.toggle('off', poor);
    crossBtn.title = riftOpen ? '需先修复异界裂缝' : (poor ? '灵气浓度不足' : ('穿越至「' + planetDynastyName(nextN) + '」'));
  }
  const crossNoteEl = document.querySelector('[data-pg="crossnote"]');
  if (crossNoteEl) {
    const diff = Math.max(0, crossNeed - aura);
    const ntxt = riftOpen
      ? '需先修复异界裂缝（第 ' + state.rift.tier + ' 层）'
      : (diff > 0
        ? '需 💧 ' + fmtAuraNum(crossCost) + ' · 还差 ' + fmtAuraNum(Math.ceil(diff)) +
          (running ? '（停止运转后才能恢复）' : '')
        : '消耗 💧 ' + fmtAuraNum(crossCost) + ' → ' + planetDynastyName(nextN));
    if (crossNoteEl.textContent !== ntxt) crossNoteEl.textContent = ntxt;
    crossNoteEl.classList.toggle('wait', diff > 0 || riftOpen);
  }

  const boost = document.querySelector('[data-planetboost]');
  if (boost) {
    const txt = !running ? '开启后可加速'
      : p.boost > 0
        ? '加速 ×' + PLANET.BOOST_MULT + ' · 剩余 ' + p.boost.toFixed(1) + 's'
        : '点击加速（+' + PLANET.BOOST_ADD + 's）';
    if (boost.textContent !== txt) boost.textContent = txt;
  }

  /* 加速上限：基础 60 秒 + 引力塔每级 5 秒，走 data-* 增量写入 */
  const cap = planetBoostCap();
  const capEl = document.querySelector('[data-pg="boostcap"]');
  if (capEl && capEl.textContent !== String(cap)) capEl.textContent = String(cap);
  const gtEl = document.querySelector('[data-pg="boostgt"]');
  const gtTxt = gtLv > 0 ? '（引力塔 +' + (gtLv * PLANET.BOOST_GT_BONUS) + 's）' : '';
  if (gtEl && gtEl.textContent !== gtTxt) gtEl.textContent = gtTxt;

  /* 本局收获计数 */
  const s = p.session;
  const map = { gold: fmtNum(s.gold), star: fmtNum(s.star), mat: fmtNum(s.mat), count: String(s.count) };
  Object.keys(map).forEach(function (k) {
    const el = document.querySelector('[data-pg="' + k + '"]');
    if (el && el.textContent !== map[k]) el.textContent = map[k];
  });

  /* 引力塔引导：等级变化时才写 innerHTML / 按钮文案 */
  const grav = worldBonus('planet');
  const gtxt = gtLv > 0
    ? '引力塔 Lv.' + gtLv + ' · 生成速度 <b>' + pctText(grav) + '</b> · 加速上限 +' +
      (gtLv * PLANET.BOOST_GT_BONUS) + ' 秒 · 浓度上限 +' + (gtLv * PLANET.AURA_CAP_GT) +
      ' / 恢复 +' + fmtRate((PLANET.AURA_REGEN_GT * gtLv) * planetAuraScale()) + '/s' +
      '（每级 +1% / +' + PLANET.BOOST_GT_BONUS + ' 秒 / +' + PLANET.AURA_CAP_GT + ' / +' +
      PLANET.AURA_REGEN_GT + '/s）'
    : '可在洞天「🌀 秘境」营造「引力塔」：每级生成速度 +1%、点击加速上限 +' +
      PLANET.BOOST_GT_BONUS + ' 秒、浓度上限 +' + PLANET.AURA_CAP_GT + '、停止恢复 +' +
      PLANET.AURA_REGEN_GT + '/s（再乘穿越系数）';
  if (gtxt !== _planetGravTxt) {
    const el = document.querySelector('[data-pg="grav"]');
    if (el) el.innerHTML = gtxt;
    _planetGravTxt = gtxt;
  }
  const gbtn = gtLv > 0 ? '升级' : '建造';
  if (gbtn !== _planetGravBtn) {
    const btn = document.querySelector('[data-planetgravbtn]');
    if (btn) {
      btn.textContent = gtLv > 0 ? '前往升级' : '前往建造';
      btn.className = 'mini' + (gtLv > 0 ? '' : ' gold');
    }
    _planetGravBtn = gbtn;
  }
}

/* 市集面板：分类标签 + 商品网格 + 购买按钮（梅尔沃式多店铺） */
function renderShop() {
  const cur = findShop(state.ui.shopCat);
  let html = '<div class="phead"><h2>🏪 市集</h2>' +
    '<span class="pdesc">以灵石采买物资，亦可在背包中出售物品</span></div>';

  html += '<div class="shopcats">';
  SHOPS.forEach(function (s) {
    const on = s.id === cur.id ? ' on' : '';
    html += '<button class="chip' + on + '" data-act="shopcat" data-id="' + s.id + '">' + s.icon + ' ' + s.name + '</button>';
  });
  html += '</div>';

  html += '<div class="secttl">' + cur.icon + ' ' + cur.name + ' · 持有 💠 ' + fmtNum(state.gold) + ' 灵石</div>';
  html += '<div class="shopgrid">';
  cur.items.forEach(function (si) {
    const it = ITEMS[si.id];
    if (!it) return;
    const price = shopPrice(si);
    const canBuy = state.gold >= price;
    const full = !invCanAdd(si.id, 1);
    const disabled = (!canBuy || full) ? ' disabled' : '';
    const note = full ? '<span class="etag warn">背包已满</span>' : (canBuy ? '' : '<span class="etag warn">灵石不足</span>');
    html +=
      '<div class="shopitem">' +
      '<span class="sico">' + it.icon + '</span>' +
      '<span class="smain"><span class="sname">' + it.name + note + '</span>' +
      '<span class="smeta">' + esc(it.desc) + '</span>' +
      '<span class="sprice">💠 ' + price + ' / 个</span></span>' +
      '<span class="sbuys">' +
      '<button class="mini" data-act="buy" data-id="' + si.id + '" data-price="' + price + '" data-qty="1"' + disabled + '>+1</button>' +
      '<button class="mini" data-act="buy" data-id="' + si.id + '" data-price="' + price + '" data-qty="10"' + disabled + '>+10</button>' +
      '<button class="mini" data-act="buymax" data-id="' + si.id + '" data-price="' + price + '"' + disabled + '>最大</button>' +
      '</span></div>';
  });
  html += '</div>';

  html += '<div class="secttl">出售说明</div>';
  html += '<div class="shopnote">在背包页先用「出售数量」（×1 / ×5 / ×10 / ×25 / ×100 / 全部）指定批量，开启「出售模式」后点击物品即按该数量出售；或点击物品查看详情后直接出售。出售价为物品价值的 ' + Math.round(CONFIG.SELL_RATIO * 100) + '%。</div>';
  return html;
}

/* 阵法面板：观星台 + 星砂 + 阵纹点亮（玩法参考《梅尔沃放置》的观星） */
function renderFormation() {
  const s = state.skills.formation;

  let html = '<div class="sdbar"><span class="sdico">💫</span>' +
    '<span class="sdname">星砂</span><b class="sdval" data-sd></b>' +
    '<span class="sdnote">观星推演所得 · 用于点亮阵纹 · 不占背包</span></div>';

  html += '<div class="secttl">观星台 · 推演天机</div>' + gatherEntries(ACTIONS.formation || [], 'formation');

  html += '<div class="secttl">布阵 · 观星对应阵法</div>';
  html += '<div class="shopnote">每座阵法对应一门观星：观星解锁即可布阵，阵纹每升 1 级需该观星精通 Lv.' +
    (FORMATIONS[0] ? FORMATIONS[0].mper : 4) + '×目标等级（最高 10 级 → 精通 Lv.40）。</div>';
  html += '<div class="formgrid">';
  FORMATIONS.forEach(function (f) {
    const gaze = findActivity('formation', f.obs) || { name: '观星', req: 1 };
    const locked = s.lvl < f.req;
    const ml = masteryOf(f.obs).lvl;
    const st = formState(f.id);
    html +=
      '<div class="formcard' + (locked ? ' locked' : '') + '" style="--rc:' + f.color + '">' +
      '<div class="fhead"><span class="fico">' + f.icon + '</span>' +
      '<span class="fmain"><span class="fname">' + f.name + '</span>' +
      '<span class="fdesc">' + gaze.name + ' 对应 · ' + f.desc + '</span></span>' +
      (locked
        ? '<span class="etag warn">需 Lv.' + f.req + '</span>'
        : '<span class="etag" data-gm="' + f.obs + '">精通 Lv.' + ml + '</span>') +
      '</div>';

    f.mods.forEach(function (m, i) {
      const lvl = st.levels[i] || 0;
      const maxed = lvl >= m.max;
      const cost = formCost(f, i, lvl);
      const need = formMasteryReq(f, lvl + 1);
      /* 等级 / 当前加成 / 消耗只在点亮时变化，可安全写进 HTML；
         唯有"星砂够不够"与"精通够不够"随观星每 tick 改变，交给 updateFormState 增量刷新。 */
      html +=
        '<div class="fmod">' +
        '<span class="fmname">' + m.name + '<b>Lv.' + lvl + ' / ' + m.max + '</b></span>' +
        '<span class="fmval">每级 <b>' + pctText(m.per) + '</b> · 当前 <b>' + pctText(m.per * lvl) + '</b></span>' +
        (maxed
          ? '<button class="mini ghost" disabled>圆满</button>'
          : '<button class="mini fmup" data-act="formup" data-id="' + f.id + '" data-idx="' + i + '"' +
            ' data-cost="' + cost + '" data-mreq="' + need + '" data-obs="' + f.obs + '"' +
            (locked ? ' data-locked="1"' : '') +
            ' title="需' + gaze.name + '精通 Lv.' + need + '（当前 Lv.' + ml + '）">💫 ' + cost + '</button>') +
        '</div>';
    });
    html += '</div>';
  });
  html += '</div>';
  return html;
}

/* 阵法面板的动态部分：星砂余额 + 升级按钮可用性（增量刷新，避免整面板重绘） */
function updateFormState() {
  if (!state || state.ui.active !== 'formation') return;
  const c = $('#content');
  if (!c) return;

  const sd = c.querySelector('[data-sd]');
  if (sd) setText(sd, fmtNum(state.stardust));

  const ups = c.querySelectorAll('[data-act="formup"]');
  for (let i = 0; i < ups.length; i++) {
    const el = ups[i];
    const need = Number(el.dataset.mreq) || 0;
    const ml = el.dataset.obs ? masteryOf(el.dataset.obs).lvl : 0;
    const no = el.dataset.locked === '1' || ml < need || state.stardust < (Number(el.dataset.cost) || 0);
    if (el.disabled !== no) el.disabled = no;
  }

  /* 每座阵法对应的观星精通等级 */
  const gms = c.querySelectorAll('[data-gm]');
  for (let i = 0; i < gms.length; i++) {
    setText(gms[i], '精通 Lv.' + masteryOf(gms[i].dataset.gm).lvl);
  }
}

/* ---------------------------------------------------------- 世界 · 洞天 */
/* 建筑效果说明（只在等级变化时改变，可以安全写进 HTML）
   注意：统一使用 Emoji 12.0 及更早的字符（U+1FA70~U+1FAFF 中的 13/14/15 版字符
   在 Win10 的 Segoe UI Emoji 里没有字形，会显示成空心方框），木材/石料分别用 🌲 / ⛰️。 */
function buildingEffect(b, lvl) {
  if (b.special === 'disciple') {
    const cap = lvl > 0 ? DISCIPLE.BASE_STORE + (lvl - 1) * DISCIPLE.STORE_PER_LVL : 0;
    const tier = discipleTierByHall(lvl);
    return '信徒仓库 +' + DISCIPLE.STORE_PER_LVL + '/级 · 当前 ' + cap + ' 位' +
      (tier > 0 ? (' · 可招至 ' + DISCIPLE_TIERS[tier].name) : '');
  }
  if (b.special === 'dynasty') {
    return '朝代位 +' + DYNASTY.SLOTS_PER_LVL + '/级 · 当前 ' + (lvl * DYNASTY.SLOTS_PER_LVL) + ' 位';
  }
  if (b.out) {
    const lab = { food: '🌾 粮食', wood: '🌲 木材', stone: '⛰️ 石料', gold: '💠 灵石', spirit: '🌀 灵力', stardust: '🌠 星砂' };
    const keys = Object.keys(b.out);
    const per = keys.map(function (k) { return lab[k] + ' +' + b.out[k] + '/分'; }).join(' · ');
    if (lvl <= 0) return per;
    const cur = keys.map(function (k) { return lab[k].split(' ')[0] + ' +' + (b.out[k] * lvl); }).join(' · ');
    return per + ' · 当前 ' + cur;
  }
  if (b.popCap) return '人口上限 +' + b.popCap + '/级 · 当前 +' + (b.popCap * lvl);
  if (b.bonus) {
    const label = {
      xp: '全技能经验', sell: '出售价', atk: '攻防', def: '防御', hit: '命中', hp: '生命上限',
      drop: '掉落率', mastery: '精通经验', growth: '灵植生长', speed: '动作速度',
      cultxp: '打坐修为', buildcost: '建造费用', ev: '闪避', gold: '灵石收益',
      spirit: '灵力凝聚', regen: '生命回复', double: '额外产出', planet: '星球生成速度'
    }[b.bonus.key];
    const val = function (v) {
      const n = Math.abs(v * 100);
      return (Math.abs(n - Math.round(n)) < 0.001 ? String(Math.round(n)) : n.toFixed(1)) + '%';
    };
    if (b.bonus.key === 'buildcost') {
      return label + ' −' + val(b.bonus.per) + '/级 · 当前 −' + val(b.bonus.per * lvl);
    }
    return label + ' +' + val(b.bonus.per) + '/级 · 当前 +' + val(b.bonus.per * lvl);
  }
  return '';
}

/* 造价提示：首建只收灵石，木/石为 0 时不显示 */
function costTitle(c) {
  let s = '灵石 ' + c.gold;
  if (c.wood > 0) s += ' · 木材 ' + c.wood;
  if (c.stone > 0) s += ' · 石料 ' + c.stone;
  return s;
}

function wstat(icon, title) {
  return '<div class="wstat"><div class="wl">' + icon + ' ' + title + '</div>' +
    '<div class="wv" data-w="' + title + '">—</div></div>';
}

function wout(label, key) {
  return '<span class="wpip">' + label + ' <b data-wr="' + key + '">—</b></span>';
}

function renderWorld() {
  const w = state.world;
  const wl = worldLevel();
  const sel = currentTerrain();

  /* 子页面切换：洞天营造 / 朝代。朝代页单独渲染，避免建筑列表与朝代卡片互相重建 */
  const tabs = '<div class="wtabs">' +
    '<button class="chip' + (state.ui.worldView === 'dynasty' ? '' : ' on') + '" data-act="wview" data-id="main">🏯 洞天营造</button>' +
    '<button class="chip' + (state.ui.worldView === 'dynasty' ? ' on' : '') + '" data-act="wview" data-id="dynasty">🕰️ 朝代 <b>' +
    w.dynasties.length + '</b>/' + dynastySlots() + '</button>' +
    '</div>';
  if (state.ui.worldView === 'dynasty') return tabs + renderWorldDynasty();

  let html = tabs + '<div class="sdbar"><span class="sdico">🏯</span>' +
    '<span class="sdname">洞天建设度</span><b class="sdval">' + wl + '</b>' +
    '<span class="sdnote">建筑总等级 ' + (wl - 1) + ' · 营造为瞬时操作，不占用动作槽 · 离线同样产出</span></div>';

  /* 动态数值统一走 data-w / data-wr 占位，由 updateWorldState 增量刷新 */
  html += '<div class="wstats">' +
    wstat('👥', '人口') +
    wstat('🌾', '粮食') +
    wstat('🌲', '木材') +
    wstat('⛰️', '石料') +
    wstat('⚙️', '人口效率') +
    '</div>';

  html += '<div class="secttl">被动产出（每分钟 · 已计入人口效率）</div>' +
    '<div class="wpips">' +
    wout('💠 灵石', 'gold') + wout('🌀 灵力', 'spirit') + wout('🌠 星砂', 'stardust') +
    wout('🌾 粮食净额', 'food') +
    '</div>';

  /* 地形切换：参考梅尔沃城镇的生物群系，各自独立建筑链 */
  if (sel === 'all') {
    html += '<div class="secttl">地脉 · 地形（' + TERRAINS.length + ' 类 · 共 ' + BUILDINGS.length + ' 种建筑，点击筛选）</div>';
  } else {
    const t = findTerrain(sel);
    html += '<div class="secttl">' + t.icon + ' ' + t.name + ' · ' + t.desc + '</div>';
  }
  html += '<div class="terrains">';
  html += terrainChip('all', '🗺️', '全部', BUILDINGS.length, 0);
  TERRAINS.forEach(function (t) {
    let cnt = 0;
    const req = terrainReq(t.id);
    BUILDINGS.forEach(function (b) { if (b.terrain === t.id) cnt += 1; });
    html += terrainChip(t.id, t.icon, t.name, cnt, req);
  });
  html += '</div>';

  /* 按所需建设度从低到高排列（同门槛再按首建造价升序），方便顺着进度往下建 */
  const list = BUILDINGS
    .filter(function (b) { return sel === 'all' || b.terrain === sel; })
    .sort(function (a, b) { return a.req - b.req || a.cost.gold - b.cost.gold; });
  html += '<div class="secttl">营造 · 建筑（' + list.length + ' 种 · 按建设度排序 · 等级无上限，每级造价 ×' +
    WORLD.COST_MUL + '）</div>';
  html += '<div class="formgrid">';
  list.forEach(function (b) {
    const lvl = w.buildings[b.id] || 0;
    const realmBlocked = !!(b.realmReq && state.skills.cultivation.lvl < b.realmReq);
    const locked = wl < b.req || realmBlocked;
    const c = worldBuildCost(b, lvl);
    const t = findTerrain(b.terrain);
    html +=
      '<div class="formcard bldcard' + (locked ? ' locked' : '') + '" style="--rc:' + (b.color || t.color) + '">' +
      '<div class="fhead"><span class="fico">' + b.icon + '</span>' +
      '<span class="fmain"><span class="fname">' + b.name +
      '<b class="blvl">Lv.' + lvl + '</b></span>' +
      '<span class="fdesc">' + b.desc + '</span></span>' +
      (realmBlocked ? '<span class="etag warn">需' + (realmInfo(b.realmReq).realm || '元婴期') + '</span>'
        : locked ? '<span class="etag warn">需建设度 ' + b.req + '</span>' : (sel === 'all' ? '<span class="etag">' + t.icon + ' ' + t.name + '</span>' : '')) +
      '</div>' +
      '<div class="fmod">' +
      '<span class="fmname">' + buildingEffect(b, lvl) + '</span>' +
      '<button class="mini bldbtn" data-act="build" data-id="' + b.id + '"' +
      ' data-gold="' + c.gold + '" data-wood="' + c.wood + '" data-stone="' + c.stone + '"' +
      (locked ? ' data-locked="1"' : '') +
      ' title="' + (realmBlocked ? '需达到 ' + (realmInfo(b.realmReq).realm || '元婴期') : costTitle(c)) + '">' +
      '<span class="cst"><i>💠</i>' + fmtNum(c.gold) + '</span>' +
      (c.wood > 0 ? '<span class="cst"><i>🌲</i>' + fmtNum(c.wood) + '</span>' : '') +
      (c.stone > 0 ? '<span class="cst"><i>⛰️</i>' + fmtNum(c.stone) + '</span>' : '') +
      '</button>' +
      '</div></div>';
  });
  html += '</div>';

  return html;
}

/* 当前地形筛选：选中持久化在 state.ui.worldTerrain */
function currentTerrain() {
  const sel = state.ui.worldTerrain;
  return (sel === 'all' || findTerrain(sel)) ? sel : 'all';
}

function setWorldTerrain(id) {
  state.ui.worldTerrain = (id === 'all' || findTerrain(id)) ? id : 'all';
  renderContent();
  updateWorldState();
}

/* 地形切换按钮：未达门槛时置灰，但仍可点开预览 */
function terrainChip(id, icon, name, count, req) {
  const on = currentTerrain() === id ? ' on' : '';
  const locked = req > 0 && worldLevel() < req;
  return '<button class="chip terrainchip' + on + (locked ? ' locked' : '') + '"' +
    ' data-act="wterrain" data-id="' + id + '"' +
    (locked ? ' title="需建设度 ' + req + ' 解锁"' : '') + '>' +
    icon + ' ' + name + ' <b>' + count + '</b>' +
    (locked ? ' <em>Lv.' + req + '</em>' : '') +
    '</button>';
}

/* 洞天面板的动态部分：人口 / 资源 / 效率 / 产出 / 建造按钮可用性 */
function updateWorldState() {
  if (!state || state.ui.active !== 'world') return;
  const c = $('#content');
  if (!c) return;

  const w = state.world;
  const r = worldRates();
  const eff = worldEff();
  const popCap = worldPopCap();
  const setW = function (title, txt) { setText(c.querySelector('[data-w="' + title + '"]'), txt); };

  const cap = worldCap(worldLevel());
  setW('人口', Math.floor(w.pop) + ' / ' + popCap);
  setW('粮食', fmtNum(w.res.food) + ' / ' + fmtNum(cap.food));
  setW('木材', fmtNum(w.res.wood) + ' / ' + fmtNum(cap.wood));
  setW('石料', fmtNum(w.res.stone) + ' / ' + fmtNum(cap.stone));
  setW('人口效率', Math.round(eff * 100) + '%');

  const netMin = (r.food - r.foodUse) * 60;
  const rateTxt = function (perSec, digits) { return (perSec * 60).toFixed(digits) + '/分'; };
  const setR = function (key, txt, color) {
    const el = c.querySelector('[data-wr="' + key + '"]');
    setText(el, txt);
    if (el) el.style.color = color;
  };
  setR('gold', rateTxt(r.gold, 1), 'var(--gold2)');
  setR('spirit', rateTxt(r.spirit, 1), 'var(--jade)');
  setR('stardust', rateTxt(r.stardust, 1), '#a98be0');
  setR('food', (netMin >= 0 ? '+' : '') + netMin.toFixed(1) + '/分', netMin >= 0 ? 'var(--jade)' : 'var(--red)');

  /* 建造按钮：资源不足或未解锁时置灰 */
  const btns = c.querySelectorAll('[data-act="build"]');
  for (let i = 0; i < btns.length; i++) {
    const el = btns[i];
    const no = el.dataset.locked === '1' ||
      state.gold < (Number(el.dataset.gold) || 0) ||
      w.res.wood < (Number(el.dataset.wood) || 0) ||
      w.res.stone < (Number(el.dataset.stone) || 0);
    if (el.disabled !== no) el.disabled = no;
  }
}

/* ==================================================== 洞天 · 朝代（v2.5.0） */
/* 静态骨架 + data-dyn 占位：人口 / 上限 / 产出 / 倒计时都由 updateDynastyState
   增量写入，10 分钟一次结算不会触发 #content 整树重建。 */
function renderWorldDynasty() {
  const w = state.world;
  const slots = dynastySlots();
  const max = dynastyEraMax();
  const lv = smallWorldLevel();
  const realmOk = dynastyUnlocked();
  const canSummon = realmOk && lv > 0 && w.dynasties.length < slots && state.seed >= DYNASTY.SUMMON_SEED;
  const mergeIdx = Math.floor(Number(state.ui.dynMerge));

  let html = '<div class="dynbar">' +
    '<span class="dynseed">🌱 生命之种 <b data-dyn="seed">—</b></span>' +
    '<button class="pbtn' + (canSummon ? '' : ' off') + '" data-act="dynsummon"' + (canSummon ? '' : ' disabled') + '>' +
    '召唤朝代生灵 · 🌱' + DYNASTY.SUMMON_SEED + '</button>' +
    '<span class="dyncd">下次结算 <b data-dyn="cd">--:--</b></span>' +
    '</div>';

  if (!realmOk) {
    html += '<div class="dynnote warn">尚未达到' + (realmInfo(DYNASTY.REALM_REQ).realm || '元婴期') +
      '，无法开辟「小世界」（洞天 · 秘境建筑），也无法召唤朝代生灵。</div>';
  } else if (lv <= 0) {
    html += '<div class="dynnote warn">尚未营造「🌌 小世界」（洞天 · 秘境 · 需' +
      (realmInfo(DYNASTY.REALM_REQ).realm || '元婴期') + '）。建成 Lv.1 即可拥有 ' +
      DYNASTY.SLOTS_PER_LVL + ' 个朝代位。</div>';
  } else if (w.dynasties.length >= slots) {
    html += '<div class="dynnote">朝代位已满（' + slots + ' / ' + slots + '）。升级「小世界」每级 +' +
      DYNASTY.SLOTS_PER_LVL + ' 位；同名朝代可合成提升人口上限。</div>';
  } else {
    html += '<div class="dynnote">可召唤年代：' + dynastyName(0) + ' ~ ' + dynastyName(max) +
      '（穿越次数解锁更古老的年代）· 召唤与合成为瞬时操作，不占用动作槽。</div>';
  }

  if (mergeIdx >= 0 && w.dynasties[mergeIdx]) {
    const el = findDynastyEraColor(w.dynasties[mergeIdx].dyn);
    html += '<div class="dynmergebar" style="--dc:' + el + '">合成目标：<b>' +
      dynastyName(w.dynasties[mergeIdx].dyn) + '</b>（第 ' + (mergeIdx + 1) +
      ' 位）· 点击另一个同名朝代卡片的「并入」完成合成，消耗 🌱' + DYNASTY.MERGE_SEED +
      '<button class="mini" data-act="dynmergecancel">取消</button></div>';
  }

  html += '<div class="dyncards">';
  w.dynasties.forEach(function (d, i) {
    const color = findDynastyEraColor(d.dyn);
    const r = dynastyEraRes(d.dyn);
    const resLab = { food: '🌾', wood: '🌲', stone: '⛰️', gold: '💠', stardust: '🌠' }[r.res] || '🌾';
    const canMergeHere = mergeIdx >= 0 && mergeIdx !== i && w.dynasties[mergeIdx] && w.dynasties[mergeIdx].dyn === d.dyn;
    html += '<div class="dyncard' + (mergeIdx === i ? ' targeting' : '') + '" style="--dc:' + color + '">' +
      '<div class="dynhead"><span class="dynico">🕰️</span><b>' + dynastyName(d.dyn) + '</b>' +
      '<span class="dyntag">第 ' + (i + 1) + ' 位</span></div>' +
      '<div class="dynrow"><span>人口</span><b data-dyn="pop-' + i + '">—</b><span class="dyncap">/ <i data-dyn="cap-' + i + '">—</i></span></div>' +
      '<div class="dynbar2"><i data-dyn="bar-' + i + '" style="width:0%"></i></div>' +
      '<div class="dynout">' + resLab + ' 每次结算 <b data-dyn="out-' + i + '">—</b> · 🌾 <b data-dyn="food-' + i + '">—</b></div>' +
      '<div class="dynact">' +
      (mergeIdx >= 0
        ? (canMergeHere
          ? '<button class="mini merge" data-act="dynmergetarget" data-id="' + i + '">并入</button>'
          : '<button class="mini" disabled>同名可并入</button>')
        : '<button class="mini" data-act="dynmerge" data-id="' + i + '">合成</button>') +
      '</div></div>';
  });
  for (let i = w.dynasties.length; i < slots; i++) {
    html += '<div class="dyncard empty"><div class="dynhead"><span class="dynico">➕</span><b>空位</b></div>' +
      '<div class="dynempty">消耗 🌱' + DYNASTY.SUMMON_SEED + ' 召唤一位朝代生灵</div></div>';
  }
  html += '</div>';

  html += '<div class="secttl">规则</div>' +
    '<div class="shopnote">每个朝代是独立人口池：每 ' + (DYNASTY.TICK_SEC / 60) +
    ' 分钟结算一次，按人口产出粮食与该年代对应的主资源（清朝/明朝 → 木材，元朝/宋朝/三国 → 石料，唐朝/南北朝/两晋/周朝/商朝 → 灵石，夏朝及古纪 → 星砂）。' +
    '人口每次结算向本朝上限逼近 ' + Math.round(DYNASTY.GROWTH_RATE * 100) + '%（至少 +' + DYNASTY.GROWTH_MIN +
    '），上限只能靠合成同名朝代提升。合成消耗 🌱' + DYNASTY.MERGE_SEED +
    '：目标获得被合者 ' + Math.round(DYNASTY.MERGE_POP_RATE * 100) + '% 人口与 ' +
    Math.round(DYNASTY.MERGE_CAP_RATE * 100) + '% 上限，被合者失去这部分但不会消失。' +
    '生命之种来自穿越星球吸收（' + Math.round(DYNASTY.SEED_PLANET_P * 100) + '%）、五行属性裂缝（' +
    Math.round(DYNASTY.SEED_ELEM_P * 100) + '% 掉 ' + DYNASTY.SEED_ELEM_QTY + ' 颗）、异界裂缝与裂缝怪物（必掉）。' +
    '召唤 / 合成不占用动作槽，结算为后台被动推进，离线同样按同一 tick 结算（受 12 小时离线上限约束）。</div>';

  return html;
}

/* 年代主题色：按朝代分组给一点视觉区分（纯展示） */
function findDynastyEraColor(era) {
  const palette = ['#8ad46a', '#7dd8b8', '#63a9e0', '#7fb0d8', '#d8b26a', '#e0a3c8', '#a98be0', '#e0906a', '#f0c95a', '#c0a878', '#8fd8e0'];
  const i = Math.max(0, Math.floor(Number(era) || 0));
  if (i < palette.length) return palette[i];
  return '#a9c8e0';
}

/* 朝代页增量刷新：只改文本与宽度，不改结构 */
function updateDynastyState() {
  if (!state || state.ui.active !== 'world') return;
  const c = $('#content');
  if (!c) return;
  const w = state.world;
  if (!w || !Array.isArray(w.dynasties)) return;

  const set = function (key, txt) {
    const el = c.querySelector('[data-dyn="' + key + '"]');
    if (el && el.textContent !== txt) el.textContent = txt;
  };
  set('seed', String(Math.floor(state.seed || 0)));
  const left = Math.max(0, DYNASTY.TICK_SEC - (isFinite(w.dynAccum) ? w.dynAccum : 0));
  set('cd', w.dynasties.length ? fmtCd(left * 1000) : '—');

  w.dynasties.forEach(function (d, i) {
    const pop = Math.max(0, Number(d.pop) || 0);
    const cap = Math.max(1, Number(d.cap) || 1);
    const out = dynastyOutput(d);
    set('pop-' + i, String(Math.floor(pop)));
    set('cap-' + i, String(Math.floor(cap)));
    set('out-' + i, (Math.round(out.amount * 10) / 10) + '/次');
    set('food-' + i, (Math.round(out.food * 10) / 10) + '/次');
    const bar = c.querySelector('[data-dyn="bar-' + i + '"]');
    if (bar) {
      const pct = Math.max(0, Math.min(1, pop / cap)) * 100;
      const wid = pct.toFixed(1) + '%';
      if (bar.style.width !== wid) bar.style.width = wid;
    }
  });

  const sbtn = c.querySelector('[data-act="dynsummon"]');
  if (sbtn) {
    const no = !dynastyUnlocked() || smallWorldLevel() <= 0 || w.dynasties.length >= dynastySlots() ||
      state.seed < DYNASTY.SUMMON_SEED;
    if (sbtn.disabled !== no) sbtn.disabled = no;
    sbtn.classList.toggle('off', no);
  }
}

/* 底部当前动作条 */
function currentBarHTML() {
  const p = currentProgress();
  const stopBtn = '<button class="btn ghost small off" data-act="stop">停止</button>';

  if (!p) {
    const idleTxt = state.stun > 0
      ? '😵 眩晕中 — 被识破后缓一缓，稍候自动恢复'
      : '当前空闲 — 点击上方任意条目开始挂机（同一时间仅进行一件事）';
    return '<div class="activebar"><div class="row"><span class="none">' + idleTxt + '</span></div></div>';
  }
  const label = (p.skill === 'combat') ? '' : (SKILLS[p.skill] ? SKILLS[p.skill].name + ' · ' : '');
  const note = p.skill === 'combat' ? '自动战斗中'
    : p.skill === 'planet' ? (p.waiting ? '等待资源恢复' : '星球运转中')
      : p.skill === 'tower' ? '锁妖塔挑战中'
        : p.skill === 'rift' ? '裂缝修复中'
          : (p.waiting ? '等待材料' : '进行中');
  return '<div class="activebar">' +
    '<div class="row"><span class="now">' + label + '<b>' + esc(p.name) + '</b> <span class="none">(' + note + ')</span>' +
    ' <span class="none" data-bar="actnum">0.0%</span></span>' + stopBtn + '</div>' +
    '<div class="bar"><i class="actfill" data-bar="active" style="width:' + (p.pct * 100).toFixed(1) + '%"></i></div>' +
    '</div>';
}

/* 灵植面板：地块网格 + 种子选择 + 生长进度（参考梅尔沃种植） */
function renderFarming() {
  const fs = state.skills.farming;
  const np = FARMING_PLOT_REQS.length;

  let html = '';

  /* 种子选择 chips：当前持有 + 灵植等级够的 */
  const availableSeeds = FARM_SEEDS.filter(function (s) { return fs.lvl >= s.req; })
    .sort(function (a, b) { return a.req - b.req; });
  html += '<div class="secttl">可选种子（持有多少显示多少；在炼丹采药时有 30% 概率掉落对应种子）</div>';
  html += '<div class="farmseedbar">';
  if (!availableSeeds.length) {
    html += '<span class="empty">灵植等级尚浅，先提升灵植造诣再种高级种子。</span>';
  } else {
    availableSeeds.forEach(function (s) {
      const have = invCount(s.id);
      const sel = state.ui.farmSeedId === s.id ? ' on' : '';
      const locked = have <= 0 ? ' locked' : '';
      html += '<button class="chip' + sel + locked + '" data-act="farmseed" data-id="' + s.id + '"' +
        (have <= 0 ? ' disabled' : '') + '>' +
        s.icon + ' ' + s.name + ' · 🌱' + have +
        '<span class="etag">' + fmtDur(s.growTime) + '/株</span>' +
        '</button>';
    });
  }
  html += '</div>';

  /* 地块网格 */
  html += '<div class="secttl">灵田（成长在后台自动推进，离线同样有效）</div>';
  html += '<div class="plotgrid">';
  for (let i = 0; i < np; i++) {
    const p = state.plots[i];
    const unlocked = plotUnlocked(fs.lvl, i);
    if (!unlocked) {
      html += '<div class="plotcell locked">' +
        '<div class="plock">🔒 需灵植 Lv.' + FARMING_PLOT_REQS[i] + '</div></div>';
      continue;
    }
    if (!p.seedId) {
      html += '<div class="plotcell empty" data-act="plot_plant" data-idx="' + i + '">' +
        '<div class="pico">➕</div>' +
        '<div class="ptxt">选种后点此地块种下</div></div>';
      continue;
    }
    const seed = findSeed(p.seedId);
    if (!seed) { html += '<div class="plotcell empty"><div class="ptxt">（无效种子，已清空）</div></div>'; continue; }
    if (p.ready) {
      html += '<div class="plotcell ready" data-act="plot_harvest" data-idx="' + i + '">' +
        '<div class="pico">' + seed.icon + '</div>' +
        '<div class="ptxt">' + seed.name + ' <span class="ok">可收获 ✦' + seed.yield + '×</span></div>' +
        '<span class="plabel readyLbl">点击收获</span></div>';
      continue;
    }
    const pct = Math.min(1, p.growth / seed.growTime);
    html += '<div class="plotcell growing">' +
      '<div class="pico">' + seed.icon + '</div>' +
      '<div class="ptxt">' + seed.name + '</div>' +
      '<div class="pbar"><b data-plot="' + i + '" style="width:' + (pct * 100).toFixed(1) + '%"></b></div>' +
      '<span class="plabel">' + Math.ceil(seed.growTime - p.growth) + ' 秒后成熟</span></div>';
  }
  html += '</div>';
  return html;
}

/* 灵植地块生长条增量刷新 */
function updatePlotGrowth() {
  const c = $('#content');
  if (!c || state.ui.active !== 'farming') return;
  const bbs = c.querySelectorAll('[data-plot]');
  for (let i = 0; i < bbs.length; i++) {
    const idx = Number(bbs[i].dataset.plot);
    const p = state.plots[idx];
    if (!p || !p.seedId) continue;
    const seed = findSeed(p.seedId);
    if (!seed) continue;
    bbs[i].style.width = (Math.min(1, p.growth / seed.growTime) * 100).toFixed(1) + '%';
  }
}

/* 入世面板：红尘百业职业体验（参考梅尔沃盗窃） */
function renderThieving() {
  const s = state.skills.thieving;
  let html = '<div class="secttl">红尘百业 · 点击开始体验（同一时间仅能体验一种生计，被识破会中断并眩晕）</div>';
  html += '<div class="grid">';

  ACTIONS.thieving.slice().sort(function (a, b) { return a.req - b.req; }).forEach(function (a) {
    const locked = s.lvl < a.req;
    const on = (state.action && state.action.skill === 'thieving' && state.action.id === a.id) ? ' on' : '';
    const m = masteryOf(a.id);
    const rate = Math.min(0.95, a.rate + m.lvl * 0.002);
    const lootTxt = a.loot.map(function (l) {
      return itemIcon(l.id) + itemName(l.id) + ' ' + Math.round(l.chance * 100) + '%';
    }).join(' · ');

    html +=
      '<div class="entry' + on + (locked ? ' locked' : '') + '" data-act="action" data-skill="thieving" data-id="' + a.id + '">' +
      '<span class="eico">' + a.icon + '</span>' +
      '<span class="emain"><span class="ename">' + a.name +
      (locked ? '<span class="etag">需 Lv.' + a.req + '</span>' : '') + '</span>' +
      '<span class="emeta">成功率 <b>' + Math.round(rate * 100) + '%</b>（精通 +） · ' + fmtDur(a.time) + '/次 · 经验 <b>' + a.xp + '</b><br>' +
      '报酬 💠' + a.gold[0] + '~' + a.gold[1] + ' · 产出：' + lootTxt + '<br>' +
      '<span class="etag warn">被识破：罚 💠' + a.fine + ' · 伤 ' + a.dmg + ' · 眩晕 ' + a.stun + ' 秒 · 经验减半</span></span>' +
      masteryHTML(a.id) + '</span>' +
      '</div>';
  });

  html += '</div>';
  return html;
}

/* ============================================================ 信徒 · 招募 */
const DISCIPLE_LABEL = {
  speed: '全局动作速度', atk: '攻击', def: '防御', hit: '命中', ev: '闪避', hp: '生命上限',
  xp: '全技能经验', cultxp: '打坐修为', gold: '灵石收益', sell: '出售价', drop: '掉落率',
  mastery: '精通经验', double: '额外产出', spirit: '灵力凝聚', regen: '脱战回血'
};

/* 信徒加成文案：speed_<技能ID> 显示为「某技能速度」 */
function discipleBonusText(d) {
  return d.bonus.map(function (b) {
    let label;
    if (b.k.indexOf('speed_') === 0) {
      const sid = b.k.slice(6);
      label = (SKILLS[sid] ? SKILLS[sid].name : sid) + '速度';
    } else {
      label = DISCIPLE_LABEL[b.k] || b.k;
    }
    return label + ' +' + Math.round(b.v * 100) + '%';
  }).join(' · ');
}

function renderDisciples() {
  const hall = hallLevel();
  const cap = discipleStoreCap();
  const slots = discipleSlots();
  const d = state.disciples;

  let html = '<div class="sdbar"><span class="sdico">🙏</span>' +
    '<span class="sdname">信徒</span><b class="sdval" data-dcount>' + discipleTotal() + ' / ' + cap + '</b>' +
    '<span class="sdnote">信徒视作装备，当前可上阵 ' + slots + ' 位（招贤殿每级 +1）· 招贤殿 Lv.' + hall +
    ' · 加成常驻，不占用动作槽</span></div>';

  if (!hall) {
    const req = findBuilding('summonhall').req;
    html += '<div class="empty">尚未营造「招贤殿」。<br>' +
      '前往「世界」→ 选择「秘境」地形 → 营造「招贤殿」（需建设度 ' + req + '，首建 💠700），' +
      '建成后即可招募，并按招贤殿等级开放上阵位（每级 1 位）。</div>';
    return html;
  }

  /* 招募 */
  const cost = discipleRecruitCost();
  const tier = discipleTierCap();
  html += '<div class="secttl">招募 · 招贤殿 Lv.' + hall + '（最高可招 ' + DISCIPLE_TIERS[tier].name + '）</div>';
  html += '<div class="drecruit"><button class="btn" data-act="recruit">' +
    '<span>🙏 招募信徒</span> <b data-dcost>💠' + fmtNum(cost) + '</b></button>' +
    '<span class="qhint">每多一位信徒，下次招募费 ×' + DISCIPLE.RECRUIT_GROW +
    '；仓库总容量 ' + cap + ' 位（含上阵）</span></div>';

  /* 上阵格：数量 = 招贤殿等级 */
  html += '<div class="secttl">上阵（' + discipleEquippedCount() + ' / ' + slots +
    ' · 点击已上阵信徒可卸下）</div>';
  html += '<div class="dslots">';
  for (let i = 0; i < slots; i++) {
    const id = d.equipped[i];
    const dd = id ? findDisciple(id) : null;
    if (!dd) {
      html += '<div class="dslot empty"><span class="dico">➕</span>' +
        '<span class="dname">空位</span><span class="dnote">待信徒入座</span></div>';
    } else {
      const t = DISCIPLE_TIERS[dd.tier];
      html += '<div class="dslot" data-act="dunfollow" data-slot="' + i + '" style="--rc:' + t.color + '"' +
        ' title="' + esc(dd.desc) + '">' +
        '<span class="dico">' + dd.icon + '</span>' +
        '<span class="dname">' + dd.name + '</span>' +
        '<span class="dnote">' + t.name + ' · ' + discipleBonusText(dd) + '</span></div>';
    }
  }
  html += '</div>';

  /* 仓库 */
  html += '<div class="secttl">信徒仓库（待命 ' + d.owned.length + ' 位）</div>';
  if (!d.owned.length) {
    html += '<div class="empty">仓库空空，先招募一位信徒吧。</div>';
    return html;
  }
  html += '<div class="dgrid">';
  d.owned.forEach(function (id) {
    const dd = findDisciple(id);
    if (!dd) return;
    const t = DISCIPLE_TIERS[dd.tier];
    html += '<div class="formcard dcard" style="--rc:' + t.color + '">' +
      '<div class="fhead"><span class="fico">' + dd.icon + '</span>' +
      '<span class="fmain"><span class="fname">' + dd.name +
      '<b class="blvl">' + t.name + '</b></span>' +
      '<span class="fdesc">' + dd.desc + '</span></span></div>' +
      '<div class="fmod"><span class="fmname">' + discipleBonusText(dd) + '</span>' +
      '<button class="mini" data-act="dfollow" data-id="' + id + '">装备</button>' +
      '</div></div>';
  });
  html += '</div>';
  return html;
}

/* 信徒面板的动态部分：招募按钮可用性 / 容量计数 */
function updateDiscipleState() {
  if (!state || state.ui.active !== 'disciples') return;
  const c = $('#content');
  if (!c) return;
  const cap = discipleStoreCap();
  const full = discipleTotal() >= cap;
  const cost = discipleRecruitCost();
  const btn = c.querySelector('[data-act="recruit"]');
  if (btn) {
    btn.disabled = full || state.gold < cost;
    const lab = c.querySelector('[data-dcost]');
    if (lab) lab.textContent = full ? '仓库已满' : ('💠' + fmtNum(cost));
  }
  const cnt = c.querySelector('[data-dcount]');
  if (cnt) cnt.textContent = discipleTotal() + ' / ' + cap;
  const slotsFull = discipleEquippedCount() >= discipleSlots();
  c.querySelectorAll('[data-act="dfollow"]').forEach(function (el) {
    if (slotsFull) el.setAttribute('data-locked', '1');
    else el.removeAttribute('data-locked');
  });
}

function renderContent() {
  const id = state.ui.active;
  if (id === 'tasks') { setHTML('#content', renderTasks()); return; }
  if (id === 'shop') { setHTML('#content', renderShop()); return; }
  if (id === 'planet') {
    if (state.ui.planetView === 'rift') {
      setHTML('#content', renderRift() + currentBarHTML());
      updateRift(true);
    } else if (state.ui.planetView === 'elem') {
      setHTML('#content', renderElemRift() + currentBarHTML());
      updateElemRift(true);
    } else if (state.ui.planetView === 'riftmon') {
      setHTML('#content', renderRiftMon() + currentBarHTML());
      updateRiftMon(true);
    } else {
      setHTML('#content', renderPlanet() + currentBarHTML());
      updatePlanet();
    }
    return;
  }
  if (id === 'tower') { setHTML('#content', renderTower() + currentBarHTML()); updateTower(true); return; }
  if (id === 'bag') { setHTML('#content', renderBag()); updateInvQty(); return; }
  if (id === 'world') { setHTML('#content', renderWorld() + currentBarHTML()); updateWorldState(); updateDynastyState(); return; }
  if (id === 'disciples') { setHTML('#content', renderDisciples()); updateDiscipleState(); return; }
  if (id === 'settings') { setHTML('#content', renderSettings() + currentBarHTML()); return; }
  if (id === 'devtools') {
    /* 未解锁时不允许停留在控制台页（防止旧 state 或手动改值进入） */
    if (!DEV.unlocked) { state.ui.active = 'settings'; setHTML('#content', renderSettings() + currentBarHTML()); return; }
    setHTML('#content', renderDevTools() + currentBarHTML());
    if (_devDirty) { updateDev(); _devDirty = false; }
    return;
  }

  let html = skillHeader(id);
  if (id === 'combat') html += renderCombat();
  else if (id === 'smelting') html += renderSmelting();
  else if (id === 'crafting') html += renderCrafting();
  else if (id === 'herbalism') html += renderHerbalism();
  else if (id === 'alchemy') html += renderAlchemy();
  else if (id === 'cultivation') html += renderCultivation();
  else if (id === 'formation') html += renderFormation();
  else if (id === 'farming') html += renderFarming();
  else if (id === 'thieving') html += renderThieving();
  else html += '<div class="secttl">可进行的活动</div>' + gatherEntries(ACTIONS[id] || [], id);

  html += currentBarHTML();
  setHTML('#content', html);
  updateXpText();   /* 占位节点先立刻填上数值，避免空白闪一下 */
  updateXpBars();
  updateFormState();
}

/* ====================================================== 设置 / 测试控制台 */
/* 控制台是不是"在循环里跑"：页面骨架是静态的，数值只在进入页面或执行一次
   测试操作后由 updateDev() 填一次（_devDirty），不随 renderAll 持续写 DOM。 */
let _devDirty = false;

function renderSettings() {
  let html = '<div class="phead"><h2>🔧 设置</h2>' +
    '<span class="pdesc">兑换码与后续设置的落位骨架；本次仅「兑换码」可用。</span></div>';

  html += '<div class="secttl">兑换码</div>' +
    '<div class="setcard">' +
    '<div class="setrow"><span class="setlab">兑换码</span>' +
    '<input class="setin" type="text" data-set-in="code" maxlength="64" placeholder="输入兑换码" autocomplete="off" spellcheck="false">' +
    '<button class="btn small" data-act="redeem">兑换</button></div>' +
    '<div class="setmsg" data-set="msg">' +
    esc(DEV.msg || '输入兑换码以解锁对应内容。') + '</div>' +
    '</div>';

  if (DEV.unlocked) {
    html += '<div class="secttl">已解锁</div>' +
      '<div class="setcard">' +
      '<div class="setrow"><span class="setlab">🔬 测试控制台</span>' +
      '<span class="setph">当前运行已激活</span>' +
      '<button class="btn small" data-act="devopen">打开控制台</button></div>' +
      '<div class="setmsg">刷新页面或重开游戏后失效，需要重新兑换。</div>' +
      '</div>';
  }

  html += '<div class="secttl">通用</div>' +
    '<div class="setcard">' +
    '<div class="setrow"><span class="setlab">更多设置</span><span class="setph">（预留分组）</span></div>' +
    '<div class="setmsg">音效、画面、自动化等设置将在后续版本逐步加入；此处只保留分组容器与占位条目。</div>' +
    '</div>';

  return html;
}

/* 控制台行：标签 + 当前值占位 + 输入 + 执行按钮 */
function devRow(label, curKey, inputKey, action, ph, vals, btn) {
  /* 未显式给 vals 时，默认读取本行的输入框 */
  const src = vals || inputKey || '';
  return '<div class="devrow"><span class="devlab">' + label + '</span>' +
    (curKey ? '<span class="devcur" data-dev="cur-' + curKey + '">—</span>' : '') +
    (inputKey ? '<input class="setin devin" type="number" data-dev-in="' + inputKey + '" placeholder="' + ph + '">' : '') +
    '<button class="mini devgo" data-act="devact" data-dev="' + action + '"' +
    (src ? ' data-vals="' + src + '"' : '') + '>' + (btn || '设置') + '</button></div>';
}

function devSelect(key, opts) {
  return '<select class="setin devsel" data-dev-in="' + key + '">' + opts + '</select>';
}

function renderDevTools() {
  const skOpts = SKILL_ORDER.filter(function (id) { return id !== 'cultivation'; })
    .map(function (id) { return '<option value="' + id + '">' + SKILLS[id].name + '</option>'; }).join('');
  const bldOpts = BUILDINGS.map(function (b) {
    return '<option value="' + b.id + '">' + b.name + '</option>';
  }).join('');

  let html = '<div class="phead"><h2>🔬 测试控制台</h2>' +
    '<span class="pdesc">仅本次运行有效（不写入存档）。所有改动直接写 state，立即反映到界面；' +
    '时间快进复用离线结算 tick，受 ' + CONFIG.OFFLINE_CAP_H + ' 小时上限约束。</span></div>';

  html += '<div class="devmsg" data-dev="msg">' + esc(DEV.msg || '选择一项开始调整。') + '</div>';

  html += '<div class="devsec"><div class="secttl">核心资源（直接设为）</div>' +
    devRow('灵石', 'gold', 'gold', 'gold', '数值') +
    devRow('灵力', 'spirit', 'spirit', 'spirit', '数值') +
    devRow('星砂', 'star', 'stardust', 'stardust', '数值') +
    devRow('生命之种', 'seed', 'seed', 'seed', '数值') +
    '</div>';

  html += '<div class="devsec"><div class="secttl">洞天资源（粮食 / 木材 / 石料，受仓容上限约束）</div>' +
    '<div class="devrow"><span class="devlab">资源</span>' +
    devSelect('resSel', '<option value="food">粮食</option><option value="wood">木材</option><option value="stone">石料</option>') +
    '<input class="setin devin" type="number" data-dev-in="resVal" placeholder="数值">' +
    '<button class="mini devgo" data-act="devact" data-dev="res" data-vals="resSel,resVal">设置</button></div>' +
    '<div class="devcurline">当前：🌾 <b data-dev="cur-food">—</b> · 🌲 <b data-dev="cur-wood">—</b> · ⛰️ <b data-dev="cur-stone">—</b></div>' +
    '</div>';

  html += '<div class="devsec"><div class="secttl">修为与境界</div>' +
    devRow('境界阶数（1 ~ ' + TOTAL_STAGES + '）', 'cult', 'cultLvl', 'cultLvl', '阶数') +
    devRow('当前修为', 'xp', 'cultXp', 'cultXp', '修为') +
    '</div>';

  html += '<div class="devsec"><div class="secttl">技能等级与精通</div>' +
    '<div class="devrow"><span class="devlab">技能等级</span>' + devSelect('skillSel', skOpts) +
    '<input class="setin devin" type="number" data-dev-in="skillLvl" placeholder="Lv.">' +
    '<button class="mini devgo" data-act="devact" data-dev="skillLvl" data-vals="skillSel,skillLvl">设置</button></div>' +
    '<div class="devrow"><span class="devlab">精通等级</span>' + devSelect('masterySel', skOpts) +
    '<input class="setin devin" type="number" data-dev-in="masteryLvl" placeholder="Lv.">' +
    '<button class="mini devgo" data-act="devact" data-dev="mastery" data-vals="masterySel,masteryLvl">设置</button></div>' +
    '</div>';

  html += '<div class="devsec"><div class="secttl">洞天建筑（含引力塔）</div>' +
    '<div class="devrow"><span class="devlab">建筑</span>' + devSelect('bldSel', bldOpts) +
    '<input class="setin devin" type="number" data-dev-in="bldLvl" placeholder="等级">' +
    '<button class="mini devgo" data-act="devact" data-dev="building" data-vals="bldSel,bldLvl">设置</button></div>' +
    '</div>';

  html += '<div class="devsec"><div class="secttl">星球</div>' +
    devRow('灵气浓度', 'aura', 'aura', 'aura', '数值') +
    devRow('穿越次数', 'cross', 'cross', 'cross', '次数') +
    '</div>';

  html += '<div class="devsec"><div class="secttl">锁妖塔</div>' +
    devRow('当前层数', 'tower', 'tower', 'tower', '层数') +
    '</div>';

  html += '<div class="devsec"><div class="secttl">三套裂缝</div>' +
    '<div class="devrow"><span class="devlab">异界裂缝 <b data-dev="cur-rift">—</b></span>' +
    '<button class="mini devgo" data-act="devact" data-dev="riftReset">重置为待修复</button>' +
    '<button class="mini devgo" data-act="devact" data-dev="riftFix">标记修复</button></div>' +
    '<div class="devrow"><span class="devlab">属性裂缝 <b data-dev="cur-elem">—</b></span>' +
    '<button class="mini devgo" data-act="devact" data-dev="elemRefresh">整轮刷新</button>' +
    '<button class="mini devgo" data-act="devact" data-dev="elemFixAll">全部修复</button></div>' +
    '<div class="devrow"><span class="devlab">裂缝怪物 <b data-dev="cur-mon">—</b></span>' +
    '<button class="mini devgo" data-act="devact" data-dev="monSpawn">重新生成</button>' +
    '<button class="mini devgo" data-act="devact" data-dev="monKill">标记击败</button></div>' +
    '</div>';

  html += '<div class="devsec"><div class="secttl">时间快进（复用离线结算）</div>' +
    '<div class="devrow"><span class="devlab">快进秒数</span>' +
    '<input class="setin devin" type="number" data-dev-in="ff" placeholder="如 3600">' +
    '<button class="mini devgo" data-act="devact" data-dev="ff" data-vals="ff">快进</button></div>' +
    '<div class="devnote">按 0.5 秒步长调用 tick，等效于离线收益计算；单次最多结算 ' +
    (CONFIG.OFFLINE_CAP_H * 3600) + ' 秒（' + CONFIG.OFFLINE_CAP_H + ' 小时）。</div>' +
    '</div>';

  html += '<div class="devsec"><div class="secttl">存档</div>' +
    '<div class="devrow"><span class="devlab">立即存档</span>' +
    '<button class="mini devgo" data-act="devact" data-dev="save">保存</button>' +
    '<button class="mini devgo" data-act="devact" data-dev="reload">重载页面（验证控制台重新隐藏）</button></div>' +
    '</div>';

  return html;
}

/* 进入页面 / 执行一次操作后填一次当前值（不在主循环里持续写 DOM） */
function updateDev() {
  const c = $('#content');
  if (!c) return;
  const set = function (key, txt) {
    const el = c.querySelector('[data-dev="cur-' + key + '"]');
    if (el && el.textContent !== txt) el.textContent = txt;
  };
  set('gold', fmtNum(state.gold));
  set('spirit', fmtNum(state.spirit));
  set('star', fmtNum(state.stardust));
  set('seed', fmtNum(state.seed));
  set('food', String(Math.floor(state.world.res.food)));
  set('wood', String(Math.floor(state.world.res.wood)));
  set('stone', String(Math.floor(state.world.res.stone)));
  set('cult', '第 ' + state.skills.cultivation.lvl + ' 阶');
  set('xp', Math.floor(state.skills.cultivation.xp) + '');
  set('aura', fmtAuraNum(state.planet.aura));
  set('cross', String(state.planet.cross));
  set('tower', '第 ' + state.tower.current + ' 层');
  set('rift', state.rift.open ? '待修复（第 ' + state.rift.tier + ' 层）' : '已修复');
  const elems = state.elemRifts.slots || [];
  const fixedN = elems.filter(function (s) { return s.fixed; }).length;
  set('elem', fixedN + '/' + elems.length + ' 已修复');
  set('mon', riftMonAlive() ? '存在（强度 ' + riftMonTierClamp(state.riftMon.tier) + '）' : '已击败');
  const msg = c.querySelector('[data-dev="msg"]');
  if (msg && DEV.msg && msg.textContent !== DEV.msg) {
    msg.textContent = DEV.msg;
    msg.className = 'devmsg ' + (DEV.msgType || 'info');
  }
}

function updateSettingsMsg() {
  const c = $('#content');
  if (!c) return;
  const msg = c.querySelector('[data-set="msg"]');
  if (!msg) return;
  if (msg.textContent !== DEV.msg) msg.textContent = DEV.msg;
  const cls = 'setmsg ' + (DEV.msgType || 'info');
  if (msg.className !== cls) msg.className = cls;
}

/* ================================================================= 右栏 */
function renderCharacter() {
  const st = calcStats();
  const r = realmInfo(state.skills.cultivation.lvl);

  const foodOpts = ['<option value="auto"' + (state.ui.eatFood === 'auto' ? ' selected' : '') + '>自动（回复最高）</option>'];
  Object.keys(state.inv).forEach(function (id) {
    const it = ITEMS[id];
    if (!it || it.type !== 'food' || state.inv[id] <= 0) return;
    /* 不带数量：数量变化会让整张角色卡重绘，干扰下拉框/复选框操作 */
    foodOpts.push('<option value="' + id + '"' + (state.ui.eatFood === id ? ' selected' : '') + '>' + it.icon + ' ' + it.name + '</option>');
  });
  const ratios = [[0.25, '25%'], [0.35, '35%'], [0.5, '50%'], [0.65, '65%']];
  const ratioOpts = ratios.map(function (p) {
    return '<option value="' + p[0] + '"' + (Math.abs(state.ui.eatRatio - p[0]) < 0.01 ? ' selected' : '') + '>' + p[1] + '</option>';
  }).join('');

  setHTML('#charCard',
    '<h3>角色</h3>' +
    '<div class="statline">境界 <b>' + r.full + '</b> · 悟性 <b>' + state.insight + '</b>（修炼 +' + state.insight + '% / 突破 +' + state.insight + '%）</div>' +
    '<div class="statline muted">灵根五行：' +
    WUXING.map(function (w) { return w.icon + w.name + '·' + SKILLS[w.skill].name + ' Lv.' + state.skills[w.skill].lvl; }).join('　') + '</div>' +
    '<div class="statline">生命上限 ' + st.hp + ' · 伤害 ' + st.atkMin + '~' + st.atkMax +
    ' · 命中 ' + st.hit + ' · 闪避 ' + st.ev + ' · 减伤 ' + Math.round(st.dr * 100) + '%</div>' +
    '<div class="aeconfig">' +
    '<label class="toggle"><input type="checkbox" id="autoEat"' + (state.ui.autoEat ? ' checked' : '') + '><span>自动进食</span></label>' +
    '<select id="eatFood" class="sel">' + foodOpts.join('') + '</select>' +
    '<select id="eatRatio" class="sel">' + ratioOpts + '</select>' +
    '</div>' +
    '<div class="statline muted">低于阈值且战斗中自动食用所选食物，不占用动作槽。</div>');
}

function renderEquip() {
  let html = '';
  EQUIP_SLOTS.forEach(function (sl) {
    const id = state.equip[sl.id];
    if (id) {
      const it = ITEMS[id];
      const stats = [];
      if (it.atk) stats.push('攻+' + it.atk);
      if (it.def) stats.push('防+' + it.def);
      if (it.hp) stats.push('命+' + it.hp);
      if (it.hit) stats.push('中+' + it.hit);
      if (it.ev) stats.push('闪+' + it.ev);
      html += '<div class="slot filled"><span class="sicon">' + it.icon + '</span>' +
        '<span class="slabel">' + sl.name + '</span>' +
        '<span class="sitem">' + it.name + '</span>' +
        '<span class="sstat">' + stats.join(' ') + '</span>' +
        '<button class="mini" data-act="unequip" data-id="' + sl.id + '">卸下</button></div>';
    } else {
      html += '<div class="slot"><span class="sicon">➖</span>' +
        '<span class="slabel">' + sl.name + '</span>' +
        '<span class="sitem" style="color:var(--muted)">空</span></div>';
    }
  });
  setHTML('#equipList', html);
}

const INV_FILTERS = [['all', '全部'], ['material', '材料'], ['food', '食物'], ['pill', '丹药'], ['equip', '装备']];

/* 数量预设（使用 / 出售共用同一数值） */
const QTY_PRESETS = [[1, '×1'], [5, '×5'], [10, '×10'], [25, '×25'], [100, '×100'], [-1, '全部']];
/* 预设 + 自定义输入框；label 随模式变化（使用数量 / 出售数量） */
function qtyBar(label, compact) {
  const raw = state.ui.itemQty;
  return '<div class="sellqtybar' + (compact ? ' compact' : '') + '"><span class="qlabel">' + label + '</span>' +
    QTY_PRESETS.map(function (p) {
      const on = raw === p[0] ? ' on' : '';
      return '<button class="chip' + on + '" data-act="setqty" data-qty="' + p[0] + '">' + p[1] + '</button>';
    }).join('') +
    '<input class="qtyinput" type="number" min="1" max="9999" step="1" data-qtyinput' +
    ' value="' + (raw === -1 ? 1 : raw) + '" title="自定义数量（1–9999）">' +
    '</div>';
}
/* 数量文案：-1 显示“全部”，否则按实际持有量取小 */
function qtyText(have) {
  return state.ui.itemQty === -1 ? '全部' : '×' + Math.min(state.ui.itemQty, have);
}
/* 设置数量（供按钮与输入框共用）：1–9999，或 -1 表示全部 */
function setItemQty(v) {
  const n = Math.floor(Number(v));
  state.ui.itemQty = (n === -1 || n >= 1) ? (n === -1 ? -1 : Math.min(n, 9999)) : 1;
  return state.ui.itemQty;
}

/* 当前打开的物品弹层：记录物品与锚点位置，数量变化时就地刷新 */
let popItem = null, popRect = null;
function refreshInvPopover() {
  if (!popItem) return;
  const r = popRect;
  showInvPopover(popItem, { getBoundingClientRect: function () { return r; } });
}

/* 背包面板：梅尔沃式图标网格 + 筛选 + 出售模式（标签页形式，与技能面板一致） */
function renderBag() {
  const filt = state.ui.invFilter || 'all';
  let ids = Object.keys(state.inv).filter(function (id) { return state.inv[id] > 0 && ITEMS[id]; });
  if (filt !== 'all') ids = ids.filter(function (id) { return ITEMS[id].type === filt; });
  ids.sort(function (a, b) { return (ITEMS[a].value || 0) - (ITEMS[b].value || 0); });

  let html = '<div class="phead"><h2>🎒 背包</h2>' +
    '<span class="pdesc">容量 <span data-invcount>' + invSlotsUsed() + ' / ' + CONFIG.INV_SLOTS + '</span>' +
    ' · 点击物品查看操作，背包满时产出会原地等待</span></div>';

  /* 筛选 chips + 出售模式开关 */
  const sellTip = state.ui.invSellMode
    ? '出售模式：点击物品后在面板中按所选数量出售（' + qtyText(9999) + '）'
    : '普通模式：点击物品查看 / 使用';
  html += '<div class="bagbar"><span class="filterbar">' +
    INV_FILTERS.map(function (f) {
      const on = state.ui.invFilter === f[0] ? ' on' : '';
      return '<button class="chip' + on + '" data-act="filter" data-id="' + f[0] + '">' + f[1] + '</button>';
    }).join('') + '</span>' +
    '<button class="chip sell' + (state.ui.invSellMode ? ' on' : '') + '" data-act="togglesell" title="' + sellTip + '">💠 出售模式</button></div>';

  /* 数量选择（梅尔沃式）：出售模式按此数量出售，普通模式按此数量使用 */
  html += qtyBar(state.ui.invSellMode ? '出售数量' : '使用数量');

  if (!ids.length) {
    html += '<div class="empty">此处空无一物。</div>';
    hideInvPopover();
    return html;
  }

  /* 数量用 data-qty 占位节点，由 updateInvQty 增量刷新 */
  const sell = state.ui.invSellMode;
  const tip = sell ? '点击查看 / 出售 ' + qtyText(9999) : '点击查看 / 使用';
  html += '<div class="invgrid" id="invList">';
  ids.forEach(function (id) {
    const it = ITEMS[id];
    html +=
      '<div class="islot' + (sell ? ' sellmode' : '') + '"' +
      ' data-act="invslot" data-id="' + id + '"' +
      ' title="' + esc(it.name + ' · ' + tip + ' · ' + it.desc) + '">' +
      '<span class="iico">' + it.icon + '</span>' +
      '<span class="iqty" data-qty="' + id + '">' + invCount(id) + '</span>' +
      '</div>';
  });
  html += '</div>';
  return html;
}

/* 弹出物品操作菜单（梅尔沃式右键菜单的左击替代） */
function showInvPopover(id, anchorEl) {
  const it = ITEMS[id];
  if (!it) return;
  const pop = $('#invPopover');
  if (!pop) return;

  let actBtns = '';
  const have = invCount(id);
  const q = state.ui.itemQty === -1 ? have : Math.min(state.ui.itemQty, have);
  const bySell = state.ui.invSellMode;
  /* 主操作：普通模式为「使用」（食用 / 服用 / 装备），出售模式为「出售」 */
  const useBtn = function (act, label) {
    const txt = q <= 1 ? label : label + ' ' + (state.ui.itemQty === -1 ? '全部(' + q + ')' : '×' + q);
    return '<button class="mini' + (bySell ? '' : ' gold') + '" data-act="' + act + '" data-id="' + id +
      '" data-qty="' + state.ui.itemQty + '">' + txt + '</button>';
  };
  if (it.type === 'food') actBtns += useBtn('eat', '食用');
  if (it.type === 'pill') actBtns += useBtn('use', it.use === 'break' ? '使用' : '服用');
  if (it.type === 'equip') actBtns += useBtn('equip', '装备');

  const sp = sellPrice(id);
  pop.innerHTML =
    '<div class="phead2"><b>' + it.icon + ' ' + it.name + '</b>' +
    '<span class="pqty">×' + have + '</span></div>' +
    '<div class="pdesc2">' + esc(it.desc) + '</div>' +
    '<div class="pval">出售价 💠 ' + sp + ' / 个</div>' +
    qtyBar(bySell ? '出售数量' : '使用数量', true) +
    '<div class="pacts">' + actBtns +
    '<button class="mini' + (bySell ? ' gold' : '') + '" data-act="sell" data-id="' + id + '" data-qty="' + state.ui.itemQty + '">出售 ' +
    (state.ui.itemQty === -1 ? '全部' : '×' + q) + ' · 💠 ' + (sp * q) + '</button>' +
    (state.ui.itemQty === -1 ? '' : '<button class="mini" data-act="sellall" data-id="' + id + '">全部出售 · 💠 ' + (sp * have) + '</button>') +
    '<button class="mini ghost" data-act="closepop">关闭</button></div>';

  pop.classList.remove('hidden');
  popItem = id;

  /* 定位到锚点附近，避免超出视口 */
  const r = anchorEl.getBoundingClientRect();
  popRect = r;
  let left = r.right + 8;
  let top = r.top;
  const pw = 230, ph = pop.offsetHeight;
  if (left + pw > window.innerWidth - 8) left = r.left - pw - 8;
  if (top + ph > window.innerHeight - 8) top = window.innerHeight - ph - 8;
  if (top < 8) top = 8;
  pop.style.left = left + 'px';
  pop.style.top = top + 'px';
}

function hideInvPopover() {
  popItem = null;
  popRect = null;
  const pop = $('#invPopover');
  if (pop) pop.classList.add('hidden');
}

function updateInvQty() {
  /* 容量计数（背包页标题 + 侧栏背包按钮） */
  const cnt = invSlotsUsed() + ' / ' + CONFIG.INV_SLOTS;
  const cc = document.querySelectorAll('[data-invcount]');
  for (let k = 0; k < cc.length; k++) setText(cc[k], cnt);

  const list = $('#invList');
  if (!list) return;
  const els = list.querySelectorAll('[data-qty]');
  for (let i = 0; i < els.length; i++) {
    const id = els[i].dataset.qty;
    const txt = String(invCount(id));
    if (els[i].textContent !== txt) els[i].textContent = txt;
  }
  /* 数量归零的格子移除 */
  const slots = list.querySelectorAll('.islot');
  for (let j = 0; j < slots.length; j++) {
    const sid = slots[j].dataset.id;
    if (invCount(sid) <= 0) slots[j].remove();
  }
}

function updateMatNeeds() {
  const els = document.querySelectorAll('[data-mat]');
  for (let i = 0; i < els.length; i++) {
    const el = els[i];
    const id = el.dataset.mat;
    const req = Number(el.dataset.req) || 1;
    const have = invCount(id);
    const b = el.querySelector('.mhave');
    if (b && b.textContent !== String(have)) b.textContent = String(have);
    const miss = have < req;
    if (el.classList.contains('miss') !== miss) el.classList.toggle('miss', miss);
  }
}

/* 把文本写进节点（内容相同则不动，避免无谓的重排） */
function setText(el, txt) { if (el && el.textContent !== txt) el.textContent = txt; }
function setOk(el, ok) {
  if (!el) return;
  if (el.classList.contains('ok') !== ok) { el.classList.toggle('ok', ok); el.classList.toggle('no', !ok); }
}

/* 经验 / 修为 / 突破条件的数值：增量刷新。
 * 这些数字每 tick 都在涨，若留在 HTML 里就会让面板持续重建、hover 丢失。 */
function updateXpText() {
  const c = $('#content');
  if (!c) return;

  /* 技能面板标题下的经验条文字 */
  const xps = c.querySelectorAll('[data-xp]');
  for (let i = 0; i < xps.length; i++) {
    const id = xps[i].dataset.xp;
    const li = levelInfo(id);
    const label = (id === 'cultivation') ? '修为' : '经验';
    setText(xps[i], li.max ? '已臻圆满' : (label + ' ' + fmtNum(li.xp) + ' / ' + fmtNum(li.need)));
  }

  /* 境界卡内的修为 */
  const cr = c.querySelector('[data-cultxp]');
  if (cr) {
    const li = levelInfo('cultivation');
    setText(cr, '修为 ' + fmtNum(li.xp) + ' / ' + (li.max ? '—' : fmtNum(li.need)));
  }

  /* 突破条件：修为 / 丹药 / 灵石 */
  const bx = c.querySelector('[data-breakxp]');
  if (bx) {
    const bp = breakPreview();
    const need = Number(bx.dataset.need) || 0;
    setText(bx, '修为 ' + fmtNum(bp.xp) + ' / ' + fmtNum(need));
    setOk(bx, bp.xpOk);
  }
  const bpill = c.querySelector('[data-breakpill]');
  if (bpill) {
    const id = bpill.dataset.breakpill;
    const have = invCount(id);
    setText(bpill, itemIcon(id) + itemName(id) + ' ' + have + ' / 1');
    setOk(bpill, have >= 1);
  }
  const bgold = c.querySelector('[data-breakgold]');
  if (bgold) {
    const need = Number(bgold.dataset.need) || 0;
    setText(bgold, '💠 灵石 ' + fmtNum(state.gold) + ' / ' + fmtNum(need));
    setOk(bgold, state.gold >= need);
  }
}

/* 经验条 / 精通条 / 境界条：宽度增量刷新。
 * 这些宽度每 tick 都在变，但 setHTML 的签名已剔除 width，
 * 若不在这里主动更新，进度条就会"冻住"不再前进。 */
function updateXpBars() {
  const c = $('#content');
  if (!c) return;
  const xbs = c.querySelectorAll('[data-xpbar]');
  for (let i = 0; i < xbs.length; i++) {
    xbs[i].style.width = (levelInfo(xbs[i].dataset.xpbar).pct * 100).toFixed(1) + '%';
  }
  const mbs = c.querySelectorAll('[data-mastery]');
  for (let i = 0; i < mbs.length; i++) {
    const mi = masteryInfo(mbs[i].dataset.mastery);
    mbs[i].style.width = (mi.max ? 100 : mi.pct * 100).toFixed(1) + '%';
  }
  /* 精通等级与效果文本（升级后即时更新） */
  const mls = c.querySelectorAll('[data-mlvl]');
  for (let i = 0; i < mls.length; i++) {
    setText(mls[i], String(masteryOf(mls[i].dataset.mlvl).lvl));
  }
  const mfx = c.querySelectorAll('[data-mfx]');
  for (let i = 0; i < mfx.length; i++) {
    setText(mfx[i], masteryFxText(mfx[i].dataset.mfx));
  }
  const rb = c.querySelector('[data-realmbar]');
  if (rb) rb.style.width = (levelInfo('cultivation').pct * 100).toFixed(1) + '%';
}

function renderLog() {
  if (!state.log.length) { setHTML('#logList', '<div class="empty">尚无见闻。</div>'); return; }
  let html = '';
  state.log.forEach(function (l) {
    html += '<div class="logline ' + l.cls + '"><span class="lgt">' + fmtClock(l.t) + '</span>' + esc(l.text) + '</div>';
  });
  setHTML('#logList', html);
}

function renderRight() {
  renderCharacter();
  renderEquip();
  renderLog();
}

/* ================================================================= 总渲染 */
function renderAll() {
  if (!state) return;
  renderTop();
  renderSidebar();
  renderContent();
  renderRight();
}

/* ------------------------------------------------------ 高频：只更进度条 */
function updateBars() {
  if (!state) return;

  const hpPct = Math.max(0, Math.min(100, state.hp / maxHp() * 100));
  const hf = $('#hpFill');
  if (hf) hf.style.width = hpPct.toFixed(1) + '%';
  const ht = $('#hpText');
  if (ht) ht.textContent = Math.max(0, Math.floor(state.hp)) + ' / ' + maxHp();

  const p = currentProgress();

  /* 侧栏：仅当前动作所属技能显示进度 */
  SKILL_ORDER.forEach(function (id) {
    const el = document.querySelector('[data-bar="' + id + '"]');
    if (!el) return;
    const show = (p && p.skill === id && id !== 'combat') ? p.pct : 0;
    el.style.width = (show * 100).toFixed(1) + '%';
  });

  /* 中间当前动作条 */
  const ab = document.querySelector('[data-bar="active"]');
  if (ab) ab.style.width = ((p ? p.pct : 0) * 100).toFixed(1) + '%';

  /* 当前进度数值：给进度条补上“最小值/当前值”，避免只有百分比看不出起点 */
  const an = document.querySelector('[data-bar="actnum"]');
  if (an) {
    if (!p) an.textContent = '';
    else if (isFinite(p.cur) && isFinite(p.need) && p.need > 0) {
      an.textContent = p.cur.toFixed(2) + ' / ' + p.need.toFixed(2) + ' 秒 · ' + (p.pct * 100).toFixed(1) + '%';
    } else {
      an.textContent = (p.pct * 100).toFixed(1) + '%';
    }
  }

  /* 数量类信息增量刷新，避免重建可点击行 */
  updateInvQty();
  updateMatNeeds();
  updateXpText();
  updateXpBars();
  updateFormState();
  updatePlotGrowth();
  updateWorldState();
  updateDynastyState();
  updateDiscipleState();
  updateTower();
  updateRift();
  updateElemRift();
  updateElemRiftMini();
  updateRiftMon();
  updateRiftMonMini();

  /* 战斗血条（对战视图） */
  const content = $('#content');
  if (state.ui.active === 'combat' && content) {
    const fills = content.querySelectorAll('.hpfill, .mfill');
    const foe = state.skills.combat.target;
    if (fills.length === 2) {
      fills[0].style.width = hpPct.toFixed(1) + '%';
      fills[1].style.width = foe ? Math.max(0, foe.hp / foe.maxHp * 100).toFixed(1) + '%' : '0%';
    }
    const nums = content.querySelectorAll('.hpnum');
    if (nums.length === 2) {
      const meTxt = Math.max(0, Math.floor(state.hp)) + ' / ' + maxHp();
      if (nums[0].textContent !== meTxt) nums[0].textContent = meTxt;
      const foeTxt = foe ? Math.max(0, Math.ceil(foe.hp)) + ' / ' + foe.maxHp : '—';
      if (nums[1].textContent !== foeTxt) nums[1].textContent = foeTxt;
    }
  }
}

/* ================================================================== 提示框 */
let toastTimer = null;

function showToast(html, sticky) {
  const el = $('#toast');
  el.innerHTML = html + '<div class="tacts"><button class="btn ghost small" data-act="closetoast">知道了</button></div>';
  el.classList.remove('hidden');
  if (toastTimer) clearTimeout(toastTimer);
  if (!sticky) toastTimer = setTimeout(hideToast, 15000);
}

function hideToast() {
  $('#toast').classList.add('hidden');
  if (toastTimer) { clearTimeout(toastTimer); toastTimer = null; }
}

/* 离线收益报告 */
function renderOfflineReport(rep) {
  const mins = Math.floor(rep.seconds / 60);
  const durTxt = mins >= 60 ? Math.floor(mins / 60) + ' 小时 ' + (mins % 60) + ' 分' : mins + ' 分钟';

  let lines = '<div class="tline">离线时长：<b>' + durTxt + '</b>' + (rep.truncated ? '（收益按上限 ' + CONFIG.OFFLINE_CAP_H + ' 小时结算）' : '') + '</div>';
  lines += '<div class="tline">获得灵石 <b>' + fmtNum(rep.gold) + '</b> · 灵力 <b>' + fmtNum(rep.spirit) + '</b>' +
    (rep.stardust > 0 ? ' · 星砂 <b>' + fmtNum(rep.stardust) + '</b>' : '') +
    ' · 击杀 <b>' + rep.kills + '</b> 只妖兽</div>';

  if (rep.items.length) {
    lines += '<div class="tline">收获：' + rep.items.slice(0, 12).map(function (i) {
      return itemIcon(i.id) + itemName(i.id) + ' ×' + i.qty;
    }).join('、') + '</div>';
  }
  if (rep.levels.length) {
    lines += '<div class="tline">等级/境界提升：' + rep.levels.map(function (l) {
      return l.icon + ' ' + l.name + ' ' + l.from + ' → <b>' + l.to + '</b>';
    }).join('、') + '</div>';
  }
  if (rep.breaks > 0) lines += '<div class="tline">闭关期间突破成功 <b>' + rep.breaks + '</b> 次。</div>';
  if (rep.deaths > 0) lines += '<div class="tline" style="color:var(--red)">被击败 ' + rep.deaths + ' 次，注意备好食物或提升境界。</div>';

  showToast('<h4>🌙 闭关归来 · 离线结算</h4>' + lines, true);
}

