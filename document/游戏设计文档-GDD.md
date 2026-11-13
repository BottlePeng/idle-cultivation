# 游戏设计文档（GDD）· 穿越星球

> 版本：v9（含入世、太上境、世界洞天、异界裂缝、五行属性裂缝、裂缝怪物、洞天朝代、设置与测试控制台）｜ 最后更新：随代码同步 ｜ 对应代码：`js/data.js` `js/state.js` `js/engine.js` `js/ui.js` `js/main.js`

---

## 1. 游戏概述

| 项 | 内容 |
| --- | --- |
| 名称 | 穿越星球 · Planet Crossing |
| 题材 | 东方修仙 |
| 类型 | 放置 / 挂机（Idle）模拟经营 + 角色成长 |
| 平台 | 纯静态网页（PC 优先），双击 `index.html` 即运行 |
| 商业模式 | 单机、无内购、无联网 |
| 玩法参考 | 《梅尔沃放置》的动作 / 精通 / 命中制战斗 / 多商店 / 观星 / 种植；《凡人修仙传》的境界 / 灵根 / 丹药 |

### 1.1 设计目标

1. **一句话上手**：点击即挂机，离开也在变强。
2. **单一动作槽**：同一时间只做一件事，选择即取舍，避免多线程挂机的通胀。
3. **离线收益与在线一致**：离线用同一套 `tick` 快进模拟，数值口径完全一致。
4. **长线成长曲线**：10 大技能 + 33 阶基础境界 + 太上境 96,500 层 + 精通 + 阵法 + 灵植 + 洞天，形成多轴养成。
5. **零素材 / 零构建**：图标用 Emoji，纯原生 JS，所有数值集中在 `data.js`。

---

## 2. 核心玩法循环

```
   挂机采集 ─► 获得材料 ─► 炼制装备/丹药 ─► 战力提升 ─► 讨伐更强妖兽
      ▲                                                        │
      │                                                         ▼
   境界/技能/精通提升 ◄── 突破境界 + 阵法加持 + 灵植供给 ◄── 更多资源与灵石
```

**一句话循环**：`采集 → 材料 → 炼制 → 变强 → 更快采集 → 更高境界`。

三大驱动力：

- **横向**：把 9 个技能一个个练上去，解锁更高等级的动作 / 配方。
- **纵向**：打坐积累修为 → 突破境界 → 全局加成（速度 / 经验 / 攻防命闪）。
- **辅助**：阵法提供常驻全局加成，灵植提供被动药材供给。

---

## 3. 系统总览

| # | 系统 | 关键机制 | 数据入口 | 详细文档 |
| --- | --- | --- | --- | --- |
| 1 | 动作槽 | 全局唯一动作，`startAction/stopAction/cycleTick` | `state.action` | [动作槽与离线收益](./机制-动作槽与离线收益.md) |
| 2 | 离线收益 | `simulateOffline` 以 0.5s 步长快进 `tick` | `CONFIG.OFFLINE_CAP_H` | [动作槽与离线收益](./机制-动作槽与离线收益.md) |
| 3 | 技能 | 10 技能，经验曲线 `base*lvl^pow` | `SKILLS/SKILL_ORDER` | [技能与精通](./机制-技能与精通.md) |
| 4 | 精通 | 每个动作独立成长，上限 99 | `state.mastery` | [技能与精通](./机制-技能与精通.md) |
| 5 | 修炼境界 | 五行灵根 + 悟性 + 33 阶基础境界 + 太上境 96,500 层 + 突破（32→33 需五行全 Lv.100） | `WUXING/REALM_DEFS/TAISHANG_DEF` | [修炼与境界](./机制-修炼与境界.md) |
| 6 | 战斗 | 命中制、属性、妖兽、自动进食 | `MONSTERS/CONFIG` | [战斗系统](./机制-战斗系统.md) |
| 7 | 生产技能 | 伐木 / 钓鱼 / 采矿 / 炼器 / 炼丹 | `ACTIONS/RECIPES` | [生产技能](./机制-生产技能.md) |
| 8 | 装备 | 六部位法宝，属性加成 | `ITEMS.type='equip'` | [装备系统](./机制-装备系统.md) |
| 9 | 阵法 | 21 门观星各对应 1 座阵法；观星取星砂 → 精通达标后点亮阵纹 → 全局加成 | `FORM_SPECS/FORMATIONS` | [阵法系统](./机制-阵法系统.md) |
| 10 | 灵植 | 地块被动生长，参考梅尔沃种植 | `FARM_SEEDS/FARMING_PLOT_REQS` | [灵植系统](./机制-灵植系统.md) |
| 11 | 任务 | 成就式条件 + 奖励领取 | `TASKS` | [任务系统](./机制-任务系统.md) |
| 12 | 背包 | 100 格种类上限、操作菜单、出售模式 | `CONFIG.INV_SLOTS` | [背包系统](./机制-背包系统.md) |
| 13 | 市集 | 四店铺采购，加价购入 / 折价出售 | `SHOPS` | [市集系统](./机制-市集系统.md) |
| 14 | 入世 | 红尘百业职业体验，概率成败，参考梅尔沃盗窃 | `ACTIONS.thieving/state.stun` | [入世系统](./机制-入世系统.md) |
| 15 | 世界 · 洞天 | 8 种地形 × 共 100 种建筑营造、被动产出、人口效率、17 条全局加成通道（修为/速度/掉落/精通等），参考梅尔沃城镇 | `TERRAINS/BUILDINGS/state.world` | [世界洞天](./机制-世界洞天.md) |
| 16 | 穿越星球 | 占用动作槽的主动小游戏：生成灵石/星砂/材料，吸收耗灵力、生成耗灵气浓度；穿越只消耗灵气浓度（首次 10000），朝代清 → … → 夏 → 古N纪 | `PLANET/DYNASTY_NAMES/state.planet` | [穿越星球](./机制-穿越星球.md) |
| 17 | 锁妖塔 | 无尽层单场战斗：层数幂律成长、击败后先领奖再进层、每 5 层里程碑；层数永不重置，阵亡不降层；占用动作槽且无离线收益 | `TOWER/state.tower` | [锁妖塔](./机制-锁妖塔.md) |
| 18 | 异界裂缝 | 穿越星球的门槛战：新档自带、每次穿越成功生成下一道；未修复时禁止穿越；击败即修复并给少量奖励；阵亡不惩罚；占用动作槽 | `RIFT/state.rift` | [异界裂缝](./机制-异界裂缝.md) |
| 19 | 五行属性裂缝 | 穿越星球界面的常驻战斗：同时 3 道随机五行裂缝、每 3 小时真实时间整轮刷新；修复后留空到下一轮；按对应工作等级发材料；难度随工作等级与穿越次数上升；不参与穿越门槛但占用动作槽 | `ELEM_RIFT/state.elemRifts` | [五行属性裂缝](./机制-五行属性裂缝.md) |
| 20 | 裂缝怪物 | 穿越星球界面的常驻单体强敌：同时 1 只、每 24 小时真实时间刷新；存在时锁「星球运转」但不锁穿越；强度只看穿越次数且各项低于异界裂缝；击败给灵石 + 星砂；阵亡不惩罚；占用动作槽 | `RIFT_MON/state.riftMon` | [裂缝怪物](./机制-裂缝怪物.md) |
| 21 | 洞天 · 朝代 | 消耗「生命之种」召唤不同年代的生灵；每 10 分钟结算人口与资源；上限靠合成同名朝代提升；朝代位 = 小世界等级 × 5（元婴期可建，首级只收灵石）；召唤/合成不占动作槽，结算被动推进且离线同样生效 | `DYNASTY/state.world.dynasties` | [朝代系统](./机制-朝代系统.md) |
| 22 | 设置与测试控制台 | 设置页为后续设置项落位骨架；兑换码集中在 `REDEEM`（只存哈希）；兑换成功后本次运行解锁测试控制台（资源/境界/技能/建筑/星球/塔/裂缝/时间快进）；解锁为会话级，不写入存档 | `REDEEM/DEV`（均不入存档） | [设置与测试控制台](./机制-设置与测试控制台.md) |

---

## 4. 数值框架

### 4.1 全局配置（`CONFIG`）

| 分类 | 键 | 值 | 含义 |
| --- | --- | --- | --- |
| 循环 | `TICK_MS` | 100 | 逻辑心跳步长（ms） |
| 循环 | `RENDER_MS` | 200 | 界面结构刷新间隔（ms） |
| 循环 | `AUTOSAVE_MS` | 5000 | 自动存档间隔（ms） |
| 离线 | `OFFLINE_CAP_H` | 12 | 离线收益上限（小时） |
| 生命 | `BASE_HP` | 60 | 基础生命上限 |
| 生命 | `HP_PER_COMBAT` | 8 | 每级战斗 +生命 |
| 生命 | `HP_PER_REALM` | 20 | 每个大境界 +生命 |
| 攻击 | `BASE_ATK` / `ATK_PER_LEVEL` | 5 / 2 | 基础攻击 / 每级战斗 +攻击 |
| 防御 | `BASE_DEF` / `DEF_PER_LEVEL` | 1 / 1.5 | 基础防御 / 每级 +防御 |
| 减伤 | `DR_DIVISOR` / `DR_CAP` | 140 / 0.75 | 减伤 = 防/(防+140)，上限 75% |
| 命中 | `BASE_HIT` / `HIT_PER_LEVEL` | 12 / 2.2 | 基础命中 / 每级 +命中 |
| 闪避 | `BASE_EV` / `EV_PER_LEVEL` | 8 / 1.6 | 基础闪避 / 每级 +闪避 |
| 战斗节奏 | `PLAYER_ATTACK_TIME` | 2.4s | 玩家出手间隔 |
| 战斗节奏 | `RESPAWN_TIME` | 1.5s | 默认怪物刷新间隔 |
| 命中率 | `HIT_MIN` / `HIT_MAX` | 0.20 / 0.95 | 命中率上下限 |
| 伤害浮动 | `DMG_SPREAD` | 0.18 | 伤害区间 = 均值 ×(1±0.18) |
| 被动 | `HP_REGEN_INTERVAL` / `HP_REGEN_RATIO` | 10s / 0.03 | 脱战每 10s 回 3% 上限 |
| 被动 | `SPIRIT_PER_SEC` | 0.2 | 每秒自然凝聚灵力 |
| 境界成长 | `SPEED_REALM_BONUS` | 0.04 | 每个大境界 +4% 动作速度 |
| 境界成长 | `XP_REALM_BONUS` | 0.06 | 每个大境界 +6% 技能经验 |
| 境界成长 | `CULT_XP_PER_REALM` | 6 | 每个大境界，打坐修为 ×(1+倍数) |
| 境界成长 | `REALM_ATK_BONUS` | 0.12 | 每个大境界 +12% 攻防命闪 |
| 精通 | `MASTERY_CAP` | 99 | 精通等级上限 |
| 精通 | `MASTERY_TIME_PER_LVL` | 0.002 | 每级精通 -0.2% 耗时（上限 -20%） |
| 精通 | `MASTERY_DOUBLE_PER_LVL` | 0.005 | 每级精通 +0.5% 额外产出 |
| 精通 | `MASTERY_XP_RATIO` | 0.6 | 精通经验 = 动作经验 ×0.6 |
| 精通 | `SKILL_DOUBLE_PER_LVL` | 0.002 | 每个技能等级 +0.2% 额外产出 |
| 突破 | `BREAK_FAIL_LOSS` | 0.30 | 突破失败损失 30% 修为 |
| 疗伤 | `HEAL_SPIRIT_COST` | 25 | 灵气疗伤消耗灵力 |
| 背包 | `INV_SLOTS` | 100 | 背包容量（物品种类数） |
| 市集 | `SELL_RATIO` | 0.55 | 出售价 = 价值 ×0.55 |

### 4.2 技能表（`SKILLS`）

| 技能 | id | icon | 升级曲线 `base·lvl^pow` |
| --- | --- | --- | --- |
| 伐木 | `woodcutting` | 🪓 | 25 · lvl^1.55 |
| 钓鱼 | `fishing` | 🎣 | 25 · lvl^1.55 |
| 采矿 | `mining` | ⛏️ | 28 · lvl^1.55 |
| 炼器 | `crafting` | 🔨 | 30 · lvl^1.55 |
| 炼丹 | `alchemy` | ⚗️ | 30 · lvl^1.55 |
| 战斗 | `combat` | ⚔️ | 38 · lvl^1.60 |
| 修炼 | `cultivation` | 🧘 | 70 · lvl^1.70（实际由境界表接管） |
| 阵法 | `formation` | 🧭 | 18 · lvl^1.35 |
| 灵植 | `farming` | 🌿 | 22 · lvl^1.40 |
| 入世 | `thieving` | 🎭 | 26 · lvl^1.45 |

> `SKILL_ORDER` 决定侧栏顺序、`state.skills` 初始化顺序、离线模拟遍历顺序。

### 4.3 成长速度参考（定性）

- **等级**：技能等级无上限（`addXp` 循环扣减，单帧保护 500 级），需求随等级近似多项式增长。
- **境界**：6 大境界 × 若干小境界 = **33 阶基础境界**，其上为 `太上境` **96,500 层**，合计 **96,533 阶**；终点为 `太上境 九万六千五百层`。前六境的需求曲线按「纯修炼挂机约 500 小时晋入太上境一层」定标（v1.9.4，标定方法与分段数据见 [修炼与境界 · 附录 A](./机制-修炼与境界.md#附录-a500-小时定标数据)）。
- **精通**：每个动作独立成长，最高 Lv.99；耗时最多 -20%、物品额外产出最多 +49.5%、灵力/回复/灵石等非物品收益最多 ×1.495。观星精通同时是阵纹升级门槛（阵纹 Lv.N 需精通 Lv.4N）。

### 4.4 穿越星球（`PLANET`）

| 键 | 值 | 含义 |
| --- | --- | --- |
| `SPAWN_BASE` / `FLIGHT_TIME` | 1.8s / 4.8s | 生成间隔 / 飞行时长 |
| `SPIRIT_COST` | 0.5 | 每吸收 1 件消耗灵力 |
| `AURA_CAP_BASE` / `AURA_CAP_GT` | 15000 / +100 每级 | 0 次穿越时的浓度上限；引力塔每级额外 +100 |
| `AURA_CAP_RATIO` | 1.5 | 上限至少为下一次穿越价格的 1.5 倍 |
| `AURA_START_RATIO` | 0.3 | 新档 / 旧档迁移的起始浓度比例 |
| `AURA_REGEN_BASE` / `AURA_REGEN_GT` | 2.0/s / +0.5/s 每级 | 停止运转时的基础恢复；再乘穿越成长系数 |
| `AURA_COST` / `AURA_COST_DECAY` / `AURA_COST_MIN` | 2 / 0.9 / 0.2 | 初始单件消耗 / 每次穿越 ×0.9 / 下限 |
| `AURA_MIN` | 1 | 非零下限；扣除后至少保留 1 |
| `CROSS_BASE` / `CROSS_KNEE` | 10000 / 10 | 穿越基价 / 前 10 次快速段 |
| `CROSS_GROW_EARLY` / `CROSS_GROW_LATE` / `CROSS_MAX` | 1.6 / 1.12 / 1e15 | 前段 / 后段增长率 / 价格封顶 |

- 上限与恢复都按「下一次穿越价格」放大：`cap = ceil(max(15000, next × 1.5)) + 100×引力塔`，`regen = (2.0 + 0.5×引力塔) × next / 10000`。0 次穿越：Lv0=15000/+2.0s、Lv20=17000/+12.0s、Lv100=25000/+52.0s。
- 浓度显示为 `xx.x% (当前/上限)`；巡航中只降不升，停止运转才恢复；触底停止生成，扣除后至少保留 1，永远不会为 0 或负数。
- 单件消耗 `max(0.2, 2 × 0.9^cross)`：0 次=2、1 次=1.8、2 次=1.62……第 22 次触底 0.2，穿越越多同样浓度越耐用。
- 穿越价格：第 1~10 次 `10000 × 1.6^(n-1)`，第 11 次起再接 `×1.12^(n-10)`；n=1/5/10/20/50 分别为 10,000 / 65,536 / 687,194 / 2,134,322 / 63,944,139。穿越只扣灵气浓度，不扣灵力、不受眩晕影响（详见 [穿越星球](./机制-穿越星球.md)）。

### 4.5 锁妖塔（`TOWER`）

| 键 | 值 | 含义 |
| --- | --- | --- |
| `MAX_FLOOR` | 100000 | 层数 / 最高层上限（防极端存档溢出） |
| `HP_BASE` / `HP_LIN` / `HP_POW` / `HP_EXP` | 26 / 0.30 / 0.010 / 1.9 | 生命 = `round(26×(1+0.30t+0.010×t^1.9))`，`t=f-1` |
| `ATK_MIN` / `ATK_MAX` | 5 / 9 | 攻击基础区间 |
| `ATK_LIN` / `ATK_POW` / `ATK_EXP` | 0.03 / 0.005 / 1.5 | 攻击 = `5~9×(1+0.03t+0.005×t^1.5)` |
| `HIT_BASE` / `HIT_LIN` | 14 / 2.0 | 命中 = `14+2.0t` |
| `EV_BASE` / `EV_LIN` | 8 / 1.2 | 闪避 = `8+1.2t` |
| `DR_BASE` / `DR_LIN` / `DR_CAP` | 0.02 / 0.004 / 0.35 | 减伤 = `min(35%, 2%+0.4%t)` |
| `INTERVAL_*` | 2.8 / 0.002 / 1.8 | 出手间隔 = `max(1.8s, 2.8-0.002t)` |
| `XP_BASE` / `XP_POW` | 38 / 1.75 | 通关经验 = `round(38×f^1.75)` |
| `GOLD_BASE` / `GOLD_POW` | 12 / 1.7 | 灵石 = `round(12×f^1.7)` × 里程碑 × 灵石加成 |
| `STAR_BASE` / `STAR_POW` | 1.2 / 0.9 | 星砂 = `max(1, round(1.2×f^0.9))` × 里程碑 |
| `MILESTONE_EVERY` / `MILESTONE_GOLD` / `MILESTONE_STAR` | 5 / 2.5 / 3 | 每 5 层灵石 ×2.5、星砂 ×3、必掉丹药 |
| `DECADE_EVERY` | 10 | 每 10 层追加 1 颗丹药 + 材料（数量 `1+floor(f/50)`） |

- 战斗复用现有命中 / 闪避 / 减伤公式与 `combatTick`，仅用 `state.skills.combat.tower` 标记塔内目标；`cancelCombat()` 会清空该标记。
- 击败 → `pending`；领取 → 发奖并 `current+1`；阵亡 → 层数不降、可重试；`current/best` 永久保存。
- 挑战占用单一动作槽，开始会中断星球 / 战斗 / 秘境，切换其它动作会中断挑战；塔战不参与离线结算（详见 [锁妖塔](./机制-锁妖塔.md)）。

### 4.6 异界裂缝（`RIFT`）

| 键 | 值 | 含义 |
| --- | --- | --- |
| `MAX_TIER` | 10000 | 裂缝层级上限（与穿越次数上限一致） |
| `HP_BASE` / `HP_LIN` / `HP_POW` / `HP_EXP` | 34 / 0.25 / 0.008 / 1.7 | 生命 = `round(34×(1+0.25t+0.008×t^1.7))` |
| `ATK_MIN` / `ATK_MAX` | 2 / 4 | 攻击基础区间 |
| `ATK_LIN` / `ATK_POW` / `ATK_EXP` | 0.15 / 0.004 / 1.5 | 攻击 = `2~4×(1+0.15t+0.004×t^1.5)` |
| `HIT_BASE` / `HIT_LIN` | 8 / 0.9 | 命中 = `8+0.9t` |
| `EV_BASE` / `EV_LIN` | 5 / 0.6 | 闪避 = `5+0.6t` |
| `DR_BASE` / `DR_LIN` / `DR_CAP` | 0.01 / 0.0012 / 0.30 | 减伤 = `min(30%, 1%+0.12%t)` |
| `INTERVAL_*` | 3.2 / 0.0015 / 2.0 | 出手间隔 = `max(2.0s, 3.2-0.0015t)` |
| `HIT_CAP` | 0.18 | 单次伤害 ≤ 玩家当前生命上限的 18%，防一刀秒 |
| `GOLD_BASE` / `GOLD_POW` | 10 / 1.15 | 灵石 = `round(10×(t+1)^1.15)` × 灵石加成 |
| `STAR_BASE` / `STAR_POW` | 1 / 0.7 | 星砂 = `max(1, round(1×(t+1)^0.7))` |
| `XP_BASE` / `XP_POW` | 16 / 1.55 | 战斗经验 = `round(16×(t+1)^1.55)` |

- `t = tier`，即生成裂缝时的穿越次数；新档 `tier=0`，每次穿越成功后生成 `tier=新穿越次数` 的裂缝。
- 战斗复用现有命中 / 闪避 / 减伤公式与 `combatTick`，仅用 `state.skills.combat.rift` 标记裂缝目标；`cancelCombat()` 会清空该标记。
- 击败即修复：立刻发奖、`open=false`、释放动作槽；阵亡只退出战斗，`open/tier/穿越次数` 全部保留，可回血重试。
- 占用单一动作槽，开始会中断星球 / 战斗 / 锁妖塔，切换其它动作会中断修复；裂缝战斗不参与离线结算（详见 [异界裂缝](./机制-异界裂缝.md)）。

### 4.7 五行属性裂缝（`ELEM_RIFT`）

| 键 | 值 | 含义 |
| --- | --- | --- |
| `REFRESH_MS` | 3h | 整轮刷新间隔（真实时间 `Date.now`，覆盖式，不做离线补刷） |
| `SLOTS` | 3 | 同时存在的裂缝数量（允许属性重复） |
| `MAX_TIER` | 10000 | 强度层级上限 |
| `CROSS_W` / `LVL_W` | 2.2 / 0.4 | 强度快照 `t = round(cross×2.2 + (对应工作等级-1)×0.4)` |
| `HP_BASE` / `HP_LIN` / `HP_POW` / `HP_EXP` | 30 / 0.26 / 0.007 / 1.6 | 生命 = `round(30×(1+0.26t+0.007×t^1.6))` |
| `ATK_MIN` / `ATK_MAX` | 2 / 4 | 攻击基础区间 |
| `ATK_LIN` / `ATK_POW` / `ATK_EXP` | 0.14 / 0.003 / 1.45 | 攻击 = `2~4×(1+0.14t+0.003×t^1.45)` |
| `HIT_BASE` / `HIT_LIN` | 7 / 0.9 | 命中 = `7+0.9t` |
| `EV_BASE` / `EV_LIN` | 4 / 0.55 | 闪避 = `4+0.55t` |
| `DR_BASE` / `DR_LIN` / `DR_CAP` | 0.01 / 0.001 / 0.30 | 减伤 = `min(30%, 1%+0.1%t)` |
| `INTERVAL_*` | 3.0 / 0.0012 / 2.0 | 出手间隔 = `max(2.0s, 3.0-0.0012t)` |
| `HIT_CAP` | 0.16 | 单次伤害 ≤ 玩家当前生命上限的 16%，防一刀秒 |
| `QTY_LVL_STEP` / `QTY_MAX` | 20 / 5 | 奖励数量 = `clamp(floor(等级/20)+1, 1, 5)` |
| `ELEMENTS` | 5 项 | 金 / 木 / 水 / 火 / 土：`crafting` / `woodcutting` / `fishing` / `alchemy` / `formation` |

- `t` 为**生成时的强度快照**（工作等级 × 穿越次数），落盘后不随等级实时变化，避免边打边涨；`MAX_TIER` 收敛极端存档。
- 图标记 `🔶 🌿 💧 🔥 🏔️`（Unicode 6.0~7.0），避开旧 `WUXING` 中 4.1/5.2 的图标，保证 Win10 字体正常显示。
- 奖励按属性取对应工作「当前等级可产出的最高档」物品（金取正规熔炼配方的矿石输入，不取锭；土取观星所得的星砂），数量 1~5 件随等级提升；无可用物品时退化到该属性最低档。
- 刷新入口在穿越星球主界面，3 张卡 + 下一次刷新倒计时；修复后该位置留空（`fixed=true`）直到下一轮整轮刷新；`action.skill === 'elem'` 时推迟刷新，避免战斗中裂缝突然消失。
- 不参与穿越门槛，`rift.open` 与穿越按钮完全不受影响；但战斗占用全局动作槽，与星球 / 普通战斗 / 锁妖塔 / 异界裂缝互斥；阵亡不消耗、不降级，可回血重试；读档不恢复进行中的战斗（详见 [五行属性裂缝](./机制-五行属性裂缝.md)）。

### 4.8 裂缝怪物（`RIFT_MON`）

| 键 | 值 | 含义 |
| --- | --- | --- |
| `REFRESH_MS` | 24h | 刷新间隔（真实时间 `Date.now`；覆盖式，不补刷） |
| `MAX_TIER` | 10000 | 强度上限 |
| `HP_BASE` / `HP_LIN` / `HP_POW` / `HP_EXP` | 28 / 0.20 / 0.006 / 1.65 | 生命 = `round(28×(1+0.2t+0.006×t^1.65))` |
| `ATK_MIN` / `ATK_MAX` | 2 / 3 | 攻击基础区间（异界为 2~4） |
| `ATK_LIN` / `ATK_POW` / `ATK_EXP` | 0.10 / 0.003 / 1.45 | 攻击 = `2~3×(1+0.1t+0.003×t^1.45)` |
| `HIT_BASE` / `HIT_LIN` | 6 / 0.7 | 命中 = `6+0.7t` |
| `EV_BASE` / `EV_LIN` | 4 / 0.45 | 闪避 = `4+0.45t` |
| `DR_BASE` / `DR_LIN` / `DR_CAP` | 0.008 / 0.0008 / 0.24 | 减伤 = `min(24%, 0.8%+0.08%t)` |
| `INTERVAL_*` | 3.2 / 0.0015 / 2.0 | 出手间隔与异界裂缝完全相同（不更快） |
| `HIT_CAP` | 0.14 | 单次伤害 ≤ 玩家当前生命上限的 14% |
| `GOLD_BASE` / `GOLD_POW` | 12 / 1.05 | 灵石 = `round(12×(t+1)^1.05)` × 加成 |
| `STAR_BASE` / `STAR_POW` | 1.2 / 0.6 | 星砂 = `max(1, round(1.2×(t+1)^0.6))` |

- `t` = **生成时的穿越次数快照**；同 t 下生命 / 攻击上下限 / 命中 / 闪避 / 减伤 / 出手间隔均不高于异界裂缝（对比表见独立文档）。
- 同时只存在 1 只；击败后 `alive=false` 保留到原定刷新时间，不立刻重生；离线超过 24 小时只换一轮。
- 存在时 `planetStart()` 拒绝开启运转（UI 按钮置灰 + 提示「需先击败裂缝怪物」），但**不影响穿越**、不影响 `rift` 与 `elemRifts`。
- 刷新到点时若正在运转：延后到运转停止后再生成（不打断已投入的巡航；`next` 保持过期，停止后立刻生成并重置 24h）。
- 击败奖励灵石 + 星砂，起点与锁妖塔第 1 层持平、之后明显低于同层塔；阵亡不消耗怪物、不降强度，回血可重试。
- 战斗占用全局动作槽：`action.skill='riftmon'`、`combat.riftMon=tier`；与星球 / 普通战斗 / 秘境 / 锁妖塔 / 异界裂缝 / 五行属性裂缝互斥，切换动作时 `cancelCombat()` 清空全部战况。
- 图标 `👹`（Unicode 6.0）；详情页与倒计时走 `data-rm` / `data-pg` 增量刷新，不整树重建。

### 4.9 洞天 · 朝代（`DYNASTY`）

| 键 | 值 | 含义 |
| --- | --- | --- |
| `SLOTS_PER_LVL` | 5 | 小世界每级朝代位 |
| `REALM_REQ` | 22 | 小世界建造门槛（第 22 阶 = 元婴期初期） |
| `START_POP` / `BASE_CAP` | 3 / 12 | 新召唤朝代的人口 / 上限 |
| `GROWTH_RATE` / `GROWTH_MIN` | 6% / 1 | 每次结算人口向上限逼近，至少 +1 |
| `TICK_SEC` | 600 | 结算周期（10 分钟） |
| `MERGE_SEED` / `MERGE_MIN_POP` | 4 / 2 | 合成消耗 / 被合者最低人口 |
| `MERGE_POP_RATE` / `MERGE_CAP_RATE` | 0.5 / 0.5 | 人口与上限转移比例 |
| `POP_HARD_CAP` | 5000 | 单朝代硬顶 |
| `OUT_FOOD_PER_POP` | 3 | 每次结算每人口粮食 |
| `SUMMON_SEED` | 10 | 召唤消耗 |
| `SEED_PLANET_P` | 0.02 | 星球每吸收 1 件的掉率 |
| `SEED_ELEM_P` / `SEED_ELEM_QTY` | 0.5 / 2 | 五行属性裂缝掉率 / 数量 |
| `SEED_RIFT_BASE` / `SEED_RIFT_TIER_STEP` | 3 / 10 | 异界裂缝必掉 `3+floor(t/10)` |
| `SEED_MON_BASE` / `SEED_MON_TIER_STEP` | 5 / 5 | 裂缝怪物必掉 `5+floor(t/5)` |
| `ERA_START_MAX` / `ERA_MAX` | 1 / 50 | 年代下标范围（0 次穿越 → 清/明） |

- 新资源 `state.seed`（生命之种）；召唤/合成为瞬时操作，**不占用动作槽**（与洞天营造一致）。
- 朝代位 = `小世界等级 × 5`；小世界位于秘境地形、建设度门槛 1、**境界门槛 22（元婴期）**，Lv.1 只收 6000 灵石，Lv.2 起 `costLv1`（9000 灵石 + 400 木 + 400 石）× `1.18^(n-1)`。
- 每个朝代是独立人口池 `{dyn, pop, cap}`；`dyn` 为年代下标，名称走 `planetDynastyName()`（0 清朝 … 10 夏朝，11 起古一纪）。
- 结算（`dynastyTick` → `settleDynastyOnce`）：每 600s 结算每个朝代的 `pop × 3` 粮食 + `pop × per` 年代主资源（木/石/灵石/星砂），随后人口 `+max(1, pop×6%)` 封顶 `cap`；粮食/木/石受 `worldCap` 限制，灵石/星砂直接入全局。
- 合成：目标 `pop += 被合者 pop×50%`、`cap += ceil(被合者 cap×50%)`，被合者失去这部分但**不消失、不空出位**。
- 结算走主循环 `tick(dt)`，离线 `simulateOffline()` 逐 0.5s 调用同一逻辑，受 `OFFLINE_CAP_H = 12h` 约束（最多 72 次），不额外补刷。
- UI：洞天页签「🏯 洞天营造 / 🕰️ 朝代」，朝代页走 `data-dyn` 增量刷新，结算不重建列表。

### 4.10 设置与测试控制台

| 项 | 说明 |
| --- | --- |
| 设置入口 | 侧栏「🔧 设置」（`ui.active = 'settings'`，进入白名单；控制台页 `devtools` 不在白名单） |
| 兑换码配置 | `js/data.js` 的 `REDEEM.CODES`，每项 `{ hash, feature, label }`；`devCodeHash()` 为 FNV-1a 32 位，只存哈希 |
| 解锁状态 | `js/engine.js` 的 `DEV = { unlocked, msg, msgType }`，会话级，**不写入 state** |
| 控制台能力 | 核心资源、洞天资源、境界/修为、技能/精通、建筑（含引力塔）、星球浓度/穿越、锁妖塔层数、三套裂缝状态、时间快进、立即存档/重载 |
| 时间快进 | 复用 `simulateOffline(seconds)` → `tick()`，0.5s 步长，受 `OFFLINE_CAP_H = 12` 小时限制 |
| 渲染 | 控制台骨架静态，当前值仅在进入页面或执行操作后由 `updateDev()` 填一次（`_devDirty`），不随 `renderAll` 周期写 DOM |
| 存档 | 无新增字段；测试产生的数值改动走正常 state 字段，会随自动存档落盘 |
| 图标 | 🔧 / 🔬（均 Unicode 6.0） |

---

## 5. 数据结构与存档

存档写 `localStorage[CONFIG.SAVE_KEY]`，键为 `xiuxian_idle_save_v1`，序列化整个 `state` 对象。

```
state
├─ version          存档版本
├─ gold/spirit/stardust   灵石 / 灵力 / 星砂
├─ seed             生命之种（洞天朝代召唤 / 合成）
├─ hp               当前生命
├─ inv{ id:qty }    背包：物品种类 → 数量
├─ equip{ slot:id } 六部位装备
├─ insight          悟性（每点 修炼速度+1% / 突破成功率+1%）
├─ skills{ id:{lvl,xp} }   各技能等级与经验
│   └─ combat 额外: monster/target/playerTimer/monsterTimer/respawn/tower/rift/elem/elemRw/riftMon
│   └─ cultivation 额外: capped（瓶颈提示标记）
├─ mastery{ id:{lvl,xp} }  精通表
├─ formations{ id:{levels:[]} }  阵纹等级
├─ plots[{seedId,growth,ready}]  灵植地块
├─ stun             眩晕剩余秒数（入世被识破，期间无法开始新动作）
├─ world{ buildings,pop,res,dynasties[],dynAccum }  洞天：建筑等级 / 人口 / 粮食木材石料存量 / 朝代人口池 / 距下次结算秒数
├─ planet{ aura,auraVer,cross }  穿越星球：灵气浓度 / 迁移标记 / 穿越次数（open/items/boost/session 为瞬态）
├─ tower{ current,best,pending }  锁妖塔：当前层 / 最高已通关层 / 待领奖层（false 为无）
├─ rift{ open,tier }  异界裂缝：是否存在未修复裂缝 / 层级（生成时的穿越次数）
├─ elemRifts{ next,slots[] }  五行属性裂缝：下次整轮刷新时间戳 / 3 个 {elem,tier,fixed}
├─ riftMon{ alive,born,next,tier }  裂缝怪物：是否存在未击败 / 生成时间 / 下次刷新 / 生成时穿越次数
├─ action{skill,id} / actionTimer / actionWaiting   单一动作槽
├─ regenTimer / taskTimer   被动与任务计时
├─ tasks{ id:{done,claimed} }   任务进度
├─ ui{ active,autoEat,eatFood,eatRatio,invFilter,invSellMode,shopCat,farmSeedId }
├─ log[]            见闻（最多 60 条）
└─ stats{ gathered,crafts,kills,deaths,breaks,pills,gained{},startedAt }
```

### 5.1 存档迁移（`mergeState`）

旧存档用 `defaultState()` 兜底，逐字段校验 + 钳制：

- 数值字段 `gold/spirit/stardust/hp` 非负钳制。
- `inv` 只保留合法物品 id 且数量 > 0 的项。
- `equip` 校验物品存在且 `type === 'equip'`。
- `skills` 按 `SKILL_ORDER` 迁移；修炼等级钳制到 `TOTAL_STAGES`（96,533），修为钳制到当前瓶颈；普通技能等级无上限，仅做非负取整。
- `mastery` / `formations` / `plots` 按当前配置**裁剪**（删除已下线的动作 / 阵法 / 种子）。
- `action` 校验 `findActivity` 存在，否则回落默认。
- `world` 按 `BUILDINGS` 裁剪建筑等级（等级无上限，原样保留），资源钳制到 `worldCap(建设度)`（上限随建设度增长），人口钳制到当前人口上限。
- `planet` 只恢复 `aura` / `auraVer` / `cross`：先恢复 `cross` 再按新公式算上限；旧档（无 `auraVer`）给新上限的 30%，其余存档把 `aura` 钳制到 `[1, 当前上限]`，`cross` 取整并钳制到 `[0,10000]`；飞行队列等瞬态一律重置，且不恢复星球动作（读档保持未开启）。
- `tasks` 按 `TASKS` 迁移；`ui.active` 校验白名单（含 `world` / `planet` / `tower` / `settings`；`devtools` 刻意不在白名单，读档一律回落）。
- `tower` 无字段时兜底 `current=1 / best=1 / pending=false`；`current/best` 夹到 `[1, TOWER.MAX_FLOOR]`，`pending` 必须等于 `current` 才恢复，否则置 `false`；`best` 收敛为至少 `current-1`。
- `rift` 无字段时兜底 `open=true / tier=min(planet.cross, max(0, 战斗等级-1))`；有字段时 `tier` 取整并夹到 `[0, RIFT.MAX_TIER]` 且不超过 `planet.cross`。进行中的裂缝战斗（`action.skill='rift'` / `combat.rift>=0`）是瞬态，读档清空，但 `open/tier` 保留。
- `elemRifts` 无字段（旧档）时按当前时间立刻生成一轮 3 道；有字段时只恢复合法五行 id 的槽位，`tier` 夹到 `[0, MAX_TIER]`、`fixed` 布尔化，槽位不足 3 个用随机属性补齐；`next` 缺失/非法或已过期（离线超过 3 小时）则整轮重掷并重置为 `now + 3h`（不做多次补偿刷）。进行中的属性裂缝战斗（`action.skill='elem'` / `combat.elem>=0`）不恢复，`fixed` 状态保留。
- `riftMon` 无字段（旧档）时立即生成一只，`tier = planet.cross`、`next = now + 24h`；有字段时恢复 `alive/born/next/tier`（`tier` 夹到 `[0, MAX_TIER]`），`next` 已过期（离线超过 24 小时）则换一只新的并重置 24h（只换一轮，不补刷）；进行中的裂缝怪物战斗（`action.skill='riftmon'` / `combat.riftMon>=0`）不恢复，`alive` 状态保留。
- `seed` 缺失按 0，异常夹到 `[0, 1e12]` 整数；`world.dynasties` 缺失按空（不凭空补人口），每条只保留 `dyn ∈ [0, 50]`、`pop/cap ∈ [1, 5000]` 且 `pop ≤ cap` 的记录，超出「小世界等级 × 5」的条目截断；`world.dynAccum` 缺失或非法 / ≥ 600 按 0。
- 兑换码与测试控制台相关状态（`REDEEM.CODES`、`DEV`）**不进入存档**：`DEV` 是会话级全局对象，刷新即失效；因此无需迁移，也不会因为改档而解锁。

> **原则**：任何新引入的配置表，都要在 `mergeState` 中做裁剪与钳制，保证旧存档不崩。

---

## 6. 技术架构

### 6.1 分层

| 层 | 文件 | 职责 |
| --- | --- | --- |
| 数据层 | `js/data.js` | 纯配置（`CONFIG`/`ITEMS`/`SKILLS`/`ACTIONS`/`RECIPES`/`MONSTERS`/`FORMATIONS`/`FARM_SEEDS`/`TASKS`/`SHOPS`/`WUXING`/`REALM_DEFS`/`WORLD`/`BUILDINGS`）+ 纯函数工具 |
| 状态层 | `js/state.js` | 唯一存档对象 `state`、`defaultState`、`mergeState`、`save/load/reset` |
| 引擎层 | `js/engine.js` | `tick(dt)` 唯一时间入口；动作 / 战斗 / 被动 / 精通 / 任务 / 离线结算 |
| 界面层 | `js/ui.js` | DOM 渲染 + 增量刷新（签名缓存） |
| 入口层 | `js/main.js` | 启动 `boot()`、主循环 `startLoop()`、事件分发 `handleClick()` |

`index.html` 以经典 `<script>` 顺序串联，**无 ES Modules**。

### 6.2 主循环（`startLoop`）

```
setInterval(tick→updateBars, TICK_MS)      // 逻辑心跳：推进游戏时间
setInterval(renderAll,        RENDER_MS)   // 结构刷新：重绘面板
setInterval(saveState,        AUTOSAVE_MS) // 自动存档
```

`tick(dt)` 顺序：`passiveTick → worldTick → cycleTick → combatTick → planetTick → autoEatTick → clampHp → taskTimer/checkTasks`。

### 6.3 渲染防抖动（关键约定）

> 高频变化的数值**绝不能写进面板 HTML**，否则每次刷新都会重建 DOM，导致点击无响应、悬停闪烁。

- `setHTML(sel, html)` 用**签名**判断是否需要重绘，签名会**剔除 `width:NN%`**。
- 每 tick 变化的数值放在 `data-*` 占位节点，由增量刷新函数写入：
  - `updateBars()`（生命、动作条、侧栏技能条）
  - `updateInvQty()`（背包数量 / 容量）
  - `updateMatNeeds()`（配方材料需求）
  - `updateXpText()` / `updateXpBars()`（经验文本与进度条）
  - `updateFormState()`（阵法星砂与按钮可用性）
  - `updatePlotGrowth()`（灵植生长条）
  - `updateWorldState()`（洞天人口 / 资源 / 产出 / 建造按钮可用性）
- 悬停反馈用 `box-shadow` 内描边，**避免 `translateX/Y`** 撑大滚动区。

---

## 7. 界面布局

```
┌──────────────────────── #topbar ─────────────────────────┐
│ 品牌 │ 资源(灵石/灵力/星砂/境界/伤害/命中/减伤) │ 生命条 │ 疗伤/保存/重开 │
├─ #sidebar ─┬──── #content ────┬──── #right ────┤
│ 任务       │  当前技能面板    │ 角色(自动进食)  │
│ 背包       │  （动作/配方/    │ 装备槽          │
│ 市集       │   战斗/突破/     │ 见闻日志        │
│ 修炼       │   阵法/灵植…）   │                 │
│ 战斗       │                  │                 │
│ …各技能    │  底部：当前动作条 │                 │
└────────────┴──────────────────┴─────────────────┘
```

- 侧栏顺序：任务 → 背包 → 市集 → 修炼 → 战斗 → 其余技能（按 `SKILL_ORDER`）→ 世界（洞天）。
- 底部动作条：显示当前动作名与进度，并提供「停止」。
- 灵植地块为响应式网格 `grid-template-columns: repeat(auto-fill, minmax(140px,1fr))`。

---

## 8. 开发与扩展约定

1. **改数值只改 `data.js`**，逻辑不写在数据层。
2. **新增技能**：`SKILLS` + `SKILL_ORDER` +（可选）`ACTIONS/RECIPES`，并在 `XP_GROUP` 声明经验组。
3. **新增动作**：加进 `ACTIONS`（无消耗采集）或 `RECIPES`（有消耗配方）。
4. **新增加成通道**：在阵法 `mods` 里定义 `key`，引擎统一用 `formBonus(key)` 读取。
5. **新增存档字段**：`defaultState` 给默认值 + `mergeState` 做校验迁移。
6. **新增 UI**：渲染函数用占位节点 + 增量刷新；不要每 tick 写数值。
7. **新增被动过程**（如灵植生长）：放进 `passiveTick`，天然获得离线支持。
8. 提交前跑 `node --check js/*.js` 与无头冒烟测试。

---

## 9. 附：机制文档索引

见根目录 [README.md](../README.md#文档索引)。
