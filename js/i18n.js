'use strict';

/* =========================================================================
 * 穿越星球 · 国际化（v2.23.0）
 * 零依赖：以中文原文为 key 的英文字典；未收录的文案自动回退中文，
 * 因此后续新增文案不会因为漏翻译而报错。
 * 语言存 state.lang（'zh' | 'en'），随存档持久化。
 * ========================================================================= */

const I18N_EN = {
  /* ---- 静态界面 ---- */
  '💰': '💰',
  '穿越星球': 'Planet Crossing',
  '灵气疗伤 (25 灵力)': 'Heal (25 Spirit)',
  '保存': 'Save',
  '📖 问道指引': '📖 Guide',
  '收起提示': 'Collapse',
  '前往': 'Go',
  '清单': 'List',
  '跳过': 'Skip',
  '危险操作': 'Dangerous',
  '此操作不可恢复': 'This cannot be undone',
  '确认': 'Confirm',
  '取消': 'Cancel',
  '游戏版本': 'Game version',

  /* ---- 顶栏 ---- */
  '灵石': 'Spirit Stones',
  '灵力': 'Spirit',
  '星砂': 'Stardust',
  '生命之种': 'Seed of Life',
  '境界': 'Realm',
  '伤害': 'Damage',
  '命中': 'Hit',
  '减伤': 'Damage Reduction',

  /* ---- 侧栏 ---- */
  '主要': 'Main',
  '修炼': 'Cultivation',
  '战斗': 'Combat',
  '生产': 'Production',
  '洞天与朝代': 'Grotto & Dynasties',
  '系统': 'System',
  '其他': 'Other',
  '任务': 'Quests',
  '成就与奖励': 'Achievements & Rewards',
  '签到': 'Check-in',
  '系统时间异常': 'System clock anomaly',
  '明日再来': 'Come back tomorrow',
  '今日可领': 'Available today',
  '问道': 'Guide',
  '已完成': 'Completed',
  '可查阅': 'Viewable',
  '已跳过': 'Skipped',
  '新手引导': 'Tutorial',
  '背包': 'Bag',
  '市集': 'Market',
  '采买 · 出售': 'Buy · Sell',
  '灵石 · 星砂 · 材料': 'Stones · Stardust · Materials',
  '锁妖塔': 'Demon Tower',
  '战阵': 'Formation Battle',
  '需营造招贤殿': 'Requires Hall of Worthies',
  '世界': 'World',
  '洞天 · 建设度': 'Grotto · Development',
  '信徒': 'Disciples',
  '设置': 'Settings',
  '兑换码 · 通用': 'Redeem Code · General',
  '测试控制台': 'Dev Console',
  '仅本次运行有效': 'This session only',
  '上阵': 'Deployed',

  /* ---- 技能 ---- */
  '伐木': 'Woodcutting',
  '砍伐灵木，为炼器提供木材。': 'Chop spirit trees to supply wood for crafting.',
  '钓鱼': 'Fishing',
  '垂钓灵鱼，可食用回复生命。': 'Catch spirit fish; eat them to restore health.',
  '采矿': 'Mining',
  '开采矿石与灵石原矿。': 'Mine ore and raw spirit stone.',
  '熔炼': 'Smelting',
  '炼化矿石为锭，聚灵化灵力。': 'Refine ore into ingots and condense spirit.',
  '炼器': 'Crafting',
  '锻造法宝护具。': 'Forge artifacts and protective gear.',
  '采药': 'Herbalism',
  '采撷天地灵草，为炼丹准备药材。': 'Gather spirit herbs for alchemy.',
  '炼丹': 'Alchemy',
  '炼制各类丹药。': 'Refine various pills.',
  '讨伐妖兽，获取灵石与材料。': 'Hunt beasts for spirit stones and materials.',
  '打坐吐纳，积累修为，冲击境界。': 'Meditate to accumulate cultivation and break through realms.',
  '阵法': 'Formation',
  '观星推演天机，布设阵法为诸般修行加持。': 'Read the stars and set formations to empower your training.',
  '灵植': 'Farming',
  '种下灵草种子，悉心浇灌，收获炼丹上品。': 'Plant spirit seeds and harvest prime alchemy herbs.',
  '入世': 'Worldly Life',
  '混迹红尘百业，体验凡人生计——或有所得，或被识破驱离。': 'Work mortal trades for profit — or get exposed and driven off.',

  /* ---- 设置 ---- */
  '🔧 设置': '🔧 Settings',
  '兑换码、测试控制台与存档管理': 'Redeem codes, dev console and save management',
  '兑换码': 'Redeem Code',
  '输入兑换码': 'Enter redeem code',
  '兑换': 'Redeem',
  '输入兑换码以解锁对应内容。': 'Enter a redeem code to unlock content.',
  '已解锁': 'Unlocked',
  '🔬 测试控制台': '🔬 Dev Console',
  '当前运行已激活': 'Active this session',
  '打开控制台': 'Open Console',
  '刷新页面或重开游戏后失效，需要重新兑换。': 'Expires after refresh or restart; redeem again to unlock.',
  '通用': 'General',
  '界面语言': 'Interface Language',
  '切换后立即生效，并保存到存档。': 'Applies immediately and is saved to your save file.',
  '存档 · 危险操作': 'Save · Dangerous',
  '重开游戏': 'Reset Game',
  '清空当前存档与全部进度，且无法恢复': 'Erases the current save and all progress. Cannot be undone.',
  '⚠ 此操作会删除当前存档并从头开始；点击后仍需二次确认，建议先「保存」或备份存档。': '⚠ This deletes your save and starts over. A second confirmation is required; save or back up first.',

  /* ---- 背包 ---- */
  '🎒 背包': '🎒 Bag',
  '容量': 'Capacity',
  ' · 点击物品查看操作，背包满时产出会原地等待': ' · Click an item to act; output waits when the bag is full',
  '📦 当前容量': '📦 Capacity',
  ' · 已达上限': ' · Maxed',
  '容量已满': 'Capacity maxed',
  '扩容 +': 'Expand +',
  '全部': 'All',
  '材料': 'Materials',
  '食物': 'Food',
  '丹药': 'Pills',
  '装备': 'Equipment',
  '出售模式': 'Sell Mode',
  '出售数量': 'Sell Qty',
  '使用数量': 'Use Qty',
  '此处空无一物。': 'Nothing here.',
  '⚔️ 装备 · 每件词条独立': '⚔️ Equipment · each item rolls its own affixes',
  '无词条': 'No affixes',
  '该部位未装备': 'Nothing equipped in this slot',
  '对比当前：': 'Vs current: ',
  '无变化': 'No change',
  '无基础属性': 'No base stats',
  '卸下': 'Unequip',
  '空': 'Empty',
  '出售': 'Sell',
  '攻': 'ATK',
  '防': 'DEF',
  '命': 'HP',
  '中': 'HIT',
  '闪': 'EVA',

  /* ---- 市集 ---- */
  '🏪 市集': '🏪 Market',
  '以灵石采买物资，亦可在背包中出售物品': 'Buy goods with spirit stones; sell from the Bag.',
  '杂货铺': 'General Store',
  '丹药阁': 'Pill Pavilion',
  '装备坊': 'Equipment Shop',
  '持有': 'Held',
  '背包已满': 'Bag full',
  '灵石不足': 'Not enough stones',
  '需 ': 'Requires ',
  '出售说明': 'Selling',
  '最大': 'Max',
  '停止': 'Stop',
  '领取': 'Claim',

  /* ---- 右栏 / 装备 ---- */
  '角色': 'Character',
  '悟性': 'Insight',
  '突破': 'Breakthrough',
  '灵根五行：': 'Spiritual Roots: ',
  '生命上限': 'Max HP',
  '闪避': 'Evasion',
  '自动进食': 'Auto Eat',
  '自动（回复最高）': 'Auto (best heal)',
  '低于阈值且战斗中自动食用所选食物，不占用动作槽。': 'Eats the selected food in combat below the threshold; no action slot used.',
  '见闻': 'Journal',
  '清空': 'Clear',
  '尚无见闻。': 'No entries yet.',
  '法宝': 'Artifact',
  '灵甲': 'Armor',
  '法冠': 'Helm',
  '灵靴': 'Boots',
  '玉佩': 'Pendant',
  '灵戒': 'Ring',

  /* ---- 品质 / 词条 ---- */
  '凡品': 'Mortal',
  '灵品': 'Spirit',
  '玄品': 'Mystic',
  '地品': 'Earth',
  '天品': 'Heaven',
  '仙品': 'Immortal',
  '攻击': 'Attack',
  '防御': 'Defense',
  '工作速度': 'Work Speed',
  '经验获取': 'EXP Gain',
  '额外产出': 'Extra Output',
  '灵力恢复': 'Spirit Regen',
  '战斗掉落': 'Combat Drops',

  /* ---- 装备名 ---- */
  '铁剑': 'Iron Sword',
  '玄铁剑': 'Dark Iron Sword',
  '冰魄剑': 'Ice Soul Sword',
  '阳火剑': 'Yang Fire Sword',
  '御风剑': 'Windrider Sword',
  '神玉剑': 'Divine Jade Sword',
  '紫檀剑': 'Rosewood Sword',
  '建木剑': 'Jianmu Sword',
  '玄冥剑': 'Nether Sword',
  '天穹剑': 'Sky Dome Sword',
  '铁甲': 'Iron Armor',
  '玄铁甲': 'Dark Iron Armor',
  '冰魄甲': 'Ice Soul Armor',
  '阳火甲': 'Yang Fire Armor',
  '神玉甲': 'Divine Jade Armor',
  '天穹甲': 'Sky Dome Armor',
  '幽铁甲': 'Ghost Iron Armor',
  '铁冠': 'Iron Crown',
  '玄铁冠': 'Dark Iron Crown',
  '冰魄冠': 'Ice Soul Crown',
  '阳火冠': 'Yang Fire Crown',
  '神玉冠': 'Divine Jade Crown',
  '盘古冠': 'Pangu Crown',
  '扶桑冠': 'Fusang Crown',
  '昆仑冠': 'Kunlun Crown',
  '布靴': 'Cloth Boots',
  '疾风靴': 'Gale Boots',
  '冰履': 'Ice Treads',
  '踏炎靴': 'Flame Striders',
  '云虚步': 'Cloudstep Boots',
  '灵玉佩': 'Spirit Jade Pendant',
  '聚灵佩': 'Spirit Gathering Pendant',
  '冰心佩': 'Ice Heart Pendant',
  '阳火佩': 'Yang Fire Pendant',
  '神元佩': 'Divine Essence Pendant',
  '铁戒': 'Iron Ring',
  '玄铁戒': 'Dark Iron Ring',
  '冰魄戒': 'Ice Soul Ring',
  '阳火戒': 'Yang Fire Ring',
  '神玉戒': 'Divine Jade Ring',
  '混沌戒': 'Chaos Ring',
  '建木戒': 'Jianmu Ring',

  /* ---- 通用 ---- */
  '已臻圆满': 'Maxed',
  '经验': 'EXP',
  '修为': 'Cultivation',
  '无': 'None',
  '未知': 'Unknown'
};

function isEn() { return !!(typeof state !== 'undefined' && state && state.lang === 'en'); }

/* 以中文原文取译文；英文模式下未收录则回退原文（不会抛错） */
function t(s) {
  if (!isEn()) return s;
  if (s == null) return s;
  return Object.prototype.hasOwnProperty.call(I18N_EN, s) ? I18N_EN[s] : s;
}

function tFloor(n) { return isEn() ? ('Floor ' + n) : ('第 ' + n + ' 层'); }
function tStage(n) { return isEn() ? ('Stage ' + n) : ('第 ' + n + ' 阶'); }

/* 静态 DOM：index.html 里带 data-i18n / data-i18n-title 的元素 */
function applyStaticI18n() {
  const nodes = document.querySelectorAll('[data-i18n]');
  for (let i = 0; i < nodes.length; i++) {
    const key = nodes[i].getAttribute('data-i18n');
    nodes[i].textContent = t(key);
  }
  const titles = document.querySelectorAll('[data-i18n-title]');
  for (let j = 0; j < titles.length; j++) {
    const key = titles[j].getAttribute('data-i18n-title');
    titles[j].title = t(key);
  }
  const ver = (typeof VERSION === 'string' && VERSION) ? VERSION : '0.0.0';
  document.documentElement.lang = isEn() ? 'en' : 'zh-CN';
  document.title = isEn()
    ? ('Planet Crossing v' + ver + ' · Idle Cultivation')
    : ('穿越星球 v' + ver + ' · Planet Crossing');
  const verTag = document.getElementById('verTag');
  if (verTag) verTag.title = isEn() ? ('Game version v' + ver) : ('游戏版本 v' + ver);
}

/* 切换语言：落盘 + 静态文案 + 整树重绘（setHTML 签名会随文案变化自动重绘） */
function setLang(lang) {
  if (typeof state === 'undefined' || !state) return;
  const next = lang === 'en' ? 'en' : 'zh';
  if (state.lang !== next) {
    state.lang = next;
    if (typeof saveState === 'function') saveState();
  }
  applyStaticI18n();
  if (typeof renderAll === 'function') renderAll();
}
