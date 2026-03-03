import { describe, expect, it } from 'vitest';

import { FIXED_TIMESTEP, PLAYER_Y } from './constants';
import { stepGame } from './logic';
import { createInitialState } from './state';
import type { GameState } from './types';

describe('stepGame', () => {
  it('kills enemy and adds score when player bullet hits', () => {
    const state = createInitialState(7);
    const target = state.enemies[0];

    const customState: GameState = {
      ...state,
      bullets: [
        {
          owner: 'player',
          x: target.x,
          y: target.y,
          vy: 0
        }
      ]
    };

    const next = stepGame(
      customState,
      {
        moveAxisSigned: 0,
        moveAbsoluteUnit: null,
        firePressed: false,
        restartPressed: false
      },
      FIXED_TIMESTEP
    );

    expect(next.score).toBe(100);
    expect(next.enemies[0].alive).toBe(false);
  });

  it('reduces life when enemy bullet hits player', () => {
    const state = createInitialState(12);

    const customState: GameState = {
      ...state,
      bullets: [
        {
          owner: 'enemy',
          x: state.playerX,
          y: PLAYER_Y,
          vy: 0
        }
      ]
    };

    const next = stepGame(
      customState,
      {
        moveAxisSigned: 0,
        moveAbsoluteUnit: null,
        firePressed: false,
        restartPressed: false
      },
      FIXED_TIMESTEP
    );

    expect(next.lives).toBe(2);
  });

  it('drops enemies when formation reaches boundary', () => {
    const state = createInitialState(3);

    const nearEdgeState: GameState = {
      ...state,
      enemies: state.enemies.map((enemy) => ({
        ...enemy,
        x: enemy.x + 400
      }))
    };

    const next = stepGame(
      nearEdgeState,
      {
        moveAxisSigned: 0,
        moveAbsoluteUnit: null,
        firePressed: false,
        restartPressed: false
      },
      FIXED_TIMESTEP
    );

    expect(next.enemyDirection).toBe(-1);
    expect(next.enemies[0].y).toBeGreaterThan(nearEdgeState.enemies[0].y);
  });

  it('supports absolute paddle-like movement', () => {
    const state = createInitialState(20);

    const next = stepGame(
      state,
      {
        moveAxisSigned: 0,
        moveAbsoluteUnit: 1,
        firePressed: false,
        restartPressed: false
      },
      FIXED_TIMESTEP
    );

    expect(next.playerX).toBeGreaterThan(state.playerX);
  });
});
