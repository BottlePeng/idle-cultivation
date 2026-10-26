'use strict';

/* =========================================================================
 * 仙途挂机 · 引擎层
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

/* ------------------------------------------------------------------ 背包 */
function invCount(id) { return state.inv[id] || 0; }
function invHas(id, qty) { return invCount(id) >= qty; }

/* 已占用的槽位数（不同物品种类数） */
function invSlotsUsed() {
  let n = 0;
  Object.keys(state.inv).forEach(function (id) { if (state.inv[id] > 0) n += 1; });
  return n;
}
function invFull() { return invSlotsUsed() >= CONFIG.INV_SLOTS; }

/* 能否再放入 qty 个 id：已有该物品则不占新槽；否则需有空槽 */
function invCanAdd(id, qty) {
  if (invCount(id) > 0) return true;
  return invSlotsUsed() < CONFIG.INV_SLOTS;
}

function invAdd(id, qty) {
  if (!qty || qty <= 0) return false;
  if (invCount(id) <= 0 && invSlotsUsed() >= CONFIG.INV_SLOTS) return false;
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
  return Math.max(1, Math.floor((it.value || 0) * CONFIG.SELL_RATIO * (1 + formBonus('sell'))));
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
  if (!OFFLINE_MODE) logMsg('购入 ' + qty + ' × ' + itemIcon(id) + itemName(id) + '，花费 💠 ' + cost + ' 灵石', 'gold');
  return true;
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
  ev = Math.round(ev * (1 + formBonus('ev')));
  hp = hp * (1 + formBonus('hp'));

  const dr = Math.min(CONFIG.DR_CAP, def / (def + CONFIG.DR_DIVISOR));

  return {
    hp: Math.round(hp),
    atk: atk,
    atkMin: Math.max(1, Math.round(atk * (1 - CONFIG.DMG_SPREAD))),
    atkMax: Math.max(2, Math.round(atk * (1 + CONFIG.DMG_SPREAD))),
    hit: hit,
    ev: ev,
    dr: dr,
    attackTime: CONFIG.PLAYER_ATTACK_TIME
  };
}

function maxHp() { return calcStats().hp; }

function clampHp() {
  const m = maxHp();
  if (state.hp > m) state.hp = m;
  if (state.hp < 0) state.hp = 0;
}

/* 动作速度：受大境界与疾风阵加成 */
function speedMul() {
  return (1 + realmIndex() * CONFIG.SPEED_REALM_BONUS) * (1 + formBonus('speed'));
}

/* 技能 → 阵法经验加成通道（阵法自身不受加成） */
const XP_GROUP = { cultivation: 'cult', combat: 'combat', crafting: 'craft', smelting: 'craft', alchemy: 'craft', herbalism: 'gather', farming: 'gather' };

/* 经验/修为加成 */
function xpMul(skillId) {
  const ri = realmIndex();
  const grp = XP_GROUP[skillId] || (skillId === 'formation' ? null : 'gather');
  const fb = grp ? (1 + formBonus('xp_' + grp)) : 1;
  if (skillId === 'cultivation') {
    /* 悟性每点 +1% 修为收益，叠加境界与阵法加成 */
    return (1 + ri * CONFIG.CULT_XP_PER_REALM) * (1 + state.insight * 0.01) * fb;
  }
  return (1 + ri * CONFIG.XP_REALM_BONUS) * fb;
}

/* --------------------------------------------------------------- 经验升级 */
function levelInfo(skillId) {
  const s = state.skills[skillId];
  if (skillId === 'cultivation') {
    const bi = breakInfo(s.lvl - 1);
    const need = bi ? bi.need : s.xp;
    return { lvl: s.lvl, xp: s.xp, need: need, pct: need > 0 ? Math.min(1, s.xp / need) : 1, max: !bi };
  }
  if (s.lvl >= CONFIG.SKILL_CAP) return { lvl: s.lvl, xp: 0, need: 0, pct: 1, max: true };
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
  while (s.xp >= xpNeed(skillId, s.lvl) && gained < 500 && s.lvl < CONFIG.SKILL_CAP) {
    s.xp -= xpNeed(skillId, s.lvl);
    s.lvl += 1;
    gained += 1;
  }
  if (s.lvl >= CONFIG.SKILL_CAP) s.xp = 0;   /* 到达上限后多余经验清空 */
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
  if (s.lvl >= CONFIG.SKILL_CAP) {
    logMsg('🎉 ' + (SKILLS[skillId] ? SKILLS[skillId].name : '战斗') + ' 已达上限 Lv.' + CONFIG.SKILL_CAP + '！', 'levelup');
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
  const c = m.lvl * CONFIG.MASTERY_DOUBLE_PER_LVL + sk * CONFIG.SKILL_DOUBLE_PER_LVL + formBonus('double');
  return clamp(c, 0, 0.9);
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
  return Math.max(1, Math.round(def.xp * CONFIG.MASTERY_XP_RATIO * (1 + formBonus('mastery'))));
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

  const gold = Math.round(randInt(def.gold[0], def.gold[1]) * (1 + formBonus('gold')));
  state.gold += gold;

  const got = [];
  const lost = [];
  const dropMul = 1 + formBonus('drop');
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
    if (out.spirit) state.spirit += out.spirit;
    else if (out.gold) state.gold += Math.round(out.gold * (1 + formBonus('gold')));
    else if (out.heal) state.hp = Math.min(maxHp(), state.hp + out.heal);
    else if (out.cultXp) addXp('cultivation', out.cultXp);
    else if (out.id) invAdd(out.id, out.qty || 1);

    state.stats.crafts += 1;
    if (out.id && ITEMS[out.id] && ITEMS[out.id].type === 'pill') state.stats.pills += 1;

    addXp(skillId, def.xp);
    addMastery(def.id, masteryGain(def));
    if (!OFFLINE_MODE) logMsg('「' + def.name + '」完成，' + recipeOutText(out), 'craft');
    return true;
  }

  /* --- 采集 / 修炼 / 观星类 --- */
  const out = def.out || {};
  let qty = out.qty || 1;
  let bonus = '';
  if (out.id) {
    if (Math.random() < doubleChance(def.id, skillId)) { qty *= 2; bonus = '（精通·双倍）'; }
    invAdd(out.id, qty);
    state.stats.gathered += 1;
    state.stats.perSkill[skillId] = (state.stats.perSkill[skillId] || 0) + 1;
    if (!OFFLINE_MODE) logMsg('获得 ' + qty + ' × ' + itemIcon(out.id) + itemName(out.id) + bonus, 'gather');
  }
  /* 观星产出星砂：同样享受额外产出加成 */
  if (out.stardust) {
    let sd = out.stardust;
    if (Math.random() < doubleChance(def.id, skillId)) { sd *= 2; bonus = '（精通·双倍）'; }
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
  if (out.spirit) state.spirit += out.spirit;
  if (out.gold) state.gold += Math.round(out.gold * (1 + formBonus('gold')));
  if (out.heal) state.hp = Math.min(maxHp(), state.hp + out.heal);

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
  /* 战斗动作由 combatTick 独立驱动，不能在这里被当作采集/制作查表，否则会被判为无效动作清空 */
  if (act.skill === 'combat') return;

  const def = findActivity(act.skill, act.id);
  if (!def) { state.action = null; state.actionTimer = 0; return; }

  const t = effTime(def, act.id);

  /* 缺材料 或 背包已满 时原地等待，不中断挂机 */
  const matShort = !!(def.in && def.in.length && !matsOk(def));
  const bagFull = !!(def.out && def.out.id && !invCanAdd(def.out.id, def.out.qty || 1));
  if (matShort || bagFull) {
    state.actionTimer = t;
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

  state.actionTimer += dt * speedMul();

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
  const gold = Math.round(dg.reward.gold * (1 + formBonus('gold')));
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
  /* 动作槽不在战斗 → 战斗必须停止（防止切换技能后仍在后台打怪） */
  if (!state.action || state.action.skill !== 'combat') {
    if (c.monster || c.target || c.dungeon) cancelCombat();
    return;
  }
  if (!c.monster) { c.target = null; return; }

  if (!c.target || c.target.hp <= 0) {
    c.target = null;
    c.respawn -= dt;
    if (c.respawn <= 0) { c.respawn = 0; spawnTarget(); }
    return;
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
  const m = findMonster(target.id);
  const c = state.skills.combat;
  if (!m) { c.target = null; return; }

  const dg = c.dungeon ? findDungeon(c.dungeon) : null;
  const gold = Math.round(randInt(m.gold[0], m.gold[1]) * (dg ? dg.scale.gold : 1) * (1 + formBonus('gold')));
  state.gold += gold;
  state.stats.kills += 1;
  addXp('combat', Math.round(m.xp * (dg ? dg.scale.xp : 1)));
  addMastery(m.id, Math.max(1, Math.round(m.xp * CONFIG.MASTERY_XP_RATIO * (1 + formBonus('mastery')))));

  const drops = [];
  const dropMul = 1 + formBonus('drop');
  m.drops.forEach(function (d) {
    if (Math.random() < Math.min(1, d.chance * dropMul)) {
      invAdd(d.id, d.qty);
      drops.push(d.qty + ' × ' + itemIcon(d.id) + itemName(d.id));
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
  const dg = c.dungeon ? findDungeon(c.dungeon) : null;
  if (dg) {
    logMsg('在秘境「' + dg.name + '」第 ' + (c.floor + 1) + ' 波被「' + target.name + '」击退，秘境挑战失败。', 'bad');
  } else {
    logMsg('你被「' + target.name + '」击退，重伤返回洞府。先疗伤或备好食物再战。', 'bad');
  }
  /* 战败自动退出战斗动作槽并疗伤；秘境同时判定为失败 */
  if (state.action && state.action.skill === 'combat') stopAction(true);
  cancelCombat();
}

/* ------------------------------------------------------------ 常驻被动 */
function growPlots(dt) {
  const fs = state.skills.farming;
  const mul = 1 + formBonus('growth');
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
  state.spirit += CONFIG.SPIRIT_PER_SEC * (1 + formBonus('spirit')) * dt;

  /* 灵植地块：被动生长，离线同样推进 */
  growPlots(dt);

  /* 脱战回血 */
  if (!state.skills.combat.monster) {
    state.regenTimer += dt;
    let guard = 0;
    while (state.regenTimer >= CONFIG.HP_REGEN_INTERVAL && guard++ < 50) {
      state.regenTimer -= CONFIG.HP_REGEN_INTERVAL;
      if (state.hp < maxHp()) {
        const h = Math.max(1, Math.round(maxHp() * CONFIG.HP_REGEN_RATIO * (1 + formBonus('regen'))));
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
  eatFood(id, true);
}

function eatFood(itemId, silent) {
  const it = ITEMS[itemId];
  if (!it || it.type !== 'food' || invCount(itemId) < 1) return false;
  invRemove(itemId, 1);
  const heal = it.heal || 0;
  state.hp = Math.min(maxHp(), state.hp + heal);
  if (!silent) logMsg('食用「' + it.name + '」，恢复 ' + heal + ' 点生命。', 'heal');
  else if (!OFFLINE_MODE) logMsg('自动进食「' + it.name + '」，恢复 ' + heal + ' 点生命。', 'heal');
  return true;
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
function usePill(itemId) {
  const it = ITEMS[itemId];
  if (!it || it.type !== 'pill' || invCount(itemId) < 1) return false;

  if (it.use === 'break') {
    logMsg('「' + it.name + '」需在「修炼」面板冲击境界时自动消耗。', 'info');
    return false;
  }
  invRemove(itemId, 1);
  if (it.use === 'cult') {
    const gain = Math.round(40 * (1 + realmIndex() * 4));
    /* 除以加成后再交给 addXp，保证实际注入的修为恰好为 gain */
    addXp('cultivation', gain / xpMul('cultivation'));
    logMsg('服下「' + it.name + '」，修为 +' + gain + '。', 'levelup');
  } else if (it.use === 'heal') {
    const heal = Math.round(maxHp() * 0.65);
    state.hp = Math.min(maxHp(), state.hp + heal);
    logMsg('服下「' + it.name + '」，恢复 ' + heal + ' 点生命。', 'heal');
  } else if (it.use === 'wudao') {
    state.insight += 1;
    logMsg('服下「' + it.name + '」，悟性提升至 ' + state.insight + '（修炼 +' + state.insight + '% / 突破 +' + state.insight + '%）。', 'levelup');
  }
  return true;
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
  if (Math.random() < doubleChance('harvest_' + seed.id, 'farming')) { qty *= 2; bonus = '（精通·双倍）'; }
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

  /* 切换动作前先彻底结束战斗，避免战斗在后台继续 */
  cancelCombat();
  state.action = { skill: skillId, id: actionId };
  state.actionTimer = 0;
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
  c.playerTimer = 0;
  c.monsterTimer = 0;
  c.respawn = 0;
}

/* silent=true 时不写日志（材料耗尽中止、切换动作等） */
function stopAction(silent) {
  cancelCombat();
  state.action = null;
  state.actionTimer = 0;
  state.actionWaiting = false;
  if (!silent) logMsg('已停止当前动作。', 'info');
}

function startCombat(monsterId) {
  const m = findMonster(monsterId);
  if (!m) return;

  /* 眩晕中无法进入战斗 */
  if (state.stun > 0) { logMsg('眩晕中，还需 ' + Math.ceil(state.stun) + ' 秒才能行动。', 'warn'); return; }

  /* 再次点击同一目标 → 停止 */
  if (state.action && state.action.skill === 'combat' && state.action.id === monsterId) {
    stopAction();
    return;
  }

  const c = state.skills.combat;
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
  if (!bi) { logMsg('已臻炼虚圆满，仙途巅峰。', 'warn'); return false; }
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
function taskDone(t) {
  const c = t.cond;
  switch (c.type) {
    case 'gathered': return state.stats.gathered >= c.n;
    case 'kills': return state.stats.kills >= c.n;
    case 'crafts': return state.stats.crafts >= c.n;
    case 'pills': return state.stats.pills >= c.n;
    case 'breaks': return state.stats.breaks >= c.n;
    case 'level': return state.skills[c.skill] && state.skills[c.skill].lvl >= c.lvl;
    case 'realm': return state.skills.cultivation.lvl >= c.stage;
    case 'item': return (state.stats.gained[c.id] || 0) >= c.qty;
    default: return false;
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

function claimTask(id) {
  const t = findTask(id);
  const rec = state.tasks[id];
  if (!t || !rec || !rec.done || rec.claimed) return false;
  rec.claimed = true;
  if (t.reward.gold) state.gold += t.reward.gold;
  if (t.reward.spirit) state.spirit += t.reward.spirit;
  if (t.reward.items) t.reward.items.forEach(function (i) { invAdd(i.id, i.qty); });
  logMsg('领取任务奖励：「' + t.name + '」。', 'good');
  return true;
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

/* ------------------------------------------------------------------ 主循环 */
function tick(dt) {
  if (!state) return;
  passiveTick(dt);
  cycleTick(dt);
  combatTick(dt);
  autoEatTick();
  clampHp();

  state.taskTimer += dt;
  if (state.taskTimer >= 1) { state.taskTimer = 0; checkTasks(); }
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
