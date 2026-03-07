import { describe, expect, it } from 'vitest';

import { PLAYER_LIVES } from './constants';
import { finalizeDebugModeState, prepareDebugModeState } from './debug-mode';
import { createInitialState } from './state';
import type { GameState } from './types';

describe('debug mode helpers', () => {
  it('resets shoot and respawn timers while playing', () => {
    const state = createInitialState(201, 1);
    const prepared = prepareDebugModeState({
      ...state,
      phase: 'playing',
      players: state.players.map((player) => ({
        ...player,
        lives: 1,
        respawnTimer: 0.9,
        shootTimer: 0.7
      }))
    });

    expect(prepared.players[0]?.lives).toBe(PLAYER_LIVES);
    expect(prepared.players[0]?.respawnTimer).toBe(0);
    expect(prepared.players[0]?.shootTimer).toBe(0);
  });

  it('revives the game when a loss came only from players running out of lives', () => {
    const state = createInitialState(202, 1);
    const lostState: GameState = {
      ...state,
      phase: 'lost',
      players: state.players.map((player) => ({
        ...player,
        lives: 0,
        respawnTimer: 0.4,
        shootTimer: 0.3
      }))
    };

    const finalized = finalizeDebugModeState(lostState);

    expect(finalized.phase).toBe('playing');
    expect(finalized.players[0]?.lives).toBe(PLAYER_LIVES);
    expect(finalized.players[0]?.respawnTimer).toBe(0);
    expect(finalized.players[0]?.shootTimer).toBe(0);
  });

  it('does not override non-player-elimination losses', () => {
    const state = createInitialState(203, 1);
    const lostState: GameState = {
      ...state,
      phase: 'lost'
    };

    const finalized = finalizeDebugModeState(lostState);

    expect(finalized.phase).toBe('lost');
  });
});
