(() => {
  'use strict';

  const CONFIG = Object.freeze({
    version: '0.3.0',
    rows: 7,
    cols: 7,
    cells: 49,
    minCluster: 8,
    targetRtp: 0.96,
    clumpChance: 0.5478,
    maxCascades: 60,
    bonusAnticipationPauseMs: 650,
    bonusAnticipationStepMs: 125,
    maxBonusAnticipation: 5,
    debugEnabled: true,
    eventHistoryLimit: 180,
    particleLimit: 96,

    // Rare base-game fire teaser. Selection happens BEFORE board generation.
    baseFireFeatureChance: 0.028,
    baseFireHoseShare: 0.20,

    // Prototype fire tuning. Mechanics are authoritative; these rates are easy to rebalance later.
    fireThreeIgnitionChance: 0.35,
    fireSpreadChance: 0.42,
    fireFiveSprayChance: 0.45,

    // 5-Alarm Fire Wild / volatility controls.
    // Carryover multiplier is the uncapped SUM of all surviving fire multipliers.
    fireFiveFreshIgnitionCount: 1,

    // Current orthogonal spread has at most 4 neighbors; kept explicit for tuning.
    fireSpreadMaxTargets: 4,

    // Presentation pacing. Kept configurable so animation feel can be tuned without
    // touching the game-state / payout engine.
    gravityFallDurationMs: 480,
    gravityColumnStaggerMs: 82,
    gravityCascadePauseMs: 285,
    gravitySettleBeatMs: 65,
    winHoldMs: 680,
    winPopMs: 285,
    bonusTriggerHoldMs: 850,
    freeSpinEndHoldMs: 560,
    fireEventPauseMs: 340,
    sprayLinePauseMs: 250,
    sprayDripPauseMs: 430,
    fireCompressionDropMs: 520,
    fireCompressionMergeMs: 720,
    fireCompressionResultMs: 620,
    fireWildBankDropMs: 540,
    fireWildBankBounceMs: 260,
    fireWildBankHoldMs: 320,
    fireWildEntryMs: 520,
    backdraftAnticipationMs: 520,
    backdraftBurstMs: 520,
    multiplierTransitionMs: 420,

    // Win celebration thresholds are multiples of total bet.
    bigWinThresholds: Object.freeze({
      big: 12,
      super: 30,
      mega: 75,
      inferno: 150
    }),

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

  const FIRE_STATE = Object.freeze({
    NORMAL: 'normal',
    BURNING: 'burning',
    SMOULDERING: 'smouldering'
  });

  const BONUS_TIERS = Object.freeze({
    3: Object.freeze({ alarms: 3, freeSpins: 5, label: '3-ALARM' }),
    4: Object.freeze({ alarms: 4, freeSpins: 7, label: '4-ALARM' }),
    5: Object.freeze({ alarms: 5, freeSpins: 10, label: '5-ALARM' })
  });

  function createSymbolFireState() {
    return Array.from({ length: CONFIG.cells }, () => ({
      state: FIRE_STATE.NORMAL,
      multiplier: 0
    }));
  }

  const RNG_PROFILES = Object.freeze({
    normal: Object.freeze({
      clumpChance: CONFIG.clumpChance,
      fireThreeIgnitionChance: CONFIG.fireThreeIgnitionChance,
      fireSpreadChance: CONFIG.fireSpreadChance,
      fireFiveSprayChance: CONFIG.fireFiveSprayChance,
      sprayRowSelection: 'uniform'
    }),
    large: Object.freeze({
      clumpChance: 0.72,
      fireThreeIgnitionChance: 0.70,
      fireSpreadChance: 0.80,
      fireFiveSprayChance: 0.78,
      sprayRowSelection: 'middle-weighted'
    })
  });

  // Developer math profiles alter actual probability/payout inputs.
  // Target RTP values are NOMINAL development targets, not certified RTP claims.
  const MATH_PROFILES = Object.freeze({
    baseline: Object.freeze({
      label: 'BASELINE',
      nominalTargetRtp: 0.96,
      payoutScale: 1,
      clumpScale: 1,
      bonusWeightScale: 1,
      fireScale: 1,
      sprayScale: 1,
      volatility: 'standard'
    }),
    lowStress: Object.freeze({
      label: 'LOW RTP STRESS',
      nominalTargetRtp: 0.92,
      payoutScale: 0.9583333333,
      clumpScale: 0.94,
      bonusWeightScale: 0.85,
      fireScale: 0.90,
      sprayScale: 0.92,
      volatility: 'low-hit stress'
    }),
    highStress: Object.freeze({
      label: 'HIGH RTP STRESS',
      nominalTargetRtp: 0.98,
      payoutScale: 1.0208333333,
      clumpScale: 1.03,
      bonusWeightScale: 1.08,
      fireScale: 1.05,
      sprayScale: 1.05,
      volatility: 'high-hit stress'
    }),
    highVolatility: Object.freeze({
      label: 'HIGH VOLATILITY',
      nominalTargetRtp: 0.96,
      payoutScale: 1,
      clumpScale: 1.08,
      bonusWeightScale: 0.92,
      fireScale: 1.20,
      sprayScale: 1.14,
      volatility: 'high'
    })
  });

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
    debugGameMode: $('debugGameMode'),
    boardFx: $('boardFx'),
    transitionOverlay: $('transitionOverlay'),
    transitionTitle: $('transitionTitle'),
    transitionDetail: $('transitionDetail'),
    bigWinOverlay: $('bigWinOverlay'),
    bigWinTier: $('bigWinTier'),
    bigWinAmount: $('bigWinAmount'),
    debugStateInspector: $('debugStateInspector'),
    debugEventLog: $('debugEventLog'),
    debugMathProfile: $('debugMathProfile'),
    debugMathConfig: $('debugMathConfig'),
    debugSeed: $('debugSeed'),
    debugSprayRow: $('debugSprayRow'),
    debugSymbolWeights: $('debugSymbolWeights'),
    debugBuyPrice3: $('debugBuyPrice3'),
    debugBuyPrice4: $('debugBuyPrice4'),
    debugBuyPrice5: $('debugBuyPrice5'),
    debugSelfTestOutput: $('debugSelfTestOutput'),
    debugConsoleLogging: $('debugConsoleLogging'),
    debugGuaranteedFire: $('debugGuaranteedFire'),
    debugGuaranteedSpray: $('debugGuaranteedSpray'),
    debugHighFireFrequency: $('debugHighFireFrequency'),
    debugMaxVisualIntensity: $('debugMaxVisualIntensity')
  };

  const state = {
    board: [],
    balance: 1000,
    betIndex: 2,
    busy: false,
    lastWinX: 0,
    forceAlarmOff: false,
    bonusActive: false,

    // Fire Bonus state. Fire belongs to the symbol at the same array index.
    // cascadeBoard moves this metadata with the symbol and deletes it when the symbol wins.
    activeBonusType: 0,
    freeSpinsRemaining: 0,
    freeSpinsTotal: 0,
    symbolFire: createSymbolFireState(),
    fireEvents: {
      newIgnition: [],
      spread: [],
      sprayRow: null,
      sprayAffectedRows: [],
      extinguished: [],
      backdraftEligible: false,
      backdraftTriggered: false,
      reignited: []
    },
    fireHistory: [],
    fireWildCarryover: null,
    compressionResultIndex: null,
    sprayVisual: null,
    backdraftFlash: false,

    // Playable one-shot test modes. All resolve through the same game engine.
    pendingGameMode: 'normal',
    largeOutcomeActive: false,
    baseFireFeature: null,

    // Presentation / QA state.
    animationSpeed: 1,
    spinId: 0,
    currentCascade: 0,
    currentSpinBaseX: 0,
    currentSpinBonusX: 0,
    eventHistory: [],
    debugLogEnabled: false,
    debugSeed: '',
    seedState: 0,
    mathProfile: 'baseline',
    mathOverrides: {
      clumpChance: null,
      fireIgnitionChance: null,
      fireSpreadChance: null,
      sprayChance: null,
      bonusWeight: null,
      freshIgnitionCount: null,
      trigger3Chance: null,
      trigger4Chance: null,
      trigger5Chance: null
    },
    symbolWeightOverrides: {},
    debugEnhancements: {
      guaranteedFire: false,
      guaranteedSpray: false,
      highFireFrequency: false,
      maxVisualIntensity: false
    },
    lastError: '',
    bigWinSkip: false,

    stats: { spins: 0, wagered: 0, won: 0 }
  };

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  function hashSeed(input) {
    let hash = 2166136261;
    const text = String(input);
    for (let index = 0; index < text.length; index++) {
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  function setDebugSeed(seed) {
    const normalized = String(seed ?? '').trim();
    state.debugSeed = normalized;
    state.seedState = normalized ? hashSeed(normalized) : 0;
    recordEvent('debug-seed', { seed: normalized || null });
  }

  function seededRandomFloat() {
    let t = state.seedState += 0x6D2B79F5;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  function randomFloat() {
    if (state.debugSeed) return seededRandomFloat();

    if (globalThis.crypto?.getRandomValues) {
      const value = new Uint32Array(1);
      globalThis.crypto.getRandomValues(value);
      return value[0] / 4294967296;
    }
    return Math.random();
  }

  function activeMathPreset() {
    return MATH_PROFILES[state.mathProfile] || MATH_PROFILES.baseline;
  }

  function currentRngProfileName() {
    return state.largeOutcomeActive ? 'large' : 'normal';
  }

  function currentRngProfile(profileName = currentRngProfileName()) {
    const base = RNG_PROFILES[profileName] || RNG_PROFILES.normal;
    const preset = activeMathPreset();
    const overrides = state.mathOverrides;

    const fireScale =
      preset.fireScale *
      (state.debugEnhancements.highFireFrequency ? 1.35 : 1);

    return {
      ...base,
      clumpChance: clamp(
        overrides.clumpChance ?? (base.clumpChance * preset.clumpScale),
        0,
        0.98
      ),
      fireThreeIgnitionChance: clamp(
        overrides.fireIgnitionChance ?? (base.fireThreeIgnitionChance * fireScale),
        0,
        1
      ),
      fireSpreadChance: clamp(
        overrides.fireSpreadChance ?? (base.fireSpreadChance * fireScale),
        0,
        1
      ),
      fireFiveSprayChance: clamp(
        overrides.sprayChance ?? (base.fireFiveSprayChance * preset.sprayScale),
        0,
        1
      )
    };
  }

  function effectiveSymbolWeight(symbol, profileName = currentRngProfileName()) {
    const override = state.symbolWeightOverrides[symbol.key];
    let weight = Number.isFinite(override) ? Math.max(0, override) : symbol.weight;

    if (profileName === 'large') {
      const multipliers = {
        chief: 2.4,
        dalmatian: 1.9,
        radio: 1.5,
        wild: 2.3,
        suit: 1.25
      };
      weight *= multipliers[symbol.key] || 1;
    }

    if (symbol.key === BONUS_KEY) {
      const overrideBonus = state.mathOverrides.bonusWeight;
      if (Number.isFinite(overrideBonus)) return Math.max(0, overrideBonus);
      weight *= activeMathPreset().bonusWeightScale;
    }

    return weight;
  }

  function profiledSymbolWeight(symbol, profileName = currentRngProfileName()) {
    return effectiveSymbolWeight(symbol, profileName);
  }

  function recordEvent(type, data = {}) {
    const event = {
      sequence: state.eventHistory.length
        ? state.eventHistory[state.eventHistory.length - 1].sequence + 1
        : 1,
      time: Date.now(),
      spinId: state.spinId,
      type,
      ...data
    };

    state.eventHistory.push(event);
    if (state.eventHistory.length > CONFIG.eventHistoryLimit) {
      state.eventHistory.splice(0, state.eventHistory.length - CONFIG.eventHistoryLimit);
    }

    if (state.debugLogEnabled) {
      console.debug('[Firehouse]', event);
    }

    try {
      globalThis.dispatchEvent?.(
        new CustomEvent('firehouse:event', { detail: event })
      );
    } catch {}

    updateDebugInspector();
    return event;
  }

  function emitAudioHook(name, detail = {}) {
    try {
      globalThis.dispatchEvent?.(
        new CustomEvent('firehouse:audio', {
          detail: { name, spinId: state.spinId, ...detail }
        })
      );
    } catch {}
  }

  async function runPresentationEvent(name, detail = {}, animator = null) {
    recordEvent(name, detail);
    emitAudioHook(name, detail);
    if (typeof animator === 'function') await animator();
  }

  function animationScale() {
    return 1 / Math.max(0.1, state.animationSpeed || 1);
  }

  function scaledMs(ms) {
    if (!Number.isFinite(ms) || ms <= 0) return Math.max(0, ms || 0);
    return Math.max(1, Math.round(ms * animationScale()));
  }

  function weightedSymbolKey({ allowBonus = true, profileName = currentRngProfileName() } = {}) {
    const pool = SYMBOLS.filter(symbol => allowBonus || symbol.key !== BONUS_KEY);
    const total = pool.reduce((sum, symbol) => sum + profiledSymbolWeight(symbol, profileName), 0);
    let roll = randomFloat() * total;

    for (const symbol of pool) {
      roll -= profiledSymbolWeight(symbol, profileName);
      if (roll <= 0) return symbol.key;
    }

    return pool[pool.length - 1].key;
  }

  function maybeCloneNeighbor(neighbors, { allowBonus = true, profileName = currentRngProfileName() } = {}) {
    const profile = currentRngProfile(profileName);
    if (!neighbors.length || randomFloat() >= profile.clumpChance) {
      return weightedSymbolKey({ allowBonus, profileName });
    }

    const selected = neighbors[Math.floor(randomFloat() * neighbors.length)];
    return NON_CLUMP_KEYS.has(selected)
      ? weightedSymbolKey({ allowBonus, profileName })
      : selected;
  }

  function randomUniqueIndices(count) {
    const indices = Array.from({ length: CONFIG.cells }, (_, index) => index);
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(randomFloat() * (i + 1));
      [indices[i], indices[j]] = [indices[j], indices[i]];
    }
    return indices.slice(0, Math.min(count, CONFIG.cells));
  }

  function createInitialBoard({ forcedBonusCount = 0, allowBonus = true, profileName = currentRngProfileName() } = {}) {
    const forceTrigger = forcedBonusCount > 0;
    const board = Array(CONFIG.cells).fill(null);

    for (let index = 0; index < CONFIG.cells; index++) {
      const row = Math.floor(index / CONFIG.cols);
      const col = index % CONFIG.cols;
      const neighbors = [];
      if (col > 0) neighbors.push(board[index - 1]);
      if (row > 0) neighbors.push(board[index - CONFIG.cols]);

      board[index] = maybeCloneNeighbor(neighbors, {
        allowBonus: forceTrigger ? false : allowBonus,
        profileName
      });
    }

    if (forceTrigger) {
      for (const index of randomUniqueIndices(forcedBonusCount)) {
        board[index] = BONUS_KEY;
      }
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

  function evaluateBoard(board, symbolFire = null) {
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

        const baseAmountX = symbol.pays[band] * activeMathPreset().payoutScale;
        const fireMultiplierTotal = symbolFire
          ? positions.reduce((sum, index) => {
              const fire = symbolFire[index];
              return sum + (fire && fire.state !== FIRE_STATE.NORMAL ? fire.multiplier : 0);
            }, 0)
          : 0;

        // Fire-cell multipliers are additive. A cluster with 2x + 4x + 8x uses 14x.
        // A cluster touching no fire cells still pays its normal 1x base award.
        const fireMultiplier = fireMultiplierTotal > 0 ? fireMultiplierTotal : 1;
        const amountX = baseAmountX * fireMultiplier;

        wins.push({
          symbol: symbol.key,
          label: symbol.label,
          count: positions.length,
          baseAmountX,
          fireMultiplier,
          amountX,
          positions
        });
        positions.forEach(index => remove.add(index));
      }
    }

    return {
      wins,
      remove: [...remove],
      totalX: wins.reduce((sum, win) => sum + win.amountX, 0)
    };
  }

  function cascadeBoard(board, removePositions, symbolFire = null, options = {}) {
    const { allowBonus = true, profileName = currentRngProfileName() } = options;
    const remove = new Set(removePositions);
    const next = Array(CONFIG.cells).fill(null);
    const nextSymbolFire = symbolFire ? createSymbolFireState() : null;
    const spawned = [];
    const movements = new Map();

    for (let col = 0; col < CONFIG.cols; col++) {
      let targetRow = CONFIG.rows - 1;

      for (let row = CONFIG.rows - 1; row >= 0; row--) {
        const sourceIndex = row * CONFIG.cols + col;
        if (remove.has(sourceIndex)) continue;

        const destinationIndex = targetRow * CONFIG.cols + col;
        next[destinationIndex] = board[sourceIndex];

        // Fire state is attached to the surviving symbol and travels with it.
        if (nextSymbolFire) {
          const fire = symbolFire[sourceIndex];
          nextSymbolFire[destinationIndex] = fire
            ? { state: fire.state, multiplier: fire.multiplier }
            : { state: FIRE_STATE.NORMAL, multiplier: 0 };
        }

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

        next[index] = maybeCloneNeighbor(neighbors, { allowBonus, profileName });

        // A newly spawned symbol has no inherited fire state.
        if (nextSymbolFire) {
          nextSymbolFire[index] = { state: FIRE_STATE.NORMAL, multiplier: 0 };
        }

        spawned.push(index);
        movements.set(index, {
          rows: spawnCount,
          col,
          spawned: true
        });
        targetRow--;
      }
    }

    return { board: next, symbolFire: nextSymbolFire, spawned, movements };
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

  function visualRandomFloat() {
    return Math.random();
  }

  function clearBoardFx() {
    if (el.boardFx) el.boardFx.replaceChildren();
  }

  function spawnBoardParticles(type, indices = [], countPerCell = 2) {
    if (!el.boardFx || !el.board || !indices.length) return;

    const boardRect = el.board.getBoundingClientRect();
    const existing = el.boardFx.childElementCount;
    const budget = Math.max(0, CONFIG.particleLimit - existing);
    if (!budget) return;

    let created = 0;
    for (const index of indices) {
      const cell = el.board.querySelector(`[data-index="${index}"]`);
      if (!cell) continue;
      const rect = cell.getBoundingClientRect();

      for (let n = 0; n < countPerCell && created < budget; n++) {
        const particle = document.createElement('i');
        particle.className = `fx-particle fx-${type}`;
        const x = rect.left - boardRect.left + rect.width * (0.25 + visualRandomFloat() * 0.5);
        const y = rect.top - boardRect.top + rect.height * (0.3 + visualRandomFloat() * 0.45);
        particle.style.left = `${x}px`;
        particle.style.top = `${y}px`;
        particle.style.setProperty('--fx-dx', `${Math.round((visualRandomFloat() - 0.5) * 38)}px`);
        particle.style.setProperty('--fx-dy', `${Math.round(-18 - visualRandomFloat() * 42)}px`);
        particle.style.setProperty('--fx-delay', `${Math.round(visualRandomFloat() * 90)}ms`);
        particle.style.setProperty('--fx-scale', (0.65 + visualRandomFloat() * 0.85).toFixed(2));
        el.boardFx.appendChild(particle);
        created++;

        const cleanup = () => particle.remove();
        particle.addEventListener('animationend', cleanup, { once: true });
        setTimeout(cleanup, scaledMs(1600));
      }
    }
  }

  async function animateMultiplierTransitions(transitions = [], kind = 'fire') {
    if (!transitions.length) return;

    const animations = transitions.map((transition, rank) => {
      const cell = el.board.querySelector(`[data-index="${transition.index}"]`);
      const badge = cell?.querySelector('.fire-state-placeholder');
      if (!cell) return Promise.resolve();

      cell.classList.add('multiplier-changing', `multiplier-${kind}`);
      if (badge) {
        badge.dataset.before = `${transition.before}×`;
        badge.dataset.after = `${transition.after}×`;
      }

      if (!Element.prototype.animate) return Promise.resolve();

      return cell.animate([
        { transform: 'scale(1)', filter: 'brightness(1)' },
        { transform: 'scale(1.09)', filter: 'brightness(1.55)' },
        { transform: 'scale(1)', filter: 'brightness(1)' }
      ], {
        duration: scaledMs(CONFIG.multiplierTransitionMs),
        delay: scaledMs(rank * 38),
        easing: 'cubic-bezier(.18,.82,.24,1)',
        fill: 'both'
      }).finished.catch(() => {}).then(() => {
        cell.classList.remove('multiplier-changing', `multiplier-${kind}`);
      });
    });

    await Promise.all(animations);
  }

  function renderBoard(visualBonusCount = null) {
    const actualBonusCount = state.board.reduce((count, key) => count + (key === BONUS_KEY ? 1 : 0), 0);
    const bonusCount = visualBonusCount ?? actualBonusCount;
    updateAlarmDebugStatus(bonusCount);
    el.board.classList.toggle('backdraft-flash', state.backdraftFlash);

    el.board.innerHTML = state.board.map((key, index) => {
      const symbol = SYMBOLS.find(item => item.key === key);
      const classes = ['cell'];
      if (symbol?.wild) classes.push('wild');
      if (symbol?.bonus) classes.push('bonus');

      const fire = state.symbolFire[index];
      if (fire?.state === FIRE_STATE.BURNING) classes.push('fire-burning');
      if (fire?.state === FIRE_STATE.SMOULDERING) classes.push('fire-smouldering');
      if (state.compressionResultIndex === index) classes.push('fire-compression-result');

      const row = Math.floor(index / CONFIG.cols);
      if (state.sprayVisual && row === state.sprayVisual.row) classes.push('spray-line-row');
      if (state.sprayVisual?.phase === 'drip' && row > state.sprayVisual.row) classes.push('spray-drip-cell');

      const fireLabel = key === WILD_KEY
        ? (fire?.state === FIRE_STATE.BURNING ? 'FIRE WILD' : 'SMOULDER WILD')
        : (fire?.state === FIRE_STATE.BURNING ? 'FIRE' : 'SMOULDER');

      const fireMarkup = fire && fire.state !== FIRE_STATE.NORMAL
        ? `<span class="fire-state-placeholder ${fire.state}" aria-hidden="true"><strong>${fireLabel}</strong><em>${fire.multiplier}×</em></span>`
        : '';

      const compressionMarkup = state.compressionResultIndex === index && fire
        ? `<span class="fire-compression-total" aria-hidden="true">${fire.multiplier}×</span>`
        : '';

      const symbolMarkup = key == null
        ? ''
        : spriteMarkup(key, symbol?.label || key, bonusCount, state.forceAlarmOff, state.bonusActive);

      return `<div class="${classes.join(' ')}" data-index="${index}" role="gridcell" aria-label="${symbol?.label || key || 'Empty'}">${symbolMarkup}${fireMarkup}${compressionMarkup}</div>`;
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
    recordEvent('symbol-drop', {
      movementCount: movements.size,
      isCascade,
      forceAnticipation
    });
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

    const columnStagger = scaledMs(CONFIG.gravityColumnStaggerMs);
    const fallDuration = scaledMs(CONFIG.gravityFallDurationMs);

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

      await animateItems(items, (_, rank) => scaledMs(rank * CONFIG.bonusAnticipationStepMs));
      const before = visibleBonusCount;
      visibleBonusCount += bonusCountForItems(items);
      applyBonusVisualCount(visibleBonusCount);
      return { before, after: visibleBonusCount, landedBonus: visibleBonusCount > before };
    }

    prepareMoves(survivorMoves);
    prepareMoves(spawnedMoves);

    if (survivorMoves.length) {
      await animateGravityPhase(survivorMoves);
      if (spawnedMoves.length) await sleep(CONFIG.gravityCascadePauseMs);
    }

    if (!spawnedMoves.length) {
      clearAnticipationColumns();
      await sleep(CONFIG.gravitySettleBeatMs);
      return;
    }

    const groups = spawnedByColumn(spawnedMoves);
    const activeColumns = [...groups.keys()].sort((a, b) => a - b);
    const anticipationEnabled = isCascade || forceAnticipation;

    if (!anticipationEnabled || visibleBonusCount >= CONFIG.maxBonusAnticipation) {
      await animateNormalColumns(activeColumns, groups);
      clearAnticipationColumns();
      await sleep(CONFIG.gravitySettleBeatMs);
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
        await sleep(CONFIG.gravitySettleBeatMs);
        return;
      }

      const normalColumns = activeColumns.slice(0, triggerIndex + 1);
      remainingColumns = activeColumns.slice(triggerIndex + 1);
      await animateNormalColumns(normalColumns, groups);

      if (!remainingColumns.length || visibleBonusCount >= CONFIG.maxBonusAnticipation) {
        clearAnticipationColumns();
        await sleep(CONFIG.gravitySettleBeatMs);
        return;
      }

      clearAnticipationColumns();
      setMessage('BONUS ANTICIPATION', `${visibleBonusCount} ALARMS`);
      recordEvent('near-bonus', {
        visibleBonusCount,
        remainingColumns: [...remainingColumns]
      });
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
          recordEvent('near-bonus-escalation', {
            visibleBonusCount: result.after,
            remainingColumns: [...remainingColumns]
          });
          await sleep(CONFIG.bonusAnticipationPauseMs);
          setAnticipationColumns(remainingColumns);
        }
      }
    }

    clearAnticipationColumns();
    await sleep(CONFIG.gravitySettleBeatMs);
  }

  function resetFireEventState() {
    state.fireEvents = {
      newIgnition: [],
      spread: [],
      sprayRow: null,
      sprayAffectedRows: [],
      extinguished: [],
      backdraftEligible: false,
      backdraftTriggered: false,
      reignited: []
    };
  }

  function resetSymbolFire() {
    state.symbolFire = createSymbolFireState();
    state.sprayVisual = null;
    state.backdraftFlash = false;
    resetFireEventState();
  }

  function collectSurvivingFire() {
    return state.symbolFire
      .map((fire, sourceIndex) => ({
        sourceIndex,
        state: fire.state,
        multiplier: fire.multiplier,
        symbol: state.board[sourceIndex]
      }))
      .filter(entry =>
        entry.symbol != null &&
        entry.state !== FIRE_STATE.NORMAL &&
        entry.multiplier > 0
      );
  }

  function buildFireWildCarryover(survivors = collectSurvivingFire()) {
    if (!survivors.length) return null;

    // Definitive 5-Alarm carryover math: straight additive collection.
    // There is intentionally NO multiplier cap.
    const multiplier = survivors.reduce(
      (sum, entry) => sum + entry.multiplier,
      0
    );

    const fireState = survivors.some(entry => entry.state === FIRE_STATE.BURNING)
      ? FIRE_STATE.BURNING
      : FIRE_STATE.SMOULDERING;

    return {
      state: fireState,
      multiplier,
      collectedCount: survivors.length
    };
  }

  function compressionTargetIndex(survivors) {
    if (!survivors.length) return null;

    const centerRow = (CONFIG.rows - 1) / 2;
    const centerCol = (CONFIG.cols - 1) / 2;

    return [...survivors]
      .sort((a, b) => {
        const rowA = Math.floor(a.sourceIndex / CONFIG.cols);
        const colA = a.sourceIndex % CONFIG.cols;
        const rowB = Math.floor(b.sourceIndex / CONFIG.cols);
        const colB = b.sourceIndex % CONFIG.cols;

        const distanceA =
          Math.abs(rowA - centerRow) +
          Math.abs(colA - centerCol);
        const distanceB =
          Math.abs(rowB - centerRow) +
          Math.abs(colB - centerCol);

        return distanceA - distanceB || a.sourceIndex - b.sourceIndex;
      })[0].sourceIndex;
  }

  function bottomIndexInSameColumn(index) {
    const col = index % CONFIG.cols;
    return (CONFIG.rows - 1) * CONFIG.cols + col;
  }

  async function animateBankedFireWildDrop(fromIndex, reducedMotion = false) {
    if (fromIndex == null) return fromIndex;

    const toIndex = bottomIndexInSameColumn(fromIndex);
    if (toIndex === fromIndex || reducedMotion || !Element.prototype.animate) {
      return toIndex;
    }

    const fromCell = el.board.querySelector(`[data-index="${fromIndex}"]`);
    const toCell = el.board.querySelector(`[data-index="${toIndex}"]`);
    if (!fromCell || !toCell) return toIndex;

    const fromRect = fromCell.getBoundingClientRect();
    const toRect = toCell.getBoundingClientRect();
    const dx =
      (toRect.left + toRect.width / 2) -
      (fromRect.left + fromRect.width / 2);
    const dy =
      (toRect.top + toRect.height / 2) -
      (fromRect.top + fromRect.height / 2);

    setMessage('BANKING FIRE WILD', 'LOCKING CARRYOVER INTO THE BOTTOM ROW');

    await fromCell.animate([
      {
        transform: 'translate3d(0,0,0) scale(1)',
        filter: 'brightness(1.12)',
        offset: 0
      },
      {
        transform: `translate3d(${dx}px,${dy + 7}px,0) scale(1.045)`,
        filter: 'brightness(1.38)',
        offset: .88
      },
      {
        transform: `translate3d(${dx}px,${dy}px,0) scale(1)`,
        filter: 'brightness(1.2)',
        offset: 1
      }
    ], {
      duration: scaledMs(CONFIG.fireWildBankDropMs),
      easing: 'cubic-bezier(.18,.76,.2,1)',
      fill: 'forwards'
    }).finished.catch(() => {});

    await fromCell.animate([
      {
        transform: `translate3d(${dx}px,${dy}px,0) scale(1)`
      },
      {
        transform: `translate3d(${dx}px,${dy - 9}px,0) scale(.985)`
      },
      {
        transform: `translate3d(${dx}px,${dy + 3}px,0) scale(1.025)`
      },
      {
        transform: `translate3d(${dx}px,${dy}px,0) scale(1)`
      }
    ], {
      duration: scaledMs(CONFIG.fireWildBankBounceMs),
      easing: 'cubic-bezier(.22,.84,.28,1)',
      fill: 'forwards'
    }).finished.catch(() => {});

    return toIndex;
  }

  async function animateFiveAlarmCompression() {
    const survivors = collectSurvivingFire();
    state.compressionResultIndex = null;

    if (!survivors.length) {
      state.fireWildCarryover = null;
      return null;
    }

    const carryover = buildFireWildCarryover(survivors);
    const targetIndex = compressionTargetIndex(survivors);
    const survivorIndices = new Set(survivors.map(entry => entry.sourceIndex));

    setMessage(
      'FIRE COLLECTION',
      `${survivors.length} SURVIVOR${survivors.length === 1 ? '' : 'S'} · ${carryover.multiplier}× TOTAL`
    );

    const reducedMotion =
      globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ||
      !Element.prototype.animate;

    if (!reducedMotion) {
      const boardRect = el.board.getBoundingClientRect();
      const cells = [...el.board.querySelectorAll('.cell')];

      // Phase 1: every non-fire symbol drops out of the board.
      const normalAnimations = cells
        .filter(cell => !survivorIndices.has(Number(cell.dataset.index)))
        .map(cell => {
          const index = Number(cell.dataset.index);
          const row = Math.floor(index / CONFIG.cols);
          const col = index % CONFIG.cols;
          const dropDistance = boardRect.height * 0.72 + row * 10;

          return cell.animate([
            { transform: 'translate3d(0,0,0) scale(1)', opacity: 1 },
            { transform: `translate3d(0,${dropDistance}px,0) scale(.94)`, opacity: 0 }
          ], {
            duration: scaledMs(CONFIG.fireCompressionDropMs),
            delay: scaledMs(row * 18 + col * 8),
            easing: 'cubic-bezier(.42,0,.72,.26)',
            fill: 'forwards'
          }).finished.catch(() => {});
        });

      await Promise.all(normalAnimations);
      await sleep(110);

      // Phase 2: surviving fire symbols collapse into the survivor nearest center.
      const targetCell = el.board.querySelector(`[data-index="${targetIndex}"]`);
      const targetRect = targetCell?.getBoundingClientRect();

      if (targetRect) {
        const targetX = targetRect.left + targetRect.width / 2;
        const targetY = targetRect.top + targetRect.height / 2;

        const mergeAnimations = survivors.map(entry => {
          const cell = el.board.querySelector(`[data-index="${entry.sourceIndex}"]`);
          if (!cell) return Promise.resolve();

          const rect = cell.getBoundingClientRect();
          const x = rect.left + rect.width / 2;
          const y = rect.top + rect.height / 2;
          const dx = targetX - x;
          const dy = targetY - y;

          if (entry.sourceIndex === targetIndex) {
            return cell.animate([
              { transform: 'scale(1)', filter: 'brightness(1)' },
              { transform: 'scale(1.13)', filter: 'brightness(1.5)' },
              { transform: 'scale(1.05)', filter: 'brightness(1.25)' }
            ], {
              duration: scaledMs(CONFIG.fireCompressionMergeMs),
              easing: 'cubic-bezier(.18,.78,.22,1)',
              fill: 'forwards'
            }).finished.catch(() => {});
          }

          const distance = Math.hypot(dx, dy);
          const delay = Math.min(120, distance * .18);

          return cell.animate([
            {
              transform: 'translate3d(0,0,0) scale(1)',
              opacity: 1,
              filter: 'brightness(1)'
            },
            {
              transform: `translate3d(${dx}px,${dy}px,0) scale(.18)`,
              opacity: .12,
              filter: 'brightness(1.8)'
            }
          ], {
            duration: scaledMs(CONFIG.fireCompressionMergeMs),
            delay,
            easing: 'cubic-bezier(.2,.72,.18,1)',
            fill: 'forwards'
          }).finished.catch(() => {});
        });

        await Promise.all(mergeAnimations);
      }
    }

    // Collapse the resolved board into one real Fire Wild in the chosen center-near cell.
    state.board = Array(CONFIG.cells).fill(null);
    state.symbolFire = createSymbolFireState();
    state.board[targetIndex] = WILD_KEY;
    state.symbolFire[targetIndex] = {
      state: carryover.state,
      multiplier: carryover.multiplier
    };
    state.fireWildCarryover = { ...carryover };
    state.compressionResultIndex = targetIndex;

    renderBoard();
    showBanner(`${carryover.multiplier}×`);
    setMessage(
      'FIRE WILD FORGED',
      `${carryover.collectedCount} FIRE SYMBOL${carryover.collectedCount === 1 ? '' : 'S'} → ${carryover.multiplier}× ${carryover.state.toUpperCase()} WILD`
    );

    const resultCell = el.board.querySelector(`[data-index="${targetIndex}"]`);
    if (resultCell && !reducedMotion) {
      await resultCell.animate([
        { transform: 'scale(.62)', opacity: .45, filter: 'brightness(1.8)' },
        { transform: 'scale(1.22)', opacity: 1, filter: 'brightness(1.6)' },
        { transform: 'scale(1)', opacity: 1, filter: 'brightness(1)' }
      ], {
        duration: scaledMs(CONFIG.fireCompressionResultMs),
        easing: 'cubic-bezier(.16,.82,.24,1)',
        fill: 'both'
      }).finished.catch(() => {});
    } else {
      await sleep(CONFIG.fireCompressionResultMs);
    }

    // The forged Wild now physically banks to the bottom cell of the SAME column.
    // This is an end-of-spin presentation/state position only; the next free spin
    // still builds a completely fresh board before the carryover Wild re-enters.
    const bottomIndex = await animateBankedFireWildDrop(targetIndex, reducedMotion);

    if (bottomIndex !== targetIndex) {
      state.board = Array(CONFIG.cells).fill(null);
      state.symbolFire = createSymbolFireState();

      state.board[bottomIndex] = WILD_KEY;
      state.symbolFire[bottomIndex] = {
        state: carryover.state,
        multiplier: carryover.multiplier
      };

      state.compressionResultIndex = bottomIndex;
      renderBoard();
    }

    setMessage(
      'FIRE WILD BANKED',
      `${carryover.multiplier}× · BOTTOM ROW · CARRYOVER READY`
    );
    await sleep(CONFIG.fireWildBankHoldMs);

    logFireEvent('fire-wild-compress', {
      ...carryover,
      targetIndex,
      bankedIndex: bottomIndex
    });

    return carryover;
  }

  function chooseFireWildPosition() {
    const eligible = state.board
      .map((symbol, index) =>
        symbol != null && symbol !== BONUS_KEY ? index : -1
      )
      .filter(index => index >= 0);

    return randomFrom(eligible);
  }

  function placeFireWild(carryover) {
    if (!carryover) return null;

    const index = chooseFireWildPosition();
    if (index == null) return null;

    // This is a real Wild in the actual board array. It has no immunity:
    // if a winning cascade removes it, the Fire Wild and its multiplier are gone.
    state.board[index] = WILD_KEY;
    state.symbolFire[index] = {
      state: carryover.state,
      multiplier: carryover.multiplier
    };

    logFireEvent('fire-wild-enter', {
      index,
      state: carryover.state,
      multiplier: carryover.multiplier,
      collectedCount: carryover.collectedCount
    });

    return index;
  }

  async function animateFireWildEntry(index) {
    if (index == null) return;
    const cell = el.board.querySelector(`[data-index="${index}"]`);
    if (!cell || !Element.prototype.animate) return;

    await cell.animate([
      { transform: 'translate3d(0,-35%,0) scale(1.38)', opacity: .15, filter: 'brightness(1.7)' },
      { transform: 'translate3d(0,4%,0) scale(1.08)', opacity: 1, filter: 'brightness(1.35)' },
      { transform: 'translate3d(0,0,0) scale(1)', opacity: 1, filter: 'brightness(1)' }
    ], {
      duration: scaledMs(CONFIG.fireWildEntryMs),
      easing: 'cubic-bezier(.16,.82,.24,1)',
      fill: 'both'
    }).finished.catch(() => {});
  }

  async function pulseFireSymbols(indices, kind = 'ignite') {
    if (!indices?.length || !Element.prototype.animate) return;

    const animations = indices.map((index, rank) => {
      const cell = el.board.querySelector(`[data-index="${index}"]`);
      if (!cell) return Promise.resolve();

      return cell.animate([
        { transform: 'scale(.92)', filter: 'brightness(1)' },
        { transform: 'scale(1.12)', filter: kind === 'reignite' ? 'brightness(1.65)' : 'brightness(1.45)' },
        { transform: 'scale(1)', filter: 'brightness(1)' }
      ], {
        duration: scaledMs(420),
        delay: scaledMs(rank * 34),
        easing: 'cubic-bezier(.2,.8,.24,1)',
        fill: 'both'
      }).finished.catch(() => {});
    });

    await Promise.all(animations);
  }

  function igniteFiveAlarmFreshSymbols(excluded = new Set()) {
    const eligible = state.symbolFire
      .map((fire, index) =>
        fire.state === FIRE_STATE.NORMAL &&
        state.board[index] != null &&
        !excluded.has(index)
          ? index
          : -1
      )
      .filter(index => index >= 0);

    // Shuffle with the same RNG source used by the rest of the game.
    for (let i = eligible.length - 1; i > 0; i--) {
      const j = Math.floor(randomFloat() * (i + 1));
      [eligible[i], eligible[j]] = [eligible[j], eligible[i]];
    }

    const targets = eligible.slice(
      0,
      Math.min(
        Number.isFinite(state.mathOverrides.freshIgnitionCount)
          ? Math.max(0, Math.floor(state.mathOverrides.freshIgnitionCount))
          : CONFIG.fireFiveFreshIgnitionCount,
        eligible.length
      )
    );

    for (const index of targets) {
      igniteSymbol(index, '5-alarm-fresh-ignition');
    }

    return targets;
  }

  function logFireEvent(type, data = {}) {
    const entry = {
      type,
      bonusType: state.activeBonusType,
      freeSpinsRemaining: state.freeSpinsRemaining,
      ...data
    };
    state.fireHistory.push(entry);
    if (state.fireHistory.length > 100) state.fireHistory.shift();
    recordEvent(`fire:${type}`, entry);
  }

  function burningSymbols() {
    return state.symbolFire
      .map((fire, index) => fire.state === FIRE_STATE.BURNING ? index : -1)
      .filter(index => index >= 0);
  }

  function smoulderingSymbols() {
    return state.symbolFire
      .map((fire, index) => fire.state === FIRE_STATE.SMOULDERING ? index : -1)
      .filter(index => index >= 0);
  }

  function randomFrom(items) {
    if (!items.length) return null;
    return items[Math.floor(randomFloat() * items.length)];
  }

  function igniteSymbol(index, source = 'ignition') {
    const fire = state.symbolFire[index];
    if (!fire || fire.state === FIRE_STATE.BURNING) return false;

    if (fire.state === FIRE_STATE.NORMAL) {
      fire.state = FIRE_STATE.BURNING;
      fire.multiplier = 2;
      state.fireEvents.newIgnition.push(index);
      logFireEvent('ignite', { index, multiplier: 2, source });
      return true;
    }

    // Normal spread into a Smouldering symbol: reignite at stored value.
    // Never double here; Backdraft doubling only happens post-Spray.
    fire.state = FIRE_STATE.BURNING;
    state.fireEvents.reignited.push(index);
    logFireEvent('reignite', {
      index,
      multiplier: fire.multiplier,
      source,
      backdraft: false
    });
    return true;
  }

  function igniteRandomNormalSymbol(source = 'random-ignition') {
    const eligible = state.symbolFire
      .map((fire, index) => fire.state === FIRE_STATE.NORMAL ? index : -1)
      .filter(index =>
        index >= 0 &&
        state.board[index] != null &&
        state.board[index] !== BONUS_KEY
      );

    const target = randomFrom(eligible);
    if (target == null) return null;
    igniteSymbol(target, source);
    return target;
  }

  function spreadFire({ force = false, profileName = currentRngProfileName() } = {}) {
    // Spread probability applies to the EVENT, not independently to each source.
    // If a spread event occurs, EVERY Burning symbol that existed at the start
    // of the event spreads simultaneously into ALL eligible orthogonal neighbors.
    // Newly ignited symbols wait until the next spread opportunity, preventing
    // recursive chain consumption of the entire board in one event.
    const sources = [...burningSymbols()];
    const claimed = new Set();
    const spread = [];
    const reignited = [];
    const chance = currentRngProfile(profileName).fireSpreadChance;

    if (!sources.length) {
      return { spread, reignited, sourcesSpread: [] };
    }

    if (!force && randomFloat() >= chance) {
      return { spread, reignited, sourcesSpread: [] };
    }

    const sourcesSpread = [];

    for (const source of sources) {
      const touching = orthogonalNeighbors(source)
        .filter(index =>
          state.symbolFire[index].state !== FIRE_STATE.BURNING &&
          !claimed.has(index) &&
          state.board[index] != null
        )
        .slice(0, CONFIG.fireSpreadMaxTargets);

      if (touching.length) sourcesSpread.push(source);

      for (const target of touching) {
        claimed.add(target);

        const wasSmouldering =
          state.symbolFire[target].state === FIRE_STATE.SMOULDERING;

        igniteSymbol(target, 'fire-spread');

        if (wasSmouldering) reignited.push(target);
        else spread.push(target);
      }
    }

    state.fireEvents.spread = [...spread];

    if (spread.length || reignited.length) {
      logFireEvent('spread', {
        sourcesSpread: [...sourcesSpread],
        spread: [...spread],
        reignited: [...reignited]
      });
    }

    return { spread, reignited, sourcesSpread };
  }

  function selectSprayRow(profileName = currentRngProfileName()) {
    const selection = currentRngProfile(profileName).sprayRowSelection;

    if (selection === 'middle-weighted') {
      // Still allows every row, while favoring positions that can leave
      // surviving fire above and extinguished fire below for Backdraft potential.
      const weightedRows = [0, 1, 1, 2, 2, 2, 3, 3, 3, 4, 4, 5, 6];
      return randomFrom(weightedRows);
    }

    return Math.floor(randomFloat() * CONFIG.rows);
  }

  function applySprayToSymbols(row) {
    resetFireEventState();

    const affectedRows = Array.from(
      { length: CONFIG.rows - row },
      (_, offset) => row + offset
    );
    const affected = new Set(affectedRows);
    const extinguished = [];
    const transitions = [];

    // Direct hose row + all rows beneath it from dripping water.
    for (let index = 0; index < CONFIG.cells; index++) {
      const symbolRow = Math.floor(index / CONFIG.cols);
      const fire = state.symbolFire[index];

      if (!affected.has(symbolRow) || fire.state !== FIRE_STATE.BURNING) continue;

      const before = fire.multiplier;
      fire.state = FIRE_STATE.SMOULDERING;
      fire.multiplier *= 2;
      extinguished.push(index);
      transitions.push({ index, before, after: fire.multiplier });
    }

    state.fireEvents.sprayRow = row;
    state.fireEvents.sprayAffectedRows = affectedRows;
    state.fireEvents.extinguished = [...extinguished];

    // Determine Backdraft now, but DO NOT resolve it yet. This preserves a
    // readable Smouldering state for the anticipation sequence while keeping
    // eligibility independent of animation timing.
    const survivingBurning = burningSymbols();
    const currentSmouldering = new Set(smoulderingSymbols());
    const backdraftEligible =
      survivingBurning.length > 0 &&
      survivingBurning.some(index =>
        orthogonalNeighbors(index).some(neighbor => currentSmouldering.has(neighbor))
      );

    state.fireEvents.backdraftEligible = backdraftEligible;

    logFireEvent('spray', {
      row,
      affectedRows: [...affectedRows],
      extinguished: [...extinguished],
      transitions: transitions.map(item => ({ ...item })),
      backdraftEligible
    });

    return {
      row,
      affectedRows,
      extinguished,
      transitions,
      backdraftEligible,
      backdraftTriggered: false,
      reignited: []
    };
  }

  function resolveBackdraftMechanic() {
    if (!state.fireEvents.backdraftEligible) {
      return { triggered: false, reignited: [], transitions: [] };
    }

    const currentSmouldering = smoulderingSymbols();
    if (!currentSmouldering.length) {
      state.fireEvents.backdraftEligible = false;
      return { triggered: false, reignited: [], transitions: [] };
    }

    const reignited = [];
    const transitions = [];

    // Backdraft doubles and reignites ALL currently Smouldering symbols.
    for (const index of currentSmouldering) {
      const fire = state.symbolFire[index];
      const before = fire.multiplier;
      fire.multiplier *= 2;
      fire.state = FIRE_STATE.BURNING;
      reignited.push(index);
      transitions.push({ index, before, after: fire.multiplier });
    }

    state.fireEvents.backdraftTriggered = true;
    state.fireEvents.reignited = [...reignited];

    logFireEvent('backdraft', {
      reignited: [...reignited],
      transitions: transitions.map(item => ({ ...item }))
    });

    return { triggered: true, reignited, transitions };
  }

  async function showFireEvent(title, detail = '') {
    renderBoard();
    setMessage(title, detail);
    await runPresentationEvent('presentation:fire-event', { title, detail }, async () => {
      await sleep(CONFIG.fireEventPauseMs);
    });
  }

  async function resolveSpreadOpportunity(force = false, profileName = currentRngProfileName()) {
    const result = spreadFire({ force, profileName });
    if (!result.spread.length && !result.reignited.length) return result;

    const detail = result.reignited.length
      ? `${result.spread.length} NEW · ${result.reignited.length} REIGNITED`
      : `${result.spread.length} NEW SYMBOL${result.spread.length === 1 ? '' : 'S'}`;

    const affected = [...result.spread, ...result.reignited];
    spawnBoardParticles('ember', affected, 3);
    await showFireEvent('FIRE SPREAD', detail);
    await pulseFireSymbols(
      affected,
      result.reignited.length ? 'reignite' : 'ignite'
    );
    return result;
  }

  async function resolveSprayEvent(
    profileName = currentRngProfileName(),
    forcedRow = null
  ) {
    const row = Number.isInteger(forcedRow)
      ? clamp(forcedRow, 0, CONFIG.rows - 1)
      : selectSprayRow(profileName);

    recordEvent('spray-start', { row });

    state.sprayVisual = { row, phase: 'line' };
    renderBoard();
    el.board?.classList.add('spray-active');
    setMessage('PUT OUT FLAMES', `HOSE · ROW ${row + 1}`);
    spawnBoardParticles('mist', Array.from({ length: CONFIG.cols }, (_, col) => row * CONFIG.cols + col), 2);
    await sleep(CONFIG.sprayLinePauseMs);

    state.sprayVisual = { row, phase: 'drip' };
    renderBoard();
    recordEvent('water-drip', { row, affectedRows: Array.from({ length: CONFIG.rows - row - 1 }, (_, offset) => row + 1 + offset) });
    setMessage('PUT OUT FLAMES', `WATER DRIPPING BELOW ROW ${row + 1}`);
    const dripIndices = [];
    for (let r = row + 1; r < CONFIG.rows; r++) {
      for (let col = 0; col < CONFIG.cols; col++) dripIndices.push(r * CONFIG.cols + col);
    }
    spawnBoardParticles('water', dripIndices, 1);
    await sleep(CONFIG.sprayDripPauseMs);

    const result = applySprayToSymbols(row);
    state.sprayVisual = null;
    renderBoard();
    el.board?.classList.remove('spray-active');

    if (result.extinguished.length) {
      spawnBoardParticles('smoke', result.extinguished, 2);
      await animateMultiplierTransitions(result.transitions, 'water');
    }

    setMessage(
      'PUT OUT FLAMES',
      `ROW ${row + 1} ↓ · ${result.extinguished.length} EXTINGUISHED`
    );
    await sleep(CONFIG.fireEventPauseMs);

    if (result.backdraftEligible) {
      // Quiet beat before the violent resolution.
      el.board?.classList.add('backdraft-anticipation');
      setMessage('PRESSURE BUILDING…', 'BACKDRAFT CONDITIONS DETECTED');
      recordEvent('backdraft-anticipation', {
        burning: burningSymbols(),
        smouldering: smoulderingSymbols()
      });
      spawnBoardParticles('smoke', smoulderingSymbols(), 1);
      await sleep(CONFIG.backdraftAnticipationMs);

      const backdraft = resolveBackdraftMechanic();

      if (backdraft.triggered) {
        state.backdraftFlash = true;
        el.board?.classList.remove('backdraft-anticipation');
        renderBoard();
        setMessage(
          'BACKDRAFT',
          `${backdraft.reignited.length} SMOULDERING SYMBOLS REIGNITED`
        );

        spawnBoardParticles('burst', backdraft.reignited, 5);
        await animateMultiplierTransitions(backdraft.transitions, 'backdraft');
        await sleep(CONFIG.backdraftBurstMs);

        state.backdraftFlash = false;
        renderBoard();

        // Backdraft may lead to normal spread. That spread cannot itself trigger Backdraft.
        await resolveSpreadOpportunity(false, profileName);
      }
    }

    el.board?.classList.remove('backdraft-anticipation');
    return {
      ...result,
      backdraftTriggered: state.fireEvents.backdraftTriggered,
      reignited: [...state.fireEvents.reignited]
    };
  }

  function selectConfiguredDebugTier() {
    const rates = [
      [5, state.mathOverrides.trigger5Chance],
      [4, state.mathOverrides.trigger4Chance],
      [3, state.mathOverrides.trigger3Chance]
    ].map(([tier, chance]) => [tier, Number.isFinite(chance) ? clamp(chance, 0, 1) : 0]);

    const total = rates.reduce((sum, [, chance]) => sum + chance, 0);
    if (total <= 0) return 0;

    const roll = randomFloat();
    let cursor = 0;
    for (const [tier, chance] of rates) {
      cursor += chance;
      if (roll < cursor) {
        recordEvent('debug-tier-trigger-selected', { tier, roll, rates: Object.fromEntries(rates) });
        return tier;
      }
    }
    return 0;
  }

  function selectBaseFireFeature() {
    if (state.debugEnhancements.guaranteedFire) return 'ignition';

    const chance = state.debugEnhancements.highFireFrequency
      ? Math.min(0.25, CONFIG.baseFireFeatureChance * 3)
      : CONFIG.baseFireFeatureChance;

    if (randomFloat() >= chance) return null;
    return randomFloat() < CONFIG.baseFireHoseShare ? 'hose' : 'ignition';
  }

  async function resolveBaseFireTeaser(feature, profileName) {
    if (!feature) return;

    recordEvent('base-fire-feature', { feature, profileName });
    const ignition = igniteRandomNormalSymbol('base-game-teaser');
    if (ignition == null) return;

    renderBoard();
    spawnBoardParticles('ember', [ignition], 4);
    setMessage('HEAT SPIKE', 'RARE BASE-GAME IGNITION · 2×');
    await pulseFireSymbols([ignition], 'ignite');
    await sleep(CONFIG.fireEventPauseMs);

    // Selected before board generation; this is not post-result payout chasing.
    await resolveSpreadOpportunity(true, profileName);

    if (feature === 'hose') {
      await resolveSprayEvent(profileName);
    }
  }

  function bonusTierFromAlarmCount(count) {
    if (count >= 5) return 5;
    if (count === 4) return 4;
    if (count === 3) return 3;
    return 0;
  }

  function createBonusSpinBoard(tier, profileName = currentRngProfileName()) {
    // Every free spin gets a completely fresh board. Even in 5-Alarm, old
    // host symbols never persist between spins. Only the compressed Fire Wild carries forward.
    const freshBoard = createInitialBoard({ allowBonus: false, profileName });
    state.symbolFire = createSymbolFireState();
    return freshBoard;
  }

  async function runFireBonus(tier, bet, { profileName = currentRngProfileName() } = {}) {
    const definition = BONUS_TIERS[tier];
    if (!definition) return 0;

    state.activeBonusType = tier;
    state.freeSpinsTotal = definition.freeSpins;
    state.freeSpinsRemaining = definition.freeSpins;
    state.bonusActive = false;
    state.forceAlarmOff = false;
    state.fireHistory = [];
    state.fireWildCarryover = null;
    resetSymbolFire();

    let bonusTotalX = 0;
    state.currentSpinBonusX = 0;

    recordEvent('bonus-start', {
      tier,
      freeSpins: definition.freeSpins,
      profileName
    });

    await showTransition(
      `${definition.label} BONUS`,
      `${definition.freeSpins} FREE SPINS · FIRE SYSTEM ARMED`,
      `alarm-${tier}`,
      900
    );

    for (let spinNumber = 1; spinNumber <= definition.freeSpins; spinNumber++) {
      state.freeSpinsRemaining = definition.freeSpins - spinNumber + 1;
      recordEvent('free-spin-start', {
        tier,
        spinNumber,
        remainingIncludingCurrent: state.freeSpinsRemaining
      });
      resetFireEventState();
      state.compressionResultIndex = null;

      // 5-Alarm persists ONE compressed Fire Wild, never the prior host symbols.
      const incomingFireWild = tier === 5 && state.fireWildCarryover
        ? { ...state.fireWildCarryover }
        : null;

      state.board = createBonusSpinBoard(tier, profileName);

      setMessage(
        `${definition.label} · FREE SPIN ${spinNumber}/${definition.freeSpins}`,
        `${state.freeSpinsRemaining} INCLUDING THIS SPIN`
      );
      await renderBoardWithGravity(initialGravityPlan());

      let fireWildIndex = null;

      if (tier === 5 && incomingFireWild) {
        setMessage(
          'FIRE WILD CARRYOVER',
          `${incomingFireWild.state.toUpperCase()} · ${incomingFireWild.multiplier}×`
        );
        await sleep(CONFIG.fireEventPauseMs);

        fireWildIndex = placeFireWild(incomingFireWild);
        renderBoard();
        await animateFireWildEntry(fireWildIndex);

        setMessage(
          'FIRE WILD ENTERS',
          fireWildIndex == null
            ? 'NO VALID POSITION'
            : `${incomingFireWild.multiplier}× · REAL WILD SYMBOL`
        );
        await sleep(CONFIG.fireEventPauseMs);
      }

      const profile = currentRngProfile(profileName);

      if (tier === 3) {
        if (randomFloat() < profile.fireThreeIgnitionChance) {
          igniteRandomNormalSymbol('3-alarm-ignition');
          await showFireEvent('IGNITION', `FREE SPIN ${spinNumber}`);
        }
      } else if (tier === 4) {
        igniteRandomNormalSymbol('4-alarm-round-start');
        await showFireEvent('ROUND IGNITION', `FREE SPIN ${spinNumber}`);
      } else if (tier === 5) {
        const excluded = new Set(
          fireWildIndex == null ? [] : [fireWildIndex]
        );

        const freshIgnitions = igniteFiveAlarmFreshSymbols(excluded);
        renderBoard();

        if (freshIgnitions.length) {
          setMessage(
            'FRESH IGNITION',
            `${freshIgnitions.length} NEW 2× BURNING SYMBOL${freshIgnitions.length === 1 ? '' : 'S'}`
          );
          await pulseFireSymbols(freshIgnitions, 'ignite');
          await sleep(CONFIG.fireEventPauseMs);
        }
      }

      await resolveSpreadOpportunity(false, profileName);

      let spinX = 0;
      let cascadeNumber = 0;

      while (cascadeNumber < CONFIG.maxCascades) {
        const result = evaluateBoard(state.board, state.symbolFire);
        if (!result.wins.length) break;

        cascadeNumber++;
        spinX += result.totalX;
        bonusTotalX += result.totalX;
        state.currentSpinBonusX = bonusTotalX;
        await animateWin(result, cascadeNumber);

        const cascaded = cascadeBoard(
          state.board,
          result.remove,
          state.symbolFire,
          { allowBonus: false, profileName }
        );

        state.board = cascaded.board;
        state.symbolFire = cascaded.symbolFire;
        await renderBoardWithGravity(cascaded.movements, { isCascade: false });

        // Surviving Burning symbols moved with their symbols and can spread from new locations.
        await resolveSpreadOpportunity(false, profileName);
      }

      if (tier === 4) {
        await resolveSprayEvent(profileName);
      } else if (
        tier === 5 &&
        (state.debugEnhancements.guaranteedSpray || randomFloat() < profile.fireFiveSprayChance)
      ) {
        await resolveSprayEvent(profileName);
      }

      if (tier === 5) {
        // Presentation and math resolve together: normal symbols drop away,
        // every surviving fire symbol merges into the survivor nearest center,
        // and the resulting Fire Wild is the uncapped SUM of all survivor multipliers.
        const compressed = await animateFiveAlarmCompression();

        if (!compressed && spinNumber < definition.freeSpins) {
          setMessage(
            'NO FIRE SURVIVED',
            'NEXT SPIN STARTS WITH FRESH 2× IGNITION'
          );
          await sleep(CONFIG.fireEventPauseMs);
        }
      }

      state.freeSpinsRemaining = definition.freeSpins - spinNumber;

      if (tier !== 5) renderBoard();

      setMessage(
        tier === 5 && state.fireWildCarryover
          ? `${definition.label} · ${state.fireWildCarryover.multiplier}× FIRE WILD BANKED`
          : `${definition.label} · SPIN ${spinNumber} COMPLETE · ${spinX.toFixed(2)}×`,
        `${state.freeSpinsRemaining} FREE SPINS LEFT`
      );
      recordEvent('free-spin-complete', {
        tier,
        spinNumber,
        spinX,
        bonusTotalX,
        remaining: state.freeSpinsRemaining,
        burning: burningSymbols().length,
        smouldering: smoulderingSymbols().length,
        fireWildMultiplier: state.fireWildCarryover?.multiplier || 0
      });
      await sleep(CONFIG.freeSpinEndHoldMs);
    }

    recordEvent('bonus-complete', { tier, bonusTotalX });
    await showTransition(
      `${definition.label} COMPLETE`,
      `${bonusTotalX.toFixed(2)}× BONUS WIN`,
      'bonus-complete',
      900
    );

    state.activeBonusType = 0;
    state.freeSpinsRemaining = 0;
    state.freeSpinsTotal = 0;
    state.fireWildCarryover = null;
    state.compressionResultIndex = null;
    resetSymbolFire();
    renderBoard();

    return bonusTotalX;
  }

  function fireWildOnBoard() {
    for (let index = 0; index < state.board.length; index++) {
      if (
        state.board[index] === WILD_KEY &&
        state.symbolFire[index]?.state !== FIRE_STATE.NORMAL
      ) {
        return {
          index,
          state: state.symbolFire[index].state,
          multiplier: state.symbolFire[index].multiplier
        };
      }
    }
    return null;
  }

  function currentMathConfigSnapshot() {
    const preset = activeMathPreset();
    const profile = currentRngProfile();
    return {
      profile: state.mathProfile,
      label: preset.label,
      nominalTargetRtp: preset.nominalTargetRtp,
      volatility: preset.volatility,
      payoutScale: preset.payoutScale,
      clumpChance: profile.clumpChance,
      fireIgnitionChance: profile.fireThreeIgnitionChance,
      fireSpreadChance: profile.fireSpreadChance,
      sprayChance: profile.fireFiveSprayChance,
      bonusWeight: effectiveSymbolWeight(
        SYMBOLS.find(symbol => symbol.key === BONUS_KEY),
        currentRngProfileName()
      ),
      freshIgnitionCount:
        state.mathOverrides.freshIgnitionCount ??
        CONFIG.fireFiveFreshIgnitionCount,
      debugTriggerRates: {
        alarm3: state.mathOverrides.trigger3Chance,
        alarm4: state.mathOverrides.trigger4Chance,
        alarm5: state.mathOverrides.trigger5Chance
      },
      seeded: Boolean(state.debugSeed),
      seed: state.debugSeed || null
    };
  }

  function updateDebugInspector() {
    if (!el.debugStateInspector && !el.debugEventLog && !el.debugMathConfig) return;

    const fireWild = fireWildOnBoard();
    const inspector = {
      version: CONFIG.version,
      spinId: state.spinId,
      busy: state.busy,
      mode: state.pendingGameMode,
      bet: CONFIG.bets[state.betIndex],
      baseWinX: Number(state.currentSpinBaseX.toFixed(4)),
      bonusWinX: Number(state.currentSpinBonusX.toFixed(4)),
      totalKnownX: Number((state.currentSpinBaseX + state.currentSpinBonusX).toFixed(4)),
      alarmLevel: state.activeBonusType,
      freeSpinsRemaining: state.freeSpinsRemaining,
      burningCount: burningSymbols().length,
      smoulderingCount: smoulderingSymbols().length,
      fireWildMultiplier: fireWild?.multiplier || state.fireWildCarryover?.multiplier || 0,
      fireWildState: fireWild?.state || state.fireWildCarryover?.state || null,
      sprayRow: state.fireEvents.sprayRow,
      backdraftEligible: state.fireEvents.backdraftEligible,
      backdraftTriggered: state.fireEvents.backdraftTriggered,
      cascade: state.currentCascade,
      rngProfile: currentRngProfileName(),
      mathProfile: state.mathProfile,
      animationSpeed: state.animationSpeed,
      baseFireFeature: state.baseFireFeature,
      lastError: state.lastError || null
    };

    if (el.debugStateInspector) {
      el.debugStateInspector.textContent = JSON.stringify(inspector, null, 2);
    }

    if (el.debugEventLog) {
      const recent = state.eventHistory.slice(-28);
      el.debugEventLog.textContent = recent.length
        ? recent.map(event => {
            const fields = { ...event };
            delete fields.time;
            const prefix = `#${event.sequence} · S${event.spinId} · ${event.type}`;
            delete fields.sequence;
            delete fields.spinId;
            delete fields.type;
            return `${prefix} ${Object.keys(fields).length ? JSON.stringify(fields) : ''}`;
          }).join('\n')
        : 'No events recorded yet.';
      el.debugEventLog.scrollTop = el.debugEventLog.scrollHeight;
    }

    if (el.debugMathConfig) {
      el.debugMathConfig.textContent = JSON.stringify(currentMathConfigSnapshot(), null, 2);
    }
  }

  function setAnimationSpeed(speed) {
    const normalized = [0.25, 0.5, 1, 2, 8].includes(Number(speed))
      ? Number(speed)
      : 1;
    state.animationSpeed = normalized;
    document.documentElement.style.setProperty(
      '--motion-scale',
      String(1 / normalized)
    );
    recordEvent('animation-speed', { speed: normalized });
    document.querySelectorAll('[data-animation-speed]').forEach(button => {
      button.classList.toggle(
        'active',
        Number(button.dataset.animationSpeed) === normalized
      );
    });
    updateDebugInspector();
  }

  function renderDebugSymbolWeights() {
    if (!el.debugSymbolWeights) return;
    el.debugSymbolWeights.innerHTML = SYMBOLS.map(symbol => {
      const current =
        state.symbolWeightOverrides[symbol.key] ??
        symbol.weight;
      return `
        <label class="debug-number-field">
          <span>${symbol.label}</span>
          <input
            type="number"
            min="0"
            step="0.1"
            value="${current}"
            data-symbol-weight="${symbol.key}"
          />
        </label>
      `;
    }).join('');
  }

  function readDebugNumber(id, fallback = null) {
    const node = document.getElementById(id);
    if (!node) return fallback;
    const raw = String(node.value ?? '').trim();
    if (!raw) return fallback;
    const value = Number(raw);
    return Number.isFinite(value) ? value : fallback;
  }

  function applyDebugMathControls() {
    if (!CONFIG.debugEnabled) return;

    state.mathProfile =
      MATH_PROFILES[el.debugMathProfile?.value]
        ? el.debugMathProfile.value
        : 'baseline';

    state.mathOverrides.clumpChance = readDebugNumber('debugClumpChance', null);
    state.mathOverrides.fireIgnitionChance = readDebugNumber('debugIgnitionChance', null);
    state.mathOverrides.fireSpreadChance = readDebugNumber('debugSpreadChance', null);
    state.mathOverrides.sprayChance = readDebugNumber('debugSprayChance', null);
    state.mathOverrides.bonusWeight = readDebugNumber('debugBonusWeight', null);
    state.mathOverrides.freshIgnitionCount = readDebugNumber('debugFreshIgnitions', null);
    state.mathOverrides.trigger3Chance = readDebugNumber('debugTrigger3Chance', null);
    state.mathOverrides.trigger4Chance = readDebugNumber('debugTrigger4Chance', null);
    state.mathOverrides.trigger5Chance = readDebugNumber('debugTrigger5Chance', null);

    document.querySelectorAll('[data-symbol-weight]').forEach(input => {
      const value = Number(input.value);
      if (Number.isFinite(value) && value >= 0) {
        state.symbolWeightOverrides[input.dataset.symbolWeight] = value;
      }
    });

    if (el.debugSeed) setDebugSeed(el.debugSeed.value);

    state.debugLogEnabled = Boolean(el.debugConsoleLogging?.checked);
    state.debugEnhancements.guaranteedFire = Boolean(el.debugGuaranteedFire?.checked);
    state.debugEnhancements.guaranteedSpray = Boolean(el.debugGuaranteedSpray?.checked);
    state.debugEnhancements.highFireFrequency = Boolean(el.debugHighFireFrequency?.checked);
    state.debugEnhancements.maxVisualIntensity = Boolean(el.debugMaxVisualIntensity?.checked);
    document.documentElement.classList.toggle(
      'max-visual-intensity',
      state.debugEnhancements.maxVisualIntensity
    );

    recordEvent('debug-math-applied', currentMathConfigSnapshot());
    updateDebugInspector();
    setMessage('DEBUG MATH APPLIED', activeMathPreset().label);
  }

  function resetDebugMathControls() {
    state.mathProfile = 'baseline';
    state.mathOverrides = {
      clumpChance: null,
      fireIgnitionChance: null,
      fireSpreadChance: null,
      sprayChance: null,
      bonusWeight: null,
      freshIgnitionCount: null,
      trigger3Chance: null,
      trigger4Chance: null,
      trigger5Chance: null
    };
    state.symbolWeightOverrides = {};
    state.debugEnhancements = {
      guaranteedFire: false,
      guaranteedSpray: false,
      highFireFrequency: false,
      maxVisualIntensity: false
    };
    setDebugSeed('');

    if (el.debugMathProfile) el.debugMathProfile.value = 'baseline';
    if (el.debugSeed) el.debugSeed.value = '';
    if (el.debugConsoleLogging) el.debugConsoleLogging.checked = false;
    if (el.debugGuaranteedFire) el.debugGuaranteedFire.checked = false;
    if (el.debugGuaranteedSpray) el.debugGuaranteedSpray.checked = false;
    if (el.debugHighFireFrequency) el.debugHighFireFrequency.checked = false;
    if (el.debugMaxVisualIntensity) el.debugMaxVisualIntensity.checked = false;

    for (const [id, value] of [
      ['debugClumpChance', ''],
      ['debugIgnitionChance', ''],
      ['debugSpreadChance', ''],
      ['debugSprayChance', ''],
      ['debugBonusWeight', ''],
      ['debugFreshIgnitions', ''],
      ['debugTrigger3Chance', ''],
      ['debugTrigger4Chance', ''],
      ['debugTrigger5Chance', '']
    ]) {
      const node = document.getElementById(id);
      if (node) node.value = value;
    }

    document.documentElement.classList.remove('max-visual-intensity');
    renderDebugSymbolWeights();
    recordEvent('debug-math-reset', {});
    updateDebugInspector();
  }

  function prepareDebugBoard() {
    cancelVisualEffects();
    state.activeBonusType = 0;
    state.freeSpinsRemaining = 0;
    state.freeSpinsTotal = 0;
    state.fireWildCarryover = null;
    state.compressionResultIndex = null;
    state.board = createInitialBoard({
      allowBonus: false,
      profileName: 'normal'
    });
    state.symbolFire = createSymbolFireState();
    resetFireEventState();
    renderBoard();
  }

  function setFireStateAt(index, fireState, multiplier) {
    if (
      index < 0 ||
      index >= CONFIG.cells ||
      state.board[index] == null ||
      state.board[index] === BONUS_KEY
    ) return false;

    state.symbolFire[index] = {
      state: fireState,
      multiplier
    };
    return true;
  }

  async function debugEnterBonus(tier) {
    if (state.busy || !BONUS_TIERS[tier]) return;

    state.busy = true;
    state.spinId += 1;
    state.currentSpinBaseX = 0;
    state.currentSpinBonusX = 0;
    updateUi();

    try {
      recordEvent('debug-direct-bonus', { tier });
      const bonusX = await runFireBonus(tier, CONFIG.bets[state.betIndex], {
        profileName: currentRngProfileName()
      });
      state.currentSpinBonusX = bonusX;
      state.lastWinX = bonusX;
      await presentBigWin(bonusX);
      setMessage(
        `DEBUG ${BONUS_TIERS[tier].label} COMPLETE`,
        `${bonusX.toFixed(2)}× · BALANCE UNCHANGED`
      );
    } catch (error) {
      state.lastError = error instanceof Error ? error.message : String(error);
      recordEvent('runtime-error', { message: state.lastError, scope: 'debug-bonus' });
      cancelVisualEffects();
      setMessage('DEBUG BONUS ERROR', state.lastError.slice(0, 90));
    } finally {
      state.busy = false;
      updateUi();
    }
  }

  async function debugBuyBonus(tier) {
    if (state.busy || !BONUS_TIERS[tier]) return;
    const priceNode =
      tier === 3 ? el.debugBuyPrice3 :
      tier === 4 ? el.debugBuyPrice4 :
      el.debugBuyPrice5;
    const priceX = Number(priceNode?.value);

    if (!Number.isFinite(priceX) || priceX <= 0) {
      setMessage('DEV BUY PRICE REQUIRED', 'ENTER A POSITIVE BET MULTIPLE');
      return;
    }

    const bet = CONFIG.bets[state.betIndex];
    const cost = bet * priceX;
    if (state.balance < cost) {
      setMessage('DEV BUY INSUFFICIENT BALANCE', `COST ${cost.toFixed(2)}`);
      return;
    }

    state.busy = true;
    state.spinId += 1;
    state.balance -= cost;
    state.stats.wagered += cost;
    updateUi();

    try {
      recordEvent('debug-bonus-buy', { tier, priceX, cost });
      const bonusX = await runFireBonus(tier, bet, {
        profileName: currentRngProfileName()
      });
      const credits = bonusX * bet;
      state.balance += credits;
      state.stats.won += credits;
      state.lastWinX = bonusX;
      state.currentSpinBonusX = bonusX;
      await presentBigWin(bonusX);
      setMessage(
        `DEV BUY ${BONUS_TIERS[tier].label} COMPLETE`,
        `${bonusX.toFixed(2)}× · DEV PRICE ${priceX.toFixed(1)}×`
      );
    } finally {
      state.busy = false;
      updateUi();
    }
  }

  async function runDebugAction(action) {
    if (!CONFIG.debugEnabled) return;

    if (action === 'reset-game') {
      cancelVisualEffects();
      state.balance = 1000;
      state.betIndex = 2;
      state.stats = { spins: 0, wagered: 0, won: 0 };
      state.lastWinX = 0;
      state.currentSpinBaseX = 0;
      state.currentSpinBonusX = 0;
      state.eventHistory = [];
      state.lastError = '';
      prepareDebugBoard();
      updateUi();
      updateDebugInspector();
      setMessage('GAME RESET', 'DEVELOPMENT STATE CLEARED');
      return;
    }

    if (action === 'reset-bonus') {
      cancelVisualEffects();
      prepareDebugBoard();
      state.busy = false;
      updateUi();
      setMessage('BONUS STATE RESET', 'READY');
      return;
    }

    if (action === 'reset-balance') {
      state.balance = 1000;
      state.stats = { spins: 0, wagered: 0, won: 0 };
      updateUi();
      recordEvent('debug-balance-reset', {});
      return;
    }

    if (action === 'clear-log') {
      state.eventHistory = [];
      state.fireHistory = [];
      updateDebugInspector();
      return;
    }

    if (action === 'bonus3') return debugEnterBonus(3);
    if (action === 'bonus4') return debugEnterBonus(4);
    if (action === 'bonus5') return debugEnterBonus(5);
    if (action === 'buy3') return debugBuyBonus(3);
    if (action === 'buy4') return debugBuyBonus(4);
    if (action === 'buy5') return debugBuyBonus(5);

    if (state.busy) return;
    state.busy = true;
    updateUi();

    try {
      if (action === 'ignite') {
        prepareDebugBoard();
        const index = igniteRandomNormalSymbol('debug-ignition');
        renderBoard();
        spawnBoardParticles('ember', index == null ? [] : [index], 5);
        await pulseFireSymbols(index == null ? [] : [index], 'ignite');
      }

      if (action === 'multi-fire' || action === 'spread') {
        prepareDebugBoard();
        [16, 18, 30].forEach((index, rank) => {
          setFireStateAt(index, FIRE_STATE.BURNING, 2 * (rank + 1));
        });
        renderBoard();
        await resolveSpreadOpportunity(true, 'normal');
      }

      if (action === 'spray') {
        prepareDebugBoard();
        [9, 17, 24, 31, 39].forEach(index => {
          setFireStateAt(index, FIRE_STATE.BURNING, 2);
        });
        renderBoard();
        const row = Number(el.debugSprayRow?.value);
        await resolveSprayEvent('normal', Number.isInteger(row) ? row : 3);
      }

      if (action === 'spray-all') {
        for (let row = 0; row < CONFIG.rows; row++) {
          prepareDebugBoard();
          [3, 10, 17, 24, 31, 38, 45].forEach((index, rank) => {
            setFireStateAt(index, FIRE_STATE.BURNING, 2 + rank * 2);
          });
          renderBoard();
          setMessage('SPRAY ROW MATRIX', `TESTING ROW ${row + 1} / ${CONFIG.rows}`);
          await resolveSprayEvent('normal', row);
          await sleep(180);
        }
      }

      if (action === 'backdraft') {
        prepareDebugBoard();
        setFireStateAt(17, FIRE_STATE.BURNING, 4);
        setFireStateAt(24, FIRE_STATE.BURNING, 4);
        setFireStateAt(25, FIRE_STATE.BURNING, 8);
        renderBoard();
        await resolveSprayEvent('normal', 3);
      }

      if (action === 'failed-backdraft' || action === 'extinguish-all') {
        prepareDebugBoard();
        [24, 25, 31, 32].forEach(index => {
          setFireStateAt(index, FIRE_STATE.BURNING, 4);
        });
        renderBoard();
        await resolveSprayEvent('normal', 3);
      }

      if (action === 'fire-wild-burning' || action === 'fire-wild-smouldering' || action === 'fire-wild-high') {
        prepareDebugBoard();
        const index = 24;
        state.board[index] = WILD_KEY;
        state.symbolFire[index] = {
          state:
            action === 'fire-wild-smouldering'
              ? FIRE_STATE.SMOULDERING
              : FIRE_STATE.BURNING,
          multiplier: action === 'fire-wild-high' ? 128 : 16
        };
        renderBoard();
        await animateFireWildEntry(index);
      }

      if (action === 'compress') {
        prepareDebugBoard();
        [
          [8, FIRE_STATE.BURNING, 2],
          [17, FIRE_STATE.SMOULDERING, 8],
          [24, FIRE_STATE.BURNING, 16],
          [32, FIRE_STATE.SMOULDERING, 4],
          [40, FIRE_STATE.BURNING, 32]
        ].forEach(([index, fireState, multiplier]) => {
          setFireStateAt(index, fireState, multiplier);
        });
        renderBoard();
        await animateFiveAlarmCompression();
      }

      if (action === 'big-win') {
        prepareDebugBoard();
        await presentBigWin(168.25);
      }

      if (action === 'max-intensity') {
        prepareDebugBoard();
        for (let index = 0; index < CONFIG.cells; index++) {
          if (index % 2 === 0 && state.board[index] !== BONUS_KEY) {
            setFireStateAt(
              index,
              index % 4 === 0 ? FIRE_STATE.BURNING : FIRE_STATE.SMOULDERING,
              2 + (index % 8)
            );
          }
        }
        renderBoard();
        spawnBoardParticles('ember', burningSymbols(), 3);
        spawnBoardParticles('smoke', smoulderingSymbols(), 2);
        await pulseFireSymbols(burningSymbols(), 'ignite');
      }

      if (state.debugEnhancements.maxVisualIntensity) {
        document.documentElement.classList.add('max-visual-intensity');
      }
      recordEvent('debug-action', { action });
      updateDebugInspector();
    } finally {
      state.busy = false;
      updateUi();
    }
  }

  function runSelfTests() {
    const results = [];
    const check = (name, condition, detail = '') => {
      results.push({ name, pass: Boolean(condition), detail });
    };

    const savedBoard = [...state.board];
    const savedFire = state.symbolFire.map(item => ({ ...item }));
    const savedEvents = { ...state.fireEvents };

    try {
      const board = Array(CONFIG.cells).fill('helmet');
      board.fill('axe', 8);
      const fire = createSymbolFireState();
      fire[0] = { state: FIRE_STATE.BURNING, multiplier: 2 };
      fire[1] = { state: FIRE_STATE.SMOULDERING, multiplier: 4 };
      const evaluated = evaluateBoard(board, fire);
      const boosted = evaluated.wins.find(win => win.positions.includes(0) && win.positions.includes(1));
      check(
        'Additive fire multiplier',
        Boolean(boosted && boosted.fireMultiplier >= 6),
        boosted ? `observed ${boosted.fireMultiplier}×` : 'no boosted win'
      );

      state.board = createInitialBoard({ allowBonus: false });
      state.symbolFire = createSymbolFireState();
      setFireStateAt(17, FIRE_STATE.BURNING, 4);
      setFireStateAt(24, FIRE_STATE.BURNING, 8);
      const spray = applySprayToSymbols(3);
      check('Spray doubles', state.symbolFire[24].multiplier === 16);
      check('Backdraft eligibility', spray.backdraftEligible === true);
      const backdraft = resolveBackdraftMechanic();
      check(
        'Backdraft doubles again',
        backdraft.triggered && state.symbolFire[24].multiplier === 32
      );

      state.board = createInitialBoard({ allowBonus: false });
      state.symbolFire = createSymbolFireState();
      setFireStateAt(8, FIRE_STATE.BURNING, 2);
      setFireStateAt(17, FIRE_STATE.SMOULDERING, 8);
      setFireStateAt(24, FIRE_STATE.BURNING, 16);
      const carry = buildFireWildCarryover();
      check(
        'Fire Wild sum is uncapped',
        carry?.multiplier === 26,
        carry ? `observed ${carry.multiplier}×` : 'no carryover'
      );

      state.board = createInitialBoard({ allowBonus: false });
      state.symbolFire = createSymbolFireState();
      setFireStateAt(16, FIRE_STATE.BURNING, 2);
      setFireStateAt(18, FIRE_STATE.BURNING, 2);
      const spread = spreadFire({ force: true, profileName: 'normal' });
      check(
        'Multiple fire sources spread',
        spread.sourcesSpread?.length === 2,
        `sources ${spread.sourcesSpread?.length || 0}`
      );
    } catch (error) {
      check('Self-test runtime', false, error instanceof Error ? error.message : String(error));
    } finally {
      state.board = savedBoard;
      state.symbolFire = savedFire;
      state.fireEvents = savedEvents;
      renderBoard();
    }

    const passed = results.filter(result => result.pass).length;
    if (el.debugSelfTestOutput) {
      el.debugSelfTestOutput.textContent = [
        `${passed}/${results.length} checks passed`,
        ...results.map(result =>
          `${result.pass ? 'PASS' : 'FAIL'} · ${result.name}${result.detail ? ` · ${result.detail}` : ''}`
        )
      ].join('\n');
    }

    recordEvent('self-test', {
      passed,
      total: results.length,
      failures: results.filter(result => !result.pass).map(result => result.name)
    });

    return results;
  }

  function gameModeLabel(mode = state.pendingGameMode) {
    if (mode === 'force3') return 'FORCE 3-ALARM · NEXT SPIN';
    if (mode === 'force4') return 'FORCE 4-ALARM · NEXT SPIN';
    if (mode === 'force5') return 'FORCE 5-ALARM · NEXT SPIN';
    if (mode === 'large') return 'FORCE LARGE OUTCOME · NEXT SPIN';
    return 'NORMAL GAME';
  }

  function updateGameModeStatus() {
    if (el.debugGameMode) el.debugGameMode.textContent = gameModeLabel();
  }

  function setGameMode(mode) {
    if (state.busy) return;
    state.pendingGameMode = ['normal', 'force3', 'force4', 'force5', 'large'].includes(mode)
      ? mode
      : 'normal';

    updateGameModeStatus();
    setMessage(
      gameModeLabel(),
      state.pendingGameMode === 'normal' ? 'REAL RNG · NATURAL TRIGGERS' : 'ONE-SHOT TEST MODE'
    );
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
    updateDebugInspector();
  }

  async function showTransition(title, detail = '', variant = 'fire', holdMs = 760) {
    recordEvent('transition', { title, detail, variant });

    if (!el.transitionOverlay) {
      setMessage(title, detail);
      await sleep(holdMs);
      return;
    }

    el.transitionTitle.textContent = title;
    el.transitionDetail.textContent = detail;
    el.transitionOverlay.dataset.variant = variant;
    el.transitionOverlay.classList.add('show');
    emitAudioHook('transition', { title, variant });

    await sleep(holdMs);
    el.transitionOverlay.classList.remove('show');
    await sleep(120);
  }

  function bigWinTier(totalX) {
    const t = CONFIG.bigWinThresholds;
    if (totalX >= t.inferno) return { key: 'inferno', label: 'INFERNO WIN' };
    if (totalX >= t.mega) return { key: 'mega', label: 'MEGA WIN' };
    if (totalX >= t.super) return { key: 'super', label: 'SUPER WIN' };
    if (totalX >= t.big) return { key: 'big', label: 'BIG WIN' };
    return null;
  }

  async function presentBigWin(totalX) {
    const tier = bigWinTier(totalX);
    if (!tier) return;

    recordEvent('big-win', { tier: tier.key, totalX });
    emitAudioHook('big-win', { tier: tier.key, totalX });
    spawnBoardParticles('ember', Array.from({ length: CONFIG.cells }, (_, index) => index), tier.key === 'inferno' ? 2 : 1);

    if (!el.bigWinOverlay) {
      showBanner(`${tier.label} · ${totalX.toFixed(2)}×`);
      await sleep(900);
      return;
    }

    state.bigWinSkip = false;
    el.bigWinTier.textContent = tier.label;
    el.bigWinAmount.textContent = '0.00×';
    el.bigWinOverlay.dataset.tier = tier.key;
    el.bigWinOverlay.classList.add('show');

    const baseDuration =
      tier.key === 'inferno' ? 2800 :
      tier.key === 'mega' ? 2200 :
      tier.key === 'super' ? 1750 :
      1350;
    const duration = scaledMs(baseDuration);
    const start = performance.now();

    await new Promise(resolve => {
      function frame(now) {
        const elapsed = now - start;
        const progress = state.bigWinSkip
          ? 1
          : clamp(elapsed / Math.max(1, duration), 0, 1);
        const eased = 1 - Math.pow(1 - progress, 3);
        el.bigWinAmount.textContent = `${(totalX * eased).toFixed(2)}×`;

        if (progress >= 1) {
          resolve();
          return;
        }
        requestAnimationFrame(frame);
      }
      requestAnimationFrame(frame);
    });

    el.bigWinAmount.textContent = `${totalX.toFixed(2)}×`;
    await sleep(state.bigWinSkip ? 80 : 520);
    el.bigWinOverlay.classList.remove('show');
    state.bigWinSkip = false;
  }

  function cancelVisualEffects() {
    try {
      el.board?.getAnimations({ subtree: true }).forEach(animation => animation.cancel());
    } catch {}
    clearBoardFx();
    el.board?.classList.remove(
      'backdraft-flash',
      'backdraft-anticipation',
      'spray-active',
      'bonus-anticipation'
    );
    el.transitionOverlay?.classList.remove('show');
    el.bigWinOverlay?.classList.remove('show');
  }

  async function animateWin(result, cascadeNumber) {
    state.currentCascade = cascadeNumber;
    recordEvent('win-detected', {
      cascade: cascadeNumber,
      totalX: result.totalX,
      wins: result.wins.map(win => ({
        symbol: win.symbol,
        count: win.count,
        baseAmountX: win.baseAmountX,
        fireMultiplier: win.fireMultiplier,
        amountX: win.amountX
      }))
    });

    const winning = new Set(result.remove);
    for (const index of winning) {
      el.board.querySelector(`[data-index="${index}"]`)?.classList.add('win');
    }

    const boosted = result.wins.filter(win => win.fireMultiplier > 1);
    const fireDetail = boosted.length
      ? ` · FIRE ${boosted.map(win => `${win.fireMultiplier}×`).join(' + ')}`
      : '';

    setMessage(
      `CASCADE ${cascadeNumber} · ${result.totalX.toFixed(2)}×`,
      `${result.wins.length} CLUSTER${result.wins.length === 1 ? '' : 'S'}${fireDetail}`
    );
    showBanner(`+${result.totalX.toFixed(2)}×`);
    spawnBoardParticles('spark', [...winning], boosted.length ? 3 : 1);
    await sleep(CONFIG.winHoldMs);
    for (const index of winning) {
      el.board.querySelector(`[data-index="${index}"]`)?.classList.add('pop');
    }
    await sleep(CONFIG.winPopMs);
    recordEvent('cascade-remove', {
      cascade: cascadeNumber,
      removed: [...winning]
    });
  }

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, scaledMs(ms)));
  }

  async function playSpinInternal() {
    if (state.busy) return;

    const bet = CONFIG.bets[state.betIndex];
    if (state.balance < bet) {
      setMessage('INSUFFICIENT BALANCE');
      return;
    }

    const spinMode = state.pendingGameMode;
    const explicitForcedTier =
      spinMode === 'force3' ? 3 :
      spinMode === 'force4' ? 4 :
      spinMode === 'force5' || spinMode === 'large' ? 5 :
      0;
    const configuredDebugTier =
      spinMode === 'normal' && CONFIG.debugEnabled
        ? selectConfiguredDebugTier()
        : 0;
    const forcedTier = explicitForcedTier || configuredDebugTier;

    const baseFeature =
      spinMode === 'normal' && forcedTier === 0
        ? selectBaseFireFeature()
        : null;
    const profileName =
      spinMode === 'large' || baseFeature
        ? 'large'
        : 'normal';

    state.baseFireFeature = baseFeature;

    // Forced modes are one-shot. The next spin consumes the request.
    state.pendingGameMode = 'normal';
    state.largeOutcomeActive = profileName === 'large';
    updateGameModeStatus();

    state.busy = true;
    state.spinId += 1;
    state.currentCascade = 0;
    state.currentSpinBaseX = 0;
    state.currentSpinBonusX = 0;
    state.lastError = '';

    recordEvent('spin-start', {
      bet,
      mode: spinMode,
      profileName,
      baseFeature,
      mathProfile: state.mathProfile
    });

    state.balance -= bet;
    state.stats.spins++;
    state.stats.wagered += bet;
    state.lastWinX = 0;
    updateUi();

    setMessage(
      spinMode === 'normal' ? 'RESPONDING…' : gameModeLabel(spinMode),
      spinMode === 'normal' ? 'NEW BOARD' : 'FORCING TRIGGER CONDITION ONLY'
    );

    state.forceAlarmOff = false;
    state.bonusActive = false;
    state.activeBonusType = 0;
    state.freeSpinsRemaining = 0;
    state.freeSpinsTotal = 0;
    state.fireWildCarryover = null;
    state.compressionResultIndex = null;
    resetSymbolFire();

    // Forced modes only control the qualifying Alarm count.
    // Every other symbol still comes from the shared board generator.
    state.board = createInitialBoard({
      forcedBonusCount: forcedTier,
      profileName
    });

    // Anticipation belongs on the actual base-game trigger drop too, not only
    // on cascade refills. The board outcome is already generated; this only
    // changes reveal timing.
    await renderBoardWithGravity(initialGravityPlan(), {
      forceAnticipation: true
    });

    if (baseFeature) {
      await resolveBaseFireTeaser(baseFeature, profileName);
    }

    let totalX = 0;
    let cascadeNumber = 0;

    while (cascadeNumber < CONFIG.maxCascades) {
      const result = evaluateBoard(state.board, state.symbolFire);
      if (!result.wins.length) break;

      cascadeNumber++;
      totalX += result.totalX;
      state.currentSpinBaseX += result.totalX;
      await animateWin(result, cascadeNumber);

      const cascaded = cascadeBoard(
        state.board,
        result.remove,
        state.symbolFire,
        {
          // Preserve the exact forced trigger tier during the qualifying base spin.
          // Normal Game retains natural bonus-symbol generation on cascade refills.
          allowBonus: forcedTier === 0,
          profileName
        }
      );

      state.board = cascaded.board;
      state.symbolFire = cascaded.symbolFire;
      recordEvent('cascade', {
        cascade: cascadeNumber,
        spawned: [...cascaded.spawned]
      });
      await renderBoardWithGravity(cascaded.movements, { isCascade: true });

      if (baseFeature && burningSymbols().length) {
        await resolveSpreadOpportunity(false, profileName);
      }
    }

    const endingBonusCount = state.board.filter(key => key === BONUS_KEY).length;
    const triggeredTier = bonusTierFromAlarmCount(endingBonusCount);

    if (endingBonusCount > 0 && endingBonusCount < 3) {
      state.forceAlarmOff = true;
      state.bonusActive = false;
      renderBoard();
    } else if (triggeredTier) {
      state.forceAlarmOff = false;
      state.bonusActive = true;
      renderBoard();

      const definition = BONUS_TIERS[triggeredTier];
      recordEvent('bonus-trigger', {
        tier: triggeredTier,
        alarms: endingBonusCount,
        freeSpins: definition.freeSpins
      });
      await showTransition(
        `${definition.label} TRIGGERED`,
        `${definition.freeSpins} FREE SPINS`,
        `alarm-${triggeredTier}`,
        CONFIG.bonusTriggerHoldMs
      );

      // Natural, forced-trigger, and large-outcome modes all use this same bonus engine.
      const bonusX = await runFireBonus(triggeredTier, bet, { profileName });
      state.currentSpinBonusX = bonusX;
      totalX += bonusX;
    }

    const creditsWon = totalX * bet;
    state.balance += creditsWon;
    state.stats.won += creditsWon;
    state.lastWinX = totalX;
    state.largeOutcomeActive = false;

    recordEvent('spin-accounted', {
      baseX: state.currentSpinBaseX,
      bonusX: state.currentSpinBonusX,
      totalX,
      creditsWon,
      balance: state.balance
    });

    await presentBigWin(totalX);

    setMessage(
      totalX > 0 ? `TOTAL WIN ${totalX.toFixed(2)}×` : 'NO WIN',
      triggeredTier
        ? `${BONUS_TIERS[triggeredTier].label} COMPLETE`
        : cascadeNumber
          ? `${cascadeNumber} CASCADE${cascadeNumber === 1 ? '' : 'S'}`
          : 'READY'
    );

    recordEvent('spin-complete', {
      totalX,
      balance: state.balance,
      cascadeCount: cascadeNumber,
      triggeredTier
    });

    state.busy = false;
    updateUi();
  }

  async function playSpin() {
    if (state.busy) return;

    try {
      await playSpinInternal();
    } catch (error) {
      state.lastError = error instanceof Error ? error.message : String(error);
      recordEvent('runtime-error', {
        message: state.lastError,
        stack: error instanceof Error ? error.stack : ''
      });
      cancelVisualEffects();
      setMessage('GAME RECOVERED FROM ERROR', state.lastError.slice(0, 90));
      state.largeOutcomeActive = false;
      state.busy = false;
      updateUi();
    }
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
    updateDebugInspector();
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
    el.simulationOutput.textContent = `Running ${spins.toLocaleString()} BASE-GAME-ONLY spins…`;
    const savedSeedState = state.seedState;
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
    state.seedState = savedSeedState;
    el.simulationOutput.innerHTML = `Base-only sample RTP <strong>${observed.toFixed(2)}%</strong> · Hit rate <strong>${(100 * hits / spins).toFixed(1)}%</strong> · Avg cascades <strong>${(cascades / spins).toFixed(2)}</strong> · Max sample win <strong>${max.toFixed(2)}×</strong><br><small>Bonuses, base-fire teasers, and Fire Wild mechanics are NOT included in this browser sample. Do not treat this as full-game theoretical RTP.</small>`;
    el.simulateBtn.disabled = false;
    recordEvent('base-simulation', { spins, observedRtp: observed, hits, cascades, max });
  }

  el.spin.addEventListener('click', playSpin);
  el.betDown.addEventListener('click', () => {
    if (!state.busy && state.betIndex > 0) {
      state.betIndex--;
      updateUi();
      recordEvent('bet-change', { bet: CONFIG.bets[state.betIndex] });
    }
  });
  el.betUp.addEventListener('click', () => {
    if (!state.busy && state.betIndex < CONFIG.bets.length - 1) {
      state.betIndex++;
      updateUi();
      recordEvent('bet-change', { bet: CONFIG.bets[state.betIndex] });
    }
  });
  el.paytableBtn.addEventListener('click', () => el.paytableDialog.showModal());
  el.paytableClose.addEventListener('click', () => el.paytableDialog.close());
  el.mathBtn.addEventListener('click', () => el.mathDialog.showModal());
  el.mathClose.addEventListener('click', () => el.mathDialog.close());
  el.simulateBtn.addEventListener('click', runSimulation);

  if (!CONFIG.debugEnabled) {
    el.debugBtn?.remove();
    el.debugDialog?.remove();
  } else {
    el.debugBtn?.addEventListener('click', () => {
      updateGameModeStatus();
      renderDebugSymbolWeights();
      updateDebugInspector();
      el.debugDialog?.showModal();
    });
    el.debugClose?.addEventListener('click', () => el.debugDialog?.close());

    document.querySelectorAll('[data-game-mode]').forEach(button => {
      button.addEventListener('click', () => setGameMode(button.dataset.gameMode));
    });

    document.querySelectorAll('[data-debug-action]').forEach(button => {
      button.addEventListener('click', () => runDebugAction(button.dataset.debugAction));
    });

    document.querySelectorAll('[data-animation-speed]').forEach(button => {
      button.addEventListener('click', () => {
        setAnimationSpeed(Number(button.dataset.animationSpeed));
      });
    });

    document.getElementById('debugApplyMath')?.addEventListener('click', applyDebugMathControls);
    document.getElementById('debugResetMath')?.addEventListener('click', resetDebugMathControls);
    document.getElementById('debugSelfTest')?.addEventListener('click', runSelfTests);
  }

  el.bigWinOverlay?.addEventListener('click', () => {
    state.bigWinSkip = true;
  });

  renderPaytable();
  state.board = createInitialBoard();
  state.symbolFire = createSymbolFireState();
  updateGameModeStatus();
  renderDebugSymbolWeights();
  setAnimationSpeed(1);
  renderBoard();
  updateUi();
  updateDebugInspector();
})();
