import { FIRE_POWER_MAX, FIRE_POWER_MIN, PLAYER_ONE_ANGLE_MAX, PLAYER_ONE_ANGLE_MIN, PLAYER_TWO_ANGLE_MAX, PLAYER_TWO_ANGLE_MIN } from './constants';
import { anchorPlayersToTerrain, generateTerrain, tankPositionX } from './terrain';
import type { GameState, MatchMode, PlayerState } from './types';

function midpoint(min: number, max: number): number {
  return (min + max) / 2;
}

function createPlayers(mode: MatchMode): readonly [PlayerState, PlayerState] {
  return [
    {
      index: 0,
      label: 'P1',
      isCpu: false,
      color: 0xf2ad65,
      tankX: tankPositionX(0),
      tankY: 0,
      angleDeg: midpoint(PLAYER_ONE_ANGLE_MIN, PLAYER_ONE_ANGLE_MAX),
      power: midpoint(FIRE_POWER_MIN, FIRE_POWER_MAX)
    },
    {
      index: 1,
      label: mode === 'solo-ai' ? 'CPU' : 'P2',
      isCpu: mode === 'solo-ai',
      color: 0x83ebff,
      tankX: tankPositionX(1),
      tankY: 0,
      angleDeg: midpoint(PLAYER_TWO_ANGLE_MIN, PLAYER_TWO_ANGLE_MAX),
      power: midpoint(FIRE_POWER_MIN, FIRE_POWER_MAX)
    }
  ];
}

export function createInitialState(mode: MatchMode, seed: number = 1): GameState {
  const terrain = generateTerrain(seed);
  const players = anchorPlayersToTerrain(createPlayers(mode), terrain);
  const activePlayerIndex: 0 | 1 = 0;
  return {
    mode,
    phase: 'ready',
    seed,
    terrain,
    players,
    activePlayerIndex,
    projectile: null,
    explosion: null,
    winnerIndex: null,
    turnNumber: 1,
    cpuAimPlan: null,
    cpuFireDelaySec: 0
  };
}

export function restartState(state: GameState): GameState {
  return createInitialState(state.mode, state.seed + 1);
}
