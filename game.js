(() => {
  'use strict';

  const CONFIG = Object.freeze({
    rows: 7,
    cols: 7,
    cells: 49,
    minCluster: 8,
    targetRtp: 0.96,
    clumpChance: 0.5478,
    maxCascades: 60,
    bonusAnticipationPauseMs: 500,
    bonusAnticipationStepMs: 100,
    maxBonusAnticipation: 5,
    bets: [0.20, 0.50, 1.00, 2.00, 5.00, 10.00]
  });

  const PAY_BANDS = Object.freeze([
    { min: 8, max: 9 },
    { min: 10, max: 11 },
    { min: 12, max: 14 },
    { min: 15, max: 19 },
    { min: 20, max: 24 },
    { min: 25, max: Infinity }
  ]);

  const SYMBOLS = Object.freeze([
    { key: 'extinguisher', label: 'Fire Extinguisher', weight: 20, pays: [0.10, 0.15, 0.25, 0.40, 0.75, 1.50] },
    { key: 'helmet', label: 'Fire Helmet', weight: 18, pays: [0.12, 0.20, 0.30, 0.50, 1.00, 2.00] },
    { key: 'axe', label: 'Fire Axe', weight: 16, pays: [0.15, 0.25, 0.40, 0.65, 1.25, 2.50] },
    { key: 'hydrant', label: 'Fire Hydrant', weight: 14, pays: [0.20, 0.30, 0.50, 0.80, 1.50, 3.00] },
    { key: 'suit', label: 'Turnout Suit', weight: 12, pays: [0.25, 0.40, 0.65, 1.00, 2.00, 4.00] },
    { key: 'radio', label: 'Fire Radio', weight: 10, pays: [0.30, 0.50, 0.80, 1.25, 2.50, 5.00] },
    { key: 'dalmatian', label: 'Dalmatian', weight: 7, pays: [0.50, 0.75, 1.25, 2.00, 4.00, 8.00] },
    { key: 'chief', label: 'Chief Badge', weight: 5, pays: [0.75, 1.25, 2.00, 3.50, 7.00, 15.00] },
    { key: 'bonus', label: 'Fire Alarm Bonus', weight: 1.0, pays: null, bonus: true },
    { key: 'wild', label: 'Wild', weight: 1.4, pays: null, wild: true }
  ]);

  const REGULAR = SYMBOLS.filter(symbol => !symbol.wild && !symbol.bonus);
  const WILD_KEY = 'wild';
  const BONUS_KEY = 'bonus';
  const NON_CLUMP_KEYS = new Set([WILD_KEY, BONUS_KEY]);
  const TOTAL_WEIGHT = SYMBOLS.reduce((sum, symbol) => sum + symbol.weight, 0);

  const BONUS_TWO_FRAMES = Object.freeze([
    'assets/animations/bonus1/Bonus21.png',
    'assets/animations/bonus1/Bonus22.png',
    'assets/animations/bonus1/Bonus23.png',
    'assets/animations/bonus1/Bonus24.png',
    'assets/animations/bonus1/Bonus25.png'
  ]);

  for (const src of BONUS_TWO_FRAMES) {
    const image = new Image();
    image.src = src;
  }

  const BONUS_THREE_FRAMES = Object.freeze([
    'assets/animations/bonus2/bonus31.png',
    'assets/animations/bonus2/bonus32.png',
    'assets/animations/bonus2/bonus33.png',
    'assets/animations/bonus2/bonus34.png',
    'assets/animations/bonus2/bonus35.png',
    'assets/animations/bonus2/bonus36.png',
    'assets/animations/bonus2/bonus37.png',
    'assets/animations/bonus2/bonus38.png',
    'assets/animations/bonus2/bonus39.png'
  ]);

  for (const src of BONUS_THREE_FRAMES) {
    const image = new Image();
    image.src = src;
  }

  const BONUS_ACTIVE_FRAMES = Object.freeze([
    'assets/animations/bonusActive/BA1.png',
    'assets/animations/bonusActive/BA2.png',
    'assets/animations/bonusActive/BA3.png',
    'assets/animations/bonusActive/BA4.png'
  ]);

  for (const src of BONUS_ACTIVE_FRAMES) {
    const image = new Image();
    image.src = src;
  }

  const $ = id => document.getElementById(id);
  const el = {
    board: $('board'),
    balance: $('balance'),
    bet: $('bet'),
    spinBet: $('spinBet'),
    spin: $('spinBtn'),
    betDown: $('betDown'),
    betUp: $('betUp'),
    lastWin: $('lastWin'),
    message: $('message'),
    cascade: $('cascadeLabel'),
    banner: $('winBanner'),
    statSpins: $('statSpins'),
    statWagered: $('statWagered'),
    statWon: $('statWon'),
    statRtp: $('statRtp'),
    paytableBtn: $('paytableBtn'),
    paytableDialog: $('paytableDialog'),
    paytableClose: $('paytableClose'),
    paytableBody: $('paytableBody'),
    mathBtn: $('mathBtn'),
    mathDialog: $('mathDialog'),
    mathClose: $('mathClose'),
    simulateBtn: $('simulateBtn'),
    simulationOutput: $('simulationOutput'),
    debugBtn: $('debugBtn'),
    debugDialog: $('debugDialog'),
    debugClose: $('debugClose'),
    debugAlarmCount: $('debugAlarmCount'),
    debugAlarmState: $('debugAlarmState')
  };

  const state = {
    board: [],
    balance: 1000,
    betIndex: 2,
    busy: false,
    lastWinX: 0,
    forceAlarmOff: false,
    bonusActive: false,
    stats: { spins: 0, wagered: 0, won: 0 }
  };

  function randomFloat() {
    if (globalThis.crypto?.getRandomValues) {
      const value = new Uint32Array(1);
      globalThis.crypto.getRandomValues(value);
      return value[0] / 4294967296;
    }
    return Math.random();
  }

  function weightedSymbolKey() {
    let roll = randomFloat() * TOTAL_WEIGHT;
    for (const symbol of SYMBOLS) {
      roll -= symbol.weight;
      if (roll <= 0) return symbol.key;
    }
    return SYMBOLS[SYMBOLS.length - 1].key;
  }

  function maybeCloneNeighbor(neighbors) {
    if (!neighbors.length || randomFloat() >= CONFIG.clumpChance) return weightedSymbolKey();
    const selected = neighbors[Math.floor(randomFloat() * neighbors.length)];
    return NON_CLUMP_KEYS.has(selected) ? weightedSymbolKey() : selected;
  }

  function createInitialBoard() {
    const board = Array(CONFIG.cells).fill(null);
    for (let index = 0; index < CONFIG.cells; index++) {
      const row = Math.floor(index / CONFIG.cols);
      const col = index % CONFIG.cols;
      const neighbors = [];
      if (col > 0) neighbors.push(board[index - 1]);
      if (row > 0) neighbors.push(board[index - CONFIG.cols]);
      board[index] = maybeCloneNeighbor(neighbors);
    }
    return board;
  }

  function orthogonalNeighbors(index) {
    const row = Math.floor(index / CONFIG.cols);
    const col = index % CONFIG.cols;
    const neighbors = [];
    if (row > 0) neighbors.push(index - CONFIG.cols);
    if (row < CONFIG.rows - 1) neighbors.push(index + CONFIG.cols);
    if (col > 0) neighbors.push(index - 1);
    if (col < CONFIG.cols - 1) neighbors.push(index + 1);
    return neighbors;
  }

  function payBandIndex(count) {
    return PAY_BANDS.findIndex(band => count >= band.min && count <= band.max);
  }

  function evaluateBoard(board) {
    const wins = [];
    const remove = new Set();

    for (const symbol of REGULAR) {
      const seen = new Set();
      for (let start = 0; start < board.length; start++) {
        if (seen.has(start) || (board[start] !== symbol.key && board[start] !== WILD_KEY)) continue;

        const stack = [start];
        const positions = [];
        let hasRegular = false;
        seen.add(start);

        while (stack.length) {
          const index = stack.pop();
          positions.push(index);
          if (board[index] === symbol.key) hasRegular = true;

          for (const neighbor of orthogonalNeighbors(index)) {
            if (seen.has(neighbor)) continue;
            if (board[neighbor] === symbol.key || board[neighbor] === WILD_KEY) {
              seen.add(neighbor);
              stack.push(neighbor);
            }
          }
        }

        if (!hasRegular || positions.length < CONFIG.minCluster) continue;
        const band = payBandIndex(positions.length);
        if (band < 0) continue;

        const amountX = symbol.pays[band];
        wins.push({ symbol: symbol.key, label: symbol.label, count: positions.length, amountX, positions });
        positions.forEach(index => remove.add(index));
      }
    }

    return {
      wins,
      remove: [...remove],
      totalX: wins.reduce((sum, win) => sum + win.amountX, 0)
    };
  }

  function cascadeBoard(board, removePositions) {
    const remove = new Set(removePositions);
    const next = Array(CONFIG.cells).fill(null);
    const spawned = [];
    const movements = new Map();

    for (let col = 0; col < CONFIG.cols; col++) {
      let targetRow = CONFIG.rows - 1;

      for (let row = CONFIG.rows - 1; row >= 0; row--) {
        const sourceIndex = row * CONFIG.cols + col;
        if (remove.has(sourceIndex)) continue;

        const destinationIndex = targetRow * CONFIG.cols + col;
        next[destinationIndex] = board[sourceIndex];
        movements.set(destinationIndex, {
          rows: targetRow - row,
          col,
          spawned: false
        });
        targetRow--;
      }

      const spawnCount = targetRow + 1;

      while (targetRow >= 0) {
        const index = targetRow * CONFIG.cols + col;
        const neighbors = [];
        if (col > 0 && next[index - 1] != null) neighbors.push(next[index - 1]);
        if (targetRow < CONFIG.rows - 1 && next[index + CONFIG.cols] != null) neighbors.push(next[index + CONFIG.cols]);

        next[index] = maybeCloneNeighbor(neighbors);
        spawned.push(index);
        movements.set(index, {
          rows: spawnCount,
          col,
          spawned: true
        });
        targetRow--;
      }
    }

    return { board: next, spawned, movements };
  }

  function spriteMarkup(key, label = '', bonusCount = 0, forceOff = false, bonusActive = state.bonusActive) {
    if (key === BONUS_KEY) {
      const stateClass = bonusActive
        ? 'symbol-bonus-active'
        : forceOff
          ? 'symbol-bonus-one'
          : bonusCount >= 3
            ? 'symbol-bonus-three'
            : bonusCount === 2
              ? 'symbol-bonus-two'
              : 'symbol-bonus-one';

      return `<span class="symbol-sprite symbol-bonus ${stateClass}" role="img" aria-label="${label}"></span>`;
    }
    return `<span class="symbol-sprite symbol-${key}" role="img" aria-label="${label}"></span>`;
  }

  function updateAlarmDebugStatus(bonusCount) {
    if (!el.debugAlarmCount || !el.debugAlarmState) return;
    el.debugAlarmCount.textContent = bonusCount;
    el.debugAlarmState.textContent =
      bonusCount === 0 ? 'NO ALARMS' :
      state.bonusActive ? 'BONUS ACTIVE' :
      state.forceAlarmOff ? 'RESOLVED / OFF STATE' :
      bonusCount === 1 ? 'STATIC / OFF STATE' :
      bonusCount === 2 ? '2-HIT ANIMATION' :
      '3+ ALARM ANIMATION';
  }

  function bonusStateClass(bonusCount, forceOff = false, bonusActive = state.bonusActive) {
    if (bonusActive) return 'symbol-bonus-active';
    if (forceOff || bonusCount <= 1) return 'symbol-bonus-one';
    if (bonusCount === 2) return 'symbol-bonus-two';
    return 'symbol-bonus-three';
  }

  function applyBonusVisualCount(bonusCount) {
    const stateClass = bonusStateClass(bonusCount, state.forceAlarmOff);
    el.board.querySelectorAll('.symbol-bonus').forEach(sprite => {
      sprite.classList.remove('symbol-bonus-one', 'symbol-bonus-two', 'symbol-bonus-three', 'symbol-bonus-active');
      sprite.classList.add(stateClass);
    });
    updateAlarmDebugStatus(bonusCount);
  }

  function setAnticipationColumns(columns) {
    const active = new Set(columns);
    el.board.classList.toggle('bonus-anticipation', active.size > 0);

    el.board.querySelectorAll('.cell').forEach(cell => {
      const index = Number(cell.dataset.index);
      const col = index % CONFIG.cols;
      cell.classList.toggle('anticipation-column', active.has(col));
    });
  }

  function clearAnticipationColumns() {
    setAnticipationColumns([]);
  }

  function renderBoard(visualBonusCount = null) {
    const actualBonusCount = state.board.reduce((count, key) => count + (key === BONUS_KEY ? 1 : 0), 0);
    const bonusCount = visualBonusCount ?? actualBonusCount;
    updateAlarmDebugStatus(bonusCount);

    el.board.innerHTML = state.board.map((key, index) => {
      const symbol = SYMBOLS.find(item => item.key === key);
      const classes = ['cell'];
      if (symbol?.wild) classes.push('wild');
      if (symbol?.bonus) classes.push('bonus');

      return `<div class="${classes.join(' ')}" data-index="${index}" role="gridcell" aria-label="${symbol?.label || key}">${spriteMarkup(key, symbol?.label || key, bonusCount, state.forceAlarmOff, state.bonusActive)}</div>`;
    }).join('');
  }

  function initialGravityPlan() {
    const movements = new Map();
    for (let index = 0; index < CONFIG.cells; index++) {
      movements.set(index, {
        rows: CONFIG.rows,
        col: index % CONFIG.cols,
        spawned: true
      });
    }
    return movements;
  }

  async function renderBoardWithGravity(movements, options = {}) {
    const { isCascade = false, forceAnticipation = false } = options;

    if (!movements?.size) {
      renderBoard();
      return;
    }

    const actualBonusCount = state.board.reduce((count, key) => count + (key === BONUS_KEY ? 1 : 0), 0);
    const spawnedBonusIndices = [...movements.entries()]
      .filter(([index, move]) => move.spawned && state.board[index] === BONUS_KEY)
      .map(([index]) => index);
    let visibleBonusCount = Math.max(0, actualBonusCount - spawnedBonusIndices.length);

    renderBoard(visibleBonusCount);

    const prefersReducedMotion = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
    if (prefersReducedMotion || !Element.prototype.animate) {
      renderBoard();
      return;
    }

    const survivorMoves = [];
    const spawnedMoves = [];

    for (const [index, move] of movements.entries()) {
      if (move.rows <= 0) continue;

      const cell = el.board.querySelector(`[data-index="${index}"]`);
      if (!cell) continue;

      cell.style.visibility = 'hidden';

      const item = { index, cell, move };
      if (move.spawned) spawnedMoves.push(item);
      else survivorMoves.push(item);
    }

    const firstCell = el.board.querySelector('.cell');
    if (!firstCell) return;

    const computedBoard = getComputedStyle(el.board);
    const gap = parseFloat(computedBoard.rowGap || computedBoard.gap) || 0;
    const pitch = firstCell.getBoundingClientRect().height + gap;

    const columnStagger = 72;
    const fallDuration = 390;

    function prepareMoves(items) {
      for (const { cell, move } of items) {
        const startY = -move.rows * pitch;
        cell.style.transform = `translate3d(0, ${startY}px, 0)`;
        cell.style.willChange = 'transform';
      }
    }

    async function animateItems(items, delayForItem = () => 0) {
      if (!items.length) return;

      const animations = items.map(item => {
        const { cell, move } = item;
        const startY = -move.rows * pitch;
        const delay = delayForItem(item, items.indexOf(item));

        const animation = cell.animate([
          { transform: `translate3d(0, ${startY}px, 0)`, offset: 0 },
          { transform: 'translate3d(0, 4px, 0)', offset: 0.88 },
          { transform: 'translate3d(0, 0, 0)', offset: 1 }
        ], {
          duration: fallDuration,
          delay,
          easing: 'cubic-bezier(.18,.72,.22,1)',
          fill: 'both'
        });

        return animation.finished
          .catch(() => {})
          .then(() => {
            cell.style.transform = '';
            cell.style.willChange = '';
          });
      });

      void el.board.offsetHeight;
      for (const { cell } of items) {
        cell.style.visibility = 'visible';
      }

      await Promise.all(animations);
    }

    async function animateGravityPhase(items) {
      if (!items.length) return;
      const activeColumns = [...new Set(items.map(({ move }) => move.col))].sort((a, b) => a - b);
      const rank = new Map(activeColumns.map((col, index) => [col, index]));
      await animateItems(items, ({ move }) => (rank.get(move.col) || 0) * columnStagger);
    }

    function spawnedByColumn(items) {
      const groups = new Map();
      for (const item of items) {
        if (!groups.has(item.move.col)) groups.set(item.move.col, []);
        groups.get(item.move.col).push(item);
      }
      return groups;
    }

    function bonusCountForItems(items) {
      return items.reduce((count, item) => count + (state.board[item.index] === BONUS_KEY ? 1 : 0), 0);
    }

    async function animateNormalColumns(columns, groups) {
      if (!columns.length) return;
      const rank = new Map(columns.map((col, index) => [col, index]));
      const items = columns.flatMap(col => groups.get(col) || []);
      await animateItems(items, ({ move }) => (rank.get(move.col) || 0) * columnStagger);
      visibleBonusCount += bonusCountForItems(items);
      applyBonusVisualCount(visibleBonusCount);
    }

    async function animateSlowColumn(col, groups) {
      const items = [...(groups.get(col) || [])]
        .sort((a, b) => {
          const rowA = Math.floor(a.index / CONFIG.cols);
          const rowB = Math.floor(b.index / CONFIG.cols);
          return rowB - rowA;
        });

      await animateItems(items, (_, rank) => rank * CONFIG.bonusAnticipationStepMs);
      const before = visibleBonusCount;
      visibleBonusCount += bonusCountForItems(items);
      applyBonusVisualCount(visibleBonusCount);
      return { before, after: visibleBonusCount, landedBonus: visibleBonusCount > before };
    }

    prepareMoves(survivorMoves);
    prepareMoves(spawnedMoves);

    if (survivorMoves.length) {
      await animateGravityPhase(survivorMoves);
      if (spawnedMoves.length) await sleep(350);
    }

    if (!spawnedMoves.length) {
      clearAnticipationColumns();
      await sleep(35);
      return;
    }

    const groups = spawnedByColumn(spawnedMoves);
    const activeColumns = [...groups.keys()].sort((a, b) => a - b);
    const anticipationEnabled = isCascade || forceAnticipation;

    if (!anticipationEnabled || visibleBonusCount >= CONFIG.maxBonusAnticipation) {
      await animateNormalColumns(activeColumns, groups);
      clearAnticipationColumns();
      await sleep(35);
      return;
    }

    let slowMode = visibleBonusCount >= 2 && visibleBonusCount < CONFIG.maxBonusAnticipation;
    let remainingColumns = [...activeColumns];

    if (!slowMode) {
      let cumulative = visibleBonusCount;
      let triggerIndex = -1;

      for (let index = 0; index < activeColumns.length; index++) {
        const col = activeColumns[index];
        cumulative += bonusCountForItems(groups.get(col) || []);
        if (cumulative >= 2) {
          triggerIndex = index;
          break;
        }
      }

      if (triggerIndex < 0) {
        await animateNormalColumns(activeColumns, groups);
        clearAnticipationColumns();
        await sleep(35);
        return;
      }

      const normalColumns = activeColumns.slice(0, triggerIndex + 1);
      remainingColumns = activeColumns.slice(triggerIndex + 1);
      await animateNormalColumns(normalColumns, groups);

      if (!remainingColumns.length || visibleBonusCount >= CONFIG.maxBonusAnticipation) {
        clearAnticipationColumns();
        await sleep(35);
        return;
      }

      clearAnticipationColumns();
      setMessage('BONUS ANTICIPATION', `${visibleBonusCount} ALARMS`);
      await sleep(CONFIG.bonusAnticipationPauseMs);
      setAnticipationColumns(remainingColumns);
      slowMode = true;
    }

    if (slowMode) {
      setAnticipationColumns(remainingColumns);

      while (remainingColumns.length) {
        const col = remainingColumns.shift();
        const result = await animateSlowColumn(col, groups);

        if (visibleBonusCount >= CONFIG.maxBonusAnticipation) {
          clearAnticipationColumns();
          if (remainingColumns.length) {
            await animateNormalColumns(remainingColumns, groups);
          }
          remainingColumns = [];
          break;
        }

        setAnticipationColumns(remainingColumns);

        if (result.landedBonus && result.after >= 3 && remainingColumns.length) {
          clearAnticipationColumns();
          setMessage('BONUS ANTICIPATION', `${result.after} ALARMS`);
          await sleep(CONFIG.bonusAnticipationPauseMs);
          setAnticipationColumns(remainingColumns);
        }
      }
    }

    clearAnticipationColumns();
    await sleep(35);
  }

  const DEBUG_BONUS_POSITIONS = Object.freeze([
    1 * CONFIG.cols + 0,
    1 * CONFIG.cols + 2,
    2 * CONFIG.cols + 3,
    3 * CONFIG.cols + 4,
    4 * CONFIG.cols + 5
  ]);

  const DEBUG_WIN_POSITIONS = Object.freeze([
    5 * CONFIG.cols + 0,
    5 * CONFIG.cols + 1,
    5 * CONFIG.cols + 2,
    5 * CONFIG.cols + 3,
    6 * CONFIG.cols + 0,
    6 * CONFIG.cols + 1,
    6 * CONFIG.cols + 2,
    6 * CONFIG.cols + 3
  ]);

  function createDebugFeatureBoard(bonusCount, withWin = false) {
    const keys = ['helmet', 'axe', 'hydrant', 'suit', 'radio', 'dalmatian', 'chief', 'extinguisher'];
    const board = Array.from({ length: CONFIG.cells }, (_, index) => {
      const row = Math.floor(index / CONFIG.cols);
      const col = index % CONFIG.cols;
      return keys[(row * 3 + col * 5) % keys.length];
    });

    if (withWin) {
      DEBUG_WIN_POSITIONS.forEach(index => {
        board[index] = 'axe';
      });
    }

    DEBUG_BONUS_POSITIONS.slice(0, bonusCount).forEach(index => {
      board[index] = BONUS_KEY;
    });

    return board;
  }

  function debugFullDropPlan(existingBonusCount = 0) {
    const existing = new Set(DEBUG_BONUS_POSITIONS.slice(0, existingBonusCount));
    const movements = new Map();

    for (let index = 0; index < CONFIG.cells; index++) {
      const stationaryBonus = existing.has(index);
      movements.set(index, {
        rows: stationaryBonus ? 0 : CONFIG.rows,
        col: index % CONFIG.cols,
        spawned: !stationaryBonus
      });
    }

    return movements;
  }

  function debugWinResult() {
    return {
      remove: [...DEBUG_WIN_POSITIONS],
      totalX: 0.15,
      wins: [{
        symbol: 'axe',
        label: 'Fire Axe',
        count: DEBUG_WIN_POSITIONS.length,
        amountX: 0.15,
        positions: [...DEBUG_WIN_POSITIONS]
      }]
    };
  }

  async function runDebugBonusDrop(count) {
    if (state.busy) return;

    state.busy = true;
    state.forceAlarmOff = false;
    updateUi();
    el.debugDialog?.close();

    state.board = createDebugFeatureBoard(count, false);
    setMessage(`DEBUG · ${count} BONUS DROP`, 'LANDING TEST');
    await renderBoardWithGravity(debugFullDropPlan(0), {
      isCascade: true,
      forceAnticipation: true
    });

    if (count >= 3) {
      state.bonusActive = true;
      renderBoard();
    }

    setMessage(`DEBUG · ${count} BONUS DROP COMPLETE`, count >= 3 ? 'BONUS ACTIVE' : 'LANDING TEST');
    state.busy = false;
    updateUi();
  }

  async function runDebugBonusChain(targetCount) {
    if (state.busy) return;

    state.busy = true;
    state.forceAlarmOff = false;
    updateUi();
    el.debugDialog?.close();

    for (let stage = 1; stage <= targetCount; stage++) {
      const hasAnotherCascade = stage < targetCount;
      state.board = createDebugFeatureBoard(stage, hasAnotherCascade);

      setMessage(
        `DEBUG CHAIN · ${stage} ALARM${stage === 1 ? '' : 'S'}`,
        stage === 1 ? 'INITIAL DROP' : `CASCADE ${stage - 1}`
      );

      await renderBoardWithGravity(debugFullDropPlan(stage - 1), {
        isCascade: stage > 1,
        forceAnticipation: stage > 1
      });

      if (hasAnotherCascade) {
        await sleep(300);
        await animateWin(debugWinResult(), stage);
        await sleep(180);
      }
    }

    if (targetCount >= 3) {
      state.bonusActive = true;
      renderBoard();
    }

    setMessage(
      `DEBUG CHAIN COMPLETE · ${targetCount} ALARM${targetCount === 1 ? '' : 'S'}`,
      targetCount >= 3 ? 'BONUS ACTIVE' : 'TEST COMPLETE'
    );
    state.busy = false;
    updateUi();
  }

  function setDebugAlarmCount(count) {
    if (state.busy) return;

    const cleanBoard = createInitialBoard().map(key => key === BONUS_KEY ? 'helmet' : key);
    const placements = [16, 24, 32];

    for (let index = 0; index < Math.min(count, placements.length); index++) {
      cleanBoard[placements[index]] = BONUS_KEY;
    }

    state.board = cleanBoard;
    state.forceAlarmOff = false;
    state.bonusActive = false;
    renderBoard();

    const label =
      count === 0 ? 'NO ALARMS' :
      count === 1 ? '1 ALARM · STATIC' :
      count === 2 ? '2 ALARMS · ANIMATED' :
      '3 ALARMS · ANIMATED';

    setMessage(`DEBUG · ${label}`, 'VISUAL TEST');
    el.debugDialog?.close();
  }

  function showBanner(text) {
    el.banner.textContent = text;
    el.banner.classList.remove('show');
    void el.banner.offsetWidth;
    el.banner.classList.add('show');
  }

  function setMessage(message, cascade = '') {
    el.message.textContent = message;
    el.cascade.textContent = cascade || '—';
  }

  async function animateWin(result, cascadeNumber) {
    const winning = new Set(result.remove);
    for (const index of winning) {
      el.board.querySelector(`[data-index="${index}"]`)?.classList.add('win');
    }
    setMessage(`CASCADE ${cascadeNumber} · ${result.totalX.toFixed(2)}×`, `${result.wins.length} CLUSTER${result.wins.length === 1 ? '' : 'S'}`);
    showBanner(`+${result.totalX.toFixed(2)}×`);
    await sleep(560);
    for (const index of winning) {
      el.board.querySelector(`[data-index="${index}"]`)?.classList.add('pop');
    }
    await sleep(230);
  }

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  async function playSpin() {
    if (state.busy) return;
    const bet = CONFIG.bets[state.betIndex];
    if (state.balance < bet) {
      setMessage('INSUFFICIENT BALANCE');
      return;
    }

    state.busy = true;
    state.balance -= bet;
    state.stats.spins++;
    state.stats.wagered += bet;
    state.lastWinX = 0;
    updateUi();
    setMessage('RESPONDING…', 'NEW BOARD');

    state.forceAlarmOff = false;
    state.bonusActive = false;
    state.board = createInitialBoard();
    await renderBoardWithGravity(initialGravityPlan());

    let totalX = 0;
    let cascadeNumber = 0;

    while (cascadeNumber < CONFIG.maxCascades) {
      const result = evaluateBoard(state.board);
      if (!result.wins.length) break;

      cascadeNumber++;
      totalX += result.totalX;
      await animateWin(result, cascadeNumber);

      const cascaded = cascadeBoard(state.board, result.remove);
      state.board = cascaded.board;
      await renderBoardWithGravity(cascaded.movements, { isCascade: true });
    }

    // Once the board is fully resolved, any non-bonus alarm result settles
    // back to the static OFF artwork. Three or more alarms remain animated
    // because that is the bonus state.
    const endingBonusCount = state.board.filter(key => key === BONUS_KEY).length;
    if (endingBonusCount > 0 && endingBonusCount < 3) {
      state.forceAlarmOff = true;
      state.bonusActive = false;
      renderBoard();
    } else if (endingBonusCount >= 3) {
      state.forceAlarmOff = false;
      state.bonusActive = true;
      renderBoard();
    }

    const creditsWon = totalX * bet;
    state.balance += creditsWon;
    state.stats.won += creditsWon;
    state.lastWinX = totalX;
    setMessage(totalX > 0 ? `TOTAL WIN ${totalX.toFixed(2)}×` : 'NO WIN', cascadeNumber ? `${cascadeNumber} CASCADE${cascadeNumber === 1 ? '' : 'S'}` : 'READY');
    state.busy = false;
    updateUi();
  }

  function updateUi() {
    const bet = CONFIG.bets[state.betIndex];
    el.balance.textContent = state.balance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    el.bet.textContent = bet.toFixed(2);
    el.spinBet.textContent = `$${bet.toFixed(2)}`;
    el.lastWin.textContent = `${state.lastWinX.toFixed(2)}×`;
    el.statSpins.textContent = state.stats.spins;
    el.statWagered.textContent = state.stats.wagered.toFixed(2);
    el.statWon.textContent = state.stats.won.toFixed(2);
    el.statRtp.textContent = state.stats.wagered > 0 ? `${(100 * state.stats.won / state.stats.wagered).toFixed(1)}%` : '—';
    el.spin.disabled = state.busy;
    el.betDown.disabled = state.busy || state.betIndex === 0;
    el.betUp.disabled = state.busy || state.betIndex === CONFIG.bets.length - 1;
  }

  function renderPaytable() {
    el.paytableBody.innerHTML = REGULAR.map(symbol => `
      <tr>
        <td><span class="pay-symbol">${spriteMarkup(symbol.key, symbol.label)}<strong>${symbol.label}</strong></span></td>
        ${symbol.pays.map(pay => `<td>${pay.toFixed(2)}×</td>`).join('')}
      </tr>
    `).join('') + `
      <tr>
        <td><span class="pay-symbol">${spriteMarkup('wild', 'Wild')}<strong>Wild</strong></span></td>
        <td colspan="6">Substitutes for all paying symbols</td>
      </tr>`;
  }

  function mathSpin() {
    let board = createInitialBoard();
    let totalX = 0;
    let cascades = 0;

    while (cascades < CONFIG.maxCascades) {
      const result = evaluateBoard(board);
      if (!result.wins.length) break;
      totalX += result.totalX;
      cascades++;
      board = cascadeBoard(board, result.remove).board;
    }

    return { totalX, cascades };
  }

  async function runSimulation() {
    if (state.busy) return;
    const spins = 20000;
    el.simulateBtn.disabled = true;
    el.simulationOutput.textContent = `Running ${spins.toLocaleString()} spins…`;
    await sleep(20);

    let total = 0;
    let hits = 0;
    let cascades = 0;
    let max = 0;

    for (let index = 0; index < spins; index++) {
      const result = mathSpin();
      total += result.totalX;
      cascades += result.cascades;
      if (result.totalX > 0) hits++;
      if (result.totalX > max) max = result.totalX;
      if (index > 0 && index % 2000 === 0) await sleep(0);
    }

    const observed = 100 * total / spins;
    el.simulationOutput.innerHTML = `Observed RTP <strong>${observed.toFixed(2)}%</strong> · Hit rate <strong>${(100 * hits / spins).toFixed(1)}%</strong> · Avg cascades <strong>${(cascades / spins).toFixed(2)}</strong> · Max sample win <strong>${max.toFixed(2)}×</strong>`;
    el.simulateBtn.disabled = false;
  }

  el.spin.addEventListener('click', playSpin);
  el.betDown.addEventListener('click', () => { if (!state.busy && state.betIndex > 0) { state.betIndex--; updateUi(); } });
  el.betUp.addEventListener('click', () => { if (!state.busy && state.betIndex < CONFIG.bets.length - 1) { state.betIndex++; updateUi(); } });
  el.paytableBtn.addEventListener('click', () => el.paytableDialog.showModal());
  el.paytableClose.addEventListener('click', () => el.paytableDialog.close());
  el.mathBtn.addEventListener('click', () => el.mathDialog.showModal());
  el.mathClose.addEventListener('click', () => el.mathDialog.close());
  el.simulateBtn.addEventListener('click', runSimulation);
  el.debugBtn.addEventListener('click', () => {
    updateAlarmDebugStatus(state.board.filter(key => key === BONUS_KEY).length);
    el.debugDialog.showModal();
  });
  el.debugClose.addEventListener('click', () => el.debugDialog.close());
  document.querySelectorAll('[data-alarm-count]').forEach(button => {
    button.addEventListener('click', () => setDebugAlarmCount(Number(button.dataset.alarmCount)));
  });

  document.querySelectorAll('[data-bonus-drop-test]').forEach(button => {
    button.addEventListener('click', () => runDebugBonusDrop(Number(button.dataset.bonusDropTest)));
  });

  document.querySelectorAll('[data-bonus-chain-test]').forEach(button => {
    button.addEventListener('click', () => runDebugBonusChain(Number(button.dataset.bonusChainTest)));
  });

  renderPaytable();
  state.board = createInitialBoard();
  renderBoard();
  updateUi();
})();
