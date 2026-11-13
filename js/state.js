'use strict';

/* =========================================================================
 * 穿越星球 · 状态与存档层
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
    seed: 0,            // 生命之种（穿越星球 / 裂缝掉落，用于洞天「朝代」召唤与合成）
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
      res: { food: 120, wood: 40, stone: 20 },
      /* 朝代：dynasties 每项 { dyn: 年代下标, pop: 人口, cap: 人口上限 }
         dynAccum：距下一次 10 分钟结算的累计秒数（落盘，离线走同一 tick） */
      dynasties: [], dynAccum: 0
    },

    /* 信徒：owned 为仓库中的信徒 id，equipped 的位数由招贤殿等级决定（视作装备栏） */
    disciples: { owned: [], equipped: [] },

    /* 穿越星球：仅面板打开时运转（items 为飞行中的物品，瞬态不落存档）
       aura 为灵气浓度（长期进度，不随开关清空），cross 为穿越次数 */
    planet: { open: false, timer: PLANET.SPAWN_BASE, boost: 0, seq: 1, items: [], session: { gold: 0, star: 0, mat: 0, count: 0 }, aura: Math.round(PLANET.AURA_CAP_BASE * PLANET.AURA_START_RATIO), auraVer: 1, cross: 0, waitReason: '' },

    /* 锁妖塔：current 当前层 / best 最高已通关层 / pending 待领取层（false = 无）
       failed 仅用于界面显示「已阵亡」，读档不恢复；层数永不回退 */
    tower: { current: 1, best: 1, pending: false, failed: false },

    /* 异界裂缝：open 是否存在未修复裂缝 / tier 生成时的穿越次数（层级）
       新档自带第 0 层裂缝；每次穿越成功后生成 tier=穿越次数的新裂缝 */
    rift: { open: true, tier: 0 },

    /* 五行属性裂缝：next 下次整轮刷新的时间戳（Date.now） / slots 三道裂缝
       slot = { elem: 五行id, tier: 生成时强度快照, fixed: 是否已修复 }
       新档 / 旧档兜底都会立刻生成一轮；刷新为覆盖式，不累积 */
    elemRifts: { next: Date.now() + ELEM_RIFT.REFRESH_MS, slots: [] },

    /* 裂缝怪物：alive 是否存在（未击败）/ born 生成时间 / next 下次整轮刷新
       tier 生成时的穿越次数快照。新档与旧档兜底都会立刻出现一只 */
    riftMon: { alive: true, born: Date.now(), next: Date.now() + RIFT_MON.REFRESH_MS, tier: 0 },

    /* 单一动作槽：同一时刻只能进行一件事 */
    action: { skill: 'cultivation', id: 'meditate' },
    actionTimer: 0,     // 当前周期已累计秒数
    actionWaiting: false,

    regenTimer: 0,      // 脱战回血计时
    stun: 0,            // 眩晕剩余秒数（入世被识破时累积，期间无法开始新动作）
    taskTimer: 0,       // 任务检查计时

    tasks: {},          // taskId -> { done, claimed }
    ui: { active: 'woodcutting', planetView: 'main', elemSlot: 0, worldView: 'main', dynMerge: -1, autoEat: true, eatFood: 'auto', eatRatio: 0.35, invFilter: 'all', invSellMode: false, itemQty: 1, shopCat: 'general', farmSeedId: null, worldTerrain: 'all' },
    log: [],
    stats: { gathered: 0, crafts: 0, kills: 0, deaths: 0, breaks: 0, pills: 0, gained: {}, perSkill: {}, startedAt: Date.now() },
    lastSave: Date.now()
  };

  SKILL_ORDER.forEach(function (id) {
    s.skills[id] = { lvl: 1, xp: 0 };
    s.stats.perSkill[id] = 0;
  });
  /* 战斗技能额外字段（dungeon/floor 为秘境进度，tower 为锁妖塔当前挑战层，0 表示不在塔内） */
  Object.assign(s.skills.combat, { monster: null, target: null, playerTimer: 0, monsterTimer: 0, respawn: 0, dungeon: null, floor: 0, tower: 0, rift: -1, elem: -1, elemRw: null, riftMon: -1 });
  /* 修炼瓶颈标记（修为封顶时提示一次） */
  s.skills.cultivation.capped = false;
  /* 新档立刻生成一轮五行属性裂缝（依赖上面的技能等级与穿越次数） */
  s.elemRifts.slots = elemRiftSlotsRoll(s);

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
  /* 生命之种：缺失按 0（旧档）；异常值钳制为非负有限整数 */
  if (isFinite(saved.seed)) out.seed = Math.max(0, Math.min(1e12, Math.floor(Number(saved.seed))));
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
      /* 锁妖塔 / 异界裂缝 / 五行属性裂缝战斗是瞬态：读档一律不恢复，避免离线继续战斗或残留目标 */
      c.tower = 0;
      c.rift = -1;
      c.elem = -1;
      c.elemRw = null;
      c.riftMon = -1;
      if (cs.tower || cs.rift >= 0 || cs.elem >= 0 || cs.riftMon >= 0) { c.monster = null; c.target = null; }
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
    out.world = { buildings: {}, pop: 0, res: { food: 0, wood: 0, stone: 0 }, dynasties: [], dynAccum: 0 };
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
    /* 朝代：只接受合法年代下标与非负有限数值；人数夹到 [1, 硬顶]，上限不低于起始值。
       数量不超过「小世界等级 × 5」，超出部分丢弃（防止改档撑爆界面）。 */
    const maxDyn = Math.max(0, (out.world.buildings.smallworld || 0) * DYNASTY.SLOTS_PER_LVL);
    if (Array.isArray(saved.world.dynasties)) {
      saved.world.dynasties.slice(0, maxDyn).forEach(function (d) {
        if (!d || typeof d !== 'object') return;
        const era = Math.floor(Number(d.dyn));
        if (!isFinite(era) || era < 0 || era > DYNASTY.ERA_MAX) return;
        const cap = isFinite(d.cap)
          ? Math.max(DYNASTY.BASE_CAP, Math.min(DYNASTY.POP_HARD_CAP, Number(d.cap)))
          : DYNASTY.BASE_CAP;
        let pop = isFinite(d.pop) ? Number(d.pop) : DYNASTY.START_POP;
        pop = Math.max(1, Math.min(DYNASTY.POP_HARD_CAP, pop));
        if (pop > cap) pop = cap;
        out.world.dynasties.push({ dyn: era, pop: pop, cap: cap });
      });
    }
    /* 结算累计秒：缺失按 0；非法或超出 1 个周期按 0 处理，避免读档瞬间连结算 */
    if (isFinite(saved.world.dynAccum)) {
      const a = Number(saved.world.dynAccum);
      out.world.dynAccum = a >= 0 && a < DYNASTY.TICK_SEC ? a : 0;
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

  /* 锁妖塔：current/best 永久保存且只增不减；pending 必须是「当前层」的待领奖标记。
     旧档无此字段 → 1 / 1 / false；非法值一律钳制到合法范围。 */
  out.tower = { current: 1, best: 1, pending: false, failed: false };
  {
    const st = (saved.tower && typeof saved.tower === 'object') ? saved.tower : null;
    if (st) {
      if (isFinite(st.current)) {
        out.tower.current = Math.max(1, Math.min(TOWER.MAX_FLOOR, Math.floor(Number(st.current))));
      }
      if (isFinite(st.best)) {
        out.tower.best = Math.max(1, Math.min(TOWER.MAX_FLOOR, Math.floor(Number(st.best))));
      }
      if (st.pending !== false && st.pending != null && isFinite(st.pending)) {
        const pf = Math.floor(Number(st.pending));
        if (pf >= 1 && pf === out.tower.current) out.tower.pending = pf;
      }
    }
    /* best 定义为「最高已通关层」：当前层最多领先 1 层；旧档异常值要收敛 */
    out.tower.best = Math.max(out.tower.best, out.tower.current - 1);
    out.tower.best = Math.min(TOWER.MAX_FLOOR, out.tower.best);
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
  if (saved.action && (saved.action.skill === 'planet' || saved.action.skill === 'tower' || saved.action.skill === 'rift' || saved.action.skill === 'elem' || saved.action.skill === 'riftmon')) {
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
    if (SKILL_ORDER.indexOf(saved.ui.active) >= 0 || saved.ui.active === 'tasks' || saved.ui.active === 'shop' || saved.ui.active === 'bag' || saved.ui.active === 'world' || saved.ui.active === 'disciples' || saved.ui.active === 'planet' || saved.ui.active === 'tower' || saved.ui.active === 'settings') out.ui.active = saved.ui.active;
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
    /* 洞天子视图：'main' 建筑页 / 'dynasty' 朝代页 */
    out.ui.worldView = saved.ui.worldView === 'dynasty' ? 'dynasty' : 'main';
    out.ui.dynMerge = -1;
  }

  /* 穿越星球：飞行中的物品 / 加速 / 本局收获是瞬态数据，读档一律从空盘开始（防止离线白拿）。
     灵气浓度与穿越次数是长期进度：先恢复 cross，再按新的上限公式换算 aura。
     auraVer 用于区分 v1.9.8 旧档（旧档的 100 上限数值在新体系里没有意义，按新档 30% 起始）；
     已有 auraVer 的存档只做有限值校验与 [AURA_MIN, 上限] 钳制，保证不为负、不为 NaN、不超上限。 */
  out.planet = {
    open: false, timer: PLANET.SPAWN_BASE, boost: 0, seq: 1, items: [],
    session: { gold: 0, star: 0, mat: 0, count: 0 },
    aura: Math.round(PLANET.AURA_CAP_BASE * PLANET.AURA_START_RATIO),
    auraVer: 1, cross: 0, waitReason: ''
  };
  {
    const sp = (saved.planet && typeof saved.planet === 'object') ? saved.planet : null;
    if (sp && isFinite(sp.cross)) {
      out.planet.cross = Math.max(0, Math.min(10000, Math.floor(Number(sp.cross))));
    }
    /* cross 先落位，上限与恢复才会按正确的穿越次数计算 */
    const cap = planetAuraCap(out);
    const isMigrated = !sp || !isFinite(sp.auraVer);
    if (isMigrated || !sp || !isFinite(sp.aura)) {
      out.planet.aura = planetAuraStart(out);
    } else {
      out.planet.aura = Math.max(PLANET.AURA_MIN, Math.min(cap, Number(sp.aura)));
    }
    out.planet.auraVer = 1;
  }

  /* 异界裂缝：open 是否存在未修复裂缝；tier 为生成时的穿越次数（层级）。
     旧档（无 rift 字段）兜底为「有一个未修复裂缝」：层级取 min(穿越次数, 战斗等级-1)，
     既不会白送穿越，也不会让高穿越 / 低战斗的老存档被永久锁死。
     裂缝层级不可能超过当前穿越次数。 */
  out.rift = { open: true, tier: 0 };
  {
    const sr = (saved.rift && typeof saved.rift === 'object') ? saved.rift : null;
    const fallbackTier = Math.max(0, Math.min(out.planet.cross, out.skills.combat.lvl - 1));
    if (sr) {
      if (typeof sr.open === 'boolean') out.rift.open = sr.open;
      out.rift.tier = isFinite(sr.tier)
        ? Math.max(0, Math.min(RIFT.MAX_TIER, Math.floor(Number(sr.tier))))
        : fallbackTier;
    } else {
      out.rift.open = true;
      out.rift.tier = fallbackTier;
    }
    if (out.rift.tier > out.planet.cross) out.rift.tier = out.planet.cross;
  }

  /* 五行属性裂缝：next 为下次整轮刷新的时间戳，slots 为三道裂缝
     （elem 五行 / tier 生成时强度快照 / fixed 是否已修复）。
     旧档（无 elemRifts 字段）兜底：按当前时间立刻生成一轮新的三个。
     已到期 → 立刻整轮覆盖刷新（离线不补刷，回来只刷一次）；
     next 缺失或异常 → 现在 + 3 小时。非法 slot 丢弃后补足。 */
  out.elemRifts = { next: Date.now() + ELEM_RIFT.REFRESH_MS, slots: [] };
  {
    const se = (saved.elemRifts && typeof saved.elemRifts === 'object') ? saved.elemRifts : null;
    const now = Date.now();
    if (se) {
      if (isFinite(se.next) && Number(se.next) > 0) {
        out.elemRifts.next = Math.min(Number(se.next), now + ELEM_RIFT.REFRESH_MS);
      }
      if (Array.isArray(se.slots)) {
        se.slots.slice(0, ELEM_RIFT.SLOTS).forEach(function (sl) {
          if (!sl || typeof sl !== 'object') return;
          const el = findElemRift(sl.elem);
          if (!el) return;
          out.elemRifts.slots.push({
            elem: el.id,
            tier: isFinite(sl.tier) ? Math.max(0, Math.min(ELEM_RIFT.MAX_TIER, Math.floor(Number(sl.tier)))) : 0,
            fixed: !!sl.fixed
          });
        });
      }
    }
    while (out.elemRifts.slots.length < ELEM_RIFT.SLOTS) {
      out.elemRifts.slots.push(elemRiftSlotRoll(out));
    }
    if (now >= out.elemRifts.next) {
      out.elemRifts.slots = elemRiftSlotsRoll(out);
      out.elemRifts.next = now + ELEM_RIFT.REFRESH_MS;
    }
  }

  /* 裂缝怪物：alive/born/next/tier 全部落盘；已击败（alive=false）保持到下一轮刷新。
     旧档（无 riftMon 字段）按当前时间生成一只；next 已过期（离线超过 24 小时）→
     直接换上新一轮，不做多次补偿刷新。生成战斗是瞬态，读档不恢复。 */
  out.riftMon = {
    alive: true,
    born: Date.now(),
    next: Date.now() + RIFT_MON.REFRESH_MS,
    tier: Math.min(RIFT_MON.MAX_TIER, out.planet.cross)
  };
  {
    const sm = (saved.riftMon && typeof saved.riftMon === 'object') ? saved.riftMon : null;
    const now = Date.now();
    if (sm) {
      out.riftMon.alive = typeof sm.alive === 'boolean' ? sm.alive : true;
      if (isFinite(sm.born) && Number(sm.born) > 0) out.riftMon.born = Number(sm.born);
      if (isFinite(sm.next) && Number(sm.next) > 0) {
        out.riftMon.next = Math.min(Number(sm.next), now + RIFT_MON.REFRESH_MS);
      }
      if (isFinite(sm.tier)) {
        out.riftMon.tier = Math.max(0, Math.min(RIFT_MON.MAX_TIER, Math.floor(Number(sm.tier))));
      }
      /* 刷新到期：无论之前是否击败，都换一只新怪物（覆盖式，不累积） */
      if (now >= out.riftMon.next) {
        out.riftMon.alive = true;
        out.riftMon.born = now;
        out.riftMon.next = now + RIFT_MON.REFRESH_MS;
        out.riftMon.tier = Math.min(RIFT_MON.MAX_TIER, out.planet.cross);
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
