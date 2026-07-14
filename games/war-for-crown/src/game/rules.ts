import {
  FORTIFICATION_DEFINITIONS,
  FORTIFICATION_LEVELS,
  TERRAIN_DEFINITIONS
} from './constants';
import type {
  FortificationDefinition,
  FortificationLevel,
  GameConfig,
  ProvinceState,
  StandardFortificationLevel,
  TerrainId
} from './types';

const C64_EXTENDED_FORTIFICATION_PATTERN = /^c64-level-(\d+)$/;

export function fortificationIndex(level: FortificationLevel): number {
  const index = FORTIFICATION_LEVELS.findIndex((candidate) => candidate === level);
  if (index >= 0) {
    return index;
  }
  const match = C64_EXTENDED_FORTIFICATION_PATTERN.exec(level);
  if (match === null) {
    throw new Error(`Unknown fortification level: ${level}.`);
  }
  const parsed = Number(match[1]);
  if (!Number.isInteger(parsed) || parsed < FORTIFICATION_LEVELS.length || parsed > 0xff) {
    throw new Error(`Invalid extended C64 fortification level: ${level}.`);
  }
  return parsed;
}

export function fortificationLevelAtIndex(index: number): FortificationLevel {
  if (!Number.isInteger(index) || index < 0) {
    throw new Error(`Fortification index must be a non-negative integer, got ${index}.`);
  }

  const level = FORTIFICATION_LEVELS[index];
  if (level !== undefined) {
    return level;
  }
  if (index > 0xff) {
    throw new Error(`C64 fortification index must not exceed 255, got ${index}.`);
  }
  return `c64-level-${index}`;
}

export function nextFortificationLevel(
  currentLevel: FortificationLevel,
  maxLevel: StandardFortificationLevel
): FortificationLevel {
  const currentIndex = fortificationIndex(currentLevel);
  const maxIndex = fortificationIndex(maxLevel);
  if (currentIndex >= maxIndex) {
    throw new Error(`Fortification is already at configured max ${maxLevel}.`);
  }

  return fortificationLevelAtIndex(currentIndex + 1);
}

export function fortificationDefinition(level: FortificationLevel): FortificationDefinition {
  const index = fortificationIndex(level);
  const standard = FORTIFICATION_LEVELS[index];
  if (standard !== undefined) {
    return FORTIFICATION_DEFINITIONS[standard];
  }
  throw new Error(
    `Extended C64 fortification ${level} has no modern defence-multiplier definition.`
  );
}

export function terrainIncomeMultiplier(terrainId: TerrainId, config: GameConfig): number {
  if (config.terrainInfluence === 'none' || config.terrainInfluence === 'combat') {
    return 1;
  }

  return TERRAIN_DEFINITIONS[terrainId].incomeMultiplier;
}

export function terrainDefenceMultiplier(terrainId: TerrainId, config: GameConfig): number {
  if (config.terrainInfluence === 'none' || config.terrainInfluence === 'income') {
    return 1;
  }

  return TERRAIN_DEFINITIONS[terrainId].defenceMultiplier;
}

export function calculateInterest(money: number, config: GameConfig): number {
  if (!Number.isInteger(money) || money < 0) {
    throw new Error(`Money must be a non-negative integer, got ${money}.`);
  }

  if (!Number.isInteger(config.interestRatePercent) || config.interestRatePercent < 0) {
    throw new Error(`Interest rate must be a non-negative integer, got ${config.interestRatePercent}.`);
  }

  return Math.floor((money * config.interestRatePercent) / 100);
}

export function provinceFortificationLimit(
  province: ProvinceState,
  config: GameConfig,
  isHomeProvince: boolean
): StandardFortificationLevel {
  void province;
  return isHomeProvince ? config.maxHomeFortificationLevel : config.maxProvinceFortificationLevel;
}
