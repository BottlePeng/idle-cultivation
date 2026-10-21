# 游戏设计文档（GDD）· 仙途挂机

> 版本：v4（含入世、五行灵根与悟性）｜ 最后更新：随代码同步 ｜ 对应代码：`js/data.js` `js/state.js` `js/engine.js` `js/ui.js` `js/main.js`

---

## 1. 游戏概述

| 项 | 内容 |
| --- | --- |
| 名称 | 仙途挂机 · Idle Cultivation |
| 题材 | 东方修仙 |
| 类型 | 放置 / 挂机（Idle）模拟经营 + 角色成长 |
| 平台 | 纯静态网页（PC 优先），双击 `index.html` 即运行 |
| 商业模式 | 单机、无内购、无联网 |
| 玩法参考 | 《梅尔沃放置》的动作 / 精通 / 命中制战斗 / 多商店 / 观星 / 种植；《凡人修仙传》的境界 / 灵根 / 丹药 |

### 1.1 设计目标

1. **一句话上手**：点击即挂机，离开也在变强。
2. **单一动作槽**：同一时间只做一件事，选择即取舍，避免多线程挂机的通胀。
3. **离线收益与在线一致**：离线用同一套 `tick` 快进模拟，数值口径完全一致。
4. **长线成长曲线**：10 大技能 + 33 阶境界 + 精通 + 阵法 + 灵植，形成多轴养成。
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
| 5 | 修炼境界 | 五行灵根 + 悟性 + 33 阶境界 + 突破（终局：化神大圆满→炼虚大圆满需五行全 Lv.100） | `WUXING/REALM_DEFS` | [修炼与境界](./机制-修炼与境界.md) |
| 6 | 战斗 | 命中制、属性、妖兽、自动进食 | `MONSTERS/CONFIG` | [战斗系统](./机制-战斗系统.md) |
| 7 | 生产技能 | 伐木 / 钓鱼 / 采矿 / 炼器 / 炼丹 | `ACTIONS/RECIPES` | [生产技能](./机制-生产技能.md) |
| 8 | 装备 | 六部位法宝，属性加成 | `ITEMS.type='equip'` | [装备系统](./机制-装备系统.md) |
| 9 | 阵法 | 观星取星砂 → 点亮阵纹 → 全局加成 | `FORMATIONS` | [阵法系统](./机制-阵法系统.md) |
| 10 | 灵植 | 地块被动生长，参考梅尔沃种植 | `FARM_SEEDS/FARMING_PLOT_REQS` | [灵植系统](./机制-灵植系统.md) |
| 11 | 任务 | 成就式条件 + 奖励领取 | `TASKS` | [任务系统](./机制-任务系统.md) |
| 12 | 背包 | 100 格种类上限、操作菜单、出售模式 | `CONFIG.INV_SLOTS` | [背包系统](./机制-背包系统.md) |
| 13 | 市集 | 四店铺采购，加价购入 / 折价出售 | `SHOPS` | [市集系统](./机制-市集系统.md) |
| 14 | 入世 | 红尘百业职业体验，概率成败，参考梅尔沃盗窃 | `ACTIONS.thieving/state.stun` | [入世系统](./机制-入世系统.md) |

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
- **境界**：共 6 大境界 × 若干小境界 = **33 阶**，最终阶 `炼虚期 大圆满` 为封顶。
- **精通**：单个动作最高 Lv.99，耗时最多 -20%，额外产出最多 +49.5%。

---

## 5. 数据结构与存档

存档写 `localStorage[CONFIG.SAVE_KEY]`，键为 `xiuxian_idle_save_v1`，序列化整个 `state` 对象。

```
state
├─ version          存档版本
├─ gold/spirit/stardust   灵石 / 灵力 / 星砂
├─ hp               当前生命
├─ inv{ id:qty }    背包：物品种类 → 数量
├─ equip{ slot:id } 六部位装备
├─ insight          悟性（每点 修炼速度+1% / 突破成功率+1%）
├─ skills{ id:{lvl,xp} }   各技能等级与经验
│   └─ combat 额外: monster/target/playerTimer/monsterTimer/respawn
│   └─ cultivation 额外: capped（瓶颈提示标记）
├─ mastery{ id:{lvl,xp} }  精通表
├─ formations{ id:{levels:[]} }  阵纹等级
├─ plots[{seedId,growth,ready}]  灵植地块
├─ stun             眩晕剩余秒数（入世被识破，期间无法开始新动作）
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
- `skills` 按 `SKILL_ORDER` 迁移；修炼等级钳制到 `STAGES.length`，修为钳制到当前瓶颈。
- `mastery` / `formations` / `plots` 按当前配置**裁剪**（删除已下线的动作 / 阵法 / 种子）。
- `action` 校验 `findActivity` 存在，否则回落默认。
- `tasks` 按 `TASKS` 迁移；`ui.active` 校验白名单。

> **原则**：任何新引入的配置表，都要在 `mergeState` 中做裁剪与钳制，保证旧存档不崩。

---

## 6. 技术架构

### 6.1 分层

| 层 | 文件 | 职责 |
| --- | --- | --- |
| 数据层 | `js/data.js` | 纯配置（`CONFIG`/`ITEMS`/`SKILLS`/`ACTIONS`/`RECIPES`/`MONSTERS`/`FORMATIONS`/`FARM_SEEDS`/`TASKS`/`SHOPS`/`WUXING`/`REALM_DEFS`）+ 纯函数工具 |
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

`tick(dt)` 顺序：`passiveTick → cycleTick → combatTick → autoEatTick → clampHp → taskTimer/checkTasks`。

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

- 侧栏顺序：任务 → 背包 → 市集 → 修炼 → 战斗 → 其余技能（按 `SKILL_ORDER`）。
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
