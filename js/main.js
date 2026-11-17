'use strict';

/* =========================================================================
 * 穿越星球 · 入口层
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
      /* 从侧栏进入穿越星球时回到主视图（裂缝视图内另有返回按钮） */
      if (el.dataset.skill === 'planet') state.ui.planetView = 'main';
      /* 测试控制台：仅本次运行兑换后可用 */
      if (el.dataset.skill === 'devtools') {
        if (!DEV.unlocked) { state.ui.active = 'settings'; break; }
        _devDirty = true;
      }
      hideInvPopover();
      /* 星球已改为动作槽行为：仅切面板不启停，由面板按钮控制 */
      break;

    /* 设置：兑换码校验（成功/失败都写回提示，不落存档） */
    case 'redeem': {
      const inp = document.querySelector('[data-set-in="code"]');
      redeemCode(inp ? inp.value : '');
      if (inp) inp.value = '';
      renderAll();
      updateSettingsMsg();
      return;
    }

    /* 设置 → 测试控制台 */
    case 'devopen':
      if (!DEV.unlocked) { renderAll(); return; }
      state.ui.active = 'devtools';
      _devDirty = true;
      hideInvPopover();
      break;

    /* 测试控制台：执行一项改动（所有逻辑在 engine.devRun 内复用既有函数） */
    case 'devact': {
      const keys = (el.dataset.vals || '').split(',').filter(function (k) { return !!k; });
      const vals = keys.map(function (k) {
        const node = document.querySelector('[data-dev-in="' + k + '"]');
        return node ? node.value : '';
      });
      devRun(el.dataset.dev, vals);
      _devDirty = true;
      renderAll();
      updateBars();
      return;
    }

    /* 穿越星球：点击界面加速（生成与飞行 ×2，仅在运转期间生效） */
    case 'planetboost':
      planetBoost();
      renderAll();
      return;

    /* 穿越星球：开启 / 停止（占用全局动作槽） */
    case 'planetrun':
      planetStart();
      renderAll();
      updatePlanet(true);
      return;

    /* 穿越星球：穿越朝代（消耗灵气浓度，只改朝代与次数） */
    case 'planetcross':
      planetCross();
      renderAll();
      updatePlanet(true);
      return;

    /* 异界裂缝：打开战斗视图 / 返回星球 / 开始或停止修复（同属单一动作槽） */
    case 'riftopen':
      state.ui.planetView = 'rift';
      hideInvPopover();
      break;
    case 'riftback':
      state.ui.planetView = 'main';
      hideInvPopover();
      break;
    case 'riftstart':
      startRift();
      renderAll();
      updateRift(true);
      return;
    case 'elemopen':
      state.ui.planetView = 'elem';
      state.ui.elemSlot = Math.max(0, Math.min(ELEM_RIFT.SLOTS - 1, Math.floor(Number(el.dataset.idx) || 0)));
      hideInvPopover();
      break;
    case 'elemback':
      state.ui.planetView = 'main';
      hideInvPopover();
      break;
    case 'elemstart':
      startElemRift(state.ui.elemSlot | 0);
      renderAll();
      updateElemRift(true);
      return;
    /* 裂缝怪物：打开详情视图 / 返回星球 / 开始或停止挑战 */
    case 'rmopen':
      state.ui.planetView = 'riftmon';
      hideInvPopover();
      break;
    case 'rmback':
      state.ui.planetView = 'main';
      hideInvPopover();
      break;
    case 'rmstart':
      startRiftMon();
      renderAll();
      updateRiftMon(true);
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

    /* 锁妖塔：开始/停止挑战、领取当前层奖励（同属单一动作槽） */
    case 'towerstart': towerToggle(); renderAll(); updateTower(true); return;
    case 'towerclaim': towerClaim(); renderAll(); updateTower(true); return;

    case 'stop': stopAction(); break;

    /* 突破 */
    case 'break': breakthrough(); break;

    /* 任务领取 */
    case 'claim': claimTask(id); break;

    /* 签到：领取今日奖励（按本地日期判定，领取后立即落盘防重复） */
    case 'checkin':
      claimCheckin();
      renderAll();
      updateCheckinState();
      return;

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
    /* 洞天子页面：营造 / 朝代 */
    case 'wview':
      state.ui.worldView = (id === 'dynasty') ? 'dynasty' : 'main';
      state.ui.dynMerge = -1;
      hideInvPopover();
      break;
    /* 朝代：召唤（消耗生命之种，瞬时、不占动作槽） */
    case 'dynsummon':
      summonDynasty();
      renderAll();
      updateDynastyState();
      return;
    /* 朝代：选中合成目标（再点同名朝代的「并入」完成合成） */
    case 'dynmerge':
      state.ui.dynMerge = Math.max(0, Math.floor(Number(id) || 0));
      break;
    case 'dynmergetarget': {
      const ti = state.ui.dynMerge;
      const si = Math.max(0, Math.floor(Number(id) || 0));
      const tgt = state.world.dynasties[ti];
      const src = state.world.dynasties[si];
      if (!tgt || !src) { renderAll(); return; }
      const lost = [];
      DYNASTY.POST_ORDER.forEach(function (role) {
        const uid = src.posts ? src.posts[role] : null;
        if (!uid) return;
        const inst = discInstance(uid);
        const cat = inst ? findDisciple(inst.id) : null;
        lost.push((cat ? cat.name : uid) + '（' + dynPostName(role) + '）');
      });
      const msg = '确定将「' + dynastyName(src.dyn) + '」（第 ' + (si + 1) + ' 位）并入「' +
        dynastyName(tgt.dyn) + '」（第 ' + (ti + 1) + ' 位）？\n\n' +
        '被并入的朝代将消失并腾出 1 个朝代位。' +
        (lost.length
          ? '\n该朝代的' + lost.join('、') + '将随朝代一起消失，无法恢复。'
          : '\n该朝代没有在任职位。') +
        '\n\n此操作不可撤销。';
      const doMerge = function () {
        mergeDynasty(ti, si);
        state.ui.dynMerge = -1;
        renderAll();
        updateDynastyState();
      };
      const cancelMerge = function () {
        renderAll();
        updateDynastyState();
      };
      showConfirm('朝代合成确认', msg, function () {
        if (!lost.length) { doMerge(); return; }
        const warn = '再次确认：' + lost.join('、') +
          '将随朝代一起永久消失（从信徒仓库移除），无法恢复，也不退还招募费。\n\n确定继续合成？';
        showConfirm('二次确认', warn, doMerge, cancelMerge);
      }, cancelMerge);
      return;
    }
    case 'dynmergecancel':
      state.ui.dynMerge = -1;
      break;
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

    /* 信徒：招募 / 上阵（下拉选择）/ 撤下 / 遣散（二次确认） */
    case 'recruit': recruitDisciple(); break;
    case 'dunassign': unassignDisciple(el.dataset.task || ''); break;
    case 'deldisc': {
      const inst = discInstance(el.dataset.uid || '');
      if (inst) {
        showConfirm('遣散确认', discDeleteConfirm(inst), function () {
          removeDisciple(inst.uid);
          renderAll();
          updateDiscipleState();
        });
      }
      return;
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
      showConfirm('重开确认', '确定要重开吗？当前所有进度将被清空。', function () {
        resetGame();
        state.ui.active = 'woodcutting';
        hideToast();
        renderAll();
      });
      return;
    case 'clearlog': state.log = []; break;
    case 'closetoast': hideToast(); return;

    default: return;
  }

  renderAll();
}

function bindEvents() {
  document.addEventListener('click', handleClick);

  /* 应用内确认弹窗：只有「确认」按钮执行 onOk */
  const okBtn = document.getElementById('confirmOk');
  const cancelBtn = document.getElementById('confirmCancel');
  const mask = document.getElementById('confirmMask');
  if (okBtn) okBtn.addEventListener('click', function () { closeConfirm(true); });
  if (cancelBtn) cancelBtn.addEventListener('click', function () { closeConfirm(false); });
  if (mask) mask.addEventListener('click', function (e) { if (e.target === mask) closeConfirm(false); });
  document.addEventListener('keydown', function (e) {
    if (CONFIRM_UI.open && e.key === 'Escape') { e.preventDefault(); closeConfirm(false); }
  });

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
    /* 朝代职位：任命即刻锁定，应用内确认写明不可取下 / 更换 */
    if (t.dataset && t.dataset.act === 'dynpost') {
      const idx = Math.floor(Number(t.dataset.idx));
      const role = t.dataset.role;
      const uid = t.value;
      /* 原生 select 的选中值会先于确认生效；先复位，弹窗本身即待确认态 */
      t.value = '';
      if (uid) {
        const d = state.world.dynasties[idx];
        const inst = discInstance(uid);
        const cat = inst ? findDisciple(inst.id) : null;
        const label = dynPostName(role);
        showConfirm('职位任命确认',
          '确定任命「' + (cat ? cat.name : uid) + '」为「' +
          (d ? dynastyName(d.dyn) : '') + '」' + label + '？\n\n' +
          '上任后不可取下、不可更换；该信徒将无法再驻守任何任务，也无法被其它朝代任命。',
          function () {
            assignDynastyPost(idx, role, uid);
            renderAll();
            updateDynastyState();
          },
          function () {
            renderAll();
            updateDynastyState();
          });
      } else {
        renderAll();
        updateDynastyState();
      }
      return;
    }
    /* 道侣：选择只打开确认弹窗，不直接改 owned / assign / 职位 / 道侣记录。
       只有弹窗「确认」按钮的回调会调用 bindDaolv；取消 / Esc / 遮罩一律不改数据。 */
    if (t.dataset && t.dataset.act === 'daolv') {
      const a = discInstance(t.dataset.uid || '');
      const bUid = t.value || '';
      t.value = '';
      const b = discInstance(bUid);
      if (a && b) {
        showConfirm('化道确认', daolvConfirm(a, b), function () {
          bindDaolv(a.uid, b.uid);
          renderAll();
          updateDiscipleState();
        }, function () {
          renderAll();
          updateDiscipleState();
        });
      } else {
        renderAll();
        updateDiscipleState();
      }
      return;
    }
    if (t.dataset && t.dataset.act === 'dassign') {
      if (t.value) assignDisciple(t.dataset.task || '', t.value);
      else unassignDisciple(t.dataset.task || '');
      renderAll();
      updateDiscipleState();
      return;
    }
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
  document.title = '穿越星球 v' + ver + ' · Planet Crossing';

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
