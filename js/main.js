'use strict';

/* =========================================================================
 * 仙途挂机 · 入口层
 * 负责：启动、主循环、事件绑定、自动存档。
 * ========================================================================= */

function handleClick(e) {
  let el = e.target;
  while (el && el !== document.body) {
    if (el.dataset && el.dataset.act) break;
    el = el.parentElement;
  }
  if (!el || !el.dataset || !el.dataset.act) return;

  const act = el.dataset.act;
  const id = el.dataset.id;

  switch (act) {
    /* 侧栏切换面板 */
    case 'select':
      state.ui.active = el.dataset.skill;
      hideInvPopover();
      /* 星球已改为动作槽行为：仅切面板不启停，由面板按钮控制 */
      break;

    /* 穿越星球：点击界面加速（生成与飞行 ×2，仅在运转期间生效） */
    case 'planetboost':
      planetBoost();
      renderAll();
      return;

    /* 穿越星球：开启 / 停止（占用全局动作槽） */
    case 'planetrun':
      planetStart();
      renderAll();
      return;

    /* 穿越星球：穿越朝代（消耗灵力，只改朝代与次数） */
    case 'planetcross':
      planetCross();
      renderAll();
      return;

    /* 面板跳转（星球面板 → 洞天秘境营造引力塔） */
    case 'goto':
      state.ui.active = el.dataset.skill;
      if (id && findTerrain(id)) state.ui.worldTerrain = id;
      hideInvPopover();
      break;

    /* 开始 / 停止 采集·炼器·炼丹·打坐（单一动作槽） */
    case 'action': startAction(el.dataset.skill || state.ui.active, id); break;

    /* 选择妖兽 */
    case 'monster': startCombat(id); break;

    /* 进入秘境 */
    case 'dungeon': startDungeon(id); break;

    case 'stop': stopAction(); break;

    /* 突破 */
    case 'break': breakthrough(); break;

    /* 任务领取 */
    case 'claim': claimTask(id); break;

    /* 背包筛选 */
    case 'filter': state.ui.invFilter = id; hideInvPopover(); break;

    /* 背包操作（qty 缺省为 1，-1 表示全部） */
    case 'eat': eatFood(id, Number(el.dataset.qty) || 1, false); hideInvPopover(); break;
    case 'use': usePill(id, Number(el.dataset.qty) || 1); hideInvPopover(); break;
    case 'equip': equipItem(id); hideInvPopover(); break;
    case 'unequip': unequipSlot(id); break;

    /* 背包格子：始终弹出操作菜单（出售模式下主按钮为「出售」） */
    case 'invslot':
      showInvPopover(id, el); return;   /* return：不重绘整树，避免弹层被销毁 */

    /* 选择数量（使用 / 出售共用；-1 = 全部），弹层内实时刷新 */
    case 'setqty':
      state.ui.itemQty = Number(el.dataset.qty);
      refreshInvPopover();
      break;

    case 'togglesell':
      state.ui.invSellMode = !state.ui.invSellMode;
      hideInvPopover();
      break;

    /* 出售 */
    case 'sell':
      sellItem(id, Number(el.dataset.qty) || 1);
      hideInvPopover();
      break;
    case 'sellall':
      sellItem(id, -1);
      hideInvPopover();
      break;
    case 'closepop':
      hideInvPopover();
      return;

    /* 市集 */
    case 'shopcat': state.ui.shopCat = id; break;
    case 'wterrain': setWorldTerrain(id); return;
    case 'buy':
      buyItem(id, Number(el.dataset.qty) || 1, Number(el.dataset.price) || 0);
      break;
    case 'buymax': {
      const price = Number(el.dataset.price) || 0;
      let qty = price > 0 ? Math.floor(state.gold / price) : 0;
      if (qty > 0) buyItem(id, qty, price);
      break;
    }

    /* 世界 · 营造建筑 */
    case 'build': buildBuilding(id); break;

    /* 信徒：招募 / 上阵 / 卸下 */
    case 'recruit': recruitDisciple(); break;
    case 'dfollow': equipDisciple(id); break;
    case 'dunfollow': unequipDisciple(Number(el.dataset.slot)); break;

    /* 阵法 · 点亮阵纹 */
    case 'formup': formUpgrade(id, Number(el.dataset.idx)); break;

    /* 灵植：选种 / 种植 / 收获 */
    case 'farmseed':
      state.ui.farmSeedId = id;
      renderContent();
      break;
    case 'plot_plant':
      if (!state.ui.farmSeedId) { logMsg('先从上方选一枚种子。', 'warn'); break; }
      plantSeed(Number(el.dataset.idx), state.ui.farmSeedId);
      renderContent();
      break;
    case 'plot_harvest':
      harvestPlot(Number(el.dataset.idx));
      renderContent();
      break;

    case 'heal': healWithSpirit(); break;
    case 'save': saveState(); showToast('<h4>💾 已保存进度</h4>'); break;
    case 'reset':
      if (window.confirm('确定要重开吗？当前所有进度将被清空。')) {
        resetGame();
        state.ui.active = 'woodcutting';
        hideToast();
        renderAll();
      }
      break;
    case 'clearlog': state.log = []; break;
    case 'closetoast': hideToast(); return;

    default: return;
  }

  renderAll();
}

function bindEvents() {
  document.addEventListener('click', handleClick);

  /* 点击背包弹层外区域时关闭弹层 */
  document.addEventListener('click', function (e) {
    const pop = document.getElementById('invPopover');
    if (!pop || pop.classList.contains('hidden')) return;
    let n = e.target;
    while (n && n !== document.body) {
      if (n === pop) return;
      if (n.dataset && n.dataset.act === 'invslot') return;
      n = n.parentElement;
    }
    hideInvPopover();
  });

  document.addEventListener('change', function (e) {
    const t = e.target;
    if (!t) return;
    if (t.dataset && t.dataset.qtyinput !== undefined) {
      setItemQty(Number(t.value));
      renderAll();
      refreshInvPopover();
      return;
    }
    if (t.id === 'autoEat') state.ui.autoEat = t.checked;
    else if (t.id === 'eatFood') state.ui.eatFood = t.value;
    else if (t.id === 'eatRatio') state.ui.eatRatio = Number(t.value) || 0.35;
    else return;
    renderAll();
  });

  /* 切走页面 / 关闭页面时存档，配合时间戳实现离线收益 */
  document.addEventListener('visibilitychange', function () {
    if (document.hidden) saveState();
  });
  window.addEventListener('beforeunload', saveState);
}

function startLoop() {
  let last = performance.now();

  /* 逻辑心跳：推进游戏时间 */
  setInterval(function () {
    const now = performance.now();
    let dt = (now - last) / 1000;
    last = now;
    if (!isFinite(dt) || dt <= 0) return;
    if (dt > 2) dt = 2;          // 标签页被挂起时防止一次性跳太多
    tick(dt);
    updateBars();
  }, CONFIG.TICK_MS);

  /* 界面刷新：结构性重绘 */
  setInterval(renderAll, CONFIG.RENDER_MS);

  /* 星球飞行物：rAF 逐帧位移，只在穿越星球面板生效 */
  (function planetFrame() {
    updatePlanet();
    requestAnimationFrame(planetFrame);
  })();

  /* 窗口尺寸变化后重新测量星球舞台，避免飞行物坐标漂移 */
  window.addEventListener('resize', function () { resetPlanetGeo(); });

  /* 自动存档 */
  setInterval(saveState, CONFIG.AUTOSAVE_MS);
}

function boot() {
  /* 版本号：唯一来源是 data.js 的 VERSION，界面角标与窗口标题同步 */
  const ver = (typeof VERSION === 'string' && VERSION) ? VERSION : '0.0.0';
  const verTag = document.getElementById('verTag');
  if (verTag) {
    verTag.textContent = 'v' + ver;
    verTag.title = '游戏版本 v' + ver;
  }
  document.title = '仙途挂机 v' + ver + ' · Idle Cultivation';

  const offlineSeconds = loadState();
  clampHp();
  checkTasks();

  let report = null;
  if (offlineSeconds > 3) {
    report = simulateOffline(offlineSeconds);
    const r = realmInfo(state.skills.cultivation.lvl);
    logMsg('闭关归来，当前境界「' + r.full + '」。', 'info');
  }

  /* 星球已改为主动动作：planet 动作不入 ACTIONS/RECIPES，mergeState 不会恢复它，
     planet 瞬态也一律重置。读档可停留在星球面板，但保持「未开启」，由玩家点按钮开启。 */
  planetReset();

  renderAll();
  if (report) renderOfflineReport(report);

  bindEvents();
  startLoop();
}

boot();
