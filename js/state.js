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
    insight: 0,         // 悟性：每点 修炼速度 +1% / 突破成功率 +1%（悟道丹提升）
    skills: {},
    mastery: {},        // 精通表：actionId -> { lvl, xp }
    formations: {},     // 阵法表：formId -> { levels: [各阵纹等级] }
    dungeons: {},       // 秘境通关次数：dungeonId -> 次数
    plots: Array.from({ length: FARMING_PLOT_REQS.length }, () => ({ seedId: null, growth: 0, ready: false })),

    /* 世界 · 洞天：建筑等级 + 人口 + 洞天内部资源（粮食/木材/石料） */
    world: {
      buildings: { farm: 1, lumber: 1, house: 1 },
      pop: 2,
      res: { food: 120, wood: 40, stone: 20 }
    },

    /* 信徒：owned 为仓库中的信徒 id，equipped 的位数由招贤殿等级决定（视作装备栏） */
    disciples: { owned: [], equipped: [] },

    /* 穿越星球：仅面板打开时运转（items 为飞行中的物品，瞬态不落存档）
       aura 为灵气浓度（长期进度，不随开关清空），cross 为穿越次数 */
    planet: { open: false, timer: PLANET.SPAWN_BASE, boost: 0, seq: 1, items: [], session: { gold: 0, star: 0, mat: 0, count: 0 }, aura: PLANET.AURA_CAP_BASE, cross: 0, waitReason: '' },

    /* 单一动作槽：同一时刻只能进行一件事 */
    action: { skill: 'cultivation', id: 'meditate' },
    actionTimer: 0,     // 当前周期已累计秒数
    actionWaiting: false,

    regenTimer: 0,      // 脱战回血计时
    stun: 0,            // 眩晕剩余秒数（入世被识破时累积，期间无法开始新动作）
    taskTimer: 0,       // 任务检查计时

    tasks: {},          // taskId -> { done, claimed }
    ui: { active: 'woodcutting', autoEat: true, eatFood: 'auto', eatRatio: 0.35, invFilter: 'all', invSellMode: false, itemQty: 1, shopCat: 'general', farmSeedId: null, worldTerrain: 'all' },
    log: [],
    stats: { gathered: 0, crafts: 0, kills: 0, deaths: 0, breaks: 0, pills: 0, gained: {}, perSkill: {}, startedAt: Date.now() },
    lastSave: Date.now()
  };

  SKILL_ORDER.forEach(function (id) {
    s.skills[id] = { lvl: 1, xp: 0 };
    s.stats.perSkill[id] = 0;
  });
  /* 战斗技能额外字段（dungeon/floor 为秘境进度） */
  Object.assign(s.skills.combat, { monster: null, target: null, playerTimer: 0, monsterTimer: 0, respawn: 0, dungeon: null, floor: 0 });
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
  /* 悟性（旧存档的 root 资质字段已废弃，直接忽略） */
  if (isFinite(saved.insight)) out.insight = Math.max(0, Math.floor(Number(saved.insight)));

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
    /* 修炼境界不能超过阶段表上限（含太上境的 96,500 层） */
    const sc = out.skills.cultivation;
    sc.lvl = Math.max(1, Math.min(sc.lvl, TOTAL_STAGES));
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
      /* 秘境进度：秘境必须仍存在，且波次收敛到合法范围；当前妖兽同步为该波妖兽 */
      if (cs.dungeon && findDungeon(cs.dungeon)) {
        const dg = findDungeon(cs.dungeon);
        c.dungeon = dg.id;
        c.floor = isFinite(cs.floor) ? Math.max(0, Math.min(dg.floors.length - 1, Math.floor(cs.floor))) : 0;
        c.monster = dg.floors[c.floor];
      }
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

  /* 秘境通关次数（只保留当前配置里仍存在的秘境） */
  if (saved.dungeons && typeof saved.dungeons === 'object') {
    out.dungeons = {};
    DUNGEONS.forEach(function (d) {
      const n = saved.dungeons[d.id];
      if (isFinite(n) && n > 0) out.dungeons[d.id] = Math.floor(n);
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

  /* 世界 · 洞天：建筑等级按当前配置裁剪（删除过的建筑直接丢弃），资源钳制到容量 */
  if (saved.world && typeof saved.world === 'object') {
    out.world = { buildings: {}, pop: 0, res: { food: 0, wood: 0, stone: 0 } };
    const sb = saved.world.buildings;
    if (sb && typeof sb === 'object') {
      BUILDINGS.forEach(function (b) {
        const lv = Math.floor(Number(sb[b.id]));
        if (isFinite(lv) && lv > 0) out.world.buildings[b.id] = lv;
      });
    }
    const sr = saved.world.res;
    if (sr && typeof sr === 'object') {
      /* 仓储上限随建设度变化，裁剪时按当前建筑总等级推算 */
      let lvSum = 0;
      Object.keys(out.world.buildings).forEach(function (id) { lvSum += out.world.buildings[id] || 0; });
      const cap = worldCap(1 + lvSum);
      ['food', 'wood', 'stone'].forEach(function (k) {
        if (isFinite(sr[k])) out.world.res[k] = Math.max(0, Math.min(cap[k], Number(sr[k])));
      });
    }
    if (isFinite(saved.world.pop)) {
      out.world.pop = Math.max(0, Math.min(worldPopCap(out), Number(saved.world.pop)));
    }
  }

  /* 信徒：id 必须存在于当前配置；上阵位数量由招贤殿等级决定（未建造 = 0） */
  {
    const hall = out.world.buildings.summonhall || 0;
    const slots = hall * DISCIPLE.SLOTS_PER_LVL;
    out.disciples = { owned: [], equipped: [] };
    for (let i = 0; i < slots; i++) out.disciples.equipped.push(null);

    const sd = saved.disciples;
    if (sd && typeof sd === 'object') {
      if (Array.isArray(sd.owned)) {
        sd.owned.forEach(function (id) { if (findDisciple(id)) out.disciples.owned.push(id); });
      }
      if (Array.isArray(sd.equipped)) {
        for (let i = 0; i < slots; i++) {
          if (findDisciple(sd.equipped[i])) out.disciples.equipped[i] = sd.equipped[i];
        }
      }
    }

    /* 容量裁剪：上阵数 + 仓库数 ≤ 招贤殿容量，多出的优先保留上阵者 */
    const cap = hall > 0 ? DISCIPLE.BASE_STORE + (hall - 1) * DISCIPLE.STORE_PER_LVL : 0;
    let eq = 0;
    out.disciples.equipped.forEach(function (id) { if (id) eq += 1; });
    const storeRoom = Math.max(0, cap - eq);
    if (out.disciples.owned.length > storeRoom) out.disciples.owned.length = storeRoom;
  }

  /* 动作槽合法性校验（防止旧存档引用已删除的动作） */
  if (saved.action && typeof saved.action === 'object' && saved.action.skill && saved.action.id) {
    if (findActivity(saved.action.skill, saved.action.id)) {
      out.action = { skill: saved.action.skill, id: saved.action.id };
    }
  }
  if (isFinite(saved.actionTimer)) out.actionTimer = Math.max(0, Number(saved.actionTimer));
  if (typeof saved.actionWaiting === 'boolean') out.actionWaiting = saved.actionWaiting;

  /* 星球是主动动作，但不在 ACTIONS/RECIPES 表内：读档一律不恢复，
     保持「未开启」，也避免 defaultState 的打坐动作顶替它偷偷占槽 */
  if (saved.action && saved.action.skill === 'planet') {
    out.action = null;
    out.actionTimer = 0;
    out.actionWaiting = false;
  }
  if (isFinite(saved.regenTimer)) out.regenTimer = Math.max(0, Number(saved.regenTimer));
  if (isFinite(saved.stun)) out.stun = Math.max(0, Number(saved.stun));

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
    if (SKILL_ORDER.indexOf(saved.ui.active) >= 0 || saved.ui.active === 'tasks' || saved.ui.active === 'shop' || saved.ui.active === 'bag' || saved.ui.active === 'world' || saved.ui.active === 'disciples' || saved.ui.active === 'planet') out.ui.active = saved.ui.active;
    if (typeof saved.ui.autoEat === 'boolean') out.ui.autoEat = saved.ui.autoEat;
    if (typeof saved.ui.eatFood === 'string') out.ui.eatFood = saved.ui.eatFood;
    if (isFinite(saved.ui.eatRatio)) out.ui.eatRatio = Math.max(0.1, Math.min(0.9, Number(saved.ui.eatRatio)));
    if (typeof saved.ui.invFilter === 'string') out.ui.invFilter = saved.ui.invFilter;
    if (typeof saved.ui.invSellMode === 'boolean') out.ui.invSellMode = saved.ui.invSellMode;
    /* 使用 / 出售数量：-1 表示全部，其余为正整数（兼容旧档的 sellQty） */
    if (isFinite(saved.ui.itemQty) || isFinite(saved.ui.sellQty)) {
      const q = Math.floor(Number(isFinite(saved.ui.itemQty) ? saved.ui.itemQty : saved.ui.sellQty));
      out.ui.itemQty = q === -1 ? -1 : Math.max(1, Math.min(9999, q));
    }
    if (typeof saved.ui.shopCat === 'string') out.ui.shopCat = saved.ui.shopCat;
    /* 洞天地形筛选：'all' 或当前配置里仍存在的地形 id */
    if (saved.ui.worldTerrain === 'all' || findTerrain(saved.ui.worldTerrain)) out.ui.worldTerrain = saved.ui.worldTerrain;
  }

  /* 穿越星球：飞行中的物品 / 加速 / 本局收获是瞬态数据，读档一律从空盘开始（防止离线白拿）。
     灵气浓度与穿越次数是长期进度：旧存档缺失时给满浓度 / 0 次，并钳制到当前上限，
     保证不会出现负值、NaN 或超过上限的数值。 */
  out.planet = {
    open: false, timer: PLANET.SPAWN_BASE, boost: 0, seq: 1, items: [],
    session: { gold: 0, star: 0, mat: 0, count: 0 },
    aura: planetAuraCap(out), cross: 0, waitReason: ''
  };
  {
    const sp = (saved.planet && typeof saved.planet === 'object') ? saved.planet : null;
    if (sp) {
      const cap = planetAuraCap(out);
      const aura = isFinite(sp.aura) ? Number(sp.aura) : cap;
      out.planet.aura = Math.max(PLANET.AURA_MIN, Math.min(cap, aura));
      if (isFinite(sp.cross)) {
        out.planet.cross = Math.max(0, Math.min(10000, Math.floor(Number(sp.cross))));
      }
    }
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
    /* 分技能累计采集次数（隐藏秘境解锁条件） */
    if (saved.stats.perSkill && typeof saved.stats.perSkill === 'object') {
      out.stats.perSkill = {};
      SKILL_ORDER.forEach(function (id) {
        const n = saved.stats.perSkill[id];
        out.stats.perSkill[id] = (isFinite(n) && n >= 0) ? Math.floor(Number(n)) : 0;
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
