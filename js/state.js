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
    invSlots: 0,        // 背包扩容次数（每次 +INV_SLOT_STEP 格，价格逐次递增）
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
         dynAccum：距下一次 1 小时结算的累计秒数（落盘，离线走同一 tick）
         dynScale：人口量级标记，旧档（无此字段）读档时按 POP_UNIT 放大一次
         dynTick：结算周期标记（3600），缺失/不同表示旧档 10 分钟口径，按比例迁移 */
      dynasties: [], dynAccum: 0, dynScale: DYNASTY.POP_UNIT, dynTick: DYNASTY.TICK_SEC
    },

    /* 信徒（v2.9.0 五行制）：owned 存实例 { uid, id, tier, elems[], power }；
       assign 存「任务 key → uid」，每个主动任务一个位置，一位信徒只挂一个任务；
       peak 为历史招募峰值（只增不减），招募费按它计算，防止反复招募删除刷低价 */
    disciples: { owned: [], assign: {}, peak: 0 },

    /* 穿越星球：仅面板打开时运转（items 为飞行中的物品，瞬态不落存档）
       aura 为灵气浓度（长期进度，不随开关清空），cross 为穿越次数 */
    planet: { open: false, timer: PLANET.SPAWN_BASE, boost: 0, seq: 1, items: [], session: { gold: 0, star: 0, mat: 0, seed: 0, count: 0 }, aura: Math.round(PLANET.AURA_CAP_BASE * PLANET.AURA_START_RATIO), auraVer: 1, cross: 0, waitReason: '' },

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

    /* 单一动作槽：同一时刻只能进行一件事；新档默认空闲，不自动开启任何动作。
       actionExplicit 标记该动作是否由玩家主动点击开启，用于读档时区分「玩家保留的挂机」
       与旧版默认塞入的打坐（旧档没有该字段，需要清理历史默认值）。 */
    action: null,
    actionExplicit: false,
    actionTimer: 0,     // 当前周期已累计秒数
    actionWaiting: false,

    regenTimer: 0,      // 脱战回血计时
    stun: 0,            // 眩晕剩余秒数（入世被识破时累积，期间无法开始新动作）
    taskTimer: 0,       // 任务检查计时

    tasks: {},          // taskId -> { done, claimed }
    /* 签到（七日循环）：day = 下一次可领的天数（1~7）；lastKey = 最近领取的本地日期
       'YYYY-MM-DD'；total = 累计领取次数；pending = 第 7 天信徒待入仓（仓库满/未建招贤殿）
       —— 只按本地日期判定，无服务器时间；异常值在 mergeState 中兜底 */
    checkin: { day: 1, lastKey: '', total: 0, pending: false },
    /* 问道指引（v2.14.0）：done = 已完成步骤 id 集合；inferred = 旧档推断完成（不补发奖励）
       flags = 面板访问 / 购买等行为标记；skipped = 已跳过（不再弹提示）；closed = 已收起（可手动重开） */
    guide: { done: {}, inferred: {}, flags: {}, skipped: false, closed: false },
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
  /* 旧档（v2.14.0 之前没有 guide 字段）：读档后按现有进度推断已完成步骤，
     只打勾不补发奖励，避免老玩家一次性获得全部教学奖励。 */
  const needGuideInfer = !(saved && saved.guide && typeof saved.guide === 'object');
  state = mergeState(def, saved);
  if (needGuideInfer && typeof guideInfer === 'function') guideInfer();

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
  /* 背包扩容次数（v2.13.0）：旧档缺失按 0，异常值夹到 [0, 最大次数] */
  {
    const maxSteps = Math.max(0, Math.floor((CONFIG.INV_SLOT_MAX - CONFIG.INV_SLOTS) / CONFIG.INV_SLOT_STEP));
    const n = Math.floor(Number(saved.invSlots));
    out.invSlots = isFinite(n) ? Math.max(0, Math.min(maxSteps, n)) : 0;
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
    out.world = { buildings: {}, pop: 0, res: { food: 0, wood: 0, stone: 0 }, dynasties: [], dynAccum: 0, dynScale: DYNASTY.POP_UNIT, dynTick: DYNASTY.TICK_SEC };
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
    /* 朝代：只接受合法年代下标与非负有限数值；人数夹到 [0, 硬顶]，上限不低于起始值。
       数量不超过「小世界等级 × 5」，超出部分丢弃（防止改档撑爆界面）。
       旧档没有 dynScale 标记 → 旧量级（3 / 12）按 POP_UNIT 放大一次，再统一钳制。 */
    const maxDyn = Math.max(0, (out.world.buildings.smallworld || 0) * DYNASTY.SLOTS_PER_LVL);
    const legacyPop = Number(saved.world.dynScale) !== DYNASTY.POP_UNIT;
    if (Array.isArray(saved.world.dynasties)) {
      saved.world.dynasties.slice(0, maxDyn).forEach(function (d) {
        if (!d || typeof d !== 'object') return;
        const era = Math.floor(Number(d.dyn));
        if (!isFinite(era) || era < 0 || era > DYNASTY.ERA_MAX) return;
        let rawCap = isFinite(d.cap) ? Number(d.cap) : DYNASTY.BASE_CAP;
        let rawPop = isFinite(d.pop) ? Number(d.pop) : DYNASTY.START_POP;
        if (legacyPop) { rawCap *= DYNASTY.POP_UNIT; rawPop *= DYNASTY.POP_UNIT; }
        const cap = Math.max(DYNASTY.BASE_CAP, Math.min(DYNASTY.POP_HARD_CAP, rawCap));
        let pop = Math.max(0, Math.min(DYNASTY.POP_HARD_CAP, rawPop));
        if (pop > cap) pop = cap;
        /* 职位映射（v2.9.5）：优先读 d.posts；v2.9.4 及更早只有 emperor / empress，
           平移到通用映射的对应键。非法值此处先置 null，稍后统一做存在性 / 唯一性校验。 */
        const posts = newDynPosts();
        if (d.posts && typeof d.posts === 'object') {
          DYNASTY.POST_ORDER.forEach(function (role) {
            const uid = d.posts[role];
            if (typeof uid === 'string' && uid) posts[role] = uid;
          });
        }
        ['emperor', 'empress'].forEach(function (role) {
          if (posts[role]) return;
          const uid = d[role];
          if (typeof uid === 'string' && uid) posts[role] = uid;
        });
        out.world.dynasties.push({ dyn: era, pop: pop, cap: cap, posts: posts });
      });
    }
    out.world.dynScale = DYNASTY.POP_UNIT;
    /* 结算进度：新口径直接沿用；旧档（无 dynTick 或周期不同）按 600s→3600s
       等比放大 6 倍，保留「已完成百分比」，并夹到 3599 秒内避免读档瞬间补发。
       正常值域 [0, 3600)；异常值归零。 */
    if (isFinite(saved.world.dynAccum)) {
      let a = Number(saved.world.dynAccum);
      if (Number(saved.world.dynTick) !== DYNASTY.TICK_SEC) a *= 6;
      a = Math.min(DYNASTY.TICK_SEC - 1, a);
      out.world.dynAccum = a >= 0 ? a : 0;
    }
    out.world.dynTick = DYNASTY.TICK_SEC;
  }

  /* 信徒：统一规范为「五行齐全 + 主属性」实例（v2.9.2）
     - v2.9.1 及更早：保留旧 power 的相对水平 → 新副属性 = 旧 power × 50%，
       主属性优先沿用旧 elems[0]（旧属性本就随机，无需重掷）
     - v2.9.0 及更早的 id 字符串 → 按目录还原品质，强度与主属性重掷
     - 新档（已带 main）→ 逐字段校验，非法/缺失值重掷，杜绝 NaN 与重复 uid
     - v2.9.1 的 assign 只要 uid 仍有效就保留；更早的 equipped 旧上阵者退回仓库
     - 不额外扣费、不补发资源；总数仍受招贤殿容量限制，超出部分按原顺序丢弃 */
  out.disciples = { owned: [], assign: {}, peak: 0 };
  {
    const hall = out.world.buildings.summonhall || 0;
    const cap = hall > 0 ? DISCIPLE.BASE_STORE + (hall - 1) * DISCIPLE.STORE_PER_LVL : 0;
    const sd = (saved.disciples && typeof saved.disciples === 'object') ? saved.disciples : null;

    /* 旧档两处来源合并：仓库 + 上阵（旧档上阵者不在仓库里） */
    const rawList = [];
    if (sd && Array.isArray(sd.owned)) rawList.push.apply(rawList, sd.owned);
    if (sd && Array.isArray(sd.equipped)) rawList.push.apply(rawList, sd.equipped);
    const rawDao = {};   // uid → 存档里的道侣原始数组（v2.11.0 迁移用）

    const seen = {};
    rawList.forEach(function (raw) {
      if (out.disciples.owned.length >= cap) return;
      const obj = (raw && typeof raw === 'object') ? raw : { id: raw };
      const cat = findDisciple(obj.id);
      if (!cat) return;

      /* uid：可复用存档里的合法且不重复值，否则按目录 id 生成稳定 uid */
      let uid = (typeof obj.uid === 'string' && obj.uid && !seen[obj.uid]) ? obj.uid : '';
      if (!uid) {
        let n = 1;
        do { uid = 'dc_' + cat.id + '_' + n; n += 1; } while (seen[uid]);
      }
      seen[uid] = true;

      /* 主属性：新档沿用合法 main；v2.9.1 沿用旧 elems[0]；其余随机补掷 */
      const hasMain = typeof obj.main === 'string';
      let main;
      if (hasMain && elemInfo(obj.main)) main = obj.main;
      else if (Array.isArray(obj.elems) && elemInfo(obj.elems[0])) main = obj.elems[0];
      else main = rollDiscMain();

      /* 副属性强度：
         - 旧实例（有 elems、无 main）：旧 power 仅做旧区间钳制，再取 50% 映射到新副属性区间
         - 无 elems 的旧字符串：按新副属性区间重掷
         - 新实例（有 main）：校验后沿用，越界重掷 */
      let power = Number(obj.power);
      const newBase = DISCIPLE.ELEM_POWER[cat.tier] || DISCIPLE.ELEM_POWER[1];
      if (!hasMain && Array.isArray(obj.elems) && obj.elems.length > 0) {
        const oldBase = { 1: 0.04, 2: 0.06, 3: 0.09, 4: 0.13 }[cat.tier] || 0.04;
        const oldLo = oldBase * (1 - DISCIPLE.POWER_JITTER);
        const oldHi = oldBase * (1 + DISCIPLE.POWER_JITTER);
        const oldPower = isFinite(power) ? (power > oldHi ? oldHi : (power < oldLo ? oldLo : power)) : oldBase;
        power = Math.round(oldPower * 0.5 * 1000) / 1000;
      } else {
        const lo = newBase * (1 - DISCIPLE.POWER_JITTER);
        const hi = newBase * (1 + DISCIPLE.POWER_JITTER);
        if (!isFinite(power) || power < lo - 1e-9 || power > hi + 1e-9) {
          power = Math.round((lo + Math.random() * (hi - lo)) * 1000) / 1000;
        } else {
          power = Math.round(power * 1000) / 1000;
        }
      }

      /* 五行一律补全为金木水火土齐全；道侣原始记录留到全部实例建好后统一校验 */
      rawDao[uid] = Array.isArray(obj.dao) ? obj.dao : [];
      out.disciples.owned.push({
        uid: uid, id: cat.id, tier: cat.tier,
        elems: DISCIPLE.ALL_ELEMS.slice(), main: main, power: power, dao: []
      });
    });

    /* 道侣（v2.12.0）：每个实例新增 dao[]，记录 { uid, id, tier, main, power, state }（≤7）。
       state：'spent' 已化道（对方被消耗、加成保留）/ 'dead' 亡故 / 'alive' 旧档对称绑定。
       校验：非对象 / 非法 uid 丢弃；禁止自我引用与同表重复；超过 7 位截断。
       被消耗者 uid 不允许留在 owned：只要某条记录声明 spent，就把同 uid 实例移出仓库，
       并把它在 assign / 朝代职位中的引用交给后续既有校验清空（不会留下悬空 uid）。
       旧档无 state：有对方实例 → alive，否则 dead；power 优先用存档快照，缺失从对方补。
       对称修复只针对 alive 记录；spent 记录不补反向、dead 记录保持永久占位。 */
    {
      const byUid = {};
      out.disciples.owned.forEach(function (x) { byUid[x.uid] = x; });
      const consumed = {};   // 被化道者 uid：本次读档必须从仓库移除
      out.disciples.owned.forEach(function (x) {
        const raw = rawDao[x.uid];
        const list = [];
        const used = {};
        if (Array.isArray(raw)) {
          raw.forEach(function (r) {
            if (!r || typeof r !== 'object') return;
            const puid = r.uid;
            if (typeof puid !== 'string' || !puid || puid === x.uid || used[puid]) return;
            const partner = byUid[puid];
            const cat = findDisciple(r.id);
            if (!partner && !cat) return;
            const rt = Math.floor(Number(r.tier));
            const tier = partner ? partner.tier : (rt >= 1 && rt <= 4 ? rt : 1);
            const rid = cat ? cat.id : (partner ? partner.id : '');
            const main = (typeof r.main === 'string' && elemInfo(r.main))
              ? r.main : (partner ? partner.main : rollDiscMain());
            /* 副属性强度快照：必须落在该品阶的合法区间内，防止改档堆出异常加成 */
            const base = DISCIPLE.ELEM_POWER[tier] || DISCIPLE.ELEM_POWER[1];
            const lo = base * (1 - DISCIPLE.POWER_JITTER);
            const hi = base * (1 + DISCIPLE.POWER_JITTER);
            let pw = Number(r.power);
            if (!isFinite(pw) || pw <= 0) pw = partner ? partner.power : (lo + hi) / 2;
            pw = Math.round(Math.max(lo, Math.min(hi, pw)) * 1000) / 1000;
            let state;
            if (r.state === 'spent') state = 'spent';
            else if (r.state === 'dead' || r.alive === false) state = 'dead';
            else state = partner ? 'alive' : 'dead';
            if (state === 'spent') consumed[puid] = true;
            list.push({ uid: puid, id: rid, tier: tier, main: main, power: pw, state: state });
            used[puid] = true;
          });
        }
        x.dao = list.slice(0, DAOLV.MAX);
      });

      /* 被消耗者不得再出现在仓库里（正常存档不会出现；此处兜底改档/旧异常档） */
      if (Object.keys(consumed).length) {
        out.disciples.owned = out.disciples.owned.filter(function (x) { return !consumed[x.uid]; });
        const left = {};
        out.disciples.owned.forEach(function (x) { left[x.uid] = x; });
        out.disciples.owned.forEach(function (x) {
          x.dao.forEach(function (rec) {
            if (rec.state === 'spent') return;   // 化道声明本身保留
            if (!left[rec.uid] || consumed[rec.uid]) {
              rec.state = 'dead';
              rec.alive = false;
            }
          });
        });
      }

      const live = {};
      out.disciples.owned.forEach(function (x) { live[x.uid] = x; });
      /* 旧档对称修复两轮：only alive 记录；一侧 dead 则双向镜像 */
      for (let pass = 0; pass < 2; pass++) {
        out.disciples.owned.forEach(function (a) {
          a.dao.forEach(function (rec) {
            if (rec.state === 'spent') return;
            const b = live[rec.uid];
            if (!b) { rec.state = 'dead'; return; }
            let back = null;
            b.dao.forEach(function (r) { if (r && r.uid === a.uid) back = r; });
            if (!back) {
              if (b.dao.length < DAOLV.MAX) {
                b.dao.push({
                  uid: a.uid, id: a.id, tier: a.tier, main: a.main,
                  power: a.power, state: rec.state
                });
              } else {
                rec.state = 'dead';
              }
              return;
            }
            if (rec.state === 'dead' || back.state === 'dead') {
              rec.state = 'dead';
              back.state = 'dead';
            }
          });
        });
      }
      out.disciples.owned.forEach(function (x) {
        if (x.dao.length > DAOLV.MAX) x.dao.length = DAOLV.MAX;
        /* 兼容旧字段：spent 不写 alive；其余 alive=true 仅表示加成生效 */
        x.dao.forEach(function (rec) {
          if (rec.state === 'spent') delete rec.alive;
          else rec.alive = rec.state !== 'dead';
        });
      });
    }

    /* 上阵分配：任务必须支持五行、uid 必须存在、不超上阵位、一位信徒只挂一个任务 */
    const slots = hall * DISCIPLE.SLOTS_PER_LVL;
    const used = {};
    const savedAssign = (sd && sd.assign && typeof sd.assign === 'object') ? sd.assign : null;
    if (savedAssign) {
      Object.keys(savedAssign).forEach(function (taskKey) {
        if (!TASK_ELEM[taskKey]) return;
        const uid = savedAssign[taskKey];
        if (typeof uid !== 'string' || used[uid]) return;
        let exists = false;
        out.disciples.owned.forEach(function (x) { if (x.uid === uid) exists = true; });
        if (!exists) return;
        if (Object.keys(out.disciples.assign).length >= slots) return;
        out.disciples.assign[taskKey] = uid;
        used[uid] = true;
      });
    }

    /* 招募峰值：缺失（v2.9.0 及更早）按当前总数兜底，保证费用与旧版一致；
       异常值一律夹到 [0, 999]，且不低于当前仓库数量 */
    const sp = Number(sd && sd.peak);
    out.disciples.peak = Math.min(999, Math.max(
      out.disciples.owned.length,
      isFinite(sp) && sp > 0 ? Math.floor(sp) : 0
    ));
  }

  /* 朝代职位（v2.9.5）：通用映射 posts{8 个职位}。
     职位 uid 必须是 owned 中存在、未驻守任务、且全局唯一的信徒。
     旧档没有 posts → 从 emperor / empress 平滑迁移；非法 / 悬空 / 重复引用一律清空。 */
  {
    const ownedUids = {};
    out.disciples.owned.forEach(function (x) { ownedUids[x.uid] = true; });
    const assignedUids = {};
    Object.keys(out.disciples.assign).forEach(function (k) {
      assignedUids[out.disciples.assign[k]] = true;
    });
    const postUsed = {};
    out.world.dynasties.forEach(function (d) {
      const src = (d.posts && typeof d.posts === 'object') ? d.posts : {};
      const clean = newDynPosts();
      DYNASTY.POST_ORDER.forEach(function (role) {
        const uid = src[role];
        if (typeof uid !== 'string' || !uid || !ownedUids[uid] || assignedUids[uid] || postUsed[uid]) return;
        clean[role] = uid;
        postUsed[uid] = true;
      });
      d.posts = clean;
    });
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

  /* 动作槽恢复规则（v2.14.3）：
     - 新档 action 为 null，进游戏保持空闲；
     - 玩家主动开启的采集 / 配方动作可恢复，离线结算沿用该动作；
     - 旧版把 cultivation/meditate 写死在默认存档里，旧档没有 actionExplicit 标记，
       这类打坐一律视为历史默认值清空，避免每次进游戏自动打坐；
     - 星球 / 塔 / 裂缝等瞬态动作不恢复。 */
  const sa = (saved.action && typeof saved.action === 'object') ? saved.action : null;
  if (sa && sa.skill && sa.id && findActivity(sa.skill, sa.id)) {
    const legacyAutoMeditate = sa.skill === 'cultivation' && sa.id === 'meditate' &&
      saved.actionExplicit !== true;
    if (!legacyAutoMeditate) {
      out.action = { skill: sa.skill, id: sa.id };
      out.actionExplicit = true;
    }
  }
  if (isFinite(saved.actionTimer)) out.actionTimer = Math.max(0, Number(saved.actionTimer));
  if (typeof saved.actionWaiting === 'boolean') out.actionWaiting = saved.actionWaiting;

  /* 星球 / 锁妖塔 / 异界裂缝 / 属性裂缝 / 裂缝怪物均为主动或瞬态动作：读档一律不恢复，
     保持「未开启」，也避免默认值顶替它们偷偷占槽 */
  if (sa && (sa.skill === 'planet' || sa.skill === 'tower' || sa.skill === 'rift' || sa.skill === 'elem' || sa.skill === 'riftmon')) {
    out.action = null;
  }
  /* 没有合法动作时清掉残留计时，避免 UI 显示半截进度 */
  if (!out.action) {
    out.actionTimer = 0;
    out.actionWaiting = false;
    out.actionExplicit = false;
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

  /* 签到：缺失（旧档）→ 第 1 天可领；日期键必须是合法 'YYYY-MM-DD'，
     天数夹到 1~CYCLE，累计次数为非负整数，待入仓标记只接受布尔值。
     不在此处做「断签重置」：由引擎按当前时间惰性判断，读档不写状态。 */
  out.checkin = { day: 1, lastKey: '', total: 0, pending: false };
  {
    const sc = (saved.checkin && typeof saved.checkin === 'object') ? saved.checkin : null;
    if (sc) {
      if (isFinite(sc.day)) {
        out.checkin.day = Math.max(1, Math.min(CHECKIN.CYCLE, Math.floor(Number(sc.day))));
      }
      if (typeof sc.lastKey === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(sc.lastKey)) {
        out.checkin.lastKey = sc.lastKey;
      }
      if (isFinite(sc.total)) out.checkin.total = Math.max(0, Math.floor(Number(sc.total)));
      out.checkin.pending = sc.pending === true;
    }
  }

  /* 问道指引：只接受 GUIDE_STEPS 中存在的步骤 id 与 flag，异常值静默丢弃。
     旧档（无 guide 字段）不在此处推断：由 loadState 在 state 就绪后调用 guideInfer()，
     推断完成只打勾、不补发奖励，避免一次性资源注入。 */
  out.guide = { done: {}, inferred: {}, flags: {}, skipped: false, closed: false };
  {
    const sg = (saved.guide && typeof saved.guide === 'object') ? saved.guide : null;
    if (sg) {
      GUIDE_STEPS.forEach(function (step) {
        if (sg.done && typeof sg.done === 'object' && sg.done[step.id] === true) out.guide.done[step.id] = true;
        if (sg.inferred && typeof sg.inferred === 'object' && sg.inferred[step.id] === true) out.guide.inferred[step.id] = true;
        if (step.flag && sg.flags && typeof sg.flags === 'object' && sg.flags[step.flag] === true) out.guide.flags[step.flag] = true;
      });
      out.guide.skipped = sg.skipped === true;
      out.guide.closed = sg.closed === true;
    }
  }

  /* UI 偏好 */
  if (saved.ui && typeof saved.ui === 'object') {
    if (SKILL_ORDER.indexOf(saved.ui.active) >= 0 || saved.ui.active === 'tasks' || saved.ui.active === 'shop' || saved.ui.active === 'bag' || saved.ui.active === 'world' || saved.ui.active === 'disciples' || saved.ui.active === 'planet' || saved.ui.active === 'tower' || saved.ui.active === 'settings' || saved.ui.active === 'checkin' || saved.ui.active === 'guide') out.ui.active = saved.ui.active;
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
    session: { gold: 0, star: 0, mat: 0, seed: 0, count: 0 },
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
