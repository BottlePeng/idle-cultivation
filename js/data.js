'use strict';

/* =========================================================================
 * 仙途挂机 · 静态数据层
 * 只放"配置"，不放逻辑。改数值只需改这里。
 * 设计参考：《梅尔沃放置》的动作/精通/命中制战斗 + 《凡人修仙传》的境界/灵根/丹药
 * ========================================================================= */

const CONFIG = {
  TICK_MS: 100,          // 主循环步长
  RENDER_MS: 200,        // UI 刷新间隔
  AUTOSAVE_MS: 5000,     // 自动存档间隔
  OFFLINE_CAP_H: 12,     // 离线收益上限（小时）
  SAVE_KEY: 'xiuxian_idle_save_v1',

  /* --- 玩家基础属性 --- */
  BASE_HP: 60,
  HP_PER_COMBAT: 8,      // 每级战斗 +生命
  HP_PER_REALM: 20,      // 每个大境界 +生命
  BASE_ATK: 5,           // 攻击力（伤害均值）
  ATK_PER_LEVEL: 2,      // 每级战斗 +攻击力
  BASE_DEF: 1,           // 防御力（转为伤害减免）
  DEF_PER_LEVEL: 1.5,
  DR_DIVISOR: 140,       // 减伤 = 防/(防+该值)
  DR_CAP: 0.75,          // 减伤上限
  BASE_HIT: 12,          // 命中
  HIT_PER_LEVEL: 2.2,
  BASE_EV: 8,            // 闪避
  EV_PER_LEVEL: 1.6,

  PLAYER_ATTACK_TIME: 2.4, // 玩家出手间隔（秒）
  RESPAWN_TIME: 1.5,       // 怪物刷新间隔（秒）
  HIT_MIN: 0.20,           // 命中率下限
  HIT_MAX: 0.95,           // 命中率上限
  DMG_SPREAD: 0.18,        // 伤害浮动：min = 均值×(1-s)，max = 均值×(1+s)

  /* --- 常驻被动（不占用动作槽） --- */
  HP_REGEN_INTERVAL: 10,   // 脱战回血间隔（秒）
  HP_REGEN_RATIO: 0.03,    // 每次回复最大生命 3%
  SPIRIT_PER_SEC: 0.2,     // 灵力自然凝聚

  /* --- 修炼带来的全局成长（以"大境界"为单位） --- */
  SPEED_REALM_BONUS: 0.04, // 每个大境界 +4% 动作速度
  XP_REALM_BONUS: 0.06,    // 每个大境界 +6% 全技能经验
  CULT_XP_PER_REALM: 6,    // 每个大境界，打坐修为收益 ×(1+倍数)
  REALM_ATK_BONUS: 0.12,   // 每个大境界 +12% 攻防命闪

  /* --- 精通（每个动作独立成长，上限 99） --- */
  MASTERY_CAP: 99,
  MASTERY_TIME_PER_LVL: 0.002,   // 每级精通 -0.2% 耗时（上限 -20%）
  MASTERY_DOUBLE_PER_LVL: 0.005, // 每级精通 +0.5% 额外产出
  MASTERY_XP_RATIO: 0.6,          // 精通经验 = 动作经验 × 该值
  SKILL_DOUBLE_PER_LVL: 0.002,    // 每个技能等级 +0.2% 额外产出

  /* --- 突破 --- */
  BREAK_FAIL_LOSS: 0.30,   // 突破失败损失的修为比例

  /* --- 灵气疗伤 --- */
  HEAL_SPIRIT_COST: 25,

  /* --- 背包与市集 --- */
  INV_SLOTS: 100,            // 背包容量（不同物品种类数上限）
  SELL_RATIO: 0.55           // 出售价 = 物品价值 × 该比例（梅尔沃式折价回收）
};

/* =========================================================================
 * 物品表
 * type: material 材料 / food 食物 / pill 丹药 / equip 装备
 * pill.use: cult 加修为 / heal 疗伤 / break 突破专用（需在修炼面板使用）
 * ========================================================================= */
const ITEMS = {
  /* 木材 */
  log_qing: { name: '灵木', icon: '🪵', type: 'material', value: 2, desc: '青云山常见灵木，炼器基础材料。' },
  log_han: { name: '寒松木', icon: '🌲', type: 'material', value: 6, desc: '生于寒潭边的松木，灵气充盈。' },
  log_tie: { name: '铁木', icon: '🌳', type: 'material', value: 18, desc: '坚硬如铁的万年古木。' },

  /* 鱼 */
  fish_qing: { name: '青鱼', icon: '🐟', type: 'food', value: 3, heal: 25, desc: '食用后恢复 25 点生命。' },
  fish_ling: { name: '灵鲤', icon: '🐠', type: 'food', value: 9, heal: 80, desc: '食用后恢复 80 点生命。' },
  fish_long: { name: '龙须鱼', icon: '🐡', type: 'food', value: 28, heal: 250, desc: '食用后恢复 250 点生命。' },

  /* 矿 */
  ore_iron: { name: '铁矿石', icon: '🪨', type: 'material', value: 3, desc: '富含凡铁的矿石。' },
  ore_xuan: { name: '玄铁矿', icon: '⛰️', type: 'material', value: 10, desc: '玄铁矿石，炼器上品。' },
  ore_ling: { name: '灵石原矿', icon: '🔮', type: 'material', value: 22, desc: '蕴含灵气的原矿，可提炼灵石。' },

  /* 锭 */
  ingot_iron: { name: '铁锭', icon: '🔩', type: 'material', value: 10, desc: '熔炼后的铁锭。' },
  ingot_xuan: { name: '玄铁锭', icon: '⚙️', type: 'material', value: 32, desc: '熔炼后的玄铁锭。' },

  /* 杂物 */
  hide: { name: '兽皮', icon: '🟫', type: 'material', value: 5, desc: '妖兽皮毛，可制护甲。' },
  herb: { name: '灵草', icon: '🌿', type: 'material', value: 8, desc: '山间灵草，炼丹皆宜。' },

  /* 凡间百业（入世体验产出） */
  rice: { name: '米饭', icon: '🍚', type: 'food', value: 2, heal: 12, desc: '凡人家常饭食，食用后恢复 12 点生命。' },
  wine: { name: '浊酒', icon: '🍶', type: 'food', value: 5, heal: 18, desc: '凡酿浊酒，食用后恢复 18 点生命。' },
  cloth: { name: '麻布', icon: '🧶', type: 'material', value: 7, desc: '凡间织物，市集有人收。' },
  painting: { name: '名家字画', icon: '🖼️', type: 'material', value: 26, desc: '凡间名家手笔，颇受修士喜爱。' },

  /* 药草 */
  herb_juqi: { name: '聚气草', icon: '🍀', type: 'material', value: 10, desc: '服之可聚气归元，炼丹基础。' },
  herb_liao: { name: '疗伤草', icon: '🌾', type: 'material', value: 12, desc: '生肌止血，疗伤丹主料。' },
  herb_zhuji: { name: '筑基花', icon: '🌸', type: 'material', value: 40, desc: '百年一开，筑基丹必需。' },
  herb_ning: { name: '凝元参', icon: '🪷', type: 'material', value: 120, desc: '深山灵参，凝元之要。' },
  herb_ying: { name: '化婴芝', icon: '🍄', type: 'material', value: 320, desc: '灵芝化形，元婴之资。' },

  /* 种子（type: seed，由炼丹采药概率掉落 / 市集购买；种入地块后被动生长） */
  seed_juqi: { name: '聚气草种子', icon: '🌱', type: 'seed', value: 4, desc: '种入地块后可收获聚气草。' },
  seed_liao: { name: '疗伤草种子', icon: '🌱', type: 'seed', value: 5, desc: '种入地块后可收获疗伤草。' },
  seed_zhuji: { name: '筑基花种子', icon: '🌺', type: 'seed', value: 20, desc: '种入地块后可收获筑基花。' },
  seed_ning: { name: '凝元参种子', icon: '🌱', type: 'seed', value: 70, desc: '种入地块后可收获凝元参。' },
  seed_ying: { name: '化婴芝种子', icon: '🌱', type: 'seed', value: 200, desc: '种入地块后可收获化婴芝。' },
  seed_ling: { name: '灵草种子', icon: '🌱', type: 'seed', value: 3, desc: '种入地块后可收获灵草。' },

  /* 丹 */
  pill_juqi: { name: '聚气丹', icon: '🔴', type: 'pill', use: 'cult', value: 45, desc: '服用后精纯修为大量增加。' },
  pill_liao: { name: '疗伤丹', icon: '🟢', type: 'pill', use: 'heal', value: 60, desc: '服用后恢复 65% 生命。' },
  pill_zhuji: { name: '筑基丹', icon: '🟡', type: 'pill', use: 'break', value: 300, desc: '冲击筑基期所必需，突破时消耗。' },
  pill_ning: { name: '凝元丹', icon: '🟣', type: 'pill', use: 'break', value: 800, desc: '冲击结丹期所必需，突破时消耗。' },
  pill_ying: { name: '化婴丹', icon: '🔵', type: 'pill', use: 'break', value: 2200, desc: '冲击元婴期所必需，突破时消耗。' },
  pill_shen: { name: '化神丹', icon: '⚪', type: 'pill', use: 'break', value: 6000, desc: '冲击化神期所必需，突破时消耗。' },
  pill_xu: { name: '炼虚丹', icon: '🌑', type: 'pill', use: 'break', value: 16000, desc: '冲击炼虚期所必需，突破时消耗。' },
  pill_wudao: { name: '悟道丹', icon: '🟠', type: 'pill', use: 'wudao', value: 800, desc: '服用后悟性 +1：修炼速度 +1%，突破成功率 +1%。' },

  /* 装备（法宝 / 灵甲 / 法冠 / 灵靴 / 玉佩 / 灵戒） */
  w_tie: { name: '铁剑', icon: '🗡️', type: 'equip', slot: 'weapon', atk: 6, value: 40, desc: '凡铁打造。攻击 +6。' },
  w_xuan: { name: '玄铁剑', icon: '⚔️', type: 'equip', slot: 'weapon', atk: 16, hit: 8, value: 150, desc: '玄铁打造。攻击 +16，命中 +8。' },
  w_fly: { name: '御风剑', icon: '🌀', type: 'equip', slot: 'weapon', atk: 30, hit: 15, ev: 8, value: 520, desc: '剑成御风。攻击 +30，命中 +15，闪避 +8。' },
  a_tie: { name: '铁甲', icon: '🛡️', type: 'equip', slot: 'armor', def: 6, hp: 20, value: 45, desc: '防御 +6，生命 +20。' },
  a_xuan: { name: '玄铁甲', icon: '🥋', type: 'equip', slot: 'armor', def: 14, hp: 60, value: 170, desc: '防御 +14，生命 +60。' },
  h_tie: { name: '铁冠', icon: '⛑️', type: 'equip', slot: 'helmet', def: 3, hit: 4, value: 35, desc: '防御 +3，命中 +4。' },
  h_xuan: { name: '玄铁冠', icon: '👑', type: 'equip', slot: 'helmet', def: 7, hit: 8, hp: 15, value: 150, desc: '防御 +7，命中 +8，生命 +15。' },
  b_tie: { name: '布靴', icon: '🥾', type: 'equip', slot: 'boots', ev: 6, value: 30, desc: '闪避 +6。' },
  b_fly: { name: '疾风靴', icon: '👢', type: 'equip', slot: 'boots', ev: 14, hit: 4, value: 190, desc: '闪避 +14，命中 +4。' },
  t_ling: { name: '灵玉佩', icon: '🧿', type: 'equip', slot: 'amulet', def: 5, hp: 40, value: 220, desc: '防御 +5，生命 +40。' },
  t_ju: { name: '聚灵佩', icon: '📿', type: 'equip', slot: 'amulet', def: 8, hit: 6, hp: 60, value: 460, desc: '防御 +8，命中 +6，生命 +60。' },
  r_tie: { name: '铁戒', icon: '💍', type: 'equip', slot: 'ring', atk: 3, value: 40, desc: '攻击 +3。' },
  r_xuan: { name: '玄铁戒', icon: '💎', type: 'equip', slot: 'ring', atk: 7, ev: 5, value: 180, desc: '攻击 +7，闪避 +5。' }
};

const EQUIP_SLOTS = [
  { id: 'weapon', name: '法宝' },
  { id: 'armor', name: '灵甲' },
  { id: 'helmet', name: '法冠' },
  { id: 'boots', name: '灵靴' },
  { id: 'amulet', name: '玉佩' },
  { id: 'ring', name: '灵戒' }
];

/* =========================================================================
 * 技能表  xpBase/xpPow 决定升级曲线：need = base * lvl^pow
 * ========================================================================= */
const SKILLS = {
  woodcutting: { name: '伐木', icon: '🪓', xpBase: 25, xpPow: 1.55, desc: '砍伐灵木，为炼器提供木材。' },
  fishing: { name: '钓鱼', icon: '🎣', xpBase: 25, xpPow: 1.55, desc: '垂钓灵鱼，可食用回复生命。' },
  mining: { name: '采矿', icon: '⛏️', xpBase: 28, xpPow: 1.55, desc: '开采矿石与灵石原矿。' },
  crafting: { name: '炼器', icon: '🔨', xpBase: 30, xpPow: 1.55, desc: '熔炼矿石、锻造法宝护具。' },
  alchemy: { name: '炼丹', icon: '⚗️', xpBase: 30, xpPow: 1.55, desc: '采撷灵草，炼制各类丹药。' },
  combat: { name: '战斗', icon: '⚔️', xpBase: 38, xpPow: 1.60, desc: '讨伐妖兽，获取灵石与材料。' },
  cultivation: { name: '修炼', icon: '🧘', xpBase: 70, xpPow: 1.70, desc: '打坐吐纳，积累修为，冲击境界。' },
  formation: { name: '阵法', icon: '🧭', xpBase: 18, xpPow: 1.35, desc: '观星推演天机，布设阵法为诸般修行加持。' },
  farming: { name: '灵植', icon: '🌿', xpBase: 22, xpPow: 1.40, desc: '种下灵草种子，悉心浇灌，收获炼丹上品。' },
  thieving: { name: '入世', icon: '🎭', xpBase: 26, xpPow: 1.45, desc: '混迹红尘百业，体验凡人生计——或有所得，或被识破驱离。' }
};

const SKILL_ORDER = ['woodcutting', 'fishing', 'mining', 'crafting', 'alchemy', 'combat', 'cultivation', 'formation', 'farming', 'thieving'];

/* =========================================================================
 * 采集 / 修炼动作（无消耗）
 * out: { id } 产出物品；{ spirit } 灵力；{ gold } 灵石；{ heal } 回复；{ cultXp } 修为
 * ========================================================================= */
const ACTIONS = {
  woodcutting: [
    { id: 'wc_qing', name: '灵木林', icon: '🪵', req: 1, time: 1.5, xp: 5, out: { id: 'log_qing', qty: 1 } },
    { id: 'wc_han', name: '寒松林', icon: '🌲', req: 5, time: 2.6, xp: 14, out: { id: 'log_han', qty: 1 } },
    { id: 'wc_tie', name: '铁木古树', icon: '🌳', req: 15, time: 4.2, xp: 34, out: { id: 'log_tie', qty: 1 } }
  ],
  fishing: [
    { id: 'fi_qing', name: '青鱼群', icon: '🐟', req: 1, time: 1.8, xp: 6, out: { id: 'fish_qing', qty: 1 } },
    { id: 'fi_ling', name: '灵鲤潭', icon: '🐠', req: 7, time: 3.0, xp: 16, out: { id: 'fish_ling', qty: 1 } },
    { id: 'fi_long', name: '龙须深渊', icon: '🐡', req: 18, time: 5.0, xp: 42, out: { id: 'fish_long', qty: 1 } }
  ],
  mining: [
    { id: 'mn_iron', name: '铁矿脉', icon: '🪨', req: 1, time: 2.0, xp: 6, out: { id: 'ore_iron', qty: 1 } },
    { id: 'mn_xuan', name: '玄铁矿脉', icon: '⛰️', req: 6, time: 3.2, xp: 16, out: { id: 'ore_xuan', qty: 1 } },
    { id: 'mn_ling', name: '灵石矿脉', icon: '🔮', req: 14, time: 4.4, xp: 38, out: { id: 'ore_ling', qty: 1 } }
  ],
  alchemy: [
    { id: 'al_ling', name: '采药 · 灵草', icon: '🌿', req: 1, time: 1.8, xp: 6, out: { id: 'herb', qty: 1 } },
    { id: 'al_juqi', name: '采药 · 聚气草', icon: '🍀', req: 1, time: 2.0, xp: 7, out: { id: 'herb_juqi', qty: 1 } },
    { id: 'al_liao', name: '采药 · 疗伤草', icon: '🌾', req: 3, time: 2.4, xp: 10, out: { id: 'herb_liao', qty: 1 } },
    { id: 'al_zhuji', name: '采药 · 筑基花', icon: '🌸', req: 12, time: 4.0, xp: 28, out: { id: 'herb_zhuji', qty: 1 } },
    { id: 'al_ning', name: '采药 · 凝元参', icon: '🪷', req: 22, time: 5.2, xp: 60, out: { id: 'herb_ning', qty: 1 } },
    { id: 'al_ying', name: '采药 · 化婴芝', icon: '🍄', req: 32, time: 6.4, xp: 110, out: { id: 'herb_ying', qty: 1 } }
  ],
  cultivation: [
    { id: 'meditate', name: '打坐吐纳', icon: '🧘', req: 1, time: 2.5, xp: 12, out: { spirit: 4, heal: 8 } }
  ],
  /* 观星台：参考梅尔沃观星的"观星取星尘"动作，产出星砂（无背包占用） */
  formation: [
    { id: 'ob_qiyao', name: '观星 · 七曜', icon: '🌟', req: 1, time: 3.0, xp: 10, out: { stardust: 3 } },
    { id: 'ob_ziwei', name: '观星 · 紫微', icon: '🔭', req: 8, time: 4.5, xp: 28, out: { stardust: 10 } },
    { id: 'ob_huntian', name: '观星 · 浑天', icon: '🌠', req: 16, time: 6.0, xp: 68, out: { stardust: 30 } },
    { id: 'ob_zhoutian', name: '观星 · 周天', icon: '🌌', req: 24, time: 7.5, xp: 160, out: { stardust: 88 } }
  ],
  /* 入世：参考梅尔沃盗窃（Thieving）——概率判定成败的职业体验。
     rate 基础成功率 / gold 灵石区间 / loot 掉落表 / fine 被罚灵石 / dmg 受伤 / stun 眩晕秒数 */
  thieving: [
    { id: 'job_farmer', name: '农户帮工', icon: '👨‍🌾', req: 1, time: 3.0, xp: 10, rate: 0.78, gold: [3, 8], fine: 5, dmg: 2, stun: 3, loot: [{ id: 'rice', chance: 0.55, qty: 1 }] },
    { id: 'job_fisher', name: '渔行伙计', icon: '🛶', req: 4, time: 3.0, xp: 14, rate: 0.76, gold: [5, 12], fine: 8, dmg: 3, stun: 3, loot: [{ id: 'fish_qing', chance: 0.45, qty: 1 }, { id: 'fish_ling', chance: 0.12, qty: 1 }] },
    { id: 'job_smith', name: '铁铺学徒', icon: '⚒️', req: 8, time: 3.2, xp: 20, rate: 0.74, gold: [8, 17], fine: 12, dmg: 4, stun: 3, loot: [{ id: 'ore_iron', chance: 0.40, qty: 1 }, { id: 'ingot_iron', chance: 0.15, qty: 1 }] },
    { id: 'job_tavern', name: '酒楼跑堂', icon: '🍶', req: 12, time: 3.2, xp: 28, rate: 0.72, gold: [12, 25], fine: 18, dmg: 5, stun: 3, loot: [{ id: 'wine', chance: 0.45, qty: 1 }, { id: 'herb', chance: 0.12, qty: 1 }] },
    { id: 'job_apoth', name: '药铺学徒', icon: '💊', req: 16, time: 3.4, xp: 40, rate: 0.70, gold: [18, 36], fine: 24, dmg: 6, stun: 3.5, loot: [{ id: 'herb_juqi', chance: 0.35, qty: 1 }, { id: 'herb_liao', chance: 0.18, qty: 1 }, { id: 'seed_juqi', chance: 0.08, qty: 1 }] },
    { id: 'job_weaver', name: '织坊帮工', icon: '🧵', req: 21, time: 3.4, xp: 56, rate: 0.68, gold: [26, 50], fine: 32, dmg: 7, stun: 3.5, loot: [{ id: 'cloth', chance: 0.45, qty: 1 }, { id: 'hide', chance: 0.15, qty: 1 }] },
    { id: 'job_guard', name: '行商护卫', icon: '🐫', req: 26, time: 3.6, xp: 78, rate: 0.66, gold: [42, 88], fine: 45, dmg: 8, stun: 4, loot: [{ id: 'cloth', chance: 0.25, qty: 1 }, { id: 'painting', chance: 0.08, qty: 1 }] },
    { id: 'job_scribe', name: '书院抄手', icon: '📖', req: 31, time: 3.6, xp: 105, rate: 0.64, gold: [58, 120], fine: 60, dmg: 9, stun: 4, loot: [{ id: 'painting', chance: 0.35, qty: 1 }, { id: 'pill_juqi', chance: 0.07, qty: 1 }] },
    { id: 'job_steward', name: '钱庄管事', icon: '💰', req: 36, time: 3.8, xp: 140, rate: 0.62, gold: [85, 175], fine: 80, dmg: 10, stun: 4, loot: [{ id: 'cloth', chance: 0.22, qty: 1 }, { id: 'painting', chance: 0.18, qty: 1 }, { id: 'pill_liao', chance: 0.08, qty: 1 }] }
  ]
};

/* =========================================================================
 * 配方（有消耗）  cat: smelt 熔炼 / forge 锻造 / pill 丹方
 * ========================================================================= */
const RECIPES = {
  crafting: [
    { id: 'sm_iron', cat: 'smelt', name: '熔炼 · 铁锭', icon: '🔩', req: 1, time: 2.0, xp: 7, in: [{ id: 'ore_iron', qty: 3 }], out: { id: 'ingot_iron', qty: 1 } },
    { id: 'sm_xuan', cat: 'smelt', name: '熔炼 · 玄铁锭', icon: '⚙️', req: 6, time: 3.6, xp: 20, in: [{ id: 'ore_xuan', qty: 3 }], out: { id: 'ingot_xuan', qty: 1 } },
    { id: 'sm_stone', cat: 'smelt', name: '提炼 · 灵石', icon: '💠', req: 14, time: 2.2, xp: 15, in: [{ id: 'ore_ling', qty: 3 }], out: { gold: 50 } },
    { id: 'sm_spirit', cat: 'smelt', name: '聚灵 · 化灵力', icon: '✨', req: 1, time: 1.5, xp: 5, in: [{ id: 'ore_ling', qty: 1 }], out: { spirit: 60 } },

    { id: 'fg_sword', cat: 'forge', name: '锻造 · 铁剑', icon: '🗡️', req: 2, time: 3.0, xp: 14, in: [{ id: 'ingot_iron', qty: 3 }, { id: 'log_qing', qty: 2 }], out: { id: 'w_tie', qty: 1 } },
    { id: 'fg_armor', cat: 'forge', name: '锻造 · 铁甲', icon: '🛡️', req: 3, time: 3.5, xp: 18, in: [{ id: 'ingot_iron', qty: 4 }, { id: 'hide', qty: 2 }], out: { id: 'a_tie', qty: 1 } },
    { id: 'fg_htie', cat: 'forge', name: '锻造 · 铁冠', icon: '⛑️', req: 4, time: 3.2, xp: 16, in: [{ id: 'ingot_iron', qty: 3 }, { id: 'hide', qty: 1 }], out: { id: 'h_tie', qty: 1 } },
    { id: 'fg_btie', cat: 'forge', name: '锻造 · 布靴', icon: '🥾', req: 3, time: 2.6, xp: 13, in: [{ id: 'hide', qty: 3 }, { id: 'log_qing', qty: 2 }], out: { id: 'b_tie', qty: 1 } },
    { id: 'fg_rtie', cat: 'forge', name: '锻造 · 铁戒', icon: '💍', req: 5, time: 3.0, xp: 15, in: [{ id: 'ingot_iron', qty: 2 }, { id: 'ore_ling', qty: 1 }], out: { id: 'r_tie', qty: 1 } },

    { id: 'fg_xsword', cat: 'forge', name: '锻造 · 玄铁剑', icon: '⚔️', req: 9, time: 5.5, xp: 48, in: [{ id: 'ingot_xuan', qty: 4 }, { id: 'log_han', qty: 3 }], out: { id: 'w_xuan', qty: 1 } },
    { id: 'fg_xarmor', cat: 'forge', name: '锻造 · 玄铁甲', icon: '🥋', req: 11, time: 6.0, xp: 60, in: [{ id: 'ingot_xuan', qty: 5 }, { id: 'hide', qty: 5 }], out: { id: 'a_xuan', qty: 1 } },
    { id: 'fg_xhtie', cat: 'forge', name: '锻造 · 玄铁冠', icon: '👑', req: 12, time: 5.2, xp: 52, in: [{ id: 'ingot_xuan', qty: 4 }, { id: 'hide', qty: 3 }], out: { id: 'h_xuan', qty: 1 } },
    { id: 'fg_bfly', cat: 'forge', name: '锻造 · 疾风靴', icon: '👢', req: 13, time: 5.0, xp: 50, in: [{ id: 'hide', qty: 6 }, { id: 'log_han', qty: 4 }, { id: 'ore_ling', qty: 3 }], out: { id: 'b_fly', qty: 1 } },
    { id: 'fg_rxuan', cat: 'forge', name: '锻造 · 玄铁戒', icon: '💎', req: 12, time: 4.6, xp: 44, in: [{ id: 'ingot_xuan', qty: 3 }, { id: 'ore_ling', qty: 4 }], out: { id: 'r_xuan', qty: 1 } },
    { id: 'fg_jade', cat: 'forge', name: '锻造 · 灵玉佩', icon: '🧿', req: 14, time: 7.0, xp: 85, in: [{ id: 'ingot_xuan', qty: 3 }, { id: 'ore_ling', qty: 4 }, { id: 'herb', qty: 5 }], out: { id: 't_ling', qty: 1 } },
    { id: 'fg_jupei', cat: 'forge', name: '锻造 · 聚灵佩', icon: '📿', req: 18, time: 8.0, xp: 110, in: [{ id: 'ingot_xuan', qty: 5 }, { id: 'ore_ling', qty: 8 }, { id: 'herb', qty: 5 }], out: { id: 't_ju', qty: 1 } },
    { id: 'fg_fly', cat: 'forge', name: '锻造 · 御风剑', icon: '🌀', req: 20, time: 9.0, xp: 140, in: [{ id: 'ingot_xuan', qty: 6 }, { id: 'log_tie', qty: 4 }, { id: 'ore_ling', qty: 6 }], out: { id: 'w_fly', qty: 1 } }
  ],
  alchemy: [
    { id: 'pl_juqi', cat: 'pill', name: '炼制 · 聚气丹', icon: '🔴', req: 1, time: 3.0, xp: 12, in: [{ id: 'herb_juqi', qty: 2 }, { id: 'herb', qty: 1 }], out: { id: 'pill_juqi', qty: 1 } },
    { id: 'pl_liao', cat: 'pill', name: '炼制 · 疗伤丹', icon: '🟢', req: 1, time: 3.0, xp: 12, in: [{ id: 'herb_liao', qty: 2 }, { id: 'herb', qty: 1 }], out: { id: 'pill_liao', qty: 1 } },
    { id: 'pl_zhuji', cat: 'pill', name: '炼制 · 筑基丹', icon: '🟡', req: 12, time: 6.0, xp: 55, in: [{ id: 'herb_zhuji', qty: 3 }, { id: 'herb', qty: 2 }, { id: 'ore_ling', qty: 2 }], out: { id: 'pill_zhuji', qty: 1 } },
    { id: 'pl_ning', cat: 'pill', name: '炼制 · 凝元丹', icon: '🟣', req: 22, time: 8.0, xp: 130, in: [{ id: 'herb_ning', qty: 3 }, { id: 'herb_zhuji', qty: 2 }, { id: 'ore_ling', qty: 3 }], out: { id: 'pill_ning', qty: 1 } },
    { id: 'pl_ying', cat: 'pill', name: '炼制 · 化婴丹', icon: '🔵', req: 32, time: 10.0, xp: 260, in: [{ id: 'herb_ying', qty: 3 }, { id: 'herb_ning', qty: 2 }, { id: 'ore_ling', qty: 5 }], out: { id: 'pill_ying', qty: 1 } },
    { id: 'pl_shen', cat: 'pill', name: '炼制 · 化神丹', icon: '⚪', req: 42, time: 12.0, xp: 480, in: [{ id: 'herb_ying', qty: 4 }, { id: 'herb_ning', qty: 3 }, { id: 'ingot_xuan', qty: 2 }, { id: 'ore_ling', qty: 8 }], out: { id: 'pill_shen', qty: 1 } },
    { id: 'pl_xu', cat: 'pill', name: '炼制 · 炼虚丹', icon: '🌑', req: 52, time: 14.0, xp: 800, in: [{ id: 'herb_ying', qty: 5 }, { id: 'herb_ning', qty: 4 }, { id: 'ingot_xuan', qty: 4 }, { id: 'ore_ling', qty: 12 }], out: { id: 'pill_xu', qty: 1 } },
    { id: 'pl_wudao', cat: 'pill', name: '炼制 · 悟道丹', icon: '🟠', req: 22, time: 10.0, xp: 160, in: [{ id: 'herb_zhuji', qty: 3 }, { id: 'herb_ning', qty: 1 }, { id: 'ore_ling', qty: 5 }], out: { id: 'pill_wudao', qty: 1 } }
  ]
};

/* =========================================================================
 * 妖兽表（命中制：hit 命中 / ev 闪避 / atkMin~atkMax 伤害区间 / dr 伤害减免 / interval 出手间隔）
 * ========================================================================= */
const MONSTERS = [
  { id: 'bandit', name: '山贼', icon: '🥷', lvl: 1, hp: 34, hit: 14, ev: 8, atkMin: 5, atkMax: 9, dr: 0.02, interval: 2.6, xp: 14, gold: [5, 11], respawn: 1.5, drops: [{ id: 'hide', chance: 0.45, qty: 1 }] },
  { id: 'wolf', name: '灵狼', icon: '🐺', lvl: 5, hp: 80, hit: 26, ev: 14, atkMin: 9, atkMax: 15, dr: 0.05, interval: 2.4, xp: 34, gold: [14, 26], respawn: 2.0, drops: [{ id: 'hide', chance: 0.6, qty: 1 }, { id: 'herb', chance: 0.25, qty: 1 }] },
  { id: 'golem', name: '铁甲妖兽', icon: '🦾', lvl: 12, hp: 210, hit: 45, ev: 10, atkMin: 16, atkMax: 24, dr: 0.25, interval: 3.0, xp: 82, gold: [40, 70], respawn: 3.0, drops: [{ id: 'ore_xuan', chance: 0.5, qty: 1 }, { id: 'ore_iron', chance: 0.7, qty: 2 }, { id: 'pill_wudao', chance: 0.03, qty: 1 }] },
  { id: 'zombie', name: '古墓僵尸', icon: '🧟', lvl: 22, hp: 480, hit: 80, ev: 22, atkMin: 28, atkMax: 40, dr: 0.15, interval: 3.2, xp: 180, gold: [110, 180], respawn: 4.0, drops: [{ id: 'ore_ling', chance: 0.35, qty: 1 }, { id: 'herb', chance: 0.5, qty: 2 }, { id: 'pill_wudao', chance: 0.05, qty: 1 }] },
  { id: 'demon', name: '魔道修士', icon: '👹', lvl: 35, hp: 1100, hit: 150, ev: 45, atkMin: 55, atkMax: 80, dr: 0.2, interval: 2.6, xp: 420, gold: [300, 480], respawn: 5.0, drops: [{ id: 'ore_ling', chance: 0.8, qty: 2 }, { id: 'ingot_xuan', chance: 0.5, qty: 2 }, { id: 'herb_zhuji', chance: 0.15, qty: 1 }, { id: 'pill_wudao', chance: 0.08, qty: 1 }] },
  { id: 'demonking', name: '万妖王', icon: '👺', lvl: 50, hp: 3600, hit: 320, ev: 90, atkMin: 110, atkMax: 160, dr: 0.3, interval: 2.4, xp: 1400, gold: [900, 1500], respawn: 8.0, drops: [{ id: 'herb_ning', chance: 0.3, qty: 1 }, { id: 'herb_ying', chance: 0.15, qty: 1 }, { id: 'ingot_xuan', chance: 0.8, qty: 3 }, { id: 'pill_wudao', chance: 0.15, qty: 1 }] }
];

/* =========================================================================
 * 灵根五行：属性值 = 对应生计的技能等级（成长映射，无独立数值）
 *   金→炼器  木→伐木  水→钓鱼  火→炼丹  土→阵法
 * 悟性：默认 0，服用悟道丹 +1（战斗掉落 / 炼丹炼制）；
 *       每点悟性：修炼速度 +1%、突破成功率 +1%
 * ========================================================================= */
const WUXING = [
  { id: 'metal', name: '金', icon: '⚔️', color: '#d9c47a', skill: 'crafting', desc: '金主锋锐，道在炼器。' },
  { id: 'wood', name: '木', icon: '🌿', color: '#7dd8b8', skill: 'woodcutting', desc: '木主生发，道在伐木。' },
  { id: 'water', name: '水', icon: '�', color: '#63a9e0', skill: 'fishing', desc: '水主流转，道在钓鱼。' },
  { id: 'fire', name: '火', icon: '�', color: '#e08a6a', skill: 'alchemy', desc: '火主炼化，道在炼丹。' },
  { id: 'earth', name: '土', icon: '⛰️', color: '#b58a5f', skill: 'formation', desc: '土主承载，道在阵法。' }
];

/* =========================================================================
 * 境界：大境界 → 小境界（层/期）  needBase/needMul 决定修为需求曲线
 * rate 同境突破成功率；rateToNext 跨大境界成功率；pill 跨境所需丹药
 * ========================================================================= */
const REALM_DEFS = [
  { name: '炼气期', icon: '🌱', color: '#7dd8b8', desc: '引气入体，褪去凡胎。',
    stages: ['一层', '二层', '三层', '四层', '五层', '六层', '七层', '八层', '九层', '十层', '十一层', '十二层', '十三层'],
    needBase: 100, needMul: 1.32, rate: 0.95, rateToNext: 0.55, pill: 'pill_zhuji', gold: 0 },
  { name: '筑基期', icon: '🏔️', color: '#63a9e0', desc: '筑就道基，可御法器。',
    stages: ['初期', '中期', '后期', '大圆满'],
    needBase: 6000, needMul: 1.5, rate: 0.72, rateToNext: 0.40, pill: 'pill_ning', gold: 150 },
  { name: '结丹期', icon: '🔆', color: '#d8b26a', desc: '凝结金丹，寿元大增。',
    stages: ['初期', '中期', '后期', '大圆满'],
    needBase: 40000, needMul: 1.55, rate: 0.60, rateToNext: 0.30, pill: 'pill_ying', gold: 400 },
  { name: '元婴期', icon: '👶', color: '#a98be0', desc: '元婴出窍，神通初显。',
    stages: ['初期', '中期', '后期', '大圆满'],
    needBase: 250000, needMul: 1.6, rate: 0.50, rateToNext: 0.22, pill: 'pill_shen', gold: 1200 },
  { name: '化神期', icon: '✨', color: '#e0a3c8', desc: '神识化虚，可称大能。',
    stages: ['初期', '中期', '后期', '大圆满'],
    needBase: 1200000, needMul: 1.65, rate: 0.40, rateToNext: 0.15, pill: 'pill_xu', gold: 3000 },
  { name: '炼虚期', icon: '🌌', color: '#8ad4ff', max: true, desc: '炼化虚空，追索长生。',
    stages: ['初期', '中期', '后期', '大圆满'],
    needBase: 8000000, needMul: 1.5, rate: 0.32, rateToNext: 0, pill: null, gold: 8000 }
];

/* 展开成完整境界阶段表（共 33 阶） */
function buildStages() {
  const out = [];
  REALM_DEFS.forEach(function (r, ri) {
    r.stages.forEach(function (sn, si) {
      const lastInRealm = (si === r.stages.length - 1);
      const isFinal = !!r.max && lastInRealm;
      const need = si === 0 ? r.needBase : Math.floor(r.needBase * Math.pow(r.needMul, si));
      out.push({
        lvl: out.length + 1,
        realmIndex: ri,
        realm: r.name,
        realmIcon: r.icon,
        color: r.color,
        realmDesc: r.desc,
        stageName: sn,
        stageIndexInRealm: si,
        layerCount: r.stages.length,
        full: r.name + ' ' + sn,
        isMax: isFinal,
        breakInfo: isFinal ? null : {
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
const STAGES = buildStages();

/* =========================================================================
 * 任务 / 成就
 * cond: gathered / kills / crafts / pills / breaks / level / realm / item
 * ========================================================================= */
const TASKS = [
  { id: 't_first', name: '初入仙途', desc: '累计采集 10 次资源', cond: { type: 'gathered', n: 10 }, reward: { gold: 30 } },
  { id: 't_wc', name: '樵夫之始', desc: '伐木等级达到 Lv.5', cond: { type: 'level', skill: 'woodcutting', lvl: 5 }, reward: { gold: 50, items: [{ id: 'w_tie', qty: 1 }] } },
  { id: 't_forge', name: '初试炼器', desc: '炼器成功 10 次', cond: { type: 'crafts', n: 10 }, reward: { gold: 80, items: [{ id: 'a_tie', qty: 1 }] } },
  { id: 't_hunt', name: '除魔卫道', desc: '击败 10 只妖兽', cond: { type: 'kills', n: 10 }, reward: { gold: 120, items: [{ id: 'pill_liao', qty: 3 }] } },
  { id: 't_mine', name: '矿脉之心', desc: '采矿等级达到 Lv.10', cond: { type: 'level', skill: 'mining', lvl: 10 }, reward: { gold: 150, items: [{ id: 'h_tie', qty: 1 }] } },
  { id: 't_pill', name: '丹道入门', desc: '炼出 5 枚丹药', cond: { type: 'pills', n: 5 }, reward: { gold: 200, spirit: 100 } },
  { id: 't_zhuji', name: '筑基之资', desc: '修为境界达到 筑基期', cond: { type: 'realm', stage: 14 }, reward: { gold: 500, spirit: 300, items: [{ id: 'pill_zhuji', qty: 2 }] } },
  { id: 't_kill50', name: '百战之身', desc: '击败 50 只妖兽', cond: { type: 'kills', n: 50 }, reward: { gold: 600, items: [{ id: 'w_xuan', qty: 1 }] } },
  { id: 't_jindan', name: '金丹大道', desc: '修为境界达到 结丹期', cond: { type: 'realm', stage: 18 }, reward: { gold: 2000, spirit: 800, items: [{ id: 'pill_ning', qty: 2 }] } },
  { id: 't_yuanying', name: '元婴惊世', desc: '修为境界达到 元婴期', cond: { type: 'realm', stage: 22 }, reward: { gold: 8000, spirit: 2000, items: [{ id: 'pill_ying', qty: 2 }] } }
];

/* =========================================================================
 * 市集（参考梅尔沃放置的多商店机制）
 * 每个商铺是一个分类，列出可购买的物品。
 * price 字段：若未指定，则 = ITEMS[id].value * 1.8（加价购入）
 * ========================================================================= */
const SHOPS = [
  {
    id: 'general', name: '杂货铺', icon: '🏪',
    items: [
      { id: 'fish_qing' },
      { id: 'fish_ling' },
      { id: 'herb' },
      { id: 'herb_juqi' },
      { id: 'herb_liao' },
      { id: 'log_qing' },
      { id: 'ore_iron' }
    ]
  },
  {
    id: 'material', name: '材料行', icon: '⛏️',
    items: [
      { id: 'ore_iron' },
      { id: 'ore_xuan' },
      { id: 'ore_ling' },
      { id: 'ingot_iron' },
      { id: 'ingot_xuan' },
      { id: 'log_han' },
      { id: 'log_tie' },
      { id: 'hide' },
      { id: 'herb_zhuji' }
    ]
  },
  {
    id: 'pill', name: '丹药阁', icon: '⚗️',
    items: [
      { id: 'pill_juqi' },
      { id: 'pill_liao' },
      { id: 'pill_zhuji' },
      { id: 'pill_ning' },
      { id: 'herb_ning' },
      { id: 'herb_ying' }
    ]
  },
  {
    id: 'equip', name: '装备坊', icon: '⚔️',
    items: [
      { id: 'w_tie' },
      { id: 'a_tie' },
      { id: 'h_tie' },
      { id: 'b_tie' },
      { id: 'r_tie' },
      { id: 'w_xuan' },
      { id: 'a_xuan' },
      { id: 'b_fly' },
      { id: 't_ling' }
    ]
  }
];

/* 市集售价：未指定 price 时按物品价值加价 1.8 倍 */
function shopPrice(item) {
  if (item.price) return Math.floor(item.price);
  const it = ITEMS[item.id];
  return Math.max(1, Math.floor((it ? it.value : 1) * 1.8));
}

function findShop(id) {
  for (let i = 0; i < SHOPS.length; i++) if (SHOPS[i].id === id) return SHOPS[i];
  return SHOPS[0];
}

/* =========================================================================
 * 阵法（玩法参考《梅尔沃放置》的观星 / 星座系统）
 * 观星台推演天机获得「星砂」，再以星砂点亮阵纹，换取常驻全局加成。
 * mods[].key 为加成通道：引擎的 formBonus(key) 汇总所有阵法的同类加成。
 * per 为每级加成（小数），max 为阵纹等级上限。
 * 升级消耗：formCost = cost × growth^当前等级 ×（1 + 阵纹序号 × 0.35）
 * ========================================================================= */
const FORMATIONS = [
  {
    id: 'f_ling', name: '聚灵阵', icon: '☯', color: '#7dd8b8', req: 1, cost: 8, growth: 1.40,
    desc: '引天地灵气入体，最基础的修行阵法。',
    mods: [
      { key: 'xp_cult', name: '修炼速度', per: 0.03, max: 10 },
      { key: 'spirit', name: '灵力凝聚', per: 0.06, max: 10 },
      { key: 'xp_gather', name: '采集经验', per: 0.02, max: 10 }
    ]
  },
  {
    id: 'f_feng', name: '疾风阵', icon: '🌪️', color: '#8ad4ff', req: 6, cost: 24, growth: 1.42,
    desc: '罡风流转，加快动作节奏、增益精通。',
    mods: [
      { key: 'speed', name: '动作速度', per: 0.015, max: 10 },
      { key: 'double', name: '额外产出', per: 0.012, max: 10 },
      { key: 'mastery', name: '精通经验', per: 0.04, max: 10 },
      { key: 'growth', name: '灵植生长', per: 0.04, max: 10 }
    ]
  },
  {
    id: 'f_bao', name: '聚宝阵', icon: '💰', color: '#f2dda6', req: 12, cost: 60, growth: 1.44,
    desc: '聚财纳珍，广开财路与机缘。',
    mods: [
      { key: 'gold', name: '灵石获取', per: 0.05, max: 10 },
      { key: 'drop', name: '掉落概率', per: 0.03, max: 10 },
      { key: 'sell', name: '出售价', per: 0.02, max: 10 }
    ]
  },
  {
    id: 'f_jin', name: '金刚阵', icon: '🛡️', color: '#c9a24d', req: 18, cost: 160, growth: 1.46,
    desc: '金刚护体，血肉坚如金石。',
    mods: [
      { key: 'hp', name: '生命上限', per: 0.04, max: 10 },
      { key: 'def', name: '防御', per: 0.05, max: 10 },
      { key: 'regen', name: '脱战回血', per: 0.05, max: 10 }
    ]
  },
  {
    id: 'f_xuan', name: '玄机阵', icon: '🔯', color: '#a98be0', req: 24, cost: 400, growth: 1.48,
    desc: '洞悉玄机，出手如电、趋避由心。',
    mods: [
      { key: 'atk', name: '攻击', per: 0.04, max: 10 },
      { key: 'hit', name: '命中', per: 0.03, max: 10 },
      { key: 'ev', name: '闪避', per: 0.03, max: 10 }
    ]
  },
  {
    id: 'f_tai', name: '太虚阵', icon: '🌌', color: '#63a9e0', req: 30, cost: 1200, growth: 1.50,
    desc: '炼虚合道之阵，唯阵法宗师方能完整布下。',
    mods: [
      { key: 'xp_combat', name: '战斗经验', per: 0.04, max: 10 },
      { key: 'xp_craft', name: '炼器经验', per: 0.04, max: 10 },
      { key: 'xp_cult', name: '修炼速度', per: 0.05, max: 10 }
    ]
  }
];

/* 阵纹升级消耗：随等级与阵纹序号递增 */
function formCost(f, modIndex, lvl) {
  return Math.floor(f.cost * Math.pow(f.growth, lvl) * (1 + modIndex * 0.35));
}

function findFormation(id) {
  for (let i = 0; i < FORMATIONS.length; i++) if (FORMATIONS[i].id === id) return FORMATIONS[i];
  return null;
}

/* =========================================================================
 * 灵植（玩法参考《梅尔沃放置》的种植 / 园艺系统）
 * 地块被动生长（passiveTick 推进，离线同样有效）；种植与收获为短暂动作，
 * 占用单一动作槽并给灵植经验与精通。
 * PLOT_REQS: 前 3 块 Lv.1 即可解锁，之后每升一段解锁一块，共 8 块上限。
 * FARM_SEEDS: 每枚种子配置生长周期、产出量、最低灵植等级。
 * dropBy: 该种子可由哪个炼丹采药动作低概率掉落（outId 同目标种子）。
 * ========================================================================= */
const FARMING_PLOT_REQS = [1, 1, 1, 3, 6, 10, 15, 22];   /* 灵植 Lv. 达到多少解锁第 i 块地块 */

const FARM_SEEDS = [
  { id: 'seed_ling',   name: '灵草种子',     icon: '🌱', req: 1,  growTime: 25,  yield: 3, outId: 'herb',        dropBy: 'al_ling' },
  { id: 'seed_juqi',   name: '聚气草种子',   icon: '🌱', req: 1,  growTime: 30,  yield: 2, outId: 'herb_juqi',   dropBy: 'al_juqi' },
  { id: 'seed_liao',   name: '疗伤草种子',   icon: '🌱', req: 3,  growTime: 38,  yield: 2, outId: 'herb_liao',   dropBy: 'al_liao' },
  { id: 'seed_zhuji',  name: '筑基花种子',   icon: '🌺', req: 10, growTime: 70,  yield: 2, outId: 'herb_zhuji',  dropBy: 'al_zhuji' },
  { id: 'seed_ning',   name: '凝元参种子',   icon: '🪷', req: 20, growTime: 120, yield: 2, outId: 'herb_ning',   dropBy: 'al_ning' },
  { id: 'seed_ying',   name: '化婴芝种子',   icon: '🍄', req: 30, growTime: 200, yield: 2, outId: 'herb_ying',   dropBy: 'al_ying' }
];

function findSeed(seedId) {
  for (let i = 0; i < FARM_SEEDS.length; i++) if (FARM_SEEDS[i].id === seedId) return FARM_SEEDS[i];
  return null;
}

function plotUnlocked(farmingLvl, idx) {
  return idx < FARMING_PLOT_REQS.length && farmingLvl >= FARMING_PLOT_REQS[idx];
}

/* =========================================================================
 * 纯函数工具
 * ========================================================================= */
function xpNeed(skillId, lvl) {
  const s = SKILLS[skillId];
  return Math.floor(s.xpBase * Math.pow(lvl, s.xpPow));
}

function itemName(id) { return ITEMS[id] ? ITEMS[id].name : id; }
function itemIcon(id) { return ITEMS[id] ? ITEMS[id].icon : '❔'; }

function randInt(a, b) { return a + Math.floor(Math.random() * (b - a + 1)); }

function realmInfo(lvl) {
  const idx = Math.max(0, Math.min(Math.floor(lvl) - 1, STAGES.length - 1));
  return STAGES[idx];
}

/* 第 idx 阶（0 起）的突破信息，最高阶返回 null */
function breakInfo(idx) {
  const st = STAGES[idx];
  if (!st || st.isMax) return null;
  return st.breakInfo;
}

/* 动作/配方统一查询：先查采集动作，再查配方 */
function findActivity(skillId, id) {
  const acts = ACTIONS[skillId];
  if (acts) {
    for (let i = 0; i < acts.length; i++) if (acts[i].id === id) return acts[i];
  }
  const recs = RECIPES[skillId];
  if (recs) {
    for (let i = 0; i < recs.length; i++) if (recs[i].id === id) return recs[i];
  }
  return null;
}

function findMonster(id) {
  for (let i = 0; i < MONSTERS.length; i++) if (MONSTERS[i].id === id) return MONSTERS[i];
  return null;
}

function findTask(id) {
  for (let i = 0; i < TASKS.length; i++) if (TASKS[i].id === id) return TASKS[i];
  return null;
}
