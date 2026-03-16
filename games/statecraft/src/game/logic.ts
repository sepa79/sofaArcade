import {
  BUILD_RIG_COST,
  CONTRACT_DURATION_MAX,
  CONTRACT_DURATION_MIN,
  CONTRACT_OIL_COMMITMENT,
  CONTRACT_VALUE_MAX,
  CONTRACT_VALUE_MIN,
  ELECTION_INTERVAL_MONTHS,
  GOLD_ACTION_BARS,
  IMPORT_UNIT_COST,
  MAX_ACTIVE_CONTRACTS,
  MAX_EVENT_FEED,
  MONTHS_PER_YEAR,
  REPAIR_RIG_COST,
  SPOT_SALE_UNITS,
  SUPPORT_MAX,
  SUPPORT_MIN,
  SURVEY_COST,
  WEEK_DURATION_SECONDS,
  WEEKS_PER_MONTH
} from './constants';
import type {
  BudgetKey,
  BudgetState,
  ContractState,
  EventEntry,
  GameAction,
  GameState,
  RandomSource,
  TileState
} from './types';

const BUDGET_KEYS: readonly BudgetKey[] = ['foodPct', 'healthPct', 'oilPct', 'securityPct'];

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function roundToInt(value: number): number {
  return Math.round(value);
}

function requireBudgetAllocation(allocations: ReadonlyMap<BudgetKey, number>, key: BudgetKey): number {
  const allocation = allocations.get(key);
  if (allocation === undefined) {
    throw new Error(`Missing budget allocation for ${key}.`);
  }

  return allocation;
}

function pushEvent(state: GameState, text: string): GameState {
  const entry: EventEntry = {
    id: state.nextEventId,
    text
  };

  return {
    ...state,
    events: [entry, ...state.events].slice(0, MAX_EVENT_FEED),
    nextEventId: state.nextEventId + 1
  };
}

function normalizeSupport(state: GameState): GameState {
  const yourBloc = clamp(state.politics.yourBloc, SUPPORT_MIN, SUPPORT_MAX);
  const remaining = 100 - yourBloc;
  const moderatedSeed = clamp(state.politics.moderates, SUPPORT_MIN, remaining - SUPPORT_MIN);
  const extremists = clamp(remaining - moderatedSeed, SUPPORT_MIN, SUPPORT_MAX);
  const moderates = remaining - extremists;

  return {
    ...state,
    politics: {
      ...state.politics,
      yourBloc,
      moderates,
      extremists
    }
  };
}

function shiftSupport(state: GameState, delta: number): GameState {
  if (delta === 0) {
    return state;
  }

  const nextYour = clamp(state.politics.yourBloc + delta, SUPPORT_MIN, SUPPORT_MAX);
  const appliedDelta = nextYour - state.politics.yourBloc;
  const moderates = state.politics.moderates - appliedDelta / 2;
  const extremists = state.politics.extremists - appliedDelta / 2;

  return normalizeSupport({
    ...state,
    politics: {
      ...state.politics,
      yourBloc: nextYour,
      moderates,
      extremists
    }
  });
}

function rebalanceBudget(current: BudgetState, changedKey: BudgetKey, nextValue: number): BudgetState {
  const clampedValue = clamp(roundToInt(nextValue), 0, 100);
  const otherKeys = BUDGET_KEYS.filter((key) => key !== changedKey);
  const remaining = 100 - clampedValue;

  if (remaining === 0) {
    return {
      foodPct: changedKey === 'foodPct' ? clampedValue : 0,
      healthPct: changedKey === 'healthPct' ? clampedValue : 0,
      oilPct: changedKey === 'oilPct' ? clampedValue : 0,
      securityPct: changedKey === 'securityPct' ? clampedValue : 0
    };
  }

  const otherSum = otherKeys.reduce((sum, key) => sum + current[key], 0);
  const allocations =
    otherSum === 0
      ? otherKeys.map((key, index) => ({
          key,
          raw: remaining / otherKeys.length,
          floor: Math.floor(remaining / otherKeys.length),
          fraction: index === 0 ? 1 : 0
        }))
      : otherKeys.map((key) => {
          const raw = (current[key] / otherSum) * remaining;
          return {
            key,
            raw,
            floor: Math.floor(raw),
            fraction: raw - Math.floor(raw)
          };
        });

  const used = allocations.reduce((sum, allocation) => sum + allocation.floor, 0);
  let remainder = remaining - used;
  const sorted = [...allocations].sort((left, right) => right.fraction - left.fraction);
  const finalMap = new Map<BudgetKey, number>();

  for (const allocation of sorted) {
    const bonus = remainder > 0 ? 1 : 0;
    finalMap.set(allocation.key, allocation.floor + bonus);
    remainder -= bonus;
  }

  return {
    foodPct: changedKey === 'foodPct' ? clampedValue : requireBudgetAllocation(finalMap, 'foodPct'),
    healthPct: changedKey === 'healthPct' ? clampedValue : requireBudgetAllocation(finalMap, 'healthPct'),
    oilPct: changedKey === 'oilPct' ? clampedValue : requireBudgetAllocation(finalMap, 'oilPct'),
    securityPct: changedKey === 'securityPct' ? clampedValue : requireBudgetAllocation(finalMap, 'securityPct')
  };
}

function requireSelectedTile(state: GameState): TileState {
  if (state.map.selectedTileId === null) {
    throw new Error('Tile action requires a selected tile.');
  }

  const tile = state.map.tiles.find((candidate) => candidate.id === state.map.selectedTileId);
  if (tile === undefined) {
    throw new Error(`Selected tile ${state.map.selectedTileId} not found.`);
  }

  return tile;
}

function updateTile(state: GameState, tileId: number, updater: (tile: TileState) => TileState): ReadonlyArray<TileState> {
  return state.map.tiles.map((tile) => (tile.id === tileId ? updater(tile) : tile));
}

function randomInt(random: RandomSource, min: number, max: number): number {
  return Math.floor(random.next() * (max - min + 1)) + min;
}

function applySurvey(state: GameState): GameState {
  const tile = requireSelectedTile(state);
  if (tile.surveyed) {
    throw new Error(`Tile ${tile.id} has already been surveyed.`);
  }

  return pushEvent(
    {
      ...state,
      economy: {
        ...state.economy,
        treasury: state.economy.treasury - SURVEY_COST
      },
      map: {
        ...state.map,
        tiles: updateTile(state, tile.id, (candidate) => ({
          ...candidate,
          surveyed: true
        }))
      }
    },
    `Survey completed in sector ${tile.id + 1}.`
  );
}

function applyBuildRig(state: GameState): GameState {
  const tile = requireSelectedTile(state);
  if (!tile.surveyed) {
    throw new Error(`Tile ${tile.id} must be surveyed before building.`);
  }

  if (tile.rigLevel > 0) {
    throw new Error(`Tile ${tile.id} already has a rig.`);
  }

  return pushEvent(
    {
      ...state,
      economy: {
        ...state.economy,
        treasury: state.economy.treasury - BUILD_RIG_COST
      },
      resources: {
        ...state.resources,
        oilCapacity: state.resources.oilCapacity + roundToInt(tile.richness * 8)
      },
      map: {
        ...state.map,
        tiles: updateTile(state, tile.id, (candidate) => ({
          ...candidate,
          rigLevel: 1
        })),
        rigs: state.map.rigs + 1
      }
    },
    `Rig commissioned in sector ${tile.id + 1}.`
  );
}

function applyRepairRig(state: GameState): GameState {
  const tile = requireSelectedTile(state);
  if (!tile.damaged) {
    throw new Error(`Tile ${tile.id} has no damaged rig to repair.`);
  }

  return pushEvent(
    {
      ...state,
      economy: {
        ...state.economy,
        treasury: state.economy.treasury - REPAIR_RIG_COST
      },
      map: {
        ...state.map,
        tiles: updateTile(state, tile.id, (candidate) => ({
          ...candidate,
          damaged: false
        })),
        damagedRigs: Math.max(0, state.map.damagedRigs - 1)
      }
    },
    `Repair crew restored output in sector ${tile.id + 1}.`
  );
}

function applyImportUnit(state: GameState): GameState {
  return pushEvent(
    shiftSupport(
      {
        ...state,
        economy: {
          ...state.economy,
          treasury: state.economy.treasury - IMPORT_UNIT_COST
        },
        map: {
          ...state.map,
          securityUnits: state.map.securityUnits + 1
        }
      },
      -1
    ),
    'Security unit imported.'
  );
}

function applySignContract(state: GameState, random: RandomSource): GameState {
  if (state.markets.activeContracts.length >= MAX_ACTIVE_CONTRACTS) {
    throw new Error('Contract limit reached.');
  }

  const duration = randomInt(random, CONTRACT_DURATION_MIN, CONTRACT_DURATION_MAX);
  const value = randomInt(random, CONTRACT_VALUE_MIN, CONTRACT_VALUE_MAX);
  const contract: ContractState = {
    id: state.markets.nextContractId,
    monthsRemaining: duration,
    monthlyValue: value,
    oilCommitment: CONTRACT_OIL_COMMITMENT
  };

  return pushEvent(
    {
      ...state,
      markets: {
        ...state.markets,
        nextContractId: state.markets.nextContractId + 1,
        activeContracts: [...state.markets.activeContracts, contract]
      }
    },
    `Signed contract worth ${value} for ${duration} months.`
  );
}

function applySellSpot(state: GameState): GameState {
  return pushEvent(
    {
      ...state,
      markets: {
        ...state.markets,
        queuedSpotSaleUnits: state.markets.queuedSpotSaleUnits + SPOT_SALE_UNITS
      }
    },
    'Spot market cargo queued.'
  );
}

function applyBuyGold(state: GameState): GameState {
  return pushEvent(
    {
      ...state,
      markets: {
        ...state.markets,
        queuedGoldBuyBars: state.markets.queuedGoldBuyBars + GOLD_ACTION_BARS
      }
    },
    'Gold purchase queued.'
  );
}

function applySellGold(state: GameState): GameState {
  const queued = Math.min(
    state.resources.goldBars,
    state.markets.queuedGoldSellBars + GOLD_ACTION_BARS
  );

  return pushEvent(
    {
      ...state,
      markets: {
        ...state.markets,
        queuedGoldSellBars: queued
      }
    },
    'Gold sale queued.'
  );
}

function weeklyBudgetEffects(state: GameState): GameState {
  const foodImportPerWeek = state.budget.foodPct * 0.08;
  const healthReductionPerWeek = state.budget.healthPct * 0.03;
  const oilBoostPerWeek = state.budget.oilPct * 0.04;
  const activeRigs = Math.max(0, state.map.rigs - state.map.damagedRigs);
  const oilOutput = Math.min(state.resources.oilCapacity, activeRigs * (8 + oilBoostPerWeek));

  return {
    ...state,
    resources: {
      ...state.resources,
      foodSupply: clamp(
        state.resources.foodSupply + foodImportPerWeek - state.resources.foodDemand * 0.25,
        0,
        200
      ),
      diseaseRisk: state.resources.diseaseRisk - healthReductionPerWeek,
      oilOutput
    }
  };
}

function weeklyDiseaseAndSupport(state: GameState): GameState {
  const foodGap = state.resources.foodSupply - state.resources.foodDemand;
  let diseaseRisk = state.resources.diseaseRisk + 0.6;
  if (foodGap < 0) {
    diseaseRisk += Math.abs(foodGap) * 0.08;
  }
  if (foodGap > 10) {
    diseaseRisk -= 0.25;
  }

  diseaseRisk = clamp(diseaseRisk, 0, 100);

  let supportDelta = 0;
  if (foodGap < -10) {
    supportDelta -= 2;
  } else if (foodGap < 0) {
    supportDelta -= 1;
  } else if (foodGap > 10) {
    supportDelta += 0.5;
  }

  if (diseaseRisk > 70) {
    supportDelta -= 2;
  } else if (diseaseRisk > 40) {
    supportDelta -= 1;
  } else if (diseaseRisk < 20) {
    supportDelta += 0.5;
  }

  if (state.budget.securityPct > 40) {
    supportDelta -= 0.5;
  }

  return shiftSupport(
    {
      ...state,
      resources: {
        ...state.resources,
        diseaseRisk
      }
    },
    supportDelta
  );
}

function weeklyCosts(state: GameState): GameState {
  const weeklyPolicyCost =
    state.budget.foodPct * 0.8 +
    state.budget.healthPct * 0.7 +
    state.budget.oilPct * 0.6 +
    state.budget.securityPct * 0.9;
  const weeklyUnitCost = state.map.securityUnits * 6;
  const weeklyRigCost = state.map.rigs * 4;

  return {
    ...state,
    economy: {
      ...state.economy,
      treasury: state.economy.treasury - weeklyPolicyCost - weeklyUnitCost - weeklyRigCost
    }
  };
}

function checkImmediateFailure(state: GameState): GameState {
  if (state.resources.diseaseRisk < 100) {
    return state;
  }

  return pushEvent(
    {
      ...state,
      run: {
        gameOver: true,
        cause: 'disease'
      },
      time: {
        ...state.time,
        paused: true
      }
    },
    'Disease collapse overwhelmed the cabinet.'
  );
}

function settleContracts(state: GameState): GameState {
  const contractsIncome = state.markets.activeContracts.reduce((sum, contract) => sum + contract.monthlyValue, 0);
  const activeContracts = state.markets.activeContracts
    .map((contract) => ({
      ...contract,
      monthsRemaining: contract.monthsRemaining - 1
    }))
    .filter((contract) => contract.monthsRemaining > 0);

  return {
    ...state,
    markets: {
      ...state.markets,
      activeContracts,
      contractsIncome
    },
    economy: {
      ...state.economy,
      monthlyIncome: state.economy.monthlyIncome + contractsIncome
    }
  };
}

function settleSpotMarket(state: GameState): GameState {
  const committedOil = state.markets.activeContracts.reduce((sum, contract) => sum + contract.oilCommitment, 0);
  const spotCapacity = Math.max(0, Math.floor(state.resources.oilOutput - committedOil));
  const soldUnits = Math.min(state.markets.queuedSpotSaleUnits, spotCapacity);
  const spotPrice = 18 + Math.floor(state.resources.oilOutput * 0.3);
  const spotIncome = soldUnits * spotPrice;

  return {
    ...state,
    markets: {
      ...state.markets,
      queuedSpotSaleUnits: 0,
      spotIncome
    },
    economy: {
      ...state.economy,
      monthlyIncome: state.economy.monthlyIncome + spotIncome
    }
  };
}

function settleGold(state: GameState): GameState {
  const buyBars = state.markets.queuedGoldBuyBars;
  const sellBars = Math.min(state.resources.goldBars, state.markets.queuedGoldSellBars);
  const goldPurchaseCost = buyBars * state.resources.goldPrice;
  const goldSalesIncome = sellBars * state.resources.goldPrice;

  let goldBars = state.resources.goldBars;
  let goldAvgCost = state.resources.goldAvgCost;
  if (buyBars > 0) {
    const newBars = goldBars + buyBars;
    const weighted =
      goldBars * goldAvgCost + buyBars * state.resources.goldPrice;
    goldBars = newBars;
    goldAvgCost = weighted / newBars;
  }
  goldBars = Math.max(0, goldBars - sellBars);

  return {
    ...state,
    resources: {
      ...state.resources,
      goldBars,
      goldAvgCost
    },
    markets: {
      ...state.markets,
      queuedGoldBuyBars: 0,
      queuedGoldSellBars: 0,
      goldPurchaseCost,
      goldSalesIncome
    },
    economy: {
      ...state.economy,
      monthlyIncome: state.economy.monthlyIncome + goldSalesIncome,
      monthlyExpense: state.economy.monthlyExpense + goldPurchaseCost
    }
  };
}

function settleImportsAndHealth(state: GameState): GameState {
  const importCost =
    Math.max(0, state.resources.foodDemand - state.resources.foodSupply) * 2 +
    Math.max(0, 25 - state.budget.foodPct) * 1.5;
  const healthCost = 20 + state.budget.healthPct * 1.2;

  return {
    ...state,
    markets: {
      ...state.markets,
      importCost,
      healthCost
    },
    economy: {
      ...state.economy,
      monthlyExpense: state.economy.monthlyExpense + importCost + healthCost
    }
  };
}

function finalizeMonthlyEconomy(state: GameState): GameState {
  const monthlyNet = state.economy.monthlyIncome - state.economy.monthlyExpense;
  let nextState: GameState = {
    ...state,
    economy: {
      ...state.economy,
      previousTreasury: state.economy.treasury,
      monthlyNet,
      treasury: state.economy.treasury + monthlyNet,
      totalBalance: state.economy.totalBalance + monthlyNet
    }
  };

  if (nextState.economy.treasury >= 0) {
    return nextState;
  }

  const shortfall = Math.abs(nextState.economy.treasury);
  const reserveValue = nextState.resources.goldBars * nextState.resources.goldPrice;
  if (reserveValue < shortfall) {
    return pushEvent(
      {
        ...nextState,
        run: {
          gameOver: true,
          cause: 'bankruptcy'
        },
        time: {
          ...nextState.time,
          paused: true
        }
      },
      'Treasury collapsed. Cabinet removed for insolvency.'
    );
  }

  const barsSpent = Math.ceil(shortfall / nextState.resources.goldPrice);
  nextState = shiftSupport(
    {
      ...nextState,
      resources: {
        ...nextState.resources,
        goldBars: Math.max(0, nextState.resources.goldBars - barsSpent)
      },
      economy: {
        ...nextState.economy,
        treasury: nextState.economy.treasury + barsSpent * nextState.resources.goldPrice,
        currencyIndex: nextState.economy.currencyIndex + 3
      }
    },
    -4
  );

  return pushEvent(nextState, 'Gold reserves spent. Currency devalued.');
}

function updateScore(state: GameState): GameState {
  const monthlyScoreDelta =
    state.politics.yourBloc * 0.8 +
    clamp(state.economy.treasury / 100, 0, 100) * 0.5 +
    clamp(state.economy.monthlyNet / 20, -20, 20) +
    clamp(state.resources.oilOutput, 0, 40) * 0.6 -
    clamp(state.resources.diseaseRisk / 5, 0, 20);

  const scoreAccumulator = state.score.scoreAccumulator + monthlyScoreDelta;
  const totalBalanceAccumulator = state.score.totalBalanceAccumulator + state.economy.monthlyNet;
  const currentScore = Math.floor(scoreAccumulator);
  const divisor = Math.max(1, state.time.totalMonths + 1);
  const averageScore = scoreAccumulator / divisor;
  const finalRankBand =
    averageScore < 20 ? 0 : averageScore < 40 ? 1 : averageScore < 60 ? 2 : 3;

  return {
    ...state,
    score: {
      currentScore,
      scoreAccumulator,
      totalBalanceAccumulator,
      finalRankBand
    }
  };
}

function runElection(state: GameState): GameState {
  const electionStrength =
    state.politics.yourBloc +
    clamp(state.economy.monthlyNet / 50, -10, 10) +
    clamp((100 - state.resources.diseaseRisk) / 10, 0, 10);

  if (electionStrength >= 50) {
    return pushEvent(state, 'Election won. New mandate secured.');
  }

  return pushEvent(
    {
      ...state,
      run: {
        gameOver: true,
        cause: 'election'
      },
      time: {
        ...state.time,
        paused: true
      }
    },
    'Election lost. Cabinet forced out.'
  );
}

function advanceCalendar(state: GameState): GameState {
  const totalMonths = state.time.totalMonths + 1;
  const nextMonth = state.time.month === MONTHS_PER_YEAR ? 1 : state.time.month + 1;
  const nextYear = state.time.month === MONTHS_PER_YEAR ? state.time.year + 1 : state.time.year;
  let electionCountdownMonths = state.politics.electionCountdownMonths - 1;
  let electionPending = false;
  let nextState: GameState = {
    ...state,
    time: {
      ...state.time,
      week: 1,
      month: nextMonth,
      year: nextYear,
      totalMonths
    },
    politics: {
      ...state.politics,
      electionCountdownMonths,
      electionPending
    }
  };

  if (electionCountdownMonths <= 0) {
    electionPending = true;
    nextState = {
      ...nextState,
      politics: {
        ...nextState.politics,
        electionPending
      }
    };
    nextState = runElection(nextState);
    electionCountdownMonths = ELECTION_INTERVAL_MONTHS;
    nextState = {
      ...nextState,
      politics: {
        ...nextState.politics,
        electionCountdownMonths,
        electionPending: false
      }
    };
  }

  return nextState;
}

function checkPopularityFailure(state: GameState): GameState {
  if (state.politics.yourBloc >= 10 || state.run.gameOver) {
    return state;
  }

  return pushEvent(
    {
      ...state,
      run: {
        gameOver: true,
        cause: 'support'
      },
      time: {
        ...state.time,
        paused: true
      }
    },
    'Your people turned against you.'
  );
}

function maybeTriggerMonthlyEvent(state: GameState, random: RandomSource): GameState {
  if (state.run.gameOver) {
    return state;
  }

  if (random.next() >= 0.12 || state.map.rigs <= 0) {
    return state;
  }

  const rigTiles = state.map.tiles.filter((tile) => tile.rigLevel > 0 && !tile.damaged);
  if (rigTiles.length === 0) {
    return state;
  }

  const chosenTile = rigTiles[randomInt(random, 0, rigTiles.length - 1)];
  return pushEvent(
    shiftSupport(
      {
        ...state,
        map: {
          ...state.map,
          tiles: updateTile(state, chosenTile.id, (tile) => ({
            ...tile,
            damaged: true
          })),
          damagedRigs: state.map.damagedRigs + 1
        }
      },
      -2
    ),
    `Earthquake damaged rig ${chosenTile.id + 1}.`
  );
}

function clearMonthlyBuckets(state: GameState): GameState {
  return {
    ...state,
    economy: {
      ...state.economy,
      monthlyIncome: 0,
      monthlyExpense: 0,
      monthlyNet: state.economy.monthlyNet
    },
    markets: {
      ...state.markets,
      contractsIncome: 0,
      spotIncome: 0,
      goldSalesIncome: 0,
      importCost: 0,
      healthCost: 0,
      goldPurchaseCost: 0
    }
  };
}

function advanceWeek(state: GameState, random: RandomSource): GameState {
  let nextState = weeklyBudgetEffects(state);
  nextState = weeklyDiseaseAndSupport(nextState);
  nextState = weeklyCosts(nextState);
  nextState = checkImmediateFailure(nextState);
  if (nextState.run.gameOver) {
    return nextState;
  }

  const nextWeek = nextState.time.week + 1;
  if (nextWeek <= WEEKS_PER_MONTH) {
    return {
      ...nextState,
      time: {
        ...nextState.time,
        week: nextWeek
      }
    };
  }

  nextState = settleContracts(nextState);
  nextState = settleSpotMarket(nextState);
  nextState = settleGold(nextState);
  nextState = settleImportsAndHealth(nextState);
  nextState = finalizeMonthlyEconomy(nextState);
  nextState = updateScore(nextState);
  nextState = advanceCalendar(nextState);
  nextState = checkPopularityFailure(nextState);
  nextState = maybeTriggerMonthlyEvent(nextState, random);
  nextState = clearMonthlyBuckets(nextState);
  return nextState;
}

export function advanceTime(state: GameState, deltaSeconds: number, random: RandomSource): GameState {
  if (state.run.gameOver || state.time.paused || state.time.speed === 0) {
    return state;
  }

  let nextState: GameState = {
    ...state,
    time: {
      ...state.time,
      weekAccumulatorSeconds: state.time.weekAccumulatorSeconds + deltaSeconds * state.time.speed
    }
  };

  while (nextState.time.weekAccumulatorSeconds >= WEEK_DURATION_SECONDS && !nextState.run.gameOver) {
    nextState = {
      ...nextState,
      time: {
        ...nextState.time,
        weekAccumulatorSeconds: nextState.time.weekAccumulatorSeconds - WEEK_DURATION_SECONDS
      }
    };
    nextState = advanceWeek(nextState, random);
  }

  return nextState;
}

export function applyAction(state: GameState, action: GameAction, random: RandomSource): GameState {
  switch (action.type) {
    case 'select_tile':
      return {
        ...state,
        map: {
          ...state.map,
          selectedTileId: action.tileId
        }
      };
    case 'survey_tile':
      return applySurvey(state);
    case 'build_rig':
      return applyBuildRig(state);
    case 'repair_rig':
      return applyRepairRig(state);
    case 'import_unit':
      return applyImportUnit(state);
    case 'sign_contract':
      return applySignContract(state, random);
    case 'sell_spot':
      return applySellSpot(state);
    case 'buy_gold':
      return applyBuyGold(state);
    case 'sell_gold':
      return applySellGold(state);
    case 'toggle_pause':
      return {
        ...state,
        time: {
          ...state.time,
          paused: !state.time.paused
        }
      };
    case 'set_speed':
      return {
        ...state,
        time: {
          ...state.time,
          speed: action.speed,
          paused: action.speed === 0 ? true : false
        }
      };
  }
}

export function updateBudget(state: GameState, key: BudgetKey, nextValue: number): GameState {
  return {
    ...state,
    budget: rebalanceBudget(state.budget, key, nextValue)
  };
}

export function createMathRandomSource(): RandomSource {
  return {
    next() {
      return Math.random();
    }
  };
}
