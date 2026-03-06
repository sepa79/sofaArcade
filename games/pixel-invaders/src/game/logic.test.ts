import { describe, expect, it } from 'vitest';
import { createMatchInput } from '@light80/core';

import {
  BULLET_HEIGHT,
  BULLET_WIDTH,
  ENEMY_COLS,
  ENEMY_ROW_RESPAWN_Y,
  ENEMY_STANDARD_ACTIVE_HEIGHT,
  ENEMY_STANDARD_ACTIVE_WIDTH,
  ENEMY_UFO_ACTIVE_HEIGHT,
  ENEMY_UFO_ACTIVE_WIDTH,
  ENEMY_UFO_HIT_POINTS,
  ENEMY_UFO_SCORE,
  FIXED_TIMESTEP,
  PLAYER_ACTIVE_HEIGHT,
  PLAYER_ACTIVE_WIDTH,
  PLAYER_Y
} from './constants';
import { createCollisionRuntime, createFilledAlphaMask } from './collision';
import { stepGame } from './logic';
import { createInitialState } from './state';
import type { FrameInput, GameState } from './types';

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

function emptyInput(): FrameInput {
  return {
    moveAxisSigned: 0,
    moveAbsoluteUnit: null,
    firePressed: false,
    restartPressed: false
  };
}

function stepState(
  state: GameState,
  inputs: ReadonlyArray<FrameInput> = [emptyInput()]
): GameState {
  return stepGame(
    state,
    createMatchInput(
      state.players.map((player) => ({
        playerIndex: player.playerIndex,
        input: inputs[player.playerIndex] ?? emptyInput()
      }))
    ),
    FIXED_TIMESTEP,
    TEST_STEP_OPTIONS
  ).state;
}

describe('stepGame', () => {
  it('kills enemy and adds score when player bullet hits', () => {
    const state = createInitialState(7, 1);
    const target = state.enemies[0];
    const player = state.players[0];

    const customState: GameState = {
      ...state,
      phase: 'playing',
      bullets: [
        {
          owner: 'player',
          playerIndex: player.playerIndex,
          x: target.x,
          y: target.y,
          vy: 0
        }
      ]
    };

    const next = stepState(customState);

    expect(next.score).toBe(1);
    expect(next.enemies[0]?.alive).toBe(false);
  });

  it('counts side graze hit using bullet thickness, not bullet center only', () => {
    const state = createInitialState(18, 1);
    const target = state.enemies[0];
    const player = state.players[0];
    const grazeBulletX = target.x + ENEMY_STANDARD_ACTIVE_WIDTH / 2 + BULLET_WIDTH / 2 - 0.2;

    const customState: GameState = {
      ...state,
      phase: 'playing',
      bullets: [
        {
          owner: 'player',
          playerIndex: player.playerIndex,
          x: grazeBulletX,
          y: target.y,
          vy: 0
        }
      ]
    };

    const next = stepState(customState);

    expect(next.enemies[0]?.alive).toBe(false);
    expect(next.score).toBe(1);
  });

  it('detects swept bullet hit when bullet crosses enemy between frames', () => {
    const state = createInitialState(17, 1);
    const target = state.enemies[0];
    const player = state.players[0];

    const customState: GameState = {
      ...state,
      phase: 'playing',
      bullets: [
        {
          owner: 'player',
          playerIndex: player.playerIndex,
          x: target.x,
          y: target.y + 24,
          vy: -2000
        }
      ]
    };

    const next = stepState(customState);

    expect(next.enemies[0]?.alive).toBe(false);
    expect(next.score).toBe(1);
  });

  it('reduces life when enemy bullet hits player', () => {
    const state = createInitialState(12, 1);
    const player = state.players[0];

    const customState: GameState = {
      ...state,
      phase: 'playing',
      bullets: [
        {
          owner: 'enemy',
          playerIndex: null,
          x: player.x,
          y: PLAYER_Y,
          vy: 0
        }
      ]
    };

    const next = stepState(customState);

    expect(next.players[0]?.lives).toBe(2);
  });

  it('drops enemies when formation reaches boundary', () => {
    const state = createInitialState(3, 1);

    const nearEdgeState: GameState = {
      ...state,
      phase: 'playing',
      enemies: state.enemies.map((enemy) => ({
        ...enemy,
        x: enemy.x + 400
      }))
    };

    const next = stepState(nearEdgeState);

    expect(next.enemyDirection).toBe(-1);
    expect(next.enemies[0].y).toBeGreaterThan(nearEdgeState.enemies[0].y);
  });

  it('supports absolute paddle-like movement', () => {
    const state = createInitialState(20, 1);
    const player = state.players[0];

    const next = stepState(
      {
        ...state,
        phase: 'playing'
      },
      [
        {
          ...emptyInput(),
          moveAbsoluteUnit: 1
        }
      ]
    );

    expect(next.players[0].x).toBeGreaterThan(player.x);
  });

  it('increases bonus multiplier with consecutive hits', () => {
    const state = createInitialState(21, 1);
    const target = state.enemies[0];
    const player = state.players[0];

    const customState: GameState = {
      ...state,
      phase: 'playing',
      hitStreak: 2,
      scoreMultiplier: 3,
      bullets: [
        {
          owner: 'player',
          playerIndex: player.playerIndex,
          x: target.x,
          y: target.y,
          vy: 0
        }
      ]
    };

    const next = stepState(customState);

    expect(next.score).toBe(3);
    expect(next.hitStreak).toBe(3);
    expect(next.scoreMultiplier).toBe(4);
  });

  it('resets bonus multiplier on miss', () => {
    const state = createInitialState(22, 1);
    const player = state.players[0];

    const customState: GameState = {
      ...state,
      phase: 'playing',
      hitStreak: 5,
      scoreMultiplier: 6,
      bullets: [
        {
          owner: 'player',
          playerIndex: player.playerIndex,
          x: player.x,
          y: -BULLET_HEIGHT - 1,
          vy: 0
        }
      ]
    };

    const next = stepState(customState);

    expect(next.hitStreak).toBe(0);
    expect(next.scoreMultiplier).toBe(1);
  });

  it('resets bonus multiplier when any player gets hit', () => {
    const state = createInitialState(24, 2);
    const secondPlayer = state.players[1];

    const customState: GameState = {
      ...state,
      phase: 'playing',
      hitStreak: 7,
      scoreMultiplier: 8,
      bullets: [
        {
          owner: 'enemy',
          playerIndex: null,
          x: secondPlayer.x,
          y: PLAYER_Y,
          vy: 0
        }
      ]
    };

    const next = stepState(customState, [emptyInput(), emptyInput()]);

    expect(next.players[1].lives).toBe(2);
    expect(next.hitStreak).toBe(0);
    expect(next.scoreMultiplier).toBe(1);
  });

  it('respawns defeated rows at the top in endless mode', () => {
    const state = createInitialState(25, 1);

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

    const next = stepState(customState);

    const rowEnemies = next.enemies.filter((enemy) => enemy.id < ENEMY_COLS);
    expect(rowEnemies.every((enemy) => enemy.alive)).toBe(true);
    expect(rowEnemies.every((enemy) => enemy.y === ENEMY_ROW_RESPAWN_Y)).toBe(true);
    expect(next.phase).toBe('playing');
  });

  it('requires three hits to destroy ufo enemy', () => {
    const state = createInitialState(31, 1);
    const firstEnemy = state.enemies[0];
    const player = state.players[0];

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
          playerIndex: player.playerIndex,
          x: firstEnemy.x,
          y: firstEnemy.y,
          vy: 0
        }
      ]
    };

    const afterFirstHit = stepState(ufoState);

    expect(afterFirstHit.enemies[0].alive).toBe(true);
    expect(afterFirstHit.enemies[0].hitPoints).toBe(2);
    expect(afterFirstHit.score).toBe(0);

    const secondHitState: GameState = {
      ...afterFirstHit,
      bullets: [
        {
          owner: 'player',
          playerIndex: player.playerIndex,
          x: afterFirstHit.enemies[0].x,
          y: afterFirstHit.enemies[0].y,
          vy: 0
        }
      ]
    };

    const afterSecondHit = stepState(secondHitState);

    expect(afterSecondHit.enemies[0].alive).toBe(true);
    expect(afterSecondHit.enemies[0].hitPoints).toBe(1);
    expect(afterSecondHit.score).toBe(0);

    const thirdHitState: GameState = {
      ...afterSecondHit,
      bullets: [
        {
          owner: 'player',
          playerIndex: player.playerIndex,
          x: afterSecondHit.enemies[0].x,
          y: afterSecondHit.enemies[0].y,
          vy: 0
        }
      ]
    };

    const afterThirdHit = stepState(thirdHitState);

    expect(afterThirdHit.enemies[0].alive).toBe(false);
    expect(afterThirdHit.enemies[0].hitPoints).toBe(0);
    expect(afterThirdHit.score).toBe(ENEMY_UFO_SCORE);
  });

  it('starts gameplay when any player presses fire in ready phase', () => {
    const state = createInitialState(23, 2);

    const wait = stepState(state, [emptyInput(), emptyInput()]);
    expect(wait.phase).toBe('ready');

    const start = stepState(state, [
      emptyInput(),
      {
        ...emptyInput(),
        firePressed: true
      }
    ]);
    expect(start.phase).toBe('playing');
  });

  it('lets two players move and shoot independently', () => {
    const state = createInitialState(41, 2);
    const playingState: GameState = {
      ...state,
      phase: 'playing'
    };

    const next = stepState(playingState, [
      {
        ...emptyInput(),
        moveAxisSigned: -1,
        firePressed: true
      },
      {
        ...emptyInput(),
        moveAxisSigned: 1,
        firePressed: true
      }
    ]);

    expect(next.players[0].x).toBeLessThan(playingState.players[0].x);
    expect(next.players[1].x).toBeGreaterThan(playingState.players[1].x);
    const playerBullets = next.bullets.filter((bullet) => bullet.owner === 'player');
    expect(playerBullets).toHaveLength(2);
    expect(playerBullets.map((bullet) => bullet.playerIndex).sort()).toEqual([0, 1]);
  });
});
