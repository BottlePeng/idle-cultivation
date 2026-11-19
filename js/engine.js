'use strict';

/* =========================================================================
 * 穿越星球 · 引擎层
 * 主循环 tick(dt) 是唯一的时间推进入口，游戏里所有变化都由此产生。
 * 好处：离线收益 = 用同样的 tick 快速跑 N 步，数值口径完全一致。
 * ========================================================================= */

let OFFLINE_MODE = false;

function clamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }

/* ------------------------------------------------------------------ 日志 */
function logMsg(text, cls) {
  if (OFFLINE_MODE) return;
  state.log.unshift({ t: Date.now(), text: text, cls: cls || '' });
  if (state.log.length > 60) state.log.length = 60;
}

/* -------------------------------------------------- 兑换码 · 测试控制台 */
/* 会话级：不写入 state，因此不会随存档导出；刷新页面后 unlocked 回到 false */
const DEV = { unlocked: false, msg: '', msgType: 'info' };

function devMsg(text, type) {
  DEV.msg = text;
  DEV.msgType = type || 'info';
  return { ok: type !== 'bad', msg: text, type: DEV.msgType };
}

function redeemCode(raw) {
  const code = String(raw == null ? '' : raw).trim();
  if (!code) return devMsg('请输入兑换码。', 'warn');
  const h = devCodeHash(code);
  let hit = null;
  REDEEM.CODES.forEach(function (c) { if (c.hash === h) hit = c; });
  if (!hit) {
    logMsg('兑换码无效。', 'warn');
    return devMsg('兑换码无效，请检查后重试。', 'bad');
  }
  if (hit.feature === 'devtools') {
    if (DEV.unlocked) return devMsg('本次运行已解锁测试控制台，无需重复兑换。', 'info');
    DEV.unlocked = true;
    logMsg('兑换成功：测试控制台已解锁（仅本次运行有效，刷新或重开后失效）。', 'good');
    return devMsg('兑换成功：测试控制台已解锁，仅本次运行有效。', 'good');
  }
  return devMsg('该兑换码暂不可用。', 'warn');
}

/* 测试控制台：所有改动都直接写 state / 复用既有函数，改完由主循环与渲染层
   自动反映；这里不注册任何定时器（不在游戏循环里持续跑）。 */
function devRun(action, vals) {
  vals = vals || [];
  const num = function (i) { const n = Number(vals[i]); return isFinite(n) ? n : NaN; };
  const who = function (i) { return String(vals[i] || '').trim(); };
  let n, id, b, lv, rep;

  if (!DEV.unlocked) return devMsg('测试控制台未解锁。', 'bad');

  switch (action) {
    case 'gold': n = num(0); if (!isFinite(n) || n < 0) return devMsg('请输入非负数值。', 'bad');
      state.gold = Math.min(1e15, Math.floor(n)); return devMsg('灵石 → ' + state.gold, 'good');
    case 'spirit': n = num(0); if (!isFinite(n) || n < 0) return devMsg('请输入非负数值。', 'bad');
      state.spirit = Math.min(1e15, Math.floor(n)); return devMsg('灵力 → ' + state.spirit, 'good');
    case 'stardust': n = num(0); if (!isFinite(n) || n < 0) return devMsg('请输入非负数值。', 'bad');
      state.stardust = Math.min(1e15, Math.floor(n)); return devMsg('星砂 → ' + state.stardust, 'good');
    case 'seed': n = num(0); if (!isFinite(n) || n < 0) return devMsg('请输入非负数值。', 'bad');
      state.seed = Math.min(1e12, Math.floor(n)); return devMsg('生命之种 → ' + state.seed, 'good');

    case 'res': {
      const k = who(0), v = num(1);
      if (['food', 'wood', 'stone'].indexOf(k) < 0) return devMsg('资源类型无效。', 'bad');
      if (!isFinite(v) || v < 0) return devMsg('请输入非负数值。', 'bad');
      const cap = worldCap(worldLevel())[k];
      state.world.res[k] = Math.min(cap, Math.floor(v));
      return devMsg(k + ' → ' + state.world.res[k] + '（上限 ' + cap + '）', 'good');
    }

    case 'cultLvl': n = num(0);
      if (!isFinite(n)) return devMsg('请输入境界阶数。', 'bad');
      state.skills.cultivation.lvl = Math.max(1, Math.min(TOTAL_STAGES, Math.floor(n)));
      state.skills.cultivation.xp = 0;
      state.hp = calcStats().hp; clampHp();
      return devMsg('境界 → 第 ' + state.skills.cultivation.lvl + ' 阶（' + realmInfo(state.skills.cultivation.lvl).full + '）', 'good');
    case 'cultXp': n = num(0); id = state.skills.cultivation.lvl;
      if (!isFinite(n) || n < 0) return devMsg('请输入非负数值。', 'bad');
      b = breakInfo(id - 1);
      state.skills.cultivation.xp = b ? Math.min(b.need, n) : 0;
      return devMsg('修为 → ' + Math.floor(state.skills.cultivation.xp) + ' / ' + (b ? b.need : 0), 'good');

    case 'skillLvl': id = who(0); n = num(1);
      if (!SKILLS[id] || id === 'cultivation') return devMsg('请选择技能。', 'bad');
      if (!isFinite(n)) return devMsg('请输入等级。', 'bad');
      state.skills[id].lvl = Math.max(1, Math.min(9999, Math.floor(n)));
      state.skills[id].xp = 0;
      if (id === 'combat') { state.hp = calcStats().hp; clampHp(); }
      return devMsg(SKILLS[id].name + ' → Lv.' + state.skills[id].lvl, 'good');
    case 'mastery': id = who(0); n = num(1);
      if (!SKILLS[id]) return devMsg('请选择技能。', 'bad');
      if (!isFinite(n)) return devMsg('请输入精通等级。', 'bad');
      state.mastery[id] = { lvl: Math.max(0, Math.min(CONFIG.MASTERY_CAP, Math.floor(n))), xp: 0 };
      return devMsg(SKILLS[id].name + ' 精通 → Lv.' + state.mastery[id].lvl, 'good');

    case 'building': id = who(0); n = num(1);
      b = findBuilding(id);
      if (!b) return devMsg('请选择建筑。', 'bad');
      if (!isFinite(n) || n < 0) return devMsg('请输入非负等级。', 'bad');
      lv = Math.min(999, Math.floor(n));
      if (lv <= 0) delete state.world.buildings[id]; else state.world.buildings[id] = lv;
      return devMsg(b.name + ' → Lv.' + lv, 'good');

    case 'aura': n = num(0);
      if (!isFinite(n) || n < 0) return devMsg('请输入非负数值。', 'bad');
      state.planet.aura = Math.min(1e12, Math.floor(n));
      return devMsg('灵气浓度 → ' + state.planet.aura, 'good');
    case 'cross': n = num(0);
      if (!isFinite(n) || n < 0) return devMsg('请输入非负数值。', 'bad');
      state.planet.cross = Math.min(10000, Math.floor(n));
      return devMsg('穿越次数 → ' + state.planet.cross, 'good');

    case 'tower': n = num(0);
      if (!isFinite(n)) return devMsg('请输入层数。', 'bad');
      state.tower.current = Math.max(1, Math.min(TOWER.MAX_FLOOR, Math.floor(n)));
      state.tower.best = Math.max(state.tower.best, state.tower.current);
      state.tower.pending = false;
      state.tower.failed = false;
      return devMsg('锁妖塔 → 第 ' + state.tower.current + ' 层（最高 ' + state.tower.best + '）', 'good');

    case 'riftReset':
      state.rift = { open: true, tier: Math.max(0, state.planet.cross) };
      return devMsg('异界裂缝已重置（第 ' + state.rift.tier + ' 层待修复）。', 'good');
    case 'riftFix':
      state.rift.open = false;
      state.rift.tier = Math.max(0, state.planet.cross);
      return devMsg('异界裂缝已标记修复。', 'good');

    case 'elemRefresh':
      state.elemRifts.slots = elemRiftSlotsRoll(state);
      state.elemRifts.next = Date.now() + ELEM_RIFT.REFRESH_MS;
      return devMsg('五行属性裂缝已整轮刷新（3 道）。', 'good');
    case 'elemFixAll':
      (state.elemRifts.slots || []).forEach(function (s) { s.fixed = true; });
      return devMsg('五行属性裂缝全部标记为已修复。', 'good');

    case 'monSpawn':
      riftMonSpawn(Date.now());
      return devMsg('裂缝怪物已重新生成（强度 ' + state.riftMon.tier + '）。', 'good');
    case 'monKill':
      if (!state.riftMon) return devMsg('裂缝怪物状态缺失。', 'bad');
      state.riftMon.alive = false;
      return devMsg('裂缝怪物已标记击败（不发放奖励）。', 'good');

    case 'ff': {
      n = num(0);
      if (!isFinite(n) || n < 3) return devMsg('快进时长至少 3 秒。', 'bad');
      rep = simulateOffline(n);
      if (!rep) return devMsg('快进失败：时长过短。', 'bad');
      return devMsg('已快进 ' + Math.round(rep.seconds) + ' 秒' + (rep.truncated ? '（受 12 小时离线上限限制）' : '') +
        '：灵石 +' + Math.floor(rep.gold) + '、灵力 +' + Math.floor(rep.spirit) + '、击杀 ' + rep.kills + '。', 'good');
    }

    case 'save':
      saveState();
      return devMsg('已手动存档。', 'good');
    case 'reload':
      window.location.reload();
      return devMsg('正在重载…', 'info');
    default:
      return devMsg('未知的测试操作。', 'warn');
  }
}

function invCount(id) { return state.inv[id] || 0; }
function invHas(id, qty) { return invCount(id) >= qty; }

/* 背包当前容量（v2.13.0）：基础 100 + 已购扩容；所有读取点统一走这里 */
function invCap() {
  const base = CONFIG.INV_SLOTS;
  const step = CONFIG.INV_SLOT_STEP;
  const max = CONFIG.INV_SLOT_MAX;
  const extra = Math.max(0, Math.floor(Number(state && state.invSlots) || 0)) * step;
  return Math.max(base, Math.min(max, base + extra));
}
/* 下一次扩容价格（指数递增，已满则返回 0） */
function invSlotPrice() {
  if (invCap() >= CONFIG.INV_SLOT_MAX) return 0;
  const n = Math.max(0, Math.floor(Number(state.invSlots) || 0));
  return Math.max(1, Math.floor(CONFIG.INV_SLOT_COST_BASE * Math.pow(CONFIG.INV_SLOT_COST_GROW, n)));
}
/* 购买一次背包扩容：扣灵石、扩容、写日志 */
function buyInvSlot() {
  if (invCap() >= CONFIG.INV_SLOT_MAX) {
    logMsg('背包已扩至上限 ' + CONFIG.INV_SLOT_MAX + ' 格。', 'info');
    return false;
  }
  const price = invSlotPrice();
  if (state.gold < price) {
    logMsg('灵石不足，扩容背包需要 💠' + price + '。', 'warn');
    return false;
  }
  state.gold -= price;
  state.invSlots = Math.floor(Number(state.invSlots) || 0) + 1;
  logMsg('背包扩容至 ' + invCap() + ' 格，花费 💠' + price + '。', 'good');
  return true;
}

/* 已占用的槽位数（不同物品种类数） */
function invSlotsUsed() {
  let n = 0;
  Object.keys(state.inv).forEach(function (id) { if (state.inv[id] > 0) n += 1; });
  return n;
}
function invFull() { return invSlotsUsed() >= invCap(); }

/* 能否再放入 qty 个 id：已有该物品则不占新槽；否则需有空槽 */
function invCanAdd(id, qty) {
  if (invCount(id) > 0) return true;
  return invSlotsUsed() < invCap();
}

function invAdd(id, qty) {
  if (!qty || qty <= 0) return false;
  if (invCount(id) <= 0 && invSlotsUsed() >= invCap()) return false;
  state.inv[id] = Math.floor(invCount(id) + qty);
  state.stats.gained[id] = (state.stats.gained[id] || 0) + Math.floor(qty);
  return true;
}

function invRemove(id, qty) {
  const left = invCount(id) - qty;
  if (left > 0) state.inv[id] = left;
  else delete state.inv[id];
}

/* 出售价 = 物品价值 × 折价比例 ×（聚宝阵加成） */
function sellPrice(id) {
  const it = ITEMS[id];
  if (!it) return 0;
  return Math.max(1, Math.floor((it.value || 0) * CONFIG.SELL_RATIO * (1 + formBonus('sell')) * (1 + worldBonus('sell'))));
}

/* 出售 qty 个物品（qty 为负数表示全部出售） */
function sellItem(id, qty) {
  const have = invCount(id);
  if (have <= 0) return false;
  const n = (qty < 0) ? have : Math.min(qty, have);
  const gain = sellPrice(id) * n;
  invRemove(id, n);
  state.gold += gain;
  if (!OFFLINE_MODE) logMsg('出售 ' + n + ' × ' + itemIcon(id) + itemName(id) + '，获得 💠 ' + gain + ' 灵石', 'gold');
  return true;
}

/* 购买：price 为单价，qty 为数量 */
function buyItem(id, qty, price) {
  if (!ITEMS[id] || qty <= 0) return false;
  const cost = price * qty;
  if (state.gold < cost) return false;
  if (!invCanAdd(id, qty)) return false;
  state.gold -= cost;
  invAdd(id, qty);
  /* 问道指引：购买行为标记（首次购买后推进教学步骤） */
  guideFlag('buy');
  if (!OFFLINE_MODE) logMsg('购入 ' + qty + ' × ' + itemIcon(id) + itemName(id) + '，花费 💠 ' + cost + ' 灵石', 'gold');
  return true;
}

/* 市集条目查询：同一 id 可能跨店上架，优先返回「已解锁」的那一条 */
function findShopEntry(id) {
  let fallback = null;
  for (let i = 0; i < SHOPS.length; i++) {
    const list = SHOPS[i].items;
    for (let j = 0; j < list.length; j++) {
      if (list[j].id !== id) continue;
      if (!list[j].unlock || condDone(list[j].unlock)) return list[j];
      if (!fallback) fallback = list[j];
    }
  }
  return fallback;
}
/* 市集购买：先校验解锁条件，再按配置价购买 */
function shopBuy(id, qty) {
  const si = findShopEntry(id);
  if (!si) return false;
  if (si.unlock && !condDone(si.unlock)) {
    logMsg('「' + itemName(id) + '」尚未解锁：需 ' + unlockText(si.unlock) + '。', 'warn');
    return false;
  }
  return buyItem(id, qty, shopPrice(si));
}
function shopBuyMax(id) {
  const si = findShopEntry(id);
  if (!si) return;
  if (si.unlock && !condDone(si.unlock)) {
    logMsg('「' + itemName(id) + '」尚未解锁：需 ' + unlockText(si.unlock) + '。', 'warn');
    return;
  }
  const price = shopPrice(si);
  const qty = price > 0 ? Math.floor(state.gold / price) : 0;
  if (qty > 0) buyItem(id, qty, price);
}

/* ------------------------------------------------------------------ 阵法 */
/* 阵法状态（阵纹等级数组），按需惰性创建 */
function formState(id) {
  let st = state.formations[id];
  if (!st) { st = { levels: [] }; state.formations[id] = st; }
  const f = findFormation(id);
  const n = f ? f.mods.length : 0;
  if (!Array.isArray(st.levels)) st.levels = [];
  while (st.levels.length < n) st.levels.push(0);
  return st;
}

/* 汇总所有阵法的同类加成（返回小数，如 0.21 表示 +21%） */
function formBonus(key) {
  let sum = 0;
  for (let i = 0; i < FORMATIONS.length; i++) {
    const f = FORMATIONS[i];
    const st = state.formations[f.id];
    if (!st || !Array.isArray(st.levels)) continue;
    for (let j = 0; j < f.mods.length; j++) {
      const m = f.mods[j];
      if (m.key !== key) continue;
      sum += Math.min(m.max, st.levels[j] || 0) * m.per;
    }
  }
  return sum;
}

/* 点亮一重阵纹：消耗星砂，提升指定阵纹等级 */
function formUpgrade(formId, modIndex) {
  const f = findFormation(formId);
  if (!f) return false;
  const idx = Math.floor(Number(modIndex));
  if (!isFinite(idx) || idx < 0 || idx >= f.mods.length) return false;

  if (state.skills.formation.lvl < f.req) {
    logMsg('阵法造诣不足，「' + f.name + '」需阵法 Lv.' + f.req + '。', 'warn');
    return false;
  }
  const m = f.mods[idx];
  const st = formState(formId);
  const lvl = st.levels[idx] || 0;
  if (lvl >= m.max) { logMsg('「' + f.name + '」· ' + m.name + ' 已臻圆满。', 'warn'); return false; }

  /* 观星精通门槛：阵纹升至 lvl+1 需对应观星精通达到 mper × (lvl+1) */
  const need = formMasteryReq(f, lvl + 1);
  const ml = masteryOf(f.obs).lvl;
  if (ml < need) {
    const gaze = findActivity('formation', f.obs) || { name: '观星' };
    logMsg('「' + f.name + '」· ' + m.name + ' 需「' + gaze.name + '」精通 Lv.' + need +
      '（当前 Lv.' + ml + '）。', 'warn');
    return false;
  }

  const cost = formCost(f, idx, lvl);
  if (state.stardust < cost) {
    logMsg('星砂不足，「' + f.name + '」· ' + m.name + ' 需 💫 ' + cost + '。', 'warn');
    return false;
  }
  state.stardust -= cost;
  st.levels[idx] = lvl + 1;
  logMsg('「' + f.name + '」· ' + m.name + ' 点亮至 Lv.' + (lvl + 1) + '。', 'good');
  return true;
}

/* ------------------------------------------------------- 世界 · 洞天营造 */
/* 建设度 = 1 + 所有建筑等级之和，用作建筑解锁门槛 */
function worldLevel(s) {
  const w = (s || state).world;
  let n = 0;
  Object.keys(w.buildings).forEach(function (id) { n += w.buildings[id] || 0; });
  return 1 + n;
}

function worldPopCap(s) {
  const w = (s || state).world;
  let cap = WORLD.BASE_POP_CAP;
  BUILDINGS.forEach(function (b) {
    if (!b.popCap) return;
    cap += b.popCap * (w.buildings[b.id] || 0);
  });
  return cap;
}

/* 人口效率：人越多越接近 100%，无人时保留基础效率 */
function worldEff() {
  const w = state.world;
  const cap = worldPopCap();
  const full = cap > 0 ? Math.min(1, w.pop / cap) : 0;
  return WORLD.EFF_BASE + (1 - WORLD.EFF_BASE) * full;
}

/* 每秒产出（含每秒粮食消耗），已乘以人口效率 */
function worldRates() {
  const w = state.world;
  const eff = worldEff();
  const out = { food: 0, wood: 0, stone: 0, gold: 0, spirit: 0, stardust: 0 };
  BUILDINGS.forEach(function (b) {
    if (!b.out) return;
    const l = w.buildings[b.id] || 0;
    if (l <= 0) return;
    Object.keys(b.out).forEach(function (k) {
      out[k] = (out[k] || 0) + b.out[k] * l * eff / 60;
    });
  });
  out.foodUse = w.pop * WORLD.FOOD_PER_POP_MIN / 60;
  return out;
}

/* 加成型建筑汇总（返回小数，如 0.12 表示 +12%） */
function worldBonus(key) {
  let sum = 0;
  BUILDINGS.forEach(function (b) {
    if (!b.bonus || b.bonus.key !== key) return;
    sum += (state.world.buildings[b.id] || 0) * b.bonus.per;
  });
  return sum;
}

/* 实际造价：营造司减免后的建造成本（至多 −60%） */
function worldBuildCost(b, lvl) {
  const c = buildCost(b, lvl);
  const d = Math.min(0.6, worldBonus('buildcost'));
  if (d <= 0) return c;
  return {
    gold: Math.floor(c.gold * (1 - d)),
    wood: Math.floor(c.wood * (1 - d)),
    stone: Math.floor(c.stone * (1 - d))
  };
}

/* 洞天每 tick 推进：资源产出、灵石/灵力/星砂入库、人口增减 */
function worldTick(dt) {
  const w = state.world;
  if (!w) return;
  const r = worldRates();
  const cap = worldCap(worldLevel());

  w.res.food = clamp(w.res.food + (r.food - r.foodUse) * dt, 0, cap.food);
  w.res.wood = Math.min(cap.wood, w.res.wood + r.wood * dt);
  w.res.stone = Math.min(cap.stone, w.res.stone + r.stone * dt);

  state.gold += r.gold * dt;
  state.spirit += r.spirit * dt;
  state.stardust += r.stardust * dt;

  /* 人口：粮食有盈余时向人口上限增长，断粮则流失 */
  const popCap = worldPopCap();
  const netFoodMin = (r.food - r.foodUse) * 60;
  if (w.res.food > 0 && netFoodMin >= 0) {
    w.pop = Math.min(popCap, w.pop + (popCap - w.pop) * WORLD.POP_GROWTH * dt);
  } else if (w.res.food <= 0 && w.pop > 0) {
    w.pop = Math.max(0, w.pop - w.pop * WORLD.POP_DECAY * dt);
  }
  if (w.pop > popCap) w.pop = Math.max(popCap, w.pop - w.pop * 0.05 * dt);
}

/* 建造 / 升级一栋建筑（瞬时操作，不占用动作槽） */
function buildBuilding(bid) {
  const b = findBuilding(bid);
  if (!b) return false;
  const w = state.world;
  const lvl = w.buildings[b.id] || 0;

  /* 境界门槛（小世界需元婴期）：未达标时拒绝建造，UI 同步置灰 */
  if (b.realmReq && state.skills.cultivation.lvl < b.realmReq) {
    logMsg('境界不足，「' + b.name + '」需 ' + (realmInfo(b.realmReq).realm || '元婴期') + '。', 'warn');
    return false;
  }
  if (worldLevel() < b.req) {
    logMsg('洞天建设度不足，「' + b.name + '」需建设度 ' + b.req + '。', 'warn');
    return false;
  }
  const c = worldBuildCost(b, lvl);
  if (state.gold < c.gold) { logMsg('灵石不足，营造「' + b.name + '」需 💠' + c.gold + '。', 'warn'); return false; }
  if (w.res.wood < c.wood) { logMsg('木材不足，营造「' + b.name + '」需 🌲' + c.wood + '。', 'warn'); return false; }
  if (w.res.stone < c.stone) { logMsg('石料不足，营造「' + b.name + '」需 ⛰️' + c.stone + '。', 'warn'); return false; }

  state.gold -= c.gold;
  w.res.wood -= c.wood;
  w.res.stone -= c.stone;
  w.buildings[b.id] = lvl + 1;
  if (b.id === 'summonhall') syncDiscipleSlots();   /* 每级 +1 上阵位 */

  logMsg(lvl === 0
    ? ((b.id === 'summonhall'
      ? '洞天新成「招贤殿」Lv.1，信徒上阵位 1 个。'
      : '洞天新成「' + b.name + '」Lv.1。'))
    : ('「' + b.name + '」升至 Lv.' + (lvl + 1) + '。'), 'good');
  return true;
}

/* ------------------------------------------------------- 洞天 · 朝代 */
/* 小世界等级决定朝代位数量；召唤与合成都只消耗生命之种，不占用动作槽 */
function smallWorldLevel() { return (state.world.buildings.smallworld || 0); }
function dynastySlots() { return smallWorldLevel() * DYNASTY.SLOTS_PER_LVL; }
function dynastyUnlocked() { return state.skills.cultivation.lvl >= DYNASTY.REALM_REQ; }
/* 可召唤的最高年代下标：0 次穿越只能召到明朝，之后每 1 次穿越解锁 1 个年代 */
function dynastyEraMax() {
  const cr = Math.max(0, Math.floor(planetCrossCount()));
  return Math.max(DYNASTY.ERA_START_MAX, Math.min(DYNASTY.ERA_MAX, cr));
}
/* 年代对应的主资源与每万人口产量；古纪（超出表长）按星砂缓慢递增，封顶 0.5 */
function dynastyEraRes(era) {
  const i = Math.max(0, Math.min(DYNASTY.ERA_MAX, Math.floor(Number(era) || 0)));
  if (i < DYNASTY_ERA_RES.length) return DYNASTY_ERA_RES[i];
  return { res: 'stardust', per: Math.min(0.5, 0.15 + 0.02 * (i - (DYNASTY_ERA_RES.length - 1))) };
}
function dynastyName(era) { return planetDynastyName(era); }

/* 单个朝代每次结算的产出：人口按「万」折算，避免放大人口后资源也放大一万倍。
   v2.9.3：皇帝 / 皇后的职位加成同时作用于粮食与该年代主资源。 */
function dynastyOutput(d) {
  const r = dynastyEraRes(d.dyn);
  const pop = Math.max(0, Number(d.pop) || 0);
  const wan = pop / DYNASTY.POP_UNIT;
  const mul = 1 + dynastyPostBonus(d);
  const out = { food: wan * DYNASTY.OUT_FOOD_PER_WAN * mul, res: r.res, amount: wan * r.per * mul, mul: mul };
  return out;
}

/* ============================================ 朝代职位（8 个岗位） */
function dynPostName(role) {
  const meta = DYNASTY.POST_META[role];
  return meta ? meta.name : role;
}
function dynPostIcon(role) {
  const meta = DYNASTY.POST_META[role];
  return meta ? meta.icon : '•';
}
/* 新建一个朝代的空职位表（固定 8 个键，值均为 null） */
function newDynPosts() {
  const p = {};
  DYNASTY.POST_ORDER.forEach(function (role) { p[role] = null; });
  return p;
}

/* 职位加成：基础 + 每品阶加成 × (品阶−1)。缺人返回 0。 */
function dynPostRoleBonus(role, inst) {
  if (!inst) return 0;
  /* 职业必须与职位一致；不一致时不给加成，避免异常存档产生隐性收益 */
  if (discProf(inst) !== role) return 0;
  const base = DYNASTY.POST_BASE[role] || 0;
  const per = DYNASTY.POST_PER_TIER[role] || 0;
  const raw = Number(inst.tier);
  const tier = isFinite(raw) ? Math.max(1, Math.min(4, Math.floor(raw))) : 1;
  return base + per * (tier - 1);
}
function dynPostBonus(d, role) {
  if (!d || !d.posts || !d.posts[role]) return 0;
  return dynPostRoleBonus(role, discInstance(d.posts[role]));
}
/* 单个朝代 8 个职位加成之和（满编神品 = 0.85） */
function dynastyPostBonus(d) {
  if (!d) return 0;
  let sum = 0;
  DYNASTY.POST_ORDER.forEach(function (role) { sum += dynPostBonus(d, role); });
  return sum;
}

/* 信徒当前担任的朝代职位：{ d, idx, role }；没有则 null */
function discDynPost(uid) {
  const list = (state.world && Array.isArray(state.world.dynasties)) ? state.world.dynasties : [];
  for (let i = 0; i < list.length; i++) {
    const posts = list[i].posts;
    if (!posts) continue;
    for (let j = 0; j < DYNASTY.POST_ORDER.length; j++) {
      const role = DYNASTY.POST_ORDER[j];
      if (posts[role] === uid) return { d: list[i], idx: i, role: role };
    }
  }
  return null;
}

/* 可上任的信徒：未驻守任务、未担任任何朝代职位；
   传入 role 时再过滤为职业匹配者（候选列表与引擎共用同一规则）。 */
function discAvailableForPost(role) {
  const want = (typeof role === 'string' && DYNASTY.POST_ORDER.indexOf(role) >= 0) ? role : '';
  return state.disciples.owned.filter(function (inst) {
    if (want && discProf(inst) !== want) return false;
    return !discAssignedTask(inst.uid) && !discDynPost(inst.uid);
  });
}

/* 上任：不可取下、不可更换；一位信徒全局只能有一个身份（任务 / 职位） */
function assignDynastyPost(idx, role, uid) {
  const d = state.world.dynasties[Math.floor(Number(idx))];
  if (!d) return false;
  if (DYNASTY.POST_ORDER.indexOf(role) < 0) return false;
  if (!d.posts) d.posts = newDynPosts();
  if (d.posts[role]) { logMsg('该职位已有人就任，不可更换。', 'warn'); return false; }
  const inst = discInstance(uid);
  if (!inst) return false;
  if (discProf(inst) !== role) {
    logMsg('「' + (findDisciple(inst.id) ? findDisciple(inst.id).name : inst.id) + '」的职业是「' +
      discProfName(inst) + '」，不能担任「' + dynPostName(role) + '」。', 'warn');
    return false;
  }
  if (discAssignedTask(uid)) { logMsg('该信徒正在驻守任务，需先在信徒面板撤下。', 'warn'); return false; }
  if (discDynPost(uid)) { logMsg('该信徒已担任其它朝代职位。', 'warn'); return false; }
  d.posts[role] = uid;
  const cat = findDisciple(inst.id);
  logMsg('「' + (cat ? cat.name : inst.id) + '」（' + discProfName(inst) + '）就任「' + dynastyName(d.dyn) + '」' +
    dynPostName(role) + '，该朝产出 +' + Math.round(dynPostRoleBonus(role, inst) * 100) + '%（不可取下）。', 'good');
  return true;
}

/* 召唤：随机年代（不超过当前可召唤上限），人口与上限取初始值 */
function summonDynasty() {
  const w = state.world;
  if (!dynastyUnlocked()) {
    logMsg('境界不足，需达到 ' + (realmInfo(DYNASTY.REALM_REQ).realm || '元婴期') + ' 才能召唤朝代生灵。', 'warn');
    return false;
  }
  if (smallWorldLevel() <= 0) {
    logMsg('尚未开辟「小世界」（洞天 · 秘境建筑），无法召唤朝代生灵。', 'warn');
    return false;
  }
  if (w.dynasties.length >= dynastySlots()) {
    logMsg('朝代位已满（' + dynastySlots() + ' 个），升级「小世界」可 +' + DYNASTY.SLOTS_PER_LVL + ' 位。', 'warn');
    return false;
  }
  if (state.seed < DYNASTY.SUMMON_SEED) {
    logMsg('生命之种不足，召唤需 🌱 ' + DYNASTY.SUMMON_SEED + '（当前 ' + Math.floor(state.seed) + '）。', 'warn');
    return false;
  }
  const max = dynastyEraMax();
  const era = randInt(0, max);
  state.seed -= DYNASTY.SUMMON_SEED;
  w.dynasties.push({ dyn: era, pop: DYNASTY.START_POP, cap: DYNASTY.BASE_CAP, posts: newDynPosts() });
  logMsg('生命之种萌发，「' + dynastyName(era) + '」生灵降世（人口 ' + fmtPop(DYNASTY.START_POP) +
    ' / ' + fmtPop(DYNASTY.BASE_CAP) + '，每 ' + (DYNASTY.TICK_SEC / 3600) + ' 小时结算一次）。', 'good');
  return true;
}

/* 合成同名朝代：目标获得被合者 50% 人口与 50% 上限；
   被合朝代随即从列表移除、腾出朝代位（空位立刻可再召唤） */
function mergeDynasty(targetIdx, srcIdx) {
  const w = state.world;
  const list = w.dynasties;
  const ti = Math.floor(Number(targetIdx));
  const si = Math.floor(Number(srcIdx));
  if (!list[ti] || !list[si]) return false;
  if (ti === si) { logMsg('合成需要两个不同的朝代。', 'warn'); return false; }
  if (list[ti].dyn !== list[si].dyn) { logMsg('只能合成同名朝代。', 'warn'); return false; }
  if (list[si].pop < DYNASTY.MERGE_MIN_POP) {
    logMsg('「' + dynastyName(list[si].dyn) + '」人口不足 ' + fmtPop(DYNASTY.MERGE_MIN_POP) + '，无法分出。', 'warn');
    return false;
  }
  if (state.seed < DYNASTY.MERGE_SEED) {
    logMsg('生命之种不足，合成需 🌱 ' + DYNASTY.MERGE_SEED + '。', 'warn');
    return false;
  }
  const src = list[si];
  const dst = list[ti];
  const srcName = dynastyName(src.dyn);
  const dstName = dynastyName(dst.dyn);
  const movePop = src.pop * DYNASTY.MERGE_POP_RATE;
  const moveCap = Math.max(DYNASTY.GROWTH_MIN, Math.ceil(src.cap * DYNASTY.MERGE_CAP_RATE));
  /* 先记录被合朝代的职位（v2.9.4 起随朝代一起永久消失） */
  const lostPosts = [];
  const lostUids = [];
  const srcPosts = src.posts || {};
  DYNASTY.POST_ORDER.forEach(function (role) {
    const uid = srcPosts[role];
    if (!uid) return;
    lostUids.push(uid);
    const inst = discInstance(uid);
    const cat = inst ? findDisciple(inst.id) : null;
    lostPosts.push((cat ? cat.name : uid) + '（' + dynPostName(role) + '）');
  });

  /* ------------------------------------------------------------------
   * v2.9.3 旧行为（释放回信徒仓库）：注释保留，可一键切回。
   * 旧逻辑不删除 state.disciples.owned 中的实例，只让职位引用随朝代对象消失，
   * 因此信徒会回到仓库、可再次任命或驻守任务。旧日志片段：
   *   (lostPosts.length ? ' 原皇帝/皇后 ' + lostPosts.join('、') +
   *     ' 已失去职位并回到信徒仓库。' : '')
   * 切回方式：注释掉下方「v2.9.4 新行为」整段，恢复上面的释放语义与旧日志即可。
   * ------------------------------------------------------------------ */
  // (v2.9.3 释放分支：不删除 owned / assign，信徒保留)

  /* v2.9.4 新行为（销毁分支）：皇帝 / 皇后随朝代一起永久消失。
     同步清理任务驻守与所有朝代职位引用，保证不留下悬空 uid；
     不退还招募费、不修改 peak（招募费仍按历史峰值计算）。
     道侣（v2.11.0）：其道侣位记录同样永久标记为亡故，对方加成消失且不可恢复。 */
  let widowed = 0;
  lostUids.forEach(function (uid) {
    const inst = discInstance(uid);
    if (inst) widowed += daoLivePartnerCount(inst);
  });
  lostUids.forEach(function (uid) {
    if (state.disciples.assign) {
      Object.keys(state.disciples.assign).forEach(function (k) {
        if (state.disciples.assign[k] === uid) delete state.disciples.assign[k];
      });
    }
    list.forEach(function (dd) {
      if (!dd.posts) return;
      DYNASTY.POST_ORDER.forEach(function (role) {
        if (dd.posts[role] === uid) dd.posts[role] = null;
      });
    });
    daoWidow(uid);
    const inst = discInstance(uid);
    if (inst) {
      const oi = state.disciples.owned.indexOf(inst);
      if (oi >= 0) state.disciples.owned.splice(oi, 1);
    }
  });

  /* 先移除被合者（dst 是对象引用，不受 splice 影响），再给目标加人口与上限 */
  list.splice(si, 1);
  dst.pop = Math.min(DYNASTY.POP_HARD_CAP, dst.pop + movePop);
  dst.cap = Math.min(DYNASTY.POP_HARD_CAP, dst.cap + moveCap);
  if (dst.pop > dst.cap) dst.pop = dst.cap;
  state.seed -= DYNASTY.MERGE_SEED;
  logMsg('「' + srcName + '」（第 ' + (si + 1) + ' 位）并入「' + dstName + '」（第 ' + (ti + 1) +
    ' 位）后消失：人口 +' + fmtPop(movePop) + '、上限 +' + fmtPop(moveCap) + '，腾出 1 个朝代位。' +
    (lostPosts.length ? ' 该朝代的 ' + lostPosts.join('、') + ' 已随朝代一起消失，无法恢复。' : '') +
    (widowed ? ' 其 ' + widowed + ' 段道侣关系随之断绝，对方道侣位永久空缺、加成消失。' : ''), 'warn');
  return true;
}

/* 每 10 分钟结算：人口增长 + 资源产出。走同一个 tick，离线结算自动覆盖 */
function dynastyTick(dt) {
  const w = state.world;
  if (!w || !Array.isArray(w.dynasties)) return;
  if (!w.dynasties.length) { w.dynAccum = 0; return; }
  if (!isFinite(w.dynAccum) || w.dynAccum < 0) w.dynAccum = 0;
  w.dynAccum += dt;
  let guard = 0;
  while (w.dynAccum >= DYNASTY.TICK_SEC && guard < 1000) {
    w.dynAccum -= DYNASTY.TICK_SEC;
    settleDynastyOnce();
    guard += 1;
  }
}

/* 一次小时结算 = SUBTICKS 个 10 分钟子步。
   子步内「先按当前人口产出、再增长」，与旧版逐 10 分钟结算的顺序完全一致，
   因此每小时产出与人口曲线都和 10 分钟口径逐位等价（对玩家只显示一次结算）。 */
function settleDynastyOnce() {
  const w = state.world;
  const cap = worldCap(worldLevel());
  let food = 0, wood = 0, stone = 0, gold = 0, stardust = 0;
  const subs = Math.max(1, Math.floor(DYNASTY.SUBTICKS) || 1);

  for (let k = 0; k < subs; k++) {
    w.dynasties.forEach(function (d) {
      const out = dynastyOutput(d);
      food += out.food;
      if (out.res === 'gold') gold += out.amount;
      else if (out.res === 'stardust') stardust += out.amount;
      else if (out.res === 'wood') wood += out.amount;
      else stone += out.amount;

      const grow = Math.max(DYNASTY.GROWTH_MIN, d.pop * DYNASTY.GROWTH_RATE);
      d.pop = Math.min(d.cap, d.pop + grow);
      if (!isFinite(d.pop) || d.pop < 0) d.pop = 0;
      if (!isFinite(d.cap) || d.cap < DYNASTY.BASE_CAP) d.cap = DYNASTY.BASE_CAP;
      if (d.cap > DYNASTY.POP_HARD_CAP) d.cap = DYNASTY.POP_HARD_CAP;
      if (d.pop > d.cap) d.pop = d.cap;
    });
  }

  w.res.food = clamp(w.res.food + food, 0, cap.food);
  w.res.wood = clamp(w.res.wood + wood, 0, cap.wood);
  w.res.stone = clamp(w.res.stone + stone, 0, cap.stone);
  if (gold > 0) state.gold += gold;
  if (stardust > 0) state.stardust = (state.stardust || 0) + stardust;
  if (!isFinite(state.gold) || state.gold < 0) state.gold = 0;
  if (!isFinite(state.stardust) || state.stardust < 0) state.stardust = 0;

  if (!OFFLINE_MODE) {
    logMsg('朝代结算：🌾 +' + Math.floor(food) + ' · 🌲 +' + Math.floor(wood) + ' · ⛰️ +' + Math.floor(stone) +
      (gold > 0 ? ' · 💠 +' + gold.toFixed(1) : '') + (stardust > 0 ? ' · 🌠 +' + stardust.toFixed(2) : '') +
      '（各朝人口已增长）', 'info');
  }
}

/* ------------------------------------------------------- 信徒（招募 · 上阵） */
function hallLevel() { return (state.world.buildings.summonhall || 0); }
function discipleUnlocked() { return hallLevel() > 0; }

/* 上阵位数：招贤殿每级 +1，未建造时为 0（此时信徒只能待在仓库） */
function discipleSlots() { return hallLevel() * DISCIPLE.SLOTS_PER_LVL; }

/* 让上阵分配与招贤殿位数一致；缩位时把超出部分的信徒退回仓库（即解除分配） */
function syncDiscipleSlots() {
  const slots = discipleSlots();
  const keys = Object.keys(state.disciples.assign);
  keys.forEach(function (k) {
    if (!TASK_ELEM[k] || !discInstance(state.disciples.assign[k])) delete state.disciples.assign[k];
  });
  const left = Object.keys(state.disciples.assign);
  while (left.length > slots) delete state.disciples.assign[left.pop()];
}

/* 信徒总容量（含上阵），由招贤殿等级决定 */
function discipleStoreCap() {
  const lv = hallLevel();
  return lv > 0 ? DISCIPLE.BASE_STORE + (lv - 1) * DISCIPLE.STORE_PER_LVL : 0;
}
function discipleTierCap() { return discipleTierByHall(hallLevel()); }
function discipleEquippedCount() { return Object.keys(state.disciples.assign).length; }
function discipleTotal() { return state.disciples.owned.length; }

/* 招募费随「历史招募峰值」递增（1.12 倍/位）
   删除信徒不会让峰值回落，避免「反复招募再删除」刷低招募价。 */
function disciplePeak() {
  const p = Number(state.disciples.peak);
  const peak = isFinite(p) && p > 0 ? Math.floor(p) : 0;
  return Math.min(999, Math.max(peak, discipleTotal()));
}
function discipleRecruitCost() {
  return Math.floor(DISCIPLE.RECRUIT_BASE * Math.pow(DISCIPLE.RECRUIT_GROW, disciplePeak()));
}

/* 信徒实例（owned 中按 uid 查找）；实例 = { uid, id, tier, prof, elems[], main, power, dao[] } */
function discInstance(uid) {
  const list = state.disciples.owned;
  for (let i = 0; i < list.length; i++) if (list[i].uid === uid) return list[i];
  return null;
}

/* ============================================ 信徒职业（v2.15.0）
 * 8 种职业与朝代职位一一对应，生成时随机且永久固定，不可更改。
 * 只有职业匹配的信徒才能担任对应职位；候选列表与引擎都会双重校验。 */
function discProf(inst) {
  const p = inst && inst.prof;
  return (typeof p === 'string' && DYNASTY.POST_ORDER.indexOf(p) >= 0) ? p : '';
}
function discProfName(inst) {
  const p = discProf(inst);
  return p ? dynPostName(p) : '未定';
}
function discProfIcon(inst) {
  const p = discProf(inst);
  return p ? dynPostIcon(p) : '•';
}
function discProfCounts() {
  const counts = {};
  DYNASTY.POST_ORDER.forEach(function (role) { counts[role] = 0; });
  const list = (state && state.disciples && Array.isArray(state.disciples.owned)) ? state.disciples.owned : [];
  list.forEach(function (inst) {
    const p = discProf(inst);
    if (p) counts[p] += 1;
  });
  return counts;
}

/* 随机职业：基础权重相等 + 缺员补正。返回 DYNASTY.POST_ORDER 中的角色 id。
   list 可选：迁移时传入待写入的 owned 数组，避免读到尚未替换的全局 state。 */
function rollProfession(list) {
  const roles = DYNASTY.POST_ORDER;
  const owned = Array.isArray(list) ? list
    : ((state && state.disciples && Array.isArray(state.disciples.owned)) ? state.disciples.owned : []);
  const counts = {};
  roles.forEach(function (role) { counts[role] = 0; });
  owned.forEach(function (inst) {
    const p = discProf(inst);
    if (p) counts[p] += 1;
  });
  const total = owned.length;
  const target = Math.floor(total / roles.length) + 1;
  const weights = [];
  let sum = 0;
  roles.forEach(function (role) {
    const deficit = Math.max(0, target - (counts[role] || 0));
    const w = DISCIPLE.PROF_BASE_WEIGHT + DISCIPLE.PROF_DEFICIT_BOOST * deficit;
    weights.push(w);
    sum += w;
  });
  let r = Math.random() * sum;
  for (let i = 0; i < roles.length; i++) {
    r -= weights[i];
    if (r <= 0) return roles[i];
  }
  return roles[roles.length - 1];
}

/* 信徒当前驻守的任务（没有则 null） */
function discAssignedTask(uid) {
  const keys = Object.keys(state.disciples.assign);
  for (let i = 0; i < keys.length; i++) {
    if (state.disciples.assign[keys[i]] === uid) return keys[i];
  }
  return null;
}

/* 单条属性强度：品质基准 ×(1 ± 20%)，保留三位小数 */
function discPowerRoll(tier) {
  const base = DISCIPLE.ELEM_POWER[tier] || DISCIPLE.ELEM_POWER[1];
  const j = DISCIPLE.POWER_JITTER;
  return Math.round(base * (1 - j + Math.random() * 2 * j) * 1000) / 1000;
}

let _discSeq = 0;
/* prof 可选：传入合法角色 id 时强制使用（仅迁移/测试），否则走缺员补正的随机职业 */
function newDiscInstance(catId, prof) {
  const d = findDisciple(catId);
  if (!d) return null;
  _discSeq += 1;
  const forced = (typeof prof === 'string' && DYNASTY.POST_ORDER.indexOf(prof) >= 0) ? prof : '';
  return {
    uid: 'dc' + _discSeq + 'x' + Math.floor(Math.random() * 1e6),
    id: d.id, tier: d.tier,
    prof: forced || rollProfession(),
    elems: DISCIPLE.ALL_ELEMS.slice(),
    main: rollDiscMain(),
    power: discPowerRoll(d.tier),
    dao: []
  };
}

/* 任务实际加成：主属性命中 → mainPower；其余四种副属性命中 → power。
   两者都作用于速度 / 经验 / 掉落，只是系数不同。
   道侣加成（v2.11.0）作为乘数同时放大两者。 */
function elemBonus(taskKey, kind) {
  const uid = state.disciples.assign[taskKey];
  if (!uid) return 0;
  const inst = discInstance(uid);
  if (!inst) return 0;
  const el = TASK_ELEM[taskKey];
  if (!el) return 0;
  if (kind !== 'speed' && kind !== 'drop' && kind !== 'xp') return 0;
  const base = el === inst.main ? discMainPower(inst.tier, inst.power) : inst.power;
  return base * (1 + discDaoBonus(inst));
}

/* 某任务是否已上阵、是否主属性命中（UI 用） */
function taskDiscInfo(taskKey) {
  const uid = state.disciples.assign[taskKey];
  if (!uid) return null;
  const inst = discInstance(uid);
  if (!inst) return null;
  const d = findDisciple(inst.id);
  const el = TASK_ELEM[taskKey];
  return {
    inst: inst, cat: d, elem: el,
    mainHit: !!(el && el === inst.main)
  };
}

/* 上阵：每个任务一个信徒位，一位信徒只能挂一个任务；总位数受招贤殿限制 */
function assignDisciple(taskKey, uid) {
  if (!TASK_ELEM[taskKey]) { logMsg('该任务不支持上阵信徒。', 'warn'); return false; }
  const inst = discInstance(uid);
  if (!inst) { logMsg('仓库中没有这位信徒。', 'warn'); return false; }
  const post = discDynPost(uid);
  if (post) {
    logMsg('该信徒正在担任「' + dynastyName(post.d.dyn) + '」' + dynPostName(post.role) +
      '，不可驻守任务。', 'warn');
    return false;
  }
  const slots = discipleSlots();
  if (!slots) { logMsg('尚未营造「招贤殿」，无上阵位。', 'warn'); return false; }
  /* 换任务时，原任务会随本信徒一起腾出，因此不计入已占用位 */
  const occupied = Object.keys(state.disciples.assign).filter(function (k) {
    return k !== taskKey && state.disciples.assign[k] !== uid;
  });
  if (!state.disciples.assign[taskKey] && occupied.length >= slots) {
    logMsg('上阵位已满（招贤殿 Lv.' + hallLevel() + ' 仅提供 ' + slots + ' 位）。', 'warn');
    return false;
  }
  /* 先从原任务上撤下，保证一位信徒只挂一个任务 */
  Object.keys(state.disciples.assign).forEach(function (k) {
    if (state.disciples.assign[k] === uid) delete state.disciples.assign[k];
  });
  state.disciples.assign[taskKey] = uid;
  const d = findDisciple(inst.id);
  const info = taskElemInfo(taskKey);
  const mainHit = TASK_ELEM[taskKey] === inst.main;
  logMsg('「' + (d ? d.name : inst.id) + '」入驻「' + (info ? info.name : '') + '」任务' +
    (mainHit ? '，命中主属性，加成全效。' : '，命中副属性，获得基础加成。'), mainHit ? 'good' : 'info');
  return true;
}

function unassignDisciple(taskKey) {
  if (!state.disciples.assign[taskKey]) return false;
  delete state.disciples.assign[taskKey];
  logMsg('已撤下「' + (SKILLS[taskKey] ? SKILLS[taskKey].name : taskKey) + '」的信徒。', 'info');
  return true;
}

/* 遣散信徒：先解除其驻守任务 / 朝代职位，再从仓库移除；招募峰值不回落（防刷价）。
   道侣关系按用户口径永久处理：对方记录标记为亡故、道侣位永久占用、加成消失且不可恢复。
   返回 true 表示已删除，false 表示 uid 不存在。 */
function removeDisciple(uid) {
  const inst = discInstance(uid);
  if (!inst) return false;
  const d = findDisciple(inst.id);
  const taskKey = discAssignedTask(uid);
  if (taskKey) delete state.disciples.assign[taskKey];
  const post = discDynPost(uid);
  if (post && post.d.posts) post.d.posts[post.role] = null;
  const widowed = daoLivePartnerCount(inst);
  daoWidow(uid);
  const idx = state.disciples.owned.indexOf(inst);
  if (idx >= 0) state.disciples.owned.splice(idx, 1);
  let extra = '';
  if (taskKey) extra += '，并撤下其在「' + (SKILLS[taskKey] ? SKILLS[taskKey].name : taskKey) + '」的驻守';
  if (post) extra += '，其「' + dynastyName(post.d.dyn) + '」' + dynPostName(post.role) + '职位随之空缺';
  if (widowed) extra += '；' + widowed + ' 位道侣的道侣位永久空缺、加成消失，不可恢复';
  logMsg('已遣散「' + (d ? d.name : inst.id) + '」（' + discElemText(inst) + '）' + extra + '。', 'info');
  return true;
}

/* 招募一位信徒：按品阶权重随机，灵石花费随历史峰值递增 */
function recruitDisciple() {
  if (!discipleUnlocked()) {
    logMsg('尚未营造「招贤殿」，无法招募信徒（世界 · 秘境）。', 'warn');
    return false;
  }
  const cap = discipleStoreCap();
  if (discipleTotal() >= cap) {
    logMsg('信徒仓库已满（' + discipleTotal() + ' / ' + cap + '），请先升级招贤殿。', 'warn');
    return false;
  }
  const cost = discipleRecruitCost();
  if (state.gold < cost) {
    logMsg('招募需 💠' + cost + ' 灵石，当前不足。', 'warn');
    return false;
  }

  const maxTier = discipleTierCap();
  const pool = DISCIPLES.filter(function (d) { return d.tier <= maxTier; });
  let total = 0;
  pool.forEach(function (d) { total += DISCIPLE_TIERS[d.tier].weight; });
  let r = Math.random() * total;
  let picked = pool[pool.length - 1];
  for (let i = 0; i < pool.length; i++) {
    r -= DISCIPLE_TIERS[pool[i].tier].weight;
    if (r <= 0) { picked = pool[i]; break; }
  }

  state.gold -= cost;
  const inst = newDiscInstance(picked.id);
  state.disciples.owned.push(inst);
  /* 峰值只增不减：删除信徒不会让后续招募更便宜 */
  state.disciples.peak = Math.min(999, Math.max(disciplePeak(), state.disciples.owned.length));
  const t = DISCIPLE_TIERS[picked.tier];
  logMsg('「' + picked.name + '」（' + t.name + ' · ' + discProfName(inst) + ' · ' + discElemText(inst) +
    '）慕名而来，已入信徒仓库。', 'good');
  return true;
}

/* 信徒五行文案，如「主·木 15.6% / 副 6.5%」 */
function discElemText(inst) {
  const e = elemInfo(inst.main);
  return '主·' + (e ? e.name : inst.main) + ' ' + Math.round(discMainPower(inst.tier, inst.power) * 1000) / 10 +
    '% / 副 ' + Math.round(inst.power * 1000) / 10 + '%';
}

/* ------------------------------------------------------- 道侣（v2.12.0）
 * 化道式单向绑定：A 纳 B 时，B 被消耗、从仓库永久移除，A 的记录永久保留并继续吃加成；
 * A 最多 7 位道侣，B 的道侣位容量不再参与判定。
 * 记录 { uid, id, tier, main, power, state } 存于 A 实例的 dao[]：
 *   state = 'spent' 已化道（加成永久生效） / 'dead' 亡故（无加成） / 'alive' 旧档对称绑定。
 * 加成作为乘数，仅放大该信徒的任务加成（速度 / 经验 / 掉落），
 * 与朝代职位加成互不干扰，也不改变洞天产出。 */
function daoName(inst) {
  if (!inst) return '（已消失）';
  const cat = findDisciple(inst.id);
  return cat ? cat.name : inst.id;
}

/* 记录对应的加成来源：已化道用快照；旧档存活记录用仓库里的实时实例 */
function daoRecordSource(rec) {
  if (!rec) return null;
  if (rec.state === 'spent') {
    return { tier: rec.tier, main: rec.main, power: rec.power };
  }
  return discInstance(rec.uid);
}

/* 单段加成：my 本人，other 为对方实例或化道快照 */
function daoPairBonus(my, other) {
  if (!my || !other) return 0;
  const pw = Number(other.power);
  if (!isFinite(pw) || pw <= 0 || !other.main) return 0;
  let v = DAOLV.RATE * discMainPower(other.tier, pw);
  if (other.main === my.main) v += DAOLV.SAME_MAIN;
  else if (DAOLV.SHENG[other.main] === my.main) v += DAOLV.GENERATES;
  return Math.round(v * 10000) / 10000;
}

/* 本信徒当前生效的道侣加成合计（亡故记录不计；已化道继续生效） */
function discDaoBonus(inst) {
  if (!inst || !Array.isArray(inst.dao)) return 0;
  let sum = 0;
  inst.dao.forEach(function (rec) {
    if (!rec || rec.state === 'dead') return;
    const src = daoRecordSource(rec);
    if (!src) return;
    sum += daoPairBonus(inst, src);
  });
  return Math.round(sum * 10000) / 10000;
}

/* 已占用的道侣位（含已化道 / 亡故；永久占位，不会释放） */
function discDaoUsed(inst) {
  return (inst && Array.isArray(inst.dao)) ? inst.dao.length : 0;
}
function discDaoHas(inst, uid) {
  if (!inst || !Array.isArray(inst.dao)) return false;
  for (let i = 0; i < inst.dao.length; i++) {
    if (inst.dao[i] && inst.dao[i].uid === uid) return true;
  }
  return false;
}

/* 候选：同仓库、非自己、尚未结契；只检查 A 的道侣位是否已满。
   对方即使已有 7 段道侣关系也可以被选中（化道后这些关系全部寡妇化，确认框会逐项列出），
   且允许对方正在驻守任务或担任朝代职位（结契时自动卸下）。 */
function discDaoCandidates(inst) {
  if (!inst) return [];
  return state.disciples.owned.filter(function (x) {
    if (!x || x.uid === inst.uid) return false;
    return !discDaoHas(inst, x.uid);
  });
}

/* 结为道侣（化道）：B 从仓库永久移除，A 获得并永久保留 B 的加成。
   B 的任务驻守自动卸下、朝代职位自动空缺；B 原有的道侣关系全部寡妇化。
   采用「自动卸下」而非「禁止选择 / 要求先卸下」：B 本就要永久消失，
   先卸下只是多一步操作；自动清理可保证 assign 与 posts 不留下悬空 uid。 */
function bindDaolv(aUid, bUid) {
  const a = discInstance(aUid);
  const b = discInstance(bUid);
  if (!a || !b) { logMsg('结契失败：信徒已不存在。', 'warn'); return false; }
  if (a.uid === b.uid) { logMsg('不能与自己结为道侣。', 'warn'); return false; }
  if (discDaoHas(a, b.uid)) {
    logMsg('「' + daoName(b) + '」已是「' + daoName(a) + '」的道侣。', 'warn');
    return false;
  }
  if (!Array.isArray(a.dao)) a.dao = [];
  if (a.dao.length >= DAOLV.MAX) {
    logMsg('「' + daoName(a) + '」的道侣位已满（' + DAOLV.MAX + ' 位）。', 'warn');
    return false;
  }

  /* 先收集 B 的后果，供日志与界面确认使用 */
  const bTask = discAssignedTask(b.uid);
  const bPost = discDynPost(b.uid);
  const broken = [];
  if (Array.isArray(b.dao)) {
    b.dao.forEach(function (rec) {
      if (!rec || rec.state === 'dead' || rec.state === 'spent') return;
      const p = discInstance(rec.uid);
      if (p && p.uid !== a.uid) broken.push(daoName(p));
    });
  }

  /* 自动清理 B 的身份与既有关系 */
  if (bTask) delete state.disciples.assign[bTask];
  if (bPost && bPost.d.posts) bPost.d.posts[bPost.role] = null;
  daoWidow(b.uid);
  const bi = state.disciples.owned.indexOf(b);
  if (bi >= 0) state.disciples.owned.splice(bi, 1);

  /* A 的永久记录：快照 B 的品阶 / 主属性 / 副属性强度，B 消失后加成仍可计算 */
  a.dao.push({
    uid: b.uid, id: b.id, tier: b.tier, main: b.main, power: b.power, state: 'spent'
  });

  let extra = '';
  if (bTask) extra += '；已卸下其在「' + (SKILLS[bTask] ? SKILLS[bTask].name : bTask) + '」的驻守';
  if (bPost) extra += '；其「' + dynastyName(bPost.d.dyn) + '」' + dynPostName(bPost.role) + '职位随之空缺';
  if (broken.length) {
    extra += '；其原有 ' + broken.length + ' 段道侣关系（' + broken.join('、') + '）全部断绝，' +
      '对方的道侣位永久占用、加成归零';
  }
  logMsg('「' + daoName(b) + '」化道，纳为「' + daoName(a) + '」的道侣：' +
    '道侣位 ' + a.dao.length + ' / ' + DAOLV.MAX + '，五行任务加成 ×' +
    (1 + discDaoBonus(a)).toFixed(3) + '。' + daoName(b) + ' 已从仓库永久移除、不可恢复' + extra + '。', 'good');
  return true;
}

/* 信徒消失（遣散 / 朝代合成）时：把其它记录中的该 uid 标记为亡故。
   不删除记录 → 道侣位永久占用、加成失效、不可补位。 */
function daoWidow(uid) {
  if (!state || !state.disciples) return;
  state.disciples.owned.forEach(function (x) {
    if (!x || !Array.isArray(x.dao)) return;
    x.dao.forEach(function (rec) {
      if (!rec || rec.uid !== uid || rec.state === 'spent') return;
      rec.state = 'dead';
      rec.alive = false;
    });
  });
}

/* 当前加成生效的道侣记录数（含已化道，不含亡故；用于确认文案） */
function daoActiveCount(inst) {
  if (!inst || !Array.isArray(inst.dao)) return 0;
  let n = 0;
  inst.dao.forEach(function (rec) {
    if (rec && rec.state !== 'dead') n += 1;
  });
  return n;
}

/* 仍在世、会因本信徒消失而寡妇化的道侣数（已化道者不算） */
function daoLivePartnerCount(inst) {
  if (!inst || !Array.isArray(inst.dao)) return 0;
  let n = 0;
  inst.dao.forEach(function (rec) {
    if (!rec || rec.state === 'dead' || rec.state === 'spent') return;
    if (discInstance(rec.uid)) n += 1;
  });
  return n;
}

/* ------------------------------------------------- 属性 / 境界 / 生命上限 */
function realmIndex() { return realmInfo(state.skills.cultivation.lvl).realmIndex; }

function calcStats() {
  const cl = state.skills.combat.lvl;
  const ri = realmIndex();

  let atk = CONFIG.BASE_ATK + (cl - 1) * CONFIG.ATK_PER_LEVEL;
  let def = CONFIG.BASE_DEF + (cl - 1) * CONFIG.DEF_PER_LEVEL;
  let hit = CONFIG.BASE_HIT + (cl - 1) * CONFIG.HIT_PER_LEVEL;
  let ev = CONFIG.BASE_EV + (cl - 1) * CONFIG.EV_PER_LEVEL;
  let hp = CONFIG.BASE_HP + (cl - 1) * CONFIG.HP_PER_COMBAT + ri * CONFIG.HP_PER_REALM;

  EQUIP_SLOTS.forEach(function (sl) {
    const id = state.equip[sl.id];
    if (!id || !ITEMS[id]) return;
    const it = ITEMS[id];
    atk += it.atk || 0;
    def += it.def || 0;
    hp += it.hp || 0;
    hit += it.hit || 0;
    ev += it.ev || 0;
  });

  /* 每个大境界，攻防命闪 +12% */
  const mul = 1 + ri * CONFIG.REALM_ATK_BONUS;
  atk = Math.round(atk * mul);
  def = Math.round(def * mul);
  hit = Math.round(hit * mul);
  ev = Math.round(ev * mul);

  /* 阵法加持：金刚阵（生命/防御）与玄机阵（攻命闪） */
  atk = Math.round(atk * (1 + formBonus('atk')));
  def = Math.round(def * (1 + formBonus('def')));
  hit = Math.round(hit * (1 + formBonus('hit')));
  ev = Math.round(ev * (1 + formBonus('ev') + worldBonus('ev')));
  hp = hp * (1 + formBonus('hp'));

  /* 洞天加持：演武场（攻防）、玄龟壁（防御）、藏兵阁（命中）、药庐（生命） */
  const wbAtk = worldBonus('atk');
  const wbDef = worldBonus('def');
  const wbHit = worldBonus('hit');
  const wbHp = worldBonus('hp');
  if (wbAtk > 0) atk = Math.round(atk * (1 + wbAtk));
  if (wbAtk > 0 || wbDef > 0) def = Math.round(def * (1 + wbAtk + wbDef));
  if (wbHit > 0) hit = Math.round(hit * (1 + wbHit));
  if (wbHp > 0) hp = hp * (1 + wbHp);

  const dr = Math.min(CONFIG.DR_CAP, def / (def + CONFIG.DR_DIVISOR));

  return {
    hp: Math.round(hp),
    atk: atk,
    atkMin: Math.max(1, Math.round(atk * (1 - CONFIG.DMG_SPREAD))),
    atkMax: Math.max(2, Math.round(atk * (1 + CONFIG.DMG_SPREAD))),
    hit: hit,
    ev: ev,
    dr: dr,
    attackTime: CONFIG.PLAYER_ATTACK_TIME / (1 + elemBonus('combat', 'speed'))
  };
}

function maxHp() { return calcStats().hp; }

function clampHp() {
  const m = maxHp();
  if (state.hp > m) state.hp = m;
  if (state.hp < 0) state.hp = 0;
}

/* 动作速度：受大境界、疾风阵与风阵坊加成（任务五行加成在 actionSpeed 叠加） */
function speedMul() {
  return (1 + realmIndex() * CONFIG.SPEED_REALM_BONUS) *
    (1 + formBonus('speed') + worldBonus('speed'));
}

/* 单技能动作速度：全局速度 × 该任务上阵信徒的五行加成 */
function actionSpeed(skillId) {
  return speedMul() * (1 + elemBonus(skillId, 'speed'));
}

/* 技能 → 阵法经验加成通道（阵法自身不受加成） */
const XP_GROUP = { cultivation: 'cult', combat: 'combat', crafting: 'craft', smelting: 'craft', alchemy: 'craft', herbalism: 'gather', farming: 'gather' };

/* 经验/修为加成 */
function xpMul(skillId) {
  const ri = realmIndex();
  const grp = XP_GROUP[skillId] || (skillId === 'formation' ? null : 'gather');
  const fb = grp ? (1 + formBonus('xp_' + grp)) : 1;
  const wb = 1 + worldBonus('xp');
  const eb = 1 + elemBonus(skillId, 'xp');
  if (skillId === 'cultivation') {
    /* 悟性每点 +1% 修为收益，叠加境界、阵法、书院、静心堂与上阵信徒加成 */
    return (1 + ri * CONFIG.CULT_XP_PER_REALM) * (1 + state.insight * 0.01) * fb * wb *
      (1 + worldBonus('cultxp')) * eb;
  }
  return (1 + ri * CONFIG.XP_REALM_BONUS) * fb * wb * eb;
}

/* --------------------------------------------------------------- 经验升级 */
function levelInfo(skillId) {
  const s = state.skills[skillId];
  if (skillId === 'cultivation') {
    const bi = breakInfo(s.lvl - 1);
    const need = bi ? bi.need : s.xp;
    return { lvl: s.lvl, xp: s.xp, need: need, pct: need > 0 ? Math.min(1, s.xp / need) : 1, max: !bi };
  }
  const need = xpNeed(skillId, s.lvl);
  return { lvl: s.lvl, xp: s.xp, need: need, pct: Math.min(1, s.xp / need), max: false };
}

function addXp(skillId, amount) {
  const s = state.skills[skillId];
  if (!s || !isFinite(amount) || amount <= 0) return;
  const gain = amount * xpMul(skillId);

  /* 修炼：修为封顶于当前境界瓶颈，需自行突破 */
  if (skillId === 'cultivation') {
    const bi = breakInfo(s.lvl - 1);
    s.xp += gain;
    if (bi && s.xp >= bi.need) {
      s.xp = bi.need;
      if (!s.capped) {
        s.capped = true;
        logMsg('修为已至瓶颈，前往「修炼」面板冲击「' + realmInfo(s.lvl + 1).full + '」。', 'warn');
      }
    }
    return;
  }

  s.xp += gain;
  let gained = 0;
  while (s.xp >= xpNeed(skillId, s.lvl) && gained < 500) {
    s.xp -= xpNeed(skillId, s.lvl);
    s.lvl += 1;
    gained += 1;
  }
  if (gained > 0) onLevelUp(skillId, gained);
}

function onLevelUp(skillId, n) {
  const s = state.skills[skillId];
  if (skillId === 'combat') {
    clampHp();
    logMsg('战斗等级提升至 Lv.' + s.lvl + '，攻防命闪增强。', 'levelup');
  } else {
    logMsg(SKILLS[skillId].name + ' 等级提升至 Lv.' + s.lvl, 'levelup');
  }
}

/* --------------------------------------------------------------- 精通系统 */
function masteryNeed(lvl) { return Math.floor(20 * Math.pow(lvl, 1.6)); }

function masteryOf(id) {
  let m = state.mastery[id];
  if (!m) { m = { lvl: 0, xp: 0 }; state.mastery[id] = m; }
  return m;
}

function masteryInfo(id) {
  const m = masteryOf(id);
  if (m.lvl >= CONFIG.MASTERY_CAP) return { lvl: m.lvl, xp: m.xp, need: 0, pct: 1, max: true };
  const need = masteryNeed(m.lvl + 1);
  return { lvl: m.lvl, xp: m.xp, need: need, pct: Math.min(1, m.xp / need), max: false };
}

function addMastery(id, amount) {
  const m = masteryOf(id);
  if (m.lvl >= CONFIG.MASTERY_CAP) return;
  m.xp += amount;
  let guard = 0;
  while (m.lvl < CONFIG.MASTERY_CAP && m.xp >= masteryNeed(m.lvl + 1) && guard++ < 200) {
    m.xp -= masteryNeed(m.lvl + 1);
    m.lvl += 1;
  }
  if (m.lvl >= CONFIG.MASTERY_CAP) m.xp = 0;
}

/* 精通带来的耗时缩减 */
function effTime(def, id) {
  const m = masteryOf(id);
  return def.time * (1 - Math.min(0.20, m.lvl * CONFIG.MASTERY_TIME_PER_LVL));
}

/* 额外产出概率（精通 + 技能等级 + 疾风阵） */
function doubleChance(id, skillId) {
  const m = masteryOf(id);
  const sk = state.skills[skillId] ? state.skills[skillId].lvl : 1;
  const c = m.lvl * CONFIG.MASTERY_DOUBLE_PER_LVL + sk * CONFIG.SKILL_DOUBLE_PER_LVL + formBonus('double') + worldBonus('double');
  return clamp(c, 0, 0.9);
}

/* 非物品收益（灵力 / 回复 / 修为）的精通倍率：每级 +0.5%，与额外产出同源 */
function masteryYield(id) {
  return 1 + masteryOf(id).lvl * CONFIG.MASTERY_DOUBLE_PER_LVL;
}

/* ------------------------------------------------------------ 周期动作执行 */
function matsOk(rec) {
  const list = rec.in || [];
  for (let i = 0; i < list.length; i++) {
    if (!invHas(list[i].id, list[i].qty)) return false;
  }
  return true;
}

function masteryGain(def) {
  return Math.max(1, Math.round(def.xp * CONFIG.MASTERY_XP_RATIO * (1 + formBonus('mastery') + worldBonus('mastery'))));
}

/* 入世（红尘历练）单次体验结算：参考梅尔沃盗窃——
   成功得灵石与掉落；失败被罚灵石、受伤（保底 1 点生命，凡人伤不了修士性命）并眩晕中断。 */
function thievingCycle(def) {
  /* 精通每级 +0.2% 成功率（上限 95%），越干越熟 */
  const m = masteryOf(def.id);
  const rate = Math.min(0.95, def.rate + m.lvl * 0.002);

  if (Math.random() >= rate) {
    const fine = Math.min(state.gold, def.fine || 0);
    state.gold -= fine;
    state.hp = Math.max(1, state.hp - (def.dmg || 0));
    state.stun = def.stun || 3;
    addXp('thieving', Math.round(def.xp * 0.5));
    logMsg('「' + def.name + '」被识破！被罚 💠 ' + fine + ' 还挨了顿揍，晕了 ' + state.stun + ' 秒。', 'bad');
    return false;   /* 返回 false → 中断动作槽 */
  }

  const gold = Math.round(randInt(def.gold[0], def.gold[1]) * masteryYield(def.id) *
    (1 + formBonus('gold') + worldBonus('gold')));
  state.gold += gold;

  const got = [];
  const lost = [];
  const dropMul = 1 + formBonus('drop') + worldBonus('drop') + elemBonus('thieving', 'drop');
  const dchance = doubleChance(def.id, 'thieving');
  def.loot.forEach(function (l) {
    if (Math.random() >= Math.min(1, l.chance * dropMul)) return;
    let qty = l.qty || 1;
    let bonus = '';
    if (Math.random() < dchance) { qty *= 2; bonus = '（精通·双倍）'; }
    if (invAdd(l.id, qty)) got.push(qty + ' × ' + itemIcon(l.id) + itemName(l.id) + bonus);
    else lost.push(itemName(l.id));
  });

  addXp('thieving', def.xp);
  addMastery(def.id, masteryGain(def));
  logMsg('「' + def.name + '」体验归来：灵石 +' + gold + (got.length ? '，' + got.join('、') : ''), 'gold');
  if (lost.length) logMsg('背包已满，' + lost.join('、') + ' 只好忍痛丢弃。', 'warn');
  return true;
}

/* 结算一次动作完成，返回 false 表示应中断 */
function completeActivity(act, def) {
  const skillId = act.skill;

  /* --- 入世：概率判定成败 --- */
  if (skillId === 'thieving') return thievingCycle(def);

  /* --- 配方类（有消耗） --- */
  if (def.in && def.in.length) {
    if (!matsOk(def)) { logMsg('材料不足，「' + def.name + '」已停止。', 'warn'); return false; }
    def.in.forEach(function (m) { invRemove(m.id, m.qty); });

    const out = def.out || {};
    let bonus = '';
    let shown = out;
    if (out.spirit) { shown = { spirit: Math.round(out.spirit * masteryYield(def.id)) }; state.spirit += shown.spirit; }
    else if (out.gold) {
      shown = { gold: Math.round(out.gold * (1 + formBonus('gold') + worldBonus('gold'))) };
      state.gold += shown.gold;
    }
    else if (out.heal) { shown = { heal: Math.round(out.heal * masteryYield(def.id)) }; state.hp = Math.min(maxHp(), state.hp + shown.heal); }
    else if (out.cultXp) addXp('cultivation', out.cultXp);
    else if (out.id) {
      /* 精通：成品有概率翻倍（材料只消耗一次） */
      let qty = out.qty || 1;
      if (Math.random() < doubleChance(def.id, skillId)) { qty *= 2; bonus = '（精通·双倍）'; }
      /* 上阵信徒五行相合：每件产出有 power 概率额外 +1 */
      if (Math.random() < elemBonus(skillId, 'drop')) { qty += 1; bonus += '（信徒·额外）'; }
      shown = { id: out.id, qty: qty };
      invAdd(out.id, qty);
    }

    state.stats.crafts += 1;
    if (out.id && ITEMS[out.id] && ITEMS[out.id].type === 'pill') state.stats.pills += 1;

    addXp(skillId, def.xp);
    addMastery(def.id, masteryGain(def));
    if (!OFFLINE_MODE) logMsg('「' + def.name + '」完成，' + recipeOutText(shown) + bonus, 'craft');
    return true;
  }

  /* --- 采集 / 修炼 / 观星类 --- */
  const out = def.out || {};
  let qty = out.qty || 1;
  let bonus = '';
  if (out.id) {
    if (Math.random() < doubleChance(def.id, skillId)) { qty *= 2; bonus = '（精通·双倍）'; }
    /* 上阵信徒五行相合：每件产出有 power 概率额外 +1 */
    if (Math.random() < elemBonus(skillId, 'drop')) { qty += 1; bonus += '（信徒·额外）'; }
    invAdd(out.id, qty);
    state.stats.gathered += 1;
    state.stats.perSkill[skillId] = (state.stats.perSkill[skillId] || 0) + 1;
    if (!OFFLINE_MODE) logMsg('获得 ' + qty + ' × ' + itemIcon(out.id) + itemName(out.id) + bonus, 'gather');
  }
  /* 观星产出星砂：同样享受额外产出加成 */
  if (out.stardust) {
    let sd = out.stardust;
    if (Math.random() < doubleChance(def.id, skillId)) { sd *= 2; bonus = '（精通·双倍）'; }
    if (Math.random() < elemBonus(skillId, 'drop')) { sd += 1; bonus += '（信徒·额外）'; }
    state.stardust += sd;
    state.stats.gathered += 1;
    state.stats.perSkill[skillId] = (state.stats.perSkill[skillId] || 0) + 1;
    if (!OFFLINE_MODE) logMsg('观星所得 💫 星砂 ×' + sd + bonus, 'gather');
  }
  /* 采药（herbalism）：低概率掉落该药材对应的种子（梅尔沃式，花时间换种子） */
  if (skillId === 'herbalism' && out.id) {
    FARM_SEEDS.forEach(function (seed) {
      if (seed.dropBy === def.id && Math.random() < 0.30) {
        invAdd(seed.id, 1);
        if (!OFFLINE_MODE) logMsg('额外获得 1 × ' + itemIcon(seed.id) + itemName(seed.id), 'gather');
      }
    });
  }
  if (out.spirit) state.spirit += Math.round(out.spirit * masteryYield(def.id));
  if (out.gold) state.gold += Math.round(out.gold * (1 + formBonus('gold') + worldBonus('gold')));
  if (out.heal) state.hp = Math.min(maxHp(), state.hp + Math.round(out.heal * masteryYield(def.id)));

  addXp(skillId, def.xp);
  addMastery(def.id, masteryGain(def));
  return true;
}

function recipeOutText(out) {
  if (out.spirit) return '灵力 +' + out.spirit;
  if (out.gold) return '灵石 +' + out.gold;
  if (out.heal) return '回复 ' + out.heal + ' 生命';
  if (out.cultXp) return '修为 +' + out.cultXp;
  if (out.id) return '获得 ' + (out.qty || 1) + ' × ' + itemIcon(out.id) + itemName(out.id);
  return '完成';
}

function cycleTick(dt) {
  const act = state.action;
  if (!act) return;
  /* 战斗动作由 combatTick 独立驱动，星球由 planetTick 独立驱动；
   * 二者都不在 ACTIONS/RECIPES 里查表，必须在 cycleTick 显式跳过，否则会被判为无效动作清空 */
  if (act.skill === 'combat' || act.skill === 'planet' || act.skill === 'tower' || act.skill === 'rift' || act.skill === 'elem' || act.skill === 'riftmon') return;

  const def = findActivity(act.skill, act.id);
  if (!def) { state.action = null; state.actionExplicit = false; state.actionTimer = 0; return; }

  const t = effTime(def, act.id);

  /* 缺材料 或 背包已满 时原地等待，不中断挂机 */
  const matShort = !!(def.in && def.in.length && !matsOk(def));
  const bagFull = !!(def.out && def.out.id && !invCanAdd(def.out.id, def.out.qty || 1));
  if (matShort || bagFull) {
    state.actionTimer = t;
    state.actionCur = t;
    if (!state.actionWaiting) {
      state.actionWaiting = true;
      const why = matShort ? '材料不足' : '背包已满';
      logMsg(why + '，「' + def.name + '」正在等待…', 'warn');
    }
    return;
  }
  if (state.actionWaiting) {
    state.actionWaiting = false;
    logMsg('「' + def.name + '」继续运转。', 'info');
  }

  state.actionTimer += dt * actionSpeed(act.skill);

  /* 界面取样必须在回填完成周期之前：100ms 心跳下，若先回填，
   * 采样永远只看到剩下的零头，进度条会在 ~90% 处“重置”，到不了满格。 */
  state.actionCur = Math.min(t, state.actionTimer);

  let guard = 0;
  while (state.actionTimer >= t && guard++ < 200) {
    state.actionTimer -= t;
    const keep = completeActivity(act, def);
    if (!keep) { stopAction(true); return; }
    if (!state.action || state.action.id !== act.id || state.action.skill !== act.skill) return;
  }
}

/* ---------------------------------------------------------------- 战斗系统 */
function hitChance(acc, ev) {
  return clamp(acc / (acc + ev || 1), CONFIG.HIT_MIN, CONFIG.HIT_MAX);
}

function rollRange(min, max) {
  return Math.round(min + Math.random() * (max - min));
}

/* ---------------------------------------------------------------- 秘境 */
/* 数量简写（万级）：引擎层不依赖 ui.js 的 fmtNum */
function fmtCount(n) {
  n = Math.floor(n);
  if (n >= 10000) return (n / 10000).toFixed(n >= 100000 ? 0 : 1) + ' 万';
  return String(n);
}

/* 解锁进度：返回 { unlocked, have, need, text }；无 unlock 字段即默认开放 */
function dungeonUnlockInfo(dg) {
  const u = dg.unlock;
  if (!u) return { unlocked: true, have: 1, need: 1, text: '' };
  if (u.type === 'gatherSkill') {
    const have = Math.floor(state.stats.perSkill[u.skill] || 0);
    const sk = SKILLS[u.skill] || { name: u.skill };
    return { unlocked: have >= u.n, have: have, need: u.n, text: sk.name + '累计采集 ' + u.n + ' 次' };
  }
  if (u.type === 'level') {
    const have = state.skills[u.skill] ? state.skills[u.skill].lvl : 1;
    const sk = SKILLS[u.skill] || { name: u.skill };
    return { unlocked: have >= u.lvl, have: have, need: u.lvl, text: sk.name + '达到 Lv.' + u.lvl };
  }
  if (u.type === 'kills') {
    const have = state.stats.kills;
    return { unlocked: have >= u.n, have: have, need: u.n, text: '累计击杀 ' + u.n + ' 只妖兽' };
  }
  return { unlocked: false, have: 0, need: 1, text: '未知条件' };
}

/* 通关一轮：发放额外奖励并累计通关次数 */
function dungeonReward(dg) {
  const gold = Math.round(dg.reward.gold * (1 + formBonus('gold') + worldBonus('gold')));
  state.gold += gold;
  if (dg.reward.xp) addXp('combat', dg.reward.xp);
  const got = [];
  (dg.reward.items || []).forEach(function (it) {
    invAdd(it.id, it.qty);
    got.push(it.qty + ' × ' + itemIcon(it.id) + itemName(it.id));
  });
  state.dungeons[dg.id] = (state.dungeons[dg.id] || 0) + 1;
  logMsg('通关秘境「' + dg.name + '」！灵石 +' + fmtCount(gold) + (got.length ? '，奖励：' + got.join('、') : '') +
    '（累计通关 ' + state.dungeons[dg.id] + ' 次）', 'good');
}

/* ---------------------------------------------------------------- 锁妖塔 */
/* 层数钳制：所有入口统一走这里，避免存档/外部调用传入 0、负数、NaN */
function towerFloorClamp(f) {
  f = Math.floor(Number(f));
  if (!isFinite(f)) f = 1;
  return Math.max(1, Math.min(TOWER.MAX_FLOOR, f));
}

/* 按层数分档取奖励物品（TOWER.PILLS / TOWER.MATS 的 min 升序） */
function towerPickTier(list, f) {
  let pick = list[0];
  for (let i = 0; i < list.length; i++) if (f >= list[i].min) pick = list[i];
  return pick;
}

/* 第 f 层妖物属性：纯层数函数，同一层可重复预览且完全一致 */
function towerEnemy(floor) {
  const f = towerFloorClamp(floor);
  const t = f - 1;
  const hp = Math.round(TOWER.HP_BASE * (1 + TOWER.HP_LIN * t + TOWER.HP_POW * Math.pow(t, TOWER.HP_EXP)));
  const atkMul = 1 + TOWER.ATK_LIN * t + TOWER.ATK_POW * Math.pow(t, TOWER.ATK_EXP);
  const mob = TOWER.MOBS[(f - 1) % TOWER.MOBS.length];
  const boss = f % TOWER.MILESTONE_EVERY === 0;
  return {
    id: '__tower__', name: (boss ? '妖将 · ' : '') + mob.name, icon: boss ? '👺' : mob.icon,
    lvl: f, hp: hp, maxHp: hp,
    hit: TOWER.HIT_BASE + TOWER.HIT_LIN * t,
    ev: TOWER.EV_BASE + TOWER.EV_LIN * t,
    atkMin: Math.round(TOWER.ATK_MIN * atkMul),
    atkMax: Math.round(TOWER.ATK_MAX * atkMul),
    dr: Math.min(TOWER.DR_CAP, TOWER.DR_BASE + TOWER.DR_LIN * t),
    interval: Math.max(TOWER.INTERVAL_MIN, TOWER.INTERVAL_BASE - TOWER.INTERVAL_DECAY * t),
    dungeon: null, floor: -1, tower: f
  };
}

/* 第 f 层奖励：与领取时完全同口径，领取前即可准确预览 */
function towerReward(floor) {
  const f = towerFloorClamp(floor);
  const milestone = f % TOWER.MILESTONE_EVERY === 0;
  const decade = f % TOWER.DECADE_EVERY === 0;
  let gold = Math.round(TOWER.GOLD_BASE * Math.pow(f, TOWER.GOLD_POW));
  if (milestone) gold = Math.round(gold * TOWER.MILESTONE_GOLD);
  gold = Math.round(gold * (1 + formBonus('gold') + worldBonus('gold')));
  let star = Math.max(1, Math.round(TOWER.STAR_BASE * Math.pow(f, TOWER.STAR_POW)));
  if (milestone) star *= TOWER.MILESTONE_STAR;
  const xp = Math.round(TOWER.XP_BASE * Math.pow(f, TOWER.XP_POW));
  const pill = towerPickTier(TOWER.PILLS, f);
  const mat = towerPickTier(TOWER.MATS, f);
  const items = [];
  if (milestone) items.push({ id: pill.id, qty: 1 });
  if (decade) {
    items.push({ id: pill.id, qty: 1 });
    items.push({ id: mat.id, qty: 1 + Math.floor(f / 50) });
  }
  return { floor: f, gold: gold, star: star, xp: xp, items: items, milestone: milestone, decade: decade };
}

function towerRunning() {
  return !!(state.action && state.action.skill === 'tower');
}

/* 开始 / 停止挑战：占用全局单一动作槽，开始前中断星球与其它战斗 */
function startTower() {
  if (state.stun > 0) { logMsg('眩晕中，还需 ' + Math.ceil(state.stun) + ' 秒才能行动。', 'warn'); return; }
  if (towerRunning()) { stopAction(); return; }

  const t = state.tower;
  if (t.pending) {
    logMsg('第 ' + t.pending + ' 层奖励尚未领取，请先领取后再继续挑战。', 'warn');
    return;
  }

  const floor = towerFloorClamp(t.current);
  planetInterrupt();
  cancelCombat();

  const c = state.skills.combat;
  c.tower = floor;
  c.monster = '__tower__';     /* 占位：让脱战回血等被动把它视为战斗中 */
  c.dungeon = null;
  c.floor = 0;
  c.target = towerEnemy(floor);
  c.playerTimer = 0;
  c.monsterTimer = 0;
  c.respawn = 0;

  t.failed = false;
  state.action = { skill: 'tower', id: 'floor' };
  state.actionTimer = 0;
  state.actionCur = 0;
  state.actionWaiting = false;
  logMsg('开始挑战锁妖塔第 ' + floor + ' 层「' + c.target.name + '」。', 'info');
}

/* 击败该层：进入待领奖，立刻释放动作槽；层数此时不推进 */
function towerCleared(floor, target) {
  const t = state.tower;
  t.pending = towerFloorClamp(floor);
  t.best = Math.max(t.best, t.pending);
  t.failed = false;
  logMsg('击败锁妖塔第 ' + t.pending + ' 层「' + target.name + '」！奖励待领取，领取后进入第 ' +
    Math.min(TOWER.MAX_FLOOR, t.pending + 1) + ' 层。', 'good');
  stopAction(true);
}

/* 领取当前层奖励；成功后层数 +1，pending 清空，不可重复领取 */
function towerClaim() {
  const t = state.tower;
  if (!t.pending) { logMsg('当前没有可领取的锁妖塔奖励。', 'warn'); return false; }
  const floor = towerFloorClamp(t.pending);
  const rw = towerReward(floor);

  /* 背包预检：材料/丹药没有新槽位时整单拒绝，避免领取后静默丢物品 */
  const unique = {};
  rw.items.forEach(function (it) { unique[it.id] = true; });
  let needSlots = 0;
  Object.keys(unique).forEach(function (id) { if (invCount(id) <= 0) needSlots += 1; });
  if (invSlotsUsed() + needSlots > invCap()) {
    logMsg('背包已满，无法领取第 ' + floor + ' 层奖励（需 ' + needSlots + ' 个空位）。', 'warn');
    return false;
  }

  state.gold += rw.gold;
  state.stardust = (state.stardust || 0) + rw.star;
  addXp('combat', rw.xp);
  const got = [];
  rw.items.forEach(function (it) {
    invAdd(it.id, it.qty);
    got.push(it.qty + ' × ' + itemIcon(it.id) + itemName(it.id));
  });

  t.pending = false;
  t.best = Math.max(t.best, floor);
  t.current = Math.min(TOWER.MAX_FLOOR, Math.max(t.current, floor) + 1);
  t.failed = false;
  logMsg('领取锁妖塔第 ' + floor + ' 层奖励：灵石 +' + rw.gold + '、星砂 +' + rw.star +
    '、战斗经验 +' + rw.xp + (got.length ? '、' + got.join('、') : '') +
    '。下一层：第 ' + t.current + ' 层。', 'good');
  return true;
}

/* 点「挑战」= 开始/停止；点「领取」走 towerClaim */
function towerToggle() {
  startTower();
}

/* ---------------------------------------------------------------- 异界裂缝 */
/* 层级钳制：新档为 0，所有入口统一防止负数 / NaN / 溢出 */
function riftTierClamp(tier) {
  tier = Math.floor(Number(tier));
  if (!isFinite(tier)) tier = 0;
  return Math.max(0, Math.min(RIFT.MAX_TIER, tier));
}

function riftRunning() {
  return !!(state.action && state.action.skill === 'rift');
}

/* 裂缝妖物：纯层级函数（安全上限会参考玩家当前生命），同一层级可重复预览 */
function riftEnemy(tier) {
  const t = riftTierClamp(tier);
  const hp = Math.round(RIFT.HP_BASE * (1 + RIFT.HP_LIN * t + RIFT.HP_POW * Math.pow(t, RIFT.HP_EXP)));
  const atkMul = 1 + RIFT.ATK_LIN * t + RIFT.ATK_POW * Math.pow(t, RIFT.ATK_EXP);
  const mob = RIFT.MOBS[t % RIFT.MOBS.length];
  let atkMin = Math.max(1, Math.round(RIFT.ATK_MIN * atkMul));
  let atkMax = Math.max(atkMin, Math.round(RIFT.ATK_MAX * atkMul));
  /* 安全上限：单次伤害不超过玩家当前生命上限的 18%，保证后期不会被一刀秒 */
  const cap = Math.max(2, Math.round(calcStats().hp * RIFT.HIT_CAP));
  if (atkMax > cap) {
    atkMax = cap;
    if (atkMin > atkMax) atkMin = Math.max(1, Math.round(atkMax * 0.55));
  }
  return {
    id: '__rift__', name: mob.name, icon: mob.icon, lvl: t + 1,
    hp: hp, maxHp: hp,
    hit: RIFT.HIT_BASE + RIFT.HIT_LIN * t,
    ev: RIFT.EV_BASE + RIFT.EV_LIN * t,
    atkMin: atkMin, atkMax: atkMax,
    dr: Math.min(RIFT.DR_CAP, RIFT.DR_BASE + RIFT.DR_LIN * t),
    interval: Math.max(RIFT.INTERVAL_MIN, RIFT.INTERVAL_BASE - RIFT.INTERVAL_DECAY * t),
    dungeon: null, floor: -1, tower: 0, rift: t
  };
}

/* 修复奖励：少量灵石/星砂 + 战斗经验（帮助玩家跟上裂缝强度） */
function riftReward(tier) {
  const t = riftTierClamp(tier);
  let gold = Math.round(RIFT.GOLD_BASE * Math.pow(t + 1, RIFT.GOLD_POW));
  gold = Math.round(gold * (1 + formBonus('gold') + worldBonus('gold')));
  const star = Math.max(1, Math.round(RIFT.STAR_BASE * Math.pow(t + 1, RIFT.STAR_POW)));
  const xp = Math.round(RIFT.XP_BASE * Math.pow(t + 1, RIFT.XP_POW));
  return { tier: t, gold: gold, star: star, xp: xp };
}

/* 开始 / 停止修复：占用全局单一动作槽，开始前中断星球与其它战斗 */
function startRift() {
  if (state.stun > 0) { logMsg('眩晕中，还需 ' + Math.ceil(state.stun) + ' 秒才能行动。', 'warn'); return; }
  if (riftRunning()) { stopAction(); return; }

  const r = state.rift;
  if (!r || !r.open) { logMsg('当前没有未修复的异界裂缝；穿越成功后会生成新的裂缝。', 'warn'); return; }

  const tier = riftTierClamp(r.tier);
  planetInterrupt();
  cancelCombat();

  const c = state.skills.combat;
  c.rift = tier;
  c.monster = '__rift__';     /* 占位：让脱战回血等被动把它视为战斗中 */
  c.dungeon = null;
  c.floor = 0;
  c.target = riftEnemy(tier);
  c.playerTimer = 0;
  c.monsterTimer = 0;
  c.respawn = 0;

  state.action = { skill: 'rift', id: 'repair' };
  state.actionTimer = 0;
  state.actionCur = 0;
  state.actionWaiting = false;
  logMsg('进入异界裂缝第 ' + tier + ' 层「' + c.target.name + '」，击败即可完成修复。', 'info');
}

/* 修复裂缝：立刻发奖并标记已修复；下一次穿越成功后生成新裂缝 */
function riftCleared(tier, target) {
  const r = state.rift;
  const t = riftTierClamp(tier);
  if (!r || !r.open) { stopAction(true); return; }
  const rw = riftReward(t);
  state.gold += rw.gold;
  state.stardust = (state.stardust || 0) + rw.star;
  addXp('combat', rw.xp);
  const seedGain = DYNASTY.SEED_RIFT_BASE + Math.floor(t / DYNASTY.SEED_RIFT_TIER_STEP);
  state.seed = (state.seed || 0) + seedGain;
  r.open = false;
  r.tier = t;
  logMsg('修复异界裂缝第 ' + t + ' 层「' + (target ? target.name : '') + '」！灵石 +' + rw.gold +
    '、星砂 +' + rw.star + '、战斗经验 +' + rw.xp + '、🌱 生命之种 +' + seedGain + '。可返回星球继续穿越。', 'good');
  stopAction(true);
}

/* ------------------------------------------------------------ 五行属性裂缝 */
/* 与异界裂缝完全独立：不进穿越门槛、不写 state.rift，只占单一动作槽 */

function findElemRift(id) {
  for (let i = 0; i < ELEM_RIFT.ELEMENTS.length; i++) {
    if (ELEM_RIFT.ELEMENTS[i].id === id) return ELEM_RIFT.ELEMENTS[i];
  }
  return null;
}

function elemRiftTierClamp(tier) {
  tier = Math.floor(Number(tier));
  if (!isFinite(tier)) tier = 0;
  return Math.max(0, Math.min(ELEM_RIFT.MAX_TIER, tier));
}

/* 强度层级：穿越次数（×2.2）+ 对应工作等级（每级 ×0.4），生成时快照 */
function elemRiftTier(level, cross) {
  const lv = Math.max(1, Math.floor(Number(level) || 1));
  const cr = Math.max(0, Math.floor(Number(cross) || 0));
  return elemRiftTierClamp(Math.round(cr * ELEM_RIFT.CROSS_W + (lv - 1) * ELEM_RIFT.LVL_W));
}

/* 单道裂缝：属性随机（允许重复），强度按该属性对应工作等级 + 穿越次数快照 */
function elemRiftSlotRoll(s) {
  const src = s || state;
  const el = ELEM_RIFT.ELEMENTS[Math.floor(Math.random() * ELEM_RIFT.ELEMENTS.length)];
  const sk = (src.skills && src.skills[el.skill]) || { lvl: 1 };
  const cross = (src.planet && src.planet.cross) || 0;
  return { elem: el.id, tier: elemRiftTier(sk.lvl, cross), fixed: false };
}

function elemRiftSlotsRoll(s) {
  const out = [];
  for (let i = 0; i < ELEM_RIFT.SLOTS; i++) out.push(elemRiftSlotRoll(s));
  return out;
}

/* 每帧检查真实时间：到期 → 整轮覆盖刷新（离线不补刷，回来只刷一次） */
function elemRiftTick() {
  const e = state.elemRifts;
  if (!e || !isFinite(e.next)) return;
  const now = Date.now();
  if (now < e.next) return;
  /* 正在打属性裂缝时推迟到本次战斗结束，避免槽位在战斗中被人换掉 */
  if (state.action && state.action.skill === 'elem') return;
  e.slots = elemRiftSlotsRoll();
  e.next = now + ELEM_RIFT.REFRESH_MS;
  logMsg('五行属性裂缝已刷新：新一轮 3 道裂缝出现。', 'info');
}

function elemRiftRunning() {
  return !!(state.action && state.action.skill === 'elem');
}

function elemSkillLvl(elemId) {
  const el = findElemRift(elemId);
  return el && state.skills[el.skill] ? state.skills[el.skill].lvl : 1;
}

/* 属性裂缝妖物：强度完全由生成时的快照 tier 决定 */
function elemEnemy(slot) {
  const el = findElemRift(slot && slot.elem) || ELEM_RIFT.ELEMENTS[0];
  const t = elemRiftTierClamp(slot ? slot.tier : 0);
  const hp = Math.round(ELEM_RIFT.HP_BASE * (1 + ELEM_RIFT.HP_LIN * t + ELEM_RIFT.HP_POW * Math.pow(t, ELEM_RIFT.HP_EXP)));
  const atkMul = 1 + ELEM_RIFT.ATK_LIN * t + ELEM_RIFT.ATK_POW * Math.pow(t, ELEM_RIFT.ATK_EXP);
  let atkMin = Math.max(1, Math.round(ELEM_RIFT.ATK_MIN * atkMul));
  let atkMax = Math.max(atkMin, Math.round(ELEM_RIFT.ATK_MAX * atkMul));
  /* 安全上限：单次伤害不超过玩家当前生命上限的 16%，后期也不会被一刀秒 */
  const cap = Math.max(2, Math.round(calcStats().hp * ELEM_RIFT.HIT_CAP));
  if (atkMax > cap) {
    atkMax = cap;
    if (atkMin > atkMax) atkMin = Math.max(1, Math.round(atkMax * 0.55));
  }
  return {
    id: '__elem__', name: el.name + '·时空裂缝', icon: el.icon, lvl: t + 1,
    hp: hp, maxHp: hp,
    hit: ELEM_RIFT.HIT_BASE + ELEM_RIFT.HIT_LIN * t,
    ev: ELEM_RIFT.EV_BASE + ELEM_RIFT.EV_LIN * t,
    atkMin: atkMin, atkMax: atkMax,
    dr: Math.min(ELEM_RIFT.DR_CAP, ELEM_RIFT.DR_BASE + ELEM_RIFT.DR_LIN * t),
    interval: Math.max(ELEM_RIFT.INTERVAL_MIN, ELEM_RIFT.INTERVAL_BASE - ELEM_RIFT.INTERVAL_DECAY * t),
    elem: el.id, dungeon: null, floor: -1, tower: 0, rift: -1
  };
}

/* 采集/生产：取「当前等级已解锁的最高档」产出，未解锁任何档时退化到最低档 */
function elemActionItem(skillId, level) {
  const list = ACTIONS[skillId] || [];
  let best = null;
  for (let i = 0; i < list.length; i++) {
    const a = list[i];
    if (!a.out || !a.out.id || !ITEMS[a.out.id]) continue;
    if (!best) best = a.out.id;
    if (a.req <= level) best = a.out.id;
    else break;
  }
  return best || 'log_qing';
}

/* 炼器输入材料（矿石/锭一类，取当前炼器等级可用的最高档熔炼原料） */
function elemCraftInput(level) {
  const list = RECIPES.smelting || [];
  let best = null, bestReq = -1;
  for (let i = 0; i < list.length; i++) {
    const r = list[i];
    if (!r || !r.out || !r.out.id || !r.in || !r.in.length) continue;
    const ore = r.in[0].id;
    if (!/^ore_/.test(ore) || !ITEMS[ore]) continue;
    /* 只要「矿石 → 同名锭」的正规熔炼配方，避开铁木汁 / 灵石提炼等特殊配方 */
    if (r.out.id !== 'ingot_' + ore.slice(4)) continue;
    if (!best) best = ore;
    if (r.req <= level && r.req > bestReq) { best = ore; bestReq = r.req; }
  }
  return best || 'ore_iron';
}

/* 炼丹可用药材：取当前炼丹等级可炼的最高档丹方的主药材 */
function elemHerbInput(level) {
  const list = RECIPES.alchemy || [];
  let best = null, bestReq = -1;
  for (let i = 0; i < list.length; i++) {
    const r = list[i];
    if (!r || !r.in) continue;
    let herb = null;
    r.in.forEach(function (it) {
      if (!herb && /^herb/.test(it.id) && ITEMS[it.id]) herb = it.id;
    });
    if (!herb) continue;
    if (!best) best = herb;
    if (r.req <= level && r.req > bestReq) { best = herb; bestReq = r.req; }
  }
  return best || 'herb_juqi';
}

/* 修复奖励：对应工作当前档材料 1~5 件；土行阵法没有物品材料，改发星砂 */
function elemRiftReward(elemId, level) {
  const el = findElemRift(elemId) || ELEM_RIFT.ELEMENTS[0];
  const lv = Math.max(1, Math.floor(Number(level) || 1));
  const qty = Math.max(1, Math.min(ELEM_RIFT.QTY_MAX, 1 + Math.floor((lv - 1) / ELEM_RIFT.QTY_LVL_STEP)));
  if (el.id === 'earth') return { elem: el.id, id: null, star: qty, qty: qty, level: lv };
  let id;
  if (el.id === 'wood') id = elemActionItem('woodcutting', lv);
  else if (el.id === 'water') id = elemActionItem('fishing', lv);
  else if (el.id === 'metal') id = elemCraftInput(lv);
  else id = elemHerbInput(lv);
  return { elem: el.id, id: id, star: 0, qty: qty, level: lv };
}

function elemRewardText(rw) {
  if (!rw) return '';
  if (!rw.id) return '💫 星砂 ×' + rw.qty;
  return itemIcon(rw.id) + ' ' + itemName(rw.id) + ' ×' + rw.qty;
}

/* 开始 / 停止修复：占用全局单一动作槽，开始前中断星球与其它战斗 */
function startElemRift(idx) {
  if (state.stun > 0) { logMsg('眩晕中，还需 ' + Math.ceil(state.stun) + ' 秒才能行动。', 'warn'); return; }
  if (elemRiftRunning()) { stopAction(); return; }

  const e = state.elemRifts;
  const slot = e && e.slots[idx];
  if (!slot) { logMsg('该裂缝位置已刷新，请返回星球查看。', 'warn'); return; }
  const el = findElemRift(slot.elem) || ELEM_RIFT.ELEMENTS[0];
  if (slot.fixed) { logMsg('「' + el.name + '·时空裂缝」已经修复，等待下一轮刷新。', 'warn'); return; }

  const rw = elemRiftReward(slot.elem, elemSkillLvl(slot.elem));
  if (rw.id && !invCanAdd(rw.id, rw.qty)) {
    logMsg('背包已满，无法收取「' + itemName(rw.id) + '」，请先清理背包。', 'warn');
    return;
  }

  planetInterrupt();
  cancelCombat();

  const c = state.skills.combat;
  c.elem = idx;
  c.elemRw = rw;
  c.monster = '__elem__';     /* 占位：让脱战回血等被动把它视为战斗中 */
  c.dungeon = null;
  c.floor = 0;
  c.rift = -1;
  c.target = elemEnemy(slot);
  c.playerTimer = 0;
  c.monsterTimer = 0;
  c.respawn = 0;

  state.action = { skill: 'elem', id: String(idx) };
  state.actionTimer = 0;
  state.actionCur = 0;
  state.actionWaiting = false;
  logMsg('进入「' + el.name + '·时空裂缝」（强度 ' + slot.tier + '），击败即可修复并取回材料。', 'info');
}

/* 修复属性裂缝：发材料、该位置留空到下一轮刷新；背包满则保持未修复 */
function elemRiftCleared(target) {
  const e = state.elemRifts;
  const c = state.skills.combat;
  const idx = c.elem;
  const slot = e && e.slots[idx];
  if (!slot || slot.fixed) { stopAction(true); return; }
  const el = findElemRift(slot.elem) || ELEM_RIFT.ELEMENTS[0];
  const rw = c.elemRw || elemRiftReward(slot.elem, elemSkillLvl(slot.elem));

  if (rw.id) {
    if (!invCanAdd(rw.id, rw.qty)) {
      logMsg('背包已满，无法收取「' + itemName(rw.id) + '」；裂缝仍未修复，清理背包后可重试。', 'warn');
      stopAction(true);
      return;
    }
    invAdd(rw.id, rw.qty);
  }
  if (rw.star) state.stardust = (state.stardust || 0) + rw.star;
  /* 生命之种：属性裂缝为概率掉落（异界裂缝 / 裂缝怪物为必掉，见各自结算） */
  let seedGain = 0;
  if (Math.random() < DYNASTY.SEED_ELEM_P) {
    seedGain = DYNASTY.SEED_ELEM_QTY;
    state.seed = (state.seed || 0) + seedGain;
  }
  slot.fixed = true;
  logMsg('修复「' + el.name + '·时空裂缝」！获得 ' + elemRewardText(rw) +
    (seedGain ? '、🌱 生命之种 +' + seedGain : '') + '。该位置留空至下一轮刷新。', 'good');
  stopAction(true);
}

/* ------------------------------------------------------------ 裂缝怪物 */
/* 与异界裂缝 / 五行属性裂缝三套独立：同时 1 只、24h 真实时间刷新，
   存在时只拦「星球运转」，不参与穿越门槛 */

function riftMonTierClamp(tier) {
  tier = Math.floor(Number(tier));
  if (!isFinite(tier)) tier = 0;
  return Math.max(0, Math.min(RIFT_MON.MAX_TIER, tier));
}

function riftMonAlive() {
  return !!(state.riftMon && state.riftMon.alive);
}

function riftMonRunning() {
  return !!(state.action && state.action.skill === 'riftmon');
}

/* 生成 / 覆盖一只新怪物：强度快照取当前穿越次数 */
function riftMonSpawn(now) {
  const t = isFinite(now) ? Number(now) : Date.now();
  state.riftMon = {
    alive: true,
    born: t,
    next: t + RIFT_MON.REFRESH_MS,
    tier: Math.min(RIFT_MON.MAX_TIER, planetCrossCount())
  };
}

/* 每帧检查真实时间：到期换新一只（覆盖式）。星球运转中延后到停止后再生，
   避免打断玩家正在进行的巡航；离线超过 24 小时回来只换一轮。 */
function riftMonTick() {
  const m = state.riftMon;
  if (!m || !isFinite(m.next)) return;
  if (Date.now() < m.next) return;
  if (planetRunning()) return;
  riftMonSpawn(Date.now());
  logMsg('裂缝怪物已刷新（强度 ' + state.riftMon.tier + '）；未击败前无法开启星球运转，穿越不受影响。', 'warn');
}

/* 怪物属性：强度完全由生成时的穿越次数快照决定，各项不高于同 t 的异界裂缝 */
function riftMonEnemy(tier) {
  const t = riftMonTierClamp(tier);
  const hp = Math.round(RIFT_MON.HP_BASE * (1 + RIFT_MON.HP_LIN * t + RIFT_MON.HP_POW * Math.pow(t, RIFT_MON.HP_EXP)));
  const atkMul = 1 + RIFT_MON.ATK_LIN * t + RIFT_MON.ATK_POW * Math.pow(t, RIFT_MON.ATK_EXP);
  let atkMin = Math.max(1, Math.round(RIFT_MON.ATK_MIN * atkMul));
  let atkMax = Math.max(atkMin, Math.round(RIFT_MON.ATK_MAX * atkMul));
  /* 安全上限：单次伤害不超过玩家当前生命上限的 14%，后期也不会被一刀秒 */
  const cap = Math.max(2, Math.round(calcStats().hp * RIFT_MON.HIT_CAP));
  if (atkMax > cap) {
    atkMax = cap;
    /* 上限生效时同步压低下限，保证「攻击下限」也不超过同 t 的异界裂缝 */
    atkMin = Math.max(1, Math.round(atkMax * 0.55));
  }
  return {
    id: '__riftmon__', name: RIFT_MON.NAME, icon: RIFT_MON.ICON, lvl: t + 1,
    hp: hp, maxHp: hp,
    hit: RIFT_MON.HIT_BASE + RIFT_MON.HIT_LIN * t,
    ev: RIFT_MON.EV_BASE + RIFT_MON.EV_LIN * t,
    atkMin: atkMin, atkMax: atkMax,
    dr: Math.min(RIFT_MON.DR_CAP, RIFT_MON.DR_BASE + RIFT_MON.DR_LIN * t),
    interval: Math.max(RIFT_MON.INTERVAL_MIN, RIFT_MON.INTERVAL_BASE - RIFT_MON.INTERVAL_DECAY * t),
    dungeon: null, floor: -1, tower: 0, rift: -1, elem: null, riftMon: t
  };
}

/* 奖励：灵石 + 星砂，同层级低于锁妖塔（塔另有每 5 层里程碑倍率） */
function riftMonReward(tier) {
  const t = riftMonTierClamp(tier);
  let gold = Math.round(RIFT_MON.GOLD_BASE * Math.pow(t + 1, RIFT_MON.GOLD_POW));
  gold = Math.round(gold * (1 + formBonus('gold') + worldBonus('gold')));
  const star = Math.max(1, Math.round(RIFT_MON.STAR_BASE * Math.pow(t + 1, RIFT_MON.STAR_POW)));
  return { tier: t, gold: gold, star: star };
}

/* 开始 / 停止挑战：占用全局单一动作槽，开始前中断星球与其它战斗 */
function startRiftMon() {
  if (state.stun > 0) { logMsg('眩晕中，还需 ' + Math.ceil(state.stun) + ' 秒才能行动。', 'warn'); return; }
  if (riftMonRunning()) { stopAction(); return; }

  const m = state.riftMon;
  if (!m || !m.alive) {
    const left = m && isFinite(m.next) ? Math.max(0, m.next - Date.now()) : 0;
    logMsg('裂缝怪物已被击败，下一只将在 ' + Math.ceil(left / 1000) + ' 秒后刷新。', 'warn');
    return;
  }

  const tier = riftMonTierClamp(m.tier);
  planetInterrupt();
  cancelCombat();

  const c = state.skills.combat;
  c.riftMon = tier;
  c.monster = '__riftmon__';     /* 占位：让脱战回血等被动把它视为战斗中 */
  c.dungeon = null;
  c.floor = 0;
  c.rift = -1;
  c.elem = -1;
  c.elemRw = null;
  c.target = riftMonEnemy(tier);
  c.playerTimer = 0;
  c.monsterTimer = 0;
  c.respawn = 0;

  state.action = { skill: 'riftmon', id: 'hunt' };
  state.actionTimer = 0;
  state.actionCur = 0;
  state.actionWaiting = false;
  logMsg('迎战「' + RIFT_MON.NAME + '」（强度 ' + tier + '），击败后解除星球运转封锁并领取奖励。', 'info');
}

/* 击败：发灵石 + 星砂，标记已击败（留到下一轮刷新），释放动作槽 */
function riftMonCleared(target) {
  const m = state.riftMon;
  const c = state.skills.combat;
  if (!m || !m.alive) { stopAction(true); return; }
  const rw = riftMonReward(c.riftMon >= 0 ? c.riftMon : m.tier);
  state.gold += rw.gold;
  state.stardust = (state.stardust || 0) + rw.star;
  const seedGain = DYNASTY.SEED_MON_BASE + Math.floor(rw.tier / DYNASTY.SEED_MON_TIER_STEP);
  state.seed = (state.seed || 0) + seedGain;
  m.alive = false;
  logMsg('击败「' + RIFT_MON.NAME + '」（强度 ' + rw.tier + '）！灵石 +' + rw.gold + '、星砂 +' + rw.star +
    '、🌱 生命之种 +' + seedGain +
    '；下一只将在约 ' + Math.max(1, Math.ceil((m.next - Date.now()) / 60000)) + ' 分钟后刷新，期间可正常开启星球运转。', 'good');
  stopAction(true);
}

function spawnTarget() {
  const c = state.skills.combat;
  const m = findMonster(c.monster);
  if (!m) { c.target = null; return; }
  const dg = c.dungeon ? findDungeon(c.dungeon) : null;
  /* 秘境加成：基础倍率 ×（1 + 8% × 当前波次），越深越强 */
  const wave = dg ? 1 + 0.08 * c.floor : 1;
  const hpMul = (dg ? dg.scale.hp : 1) * wave;
  const atkMul = (dg ? dg.scale.atk : 1) * wave;
  c.target = {
    id: m.id, name: m.name, icon: m.icon, lvl: m.lvl,
    hp: Math.round(m.hp * hpMul), maxHp: Math.round(m.hp * hpMul), hit: m.hit, ev: m.ev,
    atkMin: Math.round(m.atkMin * atkMul), atkMax: Math.round(m.atkMax * atkMul),
    dr: m.dr, interval: m.interval,
    dungeon: dg ? dg.id : null, floor: dg ? c.floor : -1
  };
  c.playerTimer = 0;
  c.monsterTimer = 0;
}

function combatTick(dt) {
  const c = state.skills.combat;
  /* 动作槽不在战斗/锁妖塔/异界裂缝/属性裂缝/裂缝怪物 → 战斗必须停止（防止切换技能后仍在后台打怪） */
  const towerMode = !!(state.action && state.action.skill === 'tower');
  const riftMode = !!(state.action && state.action.skill === 'rift');
  const elemMode = !!(state.action && state.action.skill === 'elem');
  const riftMonMode = !!(state.action && state.action.skill === 'riftmon');
  if (!state.action || (state.action.skill !== 'combat' && !towerMode && !riftMode && !elemMode && !riftMonMode)) {
    if (c.monster || c.target || c.dungeon || c.tower || c.rift >= 0 || c.elem >= 0 || c.riftMon >= 0) cancelCombat();
    return;
  }

  /* 锁妖塔 / 异界裂缝 / 属性裂缝 / 裂缝怪物：一只目标，不刷新、不循环；目标死亡后等待结算 */
  if (towerMode || riftMode || elemMode || riftMonMode) {
    if (towerMode && !c.tower) { c.target = null; return; }
    if (riftMode && c.rift < 0) { c.target = null; return; }
    if (elemMode && c.elem < 0) { c.target = null; return; }
    if (riftMonMode && c.riftMon < 0) { c.target = null; return; }
    if (!c.target || c.target.hp <= 0) { c.target = null; return; }
  } else {
    if (!c.monster) { c.target = null; return; }

    if (!c.target || c.target.hp <= 0) {
      c.target = null;
      c.respawn -= dt;
      if (c.respawn <= 0) { c.respawn = 0; spawnTarget(); }
      return;
    }
  }

  const st = calcStats();

  /* 玩家出手 */
  c.playerTimer += dt;
  let guard = 0;
  while (c.playerTimer >= st.attackTime && guard++ < 100) {
    c.playerTimer -= st.attackTime;
    const t = c.target;
    if (Math.random() < hitChance(st.hit, t.ev)) {
      const dmg = Math.max(1, Math.round(rollRange(st.atkMin, st.atkMax) * (1 - t.dr)));
      t.hp -= dmg;
      if (t.hp <= 0) { onMonsterKilled(t); break; }
    }
  }

  if (!c.target) return;   /* 目标已被击杀 */

  /* 怪物出手 */
  c.monsterTimer += dt;
  guard = 0;
  const t = c.target;
  while (c.monsterTimer >= t.interval && guard++ < 100) {
    c.monsterTimer -= t.interval;
    if (Math.random() < hitChance(t.hit, st.ev)) {
      const dmg = Math.max(1, Math.round(rollRange(t.atkMin, t.atkMax) * (1 - st.dr)));
      state.hp -= dmg;
      if (state.hp <= 0) { onPlayerDeath(t); break; }
    }
  }
}

function onMonsterKilled(target) {
  const c = state.skills.combat;
  /* 裂缝怪物：击败即结算灵石 + 星砂，并标记已击败（留到下一轮刷新） */
  if (state.action && state.action.skill === 'riftmon') {
    riftMonCleared(target);
    return;
  }
  /* 五行属性裂缝：击杀即修复，发对应材料并释放动作槽 */
  if (state.action && state.action.skill === 'elem') {
    elemRiftCleared(target);
    return;
  }
  /* 异界裂缝：击杀即修复，立刻发奖并释放动作槽 */
  if (state.action && state.action.skill === 'rift') {
    riftCleared(c.rift, target);
    return;
  }
  /* 锁妖塔：击杀只解锁「可领奖」，实际奖励在玩家点击领取时结算 */
  if (c.tower || (state.action && state.action.skill === 'tower')) {
    towerCleared(target.tower || c.tower, target);
    return;
  }

  const m = findMonster(target.id);
  if (!m) { c.target = null; return; }

  const dg = c.dungeon ? findDungeon(c.dungeon) : null;
  const gold = Math.round(randInt(m.gold[0], m.gold[1]) * (dg ? dg.scale.gold : 1) *
    masteryYield(m.id) * (1 + formBonus('gold') + worldBonus('gold')));
  state.gold += gold;
  state.stats.kills += 1;
  addXp('combat', Math.round(m.xp * (dg ? dg.scale.xp : 1)));
  addMastery(m.id, Math.max(1, Math.round(m.xp * CONFIG.MASTERY_XP_RATIO * (1 + formBonus('mastery') + worldBonus('mastery')))));

  const drops = [];
  const dropMul = 1 + formBonus('drop') + worldBonus('drop') + elemBonus('combat', 'drop');
  const dbl = doubleChance(m.id, 'combat');
  m.drops.forEach(function (d) {
    if (Math.random() < Math.min(1, d.chance * dropMul)) {
      /* 精通：该妖兽的掉落有概率翻倍 */
      let qty = d.qty || 1;
      let tag = '';
      if (Math.random() < dbl) { qty *= 2; tag = '（精通·双倍）'; }
      invAdd(d.id, qty);
      drops.push(qty + ' × ' + itemIcon(d.id) + itemName(d.id) + tag);
    }
  });

  logMsg('击败「' + m.name + '」' + (dg ? '（' + dg.name + ' 第 ' + (c.floor + 1) + '/' + dg.floors.length + ' 波）' : '') +
    '，灵石 +' + gold + (drops.length ? '，掉落：' + drops.join('、') : ''), 'kill');

  c.target = null;
  c.playerTimer = 0;
  c.monsterTimer = 0;

  if (dg) {
    /* 秘境：推进到下一波；清完最后一波 → 结算通关奖励并从头循环 */
    c.floor += 1;
    if (c.floor >= dg.floors.length) {
      c.floor = 0;
      dungeonReward(dg);
    }
    c.monster = dg.floors[c.floor];
    c.respawn = 1.2;
    return;
  }
  c.respawn = m.respawn || CONFIG.RESPAWN_TIME;
}

function onPlayerDeath(target) {
  const c = state.skills.combat;
  if (!target) { c.target = null; return; }
  state.hp = 1;
  state.stats.deaths += 1;
  const towerFloor = c.tower;
  const riftTier = (state.action && state.action.skill === 'rift') ? c.rift : -1;
  const elemIdx = (state.action && state.action.skill === 'elem') ? c.elem : -1;
  const riftMonOn = (state.action && state.action.skill === 'riftmon') ? c.riftMon : -1;
  const dg = c.dungeon ? findDungeon(c.dungeon) : null;
  if (riftMonOn >= 0) {
    /* 裂缝怪物阵亡：怪物不消耗、强度不降，可回血后原地重试 */
    logMsg('「' + RIFT_MON.NAME + '」挑战失败，怪物未被消耗、强度不降；' +
      '疗伤后可原地重试（不惩罚）。', 'bad');
  } else if (riftTier >= 0) {
    /* 裂缝阵亡只判本次修复失败：未修复状态保留，不扣穿越次数，可回血后原地重试 */
    logMsg('在异界裂缝第 ' + riftTier + ' 层被「' + target.name + '」击退，裂缝仍未修复；' +
      '疗伤后可原地重试（不惩罚、不清零穿越次数）。', 'bad');
  } else if (elemIdx >= 0) {
    /* 属性裂缝阵亡：裂缝不消耗、不降级，位置保留，可回血后原地重试 */
    const slot = state.elemRifts && state.elemRifts.slots ? state.elemRifts.slots[elemIdx] : null;
    const el = slot ? findElemRift(slot.elem) : null;
    logMsg('「' + (el ? el.name : '') + '·时空裂缝」修复失败，裂缝未被消耗、不降级；' +
      '疗伤后可原地重试（不惩罚）。', 'bad');
  } else if (towerFloor) {
    /* 阵亡只判本次挑战失败：层数不降、不产生 pending，可直接重试同一层 */
    state.tower.failed = true;
    logMsg('在锁妖塔第 ' + towerFloor + ' 层被「' + target.name + '」击退，本次挑战失败；' +
      '层数不降，疗伤后可再次挑战第 ' + towerFloor + ' 层。', 'bad');
  } else if (dg) {
    logMsg('在秘境「' + dg.name + '」第 ' + (c.floor + 1) + ' 波被「' + target.name + '」击退，秘境挑战失败。', 'bad');
  } else {
    logMsg('你被「' + target.name + '」击退，重伤返回洞府。先疗伤或备好食物再战。', 'bad');
  }
  /* 战败自动退出战斗动作槽并疗伤；秘境 / 锁妖塔 / 异界裂缝 / 属性裂缝 / 裂缝怪物同时判定为失败 */
  if (state.action && (state.action.skill === 'combat' || state.action.skill === 'tower' || state.action.skill === 'rift' || state.action.skill === 'elem' || state.action.skill === 'riftmon')) stopAction(true);
  cancelCombat();
}

/* ------------------------------------------------------------ 常驻被动 */
function growPlots(dt) {
  const fs = state.skills.farming;
  /* 生长加速：阵法/洞天，以及「播种」精通（每级 -0.2% 生长时间，上限 -20%） */
  const mul = (1 + formBonus('growth') + worldBonus('growth')) *
    (1 + Math.min(0.20, masteryOf('farm_plant').lvl * CONFIG.MASTERY_TIME_PER_LVL));
  const np = FARMING_PLOT_REQS.length;
  for (let i = 0; i < np; i++) {
    const p = state.plots[i];
    if (!p || !p.seedId || p.ready) continue;
    const seed = findSeed(p.seedId);
    if (!seed) continue;
    p.growth += dt * mul;
    if (p.growth >= seed.growTime) { p.growth = seed.growTime; p.ready = true; }
  }
}

function passiveTick(dt) {
  /* 眩晕倒计时（入世被识破）：期间无法开始新动作，离线同样推进 */
  if (state.stun > 0) {
    state.stun = Math.max(0, state.stun - dt);
    if (state.stun === 0) logMsg('缓过神来，可以继续行动了。', 'info');
  }

  /* 灵力自然凝聚（不占用动作槽，受聚灵阵加成） */
  state.spirit += CONFIG.SPIRIT_PER_SEC * (1 + formBonus('spirit') + worldBonus('spirit')) * dt;

  /* 灵植地块：被动生长，离线同样推进 */
  growPlots(dt);

  /* 脱战回血 */
  if (!state.skills.combat.monster) {
    state.regenTimer += dt;
    let guard = 0;
    while (state.regenTimer >= CONFIG.HP_REGEN_INTERVAL && guard++ < 50) {
      state.regenTimer -= CONFIG.HP_REGEN_INTERVAL;
      if (state.hp < maxHp()) {
        const h = Math.max(1, Math.round(maxHp() * CONFIG.HP_REGEN_RATIO * (1 + formBonus('regen') + worldBonus('regen'))));
        state.hp = Math.min(maxHp(), state.hp + h);
      }
    }
  } else {
    state.regenTimer = 0;
  }
}

/* ---------------------------------------------------------------- 自动进食 */
function chooseFood() {
  const cfg = state.ui.eatFood;
  if (cfg !== 'auto' && ITEMS[cfg] && ITEMS[cfg].type === 'food' && invCount(cfg) > 0) return cfg;
  let best = null, bestHeal = -1;
  Object.keys(state.inv).forEach(function (id) {
    const it = ITEMS[id];
    if (!it || it.type !== 'food' || state.inv[id] <= 0) return;
    if ((it.heal || 0) > bestHeal) { bestHeal = it.heal || 0; best = id; }
  });
  return best;
}

function autoEatTick() {
  if (!state.ui.autoEat) return;
  const c = state.skills.combat;
  if (!c.monster || !c.target) return;
  if (state.hp / maxHp() > state.ui.eatRatio) return;
  const id = chooseFood();
  if (!id) return;
  eatFood(id, 1, true);
}

function eatFood(itemId, qty, silent) {
  const it = ITEMS[itemId];
  if (!it || it.type !== 'food') return 0;
  const have = invCount(itemId);
  if (have < 1) return 0;
  const healPer = it.heal || 0;

  /* 批量食用：只吃到满血为止，多吃的部分是浪费 */
  let n = (qty === -1 || qty === undefined) ? have : Math.floor(Number(qty) || 1);
  n = Math.min(n, have);
  if (healPer > 0) {
    const need = Math.ceil((maxHp() - state.hp) / healPer);
    if (need < 1) { logMsg('生命已满，无需进食。', 'info'); return 0; }
    n = Math.min(n, need);
  }
  if (n < 1) return 0;

  invRemove(itemId, n);
  state.hp = Math.min(maxHp(), state.hp + healPer * n);
  const heal = healPer * n;
  if (!silent) logMsg('食用「' + it.name + '」×' + n + '，恢复 ' + heal + ' 点生命。', 'heal');
  else if (!OFFLINE_MODE) logMsg('自动进食「' + it.name + '」，恢复 ' + heal + ' 点生命。', 'heal');
  return n;
}

function healWithSpirit() {
  if (state.spirit < CONFIG.HEAL_SPIRIT_COST) {
    logMsg('灵力不足，疗伤需 ' + CONFIG.HEAL_SPIRIT_COST + ' 灵力。', 'warn');
    return false;
  }
  state.spirit -= CONFIG.HEAL_SPIRIT_COST;
  const heal = Math.round(maxHp() * 0.4);
  state.hp = Math.min(maxHp(), state.hp + heal);
  logMsg('运转灵力疗伤，恢复 ' + heal + ' 点生命。', 'heal');
  return true;
}

/* ------------------------------------------------------------ 丹药使用 */
/* qty：要服用的枚数；-1 = 全部。返回实际消耗的枚数。 */
function usePill(itemId, qty) {
  const it = ITEMS[itemId];
  if (!it || it.type !== 'pill') return 0;

  if (it.use === 'break') {
    logMsg('「' + it.name + '」需在「修炼」面板冲击境界时自动消耗。', 'info');
    return 0;
  }

  const have = invCount(itemId);
  if (have < 1) return 0;
  let n = (qty === -1 || qty === undefined) ? have : Math.floor(Number(qty) || 1);
  n = Math.min(n, have);

  if (it.use === 'cult') {
    const gainPer = Math.round(40 * (1 + realmIndex() * 4));
    invRemove(itemId, n);
    /* 除以加成后再交给 addXp，保证实际注入的修为恰好为 gainPer × n */
    addXp('cultivation', gainPer * n / xpMul('cultivation'));
    logMsg('服下「' + it.name + '」×' + n + '，修为 +' + (gainPer * n) + '。', 'levelup');
  } else if (it.use === 'heal') {
    const healPer = Math.round(maxHp() * 0.65);
    const need = Math.ceil((maxHp() - state.hp) / healPer);
    if (need < 1) { logMsg('生命已满，无需服用。', 'info'); return 0; }
    n = Math.min(n, need);
    invRemove(itemId, n);
    state.hp = Math.min(maxHp(), state.hp + healPer * n);
    logMsg('服下「' + it.name + '」×' + n + '，恢复 ' + (healPer * n) + ' 点生命。', 'heal');
  } else if (it.use === 'wudao') {
    invRemove(itemId, n);
    state.insight += n;
    logMsg('服下「' + it.name + '」×' + n + '，悟性提升至 ' + state.insight +
      '（修炼 +' + state.insight + '% / 突破 +' + state.insight + '%）。', 'levelup');
  } else {
    return 0;
  }
  return n;
}

/* ------------------------------------------------------------ 玩家操作接口 */

/* 种植：消耗 1 枚种子，在地块 idx 种下 */
function plantSeed(plotIdx, seedId) {
  if (!plotUnlocked(state.skills.farming.lvl, plotIdx)) {
    logMsg('该地块尚未解锁。', 'warn');
    return false;
  }
  const seed = findSeed(seedId);
  if (!seed) return false;
  if (state.skills.farming.lvl < seed.req) {
    logMsg('灵植造诣不足，「' + seed.name + '」需灵植 Lv.' + seed.req + '。', 'warn');
    return false;
  }
  if (!invHas(seedId, 1)) { logMsg('没有「' + seed.name + '」可种。', 'warn'); return false; }
  const p = state.plots[plotIdx];
  if (p.seedId) { logMsg('该地块已有灵植，不能再种。', 'warn'); return false; }

  invRemove(seedId, 1);
  p.seedId = seedId;
  p.growth = 0;
  p.ready = false;

  addXp('farming', seed.growTime * 0.4);   /* 经验 ~ 种子生长时间的 40% */
  addMastery('farm_plant', Math.max(1, Math.round(seed.growTime * 0.3)));
  logMsg('种下「' + seed.name + '」，静待它成熟。', 'gather');
  return true;
}

/* 收获：收取成熟地块的产出 */
function harvestPlot(plotIdx) {
  if (!plotUnlocked(state.skills.farming.lvl, plotIdx)) { logMsg('该地块尚未解锁。', 'warn'); return false; }
  const p = state.plots[plotIdx];
  if (!p.seedId) { logMsg('该地块空空如也。', 'warn'); return false; }
  if (!p.ready) { logMsg('灵植尚未成熟。', 'warn'); return false; }
  const seed = findSeed(p.seedId);
  if (!seed) { p.seedId = null; p.growth = 0; p.ready = false; return false; }

  let qty = seed.yield;
  let bonus = '';
  if (Math.random() < doubleChance('farm_harvest', 'farming')) { qty *= 2; bonus = '（精通·双倍）'; }
  /* 灵植为地块被动生长，不吃速度加成；五行相合时改为提高单次收获量 */
  if (Math.random() < elemBonus('farming', 'drop')) { qty += 1; bonus += '（信徒·额外）'; }
  invAdd(seed.outId, qty);
  state.stats.gathered += 1;
  state.stats.perSkill.farming = (state.stats.perSkill.farming || 0) + 1;
  if (!OFFLINE_MODE) logMsg('收获 ' + qty + ' × ' + itemIcon(seed.outId) + itemName(seed.outId) + bonus, 'gather');

  p.seedId = null;
  p.growth = 0;
  p.ready = false;

  addXp('farming', seed.growTime * 0.6);   /* 收获经验 ~ 生长时间的 60% */
  addMastery('farm_harvest', Math.max(1, Math.round(seed.growTime * 0.4)));
  return true;
}

function startAction(skillId, actionId) {
  const def = findActivity(skillId, actionId);
  if (!def) return;

  /* 眩晕中无法开始新动作 */
  if (state.stun > 0) { logMsg('眩晕中，还需 ' + Math.ceil(state.stun) + ' 秒才能行动。', 'warn'); return; }

  /* 已经在该动作 → 视为停止 */
  if (state.action && state.action.skill === skillId && state.action.id === actionId) {
    stopAction();
    return;
  }

  const s = state.skills[skillId];
  if (s && def.req && s.lvl < def.req) {
    logMsg((SKILLS[skillId] ? SKILLS[skillId].name : '') + '等级不足，需 Lv.' + def.req + '。', 'warn');
    return;
  }
  if (skillId === 'combat') return;   /* 战斗走 startCombat */

  /* 切换动作前先彻底结束战斗与星球巡航，避免它们在后台继续 */
  planetInterrupt();
  cancelCombat();
  state.action = { skill: skillId, id: actionId };
  state.actionExplicit = true;   /* 玩家主动开启：读档时才允许恢复 */
  state.actionTimer = 0;
  state.actionCur = 0;
  state.actionWaiting = false;
  logMsg('开始「' + def.name + '」', 'info');
  if (def.in && def.in.length && !matsOk(def)) logMsg('材料不足，「' + def.name + '」正在等待材料…', 'warn');
}

/* 清空一切战斗状态（结束战斗/秘境时调用） */
function cancelCombat() {
  const c = state.skills.combat;
  c.monster = null;
  c.target = null;
  c.dungeon = null;
  c.floor = 0;
  c.tower = 0;          /* 锁妖塔挑战同样属于战斗瞬态，一并清空 */
  c.rift = -1;          /* 异界裂缝 -1 表示不在裂缝内 */
  c.elem = -1;          /* 五行属性裂缝：槽位下标，-1 表示不在裂缝内 */
  c.elemRw = null;      /* 属性裂缝的奖励快照（瞬态） */
  c.riftMon = -1;       /* 裂缝怪物：挑战中的强度，-1 表示不在战斗 */
  c.playerTimer = 0;
  c.monsterTimer = 0;
  c.respawn = 0;
}

/* silent=true 时不写日志（材料耗尽中止、切换动作等） */
function stopAction(silent) {
  planetInterrupt();
  cancelCombat();
  state.action = null;
  state.actionExplicit = false;
  state.actionTimer = 0;
  state.actionCur = 0;
  state.actionWaiting = false;
  if (!silent) logMsg('已停止当前动作。', 'info');
}

function startCombat(monsterId) {
  const m = findMonster(monsterId);
  if (!m) return;

  /* 眩晕中无法进入战斗 */
  if (state.stun > 0) { logMsg('眩晕中，还需 ' + Math.ceil(state.stun) + ' 秒才能行动。', 'warn'); return; }

  /* 进入战斗会占用动作槽，先结束星球巡航并清空其飞行队列 */
  planetInterrupt();

  /* 再次点击同一目标 → 停止 */
  if (state.action && state.action.skill === 'combat' && state.action.id === monsterId) {
    stopAction();
    return;
  }

  const c = state.skills.combat;
  /* 从锁妖塔 / 异界裂缝 / 属性裂缝 / 裂缝怪物切到普通战斗：战况是瞬态，直接清空，不残留目标 */
  if (c.tower || c.rift >= 0 || c.elem >= 0 || c.riftMon >= 0 || (state.action && (state.action.skill === 'tower' || state.action.skill === 'rift' || state.action.skill === 'elem' || state.action.skill === 'riftmon'))) cancelCombat();
  if (state.action && state.action.skill === 'combat' && state.action.id !== monsterId) cancelCombat();
  c.monster = monsterId;
  c.respawn = 0;
  spawnTarget();
  state.action = { skill: 'combat', id: monsterId };
  state.actionTimer = 0;
  state.actionWaiting = false;
  logMsg('挑战「' + m.name + '」（Lv.' + m.lvl + '）', 'info');
}

/* 进入秘境：按解锁条件与战斗等级校验，从第 1 波开打 */
function startDungeon(dungeonId) {
  const dg = findDungeon(dungeonId);
  if (!dg) return;

  if (state.stun > 0) { logMsg('眩晕中，还需 ' + Math.ceil(state.stun) + ' 秒才能行动。', 'warn'); return; }

  const u = dungeonUnlockInfo(dg);
  if (!u.unlocked) {
    logMsg('秘境「' + dg.name + '」尚未开启：需' + u.text + '（' + fmtCount(u.have) + '/' + fmtCount(u.need) + '）。', 'warn');
    return;
  }
  if (state.skills.combat.lvl < dg.req) {
    logMsg('进入「' + dg.name + '」需战斗 Lv.' + dg.req + '，当前 Lv.' + state.skills.combat.lvl + '。', 'warn');
    return;
  }

  /* 进入秘境会占用动作槽，先结束星球巡航并清空其飞行队列 */
  planetInterrupt();

  /* 再次点击同一秘境 → 停止 */
  if (state.action && state.action.skill === 'combat' && state.action.id === dg.id) {
    stopAction();
    return;
  }

  const c = state.skills.combat;
  cancelCombat();
  c.dungeon = dg.id;
  c.floor = 0;
  c.monster = dg.floors[0];
  spawnTarget();
  state.action = { skill: 'combat', id: dg.id };
  state.actionTimer = 0;
  state.actionWaiting = false;
  logMsg('进入秘境「' + dg.name + '」（共 ' + dg.floors.length + ' 波，通关自动循环）', 'info');
}

/* ---------------------------------------------------------------- 突破 */
function breakPreview() {
  const s = state.skills.cultivation;
  const bi = breakInfo(s.lvl - 1);
  if (!bi) return { max: true };
  const rate = clamp(bi.rate + state.insight * 0.01, 0.05, 0.98);
  return {
    max: false,
    need: bi.need,
    xp: s.xp,
    xpOk: s.xp >= bi.need,
    pill: bi.pill,
    pillOk: !bi.pill || invCount(bi.pill) >= 1,
    gold: bi.gold,
    goldOk: state.gold >= bi.gold,
    wx: (state.skills.cultivation.lvl === 32) ? wuxingNeed() : null,
    rate: rate,
    boundary: bi.boundary,
    next: realmInfo(s.lvl + 1)
  };
}

/* 五行灵根需求：仅炼虚后期冲击炼虚大圆满（lvl 32→33）时生效 */
function wuxingNeed() {
  if (state.skills.cultivation.lvl !== 32) return null;
  const req = WUXING.map(function (w) {
    return { w: w, lvl: state.skills[w.skill].lvl };
  });
  const lacks = req.filter(function (r) { return r.lvl < 100; });
  return { lacks: lacks, ok: lacks.length === 0 };
}

function breakthrough() {
  const s = state.skills.cultivation;
  const bi = breakInfo(s.lvl - 1);
  if (!bi) { logMsg('已臻修行尽头，再无瓶颈。', 'warn'); return false; }
  if (s.xp < bi.need) {
    logMsg('修为不足，尚需 ' + Math.ceil(bi.need - s.xp) + ' 点修为方可冲击瓶颈。', 'warn');
    return false;
  }
  if (bi.pill && invCount(bi.pill) < 1) { logMsg('突破需「' + itemName(bi.pill) + '」。', 'warn'); return false; }
  if (bi.gold > 0 && state.gold < bi.gold) { logMsg('突破需 ' + bi.gold + ' 灵石。', 'warn'); return false; }
  const wx = wuxingNeed();
  if (wx && !wx.ok) {
    const txt = wx.lacks.map(function (r) { return r.w.name + '·' + SKILLS[r.w.skill].name + ' Lv.' + r.lvl; }).join('、');
    logMsg('炼虚大圆满需五行灵根全部 Lv.100，尚缺：' + txt + '。', 'warn');
    return false;
  }

  /* 消耗（无论成败均消耗） */
  if (bi.pill) invRemove(bi.pill, 1);
  if (bi.gold > 0) state.gold -= bi.gold;

  const rate = clamp(bi.rate + state.insight * 0.01, 0.05, 0.98);
  if (Math.random() < rate) {
    s.lvl += 1;
    s.xp = 0;
    s.capped = false;
    state.stats.breaks += 1;
    state.hp = maxHp();
    const r = realmInfo(s.lvl);
    logMsg('突破成功！境界晋入「' + r.full + '」。' + (bi.boundary ? ' 一身修为蜕凡为仙。' : ''), 'levelup');
  } else {
    s.xp = Math.floor(bi.need * (1 - CONFIG.BREAK_FAIL_LOSS));
    logMsg('突破失败，气息紊乱，修为跌落至 ' + Math.floor(s.xp) + '，来日再试。', 'bad');
  }
  clampHp();
  return true;
}

/* ---------------------------------------------------------------- 任务 */
/* 系统状态读数：任务进度 / 市集解锁共用的唯一口径 */
function dynPostCount() {
  let n = 0;
  state.world.dynasties.forEach(function (d) {
    DYNASTY.POST_ORDER.forEach(function (role) { if (d.posts && d.posts[role]) n += 1; });
  });
  return n;
}
function dynMaxEra() {
  let m = 0;
  state.world.dynasties.forEach(function (d) { if (d.dyn > m) m = d.dyn; });
  return state.world.dynasties.length ? m + 1 : 0;   // 返回「第几朝」，1 起算
}
/* 道侣对数：活跃（alive）关系按双向记录折半；化道 / 亡故不计 */
function daoPairs() {
  let n = 0;
  state.disciples.owned.forEach(function (x) {
    (x.dao || []).forEach(function (r) { if (r && r.state === 'alive') n += 1; });
  });
  return Math.floor(n / 2);
}
/* 阵纹等级合计（所有阵法、所有阵纹） */
function formTotalLevel() {
  let n = 0;
  FORMATIONS.forEach(function (f) {
    const st = state.formations[f.id];
    if (!st || !Array.isArray(st.levels)) return;
    st.levels.forEach(function (v) { n += v || 0; });
  });
  return n;
}
function maxMasteryLevel() {
  let m = 0;
  Object.keys(state.mastery).forEach(function (id) {
    const v = state.mastery[id] && state.mastery[id].lvl;
    if (v > m) m = v;
  });
  return m;
}
function totalDungeonClears() {
  let n = 0;
  Object.keys(state.dungeons).forEach(function (id) { n += state.dungeons[id] || 0; });
  return n;
}
function discTierCount(tier) {
  let n = 0;
  state.disciples.owned.forEach(function (x) { if (x.tier >= tier) n += 1; });
  return n;
}
/* 条件判定（任务 + 市集解锁共用） */
function condDone(c) {
  if (!c) return true;
  switch (c.type) {
    case 'gathered': return state.stats.gathered >= c.n;
    case 'kills': return state.stats.kills >= c.n;
    case 'crafts': return state.stats.crafts >= c.n;
    case 'pills': return state.stats.pills >= c.n;
    case 'breaks': return state.stats.breaks >= c.n;
    case 'level': return !!state.skills[c.skill] && state.skills[c.skill].lvl >= c.lvl;
    case 'realm': return state.skills.cultivation.lvl >= c.stage;
    case 'item': return (state.stats.gained[c.id] || 0) >= c.qty;
    case 'tower': return state.tower.best >= c.n;
    case 'cross': return (state.planet.cross || 0) >= c.n;
    case 'dynasty': return state.world.dynasties.length >= c.n;
    case 'era': return dynMaxEra() >= c.n;
    case 'post': return dynPostCount() >= c.n;
    case 'dao': return daoPairs() >= c.n;
    case 'form': return formTotalLevel() >= c.n;
    case 'world': return worldLevel() >= c.n;
    case 'mastery': return maxMasteryLevel() >= c.lvl;
    case 'disciple': return state.disciples.owned.length >= c.n;
    case 'dtier': return discTierCount(c.tier || 4) >= c.n;
    case 'dungeon': return totalDungeonClears() >= c.n;
    case 'checkin': return (state.checkin.total || 0) >= c.n;
    case 'alllevel': {
      const list = c.skills || TASK_PROD_SKILLS;
      let ok = 0;
      list.forEach(function (id) { if (state.skills[id] && state.skills[id].lvl >= c.lvl) ok += 1; });
      return ok >= list.length;
    }
    default: return false;
  }
}
function taskDone(t) { return condDone(t.cond); }

/* 任务进度文本（data-taskprog 增量刷新用）；无进度概念时返回空串 */
function taskProgress(t) {
  const c = t.cond;
  switch (c.type) {
    case 'realm': {
      const have = state.skills.cultivation.lvl;
      return '进度 ' + realmInfo(have).full + ' / 目标 ' + realmInfo(c.stage).full;
    }
    case 'level': {
      const have = state.skills[c.skill] ? state.skills[c.skill].lvl : 1;
      return '进度 Lv.' + have + ' / ' + c.lvl;
    }
    case 'alllevel': {
      const list = c.skills || TASK_PROD_SKILLS;
      let ok = 0;
      list.forEach(function (id) { if (state.skills[id] && state.skills[id].lvl >= c.lvl) ok += 1; });
      return '进度 ' + ok + ' / ' + list.length + ' 项达 Lv.' + c.lvl;
    }
    case 'tower': return '进度 ' + Math.min(state.tower.best, c.n) + ' / ' + c.n + ' 层';
    case 'cross': return '进度 ' + Math.min(state.planet.cross || 0, c.n) + ' / ' + c.n + ' 次';
    case 'dynasty': return '进度 ' + Math.min(state.world.dynasties.length, c.n) + ' / ' + c.n + ' 座';
    case 'era': return '进度 最高第 ' + Math.min(dynMaxEra(), c.n) + ' 朝 / 第 ' + c.n + ' 朝';
    case 'post': return '进度 ' + Math.min(dynPostCount(), c.n) + ' / ' + c.n + ' 位';
    case 'dao': return '进度 ' + Math.min(daoPairs(), c.n) + ' / ' + c.n + ' 对';
    case 'form': return '进度 ' + Math.min(formTotalLevel(), c.n) + ' / ' + c.n + ' 级';
    case 'world': return '进度 ' + Math.min(worldLevel(), c.n) + ' / ' + c.n;
    case 'mastery': return '进度 Lv.' + Math.min(maxMasteryLevel(), c.lvl) + ' / ' + c.lvl;
    case 'disciple': return '进度 ' + Math.min(state.disciples.owned.length, c.n) + ' / ' + c.n + ' 位';
    case 'dtier': return '进度 ' + Math.min(discTierCount(c.tier || 4), c.n) + ' / ' + c.n + ' 位';
    case 'dungeon': return '进度 ' + Math.min(totalDungeonClears(), c.n) + ' / ' + c.n + ' 次';
    case 'checkin': return '进度 ' + Math.min(state.checkin.total || 0, c.n) + ' / ' + c.n + ' 天';
    case 'gathered': return '进度 ' + Math.min(state.stats.gathered, c.n) + ' / ' + c.n;
    case 'kills': return '进度 ' + Math.min(state.stats.kills, c.n) + ' / ' + c.n;
    case 'crafts': return '进度 ' + Math.min(state.stats.crafts, c.n) + ' / ' + c.n;
    case 'pills': return '进度 ' + Math.min(state.stats.pills, c.n) + ' / ' + c.n;
    case 'breaks': return '进度 ' + Math.min(state.stats.breaks, c.n) + ' / ' + c.n;
    case 'item': return '进度 ' + Math.min(state.stats.gained[c.id] || 0, c.qty) + ' / ' + c.qty;
    default: return '';
  }
}

function checkTasks() {
  TASKS.forEach(function (t) {
    const rec = state.tasks[t.id] || (state.tasks[t.id] = { done: false, claimed: false });
    if (!rec.done && taskDone(t)) {
      rec.done = true;
      logMsg('任务达成：「' + t.name + '」，可前往任务面板领取奖励。', 'good');
    }
  });
}

/* 任务奖励里的信徒：仓库容量校验 + 随机抽取指定品阶（与签到同一逻辑） */
function taskTryGrantDisciple(tier) {
  const cap = discipleStoreCap();
  if (cap <= 0 || discipleTotal() >= cap) return null;
  const pool = DISCIPLES.filter(function (d) { return d.tier === (tier || 4); });
  if (!pool.length) return null;
  const cat = pool[Math.floor(Math.random() * pool.length)];
  const inst = newDiscInstance(cat.id);
  if (!inst) return null;
  state.disciples.owned.push(inst);
  return inst;
}

function claimTask(id) {
  const t = findTask(id);
  const rec = state.tasks[id];
  if (!t || !rec || !rec.done || rec.claimed) return false;

  /* 信徒奖励需要招贤殿空位：不足时拒绝领取，保留可领取状态，避免奖励丢失 */
  if (t.reward.disciple) {
    const cap = discipleStoreCap();
    if (cap <= 0) {
      logMsg('需先营造「招贤殿」并腾出仓库空位，才能领取「' + t.name + '」的信徒奖励。', 'warn');
      return false;
    }
    if (discipleTotal() >= cap) {
      logMsg('信徒仓库已满（' + discipleTotal() + ' / ' + cap + '），请先遣散或腾位后再领取。', 'warn');
      return false;
    }
  }

  rec.claimed = true;
  if (t.reward.gold) state.gold += t.reward.gold;
  if (t.reward.spirit) state.spirit += t.reward.spirit;
  if (t.reward.stardust) state.stardust = (state.stardust || 0) + t.reward.stardust;
  if (t.reward.seed) state.seed = (state.seed || 0) + t.reward.seed;
  if (t.reward.items) t.reward.items.forEach(function (i) { invAdd(i.id, i.qty); });
  if (t.reward.disciple) {
    const inst = taskTryGrantDisciple(t.reward.disciple.tier);
    if (inst) {
      const cat = findDisciple(inst.id);
      logMsg('任务奖励：神品信徒「' + (cat ? cat.name : inst.id) + '」已入驻招贤殿。', 'good');
    }
  }
  logMsg('领取任务奖励：「' + t.name + '」。', 'good');
  return true;
}

/* ------------------------------------------------------------ 问道指引（v2.14.0）
   轻量教学清单：只推进「第一个未完成步骤」，玩家实际做出行为才打勾；
   完成即自动发奖（星砂 / 生命之种 / 丹药），不发灵石。
   旧档推断（guideInfer）只打勾不补奖，避免一次性资源注入。 */
function guideDoneCount() {
  if (!state || !state.guide) return 0;
  let n = 0;
  GUIDE_STEPS.forEach(function (s) { if (state.guide.done[s.id]) n += 1; });
  return n;
}
function guideCurrent() {
  if (!state || !state.guide) return null;
  for (let i = 0; i < GUIDE_STEPS.length; i++) {
    if (!state.guide.done[GUIDE_STEPS[i].id]) return GUIDE_STEPS[i];
  }
  return null;
}
function guideFinished() { return !guideCurrent(); }
/* 当前步骤是否已被玩家行为满足 */
function guideStepDone(step) {
  if (!step) return false;
  if (step.flag) return !!(state.guide.flags && state.guide.flags[step.flag]);
  return !!(step.cond && condDone(step.cond));
}
function guideGrant(step) {
  const r = step.reward || {};
  if (r.stardust) state.stardust = (state.stardust || 0) + r.stardust;
  if (r.seed) state.seed = (state.seed || 0) + r.seed;
  (r.items || []).forEach(function (i) { invAdd(i.id, i.qty); });
}
/* 行为标记：打开背包 / 市集、完成一次购买等 */
function guideFlag(key) {
  if (!state || !state.guide || !key) return;
  if (state.guide.flags[key]) return;
  state.guide.flags[key] = true;
  guideSync();
}
/* 推进检查：按顺序连续完成所有已满足的步骤 */
function guideSync() {
  if (!state || !state.guide) return;
  let guard = 0;
  while (guard < GUIDE_STEPS.length + 1) {
    guard += 1;
    const cur = guideCurrent();
    if (!cur || !guideStepDone(cur)) return;
    state.guide.done[cur.id] = true;
    guideGrant(cur);
    logMsg('问道指引：完成「' + cur.title + '」，奖励已发放。', 'good');
  }
}
/* 旧档推断：按现有进度把已完成/明显越过的前置步骤补勾（不补奖） */
function guideInfer() {
  if (!state || !state.guide) return;
  let last = -1;
  GUIDE_STEPS.forEach(function (s, i) {
    if (s.cond && condDone(s.cond)) last = i;
  });
  /* 已经明显进入中期的老存档，视为已完成前 6 步（修炼/采集/背包/市集/购买/战斗），
     避免让老玩家从教学第一步重新点起 */
  const advanced = state.skills.cultivation.lvl >= 15 ||
    state.stats.gathered >= 50 ||
    (state.stats.kills || 0) >= 10 ||
    worldLevel() >= 10;
  if (advanced) last = Math.max(last, 5);
  if ((state.planet.cross || 0) > 0) last = GUIDE_STEPS.length - 1;
  GUIDE_STEPS.forEach(function (s, i) {
    if (i <= last && !state.guide.done[s.id]) {
      state.guide.done[s.id] = true;
      state.guide.inferred[s.id] = true;
    }
  });
}
function guideSkip() {
  if (!state || !state.guide) return;
  state.guide.skipped = true;
  state.guide.closed = true;
  logMsg('已跳过问道指引，可在侧栏「问道」随时查阅或重新开启。', 'info');
}
function guideClose() {
  if (!state || !state.guide) return;
  state.guide.closed = true;
  logMsg('已收起问道提示，侧栏「问道」仍可查看进度。', 'info');
}
function guideReopen() {
  if (!state || !state.guide) return;
  state.guide.skipped = false;
  state.guide.closed = false;
  logMsg('已重新开启问道提示。', 'info');
}
/* 是否需要在右侧常驻卡片里提示（完成 / 跳过 / 收起后都不再打扰） */
function guideNudging() {
  if (!state || !state.guide) return false;
  return !state.guide.skipped && !state.guide.closed && !guideFinished();
}

/* ------------------------------------------------------------ 签到（七日循环）
   判定口径：本地日期（YYYY-MM-DD），每日 00:00 重置。
   - 同一 lastKey → 今日已签，拦截；
   - 日期回退（lastKey 晚于今天）→ 判定时钟异常，拒绝签到且不动进度；
   - 间隔 > 1 天 → 断签，下一次签到从第 1 天开始（惰性计算，改状态只在领取时发生）。 */
function checkinDayKey(ts) {
  const d = new Date(ts == null ? Date.now() : ts);
  const p = function (n) { return n < 10 ? '0' + n : String(n); };
  return d.getFullYear() + '-' + p(d.getMonth() + 1) + '-' + p(d.getDate());
}
/* 两个日期键相差的自然日（按本地 0 点计算，四舍五入吃掉夏令时的 ±1 小时） */
function checkinDayDiff(fromKey, toKey) {
  const a = String(fromKey).split('-'), b = String(toKey).split('-');
  if (a.length !== 3 || b.length !== 3) return 0;
  const ta = new Date(Number(a[0]), Number(a[1]) - 1, Number(a[2])).getTime();
  const tb = new Date(Number(b[0]), Number(b[1]) - 1, Number(b[2])).getTime();
  return Math.round((tb - ta) / 86400000);
}
/* 当前签到状态：state = ready 可签 / done 今日已签 / clockback 时间回退；
   day 为「下一次实际可领的天数」（断签时为 1），broken 仅用于界面提示 */
function checkinPlan() {
  const c = state.checkin;
  const today = checkinDayKey();
  if (!c.lastKey) return { state: 'ready', day: c.day, today: today, diff: 0, broken: false };
  const diff = checkinDayDiff(c.lastKey, today);
  if (diff < 0) return { state: 'clockback', day: c.day, today: today, diff: diff, broken: false };
  if (diff === 0) return { state: 'done', day: c.day, today: today, diff: 0, broken: false };
  if (diff > 1) return { state: 'ready', day: 1, today: today, diff: diff, broken: true };
  return { state: 'ready', day: c.day, today: today, diff: diff, broken: false };
}
function checkinCanClaim() { return checkinPlan().state === 'ready'; }
/* 距离本地 0 点重置的毫秒数（界面倒计时用） */
function checkinNextResetMs() {
  const d = new Date(Date.now());
  const next = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1, 0, 0, 0, 0);
  return Math.max(0, next.getTime() - Date.now());
}
/* 第 7 天大奖：随机抽一位神品信徒入仓。
   不占上阵位、不写招募峰值；必须占用仓库容量（未建招贤殿 / 仓库满 → 返回 null，调用方挂起） */
function checkinTryGrantDisciple() {
  const cap = discipleStoreCap();
  if (cap <= 0 || discipleTotal() >= cap) return null;
  const pool = DISCIPLES.filter(function (d) { return d.tier === 4; });
  if (!pool.length) return null;
  const cat = pool[Math.floor(Math.random() * pool.length)];
  const inst = newDiscInstance(cat.id);
  if (!inst) return null;
  state.disciples.owned.push(inst);
  return inst;
}
/* 领取今日签到：先校验背包格位，再发放资源 / 道具；第 7 天额外处理信徒。
   返回 true 表示领取成功（失败时写日志给出原因） */
function claimCheckin() {
  const plan = checkinPlan();
  if (plan.state === 'done') { logMsg('今日已签到，明日 00:00 后可再签。', 'info'); return false; }
  if (plan.state === 'clockback') {
    logMsg('检测到系统日期早于上次签到日期，请校准系统时间后再签到。', 'warn');
    return false;
  }
  const rec = CHECKIN.DAYS[plan.day - 1];
  if (!rec) return false;

  /* 背包格位：只统计「尚未拥有」的物品（已有物品不占新格），不足则整单拒签，避免奖励丢失 */
  const newKinds = (rec.items || []).filter(function (i) { return invCount(i.id) <= 0; }).length;
  const freeSlots = invCap() - invSlotsUsed();
  if (newKinds > freeSlots) {
    logMsg('背包剩余格位不足（需 ' + newKinds + ' 格，仅剩 ' + freeSlots + ' 格），请清理背包后再签到。', 'warn');
    return false;
  }

  const got = [];
  if (rec.gold) { state.gold += rec.gold; got.push('💠' + rec.gold); }
  if (rec.spirit) { state.spirit += rec.spirit; got.push('✨' + rec.spirit); }
  if (rec.stardust) { state.stardust += rec.stardust; got.push('💫' + rec.stardust); }
  if (rec.seed) { state.seed += rec.seed; got.push('🌱' + rec.seed); }
  (rec.items || []).forEach(function (i) {
    if (invAdd(i.id, i.qty)) got.push(itemName(i.id) + '×' + i.qty);
  });

  let msg = '签到第 ' + plan.day + ' 天「' + rec.name + '」：' + got.join('、');
  if (rec.disciple) {
    const inst = checkinTryGrantDisciple();
    if (inst) {
      const cat = findDisciple(inst.id);
      msg += '；神品信徒「' + (cat ? cat.name : inst.id) + '」已入驻招贤殿';
    } else {
      state.checkin.pending = true;
      msg += '；神品信徒暂存待入仓（需招贤殿空位，腾出后自动补发）';
    }
  }

  const c = state.checkin;
  c.lastKey = plan.today;
  c.day = plan.day >= CHECKIN.CYCLE ? 1 : plan.day + 1;
  c.total += 1;
  logMsg(msg + '。', 'good');
  saveState();
  return true;
}
/* 待入仓补发：每秒随 tick 检查一次（仅在 pending 时做一次容量判断，开销可忽略） */
function checkinFlushPending() {
  const c = state.checkin;
  if (!c || !c.pending) return;
  const inst = checkinTryGrantDisciple();
  if (!inst) return;
  c.pending = false;
  const cat = findDisciple(inst.id);
  logMsg('签到奖励补发：神品信徒「' + (cat ? cat.name : inst.id) + '」已入驻招贤殿。', 'good');
}

/* ------------------------------------------------------------ 装备 */
function equipItem(itemId) {
  const it = ITEMS[itemId];
  if (!it || it.type !== 'equip' || invCount(itemId) < 1) return false;
  const old = state.equip[it.slot];
  invRemove(itemId, 1);
  if (old) invAdd(old, 1);
  state.equip[it.slot] = itemId;
  clampHp();
  logMsg('装备「' + it.name + '」。', 'good');
  return true;
}

function unequipSlot(slot) {
  const id = state.equip[slot];
  if (!id) return false;
  state.equip[slot] = null;
  invAdd(id, 1);
  clampHp();
  logMsg('卸下「' + itemName(id) + '」。', 'info');
  return true;
}

/* ------------------------------------------------------------ 穿越星球 */
/* 是否为当前占用动作槽的星球巡航（动作 id 用 orbit，避免与技能动作混淆） */
function planetRunning() {
  return !!(state.action && state.action.skill === 'planet' && state.action.id === 'orbit');
}

/* 清空星球瞬态（飞行队列 / 本局收获 / 加速 / 等待）。open 仅作旧存档兼容的镜像标志。
   注意：灵气浓度 aura 与穿越次数 cross 是长期进度，不在这里清空。 */
function planetReset() {
  const p = state.planet;
  p.open = false;
  p.items = [];
  p.timer = PLANET.SPAWN_BASE;
  p.cycleCur = 0;
  p.boost = 0;
  p.waitReason = '';
  p.session = { gold: 0, star: 0, mat: 0, count: 0 };
}

/* ---------------------------------------------------------- 灵气浓度 */
/* 当前穿越次数（钳制到 0~10000，防止异常存档参与幂运算） */
function planetCrossCount(s) {
  const st = s || state;
  const n = st && st.planet ? Number(st.planet.cross) : 0;
  return Math.max(0, Math.min(10000, Math.floor(isFinite(n) ? n : 0)));
}

/* 浓度成长系数：下一次穿越价格 / 初始价格。
   0 次穿越 = 1；10 次穿越（下次为第 11 次）= 76.9658；之后按 1.12 继续增长。
   上限与恢复都乘这个系数，保证每一轮攒够价格的时长基本恒定。 */
function planetAuraScale(s) {
  const next = planetCrossCost(planetCrossCount(s) + 1);
  return next / PLANET.CROSS_BASE;
}

/* 上限：至少装得下下一次穿越价格（×1.5），再叠加引力塔等级加成。
   0 次穿越：Lv0=15000 / Lv20=17000 / Lv100=25000。 */
function planetAuraCap(s) {
  const st = s || state;
  const gtLv = (st.world && st.world.buildings && st.world.buildings.gravitytower) || 0;
  const next = planetCrossCost(planetCrossCount(st) + 1);
  const base = Math.max(PLANET.AURA_CAP_BASE, next * PLANET.AURA_CAP_RATIO);
  return Math.ceil(base) + PLANET.AURA_CAP_GT * gtLv;
}

/* 恢复（每秒，停止运转时）：基础 + 引力塔加成，再乘以浓度成长系数。
   0 次穿越：Lv0=2.0/s / Lv20=12.0/s / Lv100=52.0/s。 */
function planetAuraRegen(s) {
  const st = s || state;
  const gtLv = (st.world && st.world.buildings && st.world.buildings.gravitytower) || 0;
  return (PLANET.AURA_REGEN_BASE + PLANET.AURA_REGEN_GT * gtLv) * planetAuraScale(st);
}

/* 巡航时每生成 1 件消耗的浓度：2 × 0.9^cross，下限 0.2。
   0 次=2 → 1 次=1.8 → 2 次=1.62 … 第 22 次触底 0.2，永不变成 0。 */
function planetAuraCost(cross) {
  const n = (cross === undefined || cross === null)
    ? planetCrossCount()
    : Math.max(0, Math.min(10000, Math.floor(Number(cross) || 0)));
  const v = PLANET.AURA_COST * Math.pow(PLANET.AURA_COST_DECAY, n);
  return Math.max(PLANET.AURA_COST_MIN, Math.round(v * 1000) / 1000);
}

/* 新档 / 旧档迁移时的起始浓度：上限的 30% */
function planetAuraStart(s) {
  return Math.round(planetAuraCap(s) * PLANET.AURA_START_RATIO);
}

/* ---------------------------------------------------------- 穿越朝代 */
/* 中文数字（1~99）：古一纪 / 古十纪 / 古二十三纪… 更大时退回阿拉伯数字
   注意：不要命名为 cnNum，data.js 已有同名函数负责境界大数中文，后者会被本文件覆盖 */
function cnSmallNum(n) {
  const d = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九'];
  n = Math.floor(Number(n) || 0);
  if (n <= 0) return '零';
  if (n < 10) return d[n];
  if (n < 20) return '十' + (n % 10 ? d[n % 10] : '');
  if (n < 100) return d[Math.floor(n / 10)] + '十' + (n % 10 ? d[n % 10] : '');
  return String(n);
}

/* 朝代名：0 = 清朝，10 = 夏朝，11 = 古一纪，12 = 古二纪…（按数值生成，不写死有限列表） */
function planetDynastyName(n) {
  n = Math.max(0, Math.min(10000, Math.floor(Number(n) || 0)));
  if (n < DYNASTY_NAMES.length) return DYNASTY_NAMES[n];
  return '古' + cnSmallNum(n - DYNASTY_NAMES.length + 1) + '纪';
}

/* 第 n 次穿越的灵气浓度价格（n 从 1 起算）：
   前 10 次 10000 × 1.6^(n-1)，第 11 次起再接 ×1.12 的缓坡，避免 2^n 爆炸。 */
function planetCrossCost(n) {
  n = Math.max(1, Math.min(10000, Math.floor(Number(n) || 1)));
  const steps = n - 1;
  const fast = Math.min(steps, PLANET.CROSS_KNEE - 1);
  let cost = PLANET.CROSS_BASE * Math.pow(PLANET.CROSS_GROW_EARLY, fast);
  if (steps > fast) cost *= Math.pow(PLANET.CROSS_GROW_LATE, steps - fast);
  if (!isFinite(cost) || cost > PLANET.CROSS_MAX) cost = PLANET.CROSS_MAX;
  return Math.floor(cost);
}

/* 穿越：只扣灵气浓度、只推进朝代与次数，不扣灵力、不重置星球产出与本局收获。
   判定与扣除都保证剩余不低于 AURA_MIN，浓度不会为负或到 0。 */
function planetCross() {
  const p = state.planet;
  if (!p) return false;
  const n = planetCrossCount() + 1;
  /* 异界裂缝未修复时禁止穿越；修复后放行，穿越成功立刻生成下一道裂缝 */
  if (state.rift && state.rift.open) {
    logMsg('需先修复异界裂缝（第 ' + state.rift.tier + ' 层），修复后才能进行第 ' + n + ' 次穿越。', 'warn');
    return false;
  }
  const cost = planetCrossCost(n);
  const need = cost + PLANET.AURA_MIN;
  const aura = isFinite(p.aura) ? Number(p.aura) : 0;
  if (aura < need) {
    logMsg('灵气浓度不足，第 ' + n + ' 次穿越需 💧 ' + cost + '（当前 ' + Math.floor(aura) + '，至少需 ' + need + '）。', 'warn');
    return false;
  }
  p.aura = Math.max(PLANET.AURA_MIN, aura - cost);
  p.cross = n;
  state.rift = { open: true, tier: n };
  logMsg('穿越成功：抵达「' + planetDynastyName(n) + '」，第 ' + n + ' 次穿越，消耗 💧 ' + cost +
    ' 灵气浓度；异界裂缝第 ' + n + ' 层已生成，修复后才能继续穿越。', 'good');
  return true;
}

/* 开启 / 停止星球巡航：占用全局动作槽，切换其它动作时由 planetInterrupt 兜底清理 */
function planetStart() {
  if (state.stun > 0) { logMsg('眩晕中，还需 ' + Math.ceil(state.stun) + ' 秒才能行动。', 'warn'); return; }
  if (planetRunning()) { planetStop(); return; }

  /* 裂缝怪物未击败 → 禁止开启运转（只拦运转，不拦穿越；穿越仍只看异界裂缝与浓度） */
  if (riftMonAlive()) {
    logMsg('「' + RIFT_MON.NAME + '」尚在（强度 ' + riftMonTierClamp(state.riftMon.tier) +
      '）：需先击败它才能开启星球运转；穿越不受影响。', 'warn');
    return;
  }

  /* 巡航中浓度只降不升：浓度不足以生成时直接拒绝开启，避免玩家开着空转等一个不会来的恢复 */
  const p = state.planet;
  const auraCost = planetAuraCost();
  const aura = isFinite(p.aura) ? Number(p.aura) : 0;
  if (aura < auraCost + PLANET.AURA_MIN) {
    logMsg('灵气浓度不足，无法开启运转（每件需 💧 ' + auraCost + '，当前 ' + Math.floor(aura) +
      '）；停止运转时浓度按 +' + planetAuraRegen().toFixed(1) + '/s 恢复。', 'warn');
    return;
  }

  cancelCombat();
  planetReset();
  state.action = { skill: 'planet', id: 'orbit' };
  state.actionTimer = 0;
  state.actionWaiting = false;
  state.planet.open = true;
  logMsg('开始「穿越星球」：每吸收 1 件消耗 ⚡ ' + PLANET.SPIRIT_COST +
    ' 灵力，每生成 1 件消耗 💧 ' + auraCost + ' 灵气浓度（穿越后逐次降低）；' +
    '停止运转后浓度按 +' + planetAuraRegen().toFixed(1) + '/s 恢复。', 'info');
}

function planetStop(silent) {
  if (!planetRunning()) { planetReset(); return; }
  planetReset();
  state.action = null;
  state.actionExplicit = false;
  state.actionTimer = 0;
  state.actionWaiting = false;
  if (!silent) logMsg('已停止「穿越星球」，未吸收的物品已清空。', 'info');
}

/* 切换到其它动作 / 进入战斗前调用：结束星球并清空飞行队列 */
function planetInterrupt() {
  if (!planetRunning()) return;
  planetReset();
  state.actionWaiting = false;
}

/* 当前加速上限：基础 60 秒 + 引力塔每级 5 秒（未建造按 0 级） */
function planetBoostCap() {
  const gtLv = (state.world && state.world.buildings && state.world.buildings.gravitytower) || 0;
  return PLANET.BOOST_BASE_CAP + PLANET.BOOST_GT_BONUS * gtLv;
}

/* 点击面板：加速时长叠加，上限随引力塔等级提升；仅在星球运转期间生效 */
function planetBoost() {
  if (!planetRunning()) {
    logMsg('「穿越星球」尚未开启，先点击「开启运转」。', 'warn');
    return;
  }
  const p = state.planet;
  p.boost = Math.min(planetBoostCap(), Math.max(0, p.boost) + PLANET.BOOST_ADD);
}

/* 已解锁材料池：采集技能等级已满足其门槛的物资（矿、鱼、木、草药等） */
function planetMaterials() {
  const pool = [];
  ['woodcutting', 'fishing', 'mining', 'herbalism'].forEach(function (sk) {
    const lv = state.skills[sk] ? state.skills[sk].lvl : 1;
    (ACTIONS[sk] || []).forEach(function (a) {
      if (a.req > lv) return;
      const id = a.out && a.out.id;
      if (!id || !ITEMS[id] || ITEMS[id].type !== 'material') return;
      if (pool.indexOf(id) < 0) pool.push(id);
    });
  });
  return pool;
}

/* 按 50% / 30% / 19% / 1% 权重抽一件产物。
   生命之种是独立产物，不再走「吸收时随机掉落」的隐式通道（避免双计）。
   材料池为空时（未解锁任何采集动作），材料权重并入灵石，种子权重不受影响。 */
function planetPick() {
  const r = Math.random();
  if (r < PLANET.W_GOLD) return { kind: 'gold' };
  const rStar = PLANET.W_GOLD + PLANET.W_STAR;
  if (r < rStar) return { kind: 'star' };
  const rMat = rStar + PLANET.W_MAT;
  const pool = planetMaterials();
  if (!pool.length) {
    /* 没有可掉材料时，材料权重并入灵石；种子保持 3% 独立占据星砂之后的区间 */
    return r < rStar + PLANET.W_SEED ? { kind: 'seed' } : { kind: 'gold' };
  }
  if (r < rMat) {
    return { kind: 'mat', id: pool[Math.floor(Math.random() * pool.length)] };
  }
  if (r < rMat + PLANET.W_SEED) return { kind: 'seed' };
  return { kind: 'gold' };
}

/* 生成一件飞行物：起点在星球外圈（极坐标，角度随机，半径 0.36~0.5） */
function planetSpawn() {
  const p = state.planet;
  const pick = planetPick();
  p.items.push({
    pid: p.seq++,
    kind: pick.kind,
    id: pick.id || null,
    ang: Math.random() * Math.PI * 2,
    rad: 0.36 + Math.random() * 0.14,
    prog: 0
  });
}

/* 抵达星球：结算奖励 */
function planetGrant(it) {
  const s = state.planet.session;
  if (it.kind === 'gold') {
    const g = randInt(PLANET.GOLD_MIN, PLANET.GOLD_MAX);
    state.gold += g; s.gold += g;
  } else if (it.kind === 'star') {
    const v = randInt(PLANET.STAR_MIN, PLANET.STAR_MAX);
    state.stardust += v; s.star += v;
  } else if (it.kind === 'mat') {
    const q = randInt(PLANET.MAT_MIN, PLANET.MAT_MAX);
    if (invAdd(it.id, q)) s.mat += q;
  } else if (it.kind === 'seed') {
    /* 生命之种：作为飞行物抵达时直接入账，并计入本局收获与吸收件数 */
    const q = randInt(PLANET.SEED_MIN, PLANET.SEED_MAX);
    state.seed = (state.seed || 0) + q;
    s.seed = (s.seed || 0) + q;
    if (!OFFLINE_MODE) logMsg('吸收星球之物时拾得 🌱 生命之种 ×' + q + '。', 'gather');
  }
  s.count += 1;
}

function planetTick(dt) {
  const p = state.planet;
  if (!p) return;

  /* 浓度钳制：先保证是有限值，再夹到 [下限, 上限]。
     未运转时被动恢复（离线结算同样生效）；巡航中只消耗不恢复，
     否则 10000 量级的恢复速率会让单件消耗永远压不下去。 */
  const auraCap = planetAuraCap();
  const auraNow = isFinite(p.aura) ? Number(p.aura) : planetAuraStart();
  const auraBase = Math.min(auraCap, Math.max(PLANET.AURA_MIN, auraNow));
  if (!planetRunning()) {
    p.aura = Math.min(auraCap, auraBase + planetAuraRegen() * dt);
    return;
  }
  p.aura = auraBase;

  /* 加速只作用于生成与飞行，计时本身按真实时间扣除 */
  if (p.boost > 0) p.boost = Math.max(0, p.boost - dt);
  const sdt = dt * (p.boost > 0 ? PLANET.BOOST_MULT : 1);

  /* 先推进已在飞行的物品，再生成新物品（新物品从下一 tick 起才移动）。
   * 抵达时扣灵力：不足则停在星球边缘等待恢复，不中断、不失败，灵力不会为负。 */
  const stay = [];
  let spiritShort = false;
  const cost = PLANET.SPIRIT_COST;
  for (let i = 0; i < p.items.length; i++) {
    const it = p.items[i];
    it.prog += sdt / PLANET.FLIGHT_TIME;
    if (it.prog < 1) { stay.push(it); continue; }
    it.prog = 1;
    if (state.spirit >= cost) {
      state.spirit = Math.max(0, state.spirit - cost);
      planetGrant(it);
    } else {
      spiritShort = true;
      stay.push(it);   /* 原地悬停，等灵力恢复后由后续 tick 吸收 */
    }
  }
  p.items = stay;

  /* 引力塔：每级生成速度 +1%（缩短等待间隔，不影响飞行时长）。
   * 生成时先扣灵气浓度（单价随穿越次数递减）；不足则不再生成，但已有飞行物照常吸收。
   * 判断用「浓度 ≥ 单价 + 下限」，保证扣完仍留下 AURA_MIN，永远不到 0。 */
  let auraShort = false;
  const auraCost = planetAuraCost();
  const grav = 1 + worldBonus('planet');
  p.timer -= sdt * grav;
  /* 同动作槽：取样必须在回填 BASE 之前，否则界面永远错过满格那一帧 */
  p.cycleCur = Math.max(0, Math.min(PLANET.SPAWN_BASE, PLANET.SPAWN_BASE - p.timer));
  while (p.timer <= 0) {
    if (p.items.length < PLANET.MAX_ITEMS) {
      if (p.aura >= auraCost + PLANET.AURA_MIN) {
        p.aura -= auraCost;
        planetSpawn();
      } else {
        auraShort = true;
      }
    }
    p.timer += PLANET.SPAWN_BASE;
  }

  /* 与其它动作一致的「缺料等待」：灵力 / 浓度任一不足都只记一次日志。
   * 浓度在两次生成之间没有「生成尝试」，因此用 p.waitReason 保持触底等待状态，
   * 直到浓度重新高于「单价 + 下限」才解除，避免状态文案在生成间隔里闪烁。
   * 巡航中浓度不恢复，所以提示玩家停止运转才能恢复。 */
  const auraLow = p.aura < auraCost + PLANET.AURA_MIN;
  const auraBlocked = auraShort || (p.waitReason === 'aura' && auraLow);
  const waitReason = spiritShort ? 'spirit' : (auraBlocked ? 'aura' : '');
  if (waitReason) {
    if (!state.actionWaiting || p.waitReason !== waitReason) {
      state.actionWaiting = true;
      p.waitReason = waitReason;
      logMsg(waitReason === 'spirit'
        ? '灵力不足，「穿越星球」等待灵力恢复…'
        : '灵气浓度不足，「穿越星球」暂停生成；停止运转后浓度按 +' +
          planetAuraRegen().toFixed(1) + '/s 恢复。', 'warn');
    }
  } else if (state.actionWaiting) {
    state.actionWaiting = false;
    p.waitReason = '';
    logMsg('资源恢复，「穿越星球」继续运转。', 'info');
  }
}

/* ------------------------------------------------------------------ 主循环 */
function tick(dt) {
  if (!state) return;
  passiveTick(dt);
  worldTick(dt);
  dynastyTick(dt);
  elemRiftTick();
  riftMonTick();
  cycleTick(dt);
  combatTick(dt);
  planetTick(dt);
  autoEatTick();
  clampHp();

  state.taskTimer += dt;
  if (state.taskTimer >= 1) { state.taskTimer = 0; checkTasks(); guideSync(); checkinFlushPending(); }
}

/* ---------------------------------------------------------------- 离线结算 */
function snapshotOffline() {
  const snap = { levels: {}, inv: {}, gold: state.gold, spirit: state.spirit, stardust: state.stardust, kills: state.stats.kills, deaths: state.stats.deaths, breaks: state.stats.breaks };
  SKILL_ORDER.forEach(function (id) { snap.levels[id] = state.skills[id].lvl; });
  Object.keys(state.inv).forEach(function (id) { snap.inv[id] = state.inv[id]; });
  return snap;
}

function simulateOffline(seconds) {
  const capped = Math.min(seconds, CONFIG.OFFLINE_CAP_H * 3600);
  if (capped < 3) return null;

  const before = snapshotOffline();
  const wasOffline = OFFLINE_MODE;
  OFFLINE_MODE = true;

  const STEP = 0.5;
  let remain = capped;
  let guard = 0;
  while (remain > 0.001 && guard < 400000) {
    guard += 1;
    const dt = remain > STEP ? STEP : remain;
    tick(dt);
    remain -= dt;
  }

  OFFLINE_MODE = wasOffline;

  /* 汇总离线收益 */
  const report = {
    seconds: capped, truncated: seconds > capped,
    gold: state.gold - before.gold, spirit: state.spirit - before.spirit,
    stardust: state.stardust - before.stardust,
    items: [], levels: [], breaks: state.stats.breaks - before.breaks,
    kills: state.stats.kills - before.kills, deaths: state.stats.deaths - before.deaths
  };

  Object.keys(state.inv).forEach(function (id) {
    const d = state.inv[id] - (before.inv[id] || 0);
    if (d > 0) report.items.push({ id: id, qty: d });
  });
  SKILL_ORDER.forEach(function (id) {
    const d = state.skills[id].lvl - before.levels[id];
    if (d > 0) report.levels.push({ id: id, name: SKILLS[id].name, icon: SKILLS[id].icon, from: before.levels[id], to: state.skills[id].lvl });
  });
  return report;
}
