import { PLAYER_LIVES } from './constants';
import type { GameState, PlayerState } from './types';

function applyDebugPlayerState(player: PlayerState): PlayerState {
  return {
    ...player,
    lives: PLAYER_LIVES,
    respawnTimer: 0,
    shootTimer: 0
  };
}

function restoreDebugPlayers(state: GameState): GameState {
  return {
    ...state,
    players: state.players.map((player) => applyDebugPlayerState(player))
  };
}

export function prepareDebugModeState(state: GameState): GameState {
  if (state.phase !== 'playing') {
    return state;
  }

  return restoreDebugPlayers(state);
}

export function finalizeDebugModeState(state: GameState): GameState {
  if (state.phase === 'lost' && state.players.every((player) => player.lives <= 0)) {
    return {
      ...restoreDebugPlayers(state),
      phase: 'playing'
    };
  }

  if (state.phase !== 'playing') {
    return state;
  }

  return restoreDebugPlayers(state);
}
