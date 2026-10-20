'use strict';

/* =========================================================================
 * 仙途挂机 · UI 层
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
  if (n >= 1000000) return (n / 1000000).toFixed(2) + 'M';
  if (n >= 10000) return (n / 1000).toFixed(1) + 'k';
  return String(Math.floor(n));
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
  return {
    skill: act.skill, name: def.name, icon: def.icon,
    pct: state.actionWaiting ? 1 : Math.min(1, state.actionTimer / t),
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

  /* 其余技能（跳过 cultivation / combat，已在上面单独渲染） */
  SKILL_ORDER.forEach(function (id) {
    if (id === 'cultivation' || id === 'combat') return;
    const sk = SKILLS[id];
    const s = state.skills[id];
    const on = state.ui.active === id ? ' on' : '';
    const busy = (state.action && state.action.skill === id) ? '<span class="dot"></span>' : '';
    let lvlTxt = 'Lv.' + s.lvl;
    html +=
      '<button class="skillbtn' + on + '" data-act="select" data-skill="' + id + '">' +
      '<span class="sico">' + sk.icon + '</span>' +
      '<span class="sinfo"><span class="sname">' + sk.name + '</span><br>' +
      '<span class="slvl">' + lvlTxt + busy + '</span></span>' +
      '<span class="sbar" data-bar="' + id + '"></span>' +
      '</button>';
  });

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

/* 精通小条 */
function masteryHTML(id) {
  const mi = masteryInfo(id);
  const pct = mi.max ? 100 : mi.pct * 100;
  return '<span class="mline">精通 <b>Lv.' + mi.lvl + '</b>' +
    '<i class="mbar"><b data-mastery="' + id + '" style="width:' + pct.toFixed(1) + '%"></b></i></span>';
}

/* 采集 / 修炼动作列表 */
function gatherEntries(list, skillId) {
  const s = state.skills[skillId];
  let html = '<div class="grid">';
  list.forEach(function (a) {
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

/* 配方列表（带材料检查） */
function recipeEntries(list, skillId) {
  let html = '<div class="grid">';
  list.forEach(function (r) {
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

/* 炼器面板 */
function renderCrafting() {
  let html = '';
  [['smelt', '熔炼 · 矿石转化'], ['forge', '锻造 · 法宝护具']].forEach(function (pair) {
    const list = RECIPES.crafting.filter(function (r) { return r.cat === pair[0]; });
    html += '<div class="secttl">' + pair[1] + '</div>' + recipeEntries(list, 'crafting');
  });
  return html;
}

/* 炼丹面板：采药 + 丹方 */
function renderAlchemy() {
  let html = '';
  html += '<div class="secttl">采药 · 灵草药材</div>' + gatherEntries(ACTIONS.alchemy, 'alchemy');
  const pills = RECIPES.alchemy.filter(function (r) { return r.cat === 'pill'; });
  html += '<div class="secttl">丹方 · 炼制丹药</div>' + recipeEntries(pills, 'alchemy');
  return html;
}

/* 修炼面板：境界 + 突破 */
function renderCultivation() {
  const s = state.skills.cultivation;
  const r = realmInfo(s.lvl);
  const root = ROOTS[state.root];
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
    ' · 灵根 ' + root.icon + root.name + '（修炼 ×' + root.speed + '，突破 ' + (root.breakBonus >= 0 ? '+' : '') + Math.round(root.breakBonus * 100) + '%）</div>' +
    '</div></div>';

  /* 突破区 */
  html += '<div class="secttl">冲击境界</div>';
  if (bp.max) {
    html += '<div class="breakbox"><div class="btitle">已臻炼虚圆满</div><div class="bnote">仙途至此，再无瓶颈。可继续打坐以精纯修为。</div></div>';
  } else {
    /* 三项条件的实时数值同样用占位节点，避免每次 tick 重建突破区 */
    const rows = [];
    rows.push('<span class="' + (bp.xpOk ? 'ok' : 'no') + '" data-breakxp data-need="' + bp.need + '"></span>');
    if (bp.pill) rows.push('<span class="' + (bp.pillOk ? 'ok' : 'no') + '" data-breakpill="' + bp.pill + '"></span>');
    if (bp.gold > 0) rows.push('<span class="' + (bp.goldOk ? 'ok' : 'no') + '" data-breakgold data-need="' + bp.gold + '"></span>');

    const canBreak = bp.xpOk && bp.pillOk && bp.goldOk;
    html += '<div class="breakbox' + (canBreak ? ' ready' : '') + '">' +
      '<div class="btitle">下一境界：<b>' + bp.next.full + '</b>' + (bp.boundary ? '<span class="etag warn">跨大境界</span>' : '') + '</div>' +
      '<div class="reqs">' + rows.join('') + '</div>' +
      '<div class="bnote">突破成功率 <b>' + Math.round(bp.rate * 100) + '%</b>（基础 ' + Math.round((bp.rate - root.breakBonus) * 100) + '% + 资质 ' + (root.breakBonus >= 0 ? '+' : '') + Math.round(root.breakBonus * 100) + '%）。失败将损失 ' + Math.round(CONFIG.BREAK_FAIL_LOSS * 100) + '% 修为。</div>' +
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
  let html = '';

  html += '<div class="secttl">当前对战</div>';
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
  MONSTERS.forEach(function (m) {
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
  html += '<div class="shopnote">在背包页开启「出售模式」，点击物品即可快速出售；或点击物品查看详情后选择「出售 ×1 / 全部出售」。出售价为物品价值的 ' + Math.round(CONFIG.SELL_RATIO * 100) + '%。</div>';
  return html;
}

/* 阵法面板：观星台 + 星砂 + 阵纹点亮（玩法参考《梅尔沃放置》的观星） */
function renderFormation() {
  const s = state.skills.formation;

  let html = '<div class="sdbar"><span class="sdico">💫</span>' +
    '<span class="sdname">星砂</span><b class="sdval" data-sd></b>' +
    '<span class="sdnote">观星推演所得 · 用于点亮阵纹 · 不占背包</span></div>';

  html += '<div class="secttl">观星台 · 推演天机</div>' + gatherEntries(ACTIONS.formation || [], 'formation');

  html += '<div class="secttl">布阵 · 阵纹加持</div>';
  html += '<div class="formgrid">';
  FORMATIONS.forEach(function (f) {
    const locked = s.lvl < f.req;
    const st = formState(f.id);
    html +=
      '<div class="formcard' + (locked ? ' locked' : '') + '" style="--rc:' + f.color + '">' +
      '<div class="fhead"><span class="fico">' + f.icon + '</span>' +
      '<span class="fmain"><span class="fname">' + f.name + '</span>' +
      '<span class="fdesc">' + f.desc + '</span></span>' +
      (locked ? '<span class="etag warn">需 Lv.' + f.req + '</span>' : '') +
      '</div>';

    f.mods.forEach(function (m, i) {
      const lvl = st.levels[i] || 0;
      const maxed = lvl >= m.max;
      const cost = formCost(f, i, lvl);
      /* 等级 / 当前加成 / 消耗只在点亮时变化，可安全写进 HTML；
         唯有"星砂够不够"随观星每 tick 改变，交给 updateFormState 增量刷新。 */
      html +=
        '<div class="fmod">' +
        '<span class="fmname">' + m.name + '<b>Lv.' + lvl + ' / ' + m.max + '</b></span>' +
        '<span class="fmval">每级 <b>' + pctText(m.per) + '</b> · 当前 <b>' + pctText(m.per * lvl) + '</b></span>' +
        (maxed
          ? '<button class="mini ghost" disabled>圆满</button>'
          : '<button class="mini fmup" data-act="formup" data-id="' + f.id + '" data-idx="' + i + '"' +
            ' data-cost="' + cost + '"' + (locked ? ' data-locked="1"' : '') + '>💫 ' + cost + '</button>') +
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
    const no = el.dataset.locked === '1' || state.stardust < (Number(el.dataset.cost) || 0);
    if (el.disabled !== no) el.disabled = no;
  }
}

/* 底部当前动作条 */
function currentBarHTML() {
  const p = currentProgress();
  const stopBtn = '<button class="btn ghost small off" data-act="stop">停止</button>';

  if (!p) {
    return '<div class="activebar"><div class="row"><span class="none">当前空闲 — 点击上方任意条目开始挂机（同一时间仅进行一件事）</span></div></div>';
  }
  const label = (p.skill === 'combat') ? '' : (SKILLS[p.skill] ? SKILLS[p.skill].name + ' · ' : '');
  const note = p.skill === 'combat' ? '自动战斗中' : (p.waiting ? '等待材料' : '进行中');
  return '<div class="activebar">' +
    '<div class="row"><span class="now">' + label + '<b>' + esc(p.name) + '</b> <span class="none">(' + note + ')</span></span>' + stopBtn + '</div>' +
    '<div class="bar"><i class="actfill" data-bar="active" style="width:' + (p.pct * 100).toFixed(1) + '%"></i></div>' +
    '</div>';
}

/* 灵植面板：地块网格 + 种子选择 + 生长进度（参考梅尔沃种植） */
function renderFarming() {
  const fs = state.skills.farming;
  const np = FARMING_PLOT_REQS.length;

  let html = '';

  /* 种子选择 chips：当前持有 + 灵植等级够的 */
  const availableSeeds = FARM_SEEDS.filter(function (s) { return fs.lvl >= s.req; });
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

function currentBarHTML() {
  const p = currentProgress();
  const stopBtn = '<button class="btn ghost small off" data-act="stop">停止</button>';

  if (!p) {
    return '<div class="activebar"><div class="row"><span class="none">当前空闲 — 点击上方任意条目开始挂机（同一时间仅进行一件事）</span></div></div>';
  }
  const label = (p.skill === 'combat') ? '' : (SKILLS[p.skill] ? SKILLS[p.skill].name + ' · ' : '');
  const note = p.skill === 'combat' ? '自动战斗中' : (p.waiting ? '等待材料' : '进行中');
  return '<div class="activebar">' +
    '<div class="row"><span class="now">' + label + '<b>' + esc(p.name) + '</b> <span class="none">(' + note + ')</span></span>' + stopBtn + '</div>' +
    '<div class="bar"><i class="actfill" data-bar="active" style="width:' + (p.pct * 100).toFixed(1) + '%"></i></div>' +
    '</div>';
}

function renderContent() {
  const id = state.ui.active;
  if (id === 'tasks') { setHTML('#content', renderTasks()); return; }
  if (id === 'shop') { setHTML('#content', renderShop()); return; }
  if (id === 'bag') { setHTML('#content', renderBag()); updateInvQty(); return; }

  let html = skillHeader(id);
  if (id === 'combat') html += renderCombat();
  else if (id === 'crafting') html += renderCrafting();
  else if (id === 'alchemy') html += renderAlchemy();
  else if (id === 'cultivation') html += renderCultivation();
  else if (id === 'formation') html += renderFormation();
  else if (id === 'farming') html += renderFarming();
  else html += '<div class="secttl">可进行的活动</div>' + gatherEntries(ACTIONS[id] || [], id);

  html += currentBarHTML();
  setHTML('#content', html);
  updateXpText();   /* 占位节点先立刻填上数值，避免空白闪一下 */
  updateXpBars();
  updateFormState();
}

/* ================================================================= 右栏 */
function renderCharacter() {
  const st = calcStats();
  const r = realmInfo(state.skills.cultivation.lvl);
  const root = ROOTS[state.root];

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
    '<div class="rootline" style="--rc:' + root.color + '"><span class="rico">' + root.icon + '</span>' +
    '<span><b>' + root.name + '</b><br><small>' + root.desc + '</small></span></div>' +
    '<div class="statline">境界 <b>' + r.full + '</b> · 修炼 ×' + root.speed + ' · 突破 ' + (root.breakBonus >= 0 ? '+' : '') + Math.round(root.breakBonus * 100) + '%</div>' +
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
  const sellTip = state.ui.invSellMode ? '出售模式：点击物品即出售 1 个' : '普通模式：点击物品查看操作';
  html += '<div class="bagbar"><span class="filterbar">' +
    INV_FILTERS.map(function (f) {
      const on = state.ui.invFilter === f[0] ? ' on' : '';
      return '<button class="chip' + on + '" data-act="filter" data-id="' + f[0] + '">' + f[1] + '</button>';
    }).join('') + '</span>' +
    '<button class="chip sell' + (state.ui.invSellMode ? ' on' : '') + '" data-act="togglesell" title="' + sellTip + '">💰 出售模式</button></div>';

  if (!ids.length) {
    html += '<div class="empty">此处空无一物。</div>';
    hideInvPopover();
    return html;
  }

  /* 数量用 data-qty 占位节点，由 updateInvQty 增量刷新 */
  html += '<div class="invgrid" id="invList">';
  ids.forEach(function (id) {
    const it = ITEMS[id];
    html +=
      '<div class="islot' + (state.ui.invSellMode ? ' sellmode' : '') + '"' +
      ' data-act="invslot" data-id="' + id + '"' +
      ' title="' + esc(it.name + ' · ' + it.desc) + '">' +
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
  if (it.type === 'food') actBtns += '<button class="mini" data-act="eat" data-id="' + id + '">食用</button>';
  if (it.type === 'pill' && it.use !== 'break') actBtns += '<button class="mini" data-act="use" data-id="' + id + '">服用</button>';
  if (it.type === 'equip') actBtns += '<button class="mini" data-act="equip" data-id="' + id + '">装备</button>';

  const sp = sellPrice(id);
  pop.innerHTML =
    '<div class="phead2"><b>' + it.icon + ' ' + it.name + '</b>' +
    '<span class="pqty">×' + invCount(id) + '</span></div>' +
    '<div class="pdesc2">' + esc(it.desc) + '</div>' +
    '<div class="pval">出售价 💠 ' + sp + ' / 个</div>' +
    '<div class="pacts">' + actBtns +
    '<button class="mini" data-act="sell" data-id="' + id + '" data-qty="1">出售 ×1</button>' +
    '<button class="mini" data-act="sellall" data-id="' + id + '">全部出售</button>' +
    '<button class="mini ghost" data-act="closepop">关闭</button></div>';

  pop.classList.remove('hidden');

  /* 定位到锚点附近，避免超出视口 */
  const r = anchorEl.getBoundingClientRect();
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
    setText(xps[i], li.max ? '已臻圆满' : (label + ' ' + Math.floor(li.xp) + ' / ' + li.need));
  }

  /* 境界卡内的修为 */
  const cr = c.querySelector('[data-cultxp]');
  if (cr) {
    const li = levelInfo('cultivation');
    setText(cr, '修为 ' + Math.floor(li.xp) + ' / ' + (li.max ? '—' : li.need));
  }

  /* 突破条件：修为 / 丹药 / 灵石 */
  const bx = c.querySelector('[data-breakxp]');
  if (bx) {
    const bp = breakPreview();
    const need = Number(bx.dataset.need) || 0;
    setText(bx, '修为 ' + Math.floor(bp.xp) + ' / ' + need);
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
    setText(bgold, '💠 灵石 ' + state.gold + ' / ' + need);
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

  /* 数量类信息增量刷新，避免重建可点击行 */
  updateInvQty();
  updateMatNeeds();
  updateXpText();
  updateXpBars();
  updateFormState();
  updatePlotGrowth();

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
