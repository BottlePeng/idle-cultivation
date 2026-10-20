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
    case 'select': state.ui.active = el.dataset.skill; hideInvPopover(); break;

    /* 开始 / 停止 采集·炼器·炼丹·打坐（单一动作槽） */
    case 'action': startAction(el.dataset.skill || state.ui.active, id); break;

    /* 选择妖兽 */
    case 'monster': startCombat(id); break;

    case 'stop': stopAction(); break;

    /* 突破 */
    case 'break': breakthrough(); break;

    /* 任务领取 */
    case 'claim': claimTask(id); break;

    /* 背包筛选 */
    case 'filter': state.ui.invFilter = id; hideInvPopover(); break;

    /* 背包操作 */
    case 'eat': eatFood(id); hideInvPopover(); break;
    case 'use': usePill(id); hideInvPopover(); break;
    case 'equip': equipItem(id); hideInvPopover(); break;
    case 'unequip': unequipSlot(id); break;

    /* 背包格子：出售模式直接卖 1 个，否则弹出操作菜单 */
    case 'invslot':
      if (state.ui.invSellMode) { sellItem(id, 1); hideInvPopover(); }
      else { showInvPopover(id, el); return; }   /* return：不重绘整树，避免弹层被销毁 */
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
    case 'buy':
      buyItem(id, Number(el.dataset.qty) || 1, Number(el.dataset.price) || 0);
      break;
    case 'buymax': {
      const price = Number(el.dataset.price) || 0;
      let qty = price > 0 ? Math.floor(state.gold / price) : 0;
      if (qty > 0) buyItem(id, qty, price);
      break;
    }

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
      if (window.confirm('确定要重开吗？当前所有进度将被清空，并重抽灵根。')) {
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

  /* 自动存档 */
  setInterval(saveState, CONFIG.AUTOSAVE_MS);
}

function boot() {
  const offlineSeconds = loadState();
  clampHp();
  checkTasks();

  let report = null;
  if (offlineSeconds > 3) {
    report = simulateOffline(offlineSeconds);
    const r = realmInfo(state.skills.cultivation.lvl);
    logMsg('闭关归来，当前境界「' + r.full + '」。', 'info');
  }

  renderAll();
  if (report) renderOfflineReport(report);

  bindEvents();
  startLoop();
}

boot();
