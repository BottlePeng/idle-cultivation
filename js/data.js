'use strict';

/* =========================================================================
 * 仙途挂机 · 静态数据层
 * 只放"配置"，不放逻辑。改数值只需改这里。
 * 设计参考：《梅尔沃放置》的动作/精通/命中制战斗 + 《凡人修仙传》的境界/灵根/丹药
 * ========================================================================= */

/* 版本号（全项目唯一来源，界面、窗口标题与打包文件名都读它）
   三段式 主.次.修：
     patch++  小更新（bug 修复等，不影响存档）
     minor++  机制更新（新增/改动机制，影响存档），patch 归零
     major++  大型更新（DLC、全新机制，需重开游戏），minor/patch 归零
   改这里用 `node tools/version.js patch|minor|major`，打包前会自动同步。 */
const VERSION = '1.9.8';

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

  /* --- 技能等级：无上限（经验曲线 xpBase × lvl^xpPow 自然递增） --- */

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
/* =========================================================================
 * 物品表：所有采集 / 炼丹 / 炼器 / 掉落产物统一在此登记
 * type 分类：material 材料 / food 食物 / pill 丹药 / seed 种子 / equip 装备
 * value：出售给 NPC 的基础价；装备另有 atk/def/hit/ev/hp 等加成字段
 * ========================================================================= */
const ITEMS = {
  /* ===== 木材 ===== */
  log_qing: { name: '灵木', icon: '🌳', type: 'material', value: 2, desc: '青云山常见灵木，炼器基础材料。' },
  log_han: { name: '寒松木', icon: '🌲', type: 'material', value: 6, desc: '生于寒潭边的松木，灵气充盈。' },
  log_tie:  { name: '铁木', icon: '🌳', type: 'material', value: 18, desc: '坚硬如铁的万年古木。' },
  log_bing: { name: '冰魄木', icon: '❄️', type: 'material', value: 40, desc: '极寒之地孕育，寒气凝于木髓。' },
  log_yun:  { name: '云杉木', icon: '☁️', type: 'material', value: 88, desc: '生于高云海峰之上，轻盈不腐。' },
  log_shen: { name: '万年神木', icon: '🌴', type: 'material', value: 220, desc: '上古遗留神木，炼虚境顶级基材。' },
  log_lingxu:{ name: '灵虚木', icon: '🌌', type: 'material', value: 620, desc: '灵虚境修士从虚空截取的道木。' },
  log_taiyuan:{ name: '太原木', icon: '🌲', type: 'material', value: 1200, desc: '太原天中自生的道木，坚硬不朽。' },
  log_kunlun:{ name: '昆仑木', icon: '🏔️', type: 'material', value: 2500, desc: '昆仑仙山万年道木，仙气充盈。' },
  log_wuxu:  { name: '无虚木', icon: '🌌', type: 'material', value: 5500, desc: '无虚之境凝结的道木，天地之根。' },

  /* ===== 鱼 ===== */
  fish_qing: { name: '青鱼', icon: '🐟', type: 'food', value: 3, heal: 25, desc: '食用后恢复 25 点生命。' },
  fish_ling: { name: '灵鲤', icon: '🐠', type: 'food', value: 9, heal: 80, desc: '食用后恢复 80 点生命。' },
  fish_long: { name: '龙须鱼', icon: '🐡', type: 'food', value: 28, heal: 250, desc: '食用后恢复 250 点生命。' },
  fish_bing: { name: '冰鳞鱼', icon: '🧊', type: 'food', value: 60, heal: 520, desc: '冰湖深处之鱼，恢复生命并略凝灵力。' },
  fish_yao:  { name: '妖骨鱼', icon: '🦴', type: 'food', value: 140, heal: 1100, desc: '深海底妖骨化鱼，疗伤极品。' },
  fish_zu:   { name: '须鱼王', icon: '🐲', type: 'food', value: 320, heal: 2500, desc: '深海巨妖化形之鱼王。' },
  fish_lingxu:{ name: '灵虚鲸', icon: '🐋', type: 'food', value: 780, heal: 6000, desc: '灵虚之海遨游的道鲸。' },
  fish_taiyuan:{ name: '太玄鲤', icon: '🐉', type: 'food', value: 1500, heal: 12000, desc: '太玄天池中的千年锦鲤。' },
  fish_kunlun: { name: '昆仑螭', icon: '🐍', type: 'food', value: 3200, heal: 25000, desc: '昆仑仙泉中的螭龙化鱼。' },
  fish_wuxu:   { name: '无虚鲲', icon: '🌊', type: 'food', value: 7000, heal: 55000, desc: '无虚之海里的鲲化道鱼。' },

  /* ===== 矿 ===== */
  ore_iron: { name: '铁矿石', icon: '⛏️', type: 'material', value: 3, desc: '富含凡铁的矿石。' },
  ore_xuan: { name: '玄铁矿', icon: '⛰️', type: 'material', value: 10, desc: '玄铁矿石，炼器上品。' },
  ore_ling: { name: '灵石原矿', icon: '🔮', type: 'material', value: 22, desc: '蕴含灵气的原矿，可提炼灵石。' },
  ore_bing: { name: '冰晶石', icon: '💎', type: 'material', value: 55, desc: '极地挖出的冰晶石，寒气凛冽。' },
  ore_yang: { name: '阳火精', icon: '🔥', type: 'material', value: 120, desc: '地心之矿，阳火精纯。' },
  ore_shen: { name: '神玉', icon: '🌈', type: 'material', value: 300, desc: '天外陨石中偶得的神玉原石。' },
  ore_xu:   { name: '炼虚石', icon: '🔮', type: 'material', value: 820, desc: '炼虚境采掘的虚空原矿。' },
  ore_tai:  { name: '太清玉', icon: '💎', type: 'material', value: 1600, desc: '太清天中凝结的宝玉原矿。' },
  ore_kunlun:{ name: '昆仑髓', icon: '🏔️', type: 'material', value: 3500, desc: '昆仑山脉深处的先天道髓。' },
  ore_wuxu: { name: '无虚髓', icon: '🌌', type: 'material', value: 7500, desc: '无虚之境核心的道髓原石。' },

  /* ===== 锭 ===== */
  ingot_iron: { name: '铁锭', icon: '⚙️', type: 'material', value: 10, desc: '熔炼后的铁锭。' },
  ingot_xuan: { name: '玄铁锭', icon: '⚙️', type: 'material', value: 32, desc: '熔炼后的玄铁锭。' },
  ingot_bing: { name: '冰魄锭', icon: '🧊', type: 'material', value: 160, desc: '冰晶石熔炼而成，寒意彻骨。' },
  ingot_yang: { name: '阳火锭', icon: '🔥', type: 'material', value: 360, desc: '阳火精熔炼，炽热难近。' },
  ingot_shen: { name: '神玉锭', icon: '💠', type: 'material', value: 900, desc: '神玉千锤百炼而成，炼虚之资。' },
  ingot_xu:   { name: '炼虚锭', icon: '🌑', type: 'material', value: 2400, desc: '炼虚石熔炼，虚空不侵。' },
  ingot_tai:  { name: '太清锭', icon: '💠', type: 'material', value: 4800, desc: '太清玉千锤百炼，仙气缭绕。' },
  ingot_kunlun:{ name: '昆仑锭', icon: '🏔️', type: 'material', value: 10500, desc: '昆仑髓凝聚，坚不可摧。' },
  ingot_wuxu: { name: '无虚锭', icon: '🌌', type: 'material', value: 22500, desc: '无虚髓炼成，道之本源。' },

  /* ===== 草药 ===== */
  herb: { name: '灵草', icon: '🌿', type: 'material', value: 8, desc: '山间灵草，炼丹皆宜。' },
  herb_juqi: { name: '聚气草', icon: '🍀', type: 'material', value: 10, desc: '服之可聚气归元，炼丹基础。' },
  herb_liao: { name: '疗伤草', icon: '🌾', type: 'material', value: 12, desc: '生肌止血，疗伤丹主料。' },
  herb_zhuji:{ name: '筑基花', icon: '🌸', type: 'material', value: 40, desc: '百年一开，筑基丹必需。' },
  herb_ning: { name: '凝元参', icon: '🌼', type: 'material', value: 120, desc: '深山灵参，凝元之要。' },
  herb_ying: { name: '化婴芝', icon: '🍄', type: 'material', value: 320, desc: '灵芝化形，元婴之资。' },
  herb_bing: { name: '冰心草', icon: '❄️', type: 'material', value: 80, desc: '生长于冰渊深处，性寒镇魂。' },
  herb_yao:  { name: '妖丹花', icon: '🌺', type: 'material', value: 200, desc: '妖族内丹化花，丹道奇材。' },
  herb_zu:   { name: '龙须根', icon: '🌱', type: 'material', value: 450, desc: '龙须攀龙根，炼神之上品。' },
  herb_mo:   { name: '墨灵芝', icon: '🟣', type: 'material', value: 900, desc: '墨色流光，化神丹必备。' },
  herb_xue:  { name: '血玉参', icon: '🩸', type: 'material', value: 1800, desc: '血玉成参，炼虚根基。' },
  herb_shen: { name: '神元果', icon: '✨', type: 'material', value: 4000, desc: '神元凝结成实，炼虚大圆满之资。' },
  herb_xu:   { name: '炼虚参', icon: '🏵️', type: 'material', value: 9000, desc: '炼虚境的千年道参，破境必备。' },
  herb_tai:  { name: '太清芝', icon: '🍄', type: 'material', value: 18000, desc: '太清天自生的道芝，仙品之上。' },
  herb_kunlun:{ name: '昆仑莲', icon: '🌷', type: 'material', value: 40000, desc: '昆仑天池中千年一开的道莲。' },
  herb_wuxu: { name: '无虚根', icon: '🌱', type: 'material', value: 90000, desc: '无虚之境的先天道根，万物之源。' },

  /* ===== 种子 ===== */
  seed_juqi: { name: '聚气草种子', icon: '🌱', type: 'seed', value: 4, desc: '种入地块后可收获聚气草。' },
  seed_liao: { name: '疗伤草种子', icon: '🌱', type: 'seed', value: 5, desc: '种入地块后可收获疗伤草。' },
  seed_zhuji:{ name: '筑基花种子', icon: '🌺', type: 'seed', value: 20, desc: '种入地块后可收获筑基花。' },
  seed_ning: { name: '凝元参种子', icon: '🌱', type: 'seed', value: 70, desc: '种入地块后可收获凝元参。' },
  seed_ying: { name: '化婴芝种子', icon: '🌱', type: 'seed', value: 200, desc: '种入地块后可收获化婴芝。' },
  seed_ling: { name: '灵草种子', icon: '🌱', type: 'seed', value: 3, desc: '种入地块后可收获灵草。' },
  seed_bing: { name: '冰心草种子', icon: '❄️', type: 'seed', value: 40, desc: '种入地块后可收获冰心草。' },
  seed_yao:  { name: '妖丹花种子', icon: '🌺', type: 'seed', value: 100, desc: '种入地块后可收获妖丹花。' },
  seed_zu:   { name: '龙须根种子', icon: '🌱', type: 'seed', value: 220, desc: '种入地块后可收获龙须根。' },
  seed_mo:   { name: '墨灵芝种子', icon: '🟣', type: 'seed', value: 450, desc: '种入地块后可收获墨灵芝。' },
  seed_xue:  { name: '血玉参种子', icon: '🩸', type: 'seed', value: 900, desc: '种入地块后可收获血玉参。' },
  seed_shen: { name: '神元果种子', icon: '✨', type: 'seed', value: 2000, desc: '种入地块后可收获神元果。' },
  seed_xu:   { name: '炼虚参种子', icon: '🌱', type: 'seed', value: 4500, desc: '种入地块后可收获炼虚参。' },
  seed_tai:  { name: '太清芝种子', icon: '🍄', type: 'seed', value: 9000, desc: '种入地块后可收获太清芝。' },
  seed_kunlun:{ name: '昆仑莲种子', icon: '🌱', type: 'seed', value: 20000,desc: '种入地块后可收获昆仑莲。' },
  seed_wuxu: { name: '无虚根种子', icon: '🌱', type: 'seed', value: 45000,desc: '种入地块后可收获无虚根。' },

  /* ===== 丹药 ===== */
  pill_juqi: { name: '聚气丹', icon: '🔴', type: 'pill', use: 'cult', value: 45, desc: '服用后精纯修为大量增加。' },
  pill_liao: { name: '疗伤丹', icon: '🟢', type: 'pill', use: 'heal', value: 60, desc: '服用后恢复 65% 生命。' },
  pill_zhuji:{ name: '筑基丹', icon: '🟡', type: 'pill', use: 'break', value: 300, desc: '冲击筑基期所必需，突破时消耗。' },
  pill_ning: { name: '凝元丹', icon: '🟣', type: 'pill', use: 'break', value: 800, desc: '冲击结丹期所必需，突破时消耗。' },
  pill_ying: { name: '化婴丹', icon: '🔵', type: 'pill', use: 'break', value: 2200, desc: '冲击元婴期所必需，突破时消耗。' },
  pill_shen: { name: '化神丹', icon: '⚪', type: 'pill', use: 'break', value: 6000, desc: '冲击化神期所必需，突破时消耗。' },
  pill_xu:   { name: '炼虚丹', icon: '🌑', type: 'pill', use: 'break', value: 16000, desc: '冲击炼虚期所必需，突破时消耗。' },
  pill_wudao:{ name: '悟道丹', icon: '🟠', type: 'pill', use: 'wudao', value: 800, desc: '服用后悟性 +1：修炼速度 +1%，突破成功率 +1%。' },
  pill_bing: { name: '冰心丹', icon: '🧊', type: 'pill', use: 'cult', value: 180, desc: '冰心炼魂，服后修为大增并稳定心境。' },
  pill_yao:  { name: '妖元丹', icon: '🌺', type: 'pill', use: 'cult', value: 520, desc: '妖元凝成，修为、经验双加。' },
  pill_zu:   { name: '龙须丹', icon: '🌟', type: 'pill', use: 'break', value: 1800, desc: '化婴丹辅助，可提升化婴成功率 5%。' },
  pill_ningyuan: { name: '凝元补丹', icon: '🌼', type: 'pill', use: 'cult', value: 6000, desc: '凝元期辅助丹，服后修为小涨。' },
  pill_mo:   { name: '化神补丹', icon: '🟣', type: 'pill', use: 'cult', value: 2800, desc: '化神丹之外的辅助丹药。' },
  pill_xue:  { name: '血玉丹', icon: '🩸', type: 'pill', use: 'break', value: 14000, desc: '冲击炼虚期时提升成功率 6%。' },
  pill_shen_cult: { name: '神元丹', icon: '✨', type: 'pill', use: 'cult', value: 40000, desc: '炼虚后期服下，修为狂涨。' },
  pill_he:   { name: '合一丹', icon: '☯', type: 'pill', use: 'cult', value: 9000, desc: '五行合一，服后五行技能经验暴增。' },
  pill_san:  { name: '散神丹', icon: '💫', type: 'pill', use: 'heal', value: 200, desc: '瞬间恢复全部生命，危急时服下。' },
  pill_xu_cult:{ name: '炼虚补丹', icon: '🌑', type: 'pill', use: 'cult', value: 22000, desc: '炼虚后期服下，修为激增。' },
  pill_tai:    { name: '太清丹', icon: '💠', type: 'pill', use: 'cult', value: 45000, desc: '太清天丹，五行经验暴增。' },
  pill_kunlun: { name: '昆仑丹', icon: '🏔️', type: 'pill', use: 'cult', value: 100000, desc: '昆仑仙丹，全技能经验狂涨。' },
  pill_wuxu:   { name: '无虚丹', icon: '🌌', type: 'pill', use: 'cult', value: 220000, desc: '无虚之境才敢服，修为冲破桎梏。' },
  pill_lan:    { name: '蓝萤丹', icon: '🔵', type: 'pill', use: 'heal', value: 260,  desc: '服下后恢复大量生命。' },
  pill_zi:     { name: '紫芝丹', icon: '🍄', type: 'pill', use: 'cult', value: 1600, desc: '紫芝炼成，修为稳固。' },
  pill_you:    { name: '幽兰丹', icon: '🌑', type: 'pill', use: 'cult', value: 6800, desc: '幽兰入丹，阴柔养神。' },
  pill_tian:   { name: '天心丹', icon: '🌸', type: 'pill', use: 'cult', value: 26000,desc: '天心莲炼成，心境通明。' },
  pill_shu:    { name: '扶桑丹', icon: '🌅', type: 'pill', use: 'cult', value: 62000,desc: '日精入丹，修为如旭日。' },
  pill_hun:    { name: '混沌丹', icon: '🌌', type: 'pill', use: 'cult', value: 150000,desc: '混沌草炼成，道法自然。' },

  /* ===== 凡间百业产出 ===== */
  hide:     { name: '兽皮', icon: '🟫', type: 'material', value: 5, desc: '妖兽皮毛，可制护甲。' },
  rice:     { name: '米饭', icon: '🍚', type: 'food', value: 2, heal: 12, desc: '凡人家常饭食，食用后恢复 12 点生命。' },
  wine:     { name: '浊酒', icon: '🍶', type: 'food', value: 5, heal: 18, desc: '凡酿浊酒，食用后恢复 18 点生命。' },
  cloth:    { name: '麻布', icon: '🧶', type: 'material', value: 7, desc: '凡间织物，市集有人收。' },
  painting: { name: '名家字画', icon: '🖼️', type: 'material', value: 26, desc: '凡间名家手笔，颇受修士喜爱。' },
  silk:     { name: '云锦', icon: '🎀', type: 'material', value: 60, desc: '名贵云锦，修士爱收藏。' },
  jade:     { name: '凡间玉', icon: '🟢', type: 'material', value: 45, desc: '凡间玉器，虽不如灵石却也雅致。' },
  book:     { name: '典籍', icon: '📚', type: 'material', value: 38, desc: '古籍珍本，偶有心得。' },
  tea:      { name: '灵茶', icon: '🍵', type: 'food', value: 18, heal: 60, desc: '略有灵气的凡间茶。' },
  scroll:   { name: '道符残卷', icon: '📜', type: 'material', value: 120, desc: '残缺道符，可炼成符箓材料。' },

  /* ===== 装备（法宝 / 灵甲 / 法冠 / 灵靴 / 玉佩 / 灵戒） ===== */
  w_tie: { name: '铁剑', icon: '🗡️', type: 'equip', slot: 'weapon', atk: 6, value: 40, desc: '凡铁打造。攻击 +6。' },
  w_xuan:{ name: '玄铁剑', icon: '⚔️', type: 'equip', slot: 'weapon', atk: 16, hit: 8, value: 150, desc: '玄铁打造。攻击 +16，命中 +8。' },
  w_bing:{ name: '冰魄剑', icon: '❄️', type: 'equip', slot: 'weapon', atk: 28, hit: 12, ev: 4, value: 600, desc: '寒意附剑。攻击 +28，命中 +12，闪避 +4。' },
  w_yang:{ name: '阳火剑', icon: '🔥', type: 'equip', slot: 'weapon', atk: 40, hit: 16, value: 1200, desc: '阳火淬剑。攻击 +40，命中 +16。' },
  w_fly: { name: '御风剑', icon: '🌀', type: 'equip', slot: 'weapon', atk: 30, hit: 15, ev: 8, value: 520, desc: '剑成御风。攻击 +30，命中 +15，闪避 +8。' },
  w_shen:{ name: '神玉剑', icon: '⚡', type: 'equip', slot: 'weapon', atk: 72, hit: 28, ev: 10, hp: 50, value: 3500, desc: '神玉铸剑，炼虚之器。攻击 +72，命中 +28，闪避 +10，生命 +50。' },

  a_tie: { name: '铁甲', icon: '🛡️', type: 'equip', slot: 'armor', def: 6, hp: 20, value: 45, desc: '防御 +6，生命 +20。' },
  a_xuan:{ name: '玄铁甲', icon: '🥋', type: 'equip', slot: 'armor', def: 14, hp: 60, value: 170, desc: '防御 +14，生命 +60。' },
  a_bing:{ name: '冰魄甲', icon: '🧊', type: 'equip', slot: 'armor', def: 22, hp: 120, ev: 6, value: 650, desc: '防御 +22，生命 +120，闪避 +6。' },
  a_yang:{ name: '阳火甲', icon: '🔥', type: 'equip', slot: 'armor', def: 32, hp: 180, value: 1400, desc: '防御 +32，生命 +180。' },
  a_shen:{ name: '神玉甲', icon: '🌈', type: 'equip', slot: 'armor', def: 50, hp: 320, ev: 10, value: 3800, desc: '防御 +50，生命 +320，闪避 +10。' },

  h_tie: { name: '铁冠', icon: '⛑️', type: 'equip', slot: 'helmet', def: 3, hit: 4, value: 35, desc: '防御 +3，命中 +4。' },
  h_xuan:{ name: '玄铁冠', icon: '👑', type: 'equip', slot: 'helmet', def: 7, hit: 8, hp: 15, value: 150, desc: '防御 +7，命中 +8，生命 +15。' },
  h_bing:{ name: '冰魄冠', icon: '❄️', type: 'equip', slot: 'helmet', def: 12, hit: 14, hp: 30, value: 620, desc: '防御 +12，命中 +14，生命 +30。' },
  h_yang:{ name: '阳火冠', icon: '🔥', type: 'equip', slot: 'helmet', def: 18, hit: 22, hp: 40, value: 1300, desc: '防御 +18，命中 +22，生命 +40。' },
  h_shen:{ name: '神玉冠', icon: '✨', type: 'equip', slot: 'helmet', def: 28, hit: 36, hp: 80, value: 3300, desc: '防御 +28，命中 +36，生命 +80。' },

  b_tie: { name: '布靴', icon: '🥾', type: 'equip', slot: 'boots', ev: 6, value: 30, desc: '闪避 +6。' },
  b_fly: { name: '疾风靴', icon: '👢', type: 'equip', slot: 'boots', ev: 14, hit: 4, value: 190, desc: '闪避 +14，命中 +4。' },
  b_bing:{ name: '冰履', icon: '🧊', type: 'equip', slot: 'boots', ev: 20, hit: 6, def: 4, value: 580, desc: '闪避 +20，命中 +6，防御 +4。' },
  b_yang:{ name: '踏炎靴', icon: '🔥', type: 'equip', slot: 'boots', ev: 28, hit: 10, def: 6, value: 1200, desc: '闪避 +28，命中 +10，防御 +6。' },
  b_shen:{ name: '云虚步', icon: '☁️', type: 'equip', slot: 'boots', ev: 42, hit: 16, def: 10, value: 3000, desc: '闪避 +42，命中 +16，防御 +10。' },

  t_ling: { name: '灵玉佩', icon: '🧿', type: 'equip', slot: 'amulet', def: 5, hp: 40, value: 220, desc: '防御 +5，生命 +40。' },
  t_ju:   { name: '聚灵佩', icon: '📿', type: 'equip', slot: 'amulet', def: 8, hit: 6, hp: 60, value: 460, desc: '防御 +8，命中 +6，生命 +60。' },
  t_bing: { name: '冰心佩', icon: '❄️', type: 'equip', slot: 'amulet', def: 12, hp: 100, spirit: 10, value: 800, desc: '防御 +12，生命 +100，灵力 +10/秒。' },
  t_yang: { name: '阳火佩', icon: '🔥', type: 'equip', slot: 'amulet', atk: 8, def: 10, hp: 120, value: 1500, desc: '攻击 +8，防御 +10，生命 +120。' },
  t_shen: { name: '神元佩', icon: '✨', type: 'equip', slot: 'amulet', def: 18, hp: 220, atk: 10, ev: 8, value: 3800, desc: '防御 +18，生命 +220，攻击 +10，闪避 +8。' },

  r_tie:  { name: '铁戒', icon: '💍', type: 'equip', slot: 'ring', atk: 3, value: 40, desc: '攻击 +3。' },
  r_xuan: { name: '玄铁戒', icon: '💎', type: 'equip', slot: 'ring', atk: 7, ev: 5, value: 180, desc: '攻击 +7，闪避 +5。' },
  r_bing: { name: '冰魄戒', icon: '❄️', type: 'equip', slot: 'ring', atk: 10, ev: 8, def: 4, value: 560, desc: '攻击 +10，闪避 +8，防御 +4。' },
  r_yang: { name: '阳火戒', icon: '🔥', type: 'equip', slot: 'ring', atk: 16, def: 6, hit: 6, value: 1100, desc: '攻击 +16，防御 +6，命中 +6。' },
  r_shen: { name: '神玉戒', icon: '🌈', type: 'equip', slot: 'ring', atk: 24, ev: 14, def: 10, hit: 14, value: 3200, desc: '攻击 +24，闪避 +14，防御 +10，命中 +14。' },

  /* ===== 补档物品：保证每技能每 5 级有新物品 ===== */

  /* 木材 */
  log_zi:     { name: '紫檀木', icon: '🎋', type: 'material', value: 130,  desc: '紫气凝聚的檀木，纹理如龙。' },
  log_lan:    { name: '蓝焰木', icon: '🔵', type: 'material', value: 420,  desc: '木质蕴含蓝焰，遇灵即燃。' },
  log_lei:    { name: '雷击木', icon: '⚡', type: 'material', value: 1000, desc: '天雷劈中之木，雷韵不散。' },
  log_you:    { name: '幽檀木', icon: '🌑', type: 'material', value: 1800, desc: '生于幽冥谷的檀木，阴气森森。' },
  log_tian:   { name: '天穹木', icon: '☁️', type: 'material', value: 3800, desc: '通天之木，枝干直入云霄。' },
  log_shu:    { name: '扶桑木', icon: '🌅', type: 'material', value: 7200, desc: '日出之处的上古扶桑。' },
  log_jian:   { name: '建木',   icon: '🌳', type: 'material', value: 14000,desc: '通天建木，天地之柱。' },
  log_pan:    { name: '盘古木', icon: '🏔️', type: 'material', value: 26000,desc: '开天辟地时遗留的祖木。' },
  log_hundun: { name: '混沌木', icon: '🌌', type: 'material', value: 60000,desc: '混沌初开时的第一株木。' },

  /* 鱼类 */
  fish_huang: { name: '皇带鱼', icon: '🐟', type: 'food', value: 120,  heal: 450,    desc: '食用后恢复 450 点生命。' },
  fish_lei:   { name: '雷鳗',   icon: '⚡', type: 'food', value: 240,  heal: 700,    desc: '食用后恢复 700 点生命。' },
  fish_you:   { name: '幽鲨',   icon: '🦈', type: 'food', value: 500,  heal: 1800,   desc: '食用后恢复 1800 点生命。' },
  fish_xuan:  { name: '玄龟',   icon: '🐢', type: 'food', value: 1100, heal: 3600,   desc: '食用后恢复 3600 点生命。' },
  fish_tian:  { name: '天鲸',   icon: '🐋', type: 'food', value: 2600, heal: 9000,   desc: '食用后恢复 9000 点生命。' },
  fish_shu:   { name: '扶桑鲤', icon: '🐠', type: 'food', value: 5200, heal: 15000,  desc: '食用后恢复 15000 点生命。' },
  fish_jian:  { name: '建木鱼', icon: '🐡', type: 'food', value: 10000,heal: 30000,  desc: '食用后恢复 30000 点生命。' },
  fish_pan:   { name: '盘古鲵', icon: '🦎', type: 'food', value: 21000,heal: 60000,  desc: '食用后恢复 60000 点生命。' },
  fish_hundun:{ name: '混沌鱼', icon: '🌊', type: 'food', value: 46000,heal: 120000, desc: '食用后恢复 120000 点生命。' },

  /* 矿石 */
  ore_zi:     { name: '紫金矿', icon: '🟣', type: 'material', value: 150,  desc: '紫金砂凝结的矿脉原石。' },
  ore_lan:    { name: '蓝晶矿', icon: '🔵', type: 'material', value: 460,  desc: '幽蓝晶石，寒气内蕴。' },
  ore_lei:    { name: '雷银矿', icon: '⚡', type: 'material', value: 1100, desc: '雷银矿石，触之微麻。' },
  ore_you:    { name: '幽铁矿', icon: '🌑', type: 'material', value: 1900, desc: '幽冥地底的阴铁原矿。' },
  ore_gui:    { name: '鬼银矿', icon: '👻', type: 'material', value: 2900, desc: '鬼气缠绕的银矿，阴柔至极。' },
  ore_tian:   { name: '天青石', icon: '🔹', type: 'material', value: 4200, desc: '天青色的灵玉原石。' },
  ore_shu:    { name: '扶桑石', icon: '🌅', type: 'material', value: 8000, desc: '扶桑树下凝结的日精之石。' },
  ore_jian:   { name: '建木玉', icon: '🌳', type: 'material', value: 15000,desc: '建木根下孕育的通天玉矿。' },
  ore_pan:    { name: '盘古石', icon: '🏔️', type: 'material', value: 28000,desc: '开天祖石，坚不可摧。' },
  ore_hundun: { name: '混沌石', icon: '🌌', type: 'material', value: 64000,desc: '混沌本源凝结的原石。' },

  /* 锭 */
  ingot_zi:   { name: '紫金锭', icon: '🟣', type: 'material', value: 420,  desc: '紫金矿熔炼而成。' },
  ingot_lan:  { name: '蓝晶锭', icon: '🔵', type: 'material', value: 1250, desc: '蓝晶矿熔炼而成。' },
  ingot_lei:  { name: '雷银锭', icon: '⚡', type: 'material', value: 2900, desc: '雷银矿熔炼而成，带电不散。' },
  ingot_you:  { name: '幽铁锭', icon: '🌑', type: 'material', value: 5000, desc: '幽铁矿熔炼而成，阴柔噬魂。' },
  ingot_gui:  { name: '鬼银锭', icon: '👻', type: 'material', value: 7600, desc: '鬼银矿熔炼而成，鬼气凝形。' },
  ingot_tian: { name: '天青锭', icon: '💠', type: 'material', value: 11000,desc: '天青石熔炼而成。' },
  ingot_shu:  { name: '扶桑锭', icon: '🌅', type: 'material', value: 21000,desc: '扶桑石熔炼而成，日精流转。' },
  ingot_jian: { name: '建木锭', icon: '🌳', type: 'material', value: 40000,desc: '建木玉熔炼而成。' },
  ingot_pan:  { name: '盘古锭', icon: '🏔️', type: 'material', value: 74000,desc: '盘古石熔炼而成，祖气不灭。' },
  ingot_hundun:{ name: '混沌锭', icon: '🌌', type: 'material', value: 168000,desc: '混沌石熔炼而成，道之本源。' },

  /* 草药 */
  herb_lan:   { name: '蓝萤草', icon: '🔵', type: 'material', value: 30,  desc: '夜色中泛蓝光的灵草。' },
  herb_zi:    { name: '紫芝',   icon: '🍄', type: 'material', value: 160, desc: '紫色灵芝，补元固本。' },
  herb_you:   { name: '幽兰',   icon: '🌑', type: 'material', value: 2400,desc: '幽冥谷中幽香暗涌的灵兰。' },
  herb_tian:  { name: '天心莲', icon: '🌸', type: 'material', value: 9000,desc: '莲心通天的仙品灵植。' },
  herb_shu:   { name: '扶桑花', icon: '🌅', type: 'material', value: 19000,desc: '扶桑树上的日华之花。' },
  herb_hun:   { name: '混沌草', icon: '🌌', type: 'material', value: 52000,desc: '混沌之气化生的道草。' },

  /* 修炼产物 */
  qi_jing:     { name: '气晶',     icon: '💠', type: 'material', value: 25,   desc: '吐纳所得的气之结晶。' },
  jing_ling:   { name: '灵晶',     icon: '💠', type: 'material', value: 90,   desc: '引气入体后凝出的灵晶。' },
  dao_guo:     { name: '道果',     icon: '🍎', type: 'material', value: 900,  desc: '入定圆满所结的道果。' },
  jing_yuan:   { name: '精元',     icon: '🔴', type: 'material', value: 6000, desc: '洗髓伐骨后凝出的精元。' },
  shen_mai:    { name: '神脉',     icon: '🧬', type: 'material', value: 24000,desc: '心神合一后显化的神脉。' },
  xuan_zhu:    { name: '玄珠',     icon: '⚫', type: 'material', value: 60000,desc: '玄关一窍所凝的玄珠。' },
  xu_kong_jing:{ name: '虚空晶',   icon: '🕳️', type: 'material', value: 140000,desc: '神识化虚时凝出的虚空之晶。' },
  tian_dao:    { name: '天道印',   icon: '🌟', type: 'material', value: 320000,desc: '天人合一所烙的天道印记。' },
  fa_ze:       { name: '法则碎片', icon: '📜', type: 'material', value: 800000,desc: '万法归一后凝成的法则碎片。' },

  /* 灵植作物 */
  rice_ling:  { name: '灵米',   icon: '🌾', type: 'food', value: 35,   heal: 120,  desc: '食用后恢复 120 点生命。' },
  yun_mian:   { name: '云棉',   icon: '☁️', type: 'material', value: 220, desc: '轻盈如云的灵棉，可织云锦。' },
  tea_zi:     { name: '紫府茶', icon: '🍵', type: 'food', value: 950,  heal: 2600, desc: '饮用后恢复 2600 点生命。' },
  rice_tian:  { name: '天香米', icon: '🌾', type: 'food', value: 4200, heal: 12000,desc: '食用后恢复 12000 点生命。' },
  guo_shu:    { name: '扶桑果', icon: '🍑', type: 'food', value: 16000,heal: 42000,desc: '食用后恢复 42000 点生命。' },
  dou_hun:    { name: '混沌豆', icon: '🥜', type: 'material', value: 48000,desc: '混沌之气结成的道豆。' },
  lian_zi:    { name: '道莲',   icon: '🌷', type: 'material', value: 110000,desc: '九品道莲，食之悟道。' },

  /* 新增种子 */
  seed_lingdao:   { name: '灵稻种子',   icon: '🌾', type: 'seed', value: 12,   desc: '种入地块后可收获灵米。' },
  seed_yunmian:   { name: '云棉种子',   icon: '☁️', type: 'seed', value: 60,   desc: '种入地块后可收获云棉。' },
  seed_zifu:      { name: '紫府茶种',   icon: '🍵', type: 'seed', value: 320,  desc: '种入地块后可收获紫府茶。' },
  seed_tianxiang: { name: '天香稻种',   icon: '🌾', type: 'seed', value: 1400, desc: '种入地块后可收获天香米。' },
  seed_fusang:    { name: '扶桑果种',   icon: '🍑', type: 'seed', value: 5000, desc: '种入地块后可收获扶桑果。' },
  seed_hundou:    { name: '混沌豆种',   icon: '🌱', type: 'seed', value: 16000,desc: '种入地块后可收获混沌豆。' },
  seed_daolian:   { name: '道莲种子',   icon: '🌱', type: 'seed', value: 36000,desc: '种入地块后可收获道莲。' },

  /* 补档法宝装备 */
  w_zi:      { name: '紫檀剑', icon: '🗡️', type: 'equip', slot: 'weapon', atk: 46, hit: 18, value: 1800, desc: '紫檀为柄，紫金为锋。攻击 +46，命中 +18。' },
  a_tian:    { name: '天穹甲', icon: '🌈', type: 'equip', slot: 'armor', def: 62, hp: 420, ev: 12, value: 6200, desc: '天青锭锻造，云纹流转。防御 +62，生命 +420，闪避 +12。' },
  w_jian:    { name: '建木剑', icon: '🌳', type: 'equip', slot: 'weapon', atk: 100, hit: 34, ev: 14, hp: 80, value: 15000, desc: '建木为骨，通天剑意。攻击 +100，命中 +34，闪避 +14，生命 +80。' },
  h_pan:     { name: '盘古冠', icon: '🏔️', type: 'equip', slot: 'helmet', def: 46, hit: 52, hp: 160, value: 28000, desc: '祖石所铸，承天地之重。防御 +46，命中 +52，生命 +160。' },
  r_hundun:  { name: '混沌戒', icon: '🌌', type: 'equip', slot: 'ring', atk: 40, ev: 24, def: 18, hit: 24, value: 60000, desc: '混沌本源凝戒，万象归一。攻击 +40，闪避 +24，防御 +18，命中 +24。' },
  w_you:     { name: '玄冥剑', icon: '🌑', type: 'equip', slot: 'weapon', atk: 50, hit: 20, ev: 10, value: 3800, desc: '幽铁与鬼银合铸，幽光森森。攻击 +50，命中 +20，闪避 +10。' },
  a_gui:     { name: '幽铁甲', icon: '🌑', type: 'equip', slot: 'armor', def: 38, hp: 240, ev: 10, value: 5200, desc: '鬼银锻造，阴气护体。防御 +38，生命 +240，闪避 +10。' },
  w_tian:    { name: '天穹剑', icon: '🗡️', type: 'equip', slot: 'weapon', atk: 78, hit: 28, ev: 12, hp: 40, value: 9800, desc: '天青锭所铸，剑光如天。攻击 +78，命中 +28，闪避 +12，生命 +40。' },
  h_shu:     { name: '扶桑冠', icon: '🌅', type: 'equip', slot: 'helmet', def: 38, hit: 46, hp: 120, value: 18000, desc: '扶桑木与扶桑锭合铸，朝气蓬勃。防御 +38，命中 +46，生命 +120。' },
  r_jian:    { name: '建木戒', icon: '🌳', type: 'equip', slot: 'ring', atk: 28, ev: 18, def: 14, hit: 18, value: 38000, desc: '建木根凝戒，承通天之意。攻击 +28，闪避 +18，防御 +14，命中 +18。' },
  h_kunlun:  { name: '昆仑冠', icon: '🏔️', type: 'equip', slot: 'helmet', def: 52, hit: 58, hp: 200, value: 48000, desc: '昆仑山气凝冠，仙意凛然。防御 +52，命中 +58，生命 +200。' }
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
  smelting: { name: '熔炼', icon: '🔥', xpBase: 30, xpPow: 1.55, desc: '炼化矿石为锭，聚灵化灵力。' },
  crafting: { name: '炼器', icon: '🔨', xpBase: 30, xpPow: 1.55, desc: '锻造法宝护具。' },
  herbalism: { name: '采药', icon: '🌿', xpBase: 25, xpPow: 1.50, desc: '采撷天地灵草，为炼丹准备药材。' },
  alchemy: { name: '炼丹', icon: '⚗️', xpBase: 30, xpPow: 1.55, desc: '炼制各类丹药。' },
  combat: { name: '战斗', icon: '⚔️', xpBase: 38, xpPow: 1.60, desc: '讨伐妖兽，获取灵石与材料。' },
  cultivation: { name: '修炼', icon: '🧘', xpBase: 70, xpPow: 1.70, desc: '打坐吐纳，积累修为，冲击境界。' },
  formation: { name: '阵法', icon: '🧭', xpBase: 18, xpPow: 1.35, desc: '观星推演天机，布设阵法为诸般修行加持。' },
  farming: { name: '灵植', icon: '🌿', xpBase: 22, xpPow: 1.40, desc: '种下灵草种子，悉心浇灌，收获炼丹上品。' },
  thieving: { name: '入世', icon: '🎭', xpBase: 26, xpPow: 1.45, desc: '混迹红尘百业，体验凡人生计——或有所得，或被识破驱离。' }
};

const SKILL_ORDER = ['woodcutting', 'fishing', 'mining', 'smelting', 'crafting', 'herbalism', 'alchemy', 'combat', 'cultivation', 'formation', 'farming', 'thieving'];

/* =========================================================================
 * 采集 / 修炼动作（无消耗）
 * out: { id } 产出物品；{ spirit } 灵力；{ gold } 灵石；{ heal } 回复；{ cultXp } 修为
 * ========================================================================= */
const ACTIONS = {
  woodcutting: [
    { id: 'wc_qing',  name: '灵木林', icon: '🌳', req: 1,  time: 1.5, xp: 5,   out: { id: 'log_qing', qty: 1 } },
    { id: 'wc_pine',  name: '青松林', icon: '🌲', req: 3,  time: 2.0, xp: 9,   out: { id: 'log_qing', qty: 2 } },
    { id: 'wc_han',   name: '寒松林', icon: '🌲', req: 5,  time: 2.6, xp: 14,  out: { id: 'log_han',  qty: 1 } },
    { id: 'wc_maple', name: '赤枫林', icon: '🍁', req: 8,  time: 3.2, xp: 22,  out: { id: 'log_han',  qty: 1 } },
    { id: 'wc_tie',   name: '铁木古树', icon: '🌳', req: 15, time: 4.2, xp: 34,  out: { id: 'log_tie',  qty: 1 } },
    { id: 'wc_zi',    name: '紫檀林', icon: '🎋', req: 18, time: 4.8, xp: 42,  out: { id: 'log_zi',   qty: 1 } },
    { id: 'wc_bing',  name: '冰魄古木', icon: '❄️', req: 22, time: 5.5, xp: 60,  out: { id: 'log_bing', qty: 1 } },
    { id: 'wc_lan',   name: '蓝焰林', icon: '🔵', req: 28, time: 6.2, xp: 88,  out: { id: 'log_lan',  qty: 1 } },
    { id: 'wc_yun',   name: '云杉绝顶', icon: '☁️', req: 32, time: 7.0, xp: 110, out: { id: 'log_yun',  qty: 1 } },
    { id: 'wc_lei',   name: '雷击古林', icon: '⚡', req: 40, time: 8.4, xp: 155, out: { id: 'log_lei',  qty: 1 } },
    { id: 'wc_you',   name: '幽檀谷', icon: '🌑', req: 44, time: 9.0, xp: 178, out: { id: 'log_you',  qty: 1 } },
    { id: 'wc_shen',  name: '万年神木苑', icon: '🌴', req: 48, time: 9.5, xp: 200, out: { id: 'log_shen', qty: 1 } },
    { id: 'wc_lingxu',name: '灵虚林',     icon: '🌌', req: 55, time: 10.5, xp: 260, out: { id: 'log_lingxu', qty: 1 } },
    { id: 'wc_tian',  name: '天穹木林', icon: '☁️', req: 58, time: 11.2, xp: 292, out: { id: 'log_tian', qty: 1 } },
    { id: 'wc_taiyuan',name:'太原林',     icon: '🌲', req: 62, time: 12.0, xp: 340, out: { id: 'log_taiyuan', qty: 1 } },
    { id: 'wc_shu',   name: '扶桑林', icon: '🌅', req: 68, time: 13.0, xp: 420, out: { id: 'log_shu',  qty: 1 } },
    { id: 'wc_kunlun',name: '昆仑仙林',   icon: '🏔️', req: 72, time: 14.0, xp: 480, out: { id: 'log_kunlun', qty: 1 } },
    { id: 'wc_jian',  name: '建木祖林', icon: '🌳', req: 78, time: 15.2, xp: 600, out: { id: 'log_jian', qty: 1 } },
    { id: 'wc_taixuan',name:'太玄神木园', icon: '✨', req: 82, time: 16.5, xp: 700, out: { id: 'log_kunlun', qty: 2 } },
    { id: 'wc_pan',   name: '盘古林', icon: '🏔️', req: 88, time: 18.0, xp: 880, out: { id: 'log_pan',  qty: 1 } },
    { id: 'wc_wuxu',  name: '无虚道林',   icon: '🌌', req: 92, time: 20.0, xp: 1100,out: { id: 'log_wuxu', qty: 1 } },
    { id: 'wc_hundun',name: '混沌道林', icon: '🌌', req: 99, time: 22.0, xp: 1500,out: { id: 'log_hundun', qty: 1 } }
  ],
  fishing: [
    { id: 'fi_qing', name: '青鱼群',  icon: '🐟', req: 1,  time: 1.8, xp: 6,   out: { id: 'fish_qing', qty: 1 } },
    { id: 'fi_ba',   name: '草鱼湾',  icon: '🐠', req: 4,  time: 2.4, xp: 10,  out: { id: 'fish_qing', qty: 2 } },
    { id: 'fi_ling', name: '灵鲤潭',  icon: '🐠', req: 7,  time: 3.0, xp: 16,  out: { id: 'fish_ling', qty: 1 } },
    { id: 'fi_gui',  name: '玄龟湖',  icon: '🐢', req: 12, time: 3.8, xp: 26,  out: { id: 'fish_ling', qty: 1 } },
    { id: 'fi_long', name: '龙须深渊',icon: '🐡', req: 18, time: 5.0, xp: 42,  out: { id: 'fish_long', qty: 1 } },
    { id: 'fi_huang',name: '皇带鱼潮',icon: '🐟', req: 23, time: 6.0, xp: 62,  out: { id: 'fish_huang', qty: 1 } },
    { id: 'fi_bing', name: '冰湖',    icon: '🧊', req: 26, time: 6.5, xp: 72,  out: { id: 'fish_bing', qty: 1 } },
    { id: 'fi_lei',  name: '雷鳗泽',  icon: '⚡', req: 33, time: 7.5, xp: 115, out: { id: 'fish_lei',  qty: 1 } },
    { id: 'fi_yao',  name: '妖骨海',  icon: '🦴', req: 38, time: 8.5, xp: 130, out: { id: 'fish_yao',  qty: 1 } },
    { id: 'fi_you',  name: '幽鲨海沟',icon: '🦈', req: 43, time: 9.2, xp: 165, out: { id: 'fish_you',  qty: 1 } },
    { id: 'fi_xuan', name: '玄龟渊',  icon: '🐢', req: 48, time: 10.2,xp: 208, out: { id: 'fish_xuan', qty: 1 } },
    { id: 'fi_zu',   name: '须龙渊',  icon: '🐲', req: 55, time: 11,  xp: 240, out: { id: 'fish_zu',   qty: 1 } },
    { id: 'fi_tian', name: '天鲸海',  icon: '🐋', req: 58, time: 11.8,xp: 300, out: { id: 'fish_tian', qty: 1 } },
    { id: 'fi_lingxu',name:'灵虚海',  icon: '🐋', req: 62, time: 12.5,xp: 320, out: { id: 'fish_lingxu', qty: 1 } },
    { id: 'fi_shu',  name: '扶桑鲤池',icon: '🐠', req: 68, time: 13.6,xp: 435, out: { id: 'fish_shu',  qty: 1 } },
    { id: 'fi_taiyuan',name:'太玄天池',icon:'🐉', req: 72, time: 14.5,xp: 460, out: { id: 'fish_taiyuan', qty: 1 } },
    { id: 'fi_jian', name: '建木鱼渊',icon: '🐡', req: 78, time: 15.8,xp: 610, out: { id: 'fish_jian', qty: 1 } },
    { id: 'fi_kunlun',name: '昆仑仙泉',icon: '🐍', req: 82, time: 17.0,xp: 680, out: { id: 'fish_kunlun', qty: 1 } },
    { id: 'fi_pan',  name: '盘古鲵海',icon: '🦎', req: 88, time: 18.4,xp: 890, out: { id: 'fish_pan',  qty: 1 } },
    { id: 'fi_wuxu', name: '无虚之海',icon: '🌊', req: 92, time: 20.5,xp: 1080,out: { id: 'fish_wuxu', qty: 1 } },
    { id: 'fi_hundun',name:'混沌鱼渊',icon: '🌊', req: 99, time: 22.5,xp: 1520,out: { id: 'fish_hundun', qty: 1 } }
  ],
  mining: [
    { id: 'mn_iron', name: '铁矿脉', icon: '⛏️', req: 1,  time: 2.0, xp: 6,   out: { id: 'ore_iron', qty: 1 } },
    { id: 'mn_copp', name: '铜矿脉', icon: '🟧', req: 3,  time: 2.4, xp: 10,  out: { id: 'ore_iron', qty: 2 } },
    { id: 'mn_xuan', name: '玄铁矿脉', icon: '⛰️', req: 6,  time: 3.2, xp: 16,  out: { id: 'ore_xuan', qty: 1 } },
    { id: 'mn_tung', name: '钨金矿脉', icon: '✨', req: 10, time: 3.8, xp: 24,  out: { id: 'ore_xuan', qty: 1 } },
    { id: 'mn_ling', name: '灵石矿脉', icon: '🔮', req: 14, time: 4.4, xp: 38,  out: { id: 'ore_ling', qty: 1 } },
    { id: 'mn_zi',   name: '紫金矿洞', icon: '🟣', req: 18, time: 5.0, xp: 48,  out: { id: 'ore_zi',   qty: 1 } },
    { id: 'mn_bing', name: '冰晶洞', icon: '💎', req: 24, time: 6.2, xp: 70,  out: { id: 'ore_bing', qty: 1 } },
    { id: 'mn_lan',  name: '蓝晶矿洞', icon: '🔵', req: 28, time: 6.8, xp: 95,  out: { id: 'ore_lan',  qty: 1 } },
    { id: 'mn_lei',  name: '雷银矿脉', icon: '⚡', req: 33, time: 7.4, xp: 118, out: { id: 'ore_lei',  qty: 1 } },
    { id: 'mn_yang', name: '阳火地心', icon: '🔥', req: 36, time: 8.0, xp: 125, out: { id: 'ore_yang', qty: 1 } },
    { id: 'mn_you',  name: '幽铁矿坑', icon: '🌑', req: 43, time: 9.0, xp: 168, out: { id: 'ore_you',  qty: 1 } },
    { id: 'mn_gui',  name: '鬼银矿洞', icon: '👻', req: 48, time: 10.0,xp: 212, out: { id: 'ore_gui',  qty: 1 } },
    { id: 'mn_shen', name: '神玉陨坑', icon: '🌈', req: 52, time: 10.5, xp: 230, out: { id: 'ore_shen', qty: 1 } },
    { id: 'mn_tian', name: '天青石矿', icon: '🔹', req: 58, time: 11.6,xp: 305, out: { id: 'ore_tian', qty: 1 } },
    { id: 'mn_xu',   name: '炼虚矿脉', icon: '🔮', req: 62, time: 12.0, xp: 310, out: { id: 'ore_xu', qty: 1 } },
    { id: 'mn_shu',  name: '扶桑石矿', icon: '🌅', req: 68, time: 13.4,xp: 440, out: { id: 'ore_shu',  qty: 1 } },
    { id: 'mn_tai',  name: '太清玉矿', icon: '💎', req: 72, time: 13.5, xp: 420, out: { id: 'ore_tai', qty: 1 } },
    { id: 'mn_jian', name: '建木玉矿', icon: '🌳', req: 78, time: 15.6,xp: 615, out: { id: 'ore_jian', qty: 1 } },
    { id: 'mn_kunlun',name:'昆仑髓脉', icon: '🏔️', req: 82, time: 16.0, xp: 620, out: { id: 'ore_kunlun', qty: 1 } },
    { id: 'mn_pan',  name: '盘古石脉', icon: '🏔️', req: 88, time: 18.2,xp: 895, out: { id: 'ore_pan',  qty: 1 } },
    { id: 'mn_wuxu', name: '无虚髓坑', icon: '🌌', req: 92, time: 20.0, xp: 1050,out: { id: 'ore_wuxu', qty: 1 } },
    { id: 'mn_hundun',name:'混沌石坑', icon: '🌌', req: 98, time: 22.0,xp: 1500,out: { id: 'ore_hundun', qty: 1 } }
  ],
  smelting: [],
  herbalism: [
    { id: 'al_ling', name: '采药 · 灵草', icon: '🌿', req: 1,  time: 1.8, xp: 6,   out: { id: 'herb', qty: 1 } },
    { id: 'al_juqi', name: '采药 · 聚气草', icon: '🍀', req: 1,  time: 2.0, xp: 7,   out: { id: 'herb_juqi', qty: 1 } },
    { id: 'al_liao', name: '采药 · 疗伤草', icon: '🌾', req: 3,  time: 2.4, xp: 10,  out: { id: 'herb_liao', qty: 1 } },
    { id: 'al_lan',  name: '采药 · 蓝萤草', icon: '🔵', req: 8,  time: 3.4, xp: 20,  out: { id: 'herb_lan', qty: 1 } },
    { id: 'al_zhuji',name: '采药 · 筑基花', icon: '🌸', req: 12, time: 4.0, xp: 28,  out: { id: 'herb_zhuji', qty: 1 } },
    { id: 'al_zi',   name: '采药 · 紫芝', icon: '🍄', req: 18, time: 4.6, xp: 48,  out: { id: 'herb_zi', qty: 1 } },
    { id: 'al_ning', name: '采药 · 凝元参', icon: '🌼', req: 22, time: 5.2, xp: 60,  out: { id: 'herb_ning', qty: 1 } },
    { id: 'al_bing', name: '采药 · 冰心草', icon: '❄️', req: 28, time: 5.8, xp: 85,  out: { id: 'herb_bing', qty: 1 } },
    { id: 'al_ying', name: '采药 · 化婴芝', icon: '🍄', req: 32, time: 6.4, xp: 110, out: { id: 'herb_ying', qty: 1 } },
    { id: 'al_yao',  name: '采药 · 妖丹花', icon: '🌺', req: 38, time: 7.2, xp: 150, out: { id: 'herb_yao', qty: 1 } },
    { id: 'al_zu',   name: '采药 · 龙须根', icon: '🌱', req: 45, time: 8.2, xp: 200, out: { id: 'herb_zu', qty: 1 } },
    { id: 'al_you',  name: '采药 · 幽兰', icon: '🌑', req: 48, time: 8.6, xp: 225, out: { id: 'herb_you', qty: 1 } },
    { id: 'al_mo',   name: '采药 · 墨灵芝', icon: '🟣', req: 52, time: 9.2, xp: 260, out: { id: 'herb_mo', qty: 1 } },
    { id: 'al_xue',  name: '采药 · 血玉参', icon: '🩸', req: 60, time: 10.5, xp: 340, out: { id: 'herb_xue', qty: 1 } },
    { id: 'al_tian', name: '采药 · 天心莲', icon: '🌸', req: 63, time: 11.4, xp: 400, out: { id: 'herb_tian', qty: 1 } },
    { id: 'al_shen', name: '采药 · 神元果', icon: '✨', req: 70, time: 12.5, xp: 480, out: { id: 'herb_shen', qty: 1 } },
    { id: 'al_shu',  name: '采药 · 扶桑花', icon: '🌅', req: 73, time: 13.6, xp: 545, out: { id: 'herb_shu', qty: 1 } },
    { id: 'al_xu',   name: '采药 · 炼虚参', icon: '🏵️', req: 78, time: 14.5, xp: 620, out: { id: 'herb_xu', qty: 1 } },
    { id: 'al_hun',  name: '采药 · 混沌草', icon: '🌌', req: 83, time: 16.0, xp: 760, out: { id: 'herb_hun', qty: 1 } },
    { id: 'al_tai',  name: '采药 · 太清芝', icon: '🍄', req: 86, time: 17.0, xp: 850, out: { id: 'herb_tai', qty: 1 } },
    { id: 'al_kunlun',name:'采药 · 昆仑莲', icon: '🌷', req: 93, time: 20.0, xp: 1250,out: { id: 'herb_kunlun', qty: 1 } },
    { id: 'al_wuxu', name: '采药 · 无虚根', icon: '🌱', req: 98, time: 24.0, xp: 1800,out: { id: 'herb_wuxu', qty: 1 } }
  ],
  alchemy: [],
  cultivation: [
    { id: 'meditate',   name: '打坐吐纳',   icon: '🧘', req: 1,  time: 2.5, xp: 12,  out: { spirit: 4,   heal: 8 } },
    { id: 'xiaozhoutian',name:'小周天运转', icon: '🌀', req: 8,  time: 3.2, xp: 18,  out: { spirit: 8,   heal: 12, id: 'qi_jing', qty: 1 } },
    { id: 'yinqi',      name: '引气入体',   icon: '💠', req: 13, time: 3.8, xp: 22,  out: { spirit: 9,   heal: 14, id: 'jing_ling', qty: 1 } },
    { id: 'guanxin',    name: '观心坐忘',   icon: '☯️', req: 20, time: 5.0, xp: 30,  out: { spirit: 12,  heal: 20 } },
    { id: 'ningshen',   name: '凝神入定',   icon: '🍎', req: 23, time: 5.4, xp: 40,  out: { spirit: 16,  heal: 28, id: 'dao_guo', qty: 1 } },
    { id: 'lianshan',   name: '炼息凝神',   icon: '💆', req: 28, time: 6.0, xp: 55,  out: { spirit: 22,  heal: 40 } },
    { id: 'lingxu',     name: '灵虚吐纳',   icon: '🌀', req: 35, time: 7.0, xp: 85,  out: { spirit: 38,  heal: 70 } },
    { id: 'xisui',      name: '洗髓伐骨',   icon: '🔴', req: 38, time: 7.4, xp: 98,  out: { spirit: 45,  heal: 85, id: 'jing_yuan', qty: 1 } },
    { id: 'taixuan',    name: '太玄观天',   icon: '🌙', req: 42, time: 8.0, xp: 125, out: { spirit: 60,  heal: 110 } },
    { id: 'wuxiang',    name: '无相坐忘',   icon: '🌫️', req: 50, time: 9.5, xp: 180, out: { spirit: 100, heal: 170 } },
    { id: 'xinshen',    name: '心神合一',   icon: '🧬', req: 53, time: 10.0,xp: 200, out: { spirit: 115, heal: 190, id: 'shen_mai', qty: 1 } },
    { id: 'tianxin',    name: '天心合道',   icon: '🌟', req: 58, time: 11.0,xp: 260, out: { spirit: 160, heal: 260 } },
    { id: 'xuanguan',   name: '玄关一窍',   icon: '⚫', req: 63, time: 12.0,xp: 330, out: { spirit: 200, heal: 320, id: 'xuan_zhu', qty: 1 } },
    { id: 'shenmo',     name: '神魔分界',   icon: '🔥', req: 66, time: 13.0,xp: 380, out: { spirit: 260, heal: 400 } },
    { id: 'lingyibu',   name: '灵虚一',     icon: '🪐', req: 74, time: 15.0,xp: 540, out: { spirit: 420, heal: 620 } },
    { id: 'shenshihua', name: '神识化虚',   icon: '🕳️', req: 78, time: 16.0,xp: 640, out: { spirit: 340, heal: 520, id: 'xu_kong_jing', qty: 1 } },
    { id: 'taiji',      name: '太极归一',   icon: '☯', req: 82, time: 17.5,xp: 780, out: { spirit: 680, heal: 950 } },
    { id: 'tianren',    name: '天人合一',   icon: '🌟', req: 88, time: 19.5,xp: 1000,out: { spirit: 850, heal: 1200, id: 'tian_dao', qty: 1 } },
    { id: 'kunlun',     name: '昆仑心法',   icon: '🏔️', req: 90, time: 20.5,xp: 1150,out: { spirit: 1080,heal: 1500 } },
    { id: 'wanfa',      name: '万法归一',   icon: '📜', req: 93, time: 22.0,xp: 1400,out: { spirit: 1300,heal: 1900, id: 'fa_ze', qty: 1 } },
    { id: 'taixuan_wuxu',name:'太玄无虚心法',icon: '🌌', req: 97, time: 24.0,xp: 1750,out: { spirit: 1700,heal: 2400 } }
  ],
  formation: [
    { id: 'ob_qiyao', name: '观星 · 七曜', icon: '🌟', req: 1,  time: 3.0, xp: 10,  out: { stardust: 3 } },
    { id: 'ob_ziwei', name: '观星 · 紫微', icon: '🔭', req: 8,  time: 4.5, xp: 28,  out: { stardust: 10 } },
    { id: 'ob_xuanji',name: '观星 · 璇玑', icon: '✨', req: 13, time: 5.5, xp: 50,  out: { stardust: 20 } },
    { id: 'ob_huntian',name:'观星 · 浑天', icon: '🌠', req: 16, time: 6.0, xp: 68,  out: { stardust: 30 } },
    { id: 'ob_taiwei',name: '观星 · 太微', icon: '🌜', req: 23, time: 7.2, xp: 148, out: { stardust: 80 } },
    { id: 'ob_zhoutian',name:'观星 · 周天', icon: '🌌', req: 24, time: 7.5, xp: 160, out: { stardust: 88 } },
    { id: 'ob_tianshi',name:'观星 · 天市', icon: '🏮', req: 28, time: 8.2, xp: 210, out: { stardust: 120 } },
    { id: 'ob_taixuan',name:'观星 · 太玄', icon: '🌙', req: 32, time: 9.0, xp: 260, out: { stardust: 180 } },
    { id: 'ob_bagua',  name: '观星 · 八卦', icon: '☯️', req: 40, time: 10.5, xp: 420, out: { stardust: 320 } },
    { id: 'ob_ziwei2', name: '观星 · 紫微垣', icon: '🪐', req: 44, time: 11.2, xp: 520, out: { stardust: 430 } },
    { id: 'ob_nine',   name: '观星 · 九宫', icon: '📐', req: 50, time: 12.5, xp: 680, out: { stardust: 550 } },
    { id: 'ob_luotian',name:'观星 · 罗天', icon: '🌀', req: 53, time: 13.2, xp: 800, out: { stardust: 720 } },
    { id: 'ob_dayan',  name: '观星 · 大衍', icon: '🔢', req: 58, time: 14.2, xp: 1000,out: { stardust: 950 } },
    { id: 'ob_taiji',  name: '观星 · 太极', icon: '✨', req: 62, time: 15.0, xp: 1200,out: { stardust: 1000 } },
    { id: 'ob_lingxu', name: '观星 · 灵虚', icon: '🪐', req: 70, time: 17.5, xp: 1750,out: { stardust: 1600 } },
    { id: 'ob_dongxu', name: '观星 · 洞虚', icon: '🕳️', req: 73, time: 18.6, xp: 2100,out: { stardust: 2100 } },
    { id: 'ob_taiyuan',name:'观星 · 太原', icon: '💠', req: 78, time: 20.0, xp: 2500,out: { stardust: 2500 } },
    { id: 'ob_taichu', name: '观星 · 太初', icon: '🌠', req: 83, time: 21.6, xp: 3000,out: { stardust: 3300 } },
    { id: 'ob_kunlun', name: '观星 · 昆仑', icon: '🏔️', req: 88, time: 23.5, xp: 3800,out: { stardust: 4200 } },
    { id: 'ob_wuji',   name: '观星 · 无极', icon: '♾️', req: 93, time: 25.6, xp: 4700,out: { stardust: 5600 } },
    { id: 'ob_wuxu',   name: '观星 · 无虚', icon: '🌌', req: 97, time: 28.0, xp: 5800,out: { stardust: 7000 } }
  ],
  thieving: [
    { id: 'job_farmer', name: '农户帮工', icon: '👨‍🌾', req: 1,  time: 3.0, xp: 10,  rate: 0.78, gold: [3, 8],   fine: 5,  dmg: 2, stun: 3,   loot: [{ id: 'rice', chance: 0.55, qty: 1 }] },
    { id: 'job_fisher', name: '渔行伙计', icon: '🛶', req: 4,  time: 3.0, xp: 14,  rate: 0.76, gold: [5, 12],  fine: 8,  dmg: 3, stun: 3,   loot: [{ id: 'fish_qing', chance: 0.45, qty: 1 }, { id: 'fish_ling', chance: 0.12, qty: 1 }] },
    { id: 'job_smith',  name: '铁铺学徒', icon: '⚒️', req: 8,  time: 3.2, xp: 20,  rate: 0.74, gold: [8, 17],  fine: 12, dmg: 4, stun: 3,   loot: [{ id: 'ore_iron', chance: 0.40, qty: 1 }, { id: 'ingot_iron', chance: 0.15, qty: 1 }] },
    { id: 'job_tavern', name: '酒楼跑堂', icon: '🍶', req: 12, time: 3.2, xp: 28,  rate: 0.72, gold: [12, 25], fine: 18, dmg: 5, stun: 3,   loot: [{ id: 'wine', chance: 0.45, qty: 1 }, { id: 'herb', chance: 0.12, qty: 1 }] },
    { id: 'job_apoth',  name: '药铺学徒', icon: '💊', req: 16, time: 3.4, xp: 40,  rate: 0.70, gold: [18, 36], fine: 24, dmg: 6, stun: 3.5, loot: [{ id: 'herb_juqi', chance: 0.35, qty: 1 }, { id: 'herb_liao', chance: 0.18, qty: 1 }, { id: 'seed_juqi', chance: 0.08, qty: 1 }] },
    { id: 'job_weaver', name: '织坊帮工', icon: '🧵', req: 21, time: 3.4, xp: 56,  rate: 0.68, gold: [26, 50], fine: 32, dmg: 7, stun: 3.5, loot: [{ id: 'cloth', chance: 0.45, qty: 1 }, { id: 'hide', chance: 0.15, qty: 1 }] },
    { id: 'job_guard',  name: '行商护卫', icon: '🐫', req: 26, time: 3.6, xp: 78,  rate: 0.66, gold: [42, 88], fine: 45, dmg: 8, stun: 4,   loot: [{ id: 'cloth', chance: 0.25, qty: 1 }, { id: 'painting', chance: 0.08, qty: 1 }] },
    { id: 'job_scribe', name: '书院抄手', icon: '📖', req: 31, time: 3.6, xp: 105, rate: 0.64, gold: [58, 120],fine: 60, dmg: 9, stun: 4,   loot: [{ id: 'painting', chance: 0.35, qty: 1 }, { id: 'pill_juqi', chance: 0.07, qty: 1 }] },
    { id: 'job_steward',name: '钱庄管事', icon: '💰', req: 36, time: 3.8, xp: 140, rate: 0.62, gold: [85, 175],fine: 80, dmg: 10, stun: 4,  loot: [{ id: 'cloth', chance: 0.22, qty: 1 }, { id: 'painting', chance: 0.18, qty: 1 }, { id: 'pill_liao', chance: 0.08, qty: 1 }] },
    { id: 'job_tea',    name: '茶坊小二', icon: '🍵', req: 5,  time: 3.0, xp: 13,  rate: 0.77, gold: [4, 10],  fine: 6,  dmg: 2, stun: 3,   loot: [{ id: 'tea', chance: 0.50, qty: 1 }, { id: 'herb', chance: 0.18, qty: 1 }] },
    { id: 'job_book',   name: '书摊伙计', icon: '📚', req: 9,  time: 3.0, xp: 22,  rate: 0.72, gold: [6, 15],  fine: 10, dmg: 3, stun: 3,   loot: [{ id: 'book', chance: 0.48, qty: 1 }] },
    { id: 'job_antique',name: '古玩跑腿', icon: '🟢', req: 14, time: 3.2, xp: 34,  rate: 0.70, gold: [14, 30], fine: 20, dmg: 5, stun: 3,   loot: [{ id: 'jade', chance: 0.40, qty: 1 }, { id: 'painting', chance: 0.10, qty: 1 }] },
    { id: 'job_mariner',name: '海港船工', icon: '⚓', req: 19, time: 3.4, xp: 50,  rate: 0.68, gold: [22, 45], fine: 28, dmg: 6, stun: 3.5, loot: [{ id: 'fish_ling', chance: 0.40, qty: 1 }, { id: 'hide', chance: 0.12, qty: 1 }] },
    { id: 'job_silk',   name: '云锦采买', icon: '🎀', req: 24, time: 3.6, xp: 72,  rate: 0.66, gold: [38, 75], fine: 38, dmg: 7, stun: 3.5, loot: [{ id: 'silk', chance: 0.42, qty: 1 }, { id: 'cloth', chance: 0.20, qty: 1 }] },
    { id: 'job_astro',  name: '相术学徒', icon: '🔮', req: 30, time: 3.8, xp: 100, rate: 0.63, gold: [55, 110],fine: 55, dmg: 9, stun: 4,   loot: [{ id: 'scroll', chance: 0.35, qty: 1 }, { id: 'ore_ling', chance: 0.15, qty: 1 }] },
    { id: 'job_puzi',   name: '符铺帮工', icon: '📜', req: 38, time: 4.0, xp: 145, rate: 0.60, gold: [80, 160],fine: 75, dmg: 10,stun: 4,   loot: [{ id: 'scroll', chance: 0.42, qty: 1 }, { id: 'herb_bing', chance: 0.12, qty: 1 }] },
    { id: 'job_fighting',name:'镖局趟子手',icon: '🐫', req: 45, time: 4.2, xp: 200, rate: 0.58, gold: [130, 260],fine: 110,dmg: 12,stun: 5,   loot: [{ id: 'hide', chance: 0.50, qty: 2 }, { id: 'ore_bing', chance: 0.15, qty: 1 }] },
    { id: 'job_moneylender',name:'放贷经纪',icon: '🏦', req: 48, time: 4.4, xp: 230, rate: 0.57, gold: [170, 340],fine: 130,dmg: 12,stun: 5,   loot: [{ id: 'scroll', chance: 0.35, qty: 1 }, { id: 'jade', chance: 0.25, qty: 1 }, { id: 'pill_liao', chance: 0.06, qty: 1 }] },
    { id: 'job_demonslayer',name:'猎妖赏金', icon: '👹', req: 55, time: 5.0, xp: 300, rate: 0.55, gold: [220, 480],fine: 180,dmg: 14,stun: 5,   loot: [{ id: 'herb_ying', chance: 0.22, qty: 1 }, { id: 'ingot_yang', chance: 0.10, qty: 1 }] },
    { id: 'job_court',  name: '宫廷内侍', icon: '🏯', req: 58, time: 5.2, xp: 340, rate: 0.54, gold: [260, 540],fine: 200,dmg: 15,stun: 5.5, loot: [{ id: 'painting', chance: 0.35, qty: 1 }, { id: 'silk', chance: 0.25, qty: 1 }, { id: 'herb_zi', chance: 0.10, qty: 1 }] },
    { id: 'job_imperial',name: '御膳房偷师', icon: '🏯', req: 62, time: 5.5, xp: 420, rate: 0.52, gold: [320, 680],fine: 260,dmg: 16,stun: 5.5, loot: [{ id: 'herb_shen', chance: 0.08, qty: 1 }, { id: 'ingot_shen', chance: 0.05, qty: 1 }, { id: 'pill_wudao', chance: 0.04, qty: 1 }] },
    { id: 'job_lingxu', name: '灵虚坊采买', icon: '🌀', req: 70, time: 6.0, xp: 600, rate: 0.48, gold: [480, 1000],fine: 380,dmg: 18,stun: 6,   loot: [{ id: 'ore_xu', chance: 0.20, qty: 1 }, { id: 'herb_xue', chance: 0.15, qty: 1 }, { id: 'pill_shen_cult', chance: 0.02, qty: 1 }] },
    { id: 'job_immortal',name:'仙门杂役', icon: '⛩️', req: 73, time: 6.4, xp: 700, rate: 0.45, gold: [560, 1200],fine: 420,dmg: 20,stun: 6,   loot: [{ id: 'ore_you', chance: 0.18, qty: 1 }, { id: 'herb_you', chance: 0.12, qty: 1 }, { id: 'pill_mo', chance: 0.03, qty: 1 }] },
    { id: 'job_taiyuan',name: '太玄宗道童', icon: '💠', req: 80, time: 7.0, xp: 900, rate: 0.42, gold: [700, 1500],fine: 560,dmg: 22,stun: 6.5, loot: [{ id: 'ore_tai', chance: 0.18, qty: 1 }, { id: 'herb_tai', chance: 0.10, qty: 1 }, { id: 'pill_tai', chance: 0.015, qty: 1 }] },
    { id: 'job_demon',  name: '魔道卧底', icon: '👹', req: 83, time: 7.2, xp: 1000,rate: 0.40, gold: [900, 1900],fine: 640,dmg: 24,stun: 6.5, loot: [{ id: 'ore_shu', chance: 0.16, qty: 1 }, { id: 'herb_hun', chance: 0.10, qty: 1 }, { id: 'pill_xue', chance: 0.03, qty: 1 }] },
    { id: 'job_kunlun', name: '昆仑执事', icon: '🏔️', req: 90, time: 8.0, xp: 1400,rate: 0.36, gold: [1100,2500],fine: 850,dmg: 28,stun: 7,   loot: [{ id: 'ore_kunlun', chance: 0.15, qty: 1 }, { id: 'herb_kunlun', chance: 0.08, qty: 1 }, { id: 'pill_kunlun', chance: 0.01, qty: 1 }] },
    { id: 'job_heaven', name: '天庭信使', icon: '☁️', req: 93, time: 8.4, xp: 1600,rate: 0.33, gold: [1600,3400],fine: 1100,dmg: 30,stun: 7.5, loot: [{ id: 'ore_pan', chance: 0.14, qty: 1 }, { id: 'lian_zi', chance: 0.08, qty: 1 }, { id: 'pill_kunlun', chance: 0.012, qty: 1 }] },
    { id: 'job_wuxu',   name: '无虚使者', icon: '🌌', req: 98, time: 9.5, xp: 2200,rate: 0.28, gold: [1800,4200],fine: 1400,dmg: 36,stun: 8,   loot: [{ id: 'ore_wuxu', chance: 0.12, qty: 1 }, { id: 'herb_wuxu', chance: 0.05, qty: 1 }, { id: 'pill_wuxu', chance: 0.006, qty: 1 }] }
  ]
};

/* =========================================================================
 * 配方（有消耗）  cat: smelt 熔炼 / forge 锻造 / pill 丹方
 * ========================================================================= */
const RECIPES = {
  smelting: [
    /* === 熔炼 smelt === */
    { id: 'sm_iron',  cat: 'smelt', name: '熔炼 · 铁锭', icon: '🔩', req: 1,  time: 2.0, xp: 7,   in: [{ id: 'ore_iron', qty: 3 }], out: { id: 'ingot_iron', qty: 1 } },
    { id: 'sm_xuan',  cat: 'smelt', name: '熔炼 · 玄铁锭', icon: '⚙️', req: 6,  time: 3.6, xp: 20,  in: [{ id: 'ore_xuan', qty: 3 }], out: { id: 'ingot_xuan', qty: 1 } },
    { id: 'sm_bing',  cat: 'smelt', name: '熔炼 · 冰魄锭', icon: '🧊', req: 24, time: 5.5, xp: 72,  in: [{ id: 'ore_bing', qty: 3 }], out: { id: 'ingot_bing', qty: 1 } },
    { id: 'sm_yang',  cat: 'smelt', name: '熔炼 · 阳火锭', icon: '🔥', req: 36, time: 7.0, xp: 130, in: [{ id: 'ore_yang', qty: 3 }], out: { id: 'ingot_yang', qty: 1 } },
    { id: 'sm_shen',  cat: 'smelt', name: '熔炼 · 神玉锭', icon: '💠', req: 52, time: 9.5, xp: 240, in: [{ id: 'ore_shen', qty: 3 }], out: { id: 'ingot_shen', qty: 1 } },
    { id: 'sm_xu',    cat: 'smelt', name: '熔炼 · 炼虚锭', icon: '🌑', req: 62, time: 12.0, xp: 360, in: [{ id: 'ore_xu', qty: 3 }], out: { id: 'ingot_xu', qty: 1 } },
    { id: 'sm_tai',   cat: 'smelt', name: '熔炼 · 太清锭', icon: '💠', req: 72, time: 14.5, xp: 520, in: [{ id: 'ore_tai', qty: 3 }], out: { id: 'ingot_tai', qty: 1 } },
    { id: 'sm_kunlun',cat: 'smelt', name: '熔炼 · 昆仑锭', icon: '🏔️', req: 82, time: 18.0, xp: 780, in: [{ id: 'ore_kunlun', qty: 3 }], out: { id: 'ingot_kunlun', qty: 1 } },
    { id: 'sm_wuxu',  cat: 'smelt', name: '熔炼 · 无虚锭', icon: '🌌', req: 92, time: 22.5, xp: 1200,in: [{ id: 'ore_wuxu', qty: 3 }], out: { id: 'ingot_wuxu', qty: 1 } },
    { id: 'sm_zi',    cat: 'smelt', name: '熔炼 · 紫金锭', icon: '🟣', req: 18, time: 5.0, xp: 46, in: [{ id: 'ore_zi', qty: 3 }, { id: 'log_han', qty: 1 }], out: { id: 'ingot_zi', qty: 1 } },
    { id: 'sm_lan',   cat: 'smelt', name: '熔炼 · 蓝晶锭', icon: '🔵', req: 28, time: 6.4, xp: 90, in: [{ id: 'ore_lan', qty: 3 }, { id: 'log_lan', qty: 1 }], out: { id: 'ingot_lan', qty: 1 } },
    { id: 'sm_lei',   cat: 'smelt', name: '熔炼 · 雷银锭', icon: '⚡', req: 33, time: 7.2, xp: 118, in: [{ id: 'ore_lei', qty: 3 }, { id: 'log_lei', qty: 1 }], out: { id: 'ingot_lei', qty: 1 } },
    { id: 'sm_you',   cat: 'smelt', name: '熔炼 · 幽铁锭', icon: '🌑', req: 43, time: 8.8, xp: 172, in: [{ id: 'ore_you', qty: 3 }, { id: 'log_you', qty: 1 }], out: { id: 'ingot_you', qty: 1 } },
    { id: 'sm_gui',   cat: 'smelt', name: '熔炼 · 鬼银锭', icon: '👻', req: 48, time: 9.6, xp: 214, in: [{ id: 'ore_gui', qty: 3 }, { id: 'log_you', qty: 2 }], out: { id: 'ingot_gui', qty: 1 } },
    { id: 'sm_tian',  cat: 'smelt', name: '熔炼 · 天青锭', icon: '💠', req: 58, time: 11.4, xp: 306, in: [{ id: 'ore_tian', qty: 3 }, { id: 'log_tian', qty: 1 }], out: { id: 'ingot_tian', qty: 1 } },
    { id: 'sm_shu',   cat: 'smelt', name: '熔炼 · 扶桑锭', icon: '🌅', req: 68, time: 13.2, xp: 430, in: [{ id: 'ore_shu', qty: 3 }, { id: 'log_shu', qty: 1 }], out: { id: 'ingot_shu', qty: 1 } },
    { id: 'sm_jian',  cat: 'smelt', name: '熔炼 · 建木锭', icon: '🌳', req: 78, time: 15.8, xp: 610, in: [{ id: 'ore_jian', qty: 3 }, { id: 'log_jian', qty: 1 }], out: { id: 'ingot_jian', qty: 1 } },
    { id: 'sm_pan',   cat: 'smelt', name: '熔炼 · 盘古锭', icon: '🏔️', req: 88, time: 18.6, xp: 890, in: [{ id: 'ore_pan', qty: 3 }, { id: 'log_pan', qty: 1 }], out: { id: 'ingot_pan', qty: 1 } },
    { id: 'sm_hundun',cat: 'smelt', name: '熔炼 · 混沌锭', icon: '🌌', req: 98, time: 22.8, xp: 1500,in: [{ id: 'ore_hundun', qty: 3 }, { id: 'log_hundun', qty: 1 }], out: { id: 'ingot_hundun', qty: 1 } },
    /* --- 修炼产物 → 灵力（修炼 ↔ 炼器联动） --- */
    { id: 'sm_qi',    cat: 'smelt', name: '聚灵 · 气晶',  icon: '💠', req: 8,  time: 2.0, xp: 10,  in: [{ id: 'qi_jing', qty: 2 }], out: { spirit: 100 } },
    { id: 'sm_jing',  cat: 'smelt', name: '聚灵 · 灵晶',  icon: '💠', req: 13, time: 2.4, xp: 20,  in: [{ id: 'jing_ling', qty: 2 }], out: { spirit: 260 } },
    { id: 'sm_daoguo',cat: 'smelt', name: '聚灵 · 道果',  icon: '🍎', req: 23, time: 3.2, xp: 52,  in: [{ id: 'dao_guo', qty: 2 }], out: { spirit: 700 } },
    { id: 'sm_jingyuan',cat:'smelt',name: '聚灵 · 精元',  icon: '🔴', req: 38, time: 4.6, xp: 120, in: [{ id: 'jing_yuan', qty: 2 }], out: { spirit: 2000 } },
    { id: 'sm_shenmai',cat: 'smelt', name: '聚灵 · 神脉',  icon: '🧬', req: 53, time: 6.2, xp: 240, in: [{ id: 'shen_mai', qty: 2 }], out: { spirit: 6000 } },
    { id: 'sm_xuanzhu',cat: 'smelt', name: '聚灵 · 玄珠',  icon: '⚫', req: 63, time: 8.0, xp: 400, in: [{ id: 'xuan_zhu', qty: 2 }], out: { spirit: 15000 } },
    { id: 'sm_xukong',cat: 'smelt', name: '聚灵 · 虚空晶',icon: '🕳️', req: 78, time: 10.5,xp: 640, in: [{ id: 'xu_kong_jing', qty: 2 }], out: { spirit: 40000 } },
    { id: 'sm_tiandao',cat: 'smelt', name: '聚灵 · 天道印',icon: '🌟', req: 88, time: 13.0,xp: 920, in: [{ id: 'tian_dao', qty: 2 }], out: { spirit: 100000 } },
    { id: 'sm_douhun',cat: 'smelt', name: '聚灵 · 混沌豆',icon: '🥜', req: 73, time: 9.6, xp: 520, in: [{ id: 'dou_hun', qty: 2 }], out: { spirit: 30000 } },
    { id: 'sm_lian',  cat: 'smelt', name: '聚灵 · 道莲',  icon: '🌷', req: 83, time: 11.8,xp: 780, in: [{ id: 'lian_zi', qty: 2 }], out: { spirit: 80000 } },
    { id: 'sm_stone', cat: 'smelt', name: '提炼 · 灵石', icon: '💠', req: 14, time: 2.2, xp: 15,  in: [{ id: 'ore_ling', qty: 3 }], out: { gold: 50 } },
    { id: 'sm_spirit',cat: 'smelt', name: '聚灵 · 化灵力', icon: '✨', req: 14, time: 1.5, xp: 5,   in: [{ id: 'ore_ling', qty: 1 }], out: { spirit: 60 } },
    { id: 'sm_tie',   cat: 'smelt', name: '熔炼 · 铁木汁', icon: '🌳', req: 15, time: 4.5, xp: 36,  in: [{ id: 'log_tie', qty: 2 }, { id: 'ore_ling', qty: 1 }], out: { id: 'ingot_iron', qty: 3 } },
  ],
  crafting: [    /* --- 灵植产物 → 布料 / 灵力（灵植 ↔ 炼器联动） --- */
    { id: 'fg_weave', cat: 'forge', name: '织造 · 云锦',  icon: '🎀', req: 23, time: 4.0, xp: 44,  in: [{ id: 'yun_mian', qty: 3 }, { id: 'hide', qty: 2 }], out: { id: 'cloth', qty: 2 } },

    /* === 基础锻造 forge（铁/玄铁/冰魄/阳火/神玉五档） === */
    { id: 'fg_sword',  cat: 'forge', name: '锻造 · 铁剑',    icon: '🗡️', req: 2,  time: 3.0, xp: 14,  in: [{ id: 'ingot_iron', qty: 3 }, { id: 'log_qing', qty: 2 }], out: { id: 'w_tie',  qty: 1 } },
    { id: 'fg_armor',  cat: 'forge', name: '锻造 · 铁甲',    icon: '🛡️', req: 3,  time: 3.5, xp: 18,  in: [{ id: 'ingot_iron', qty: 4 }, { id: 'hide', qty: 2 }],      out: { id: 'a_tie',  qty: 1 } },
    { id: 'fg_htie',   cat: 'forge', name: '锻造 · 铁冠',    icon: '⛑️', req: 4,  time: 3.2, xp: 16,  in: [{ id: 'ingot_iron', qty: 3 }, { id: 'hide', qty: 1 }],      out: { id: 'h_tie',  qty: 1 } },
    { id: 'fg_btie',   cat: 'forge', name: '锻造 · 布靴',    icon: '🥾', req: 3,  time: 2.6, xp: 13,  in: [{ id: 'hide', qty: 3 }, { id: 'log_qing', qty: 2 }],          out: { id: 'b_tie',  qty: 1 } },
    { id: 'fg_rtie',   cat: 'forge', name: '锻造 · 铁戒',    icon: '💍', req: 5,  time: 3.0, xp: 15,  in: [{ id: 'ingot_iron', qty: 2 }, { id: 'ore_ling', qty: 1 }],  out: { id: 'r_tie',  qty: 1 } },
    { id: 'fg_xsword', cat: 'forge', name: '锻造 · 玄铁剑',  icon: '⚔️', req: 9,  time: 5.5, xp: 48,  in: [{ id: 'ingot_xuan', qty: 4 }, { id: 'log_han', qty: 3 }],   out: { id: 'w_xuan', qty: 1 } },
    { id: 'fg_xarmor', cat: 'forge', name: '锻造 · 玄铁甲',  icon: '🥋', req: 11, time: 6.0, xp: 60,  in: [{ id: 'ingot_xuan', qty: 5 }, { id: 'hide', qty: 5 }],      out: { id: 'a_xuan', qty: 1 } },
    { id: 'fg_xhtie',  cat: 'forge', name: '锻造 · 玄铁冠',  icon: '👑', req: 12, time: 5.2, xp: 52,  in: [{ id: 'ingot_xuan', qty: 4 }, { id: 'hide', qty: 3 }],      out: { id: 'h_xuan', qty: 1 } },
    { id: 'fg_bfly',   cat: 'forge', name: '锻造 · 疾风靴',  icon: '👢', req: 13, time: 5.0, xp: 50,  in: [{ id: 'hide', qty: 6 }, { id: 'log_han', qty: 4 }, { id: 'ore_ling', qty: 3 }], out: { id: 'b_fly', qty: 1 } },
    { id: 'fg_rxuan',  cat: 'forge', name: '锻造 · 玄铁戒',  icon: '💎', req: 12, time: 4.6, xp: 44,  in: [{ id: 'ingot_xuan', qty: 3 }, { id: 'ore_ling', qty: 4 }],  out: { id: 'r_xuan', qty: 1 } },
    { id: 'fg_jade',   cat: 'forge', name: '锻造 · 灵玉佩',  icon: '🧿', req: 14, time: 7.0, xp: 85,  in: [{ id: 'ingot_xuan', qty: 3 }, { id: 'ore_ling', qty: 4 }, { id: 'herb', qty: 5 }], out: { id: 't_ling', qty: 1 } },
    { id: 'fg_jupei',  cat: 'forge', name: '锻造 · 聚灵佩',  icon: '📿', req: 18, time: 8.0, xp: 110, in: [{ id: 'ingot_xuan', qty: 5 }, { id: 'ore_ling', qty: 8 }, { id: 'herb', qty: 5 }], out: { id: 't_ju', qty: 1 } },
    { id: 'fg_fly',    cat: 'forge', name: '锻造 · 御风剑',  icon: '🌀', req: 20, time: 9.0, xp: 140, in: [{ id: 'ingot_xuan', qty: 6 }, { id: 'log_tie', qty: 4 }, { id: 'ore_ling', qty: 6 }], out: { id: 'w_fly', qty: 1 } },

    /* === 高阶锻造 forge: 冰魄 / 阳火 / 神玉 === */
    { id: 'fg_bsword', cat: 'forge', name: '锻造 · 冰魄剑',  icon: '❄️', req: 28, time: 9.5, xp: 180, in: [{ id: 'ingot_bing', qty: 4 }, { id: 'log_bing', qty: 3 }, { id: 'ore_bing', qty: 2 }], out: { id: 'w_bing', qty: 1 } },
    { id: 'fg_barmor', cat: 'forge', name: '锻造 · 冰魄甲',  icon: '🧊', req: 30, time: 10.0, xp: 200, in: [{ id: 'ingot_bing', qty: 5 }, { id: 'hide', qty: 4 }, { id: 'ore_bing', qty: 3 }], out: { id: 'a_bing', qty: 1 } },
    { id: 'fg_bhelmet',cat: 'forge', name: '锻造 · 冰魄冠',  icon: '❄️', req: 32, time: 9.0, xp: 170, in: [{ id: 'ingot_bing', qty: 4 }, { id: 'hide', qty: 3 }, { id: 'ore_bing', qty: 2 }], out: { id: 'h_bing', qty: 1 } },
    { id: 'fg_bboots', cat: 'forge', name: '锻造 · 冰履',    icon: '🧊', req: 30, time: 8.2, xp: 150, in: [{ id: 'hide', qty: 5 }, { id: 'ore_bing', qty: 4 }, { id: 'log_bing', qty: 3 }], out: { id: 'b_bing', qty: 1 } },
    { id: 'fg_bring',  cat: 'forge', name: '锻造 · 冰魄戒',  icon: '💎', req: 28, time: 8.0, xp: 140, in: [{ id: 'ingot_bing', qty: 3 }, { id: 'ore_bing', qty: 4 }],  out: { id: 'r_bing', qty: 1 } },
    { id: 'fg_bamulet',cat: 'forge', name: '锻造 · 冰心佩',  icon: '🧿', req: 34, time: 11.5, xp: 260, in: [{ id: 'ingot_bing', qty: 3 }, { id: 'ore_bing', qty: 6 }, { id: 'herb_bing', qty: 3 }], out: { id: 't_bing', qty: 1 } },

    { id: 'fg_ysword', cat: 'forge', name: '锻造 · 阳火剑',  icon: '🔥', req: 42, time: 12.0, xp: 280, in: [{ id: 'ingot_yang', qty: 4 }, { id: 'ore_yang', qty: 2 }, { id: 'log_tie', qty: 4 }], out: { id: 'w_yang', qty: 1 } },
    { id: 'fg_yarmor', cat: 'forge', name: '锻造 · 阳火甲',  icon: '🥋', req: 44, time: 12.5, xp: 320, in: [{ id: 'ingot_yang', qty: 5 }, { id: 'hide', qty: 5 }, { id: 'ore_yang', qty: 3 }], out: { id: 'a_yang', qty: 1 } },
    { id: 'fg_yhelmet',cat: 'forge', name: '锻造 · 阳火冠',  icon: '👑', req: 46, time: 11.5, xp: 290, in: [{ id: 'ingot_yang', qty: 4 }, { id: 'hide', qty: 3 }, { id: 'ore_yang', qty: 2 }], out: { id: 'h_yang', qty: 1 } },
    { id: 'fg_yboots', cat: 'forge', name: '锻造 · 踏炎靴',  icon: '👢', req: 44, time: 10.5, xp: 240, in: [{ id: 'hide', qty: 5 }, { id: 'ore_yang', qty: 4 }, { id: 'log_yun', qty: 3 }], out: { id: 'b_yang', qty: 1 } },
    { id: 'fg_yring',  cat: 'forge', name: '锻造 · 阳火戒',  icon: '💎', req: 42, time: 10.0, xp: 220, in: [{ id: 'ingot_yang', qty: 3 }, { id: 'ore_yang', qty: 4 }],  out: { id: 'r_yang', qty: 1 } },
    { id: 'fg_yamulet',cat: 'forge', name: '锻造 · 阳火佩',  icon: '📿', req: 48, time: 14.0, xp: 380, in: [{ id: 'ingot_yang', qty: 3 }, { id: 'ore_yang', qty: 6 }, { id: 'herb_yao', qty: 3 }], out: { id: 't_yang', qty: 1 } },

    { id: 'fg_ssword', cat: 'forge', name: '锻造 · 神玉剑',  icon: '⚡', req: 62, time: 18.0, xp: 580, in: [{ id: 'ingot_shen', qty: 4 }, { id: 'log_shen', qty: 3 }, { id: 'ore_shen', qty: 2 }], out: { id: 'w_shen', qty: 1 } },
    { id: 'fg_sarmor', cat: 'forge', name: '锻造 · 神玉甲',  icon: '🌈', req: 64, time: 18.5, xp: 640, in: [{ id: 'ingot_shen', qty: 5 }, { id: 'hide', qty: 6 }, { id: 'ore_shen', qty: 3 }], out: { id: 'a_shen', qty: 1 } },
    { id: 'fg_shelmet',cat: 'forge', name: '锻造 · 神玉冠',  icon: '✨', req: 66, time: 17.0, xp: 580, in: [{ id: 'ingot_shen', qty: 4 }, { id: 'hide', qty: 3 }, { id: 'ore_shen', qty: 2 }], out: { id: 'h_shen', qty: 1 } },
    { id: 'fg_sboots', cat: 'forge', name: '锻造 · 云虚步',  icon: '☁️', req: 64, time: 16.0, xp: 520, in: [{ id: 'hide', qty: 6 }, { id: 'ore_shen', qty: 4 }, { id: 'log_yun', qty: 3 }], out: { id: 'b_shen', qty: 1 } },
    { id: 'fg_sring',  cat: 'forge', name: '锻造 · 神玉戒',  icon: '💎', req: 62, time: 15.0, xp: 480, in: [{ id: 'ingot_shen', qty: 3 }, { id: 'ore_shen', qty: 4 }],  out: { id: 'r_shen', qty: 1 } },
    { id: 'fg_samulet',cat: 'forge', name: '锻造 · 神元佩',  icon: '📿', req: 68, time: 20.0, xp: 720, in: [{ id: 'ingot_shen', qty: 3 }, { id: 'ore_shen', qty: 6 }, { id: 'herb_shen', qty: 2 }], out: { id: 't_shen', qty: 1 } },
    { id: 'fg_zsword', cat: 'forge', name: '锻造 · 紫檀剑',  icon: '🗡️', req: 18, time: 5.6, xp: 50, in: [{ id: 'ingot_zi', qty: 3 }, { id: 'log_zi', qty: 2 }], out: { id: 'w_zi', qty: 1 } },
    { id: 'fg_jsword', cat: 'forge', name: '锻造 · 建木剑',  icon: '🌳', req: 78, time: 22.0, xp: 860, in: [{ id: 'ingot_jian', qty: 3 }, { id: 'log_jian', qty: 3 }, { id: 'ingot_kunlun', qty: 2 }], out: { id: 'w_jian', qty: 1 } },
    { id: 'fg_tarmor', cat: 'forge', name: '锻造 · 天穹甲',  icon: '🌈', req: 80, time: 23.0, xp: 920, in: [{ id: 'ingot_tian', qty: 4 }, { id: 'log_tian', qty: 2 }, { id: 'ingot_shu', qty: 2 }], out: { id: 'a_tian', qty: 1 } },
    { id: 'fg_phelmet',cat: 'forge', name: '锻造 · 盘古冠',  icon: '🏔️', req: 88, time: 26.0, xp: 1240,in: [{ id: 'ingot_pan', qty: 3 }, { id: 'log_pan', qty: 2 }, { id: 'ingot_jian', qty: 2 }], out: { id: 'h_pan', qty: 1 } },
    { id: 'fg_hrung',  cat: 'forge', name: '锻造 · 混沌戒',  icon: '🌌', req: 98, time: 30.0, xp: 1900,in: [{ id: 'ingot_hundun', qty: 3 }, { id: 'log_hundun', qty: 2 }, { id: 'fa_ze', qty: 1 }], out: { id: 'r_hundun', qty: 1 } },
    /* 补档过渡装备（填补拆分后的 20 档缺口） */
    { id: 'fg_you',    cat: 'forge', name: '锻造 · 玄冥剑',  icon: '🌑', req: 38, time: 11.0, xp: 250, in: [{ id: 'ingot_you', qty: 3 }, { id: 'ingot_gui', qty: 2 }, { id: 'hide', qty: 3 }], out: { id: 'w_you', qty: 1 } },
    { id: 'fg_gui',    cat: 'forge', name: '锻造 · 幽铁甲',  icon: '🌑', req: 52, time: 13.5, xp: 360, in: [{ id: 'ingot_gui', qty: 4 }, { id: 'hide', qty: 6 }, { id: 'ingot_you', qty: 2 }], out: { id: 'a_gui', qty: 1 } },
    { id: 'fg_wtian',  cat: 'forge', name: '锻造 · 天穹剑',  icon: '🗡️', req: 56, time: 14.5, xp: 400, in: [{ id: 'ingot_tian', qty: 4 }, { id: 'log_tian', qty: 3 }, { id: 'ingot_shu', qty: 2 }], out: { id: 'w_tian', qty: 1 } },
    { id: 'fg_hshu',   cat: 'forge', name: '锻造 · 扶桑冠',  icon: '🌅', req: 73, time: 18.0, xp: 620, in: [{ id: 'ingot_shu', qty: 3 }, { id: 'hide', qty: 4 }, { id: 'log_shu', qty: 2 }], out: { id: 'h_shu', qty: 1 } },
    { id: 'fg_rjian',  cat: 'forge', name: '锻造 · 建木戒',  icon: '🌳', req: 83, time: 21.0, xp: 820, in: [{ id: 'ingot_jian', qty: 3 }, { id: 'ingot_kunlun', qty: 2 }, { id: 'ore_jian', qty: 2 }], out: { id: 'r_jian', qty: 1 } },
    { id: 'fg_hkunlun',cat: 'forge', name: '锻造 · 昆仑冠',  icon: '🏔️', req: 93, time: 26.0, xp: 1400,in: [{ id: 'ingot_kunlun', qty: 4 }, { id: 'hide', qty: 6 }, { id: 'ingot_tai', qty: 2 }], out: { id: 'h_kunlun', qty: 1 } },
  ],
  alchemy: [
    /* === 基础丹药 pill === */
    { id: 'pl_juqi', cat: 'pill', name: '炼制 · 聚气丹',  icon: '🔴', req: 1,  time: 3.0, xp: 12,  in: [{ id: 'herb_juqi', qty: 2 }, { id: 'herb', qty: 1 }],          out: { id: 'pill_juqi', qty: 1 } },
    { id: 'pl_liao', cat: 'pill', name: '炼制 · 疗伤丹',  icon: '🟢', req: 1,  time: 3.0, xp: 12,  in: [{ id: 'herb_liao', qty: 2 }, { id: 'herb', qty: 1 }],           out: { id: 'pill_liao', qty: 1 } },
    { id: 'pl_zhuji',cat: 'pill', name: '炼制 · 筑基丹',  icon: '🟡', req: 14, time: 6.0, xp: 55,  in: [{ id: 'herb_zhuji', qty: 3 }, { id: 'herb', qty: 2 }, { id: 'ore_ling', qty: 2 }], out: { id: 'pill_zhuji', qty: 1 } },
    { id: 'pl_ning',  cat: 'pill', name: '炼制 · 凝元丹',  icon: '🟣', req: 22, time: 8.0, xp: 130, in: [{ id: 'herb_ning', qty: 3 }, { id: 'herb_zhuji', qty: 2 }, { id: 'ore_ling', qty: 3 }], out: { id: 'pill_ning', qty: 1 } },
    { id: 'pl_ying',  cat: 'pill', name: '炼制 · 化婴丹',  icon: '🔵', req: 32, time: 10.0,xp: 260, in: [{ id: 'herb_ying', qty: 3 }, { id: 'herb_ning', qty: 2 }, { id: 'ore_ling', qty: 5 }], out: { id: 'pill_ying', qty: 1 } },
    { id: 'pl_shen',  cat: 'pill', name: '炼制 · 化神丹',  icon: '⚪', req: 42, time: 12.0,xp: 480, in: [{ id: 'herb_ying', qty: 4 }, { id: 'herb_ning', qty: 3 }, { id: 'ingot_xuan', qty: 2 }, { id: 'ore_ling', qty: 8 }], out: { id: 'pill_shen', qty: 1 } },
    { id: 'pl_xu',    cat: 'pill', name: '炼制 · 炼虚丹',  icon: '🌑', req: 52, time: 14.0,xp: 800, in: [{ id: 'herb_ying', qty: 5 }, { id: 'herb_ning', qty: 4 }, { id: 'ingot_xuan', qty: 4 }, { id: 'ore_ling', qty: 12 }], out: { id: 'pill_xu', qty: 1 } },
    { id: 'pl_wudao', cat: 'pill', name: '炼制 · 悟道丹',  icon: '🟠', req: 22, time: 10.0,xp: 160, in: [{ id: 'herb_zhuji', qty: 3 }, { id: 'herb_ning', qty: 1 }, { id: 'ore_ling', qty: 5 }], out: { id: 'pill_wudao', qty: 1 } },

    /* === 高阶丹药 pill === */
    { id: 'pl_bing',  cat: 'pill', name: '炼制 · 冰心丹',  icon: '🧊', req: 28, time: 9.0, xp: 200, in: [{ id: 'herb_bing', qty: 3 }, { id: 'herb_juqi', qty: 2 }, { id: 'ore_bing', qty: 2 }], out: { id: 'pill_bing', qty: 1 } },
    { id: 'pl_yao',   cat: 'pill', name: '炼制 · 妖元丹',  icon: '🌺', req: 38, time: 11.0,xp: 340, in: [{ id: 'herb_yao', qty: 3 }, { id: 'herb_zhuji', qty: 2 }, { id: 'ore_bing', qty: 2 }], out: { id: 'pill_yao', qty: 1 } },
    { id: 'pl_zu',    cat: 'pill', name: '炼制 · 龙须丹',  icon: '🌟', req: 45, time: 12.5,xp: 440, in: [{ id: 'herb_zu', qty: 3 }, { id: 'herb_ying', qty: 2 }, { id: 'ore_bing', qty: 2 }], out: { id: 'pill_zu', qty: 1 } },
    { id: 'pl_ningyuan', cat: 'pill', name: '炼制 · 凝元补丹', icon: '🌼', req: 48, time: 13.0,xp: 520, in: [{ id: 'herb_ning', qty: 3 }, { id: 'herb_zu', qty: 2 }, { id: 'ore_gui', qty: 2 }], out: { id: 'pill_ningyuan', qty: 1 } },
    { id: 'pl_mo',    cat: 'pill', name: '炼制 · 化神补丹',icon: '🟣', req: 52, time: 14.0,xp: 600, in: [{ id: 'herb_mo', qty: 3 }, { id: 'herb_ning', qty: 3 }, { id: 'ore_bing', qty: 2 }], out: { id: 'pill_mo', qty: 1 } },
    { id: 'pl_xue',   cat: 'pill', name: '炼制 · 血玉丹',  icon: '🩸', req: 60, time: 16.0,xp: 900, in: [{ id: 'herb_xue', qty: 3 }, { id: 'herb_mo', qty: 2 }, { id: 'ore_yang', qty: 3 }], out: { id: 'pill_xue', qty: 1 } },
    { id: 'pl_shen2', cat: 'pill', name: '炼制 · 神元丹',  icon: '✨', req: 70, time: 20.0,xp: 1400,in: [{ id: 'herb_shen', qty: 3 }, { id: 'herb_xue', qty: 2 }, { id: 'ore_shen', qty: 2 }], out: { id: 'pill_shen_cult', qty: 1 } },
    { id: 'pl_xu_c',  cat: 'pill', name: '炼制 · 炼虚补丹',icon: '🌑', req: 78, time: 22.0,xp: 1900,in: [{ id: 'herb_xu', qty: 3 }, { id: 'herb_shen', qty: 2 }, { id: 'ingot_xu', qty: 2 }], out: { id: 'pill_xu_cult', qty: 1 } },
    { id: 'pl_tai',   cat: 'pill', name: '炼制 · 太清丹',  icon: '💠', req: 86, time: 24.5,xp: 2600,in: [{ id: 'herb_tai', qty: 3 }, { id: 'herb_xu', qty: 2 }, { id: 'ingot_tai', qty: 2 }], out: { id: 'pill_tai', qty: 1 } },
    { id: 'pl_kunlun',cat: 'pill', name: '炼制 · 昆仑丹',  icon: '🏔️', req: 93, time: 28.0,xp: 3700,in: [{ id: 'herb_kunlun', qty: 3 }, { id: 'herb_tai', qty: 2 }, { id: 'ingot_kunlun', qty: 2 }], out: { id: 'pill_kunlun', qty: 1 } },
    { id: 'pl_wuxu',  cat: 'pill', name: '炼制 · 无虚丹',  icon: '🌌', req: 98, time: 32.0,xp: 5200,in: [{ id: 'herb_wuxu', qty: 3 }, { id: 'herb_kunlun', qty: 2 }, { id: 'ingot_wuxu', qty: 2 }], out: { id: 'pill_wuxu', qty: 1 } },
    { id: 'pl_lan',   cat: 'pill', name: '炼制 · 蓝萤丹',  icon: '🔵', req: 8,  time: 3.6, xp: 22,  in: [{ id: 'herb_lan', qty: 3 }, { id: 'herb', qty: 1 }], out: { id: 'pill_lan', qty: 1 } },
    { id: 'pl_zi',    cat: 'pill', name: '炼制 · 紫芝丹',  icon: '🍄', req: 18, time: 5.2, xp: 50,  in: [{ id: 'herb_zi', qty: 3 }, { id: 'herb_liao', qty: 2 }], out: { id: 'pill_zi', qty: 1 } },
    { id: 'pl_you',   cat: 'pill', name: '炼制 · 幽兰丹',  icon: '🌑', req: 43, time: 10.0,xp: 190, in: [{ id: 'herb_you', qty: 3 }, { id: 'herb_zu', qty: 1 }, { id: 'ore_you', qty: 1 }], out: { id: 'pill_you', qty: 1 } },
    { id: 'pl_tian',  cat: 'pill', name: '炼制 · 天心丹',  icon: '🌸', req: 63, time: 14.0,xp: 430, in: [{ id: 'herb_tian', qty: 3 }, { id: 'herb_xue', qty: 2 }, { id: 'ore_tian', qty: 2 }], out: { id: 'pill_tian', qty: 1 } },
    { id: 'pl_shu',   cat: 'pill', name: '炼制 · 扶桑丹',  icon: '🌅', req: 73, time: 17.0,xp: 640, in: [{ id: 'herb_shu', qty: 3 }, { id: 'herb_tian', qty: 2 }, { id: 'ore_shu', qty: 2 }], out: { id: 'pill_shu', qty: 1 } },
    { id: 'pl_hun',   cat: 'pill', name: '炼制 · 混沌丹',  icon: '🌌', req: 83, time: 21.0,xp: 1150,in: [{ id: 'herb_hun', qty: 3 }, { id: 'herb_shu', qty: 2 }, { id: 'ore_hundun', qty: 1 }], out: { id: 'pill_hun', qty: 1 } },
    { id: 'pl_he',    cat: 'pill', name: '炼制 · 合一丹',  icon: '☯️', req: 68, time: 18.0,xp: 1100,in: [{ id: 'herb_shen', qty: 2 }, { id: 'herb_bing', qty: 2 }, { id: 'herb_yao', qty: 2 }, { id: 'herb_zu', qty: 2 }, { id: 'herb_mo', qty: 2 }], out: { id: 'pill_he', qty: 1 } },
    { id: 'pl_san',   cat: 'pill', name: '炼制 · 散神丹',  icon: '💫', req: 35, time: 10.0,xp: 280, in: [{ id: 'herb_bing', qty: 2 }, { id: 'herb_liao', qty: 4 }], out: { id: 'pill_san', qty: 1 } }
  ]
};

/* =========================================================================
 * 妖兽表（命中制：hit 命中 / ev 闪避 / atkMin~atkMax 伤害区间 / dr 伤害减免 / interval 出手间隔）
 * ========================================================================= */
const MONSTERS = [
  { id: 'bandit',    name: '山贼',     icon: '👤', lvl: 1,  hp: 34,   hit: 14,  ev: 8,  atkMin: 5,   atkMax: 9,   dr: 0.02, interval: 2.6, xp: 14,   gold: [5, 11],     respawn: 1.5, drops: [{ id: 'hide', chance: 0.45, qty: 1 }, { id: 'herb_liao', chance: 0.25, qty: 1 }, { id: 'log_qing', chance: 0.35, qty: 1 }] },
  { id: 'wolf',      name: '灵狼',     icon: '🐺', lvl: 5,  hp: 80,   hit: 26,  ev: 14, atkMin: 9,   atkMax: 15,  dr: 0.05, interval: 2.4, xp: 34,   gold: [14, 26],    respawn: 2.0, drops: [{ id: 'hide', chance: 0.6, qty: 1 }, { id: 'herb', chance: 0.25, qty: 1 }, { id: 'ore_iron', chance: 0.3, qty: 1 }] },
  { id: 'boar',      name: '铁背野猪', icon: '🐗', lvl: 8,  hp: 130,  hit: 34,  ev: 12, atkMin: 12,  atkMax: 19,  dr: 0.12, interval: 2.8, xp: 52,   gold: [22, 40],    respawn: 2.5, drops: [{ id: 'hide', chance: 0.7, qty: 2 }, { id: 'ore_iron', chance: 0.4, qty: 1 }, { id: 'pill_liao', chance: 0.04, qty: 1 }] },
  { id: 'golem',     name: '铁甲妖兽', icon: '🦾', lvl: 12, hp: 210,  hit: 45,  ev: 10, atkMin: 16,  atkMax: 24,  dr: 0.25, interval: 3.0, xp: 82,   gold: [40, 70],    respawn: 3.0, drops: [{ id: 'ore_xuan', chance: 0.5, qty: 1 }, { id: 'ore_iron', chance: 0.7, qty: 2 }, { id: 'log_han', chance: 0.3, qty: 1 }, { id: 'pill_wudao', chance: 0.03, qty: 1 }] },
  { id: 'ghostfire', name: '鬼火幽魂', icon: '🔥', lvl: 18, hp: 330,  hit: 62,  ev: 30, atkMin: 22,  atkMax: 33,  dr: 0.1,  interval: 2.5, xp: 130,  gold: [72, 130],   respawn: 3.5, drops: [{ id: 'herb_lan', chance: 0.45, qty: 1 }, { id: 'scroll', chance: 0.2, qty: 1 }, { id: 'ore_lei', chance: 0.15, qty: 1 }] },
  { id: 'zombie',    name: '古墓僵尸', icon: '🧟', lvl: 22, hp: 480,  hit: 80,  ev: 22, atkMin: 28,  atkMax: 40,  dr: 0.15, interval: 3.2, xp: 180,  gold: [110, 180],  respawn: 4.0, drops: [{ id: 'ore_ling', chance: 0.35, qty: 1 }, { id: 'herb', chance: 0.5, qty: 2 }, { id: 'herb_zhuji', chance: 0.2, qty: 1 }, { id: 'pill_wudao', chance: 0.05, qty: 1 }] },
  { id: 'demon',     name: '魔道修士', icon: '👹', lvl: 35, hp: 1100, hit: 150, ev: 45, atkMin: 55,  atkMax: 80,  dr: 0.2,  interval: 2.6, xp: 420,  gold: [300, 480],  respawn: 5.0, drops: [{ id: 'ore_ling', chance: 0.8, qty: 2 }, { id: 'ingot_xuan', chance: 0.5, qty: 2 }, { id: 'herb_zhuji', chance: 0.15, qty: 1 }, { id: 'log_zi', chance: 0.35, qty: 1 }, { id: 'pill_wudao', chance: 0.08, qty: 1 }] },
  { id: 'yama',      name: '夜叉罗刹', icon: '👺', lvl: 43, hp: 1900, hit: 210, ev: 60, atkMin: 78,  atkMax: 115, dr: 0.22, interval: 2.7, xp: 720,  gold: [560, 860],  respawn: 6.5, drops: [{ id: 'herb_zi', chance: 0.3, qty: 1 }, { id: 'ore_you', chance: 0.2, qty: 1 }, { id: 'ingot_gui', chance: 0.1, qty: 1 }, { id: 'herb_ning', chance: 0.15, qty: 1 }] },
  { id: 'demonking', name: '万妖王',   icon: '👺', lvl: 50, hp: 3600, hit: 320, ev: 90, atkMin: 110, atkMax: 160, dr: 0.3,  interval: 2.4, xp: 1400, gold: [900, 1500], respawn: 8.0, drops: [{ id: 'herb_ning', chance: 0.3, qty: 1 }, { id: 'herb_ying', chance: 0.2, qty: 1 }, { id: 'ingot_xuan', chance: 0.8, qty: 3 }, { id: 'ore_bing', chance: 0.5, qty: 2 }, { id: 'herb_bing', chance: 0.18, qty: 1 }, { id: 'pill_wudao', chance: 0.15, qty: 1 }] },
  /* === 高阶妖兽：冰渊 / 妖海 / 龙魂 / 墨渊 / 血玉 / 神玉档 === */
  { id: 'iceshark',  name: '冰渊白鲛', icon: '🦈', lvl: 28, hp: 720,  hit: 100, ev: 30, atkMin: 40,  atkMax: 60,  dr: 0.2,  interval: 2.8, xp: 260,  gold: [180, 280],  respawn: 5.0, drops: [{ id: 'fish_bing', chance: 0.6, qty: 1 }, { id: 'herb_bing', chance: 0.2, qty: 1 }, { id: 'ore_bing', chance: 0.35, qty: 1 }] },
  { id: 'yoshuang',  name: '妖海双生', icon: '👁️', lvl: 40, hp: 1600, hit: 190, ev: 55, atkMin: 75,  atkMax: 110, dr: 0.25, interval: 2.5, xp: 620,  gold: [480, 720],  respawn: 6.0, drops: [{ id: 'herb_yao', chance: 0.25, qty: 1 }, { id: 'ore_bing', chance: 0.4, qty: 2 }, { id: 'ingot_bing', chance: 0.15, qty: 1 }, { id: 'ingot_yang', chance: 0.1, qty: 1 }] },
  { id: 'zulong',    name: '龙须古龙', icon: '🐉', lvl: 55, hp: 5200, hit: 400, ev: 120, atkMin: 140, atkMax: 200, dr: 0.32, interval: 2.6, xp: 2200, gold: [1500, 2400],respawn: 9.0, drops: [{ id: 'herb_zu', chance: 0.35, qty: 1 }, { id: 'herb_ying', chance: 0.4, qty: 2 }, { id: 'ingot_yang', chance: 0.3, qty: 1 }, { id: 'ore_lei', chance: 0.4, qty: 2 }, { id: 'log_bing', chance: 0.25, qty: 1 }] },
  { id: 'shuimo',    name: '水墨鬼将', icon: '🎨', lvl: 58, hp: 6300, hit: 460, ev: 135, atkMin: 165, atkMax: 235, dr: 0.35, interval: 2.6, xp: 2900, gold: [2100, 3400],respawn: 10.0,drops: [{ id: 'herb_you', chance: 0.28, qty: 1 }, { id: 'ore_gui', chance: 0.3, qty: 1 }, { id: 'herb_bing', chance: 0.15, qty: 1 }, { id: 'ingot_you', chance: 0.1, qty: 1 }, { id: 'pill_zi', chance: 0.05, qty: 1 }] },
  { id: 'moze',      name: '墨渊魔蟾', icon: '🐸', lvl: 65, hp: 8800, hit: 520, ev: 150, atkMin: 180, atkMax: 260, dr: 0.38, interval: 2.7, xp: 3800, gold: [2800, 4400],respawn: 11.0,drops: [{ id: 'herb_mo', chance: 0.3, qty: 1 }, { id: 'ore_yang', chance: 0.6, qty: 3 }, { id: 'ingot_yang', chance: 0.25, qty: 1 }, { id: 'herb_yao', chance: 0.25, qty: 1 }, { id: 'pill_mo', chance: 0.08, qty: 1 }] },
  { id: 'tianlang',  name: '天狼星兽', icon: '🐕', lvl: 68, hp: 11000,hit: 570, ev: 160, atkMin: 205, atkMax: 295, dr: 0.4,  interval: 2.5, xp: 4900, gold: [3700, 5800],respawn: 12.0,drops: [{ id: 'herb_tian', chance: 0.2, qty: 1 }, { id: 'ore_tian', chance: 0.35, qty: 2 }, { id: 'herb_bing', chance: 0.15, qty: 1 }, { id: 'ingot_tian', chance: 0.1, qty: 1 }, { id: 'pill_tian', chance: 0.04, qty: 1 }] },
  { id: 'xueyu',     name: '血玉冥鳄', icon: '🐊', lvl: 75, hp: 14000,hit: 660, ev: 180, atkMin: 240, atkMax: 340, dr: 0.45, interval: 2.4, xp: 6400, gold: [4800, 7200],respawn: 14.0,drops: [{ id: 'herb_xue', chance: 0.25, qty: 1 }, { id: 'ore_shen', chance: 0.4, qty: 2 }, { id: 'ingot_shen', chance: 0.12, qty: 1 }, { id: 'herb_zu', chance: 0.2, qty: 1 }, { id: 'ore_lei', chance: 0.35, qty: 2 }, { id: 'pill_xue', chance: 0.05, qty: 1 }] },
  { id: 'shuyao',    name: '扶桑妖鸟', icon: '🦅', lvl: 78, hp: 17500,hit: 760, ev: 200, atkMin: 275, atkMax: 390, dr: 0.46, interval: 2.3, xp: 8100, gold: [6100, 9200],respawn: 16.0,drops: [{ id: 'herb_shu', chance: 0.22, qty: 1 }, { id: 'ore_shu', chance: 0.3, qty: 2 }, { id: 'herb_zu', chance: 0.2, qty: 1 }, { id: 'ingot_jian', chance: 0.08, qty: 1 }, { id: 'pill_shu', chance: 0.035, qty: 1 }] },
  { id: 'shenyu',    name: '神玉天魔', icon: '👼', lvl: 85, hp: 22000,hit: 900, ev: 240, atkMin: 340, atkMax: 500, dr: 0.5,  interval: 2.2, xp: 11000,gold: [8000, 14000],respawn: 20.0,drops: [{ id: 'herb_shen', chance: 0.25, qty: 1 }, { id: 'ingot_shen', chance: 0.6, qty: 2 }, { id: 'herb_tian', chance: 0.22, qty: 1 }, { id: 'ore_jian', chance: 0.25, qty: 1 }, { id: 'ingot_kunlun', chance: 0.15, qty: 1 }, { id: 'pill_shen', chance: 0.05, qty: 1 }, { id: 'pill_he', chance: 0.02, qty: 1 }] },
  /* === 炼虚/太清/无虚期高阶妖兽 === */
  { id: 'xu_long',   name: '炼虚魔龙', icon: '🐉', lvl: 90, hp: 35000,hit: 1200,ev: 300, atkMin: 480, atkMax: 700, dr: 0.55, interval: 2.2, xp: 18000,gold: [14000,24000],respawn: 24.0,drops: [{ id: 'herb_xu', chance: 0.22, qty: 1 }, { id: 'ingot_xu', chance: 0.45, qty: 2 }, { id: 'herb_shu', chance: 0.25, qty: 1 }, { id: 'ore_kunlun', chance: 0.2, qty: 1 }, { id: 'ingot_kunlun', chance: 0.15, qty: 1 }, { id: 'pill_xu_cult', chance: 0.03, qty: 1 }] },
  { id: 'tai_demon', name: '太清魔尊', icon: '👹', lvl: 95, hp: 55000,hit: 1600,ev: 400, atkMin: 700, atkMax: 1000,dr: 0.6,  interval: 2.3, xp: 30000,gold: [24000,42000],respawn: 30.0,drops: [{ id: 'herb_tai', chance: 0.18, qty: 1 }, { id: 'ingot_tai', chance: 0.35, qty: 2 }, { id: 'herb_kunlun', chance: 0.2, qty: 1 }, { id: 'ore_pan', chance: 0.15, qty: 1 }, { id: 'ingot_pan', chance: 0.1, qty: 1 }, { id: 'pill_tai', chance: 0.025, qty: 1 }] },
  { id: 'wuxu_beast',name: '无虚荒兽', icon: '🐲', lvl: 100,hp: 90000,hit: 2200,ev: 550, atkMin: 1000,atkMax: 1400,dr: 0.65, interval: 2.4, xp: 50000,gold: [42000,72000],respawn: 40.0,drops: [{ id: 'herb_kunlun', chance: 0.15, qty: 1 }, { id: 'ingot_kunlun', chance: 0.3, qty: 2 }, { id: 'herb_wuxu', chance: 0.05, qty: 1 }, { id: 'ore_wuxu', chance: 0.15, qty: 1 }, { id: 'ingot_hundun', chance: 0.08, qty: 1 }, { id: 'pill_kunlun', chance: 0.02, qty: 1 }, { id: 'pill_wuxu', chance: 0.01, qty: 1 }] }
];

/* =========================================================================
 * 秘境（副本，参考《梅尔沃放置》）
 *   - floors：按顺序挑战的妖兽 id 列表（必须存在于 MONSTERS），逐波推进
 *   - scale：该秘境对妖兽生命/攻击/经验/灵石的倍率；每深入一波再叠 8%
 *   - reward：通关一轮的额外奖励（灵石 + 战斗经验 + 物品），通关后自动重头循环
 *   - unlock：缺省即开放；隐藏秘境需满足条件才显形
 *       { type:'gatherSkill', skill, n }  该技能累计采集次数
 *       { type:'level', skill, lvl }      技能等级
 *       { type:'kills', n }               累计击杀妖兽数
 * ========================================================================= */
const DUNGEONS = [
  { id: 'd_qingyun', name: '青云洞天', icon: '🏯', req: 10,
    desc: '云海之上的入门秘境，山贼与妖兽盘踞，三重波次。',
    floors: ['bandit', 'wolf', 'boar'],
    scale: { hp: 1.4, atk: 1.15, xp: 1.3, gold: 1.3 },
    reward: { gold: 260, xp: 120, items: [{ id: 'herb_liao', qty: 3 }, { id: 'pill_liao', qty: 1 }] } },
  { id: 'd_youming', name: '幽冥地宫', icon: '💀', req: 22,
    desc: '古墓之下的阴气地宫，鬼火引路，僵尸与铁甲守卫层层把守。',
    floors: ['ghostfire', 'zombie', 'golem', 'ghostfire'],
    scale: { hp: 1.6, atk: 1.2, xp: 1.4, gold: 1.5 },
    reward: { gold: 900, xp: 420, items: [{ id: 'herb_zhuji', qty: 2 }, { id: 'ore_ling', qty: 4 }, { id: 'pill_wudao', qty: 1 }] } },
  { id: 'd_wanmu', name: '万木灵境', icon: '🌳', req: 35, hidden: true,
    desc: '伐尽万木方现的灵境，木灵化妖，以斧痕为门。',
    unlock: { type: 'gatherSkill', skill: 'woodcutting', n: 10000 },
    floors: ['boar', 'golem', 'demon'],
    scale: { hp: 1.7, atk: 1.25, xp: 1.5, gold: 1.6 },
    reward: { gold: 1600, xp: 700, items: [{ id: 'log_zi', qty: 5 }, { id: 'log_tian', qty: 2 }, { id: 'herb_zu', qty: 2 }] } },
  { id: 'd_bingyuan', name: '冰渊幽宫', icon: '🧊', req: 45, hidden: true,
    desc: '冰海之底的水晶宫殿，唯有钓尽千川者能寻得入口。',
    unlock: { type: 'gatherSkill', skill: 'fishing', n: 5000 },
    floors: ['iceshark', 'yoshuang', 'demonking'],
    scale: { hp: 1.8, atk: 1.3, xp: 1.6, gold: 1.7 },
    reward: { gold: 3200, xp: 1200, items: [{ id: 'fish_bing', qty: 4 }, { id: 'ore_bing', qty: 6 }, { id: 'herb_bing', qty: 3 }] } },
  { id: 'd_xingyun', name: '星陨秘境', icon: '☄️', req: 60, hidden: true,
    desc: '陨星坠地深处的秘境，需以阵纹引路方可破开虚空。',
    unlock: { type: 'level', skill: 'formation', lvl: 40 },
    floors: ['shuimo', 'moze', 'tianlang'],
    scale: { hp: 1.9, atk: 1.35, xp: 1.7, gold: 1.9 },
    reward: { gold: 7000, xp: 2400, items: [{ id: 'ore_kunlun', qty: 2 }, { id: 'ingot_kunlun', qty: 1 }, { id: 'pill_he', qty: 1 }] } },
  { id: 'd_wuxu', name: '无虚天宫', icon: '🌌', req: 85, hidden: true,
    desc: '杀伐千场者方可踏足的荒古天宫，无虚荒兽守于终殿。',
    unlock: { type: 'kills', n: 1500 },
    floors: ['shenyu', 'xu_long', 'tai_demon', 'wuxu_beast'],
    scale: { hp: 2.0, atk: 1.4, xp: 1.9, gold: 2.0 },
    reward: { gold: 26000, xp: 8000, items: [{ id: 'ingot_hundun', qty: 2 }, { id: 'herb_wuxu', qty: 2 }, { id: 'pill_kunlun', qty: 1 }] } }
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
  { id: 'water', name: '水', icon: '💧', color: '#63a9e0', skill: 'fishing', desc: '水主流转，道在钓鱼。' },
  { id: 'fire', name: '火', icon: '🔥', color: '#e08a6a', skill: 'alchemy', desc: '火主炼化，道在炼丹。' },
  { id: 'earth', name: '土', icon: '⛰️', color: '#b58a5f', skill: 'formation', desc: '土主承载，道在阵法。' }
];

/* =========================================================================
 * 境界：大境界 → 小境界（层/期）  needBase/needMul 决定修为需求曲线
 * rate 同境突破成功率；rateToNext 跨大境界成功率；pill 跨境所需丹药
 * ========================================================================= */
const REALM_DEFS = [
  { name: '炼气期', icon: '🌱', color: '#7dd8b8', desc: '引气入体，褪去凡胎。',
    stages: ['一层', '二层', '三层', '四层', '五层', '六层', '七层', '八层', '九层', '十层', '十一层', '十二层', '十三层'],
    needBase: 7600, needMul: 1.32, rate: 0.95, rateToNext: 0.55, pill: 'pill_zhuji', gold: 0 },
  { name: '筑基期', icon: '🏔️', color: '#63a9e0', desc: '筑就道基，可御法器。',
    stages: ['初期', '中期', '后期', '大圆满'],
    needBase: 728000, needMul: 1.5, rate: 0.72, rateToNext: 0.40, pill: 'pill_ning', gold: 150 },
  { name: '结丹期', icon: '🔆', color: '#d8b26a', desc: '凝结金丹，寿元大增。',
    stages: ['初期', '中期', '后期', '大圆满'],
    needBase: 2815000, needMul: 1.45, rate: 0.60, rateToNext: 0.30, pill: 'pill_ying', gold: 400 },
  { name: '元婴期', icon: '👶', color: '#a98be0', desc: '元婴出窍，神通初显。',
    stages: ['初期', '中期', '后期', '大圆满'],
    needBase: 9790000, needMul: 1.45, rate: 0.50, rateToNext: 0.22, pill: 'pill_shen', gold: 1200 },
  { name: '化神期', icon: '✨', color: '#e0a3c8', desc: '神识化虚，可称大能。',
    stages: ['初期', '中期', '后期', '大圆满'],
    needBase: 34400000, needMul: 1.35, rate: 0.40, rateToNext: 0.15, pill: 'pill_xu', gold: 3000 },
  { name: '炼虚期', icon: '🌌', color: '#8ad4ff', desc: '炼化虚空，追索长生。',
    stages: ['初期', '中期', '后期', '大圆满'],
    needBase: 97450000, needMul: 1.3, rate: 0.32, rateToNext: 0.18, pill: null, gold: 8000 }
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
 * 太上境：炼虚之上的终极境界，共 96,500 层
 * - 不预展开 9.65 万个阶段对象，改为按需生成并缓存（taishangStage）
 * - 需求曲线承接炼虚大圆满（27,000,000 × 1.5 = 40,500,000 起）
 * - 层数太多，指数曲线会溢出双精度，故沿用同量级的幂律递增：need = needBase × 层^needPow
 * ========================================================================= */
const TAISHANG_DEF = {
  name: '太上境',
  icon: '☯️',
  color: '#f0d77b',
  desc: '太上忘情，万法归一。',
  layerCount: 96500,
  needBase: 300000000,
  needPow: 1.5,     // 每层修为需求按 层^1.5 递增，保证单调增长且不溢出
  rate: 0.25        // 同境突破成功率
};

/* 中文数字（1 ~ 96500），用于太上境层名：16 → 十六，96500 → 九万六千五百 */
function cnBelow10000(n) {
  const D = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九'];
  const U = ['', '十', '百', '千'];
  let out = '';
  let started = false;
  let zero = false;
  for (let i = 3; i >= 0; i--) {
    const d = Math.floor(n / Math.pow(10, i)) % 10;
    if (d === 0) { if (started) zero = true; continue; }
    if (zero) { out += '零'; zero = false; }
    out += D[d] + U[i];
    started = true;
  }
  if (out.indexOf('一十') === 0) out = out.slice(1);   // 一十六 → 十六
  return out;
}
function cnNum(n) {
  n = Math.floor(n);
  if (n <= 0) return '零';
  if (n < 10000) return cnBelow10000(n);
  if (n >= 100000000) return String(n);
  const hi = Math.floor(n / 10000);
  const lo = n % 10000;
  return cnBelow10000(hi) + '万' + (lo === 0 ? '' : (lo < 1000 ? '零' + cnBelow10000(lo) : cnBelow10000(lo)));
}

const TAISHANG_START = STAGES.length;                 // 0 起：第 34 阶 → 下标 33
const TOTAL_STAGES = STAGES.length + TAISHANG_DEF.layerCount;

const _tsCache = [];   // 缓存：下标 = 太上境内层号 - 1

function taishangStage(si) {
  let st = _tsCache[si];
  if (st) return st;
  const layer = si + 1;
  const isLast = layer >= TAISHANG_DEF.layerCount;
  st = {
    lvl: TAISHANG_START + layer,
    realmIndex: REALM_DEFS.length,
    realm: TAISHANG_DEF.name,
    realmIcon: TAISHANG_DEF.icon,
    color: TAISHANG_DEF.color,
    realmDesc: TAISHANG_DEF.desc,
    stageName: cnNum(layer) + '层',
    stageIndexInRealm: si,
    layerCount: TAISHANG_DEF.layerCount,
    full: TAISHANG_DEF.name + ' ' + cnNum(layer) + '层',
    isMax: isLast,
    breakInfo: isLast ? null : {
      need: Math.floor(TAISHANG_DEF.needBase * Math.pow(layer, TAISHANG_DEF.needPow)),
      rate: TAISHANG_DEF.rate,
      pill: null,
      gold: 0,
      boundary: false
    }
  };
  _tsCache[si] = st;
  return st;
}

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
  },
  {
    id: 'farm', name: '灵植坊', icon: '🌱',
    items: [
      { id: 'seed_ling' },   { id: 'seed_juqi' },  { id: 'seed_liao' },
      { id: 'seed_lingdao' },{ id: 'seed_zhuji' }, { id: 'seed_ning' },
      { id: 'seed_yunmian' },{ id: 'seed_bing' },  { id: 'seed_ying' },
      { id: 'seed_zifu' },   { id: 'seed_yao' },   { id: 'seed_zu' },
      { id: 'seed_mo' },     { id: 'seed_tianxiang' }, { id: 'seed_xue' },
      { id: 'seed_shen' },   { id: 'seed_fusang' },{ id: 'seed_xu' },
      { id: 'seed_hundou' }, { id: 'seed_tai' },   { id: 'seed_daolian' },
      { id: 'seed_kunlun' }, { id: 'seed_wuxu' }
    ]
  },
  {
    id: 'premium', name: '高阶宝阁', icon: '💠',
    items: [
      { id: 'ore_bing' },   { id: 'ingot_bing' },
      { id: 'ore_you' },    { id: 'ingot_you' },
      { id: 'herb_zi' },    { id: 'herb_you' },
      { id: 'pill_ying' },  { id: 'pill_bing' },
      { id: 'log_yun' },    { id: 'fish_zu' }
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
 * 每一种「观星」对应一座阵法：观星解锁后阵法随之解锁，阵纹升级还需
 * 该观星的精通等级达标（mper × 目标阵纹等级），星砂则是唯一升级货币。
 * mods[].key 为加成通道：引擎的 formBonus(key) 汇总所有阵法的同类加成。
 * per 为每级加成（小数），max 为阵纹等级上限。
 * 升级消耗：formCost = cost × growth^当前等级 ×（1 + 阵纹序号 × 0.35）
 * ========================================================================= */
const FORM_SPECS = [
  { obs: 'ob_qiyao', name: '七曜阵', icon: '🌟', color: '#7dd8b8', costMul: 2, growth: 1.30,
    desc: '观七曜运转，引天地灵气入体。',
    mods: [{ key: 'xp_cult', name: '修炼速度', per: 0.03, max: 10 },
           { key: 'spirit', name: '灵力凝聚', per: 0.06, max: 10 }] },
  { obs: 'ob_ziwei', name: '紫微阵', icon: '🔭', color: '#a98be0', costMul: 2, growth: 1.30,
    desc: '紫微定星，推演天机更速。',
    mods: [{ key: 'mastery', name: '精通经验', per: 0.05, max: 10 },
           { key: 'xp_gather', name: '采集经验', per: 0.03, max: 10 }] },
  { obs: 'ob_xuanji', name: '璇玑阵', icon: '✨', color: '#8ad4ff', costMul: 2, growth: 1.31,
    desc: '璇玑疾转，动作如风。',
    mods: [{ key: 'speed', name: '动作速度', per: 0.015, max: 10 },
           { key: 'double', name: '额外产出', per: 0.015, max: 10 }] },
  { obs: 'ob_huntian', name: '浑天阵', icon: '🌠', color: '#c9a24d', costMul: 2, growth: 1.31,
    desc: '浑天护体，血肉坚如金石。',
    mods: [{ key: 'hp', name: '生命上限', per: 0.04, max: 10 },
           { key: 'def', name: '防御', per: 0.05, max: 10 }] },
  { obs: 'ob_taiwei', name: '太微阵', icon: '🌜', color: '#f2dda6', costMul: 2, growth: 1.32,
    desc: '太微主财，广开财路与机缘。',
    mods: [{ key: 'gold', name: '灵石获取', per: 0.05, max: 10 },
           { key: 'sell', name: '出售价', per: 0.02, max: 10 }] },
  { obs: 'ob_zhoutian', name: '周天阵', icon: '🌌', color: '#63a9e0', costMul: 2, growth: 1.32,
    desc: '小周天运转，采集与生长皆顺。',
    mods: [{ key: 'xp_gather', name: '采集经验', per: 0.04, max: 10 },
           { key: 'growth', name: '灵植生长', per: 0.04, max: 10 }] },
  { obs: 'ob_tianshi', name: '天市阵', icon: '🏮', color: '#e29a6b', costMul: 2, growth: 1.32,
    desc: '天市集珍，财货与掉落俱丰。',
    mods: [{ key: 'gold', name: '灵石获取', per: 0.06, max: 10 },
           { key: 'drop', name: '掉落概率', per: 0.03, max: 10 }] },
  { obs: 'ob_taixuan', name: '太玄阵', icon: '🌙', color: '#7d8fd8', costMul: 2, growth: 1.33,
    desc: '太玄观天，修行与征战俱进。',
    mods: [{ key: 'xp_cult', name: '修炼速度', per: 0.05, max: 10 },
           { key: 'xp_combat', name: '战斗经验', per: 0.04, max: 10 }] },
  { obs: 'ob_bagua', name: '八卦阵', icon: '☯️', color: '#b8c9a0', costMul: 2, growth: 1.33,
    desc: '八卦定方位，趋避由心。',
    mods: [{ key: 'hit', name: '命中', per: 0.03, max: 10 },
           { key: 'ev', name: '闪避', per: 0.03, max: 10 }] },
  { obs: 'ob_ziwei2', name: '紫微垣阵', icon: '🪐', color: '#a98be0', costMul: 2, growth: 1.34,
    desc: '紫微垣周列星辰，精通与机缘同增。',
    mods: [{ key: 'mastery', name: '精通经验', per: 0.06, max: 10 },
           { key: 'drop', name: '掉落概率', per: 0.04, max: 10 }] },
  { obs: 'ob_nine', name: '九宫阵', icon: '📐', color: '#d8b46b', costMul: 2, growth: 1.34,
    desc: '九宫轮转，攻守兼备。',
    mods: [{ key: 'atk', name: '攻击', per: 0.04, max: 10 },
           { key: 'hit', name: '命中', per: 0.04, max: 10 }] },
  { obs: 'ob_luotian', name: '罗天阵', icon: '🌀', color: '#5fb0c9', costMul: 2, growth: 1.35,
    desc: '罗天匝地，炼器与机缘皆盛。',
    mods: [{ key: 'xp_craft', name: '炼器经验', per: 0.04, max: 10 },
           { key: 'drop', name: '掉落概率', per: 0.03, max: 10 }] },
  { obs: 'ob_dayan', name: '大衍阵', icon: '🔢', color: '#c9a24d', costMul: 2, growth: 1.35,
    desc: '大衍之数五十，其用四十有九。',
    mods: [{ key: 'mastery', name: '精通经验', per: 0.07, max: 10 },
           { key: 'double', name: '额外产出', per: 0.02, max: 10 }] },
  { obs: 'ob_taiji', name: '太极阵', icon: '✨', color: '#9fd8c8', costMul: 2, growth: 1.36,
    desc: '太极归一，生生不息。',
    mods: [{ key: 'spirit', name: '灵力凝聚', per: 0.08, max: 10 },
           { key: 'regen', name: '脱战回血', per: 0.05, max: 10 }] },
  { obs: 'ob_lingxu', name: '灵虚阵', icon: '🪐', color: '#63a9e0', costMul: 2, growth: 1.36,
    desc: '灵虚纳气，动若脱兔。',
    mods: [{ key: 'speed', name: '动作速度', per: 0.02, max: 10 },
           { key: 'xp_cult', name: '修炼速度', per: 0.06, max: 10 }] },
  { obs: 'ob_dongxu', name: '洞虚阵', icon: '🕳️', color: '#6f7c9a', costMul: 2, growth: 1.37,
    desc: '洞虚见真，守御无懈。',
    mods: [{ key: 'ev', name: '闪避', per: 0.04, max: 10 },
           { key: 'def', name: '防御', per: 0.06, max: 10 }] },
  { obs: 'ob_taiyuan', name: '太原阵', icon: '💠', color: '#8ad4ff', costMul: 2, growth: 1.37,
    desc: '太原天中，灵力如泉。',
    mods: [{ key: 'spirit', name: '灵力凝聚', per: 0.10, max: 10 },
           { key: 'xp_gather', name: '采集经验', per: 0.05, max: 10 }] },
  { obs: 'ob_taichu', name: '太初阵', icon: '🌠', color: '#b09ae0', costMul: 2, growth: 1.38,
    desc: '太初有道，征伐无双。',
    mods: [{ key: 'xp_combat', name: '战斗经验', per: 0.06, max: 10 },
           { key: 'atk', name: '攻击', per: 0.05, max: 10 }] },
  { obs: 'ob_kunlun', name: '昆仑阵', icon: '🏔️', color: '#c9a24d', costMul: 2, growth: 1.38,
    desc: '昆仑仙山，道体长存。',
    mods: [{ key: 'hp', name: '生命上限', per: 0.06, max: 10 },
           { key: 'regen', name: '脱战回血', per: 0.06, max: 10 }] },
  { obs: 'ob_wuji', name: '无极阵', icon: '♾️', color: '#d8d8e0', costMul: 2, growth: 1.39,
    desc: '无极之外，复无无极。',
    mods: [{ key: 'double', name: '额外产出', per: 0.03, max: 10 },
           { key: 'sell', name: '出售价', per: 0.03, max: 10 }] },
  { obs: 'ob_wuxu', name: '无虚阵', icon: '🌌', color: '#63a9e0', costMul: 2, growth: 1.40,
    desc: '无虚之境，万法归一。',
    mods: [{ key: 'xp_cult', name: '修炼速度', per: 0.08, max: 10 },
           { key: 'mastery', name: '精通经验', per: 0.08, max: 10 }] }
];

/* 由观星动作反推解锁门槛与基础消耗（星砂产出越多，阵纹越贵）；
   id 与观星一一对应，obs 指向该观星动作 */
const FORMATIONS = FORM_SPECS.map(function (sp) {
  const gaze = findActivity('formation', sp.obs) || { req: 1, out: { stardust: 4 } };
  const sd = (gaze.out && gaze.out.stardust) || 4;
  return {
    id: 'f_' + sp.obs.replace('ob_', ''),
    obs: sp.obs,
    name: sp.name, icon: sp.icon, color: sp.color, desc: sp.desc,
    req: gaze.req,
    cost: Math.max(8, Math.round(sd * (sp.costMul || 2))),
    growth: sp.growth || 1.32,
    mper: 4,             /* 每级阵纹所需的观星精通等级 */
    mods: sp.mods
  };
});

/* 阵纹升到 lvl 级所需的观星精通等级 */
function formMasteryReq(f, lvl) {
  return Math.max(0, Math.floor(Number(lvl) || 0)) * (f.mper || 4);
}

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
  { id: 'seed_ling',   name: '灵草种子',     icon: '🌱', req: 1,  growTime: 25,  yield: 3, outId: 'herb',       dropBy: 'al_ling' },
  { id: 'seed_juqi',   name: '聚气草种子',   icon: '🌱', req: 1,  growTime: 30,  yield: 2, outId: 'herb_juqi',  dropBy: 'al_juqi' },
  { id: 'seed_liao',   name: '疗伤草种子',   icon: '🌱', req: 3,  growTime: 38,  yield: 2, outId: 'herb_liao',  dropBy: 'al_liao' },
  { id: 'seed_zhuji',  name: '筑基花种子',   icon: '🌺', req: 10, growTime: 70,  yield: 2, outId: 'herb_zhuji', dropBy: 'al_zhuji' },
  { id: 'seed_ning',   name: '凝元参种子',   icon: '🌱', req: 20, growTime: 120, yield: 2, outId: 'herb_ning',  dropBy: 'al_ning' },
  { id: 'seed_ying',   name: '化婴芝种子',   icon: '🍄', req: 30, growTime: 200, yield: 2, outId: 'herb_ying',  dropBy: 'al_ying' },
  { id: 'seed_bing',   name: '冰心草种子',   icon: '❄️', req: 26, growTime: 160, yield: 2, outId: 'herb_bing',  dropBy: 'al_bing' },
  { id: 'seed_yao',    name: '妖丹花种子',   icon: '🌺', req: 36, growTime: 250, yield: 2, outId: 'herb_yao',   dropBy: 'al_yao' },
  { id: 'seed_zu',     name: '龙须根种子',   icon: '🌱', req: 42, growTime: 320, yield: 2, outId: 'herb_zu',    dropBy: 'al_zu' },
  { id: 'seed_mo',     name: '墨灵芝种子',   icon: '🟣', req: 50, growTime: 420, yield: 2, outId: 'herb_mo',    dropBy: 'al_mo' },
  { id: 'seed_xue',    name: '血玉参种子',   icon: '🩸', req: 58, growTime: 560, yield: 2, outId: 'herb_xue',   dropBy: 'al_xue' },
  { id: 'seed_shen',   name: '神元果种子',   icon: '✨', req: 68, growTime: 760, yield: 2, outId: 'herb_shen',  dropBy: 'al_shen' },
  { id: 'seed_xu',     name: '炼虚参种子',   icon: '🌱', req: 78, growTime: 960, yield: 2, outId: 'herb_xu',    dropBy: 'al_xu' },
  { id: 'seed_tai',    name: '太清芝种子',   icon: '🍄', req: 86, growTime: 1200,yield: 2, outId: 'herb_tai',   dropBy: 'al_tai' },
  { id: 'seed_kunlun', name: '昆仑莲种子',   icon: '🌱', req: 93, growTime: 1500,yield: 2, outId: 'herb_kunlun',dropBy: 'al_kunlun' },
  { id: 'seed_wuxu',   name: '无虚根种子',   icon: '🌱', req: 98, growTime: 1800,yield: 2, outId: 'herb_wuxu',  dropBy: 'al_wuxu' },
  /* === 灵植作物：稻棉茶果，填充每 5 级档 === */
  { id: 'seed_lingdao',   name: '灵稻种子',   icon: '🌾', req: 13, growTime: 90,  yield: 3, outId: 'rice_ling' },
  { id: 'seed_yunmian',   name: '云棉种子',   icon: '☁️', req: 23, growTime: 150, yield: 2, outId: 'yun_mian' },
  { id: 'seed_zifu',      name: '紫府茶种',   icon: '🍵', req: 33, growTime: 230, yield: 2, outId: 'tea_zi' },
  { id: 'seed_tianxiang', name: '天香稻种',   icon: '🌾', req: 53, growTime: 480, yield: 2, outId: 'rice_tian' },
  { id: 'seed_fusang',    name: '扶桑果种',   icon: '🍑', req: 63, growTime: 660, yield: 2, outId: 'guo_shu' },
  { id: 'seed_hundou',    name: '混沌豆种',   icon: '🌱', req: 73, growTime: 880, yield: 2, outId: 'dou_hun' },
  { id: 'seed_daolian',   name: '道莲种子',   icon: '🌱', req: 83, growTime: 1100,yield: 2, outId: 'lian_zi' }
];

function findSeed(seedId) {
  for (let i = 0; i < FARM_SEEDS.length; i++) if (FARM_SEEDS[i].id === seedId) return FARM_SEEDS[i];
  return null;
}

function plotUnlocked(farmingLvl, idx) {
  return idx < FARMING_PLOT_REQS.length && farmingLvl >= FARMING_PLOT_REQS[idx];
}

/* =========================================================================
 * 世界 · 洞天营造（参考《梅尔沃放置》的城镇 Township）
 * - 建筑只提供"被动收益"，不占用动作槽，离线同样推进
 * - 粮食 / 木材 / 石料是洞天内部资源（存于 state.world.res）
 * - 灵石 / 灵力 / 星砂产出直接进入全局资源
 * - out 单位统一为"每分钟"，实际产出再乘以人口效率（engine.worldEff）
 * ========================================================================= */
const WORLD = {
  BASE_POP_CAP: 4,          // 没有民居时的人口上限
  FOOD_PER_POP_MIN: 2.5,    // 每个居民每分钟消耗粮食
  POP_GROWTH: 0.003,        // 每秒向人口上限逼近的比例（仅在粮食有盈余时）
  POP_DECAY: 0.002,         // 断粮时人口每秒流失比例
  EFF_BASE: 0.3,            // 人口为 0 时的基础效率
  CAP: { food: 2000, wood: 1200, stone: 1200 },  // 建设度 1 时的基础仓储上限
  CAP_GROW: 0.4,            // 每点建设度，仓储上限相对基础值 +40%（跟住造价增长）
  /* 单栋建筑不再设等级上限，造价按 COST_MUL 逐级递增 */
  COST_MUL: 1.18            // 每级建造成本倍率
};

/* 洞天仓储上限：随建设度线性增长。
   造价按 1.18^等级 指数上涨，若仓储固定不变，后期会出现"单次造价 > 仓储上限"的死锁；
   按建设度放大后，只要持续推进建设度就能继续升级。 */
function worldCap(level) {
  const lv = Math.max(1, Math.floor(level) || 1);
  const g = 1 + WORLD.CAP_GROW * (lv - 1);
  return {
    food: Math.floor(WORLD.CAP.food * g),
    wood: Math.floor(WORLD.CAP.wood * g),
    stone: Math.floor(WORLD.CAP.stone * g)
  };
}

/* 地形：建筑按地形分区，参考《梅尔沃放置》城镇的生物群系。
   每种地形有独立的建筑链与专精方向；地形本身不单独设门槛，
   其解锁门槛 = 该地形内建筑的最低 req（见 terrainReq）。 */
const TERRAINS = [
  { id: 'plains',    name: '平原', icon: '🌾', color: '#8ad46a', desc: '沃野千里，宜农宜牧，人口与香火之基。' },
  { id: 'forest',    name: '林地', icon: '🌲', color: '#6fbf73', desc: '古木参天，木材与灵植生长的摇篮。' },
  { id: 'mountain',  name: '山岳', icon: '⛰️', color: '#9aa4b8', desc: '峰峦叠嶂，石料与坚甲厚壁之地。' },
  { id: 'waterside', name: '水泽', icon: '💧', color: '#66c4d9', desc: '泽国水乡，灵力与生机汇聚之所。' },
  { id: 'desert',    name: '荒漠', icon: '🏜️', color: '#e0b06a', desc: '商旅驼铃，灵石与买卖的天堂。' },
  { id: 'volcano',   name: '火山', icon: '🌋', color: '#e07a6a', desc: '熔岩奔流，兵锋与攻伐的试炼场。' },
  { id: 'snow',      name: '雪原', icon: '❄️', color: '#a9c8e0', desc: '冰封万里，星砂与学问的清修地。' },
  { id: 'mystic',    name: '秘境', icon: '🌀', color: '#a98be0', desc: '虚空裂隙，修为与匠作的奇境。' }
];

/* req：解锁所需的建设度（worldLevel）；cost：0 级造价；terrain：所属地形 */
const BUILDINGS = [
  /* ---------------------------------------------------------- 平原 plains */
  { id: 'farm',   name: '灵田',   icon: '🌾', color: '#8ad46a', terrain: 'plains', req: 1,
    desc: '开垦灵田，产出粮食供养居民。', cost: { gold: 40, wood: 20, stone: 10 }, out: { food: 10 } },
  { id: 'house',  name: '民居',   icon: '🏠', color: '#d9b27a', terrain: 'plains', req: 1, popCap: 4,
    desc: '安置凡民与弟子，每级 +4 人口上限。', cost: { gold: 150, wood: 40, stone: 30 }, out: null },
  { id: 'vault',  name: '聚宝阁', icon: '💰', color: '#f0c95a', terrain: 'plains', req: 8,
    desc: '收拢四方香火供奉，被动产出灵石。', cost: { gold: 300, wood: 60, stone: 60 }, out: { gold: 5 } },
  { id: 'granary', name: '谷仓',  icon: '🏺', terrain: 'plains', req: 10,
    desc: '囤积灵谷，粮食 +6/分。', cost: { gold: 420, wood: 50, stone: 50 }, out: { food: 6 } },
  { id: 'mill',   name: '磨坊',   icon: '🌬️', terrain: 'plains', req: 14,
    desc: '风磨碾谷，粮食 +8/分。', cost: { gold: 580, wood: 70, stone: 70 }, out: { food: 8 } },
  { id: 'orchard', name: '果园',  icon: '🍎', terrain: 'plains', req: 22,
    desc: '灵果成林，粮食 +12/分。', cost: { gold: 960, wood: 110, stone: 110 }, out: { food: 12 } },
  { id: 'pasture', name: '牧场',  icon: '🐄', terrain: 'plains', req: 30,
    desc: '牧养灵畜，粮食 +14/分。', cost: { gold: 1400, wood: 150, stone: 150 }, out: { food: 14 } },
  { id: 'beehive', name: '蜂园',  icon: '🍯', terrain: 'plains', req: 40,
    desc: '灵蜂酿蜜，粮食 +16/分。', cost: { gold: 1900, wood: 200, stone: 200 }, out: { food: 16 } },
  { id: 'winery', name: '酒坊',   icon: '🍶', terrain: 'plains', req: 50, bonus: { key: 'gold', per: 0.01 },
    desc: '灵酒远销，每级灵石收益 +1%。', cost: { gold: 2600, wood: 240, stone: 240 }, out: null },
  { id: 'teahouse', name: '茶肆', icon: '🍵', terrain: 'plains', req: 62, bonus: { key: 'sell', per: 0.01 },
    desc: '茶香引客，每级出售价 +1%。', cost: { gold: 3300, wood: 260, stone: 260 }, out: null },
  { id: 'fairground', name: '集市广场', icon: '🎪', terrain: 'plains', req: 74, bonus: { key: 'gold', per: 0.015 },
    desc: '四方云集，每级灵石收益 +1.5%。', cost: { gold: 4050, wood: 270, stone: 270 }, out: null },
  { id: 'embassy', name: '驿馆',  icon: '🏛️', terrain: 'plains', req: 86, bonus: { key: 'sell', per: 0.012 },
    desc: '万国来朝，每级出售价 +1.2%。', cost: { gold: 4950, wood: 290, stone: 290 }, out: null },
  { id: 'imperialroad', name: '官道', icon: '🛣️', terrain: 'plains', req: 98, bonus: { key: 'speed', per: 0.01 },
    desc: '驿道通达，每级动作速度 +1%。', cost: { gold: 6100, wood: 330, stone: 330 }, out: null },

  /* ---------------------------------------------------------- 林地 forest */
  { id: 'lumber', name: '伐木坊', icon: '🪓', color: '#c08a5a', terrain: 'forest', req: 1,
    desc: '雇工伐取灵木，为营造提供木材。', cost: { gold: 60, wood: 10, stone: 15 }, out: { wood: 8 } },
  { id: 'sawmill', name: '木料场', icon: '🏭', terrain: 'forest', req: 6,
    desc: '解木成材，木材 +6/分。', cost: { gold: 260, wood: 30, stone: 30 }, out: { wood: 6 } },
  { id: 'charcoal', name: '炭窑', icon: '🔥', terrain: 'forest', req: 9,
    desc: '烧木成炭，木材 +5/分。', cost: { gold: 380, wood: 45, stone: 45 }, out: { wood: 5 } },
  { id: 'huntinglodge', name: '猎屋', icon: '🏹', terrain: 'forest', req: 12, bonus: { key: 'drop', per: 0.01 },
    desc: '狩猎所得更丰，每级掉落率 +1%。', cost: { gold: 500, wood: 60, stone: 60 }, out: null },
  { id: 'treetop', name: '树屋',  icon: '🌳', terrain: 'forest', req: 16, bonus: { key: 'growth', per: 0.015 },
    desc: '悬枝而居，每级灵植生长 +1.5%。', cost: { gold: 660, wood: 80, stone: 80 }, out: null },
  { id: 'herbgarden', name: '药圃', icon: '🌿', color: '#7fc96a', terrain: 'forest', req: 20, bonus: { key: 'growth', per: 0.03 },
    desc: '暖圃催生，每级灵植生长速度 +3%。', cost: { gold: 700, wood: 90, stone: 90 }, out: null },
  { id: 'fletcher', name: '箭坊', icon: '🏹', terrain: 'forest', req: 24, bonus: { key: 'hit', per: 0.008 },
    desc: '箭矢精良，每级命中 +0.8%。', cost: { gold: 1060, wood: 120, stone: 120 }, out: null },
  { id: 'windhall', name: '风阵坊', icon: '⚡', color: '#6fc3e0', terrain: 'forest', req: 28, bonus: { key: 'speed', per: 0.015 },
    desc: '风阵环绕，每级动作速度 +1.5%。', cost: { gold: 1000, wood: 130, stone: 110 }, out: null },
  { id: 'tannery', name: '皮坊',  icon: '🧵', terrain: 'forest', req: 32, bonus: { key: 'hp', per: 0.015 },
    desc: '鞣皮制甲，每级生命上限 +1.5%。', cost: { gold: 1500, wood: 160, stone: 160 }, out: null },
  { id: 'arborist', name: '修木院', icon: '🌲', terrain: 'forest', req: 38,
    desc: '养护灵木，木材 +9/分。', cost: { gold: 1800, wood: 190, stone: 190 }, out: { wood: 9 } },
  { id: 'spiritgrove', name: '灵木林', icon: '🌱', terrain: 'forest', req: 48,
    desc: '灵木成荫，木材 +12/分、灵力 +2/分。', cost: { gold: 2450, wood: 240, stone: 240 }, out: { wood: 12, spirit: 2 } },
  { id: 'druidcircle', name: '祭木坛', icon: '🗿', terrain: 'forest', req: 58, bonus: { key: 'growth', per: 0.02 },
    desc: '祭木祈福，每级灵植生长 +2%。', cost: { gold: 3050, wood: 250, stone: 250 }, out: null },
  { id: 'worldtree', name: '建木台', icon: '🎋', terrain: 'forest', req: 80, bonus: { key: 'xp', per: 0.008 },
    desc: '建木通神，每级全技能经验 +0.8%。', cost: { gold: 4500, wood: 280, stone: 280 }, out: null },

  /* -------------------------------------------------------- 山岳 mountain */
  { id: 'quarry', name: '采石场', icon: '⛏️', color: '#9aa4b8', terrain: 'mountain', req: 2,
    desc: '开山取石，为营造提供石料。', cost: { gold: 80, wood: 25, stone: 10 }, out: { stone: 6 } },
  { id: 'stonepit', name: '石坑', icon: '⛏️', terrain: 'mountain', req: 5,
    desc: '浅坑取石，石料 +5/分。', cost: { gold: 220, wood: 25, stone: 25 }, out: { stone: 5 } },
  { id: 'mine',   name: '矿洞',   icon: '🕳️', terrain: 'mountain', req: 8,
    desc: '深井掘脉，石料 +6/分、灵石 +2/分。', cost: { gold: 340, wood: 40, stone: 40 }, out: { stone: 6, gold: 2 } },
  { id: 'smelter', name: '熔炉',  icon: '♨️', terrain: 'mountain', req: 14,
    desc: '熔炼矿石，灵石 +3/分。', cost: { gold: 580, wood: 70, stone: 70 }, out: { gold: 3 } },
  { id: 'forge',  name: '锻坊',   icon: '🔨', terrain: 'mountain', req: 22, bonus: { key: 'atk', per: 0.008 },
    desc: '锻造兵刃，每级攻击 +0.8%。', cost: { gold: 960, wood: 110, stone: 110 }, out: null },
  { id: 'bastion', name: '磐石堡', icon: '🏰', terrain: 'mountain', req: 30, bonus: { key: 'def', per: 0.015 },
    desc: '坚壁如磐，每级防御 +1.5%。', cost: { gold: 1400, wood: 150, stone: 150 }, out: null },
  { id: 'clinic', name: '药庐',   icon: '💊', color: '#d98ca0', terrain: 'mountain', req: 36, bonus: { key: 'hp', per: 0.04 },
    desc: '修士疗伤之所，每级生命上限 +4%。', cost: { gold: 1300, wood: 140, stone: 150 }, out: null },
  { id: 'quarrymill', name: '石碾坊', icon: '🧱', terrain: 'mountain', req: 44,
    desc: '碾石成料，石料 +10/分。', cost: { gold: 2150, wood: 220, stone: 220 }, out: { stone: 10 } },
  { id: 'armory', name: '藏兵阁', icon: '🗡️', color: '#e0906a', terrain: 'mountain', req: 52, bonus: { key: 'hit', per: 0.02 },
    desc: '兵刃齐备，招式精准，每级命中 +2%。', cost: { gold: 2100, wood: 175, stone: 175 }, out: null },
  { id: 'ironvein', name: '铁脉井', icon: '⚙️', terrain: 'mountain', req: 56,
    desc: '铁脉涌泉，灵石 +6/分。', cost: { gold: 2950, wood: 250, stone: 250 }, out: { gold: 6 } },
  { id: 'turtlewall', name: '玄龟壁', icon: '🛡️', color: '#8a9ab8', terrain: 'mountain', req: 68, bonus: { key: 'def', per: 0.03 },
    desc: '仿玄龟背甲立壁，每级防御 +3%。', cost: { gold: 2600, wood: 210, stone: 230 }, out: null },
  { id: 'earthaltar', name: '镇岳坛', icon: '🏔️', terrain: 'mountain', req: 70, bonus: { key: 'hp', per: 0.02 },
    desc: '镇压地脉，每级生命上限 +2%。', cost: { gold: 3800, wood: 270, stone: 270 }, out: null },
  { id: 'ninepeak', name: '九嶂台', icon: '⛰️', terrain: 'mountain', req: 90, bonus: { key: 'def', per: 0.02 },
    desc: '九峰镇守，每级防御 +2%。', cost: { gold: 5300, wood: 300, stone: 300 }, out: null },

  /* ------------------------------------------------------ 水泽 waterside */
  { id: 'dock',   name: '渡口',   icon: '⚓', terrain: 'waterside', req: 4,
    desc: '渔舟唱晚，粮食 +4/分。', cost: { gold: 180, wood: 22, stone: 22 }, out: { food: 4 } },
  { id: 'fishpond', name: '鱼塘', icon: '🐟', terrain: 'waterside', req: 7,
    desc: '灵鱼满塘，粮食 +6/分。', cost: { gold: 300, wood: 35, stone: 35 }, out: { food: 6 } },
  { id: 'lotuspond', name: '莲池', icon: '🌸', terrain: 'waterside', req: 10,
    desc: '莲开见性，灵力 +3/分。', cost: { gold: 420, wood: 50, stone: 50 }, out: { spirit: 3 } },
  { id: 'well',   name: '灵脉井', icon: '🌀', color: '#66c4d9', terrain: 'waterside', req: 16,
    desc: '引地脉灵气入井，被动产出灵力。', cost: { gold: 600, wood: 80, stone: 80 }, out: { spirit: 15 } },
  { id: 'spring', name: '灵泉',   icon: '💧', terrain: 'waterside', req: 18,
    desc: '泉眼通灵，灵力 +8/分。', cost: { gold: 760, wood: 90, stone: 90 }, out: { spirit: 8 } },
  { id: 'tidegate', name: '潮闸', icon: '🌊', terrain: 'waterside', req: 26, bonus: { key: 'regen', per: 0.02 },
    desc: '潮息养身，每级脱战回血 +2%。', cost: { gold: 1160, wood: 130, stone: 130 }, out: null },
  { id: 'pearlshed', name: '珠坊', icon: '🦪', terrain: 'waterside', req: 34, bonus: { key: 'gold', per: 0.008 },
    desc: '珠贝成宝，每级灵石收益 +0.8%。', cost: { gold: 1600, wood: 170, stone: 170 }, out: null },
  { id: 'rainaltar', name: '祈雨坛', icon: '🌧️', terrain: 'waterside', req: 42,
    desc: '祷雨润田，粮食 +12/分。', cost: { gold: 2000, wood: 210, stone: 210 }, out: { food: 12 } },
  { id: 'mistlake', name: '雾隐湖', icon: '🌫️', terrain: 'waterside', req: 54,
    desc: '雾锁灵湖，灵力 +14/分。', cost: { gold: 2800, wood: 250, stone: 250 }, out: { spirit: 14 } },
  { id: 'dragonpalace', name: '龙宫', icon: '🐉', terrain: 'waterside', req: 66, bonus: { key: 'spirit', per: 0.02 },
    desc: '龙脉吐灵，每级灵力凝聚 +2%。', cost: { gold: 3550, wood: 260, stone: 260 }, out: null },
  { id: 'watermirror', name: '水镜台', icon: '🔮', terrain: 'waterside', req: 78, bonus: { key: 'regen', per: 0.03 },
    desc: '心澄如镜，每级脱战回血 +3%。', cost: { gold: 4350, wood: 280, stone: 280 }, out: null },
  { id: 'deepabyss', name: '归墟渊', icon: '🌌', terrain: 'waterside', req: 88,
    desc: '渊底藏星，星砂 +3/分。', cost: { gold: 5100, wood: 300, stone: 300 }, out: { stardust: 3 } },
  { id: 'seacalling', name: '沧海阁', icon: '🐚', terrain: 'waterside', req: 96, bonus: { key: 'xp', per: 0.006 },
    desc: '沧海遗珠，每级全技能经验 +0.6%。', cost: { gold: 5900, wood: 320, stone: 320 }, out: null },

  /* ---------------------------------------------------------- 荒漠 desert */
  { id: 'oasis',  name: '绿洲',   icon: '🌴', terrain: 'desert', req: 12,
    desc: '沙中甘泉，粮食 +5/分、灵力 +2/分。', cost: { gold: 500, wood: 60, stone: 60 }, out: { food: 5, spirit: 2 } },
  { id: 'caravan', name: '驼队',  icon: '🐪', terrain: 'desert', req: 20,
    desc: '商队往来，灵石 +3/分。', cost: { gold: 860, wood: 100, stone: 100 }, out: { gold: 3 } },
  { id: 'saltflat', name: '盐场', icon: '🧂', terrain: 'desert', req: 26,
    desc: '晒卤成盐，灵石 +5/分。', cost: { gold: 1160, wood: 130, stone: 130 }, out: { gold: 5 } },
  { id: 'bazaar', name: '大市集', icon: '⛺', terrain: 'desert', req: 30, bonus: { key: 'sell', per: 0.01 },
    desc: '四方交易，每级出售价 +1%。', cost: { gold: 1400, wood: 150, stone: 150 }, out: null },
  { id: 'market', name: '商行',   icon: '🏪', color: '#e0a06a', terrain: 'desert', req: 34, bonus: { key: 'sell', per: 0.015 },
    desc: '货通四海，每级出售价 +1.5%。', cost: { gold: 1400, wood: 160, stone: 160 }, out: null },
  { id: 'spicehouse', name: '香料铺', icon: '🌶️', terrain: 'desert', req: 40, bonus: { key: 'gold', per: 0.012 },
    desc: '奇香值钱，每级灵石收益 +1.2%。', cost: { gold: 1900, wood: 200, stone: 200 }, out: null },
  { id: 'silkroad', name: '丝路驿站', icon: '🐎', terrain: 'desert', req: 50, bonus: { key: 'speed', per: 0.01 },
    desc: '驿马如飞，每级动作速度 +1%。', cost: { gold: 2600, wood: 240, stone: 240 }, out: null },
  { id: 'tomb',   name: '古墓',   icon: '⚱️', terrain: 'desert', req: 58, bonus: { key: 'drop', per: 0.015 },
    desc: '古墓寻宝，每级掉落率 +1.5%。', cost: { gold: 3050, wood: 250, stone: 250 }, out: null },
  { id: 'mirage', name: '蜃楼',   icon: '🏜️', terrain: 'desert', req: 68, bonus: { key: 'ev', per: 0.01 },
    desc: '虚实难辨，每级闪避 +1%。', cost: { gold: 3650, wood: 260, stone: 260 }, out: null },
  { id: 'sandtower', name: '沙塔', icon: '🗼', terrain: 'desert', req: 76, bonus: { key: 'hit', per: 0.008 },
    desc: '高处瞭敌，每级命中 +0.8%。', cost: { gold: 4200, wood: 280, stone: 280 }, out: null },
  { id: 'treasurecave', name: '藏宝洞', icon: '🗝️', terrain: 'desert', req: 84, bonus: { key: 'drop', per: 0.02 },
    desc: '洞藏珍宝，每级掉落率 +2%。', cost: { gold: 4800, wood: 290, stone: 290 }, out: null },
  { id: 'goldenterrace', name: '黄金台', icon: '🏵️', terrain: 'desert', req: 94, bonus: { key: 'gold', per: 0.02 },
    desc: '金台悬赏，每级灵石收益 +2%。', cost: { gold: 5700, wood: 310, stone: 310 }, out: null },

  /* --------------------------------------------------------- 火山 volcano */
  { id: 'lavaforge', name: '熔岩坊', icon: '🌋', terrain: 'volcano', req: 10,
    desc: '熔岩凝石，石料 +4/分、灵石 +2/分。', cost: { gold: 420, wood: 50, stone: 50 }, out: { stone: 4, gold: 2 } },
  { id: 'ashfield', name: '灰烬田', icon: '🔥', terrain: 'volcano', req: 16,
    desc: '火山灰肥，石料 +6/分。', cost: { gold: 660, wood: 80, stone: 80 }, out: { stone: 6 } },
  { id: 'candlekeep', name: '烛照阁', icon: '🕯️', terrain: 'volcano', req: 22, bonus: { key: 'atk', per: 0.006 },
    desc: '烛照心火，每级攻击 +0.6%。', cost: { gold: 960, wood: 110, stone: 110 }, out: null },
  { id: 'magmaforge', name: '岩浆炉', icon: '⚒️', terrain: 'volcano', req: 28, bonus: { key: 'atk', per: 0.008 },
    desc: '岩浆淬兵，每级攻击 +0.8%。', cost: { gold: 1260, wood: 140, stone: 140 }, out: null },
  { id: 'obsidianhall', name: '黑曜堂', icon: '🖤', terrain: 'volcano', req: 34, bonus: { key: 'def', per: 0.008 },
    desc: '黑曜护体，每级防御 +0.8%。', cost: { gold: 1600, wood: 170, stone: 170 }, out: null },
  { id: 'flametower', name: '焚天塔', icon: '🔔', terrain: 'volcano', req: 42, bonus: { key: 'atk', per: 0.01 },
    desc: '焚天炽焰，每级攻击 +1%。', cost: { gold: 2000, wood: 210, stone: 210 }, out: null },
  { id: 'dragonkiln', name: '龙窑', icon: '🐲', terrain: 'volcano', req: 48,
    desc: '龙息烧瓷，灵石 +8/分。', cost: { gold: 2450, wood: 240, stone: 240 }, out: { gold: 8 } },
  { id: 'phoenixnest', name: '凤巢', icon: '🦅', terrain: 'volcano', req: 56, bonus: { key: 'hp', per: 0.015 },
    desc: '涅槃重生，每级生命上限 +1.5%。', cost: { gold: 2950, wood: 250, stone: 250 }, out: null },
  { id: 'barracks', name: '演武场', icon: '⚔️', color: '#e07a6a', terrain: 'volcano', req: 60, bonus: { key: 'atk', per: 0.02 },
    desc: '操练门人武艺，每级攻击与防御 +2%。', cost: { gold: 1800, wood: 180, stone: 180 }, out: null },
  { id: 'waraltar', name: '战魂坛', icon: '💀', terrain: 'volcano', req: 64, bonus: { key: 'atk', per: 0.012 },
    desc: '战魂附体，每级攻击 +1.2%。', cost: { gold: 3400, wood: 260, stone: 260 }, out: null },
  { id: 'hellpit', name: '炎魔窟', icon: '😈', terrain: 'volcano', req: 72, bonus: { key: 'drop', per: 0.012 },
    desc: '魔窟夺宝，每级掉落率 +1.2%。', cost: { gold: 3900, wood: 270, stone: 270 }, out: null },
  { id: 'solartemple', name: '大日殿', icon: '☀️', terrain: 'volcano', req: 82, bonus: { key: 'atk', per: 0.014 },
    desc: '大日焚天，每级攻击 +1.4%。', cost: { gold: 4650, wood: 290, stone: 290 }, out: null },

  /* ------------------------------------------------------------- 雪原 snow */
  { id: 'icehouse', name: '冰窖', icon: '🧊', terrain: 'snow', req: 4,
    desc: '藏冰保鲜，粮食 +4/分。', cost: { gold: 180, wood: 22, stone: 22 }, out: { food: 4 } },
  { id: 'furhut', name: '皮裘屋', icon: '🧥', terrain: 'snow', req: 8, bonus: { key: 'hp', per: 0.01 },
    desc: '裘衣御寒，每级生命上限 +1%。', cost: { gold: 340, wood: 40, stone: 40 }, out: null },
  { id: 'glacier', name: '冰川',  icon: '❄️', terrain: 'snow', req: 14,
    desc: '寒川凝灵，灵力 +4/分、星砂 +1/分。', cost: { gold: 580, wood: 70, stone: 70 }, out: { spirit: 4, stardust: 1 } },
  { id: 'starwatch', name: '观星哨', icon: '⭐', terrain: 'snow', req: 20, bonus: { key: 'mastery', per: 0.006 },
    desc: '夜哨观星，每级精通经验 +0.6%。', cost: { gold: 860, wood: 100, stone: 100 }, out: null },
  { id: 'academy', name: '书院',  icon: '📚', color: '#9a8ce0', terrain: 'snow', req: 24, bonus: { key: 'xp', per: 0.01 },
    desc: '教习弟子修行，每级全技能经验 +1%。', cost: { gold: 900, wood: 120, stone: 120 }, out: null },
  { id: 'frostpond', name: '寒潭', icon: '💠', terrain: 'snow', req: 30,
    desc: '寒潭映月，灵力 +8/分。', cost: { gold: 1400, wood: 150, stone: 150 }, out: { spirit: 8 } },
  { id: 'observatory', name: '观星台', icon: '🌠', color: '#a98be0', terrain: 'snow', req: 46,
    desc: '夜观天象推演星轨，被动产出星砂。', cost: { gold: 2400, wood: 200, stone: 200 }, out: { stardust: 4 } },
  { id: 'aurora', name: '极光台', icon: '🌈', terrain: 'snow', req: 58,
    desc: '极光垂照，星砂 +6/分。', cost: { gold: 3050, wood: 250, stone: 250 }, out: { stardust: 6 } },
  { id: 'polestar', name: '北极星台', icon: '✨', terrain: 'snow', req: 64, bonus: { key: 'mastery', per: 0.012 },
    desc: '众星拱极，每级精通经验 +1.2%。', cost: { gold: 3400, wood: 260, stone: 260 }, out: null },
  { id: 'library', name: '藏经阁', icon: '📖', color: '#b09ae0', terrain: 'snow', req: 76, bonus: { key: 'mastery', per: 0.03 },
    desc: '典籍浩如烟海，每级精通经验 +3%。', cost: { gold: 3200, wood: 230, stone: 230 }, out: null },
  { id: 'voidaltar', name: '太虚台', icon: '🌙', color: '#a9a2e0', terrain: 'snow', req: 86,
    desc: '引太虚星光落台，被动产出星砂 +12/分。', cost: { gold: 4000, wood: 260, stone: 260 }, out: { stardust: 12 } },
  { id: 'skypalace', name: '凌霄殿', icon: '☁️', terrain: 'snow', req: 92, bonus: { key: 'xp', per: 0.012 },
    desc: '云端清修，每级全技能经验 +1.2%。', cost: { gold: 5500, wood: 310, stone: 310 }, out: null },

  /* ----------------------------------------------------------- 秘境 mystic */
  { id: 'meditationcave', name: '石室', icon: '🕉️', terrain: 'mystic', req: 6, bonus: { key: 'cultxp', per: 0.01 },
    desc: '僻室静坐，每级打坐修为 +1%。', cost: { gold: 260, wood: 30, stone: 30 }, out: null },
  { id: 'zen',    name: '静心堂', icon: '📿', color: '#8fb8a8', terrain: 'mystic', req: 12, bonus: { key: 'cultxp', per: 0.02 },
    desc: '清修静室，每级打坐修为 +2%。', cost: { gold: 500, wood: 70, stone: 70 }, out: null },
  { id: 'talismanhall', name: '符箓堂', icon: '📜', terrain: 'mystic', req: 18, bonus: { key: 'drop', per: 0.008 },
    desc: '符箓护身，每级掉落率 +0.8%。', cost: { gold: 760, wood: 90, stone: 90 }, out: null },
  { id: 'arrayroom', name: '阵眼室', icon: '🔯', terrain: 'mystic', req: 22, bonus: { key: 'speed', per: 0.008 },
    desc: '阵眼流转，每级动作速度 +0.8%。', cost: { gold: 960, wood: 110, stone: 110 }, out: null },
  { id: 'gravitytower', name: '引力塔', icon: '🛰️', color: '#7fb0d8', terrain: 'mystic', req: 1, bonus: { key: 'planet', per: 0.01 },
    desc: '引力牵引天体，每级穿越星球的物品生成速度 +1%。', cost: { gold: 1200, wood: 130, stone: 130 }, out: null },
  { id: 'runepool', name: '铭文池', icon: '🔷', terrain: 'mystic', req: 32, bonus: { key: 'buildcost', per: 0.008 },
    desc: '铭文省料，每级建造费用 −0.8%。', cost: { gold: 1500, wood: 160, stone: 160 }, out: null },
  { id: 'soulwell', name: '养魂井', icon: '🌑', terrain: 'mystic', req: 40, bonus: { key: 'cultxp', per: 0.015 },
    desc: '养魂聚魄，每级打坐修为 +1.5%。', cost: { gold: 1900, wood: 200, stone: 200 }, out: null },
  { id: 'treasury', name: '宝库', icon: '💎', color: '#8fd8e0', terrain: 'mystic', req: 44, bonus: { key: 'drop', per: 0.03 },
    desc: '宝物汇聚之地，每级掉落率 +3%。', cost: { gold: 1700, wood: 160, stone: 170 }, out: null },
  { id: 'voidgate', name: '虚空门', icon: '🌀', terrain: 'mystic', req: 52, bonus: { key: 'cultxp', per: 0.02 },
    desc: '虚空吐纳，每级打坐修为 +2%。', cost: { gold: 2700, wood: 240, stone: 240 }, out: null },
  { id: 'ghostmine', name: '阴矿洞', icon: '👻', terrain: 'mystic', req: 60,
    desc: '阴矿幽采，石料 +8/分、灵石 +4/分。', cost: { gold: 3150, wood: 250, stone: 250 }, out: { stone: 8, gold: 4 } },
  { id: 'spiritlantern', name: '灵灯阁', icon: '🏮', terrain: 'mystic', req: 72, bonus: { key: 'spirit', per: 0.015 },
    desc: '灵灯长明，每级灵力凝聚 +1.5%。', cost: { gold: 3900, wood: 270, stone: 270 }, out: null },
  { id: 'heavenpillar', name: '通天柱', icon: '⛩️', terrain: 'mystic', req: 90, bonus: { key: 'xp', per: 0.015 },
    desc: '通天问道，每级全技能经验 +1.5%。', cost: { gold: 5300, wood: 300, stone: 300 }, out: null },
  { id: 'works', name: '营造司', icon: '🏗️', color: '#c0a878', terrain: 'mystic', req: 96, bonus: { key: 'buildcost', per: 0.015 },
    desc: '统筹匠作，每级建造费用 −1.5%（至多 −60%）。', cost: { gold: 5900, wood: 320, stone: 320 }, out: null },

  /* ------------------------------------------------------ 信徒招募（特殊） */
  { id: 'summonhall', name: '招贤殿', icon: '🏛️', color: '#b98ce0', terrain: 'mystic', req: 1,
    special: 'disciple',
    desc: '广纳信徒，信徒可入驻上阵；每级信徒仓库 +3，并解锁更高品阶的招募。',
    cost: { gold: 700, wood: 80, stone: 80 }, out: null }
];

/* =========================================================================
 * 信徒（招募 · 上阵）
 * 信徒视作"装备"：上阵位数 = 招贤殿等级（每级 1 位），各提供不同的常驻加成。
 * 总数（仓库 + 上阵）受招贤殿等级限制；品阶上限同样由招贤殿等级决定。
 * ========================================================================= */
const DISCIPLE = {
  SLOTS_PER_LVL: 1,      // 上阵位数 = 招贤殿等级 × 该值（未建造时为 0，即无法上阵）
  BASE_STORE: 2,         // 招贤殿 Lv.1 时的信徒总容量（含上阵）
  STORE_PER_LVL: 3,      // 每提升一级 +3 容量
  RECRUIT_BASE: 600,     // 首次招募的灵石花费
  RECRUIT_GROW: 1.12,    // 每多一位信徒，招募费 ×1.12
  /* 索引 = 招贤殿等级 − 1，值 = 可招募的最高品阶（超出表长则取末项） */
  TIER_BY_HALL: [1, 2, 2, 3, 3, 3, 3, 4, 4, 4]
};

const DISCIPLE_TIERS = {
  1: { name: '凡品', color: '#8fbf8f', weight: 55 },
  2: { name: '灵品', color: '#6fb7e0', weight: 30 },
  3: { name: '仙品', color: '#c58ae0', weight: 12 },
  4: { name: '神品', color: '#e0b060', weight: 3 }
};

/* bonus 的 k 支持：speed_<技能ID>（该技能动作速度）、speed（全局动作速度）、
   atk / def / hit / ev / hp（战斗属性）、xp / cultxp（经验与修为）、
   gold / sell（灵石收益与出售价）、drop（掉落）、mastery（精通）、double（额外产出）、
   spirit（灵力凝聚）、regen（脱战回血） */
const DISCIPLES = [
  /* ---------------------------------------------------------- 凡品 tier 1 */
  { id: 'd_wood', name: '山樵客', icon: '🌲', tier: 1, bonus: [{ k: 'speed_woodcutting', v: 0.03 }],
    desc: '山间老樵，伐木手法利落。' },
  { id: 'd_fish', name: '溪畔渔翁', icon: '🎣', tier: 1, bonus: [{ k: 'speed_fishing', v: 0.03 }],
    desc: '垂钓半生，知晓鱼汛。' },
  { id: 'd_mine', name: '挑山工', icon: '⛏️', tier: 1, bonus: [{ k: 'speed_mining', v: 0.03 }],
    desc: '肩挑千斤，凿石如泥。' },
  { id: 'd_herb', name: '药圃童子', icon: '🌿', tier: 1, bonus: [{ k: 'speed_herbalism', v: 0.03 }],
    desc: '自幼识草，辨药极准。' },
  { id: 'd_farm', name: '田舍翁', icon: '🌾', tier: 1, bonus: [{ k: 'speed_farming', v: 0.03 }],
    desc: '耕读传家，田地打理得当。' },
  { id: 'd_learn', name: '抄经生', icon: '📖', tier: 1, bonus: [{ k: 'xp', v: 0.03 }],
    desc: '日抄经文，助主上参悟。' },

  /* ---------------------------------------------------------- 灵品 tier 2 */
  { id: 'd_sword', name: '铸剑侍', icon: '⚔️', tier: 2, bonus: [{ k: 'atk', v: 0.05 }],
    desc: '随身佩剑，攻伐凌厉。' },
  { id: 'd_guard', name: '护院武师', icon: '🛡️', tier: 2, bonus: [{ k: 'def', v: 0.05 }],
    desc: '铁盾护主，临阵不避。' },
  { id: 'd_alchemy', name: '丹房童子', icon: '⚗️', tier: 2, bonus: [{ k: 'speed_alchemy', v: 0.06 }],
    desc: '守炉三载，丹火纯熟。' },
  { id: 'd_smith', name: '炉前匠', icon: '🔥', tier: 2, bonus: [{ k: 'speed_smelting', v: 0.06 }],
    desc: '控火精准，熔炼极快。' },
  { id: 'd_gold', name: '账房先生', icon: '📿', tier: 2, bonus: [{ k: 'gold', v: 0.05 }],
    desc: '精于算计，灵石来路更广。' },

  /* ---------------------------------------------------------- 仙品 tier 3 */
  { id: 'd_blade', name: '剑奴', icon: '🗡️', tier: 3, bonus: [{ k: 'atk', v: 0.10 }, { k: 'hit', v: 0.04 }],
    desc: '剑意入骨，一击必中。' },
  { id: 'd_medic', name: '药王侍', icon: '💊', tier: 3, bonus: [{ k: 'regen', v: 0.10 }, { k: 'hp', v: 0.06 }],
    desc: '随身百草，气血自复。' },
  { id: 'd_star', name: '观星道人', icon: '🔭', tier: 3, bonus: [{ k: 'cultxp', v: 0.10 }],
    desc: '夜观天象，助主上悟道。' },
  { id: 'd_trade', name: '商盟执事', icon: '💰', tier: 3, bonus: [{ k: 'gold', v: 0.10 }, { k: 'sell', v: 0.05 }],
    desc: '八面玲珑，货卖善价。' },
  { id: 'd_array', name: '阵眼守卫', icon: '🔯', tier: 3, bonus: [{ k: 'ev', v: 0.08 }, { k: 'def', v: 0.06 }],
    desc: '守阵不移，身法飘忽。' },

  /* ---------------------------------------------------------- 神品 tier 4 */
  { id: 'd_incense', name: '香火金身', icon: '✨', tier: 4, bonus: [{ k: 'xp', v: 0.15 }],
    desc: '受万家香火，道韵加身。' },
  { id: 'd_thunder', name: '雷部力士', icon: '⚡', tier: 4, bonus: [{ k: 'atk', v: 0.18 }, { k: 'hit', v: 0.08 }],
    desc: '雷法在身，出手如霆。' },
  { id: 'd_crane', name: '白鹤童子', icon: '🕊️', tier: 4, bonus: [{ k: 'speed', v: 0.12 }],
    desc: '御鹤随行，万事皆快。' },
  { id: 'd_immortal', name: '剑仙遗蜕', icon: '🌠', tier: 4, bonus: [{ k: 'mastery', v: 0.20 }, { k: 'double', v: 0.05 }],
    desc: '一缕剑仙残念，助你精进诸艺。' }
];

function findDisciple(id) {
  for (let i = 0; i < DISCIPLES.length; i++) if (DISCIPLES[i].id === id) return DISCIPLES[i];
  return null;
}

/* 招贤殿等级 → 可招募的最高品阶（0 级 = 未解锁） */
function discipleTierByHall(lv) {
  const n = Math.floor(lv) || 0;
  if (n <= 0) return 0;
  const i = Math.min(n - 1, DISCIPLE.TIER_BY_HALL.length - 1);
  return DISCIPLE.TIER_BY_HALL[i];
}

function findBuilding(id) {
  for (let i = 0; i < BUILDINGS.length; i++) if (BUILDINGS[i].id === id) return BUILDINGS[i];
  return null;
}

function findTerrain(id) {
  for (let i = 0; i < TERRAINS.length; i++) if (TERRAINS[i].id === id) return TERRAINS[i];
  return null;
}

/* 地形解锁门槛 = 该地形内最低的建筑门槛 */
function terrainReq(tid) {
  let n = Infinity;
  for (let i = 0; i < BUILDINGS.length; i++) {
    if (BUILDINGS[i].terrain === tid && BUILDINGS[i].req < n) n = BUILDINGS[i].req;
  }
  return isFinite(n) ? n : 1;
}

/* 从 lvl 级升到 lvl+1 级的造价（0 级即首次建造）
   只有"开局就能建"的资源建筑（门槛 req ≤ 1，如灵田 / 民居 / 伐木坊 / 招贤殿）
   首次建造免木材与石料、只收灵石；其余建筑首建照常收取三资源，
   否则洞天开局没有木/石产出，会被卡死在第一座产石建筑之前。 */
function buildCost(b, lvl) {
  const m = Math.pow(WORLD.COST_MUL, lvl);
  const out = {
    gold: Math.floor(b.cost.gold * m),
    wood: Math.floor(b.cost.wood * m),
    stone: Math.floor(b.cost.stone * m)
  };
  if (lvl <= 0 && b.req <= 1) {
    out.wood = 0;
    out.stone = 0;
  }
  return out;
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
  const n = Math.max(1, Math.min(Math.floor(lvl) || 1, TOTAL_STAGES));
  if (n <= STAGES.length) return STAGES[n - 1];
  return taishangStage(n - STAGES.length - 1);
}

/* 第 idx 阶（0 起）的突破信息，终点阶（太上境最高层）返回 null */
function breakInfo(idx) {
  if (idx < 0 || idx >= TOTAL_STAGES) return null;
  if (idx < STAGES.length) {
    const st = STAGES[idx];
    return st.isMax ? null : st.breakInfo;
  }
  return taishangStage(idx - STAGES.length).breakInfo;
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

function findDungeon(id) {
  for (let i = 0; i < DUNGEONS.length; i++) if (DUNGEONS[i].id === id) return DUNGEONS[i];
  return null;
}

function findTask(id) {
  for (let i = 0; i < TASKS.length; i++) if (TASKS[i].id === id) return TASKS[i];
  return null;
}

/* =========================================================================
 * 穿越星球（主动动作 · 小游戏式收益）
 * 在面板点击「开启运转」后占用全局动作槽，四周生成灵石 / 星砂 / 已解锁材料；
 * 抵达星球时消耗 SPIRIT_COST 灵力并入账，灵力不足则停在星球边缘等待恢复。
 * 点击面板可让生成与飞行速度翻倍，每次 +BOOST_ADD 秒，仅在运转期间生效。
 * 加速上限 = BOOST_BASE_CAP + BOOST_GT_BONUS × 引力塔等级（未建造时按 0 级计算）。
 * 三种产物的权重：灵石 50% / 星砂 30% / 已解锁材料 20%。
 * ========================================================================= */
const PLANET = {
  SPAWN_BASE: 1.8,        /* 基础生成间隔（秒） */
  FLIGHT_TIME: 4.8,       /* 基础飞行时长（秒） */
  MAX_ITEMS: 24,          /* 同屏最多飞行中的物品数 */
  BOOST_MULT: 2,          /* 加速倍率（生成与飞行都翻倍） */
  BOOST_ADD: 4,           /* 每次点击增加秒数 */
  BOOST_BASE_CAP: 60,     /* 基础加速时长上限（秒，未建引力塔时） */
  BOOST_GT_BONUS: 5,      /* 引力塔每级增加的加速上限（秒） */
  SPIRIT_COST: 0.5,       /* 每吸收 1 件物品消耗的灵力（调平衡只改这里） */
  /* 灵气浓度：独立于灵力的第二资源，每次「生成」物品时消耗，触底停止生成。
     上限与恢复速率随洞天「引力塔」等级成长，避免后期成为硬卡点。 */
  AURA_CAP_BASE: 100,     /* 灵气浓度上限基础值（未建引力塔） */
  AURA_CAP_GT: 20,        /* 引力塔每级 +20 上限 */
  AURA_REGEN_BASE: 2.0,   /* 每秒基础恢复（不占用动作槽，未运转时也会恢复） */
  AURA_REGEN_GT: 0.2,     /* 引力塔每级 +0.2/s 恢复 */
  AURA_COST: 2,           /* 每生成 1 件飞行物消耗的浓度 */
  AURA_MIN: 1,            /* 非零下限：浓度永远不会到 0，触底后停止生成并提示 */
  /* 穿越价格：1000 × 1.6^(n-1)，第 10 次起改为 ×1.12 的缓坡。
     n = 本次是第几次穿越（1 起算）。见 document/机制-穿越星球.md。 */
  CROSS_BASE: 1000,
  CROSS_KNEE: 10,         /* 前 10 次用快速段 */
  CROSS_GROW_EARLY: 1.6,
  CROSS_GROW_LATE: 1.12,
  W_GOLD: 0.5,            /* 灵石权重 */
  W_STAR: 0.3,            /* 星砂权重 */
  W_MAT: 0.2,             /* 材料权重 */
  GOLD_MIN: 2,
  GOLD_MAX: 6,
  STAR_MIN: 1,
  STAR_MAX: 2,
  MAT_MIN: 1,
  MAT_MAX: 2
};

/* 朝代序列：索引 = 穿越次数（0 = 起始清朝）。
   索引 10 为夏朝；之后按 古一纪 / 古二纪 / … 由 planetDynastyName 数值生成，
   不在此处写死有限列表。 */
const DYNASTY_NAMES = [
  '清朝', '明朝', '元朝', '宋朝', '唐朝', '南北朝',
  '两晋', '三国', '周朝', '商朝', '夏朝'
];
