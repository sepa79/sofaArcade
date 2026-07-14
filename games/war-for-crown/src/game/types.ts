import type { OwnerId } from './owners';

export type PlayerId = string;

export type ProvinceId = string;

export type TerrainId =
  | 'plains'
  | 'brushland'
  | 'desert'
  | 'marshland'
  | 'forest'
  | 'hills'
  | 'mountains';

export type GamePhase = 'home-selection' | 'turn' | 'game-over';

export type TurnStep = 'new-month' | 'attack' | 'movement' | 'investment';

export type StandardFortificationLevel =
  | 'none'
  | 'watchtower'
  | 'fort'
  | 'castle'
  | 'stronghold'
  | 'fortress'
  | 'citadel';

export type FortificationLevel = StandardFortificationLevel | `c64-level-${number}`;

export type VillageLimitMode = 'per-province' | 'largest-province';

export type RoyalistAttitude = 'friendly' | 'neutral' | 'hostile';

export type TerrainInfluence = 'none' | 'income' | 'combat' | 'both';

export type RoyalistDistribution = 'none' | 'even' | 'border';

export type RoyalistAttackCooperation = 'single-source' | 'combined-sources';

export type RoyalistAttackThreshold = 'loose' | 'strict';

export type BattleRetreatSide = 'attacker' | 'defender';

export interface TerrainDefinition {
  readonly id: TerrainId;
  readonly incomeMultiplier: number;
  readonly defenceMultiplier: number;
  readonly color: number;
}

export interface FortificationDefinition {
  readonly level: FortificationLevel;
  readonly defenceMultiplier: number;
}

export interface TileState {
  readonly x: number;
  readonly y: number;
  readonly provinceId: ProvinceId | null;
}

export interface ProvinceState {
  readonly id: ProvinceId;
  readonly terrainId: TerrainId;
  readonly ownerId: OwnerId;
  readonly villages: number;
  readonly soldiers: number;
  readonly fortificationLevel: FortificationLevel;
  readonly upgradedFortificationThisTurn: boolean;
  readonly neighbours: ReadonlyArray<ProvinceId>;
}

export interface ProvinceMapState {
  readonly width: number;
  readonly height: number;
  readonly tiles: ReadonlyArray<TileState>;
  readonly provinces: ReadonlyArray<ProvinceState>;
}

export interface PlayerState {
  readonly id: PlayerId;
  readonly label: string;
  readonly color: number;
  readonly money: number;
  readonly homeProvinceId: ProvinceId | null;
}

export interface C64AiPlayerMemory {
  readonly playerId: PlayerId;
  readonly rank: number;
  readonly hiredSoldiers: number;
  readonly economyCarryoverMoney: number;
  readonly rememberedTargetProvinceId: ProvinceId | null;
  readonly rememberedTargetSoldiers: number;
}

export interface C64RoyalistProvinceMemory {
  readonly provinceId: ProvinceId;
  readonly villageInvestmentBucket: number;
  readonly fortificationInvestmentBucket: number;
}

export interface C64CalendarState {
  readonly year: number;
  readonly month: number;
  readonly weatherIndex: number;
  readonly weatherFactor: number;
  readonly weatherDerived: number;
  readonly monthWeatherPending: boolean;
}

export interface C64CompatibilityState {
  readonly ca61Bytes: ReadonlyArray<number>;
  readonly calendar: C64CalendarState;
  readonly royalistReinforcementTimer: number;
  readonly deserterSoldiers: number;
  readonly deserterOwnerId: PlayerId | null;
  readonly playerMemory: ReadonlyArray<C64AiPlayerMemory>;
  readonly royalistProvinceMemory: ReadonlyArray<C64RoyalistProvinceMemory>;
}

export interface BattleState {
  readonly attackerId: PlayerId;
  readonly defenderId: OwnerId;
  readonly fromProvinceIds: ReadonlyArray<ProvinceId>;
  readonly targetProvinceId: ProvinceId;
  readonly attackerSoldiers: number;
  readonly defenderSoldiers: number;
  readonly attackerInitialSoldiers: number;
  readonly defenderInitialSoldiers: number;
  readonly attackerCombatPercent: number;
  readonly defenderCombatPercent: number;
  readonly attackerHitDenominator: number;
  readonly defenderHitDenominator: number;
  readonly round: number;
  readonly retreatSide: BattleRetreatSide | null;
}

export interface GameConfig {
  readonly mapWidth: number;
  readonly mapHeight: number;
  readonly humanPlayerCount: number;
  readonly aiPlayerCount: number;
  readonly provinceCount: number;
  readonly maxVillages: number;
  readonly maxVillagesMode: VillageLimitMode;
  readonly royalistAttitude: RoyalistAttitude;
  readonly royalistAttackCooperation: RoyalistAttackCooperation;
  readonly royalistAttackThreshold: RoyalistAttackThreshold;
  readonly royalistGrowthPercent: number;
  readonly royalistInvestmentPercent: number;
  readonly royalistFortificationInvestmentPercent: number;
  readonly royalistDistribution: RoyalistDistribution;
  readonly startingSoldiers: number;
  readonly startingMoney: number;
  readonly interestRatePercent: number;
  readonly soldierCost: number;
  readonly villageCost: number;
  readonly fortificationUpgradeCost: number;
  readonly maxHomeFortificationLevel: StandardFortificationLevel;
  readonly maxProvinceFortificationLevel: StandardFortificationLevel;
  readonly terrainInfluence: TerrainInfluence;
  readonly randomEventsEnabled: boolean;
  readonly showComputerBattles: boolean;
}

export interface GameState {
  readonly seed: number;
  readonly rngState: number;
  readonly phase: GamePhase;
  readonly map: ProvinceMapState;
  readonly players: ReadonlyArray<PlayerState>;
  readonly c64: C64CompatibilityState;
  readonly activePlayerId: PlayerId;
  readonly turnStep: TurnStep;
  readonly turnNumber: number;
  readonly winnerId: OwnerId | null;
  readonly attackSpentProvinceIds: ReadonlyArray<ProvinceId>;
  readonly battle: BattleState | null;
}

export interface BattleInput {
  readonly attackingSoldiers: number;
  readonly defendingSoldiers: number;
  readonly attackerMultiplier: number;
  readonly defenderMultiplier: number;
}

export interface BattleThresholdInput {
  readonly defendingSoldiers: number;
  readonly attackerMultiplier: number;
  readonly defenderMultiplier: number;
}

export interface BattleResult {
  readonly winner: 'attacker' | 'defender';
  readonly resolution: 'elimination' | 'attacker-retreat' | 'defender-retreat';
  readonly attackerLosses: number;
  readonly defenderLosses: number;
  readonly survivingAttackers: number;
  readonly survivingDefenders: number;
  readonly attackStrength: number;
  readonly defenceStrength: number;
}

export interface BattleRoundInput {
  readonly attackerSoldiers: number;
  readonly defenderSoldiers: number;
  readonly attackerCombatPercent: number;
  readonly defenderCombatPercent: number;
}

export interface BattleRoundResult {
  readonly attackerLosses: number;
  readonly defenderLosses: number;
  readonly attackerSoldiers: number;
  readonly defenderSoldiers: number;
  readonly attackStrength: number;
  readonly defenceStrength: number;
}
