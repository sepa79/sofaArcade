import {
  DEFAULT_BUDGET,
  MAP_COLS,
  MAP_ROWS,
  MAX_EVENT_FEED,
  STARTING_CURRENCY_INDEX,
  STARTING_DAMAGED_RIGS,
  STARTING_DISEASE_RISK,
  STARTING_ELECTION_COUNTDOWN,
  STARTING_FOOD_DEMAND,
  STARTING_FOOD_SUPPLY,
  STARTING_GOLD_PRICE,
  STARTING_OIL_CAPACITY,
  STARTING_OIL_OUTPUT,
  STARTING_REQUIRED_GOLD,
  STARTING_RIGS,
  STARTING_SECURITY_UNITS,
  STARTING_SUPPORT_EXTREMISTS,
  STARTING_SUPPORT_MODERATES,
  STARTING_SUPPORT_YOURS,
  STARTING_TREASURY
} from './constants';
import type { EventEntry, GameState, TileState } from './types';

function createTiles(): ReadonlyArray<TileState> {
  const tiles: TileState[] = [];
  for (let row = 0; row < MAP_ROWS; row += 1) {
    for (let col = 0; col < MAP_COLS; col += 1) {
      const id = row * MAP_COLS + col;
      const richness = 0.65 + ((row + 1) * (col + 2)) / 20;
      tiles.push({
        id,
        col,
        row,
        richness,
        surveyed: id === 7,
        rigLevel: id === 7 ? 1 : 0,
        damaged: false
      });
    }
  }

  return tiles;
}

function createEventSeed(): ReadonlyArray<EventEntry> {
  const firstEvent: EventEntry = {
    id: 1,
    text: 'Cabinet sworn in. Elections in 24 months.'
  };

  return [firstEvent].slice(0, MAX_EVENT_FEED);
}

export function createInitialState(): GameState {
  return {
    time: {
      week: 1,
      month: 1,
      year: 1,
      totalMonths: 0,
      weekAccumulatorSeconds: 0,
      speed: 1,
      paused: false
    },
    budget: DEFAULT_BUDGET,
    economy: {
      treasury: STARTING_TREASURY,
      previousTreasury: STARTING_TREASURY,
      monthlyIncome: 0,
      monthlyExpense: 0,
      monthlyNet: 0,
      totalBalance: 0,
      currencyIndex: STARTING_CURRENCY_INDEX
    },
    resources: {
      foodSupply: STARTING_FOOD_SUPPLY,
      foodDemand: STARTING_FOOD_DEMAND,
      diseaseRisk: STARTING_DISEASE_RISK,
      oilOutput: STARTING_OIL_OUTPUT,
      oilCapacity: STARTING_OIL_CAPACITY,
      goldBars: 0,
      goldAvgCost: 0,
      goldPrice: STARTING_GOLD_PRICE,
      requiredGold: STARTING_REQUIRED_GOLD
    },
    politics: {
      yourBloc: STARTING_SUPPORT_YOURS,
      moderates: STARTING_SUPPORT_MODERATES,
      extremists: STARTING_SUPPORT_EXTREMISTS,
      electionCountdownMonths: STARTING_ELECTION_COUNTDOWN,
      electionPending: false
    },
    map: {
      selectedTileId: 7,
      tiles: createTiles(),
      rigs: STARTING_RIGS,
      damagedRigs: STARTING_DAMAGED_RIGS,
      securityUnits: STARTING_SECURITY_UNITS
    },
    markets: {
      activeContracts: [],
      nextContractId: 1,
      contractsIncome: 0,
      spotIncome: 0,
      goldSalesIncome: 0,
      importCost: 0,
      healthCost: 0,
      goldPurchaseCost: 0,
      queuedSpotSaleUnits: 0,
      queuedGoldBuyBars: 0,
      queuedGoldSellBars: 0
    },
    score: {
      currentScore: 0,
      scoreAccumulator: 0,
      totalBalanceAccumulator: 0,
      finalRankBand: 0
    },
    run: {
      gameOver: false,
      cause: null
    },
    events: createEventSeed(),
    nextEventId: 2
  };
}
