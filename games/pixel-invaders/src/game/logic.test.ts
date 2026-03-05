import { describe, expect, it } from 'vitest';

import {
  BULLET_HEIGHT,
  BULLET_WIDTH,
  ENEMY_COLS,
  ENEMY_ROW_RESPAWN_Y,
  ENEMY_STANDARD_ACTIVE_HEIGHT,
  ENEMY_STANDARD_ACTIVE_WIDTH,
  ENEMY_UFO_HIT_POINTS,
  ENEMY_UFO_SCORE,
  FIXED_TIMESTEP,
  ENEMY_UFO_ACTIVE_HEIGHT,
  ENEMY_UFO_ACTIVE_WIDTH,
  PLAYER_ACTIVE_HEIGHT,
  PLAYER_ACTIVE_WIDTH,
  PLAYER_Y
} from './constants';
import { createCollisionRuntime, createFilledAlphaMask } from './collision';
import { stepGame } from './logic';
import { createInitialState } from './state';
import type { GameState } from './types';

const TEST_STEP_OPTIONS = {
  collisionRuntime: createCollisionRuntime({
    playerMask: createFilledAlphaMask(PLAYER_ACTIVE_WIDTH, PLAYER_ACTIVE_HEIGHT),
    enemySmallMasks: [
      createFilledAlphaMask(ENEMY_STANDARD_ACTIVE_WIDTH, ENEMY_STANDARD_ACTIVE_HEIGHT),
      createFilledAlphaMask(ENEMY_STANDARD_ACTIVE_WIDTH, ENEMY_STANDARD_ACTIVE_HEIGHT),
      createFilledAlphaMask(ENEMY_STANDARD_ACTIVE_WIDTH, ENEMY_STANDARD_ACTIVE_HEIGHT),
      createFilledAlphaMask(ENEMY_STANDARD_ACTIVE_WIDTH, ENEMY_STANDARD_ACTIVE_HEIGHT)
    ],
    enemyBig1Mask: createFilledAlphaMask(ENEMY_UFO_ACTIVE_WIDTH, ENEMY_UFO_ACTIVE_HEIGHT)
  }),
  captureCollisionDebug: false
} as const;

function stepState(state: GameState, input: GameStateInput): GameState {
  return stepGame(state, input, FIXED_TIMESTEP, TEST_STEP_OPTIONS).state;
}

interface GameStateInput {
  readonly moveAxisSigned: number;
  readonly moveAbsoluteUnit: number | null;
  readonly firePressed: boolean;
  readonly restartPressed: boolean;
}

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

    const next = stepState(
      customState,
      {
        moveAxisSigned: 0,
        moveAbsoluteUnit: null,
        firePressed: false,
        restartPressed: false
      }
    );

    expect(next.score).toBe(1);
    expect(next.enemies[0].alive).toBe(false);
  });

  it('counts side graze hit using bullet thickness, not bullet center only', () => {
    const state = createInitialState(18);
    const target = state.enemies[0];
    const grazeBulletX = target.x + ENEMY_STANDARD_ACTIVE_WIDTH / 2 + BULLET_WIDTH / 2 - 0.2;

    const customState: GameState = {
      ...state,
      phase: 'playing',
      bullets: [
        {
          owner: 'player',
          x: grazeBulletX,
          y: target.y,
          vy: 0
        }
      ]
    };

    const next = stepState(customState, {
      moveAxisSigned: 0,
      moveAbsoluteUnit: null,
      firePressed: false,
      restartPressed: false
    });

    expect(next.enemies[0].alive).toBe(false);
    expect(next.score).toBe(1);
  });

  it('detects swept bullet hit when bullet crosses enemy between frames', () => {
    const state = createInitialState(17);
    const target = state.enemies[0];

    const customState: GameState = {
      ...state,
      phase: 'playing',
      bullets: [
        {
          owner: 'player',
          x: target.x,
          y: target.y + 24,
          vy: -2000
        }
      ]
    };

    const next = stepState(customState, {
      moveAxisSigned: 0,
      moveAbsoluteUnit: null,
      firePressed: false,
      restartPressed: false
    });

    expect(next.enemies[0].alive).toBe(false);
    expect(next.score).toBe(1);
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

    const next = stepState(
      customState,
      {
        moveAxisSigned: 0,
        moveAbsoluteUnit: null,
        firePressed: false,
        restartPressed: false
      }
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

    const next = stepState(
      nearEdgeState,
      {
        moveAxisSigned: 0,
        moveAbsoluteUnit: null,
        firePressed: false,
        restartPressed: false
      }
    );

    expect(next.enemyDirection).toBe(-1);
    expect(next.enemies[0].y).toBeGreaterThan(nearEdgeState.enemies[0].y);
  });

  it('supports absolute paddle-like movement', () => {
    const state = createInitialState(20);

    const next = stepState(
      {
        ...state,
        phase: 'playing'
      },
      {
        moveAxisSigned: 0,
        moveAbsoluteUnit: 1,
        firePressed: false,
        restartPressed: false
      }
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

    const next = stepState(
      customState,
      {
        moveAxisSigned: 0,
        moveAbsoluteUnit: null,
        firePressed: false,
        restartPressed: false
      }
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

    const next = stepState(
      customState,
      {
        moveAxisSigned: 0,
        moveAbsoluteUnit: null,
        firePressed: false,
        restartPressed: false
      }
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

    const next = stepState(
      customState,
      {
        moveAxisSigned: 0,
        moveAbsoluteUnit: null,
        firePressed: false,
        restartPressed: false
      }
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

    const next = stepState(
      customState,
      {
        moveAxisSigned: 0,
        moveAbsoluteUnit: null,
        firePressed: false,
        restartPressed: false
      }
    );

    const rowEnemies = next.enemies.filter((enemy) => enemy.id < ENEMY_COLS);
    expect(rowEnemies.every((enemy) => enemy.alive)).toBe(true);
    expect(rowEnemies.every((enemy) => enemy.y === ENEMY_ROW_RESPAWN_Y)).toBe(true);
    expect(next.phase).toBe('playing');
  });

  it('requires three hits to destroy ufo enemy', () => {
    const state = createInitialState(31);
    const firstEnemy = state.enemies[0];

    const ufoState: GameState = {
      ...state,
      phase: 'playing',
      enemies: state.enemies.map((enemy) =>
        enemy.id === firstEnemy.id
          ? {
              ...enemy,
              kind: 'ufo',
              scoreValue: ENEMY_UFO_SCORE,
              hitPoints: ENEMY_UFO_HIT_POINTS
            }
          : enemy
      ),
      bullets: [
        {
          owner: 'player',
          x: firstEnemy.x,
          y: firstEnemy.y,
          vy: 0
        }
      ]
    };

    const afterFirstHit = stepState(
      ufoState,
      {
        moveAxisSigned: 0,
        moveAbsoluteUnit: null,
        firePressed: false,
        restartPressed: false
      }
    );

    expect(afterFirstHit.enemies[0].alive).toBe(true);
    expect(afterFirstHit.enemies[0].hitPoints).toBe(2);
    expect(afterFirstHit.score).toBe(0);

    const secondHitState: GameState = {
      ...afterFirstHit,
      bullets: [
        {
          owner: 'player',
          x: afterFirstHit.enemies[0].x,
          y: afterFirstHit.enemies[0].y,
          vy: 0
        }
      ]
    };

    const afterSecondHit = stepState(
      secondHitState,
      {
        moveAxisSigned: 0,
        moveAbsoluteUnit: null,
        firePressed: false,
        restartPressed: false
      }
    );

    expect(afterSecondHit.enemies[0].alive).toBe(true);
    expect(afterSecondHit.enemies[0].hitPoints).toBe(1);
    expect(afterSecondHit.score).toBe(0);

    const thirdHitState: GameState = {
      ...afterSecondHit,
      bullets: [
        {
          owner: 'player',
          x: afterSecondHit.enemies[0].x,
          y: afterSecondHit.enemies[0].y,
          vy: 0
        }
      ]
    };

    const afterThirdHit = stepState(
      thirdHitState,
      {
        moveAxisSigned: 0,
        moveAbsoluteUnit: null,
        firePressed: false,
        restartPressed: false
      }
    );

    expect(afterThirdHit.enemies[0].alive).toBe(false);
    expect(afterThirdHit.enemies[0].hitPoints).toBe(0);
    expect(afterThirdHit.score).toBe(ENEMY_UFO_SCORE);
  });

  it('starts gameplay only after fire in ready phase', () => {
    const state = createInitialState(23);

    const wait = stepState(
      state,
      {
        moveAxisSigned: 0,
        moveAbsoluteUnit: null,
        firePressed: false,
        restartPressed: false
      }
    );
    expect(wait.phase).toBe('ready');

    const start = stepState(
      state,
      {
        moveAxisSigned: 0,
        moveAbsoluteUnit: null,
        firePressed: true,
        restartPressed: false
      }
    );
    expect(start.phase).toBe('playing');
  });
});
