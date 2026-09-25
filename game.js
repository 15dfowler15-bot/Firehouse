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

  function spriteMarkup(key, label = '', bonusCount = 0, forceOff = false) {
    if (key === BONUS_KEY) {
      const stateClass = forceOff
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
      state.forceAlarmOff ? 'RESOLVED / OFF STATE' :
      bonusCount === 1 ? 'STATIC / OFF STATE' :
      bonusCount === 2 ? '2-HIT ANIMATION' :
      '3+ ALARM ANIMATION';
  }

  function renderBoard() {
    const bonusCount = state.board.reduce((count, key) => count + (key === BONUS_KEY ? 1 : 0), 0);
    updateAlarmDebugStatus(bonusCount);

    el.board.innerHTML = state.board.map((key, index) => {
      const symbol = SYMBOLS.find(item => item.key === key);
      const classes = ['cell'];
      if (symbol?.wild) classes.push('wild');
      if (symbol?.bonus) classes.push('bonus');

      return `<div class="${classes.join(' ')}" data-index="${index}" role="gridcell" aria-label="${symbol?.label || key}">${spriteMarkup(key, symbol?.label || key, bonusCount, state.forceAlarmOff)}</div>`;
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

  async function renderBoardWithGravity(movements) {
    renderBoard();

    if (!movements?.size) return;

    const prefersReducedMotion = globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
    if (prefersReducedMotion || !Element.prototype.animate) return;

    const survivorMoves = [];
    const spawnedMoves = [];

    // Hide every tile that will move before the browser can paint the board
    // at its final positions. Survivors and new symbols are revealed in
    // separate gravity phases below.
    for (const [index, move] of movements.entries()) {
      if (move.rows <= 0) continue;

      const cell = el.board.querySelector(`[data-index="${index}"]`);
      if (!cell) continue;

      cell.style.visibility = 'hidden';

      const item = { cell, move };
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

    async function animateGravityPhase(items) {
      if (!items.length) return;

      const activeColumns = [...new Set(items.map(({ move }) => move.col))]
        .sort((a, b) => a - b);
      const columnRank = new Map(activeColumns.map((col, rank) => [col, rank]));

      // Reveal this phase only after its start positions are committed.
      void el.board.offsetHeight;
      for (const { cell } of items) {
        cell.style.visibility = 'visible';
      }

      await new Promise(resolve => requestAnimationFrame(resolve));

      const animations = items.map(({ cell, move }) => {
        const startY = -move.rows * pitch;
        const delay = (columnRank.get(move.col) || 0) * columnStagger;

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

      await Promise.all(animations);
    }

    // Position BOTH groups before any reveal so newly generated tiles can
    // never flash in their destination cells.
    prepareMoves(survivorMoves);
    prepareMoves(spawnedMoves);

    // Cascade rhythm:
    // 1) existing symbols collapse into the holes
    // 2) hold for half a second
    // 3) replacement symbols enter from above
    if (survivorMoves.length) {
      await animateGravityPhase(survivorMoves);

      if (spawnedMoves.length) {
        await sleep(350);
      }
    }

    await animateGravityPhase(spawnedMoves);
    await sleep(35);
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
      await renderBoardWithGravity(cascaded.movements);
    }

    // Once the board is fully resolved, any non-bonus alarm result settles
    // back to the static OFF artwork. Three or more alarms remain animated
    // because that is the bonus state.
    const endingBonusCount = state.board.filter(key => key === BONUS_KEY).length;
    if (endingBonusCount > 0 && endingBonusCount < 3) {
      state.forceAlarmOff = true;
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

  renderPaytable();
  state.board = createInitialBoard();
  renderBoard();
  updateUi();
})();
