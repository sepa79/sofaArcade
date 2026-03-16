export type SpeedSetting = 0 | 1 | 2 | 4;
export type RunCause = 'bankruptcy' | 'election' | 'support' | 'disease' | null;
export type BudgetKey = 'foodPct' | 'healthPct' | 'oilPct' | 'securityPct';

export interface BudgetState {
  readonly foodPct: number;
  readonly healthPct: number;
  readonly oilPct: number;
  readonly securityPct: number;
}

export interface EconomyState {
  readonly treasury: number;
  readonly previousTreasury: number;
  readonly monthlyIncome: number;
  readonly monthlyExpense: number;
  readonly monthlyNet: number;
  readonly totalBalance: number;
  readonly currencyIndex: number;
}

export interface ResourcesState {
  readonly foodSupply: number;
  readonly foodDemand: number;
  readonly diseaseRisk: number;
  readonly oilOutput: number;
  readonly oilCapacity: number;
  readonly goldBars: number;
  readonly goldAvgCost: number;
  readonly goldPrice: number;
  readonly requiredGold: number;
}

export interface PoliticsState {
  readonly yourBloc: number;
  readonly moderates: number;
  readonly extremists: number;
  readonly electionCountdownMonths: number;
  readonly electionPending: boolean;
}

export interface TileState {
  readonly id: number;
  readonly col: number;
  readonly row: number;
  readonly richness: number;
  readonly surveyed: boolean;
  readonly rigLevel: number;
  readonly damaged: boolean;
}

export interface MapState {
  readonly selectedTileId: number | null;
  readonly tiles: ReadonlyArray<TileState>;
  readonly rigs: number;
  readonly damagedRigs: number;
  readonly securityUnits: number;
}

export interface ContractState {
  readonly id: number;
  readonly monthsRemaining: number;
  readonly monthlyValue: number;
  readonly oilCommitment: number;
}

export interface MarketsState {
  readonly activeContracts: ReadonlyArray<ContractState>;
  readonly nextContractId: number;
  readonly contractsIncome: number;
  readonly spotIncome: number;
  readonly goldSalesIncome: number;
  readonly importCost: number;
  readonly healthCost: number;
  readonly goldPurchaseCost: number;
  readonly queuedSpotSaleUnits: number;
  readonly queuedGoldBuyBars: number;
  readonly queuedGoldSellBars: number;
}

export interface ScoreState {
  readonly currentScore: number;
  readonly scoreAccumulator: number;
  readonly totalBalanceAccumulator: number;
  readonly finalRankBand: number;
}

export interface EventEntry {
  readonly id: number;
  readonly text: string;
}

export interface TimeState {
  readonly week: number;
  readonly month: number;
  readonly year: number;
  readonly totalMonths: number;
  readonly weekAccumulatorSeconds: number;
  readonly speed: SpeedSetting;
  readonly paused: boolean;
}

export interface RunState {
  readonly gameOver: boolean;
  readonly cause: RunCause;
}

export interface GameState {
  readonly time: TimeState;
  readonly budget: BudgetState;
  readonly economy: EconomyState;
  readonly resources: ResourcesState;
  readonly politics: PoliticsState;
  readonly map: MapState;
  readonly markets: MarketsState;
  readonly score: ScoreState;
  readonly run: RunState;
  readonly events: ReadonlyArray<EventEntry>;
  readonly nextEventId: number;
}

export interface RandomSource {
  next(): number;
}

export type GameAction =
  | { readonly type: 'select_tile'; readonly tileId: number | null }
  | { readonly type: 'survey_tile' }
  | { readonly type: 'build_rig' }
  | { readonly type: 'repair_rig' }
  | { readonly type: 'import_unit' }
  | { readonly type: 'sign_contract' }
  | { readonly type: 'sell_spot' }
  | { readonly type: 'buy_gold' }
  | { readonly type: 'sell_gold' }
  | { readonly type: 'toggle_pause' }
  | { readonly type: 'set_speed'; readonly speed: SpeedSetting };
