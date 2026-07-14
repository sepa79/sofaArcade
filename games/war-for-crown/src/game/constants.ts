import type {
  FortificationDefinition,
  GameConfig,
  PlayerState,
  StandardFortificationLevel,
  TerrainDefinition,
  TerrainId
} from './types';

export const WORLD_WIDTH = 1280;
export const WORLD_HEIGHT = 720;

export const DEFAULT_GAME_CONFIG: GameConfig = {
  mapWidth: 20,
  mapHeight: 12,
  humanPlayerCount: 2,
  aiPlayerCount: 2,
  provinceCount: 30,
  maxVillages: 12,
  maxVillagesMode: 'per-province',
  royalistAttitude: 'neutral',
  royalistAttackCooperation: 'single-source',
  royalistAttackThreshold: 'strict',
  royalistGrowthPercent: 60,
  royalistInvestmentPercent: 20,
  royalistFortificationInvestmentPercent: 30,
  royalistDistribution: 'none',
  startingSoldiers: 20,
  startingMoney: 20,
  interestRatePercent: 8,
  soldierCost: 1,
  villageCost: 4,
  fortificationUpgradeCost: 10,
  maxHomeFortificationLevel: 'citadel',
  maxProvinceFortificationLevel: 'watchtower',
  terrainInfluence: 'both',
  randomEventsEnabled: true,
  showComputerBattles: true
};

export const PLAYER_HOME_FORTIFICATION_LEVEL: StandardFortificationLevel = 'castle';

export const PLAYER_DEFINITIONS: ReadonlyArray<
  Omit<PlayerState, 'money' | 'homeProvinceId'>
> = [
  {
    id: 'p1',
    label: 'P1',
    color: 0xd9534f
  },
  {
    id: 'p2',
    label: 'P2',
    color: 0x3f88c5
  },
  {
    id: 'p3',
    label: 'P3',
    color: 0xe0b341
  },
  {
    id: 'p4',
    label: 'P4',
    color: 0x58a55c
  }
];

export const TERRAIN_DEFINITIONS: Readonly<Record<TerrainId, TerrainDefinition>> = {
  plains: {
    id: 'plains',
    incomeMultiplier: 1.2,
    defenceMultiplier: 1,
    color: 0x7aa95c
  },
  brushland: {
    id: 'brushland',
    incomeMultiplier: 1.1,
    defenceMultiplier: 1.1,
    color: 0xa3a65b
  },
  desert: {
    id: 'desert',
    incomeMultiplier: 0.55,
    defenceMultiplier: 0.85,
    color: 0xd4b15f
  },
  marshland: {
    id: 'marshland',
    incomeMultiplier: 0.75,
    defenceMultiplier: 1.35,
    color: 0x5f8f7b
  },
  forest: {
    id: 'forest',
    incomeMultiplier: 1,
    defenceMultiplier: 1.25,
    color: 0x3f7d4a
  },
  hills: {
    id: 'hills',
    incomeMultiplier: 0.9,
    defenceMultiplier: 1.45,
    color: 0x8d8a56
  },
  mountains: {
    id: 'mountains',
    incomeMultiplier: 0.65,
    defenceMultiplier: 1.85,
    color: 0x7c8390
  }
};

export const TERRAIN_IDS: ReadonlyArray<TerrainId> = [
  'plains',
  'desert',
  'brushland',
  'forest',
  'hills',
  'marshland',
  'mountains'
];

export const FORTIFICATION_LEVELS: ReadonlyArray<StandardFortificationLevel> = [
  'none',
  'watchtower',
  'fort',
  'castle',
  'stronghold',
  'fortress',
  'citadel'
];

export const FORTIFICATION_DEFINITIONS: Readonly<
  Record<StandardFortificationLevel, FortificationDefinition>
> = {
  none: {
    level: 'none',
    defenceMultiplier: 1
  },
  watchtower: {
    level: 'watchtower',
    defenceMultiplier: 1.15
  },
  fort: {
    level: 'fort',
    defenceMultiplier: 1.35
  },
  castle: {
    level: 'castle',
    defenceMultiplier: 1.6
  },
  stronghold: {
    level: 'stronghold',
    defenceMultiplier: 1.9
  },
  fortress: {
    level: 'fortress',
    defenceMultiplier: 2.3
  },
  citadel: {
    level: 'citadel',
    defenceMultiplier: 2.75
  }
};
