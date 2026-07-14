import { DEFAULT_GAME_CONFIG } from './constants';
import { calculateIncome } from './economy';
import type { GameConfig, GameState, PlayerId } from './types';

export interface PlayerStatusSummary {
  readonly playerId: PlayerId;
  readonly ownedProvinceCount: number;
  readonly totalProvinceCount: number;
  readonly soldierCount: number;
  readonly income: number;
  readonly title: string;
}

function statusTitle(ownedProvinceCount: number, totalProvinceCount: number): string {
  if (ownedProvinceCount < 1) {
    return 'Landless';
  }

  if (ownedProvinceCount === totalProvinceCount) {
    return 'King';
  }

  const ownedRatio = ownedProvinceCount / totalProvinceCount;
  if (ownedRatio >= 0.75) {
    return 'Prince';
  }
  if (ownedRatio >= 0.5) {
    return 'Duke';
  }
  if (ownedRatio >= 0.25) {
    return 'Count';
  }

  return 'Baron';
}

export function createPlayerStatusSummary(
  state: GameState,
  playerId: PlayerId,
  config: GameConfig = DEFAULT_GAME_CONFIG
): PlayerStatusSummary {
  const player = state.players.find((candidate) => candidate.id === playerId);
  if (player === undefined) {
    throw new Error(`Unknown player id: ${playerId}.`);
  }

  const totalProvinceCount = state.map.provinces.length;
  if (totalProvinceCount < 1) {
    throw new Error('Cannot create player status summary without provinces.');
  }

  const ownedProvinceCount = state.map.provinces.filter(
    (province) => province.ownerId === playerId
  ).length;
  const soldierCount = state.map.provinces
    .filter((province) => province.ownerId === playerId)
    .reduce((total, province) => total + province.soldiers, 0);

  return {
    playerId,
    ownedProvinceCount,
    totalProvinceCount,
    soldierCount,
    income: calculateIncome(state.map, playerId, config),
    title: statusTitle(ownedProvinceCount, totalProvinceCount)
  };
}
