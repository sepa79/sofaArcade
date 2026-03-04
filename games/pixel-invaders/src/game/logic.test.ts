import { describe, expect, it } from 'vitest';

import { BULLET_HEIGHT, ENEMY_COLS, ENEMY_ROW_RESPAWN_Y, FIXED_TIMESTEP, PLAYER_Y } from './constants';
import { stepGame } from './logic';
import { createInitialState } from './state';
import type { GameState } from './types';

describe('stepGame', () => {
  it('kills enemy and adds score when player bullet hits', () => {
    const state = createInitialState(7);
    const target = state.enemies[0];

    const customState: GameState = {
      ...state,
      phase: 'playing',
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

    expect(next.score).toBe(1);
    expect(next.enemies[0].alive).toBe(false);
  });

  it('reduces life when enemy bullet hits player', () => {
    const state = createInitialState(12);

    const customState: GameState = {
      ...state,
      phase: 'playing',
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
      phase: 'playing',
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
      {
        ...state,
        phase: 'playing'
      },
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

  it('increases bonus multiplier with consecutive hits', () => {
    const state = createInitialState(21);
    const target = state.enemies[0];

    const customState: GameState = {
      ...state,
      phase: 'playing',
      hitStreak: 2,
      scoreMultiplier: 3,
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

    expect(next.score).toBe(3);
    expect(next.hitStreak).toBe(3);
    expect(next.scoreMultiplier).toBe(4);
  });

  it('resets bonus multiplier on miss', () => {
    const state = createInitialState(22);

    const customState: GameState = {
      ...state,
      phase: 'playing',
      hitStreak: 5,
      scoreMultiplier: 6,
      bullets: [
        {
          owner: 'player',
          x: state.playerX,
          y: -BULLET_HEIGHT - 1,
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

    expect(next.hitStreak).toBe(0);
    expect(next.scoreMultiplier).toBe(1);
  });

  it('resets bonus multiplier when player gets hit', () => {
    const state = createInitialState(24);

    const customState: GameState = {
      ...state,
      phase: 'playing',
      hitStreak: 7,
      scoreMultiplier: 8,
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
    expect(next.hitStreak).toBe(0);
    expect(next.scoreMultiplier).toBe(1);
  });

  it('respawns defeated rows at the top in endless mode', () => {
    const state = createInitialState(25);

    const customState: GameState = {
      ...state,
      phase: 'playing',
      enemies: state.enemies.map((enemy) =>
        enemy.id < ENEMY_COLS
          ? {
              ...enemy,
              alive: false
            }
          : enemy
      )
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

    const rowEnemies = next.enemies.filter((enemy) => enemy.id < ENEMY_COLS);
    expect(rowEnemies.every((enemy) => enemy.alive)).toBe(true);
    expect(rowEnemies.every((enemy) => enemy.y === ENEMY_ROW_RESPAWN_Y)).toBe(true);
    expect(next.phase).toBe('playing');
  });

  it('starts gameplay only after fire in ready phase', () => {
    const state = createInitialState(23);

    const wait = stepGame(
      state,
      {
        moveAxisSigned: 0,
        moveAbsoluteUnit: null,
        firePressed: false,
        restartPressed: false
      },
      FIXED_TIMESTEP
    );
    expect(wait.phase).toBe('ready');

    const start = stepGame(
      state,
      {
        moveAxisSigned: 0,
        moveAbsoluteUnit: null,
        firePressed: true,
        restartPressed: false
      },
      FIXED_TIMESTEP
    );
    expect(start.phase).toBe('playing');
  });
});
