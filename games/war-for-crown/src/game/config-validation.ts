import { FORTIFICATION_LEVELS, PLAYER_DEFINITIONS } from './constants';
import type { GameConfig } from './types';

export const C64_MAP_WIDTH = 20;
export const C64_MAP_HEIGHT = 12;
export const C64_MIN_PROVINCE_COUNT = 16;
export const C64_MAX_PROVINCE_COUNT = 99;

function requireIntegerRange(value: number, minimum: number, maximum: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < minimum || value > maximum) {
    throw new Error(`${label} must be a safe integer in ${minimum}..${maximum}, got ${value}.`);
  }
}

function requirePositiveInteger(value: number, label: string): void {
  requireIntegerRange(value, 1, Number.MAX_SAFE_INTEGER, label);
}

function requireEnum(value: string, allowed: ReadonlyArray<string>, label: string): void {
  if (!allowed.includes(value)) {
    throw new Error(`${label} has invalid value "${value}".`);
  }
}

export function validateGameConfig(config: GameConfig): void {
  if (config.mapWidth !== C64_MAP_WIDTH || config.mapHeight !== C64_MAP_HEIGHT) {
    throw new Error(
      `C64 map requires ${C64_MAP_WIDTH}x${C64_MAP_HEIGHT}, got ${config.mapWidth}x${config.mapHeight}.`
    );
  }
  requireIntegerRange(
    config.provinceCount,
    C64_MIN_PROVINCE_COUNT,
    C64_MAX_PROVINCE_COUNT,
    'C64 province count'
  );
  requireIntegerRange(config.maxVillages, 5, 99, 'C64 maximum villages');
  requireIntegerRange(config.humanPlayerCount, 0, PLAYER_DEFINITIONS.length, 'Human player count');
  requireIntegerRange(config.aiPlayerCount, 0, PLAYER_DEFINITIONS.length, 'AI player count');
  const totalPlayers = config.humanPlayerCount + config.aiPlayerCount;
  if (totalPlayers < 2 || totalPlayers > PLAYER_DEFINITIONS.length) {
    throw new Error(`Total player count must be 2..${PLAYER_DEFINITIONS.length}, got ${totalPlayers}.`);
  }

  requirePositiveInteger(config.startingSoldiers, 'Starting soldiers');
  requireIntegerRange(config.startingMoney, 0, 0xffffff, 'Starting money');
  requireIntegerRange(config.interestRatePercent, 0, 100, 'Interest rate percent');
  requirePositiveInteger(config.soldierCost, 'Soldier cost');
  requirePositiveInteger(config.villageCost, 'Village cost');
  requirePositiveInteger(config.fortificationUpgradeCost, 'Fortification upgrade cost');
  requireIntegerRange(config.royalistGrowthPercent, 0, 100, 'Royalist growth percent');
  requireIntegerRange(config.royalistInvestmentPercent, 0, 100, 'Royalist investment percent');
  requireIntegerRange(
    config.royalistFortificationInvestmentPercent,
    0,
    100,
    'Royalist fortification investment percent'
  );

  requireEnum(config.maxVillagesMode, ['per-province', 'largest-province'], 'Maximum villages mode');
  requireEnum(config.royalistAttitude, ['friendly', 'neutral', 'hostile'], 'Royalist attitude');
  requireEnum(
    config.royalistAttackCooperation,
    ['single-source', 'combined-sources'],
    'Royalist attack cooperation'
  );
  requireEnum(config.royalistAttackThreshold, ['loose', 'strict'], 'Royalist attack threshold');
  requireEnum(config.royalistDistribution, ['none', 'even', 'border'], 'Royalist distribution');
  requireEnum(config.terrainInfluence, ['none', 'income', 'combat', 'both'], 'Terrain influence');
  requireEnum(config.maxHomeFortificationLevel, FORTIFICATION_LEVELS, 'Maximum home fortification');
  requireEnum(
    config.maxProvinceFortificationLevel,
    FORTIFICATION_LEVELS,
    'Maximum province fortification'
  );
  if (typeof config.randomEventsEnabled !== 'boolean') {
    throw new Error('Random events enabled must be boolean.');
  }
  if (typeof config.showComputerBattles !== 'boolean') {
    throw new Error('Show computer battles must be boolean.');
  }
}
