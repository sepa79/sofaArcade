import {
  FORTIFICATION_LEVELS,
  PLAYER_HOME_FORTIFICATION_LEVEL
} from '../game/constants';
import { fortificationIndex } from '../game/rules';
import type { GameConfig, StandardFortificationLevel } from '../game/types';

export type WarForCrownConfigOptionId =
  | 'map-max-villages'
  | 'map-province-count'
  | 'map-village-mode'
  | 'rules-home-max-fort'
  | 'rules-interest'
  | 'rules-province-max-fort'
  | 'rules-royalist-attitude'
  | 'rules-royalist-distribution'
  | 'rules-royalist-growth'
  | 'rules-royalist-investment'
  | 'rules-show-computer-battles'
  | 'rules-start-money'
  | 'rules-start-soldiers'
  | 'rules-terrain-influence'
  | 'rules-village-cost';

const PROVINCE_COUNT_OPTIONS: ReadonlyArray<number> = [16, 20, 24, 30];
const MAX_VILLAGE_OPTIONS: ReadonlyArray<number> = [5, 8, 12, 16];
const VILLAGE_COST_OPTIONS: ReadonlyArray<number> = [2, 4, 8, 12];
const INTEREST_RATE_OPTIONS: ReadonlyArray<number> = [0, 4, 8, 12];
const PERCENT_OPTIONS: ReadonlyArray<number> = [0, 20, 40, 60, 80];
const STARTING_SOLDIER_OPTIONS: ReadonlyArray<number> = [10, 20, 30, 40];
const STARTING_MONEY_OPTIONS: ReadonlyArray<number> = [10, 20, 30, 40];
const HOME_FORTIFICATION_LEVEL_OPTIONS: ReadonlyArray<StandardFortificationLevel> =
  FORTIFICATION_LEVELS.filter(
    (level) => fortificationIndex(level) >= fortificationIndex(PLAYER_HOME_FORTIFICATION_LEVEL)
  );

export function nextOption<T>(values: ReadonlyArray<T>, current: T): T {
  const index = values.indexOf(current);
  if (index === -1) {
    throw new Error(`Current option is not in configured option list: ${String(current)}.`);
  }
  const next = values[(index + 1) % values.length];
  if (next === undefined) {
    throw new Error('Configured option list is empty.');
  }
  return next;
}

export function cycleWarForCrownConfigOption(
  config: GameConfig,
  optionId: WarForCrownConfigOptionId
): { readonly config: GameConfig; readonly regenerateMap: boolean } {
  switch (optionId) {
    case 'map-province-count':
      return {
        config: { ...config, provinceCount: nextOption(PROVINCE_COUNT_OPTIONS, config.provinceCount) },
        regenerateMap: true
      };
    case 'map-max-villages':
      return {
        config: { ...config, maxVillages: nextOption(MAX_VILLAGE_OPTIONS, config.maxVillages) },
        regenerateMap: true
      };
    case 'map-village-mode':
      return {
        config: {
          ...config,
          maxVillagesMode: config.maxVillagesMode === 'per-province'
            ? 'largest-province'
            : 'per-province'
        },
        regenerateMap: true
      };
    case 'rules-village-cost':
      return { config: { ...config, villageCost: nextOption(VILLAGE_COST_OPTIONS, config.villageCost) }, regenerateMap: false };
    case 'rules-interest':
      return { config: { ...config, interestRatePercent: nextOption(INTEREST_RATE_OPTIONS, config.interestRatePercent) }, regenerateMap: false };
    case 'rules-start-soldiers':
      return { config: { ...config, startingSoldiers: nextOption(STARTING_SOLDIER_OPTIONS, config.startingSoldiers) }, regenerateMap: false };
    case 'rules-start-money':
      return { config: { ...config, startingMoney: nextOption(STARTING_MONEY_OPTIONS, config.startingMoney) }, regenerateMap: false };
    case 'rules-home-max-fort':
      return { config: { ...config, maxHomeFortificationLevel: nextOption(HOME_FORTIFICATION_LEVEL_OPTIONS, config.maxHomeFortificationLevel) }, regenerateMap: false };
    case 'rules-province-max-fort':
      return { config: { ...config, maxProvinceFortificationLevel: nextOption(FORTIFICATION_LEVELS, config.maxProvinceFortificationLevel) }, regenerateMap: false };
    case 'rules-royalist-growth':
      return { config: { ...config, royalistGrowthPercent: nextOption(PERCENT_OPTIONS, config.royalistGrowthPercent) }, regenerateMap: false };
    case 'rules-royalist-investment':
      return { config: { ...config, royalistInvestmentPercent: nextOption(PERCENT_OPTIONS, config.royalistInvestmentPercent) }, regenerateMap: false };
    case 'rules-terrain-influence':
      return { config: { ...config, terrainInfluence: nextOption(['none', 'income', 'combat', 'both'] as const, config.terrainInfluence) }, regenerateMap: false };
    case 'rules-royalist-attitude':
      return { config: { ...config, royalistAttitude: nextOption(['friendly', 'neutral', 'hostile'] as const, config.royalistAttitude) }, regenerateMap: false };
    case 'rules-royalist-distribution':
      return { config: { ...config, royalistDistribution: nextOption(['none', 'even', 'border'] as const, config.royalistDistribution) }, regenerateMap: false };
    case 'rules-show-computer-battles':
      return { config: { ...config, showComputerBattles: !config.showComputerBattles }, regenerateMap: false };
    default:
      optionId satisfies never;
      throw new Error('Unhandled War for Crown config option.');
  }
}
