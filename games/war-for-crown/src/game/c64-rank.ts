import { requireC64PlayerMemory } from './c64-state';
import type { GameState, PlayerId } from './types';

export const C64_HIGHEST_NON_VICTORY_RANK = 4;

function requireProvinceCount(value: number): void {
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`C64 configured province count must be positive, got ${value}.`);
  }
}

export function c64RankThreshold(provinceCount: number, rank: number): number {
  requireProvinceCount(provinceCount);
  if (!Number.isInteger(rank) || rank < 0 || rank > C64_HIGHEST_NON_VICTORY_RANK) {
    throw new Error(`C64 threshold rank must be 0..4, got ${rank}.`);
  }
  return Math.floor((provinceCount * rank) / 5);
}

export function c64TargetRank(provinceCount: number, ownedProvinceCount: number): number {
  requireProvinceCount(provinceCount);
  if (!Number.isInteger(ownedProvinceCount) || ownedProvinceCount < 0) {
    throw new Error(`C64 owned province count must be non-negative, got ${ownedProvinceCount}.`);
  }

  for (let rank = C64_HIGHEST_NON_VICTORY_RANK; rank >= 0; rank -= 1) {
    if (ownedProvinceCount >= c64RankThreshold(provinceCount, rank)) {
      return rank;
    }
  }

  throw new Error('C64 rank threshold scan did not select a rank.');
}

export function updateC64PlayerRank(state: GameState, playerId: PlayerId): GameState {
  const memory = requireC64PlayerMemory(state, playerId);
  const ownedProvinceCount = state.map.provinces.filter(
    (province) => province.ownerId === playerId
  ).length;
  const targetRank = c64TargetRank(state.map.provinces.length, ownedProvinceCount);
  const rank = targetRank > memory.rank ? memory.rank + 1 : targetRank;

  if (rank === memory.rank) {
    return state;
  }

  return {
    ...state,
    c64: {
      ...state.c64,
      playerMemory: state.c64.playerMemory.map((candidate) =>
        candidate.playerId === playerId
          ? {
              ...candidate,
              rank
            }
          : candidate
      )
    }
  };
}
