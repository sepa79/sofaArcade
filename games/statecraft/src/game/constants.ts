import type { BudgetState } from './types';

export const WORLD_WIDTH = 1440;
export const WORLD_HEIGHT = 900;
export const MAP_ORIGIN_X = 320;
export const MAP_ORIGIN_Y = 118;
export const TILE_WIDTH = 142;
export const TILE_HEIGHT = 102;
export const TILE_GAP = 14;
export const MAP_COLS = 5;
export const MAP_ROWS = 3;
export const MAX_EVENT_FEED = 8;
export const WEEK_DURATION_SECONDS = 4;
export const WEEKS_PER_MONTH = 4;
export const MONTHS_PER_YEAR = 12;
export const ELECTION_INTERVAL_MONTHS = 24;
export const SUPPORT_MIN = 1;
export const SUPPORT_MAX = 98;
export const TILE_COUNT = MAP_COLS * MAP_ROWS;

export const DEFAULT_BUDGET: BudgetState = {
  foodPct: 30,
  healthPct: 25,
  oilPct: 30,
  securityPct: 15
};

export const STARTING_TREASURY = 10_000;
export const STARTING_CURRENCY_INDEX = 100;
export const STARTING_FOOD_SUPPLY = 50;
export const STARTING_FOOD_DEMAND = 55;
export const STARTING_DISEASE_RISK = 20;
export const STARTING_OIL_OUTPUT = 18;
export const STARTING_OIL_CAPACITY = 20;
export const STARTING_GOLD_PRICE = 50;
export const STARTING_REQUIRED_GOLD = 10;
export const STARTING_SUPPORT_YOURS = 50;
export const STARTING_SUPPORT_MODERATES = 25;
export const STARTING_SUPPORT_EXTREMISTS = 25;
export const STARTING_ELECTION_COUNTDOWN = ELECTION_INTERVAL_MONTHS;
export const STARTING_RIGS = 1;
export const STARTING_DAMAGED_RIGS = 0;
export const STARTING_SECURITY_UNITS = 0;

export const SURVEY_COST = 30;
export const BUILD_RIG_COST = 120;
export const REPAIR_RIG_COST = 80;
export const IMPORT_UNIT_COST = 150;
export const SPOT_SALE_UNITS = 4;
export const GOLD_ACTION_BARS = 1;

export const CONTRACT_DURATION_MIN = 3;
export const CONTRACT_DURATION_MAX = 6;
export const CONTRACT_VALUE_MIN = 120;
export const CONTRACT_VALUE_MAX = 260;
export const CONTRACT_OIL_COMMITMENT = 4;
export const MAX_ACTIVE_CONTRACTS = 3;
