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
  '首次穿越星球': 'First Planet Crossing',
  '穿越星球 · 巡航': 'Planet Crossing · Cruise',
  '🪐 穿越星球': '🪐 Planet Crossing',
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
  '中文': 'Chinese',
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

/* 分片字典（js/i18n-part-*.js）由构建期分批生成，统一并入总字典 */
if (typeof window !== 'undefined' && window.I18N_EXTRA) {
  Object.keys(window.I18N_EXTRA).forEach(function (k) {
    if (I18N_EN[k] === undefined) I18N_EN[k] = window.I18N_EXTRA[k];
  });
}

/* 术语表：用于字典未命中时的兜底替换（长词优先），保证英文模式不残留中文 */
const I18N_TERMS = {
  '修仙': 'Cultivation', '修真': 'Cultivation', '境界': 'Realm', '修为': 'Cultivation', '经验': 'EXP',
  '灵石': 'Spirit Stones', '灵力': 'Spirit', '星砂': 'Stardust', '粮食': 'Food', '木材': 'Wood', '石料': 'Stone',
  '人口': 'Population', '灵气': 'Aura', '生命': 'HP', '攻击': 'ATK', '防御': 'DEF', '命中': 'Hit', '闪避': 'Evasion',
  '暴击': 'Crit', '减伤': 'DR', '伤害': 'Damage', '速度': 'Speed', '冷却': 'Cooldown', '概率': 'Chance', '上限': 'Cap',
  '当前': 'Current ', '最大': 'Max ', '最低': 'Min ', '持续': 'Duration', '消耗': 'Cost', '回复': 'Restore', '获得': 'Gain',
  '产出': 'Output', '数量': 'Qty', '价格': 'Price', '库存': 'Stock', '解锁': 'Unlock', '锁定': 'Locked', '已': 'Already ',
  '未': 'Not ', '完成': 'Complete', '失败': 'Failed', '成功': 'Success', '初始': 'Initial', '额外': 'Extra', '双倍': 'Double',
  '全部': 'All', '自动': 'Auto', '手动': 'Manual', '技能': 'Skill', '任务': 'Quest', '奖励': 'Reward', '领取': 'Claim',
  '升级': 'Upgrade', '建造': 'Build', '建筑': 'Building', '信徒': 'Disciple', '战阵': 'Formation Battle', '阵法': 'Formation',
  '妖兽': 'Beast', '怪物': 'Monster', '裂缝': 'Rift', '穿越': 'Cross ', '星球': 'Planet', '商店': 'Shop', '市集': 'Market',
  '背包': 'Bag', '装备': 'Equipment', '材料': 'Material', '丹药': 'Pill', '食物': 'Food', '种子': 'Seed', '鱼': 'Fish',
  '矿': 'Ore', '锭': 'Ingot', '草': 'Herb', '木': 'Wood', '铁': 'Iron', '玉': 'Jade', '冰': 'Ice', '火': 'Fire',
  '雷': 'Thunder', '风': 'Wind', '土': 'Earth', '金': 'Metal', '水': 'Water', '灵': 'Spirit', '玄': 'Mystic',
  '天': 'Heaven', '地': 'Earth', '仙': 'Immortal', '神': 'Divine', '魔': 'Demon', '妖': 'Beast', '龙': 'Dragon',
  '虎': 'Tiger', '狼': 'Wolf', '猪': 'Boar', '贼': 'Bandit', '鬼': 'Ghost', '魂': 'Soul', '血': 'Blood', '骨': 'Bone',
  '器': 'Artifact', '符': 'Talisman', '阵': 'Formation', '塔': 'Tower', '宫': 'Palace', '殿': 'Hall', '阁': 'Pavilion',
  '田': 'Field', '仓': 'Granary', '坊': 'Mill', '屋': 'House', '城': 'City', '山': 'Mountain', '海': 'Sea', '林': 'Forest',
  '洞': 'Grotto', '府': 'Mansion', '门': 'Gate', '派': 'Sect', '宗': 'Sect', '朝': 'Dynasty', '代': 'Era', '年': 'Year',
  '月': 'Month', '日': 'Day', '时': 'Hour', '分钟': ' min', '小时': ' h', '分': ' min', '秒': ' sec',
  '个': '', '次': ' times', '件': ' items', '枚': ' pieces', '点': ' pts', '层': ' Floor', '关': ' Stage',
  '阶': ' Tier', '级': ' Lv.', '星': ' Star', '曜': ' Luminary',
  '五行': 'Five Elements', '悟性': 'Insight', '突破': 'Breakthrough', '灵根': 'Spiritual Root', '境界': 'Realm',
  '退隐': 'Retire', '遣散': 'Dismiss', '疗伤': 'Heal', '重伤': 'Injured', '驻守': 'Stationed', '职位': 'Post',
  '朝代': 'Dynasty', '洞天': 'Grotto-Heaven', '世界': 'World', '建设': 'Development', '建设度': 'Development',
  '未解锁': 'Locked', '已解锁': 'Unlocked', '已装备': 'Equipped', '已穿戴': 'Equipped', '出售': 'Sell', '购买': 'Buy',
  '兑换': 'Redeem', '兑换码': 'Redeem Code', '确认': 'Confirm', '取消': 'Cancel', '关闭': 'Close', '返回': 'Back',
  '开始': 'Start', '停止': 'Stop', '暂停': 'Pause', '继续': 'Continue', '查看': 'View', '详情': 'Details',
  '选择': 'Select', '请选择': 'Select', '请先': 'Please first ', '需要': 'Requires ', '不足': 'not enough',
  '不足！': 'not enough!', '已满': 'full', '为空': 'empty', '空': 'Empty', '无': 'None', '未知': 'Unknown',
  '的': '', '了': '', '着': '', '地': '', '得': '', '与': ' and ', '和': ' and ', '及': ' and ', '或': ' or ',
  '并': ' and ', '在': ' in ', '每': ' per ', '可': ' can ', '会': ' will ', '有': ' has ', '不': ' not ',
  '至': ' to ', '从': ' from ', '到': ' to ', '被': ' by ', '将': ' will ', '把': '', '即': ' i.e. ',
  '则': ' then ', '为': ' as ', '是': ' is ', '对': ' vs ', '按': ' by ', '共': ' total ', '约': ' about ',
  '以上': ' or more', '以下': ' or less', '之间': ' between', '同时': ' at the same time', '立刻': ' immediately',
  '立即': ' immediately', '自动': ' auto', '随机': ' random', '概率': ' chance', '提升': ' increase', '降低': ' reduce',
  '增加': ' increase', '减少': ' reduce', '恢复': ' restore', '消耗': ' cost', '持续': ' lasts', '效果': ' effect',
  '基础': ' base', '额外': ' extra', '当前': ' current', '最大': ' max', '最小': ' min', '全部': ' all',
  '第一': '1st', '第二': '2nd', '第三': '3rd', '第四': '4th', '第五': '5th', '第六': '6th', '第七': '7th',
  '第八': '8th', '第九': '9th', '第十': '10th', '万': '00k', '亿': '00M',
  '任务五行': 'Quest Element', '灵根五行': 'Spiritual Root Elements',
  '炼气期': 'Qi Refining', '筑基期': 'Foundation', '结丹期': 'Core Formation', '元婴期': 'Nascent Soul',
  '化神期': 'Spirit Transformation', '炼虚期': 'Void Refining', '太上境': 'Supreme Realm',
  '初期': 'Early', '中期': 'Mid', '后期': 'Late', '一层': 'Layer 1', '二层': 'Layer 2', '三层': 'Layer 3',
  '进度': 'Progress', '未开始': 'Not started', '挑战': 'Challenge', '常规层': 'Normal Floor',
  '最高层': 'Best Floor', '层数': 'Floors', '永久保存': 'saved permanently', '重置': 'reset',
  '单件': 'per item', '停止运转': 'Stopped', '开启运转': 'Start Operation',
  '需先修复异界裂缝': 'Repair the Otherworld Rift first', '需先击败裂缝怪物': 'Defeat the Rift Monster first',
  '开启后可加速': 'Speed up after starting', '清朝': 'Qing Dynasty', '锁塔妖兵': 'Tower Demon Soldier',
  '战斗经验': 'Combat EXP'
};
const I18N_TERM_KEYS = Object.keys(I18N_TERMS).sort(function (a, b) { return b.length - a.length; });

/* 英文兜底：中文数字单位 → 可读英文；术语替换；清理残留中文 */
function autoEn(s) {
  let out = String(s);
  out = out.replace(/(\d+(?:\.\d+)?)\s*万/g, function (_, n) {
    const v = Number(n) * 10000;
    const num = v >= 1e8 ? (v / 1e8).toFixed(2) + '00M' : (v / 1000).toFixed(v % 1000 ? 1 : 0) + 'k';
    return num;
  });
  out = out.replace(/(\d+(?:\.\d+)?)\s*亿/g, function (_, n) {
    const v = Number(n) * 1e8;
    const num = v >= 1e12 ? (v / 1e12).toFixed(2) + 'T' : (v / 1e6).toFixed(v % 1e6 ? 1 : 0) + 'M';
    return num;
  });
  /* 数字与英文单词之间补空格：12kSpirit → 12k Spirit */
  out = out.replace(/([kKMT])(?=[A-Za-z])/g, '$1 ');
  for (let i = 0; i < I18N_TERM_KEYS.length; i++) {
    const k = I18N_TERM_KEYS[i];
    if (out.indexOf(k) >= 0) out = out.split(k).join(I18N_TERMS[k]);
  }
  out = out.replace(/[，、]/g, ', ').replace(/。/g, '. ').replace(/；/g, '; ')
    .replace(/：/g, ': ').replace(/！/g, '! ').replace(/？/g, '? ')
    .replace(/「/g, '"').replace(/」/g, '"').replace(/（/g, ' (').replace(/）/g, ') ');
  out = out.replace(/[\u4e00-\u9fa5]/g, '');
  out = out.replace(/\s{2,}/g, ' ').replace(/\s+([,.;:!?])/g, '$1').trim();
  return out || '·';
}

/* 统一翻译入口：精确 → 数字模板（#）→ 兜底 */
function translateAny(s) {
  if (!isEn() || s == null) return s;
  const str = String(s);
  if (I18N_EN[str] !== undefined) return I18N_EN[str];
  const nums = [];
  const norm = str.replace(/\d+(?:\.\d+)?/g, function (m) { nums.push(m); return '#'; });
  if (I18N_EN[norm] !== undefined) {
    let i = 0;
    return String(I18N_EN[norm]).replace(/#/g, function () { return i < nums.length ? nums[i++] : '#'; });
  }
  return autoEn(str);
}

/* 全局兜底：面板里有大量 "el.textContent = '中文…'" 的增量写入。
   英文模式下在赋值入口直接翻译，避免每秒扫描来不及、或旧值反复写回中文。 */
(function patchTextContent() {
  if (typeof Node === 'undefined' || !Node.prototype) return;
  const d = Object.getOwnPropertyDescriptor(Node.prototype, 'textContent');
  if (!d || !d.set || d.set.__i18nPatched) return;
  const orig = d.set;
  function patched(v) {
    if (typeof v === 'string' && isEn() && /[\u4e00-\u9fa5]/.test(v)) v = translateAny(v);
    return orig.call(this, v);
  }
  patched.__i18nPatched = true;
  Object.defineProperty(Node.prototype, 'textContent', {
    get: d.get, set: patched, configurable: true, enumerable: d.enumerable
  });
})();

/* 全局兜底：部分面板直接用 innerHTML 增量写入（不经 setHTML），
   英文模式下在赋值入口按「标签/文本」分段翻译，标签与结构保持不变。 */
(function patchInnerHTML() {
  if (typeof Element === 'undefined' || !Element.prototype) return;
  const d = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML');
  if (!d || !d.set || d.set.__i18nPatched) return;
  const orig = d.set;
  function patched(v) {
    if (typeof v === 'string' && isEn() && /[\u4e00-\u9fa5]/.test(v)) {
      v = v.split(/(<[^>]*>)/).map(function (seg, i) {
        if (i % 2 === 1) return seg;                 // 标签原样保留
        return /[\u4e00-\u9fa5]/.test(seg) ? translateAny(seg) : seg;
      }).join('');
    }
    return orig.call(this, v);
  }
  patched.__i18nPatched = true;
  Object.defineProperty(Element.prototype, 'innerHTML', {
    get: d.get, set: patched, configurable: true, enumerable: d.enumerable
  });
})();

/* 把一段 DOM 内的中文文本与常见属性整体本地化（英文模式） */
function localizeDOM(root) {
  if (!isEn() || !root) return;
  const doc = root.ownerDocument || document;
  const SHOW = (typeof NodeFilter !== 'undefined' && NodeFilter.SHOW_TEXT) ? NodeFilter.SHOW_TEXT : 4;
  if (doc.createTreeWalker) {
    const walker = doc.createTreeWalker(root, SHOW, null);
    const nodes = [];
    while (walker.nextNode()) nodes.push(walker.currentNode);
    nodes.forEach(function (n) {
      const p = n.parentElement;
      if (p && /^(SCRIPT|STYLE|TEXTAREA)$/.test(p.tagName)) return;
      const v = n.nodeValue;
      if (!v || !/[\u4e00-\u9fa5]/.test(v)) return;
      const en = translateAny(v);
      if (en !== v) n.nodeValue = en;
    });
  }
  if (root.querySelectorAll) {
    const els = root.querySelectorAll('[title],[placeholder],[aria-label],[alt]');
    for (let i = 0; i < els.length; i++) {
      const el = els[i];
      ['title', 'placeholder', 'aria-label', 'alt'].forEach(function (a) {
        const v = el.getAttribute && el.getAttribute(a);
        if (v && /[\u4e00-\u9fa5]/.test(v)) el.setAttribute(a, translateAny(v));
      });
    }
  }
}

function isEn() { return !!(typeof state !== 'undefined' && state && state.lang === 'en'); }

/* 以中文原文取译文；英文模式下未收录时走兜底翻译，保证不留中文 */
function t(s) {
  if (!isEn()) return s;
  if (s == null) return s;
  return translateAny(s);
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
  if (isEn() && typeof localizeDOM === 'function') localizeDOM(document.body);
}

/* 切换语言：落盘 + 静态文案 + 整树重绘（setHTML 签名会随文案变化自动重绘） */
function setLang(lang) {
  if (typeof state === 'undefined' || !state) return;
  const next = lang === 'en' ? 'en' : 'zh';
  if (state.lang !== next) {
    state.lang = next;
    if (typeof saveState === 'function') saveState();
  }
  /* 清掉 setHTML 的内容签名缓存：否则切回中文时可能命中英文切换前的旧签名而跳过重绘 */
  if (typeof _htmlCache === 'object' && _htmlCache) {
    Object.keys(_htmlCache).forEach(function (k) { delete _htmlCache[k]; });
  }
  applyStaticI18n();
  if (typeof renderAll === 'function') renderAll();
  localizeDOM(document.body);
}

/* 语言按钮的独立兜底：即使运行环境里 main.js 是旧缓存（没有 setlang 分支），
   只要 ui.js 已渲染出语言按钮，这里也能完成切换。与 main.js 同时触发时
   setLang 幂等，最多多一次重绘。 */
document.addEventListener('click', function (e) {
  let n = e.target;
  while (n && n !== document.body) {
    if (n.dataset && n.dataset.act === 'setlang') {
      setLang(n.dataset.lang);
      return;
    }
    n = n.parentElement;
  }
});

/* 兜底清扫：部分面板/提示在 setHTML 之后用 textContent 增量写入中文，
   英文模式下每秒扫描一次可见 DOM，确保不残留中文（只处理含中文的文本节点）。 */
if (typeof setInterval === 'function') {
  setInterval(function () {
    if (isEn() && typeof document !== 'undefined' && document.body) localizeDOM(document.body);
  }, 1000);
}
