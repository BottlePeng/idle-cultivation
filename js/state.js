'use strict';

/* =========================================================================
 * 仙途挂机 · 状态与存档层
 * state 是唯一的"存档对象"，所有层都读写它。
 * v2 结构：单一动作槽（梅尔沃放置式）+ 境界/灵根 + 精通 + 任务
 * ========================================================================= */

/* 全局唯一状态（由 loadState 赋值） */
let state = null;

function defaultState() {
  const s = {
    version: 2,
    gold: 0,            // 低阶灵石
    spirit: 0,          // 灵力
    stardust: 0,        // 星砂（观星所得，用于点亮阵纹）
    hp: CONFIG.BASE_HP,
    inv: { fish_qing: 3, log_qing: 2, herb_juqi: 2 },   // 一点起步物资
    equip: { weapon: null, armor: null, helmet: null, boots: null, amulet: null, ring: null },
    root: rollRoot(),   // 灵根资质
    skills: {},
    mastery: {},        // 精通表：actionId -> { lvl, xp }
    formations: {},     // 阵法表：formId -> { levels: [各阵纹等级] }
    plots: Array.from({ length: FARMING_PLOT_REQS.length }, () => ({ seedId: null, growth: 0, ready: false })),

    /* 单一动作槽：同一时刻只能进行一件事 */
    action: { skill: 'cultivation', id: 'meditate' },
    actionTimer: 0,     // 当前周期已累计秒数
    actionWaiting: false,

    regenTimer: 0,      // 脱战回血计时
    taskTimer: 0,       // 任务检查计时

    tasks: {},          // taskId -> { done, claimed }
    ui: { active: 'woodcutting', autoEat: true, eatFood: 'auto', eatRatio: 0.35, invFilter: 'all', invSellMode: false, shopCat: 'general', farmSeedId: null },
    log: [],
    stats: { gathered: 0, crafts: 0, kills: 0, deaths: 0, breaks: 0, pills: 0, gained: {}, startedAt: Date.now() },
    lastSave: Date.now()
  };

  SKILL_ORDER.forEach(function (id) {
    s.skills[id] = { lvl: 1, xp: 0 };
  });
  /* 战斗技能额外字段 */
  Object.assign(s.skills.combat, { monster: null, target: null, playerTimer: 0, monsterTimer: 0, respawn: 0 });
  /* 修炼瓶颈标记（修为封顶时提示一次） */
  s.skills.cultivation.capped = false;

  return s;
}

function saveState() {
  if (!state) return;
  state.lastSave = Date.now();
  try {
    localStorage.setItem(CONFIG.SAVE_KEY, JSON.stringify(state));
  } catch (e) {
    console.warn('存档失败', e);
  }
}

/* 返回离线秒数（首次进入返回 0） */
function loadState() {
  let raw = null;
  try { raw = localStorage.getItem(CONFIG.SAVE_KEY); } catch (e) { raw = null; }

  const def = defaultState();
  if (!raw) { state = def; return 0; }

  let saved = null;
  try { saved = JSON.parse(raw); } catch (e) { state = def; return 0; }
  state = mergeState(def, saved);

  const elapsed = Math.max(0, (Date.now() - state.lastSave) / 1000);
  return elapsed;
}

/* 用默认结构兜底，防止旧存档字段缺失导致崩溃 */
function mergeState(def, saved) {
  const out = def;
  if (!saved || typeof saved !== 'object') return out;

  ['gold', 'spirit', 'stardust', 'hp'].forEach(function (k) {
    if (isFinite(saved[k])) out[k] = Math.max(0, Number(saved[k]));
  });
  if (isFinite(saved.lastSave)) out.lastSave = Number(saved.lastSave);
  if (typeof saved.root === 'string' && ROOTS[saved.root]) out.root = saved.root;
  else out.root = rollRoot();

  if (saved.inv && typeof saved.inv === 'object') {
    out.inv = {};
    Object.keys(saved.inv).forEach(function (id) {
      if (ITEMS[id] && isFinite(saved.inv[id]) && saved.inv[id] > 0) out.inv[id] = Math.floor(saved.inv[id]);
    });
  }
  if (saved.equip) {
    EQUIP_SLOTS.forEach(function (sl) {
      const id = saved.equip[sl.id];
      out.equip[sl.id] = (ITEMS[id] && ITEMS[id].type === 'equip') ? id : null;
    });
  }

  /* 技能等级 / 修炼进度 */
  if (saved.skills && typeof saved.skills === 'object') {
    SKILL_ORDER.forEach(function (id) {
      const ss = saved.skills[id];
      if (!ss || typeof ss !== 'object') return;
      const t = out.skills[id];
      if (isFinite(ss.lvl)) t.lvl = Math.max(1, Math.floor(ss.lvl));
      if (isFinite(ss.xp)) t.xp = Math.max(0, Number(ss.xp));
    });
    /* 修炼境界不能超过阶段表上限 */
    const sc = out.skills.cultivation;
    sc.lvl = Math.max(1, Math.min(sc.lvl, STAGES.length));
    const bi = breakInfo(sc.lvl - 1);
    if (bi && sc.xp > bi.need) sc.xp = bi.need;

    const cs = saved.skills.combat;
    if (cs && typeof cs === 'object') {
      const c = out.skills.combat;
      if (cs.monster && findMonster(cs.monster)) c.monster = cs.monster;
      if (cs.target && typeof cs.target === 'object' && isFinite(cs.target.hp)) c.target = cs.target;
      if (isFinite(cs.playerTimer)) c.playerTimer = Number(cs.playerTimer);
      if (isFinite(cs.monsterTimer)) c.monsterTimer = Number(cs.monsterTimer);
      if (isFinite(cs.respawn)) c.respawn = Number(cs.respawn);
    }
  }

  /* 精通表 */
  if (saved.mastery && typeof saved.mastery === 'object') {
    out.mastery = {};
    Object.keys(saved.mastery).forEach(function (id) {
      const m = saved.mastery[id];
      if (!m || typeof m !== 'object') return;
      if (isFinite(m.lvl) && isFinite(m.xp)) {
        out.mastery[id] = { lvl: Math.max(0, Math.min(CONFIG.MASTERY_CAP, Math.floor(m.lvl))), xp: Math.max(0, Number(m.xp)) };
      }
    });
  }

  /* 阵法（阵纹等级表，按当前配置裁剪，防止旧存档引用了已删除的阵法） */
  if (saved.formations && typeof saved.formations === 'object') {
    out.formations = {};
    FORMATIONS.forEach(function (f) {
      const sv = saved.formations[f.id];
      if (!sv || !Array.isArray(sv.levels)) return;
      out.formations[f.id] = {
        levels: f.mods.map(function (m, i) {
          const v = Math.floor(Number(sv.levels[i]));
          return isFinite(v) ? Math.max(0, Math.min(m.max, v)) : 0;
        })
      };
    });
  }

  /* 灵植地块：按当前配置裁剪长度，超界的丢弃；地块已种但种子在当前 FARM_SEEDS 中找不到 → 清空 */
  const np = FARMING_PLOT_REQS.length;
  out.plots = [];
  for (let i = 0; i < np; i++) {
    const sv = saved.plots && saved.plots[i] && typeof saved.plots[i] === 'object' ? saved.plots[i] : null;
    let seedId = null, growth = 0, ready = false;
    if (sv && typeof sv.seedId === 'string' && findSeed(sv.seedId)) seedId = sv.seedId;
    if (sv && isFinite(sv.growth)) growth = Math.max(0, Number(sv.growth));
    if (sv && typeof sv.ready === 'boolean') ready = sv.ready;
    if (!seedId) { growth = 0; ready = false; }
    out.plots.push({ seedId: seedId, growth: growth, ready: ready });
  }

  /* 动作槽合法性校验（防止旧存档引用已删除的动作） */
  if (saved.action && typeof saved.action === 'object' && saved.action.skill && saved.action.id) {
    if (findActivity(saved.action.skill, saved.action.id)) {
      out.action = { skill: saved.action.skill, id: saved.action.id };
    }
  }
  if (isFinite(saved.actionTimer)) out.actionTimer = Math.max(0, Number(saved.actionTimer));
  if (typeof saved.actionWaiting === 'boolean') out.actionWaiting = saved.actionWaiting;
  if (isFinite(saved.regenTimer)) out.regenTimer = Math.max(0, Number(saved.regenTimer));

  /* 任务 */
  if (saved.tasks && typeof saved.tasks === 'object') {
    out.tasks = {};
    TASKS.forEach(function (t) {
      const rec = saved.tasks[t.id];
      if (rec && typeof rec === 'object') out.tasks[t.id] = { done: !!rec.done, claimed: !!rec.claimed };
    });
  }

  /* UI 偏好 */
  if (saved.ui && typeof saved.ui === 'object') {
    if (SKILL_ORDER.indexOf(saved.ui.active) >= 0 || saved.ui.active === 'tasks' || saved.ui.active === 'shop' || saved.ui.active === 'bag') out.ui.active = saved.ui.active;
    if (typeof saved.ui.autoEat === 'boolean') out.ui.autoEat = saved.ui.autoEat;
    if (typeof saved.ui.eatFood === 'string') out.ui.eatFood = saved.ui.eatFood;
    if (isFinite(saved.ui.eatRatio)) out.ui.eatRatio = Math.max(0.1, Math.min(0.9, Number(saved.ui.eatRatio)));
    if (typeof saved.ui.invFilter === 'string') out.ui.invFilter = saved.ui.invFilter;
    if (typeof saved.ui.invSellMode === 'boolean') out.ui.invSellMode = saved.ui.invSellMode;
    if (typeof saved.ui.shopCat === 'string') out.ui.shopCat = saved.ui.shopCat;
  }

  /* 统计 */
  if (saved.stats && typeof saved.stats === 'object') {
    ['gathered', 'crafts', 'kills', 'deaths', 'breaks', 'pills'].forEach(function (k) {
      if (isFinite(saved.stats[k])) out.stats[k] = Number(saved.stats[k]);
    });
    if (saved.stats.gained && typeof saved.stats.gained === 'object') {
      out.stats.gained = {};
      Object.keys(saved.stats.gained).forEach(function (id) {
        if (isFinite(saved.stats.gained[id])) out.stats.gained[id] = Math.max(0, Number(saved.stats.gained[id]));
      });
    }
  }
  if (Array.isArray(saved.log)) out.log = saved.log.slice(0, 60);

  return out;
}

function resetGame() {
  try { localStorage.removeItem(CONFIG.SAVE_KEY); } catch (e) { /* noop */ }
  state = defaultState();
  saveState();
}
