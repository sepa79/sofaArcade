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
  PLAYER_COLLISION_WIDTH
} from './constants';
import { createCollisionRuntime, createFilledAlphaMask } from './collision';
import { stepGame } from './logic';
import { playerLaneWorldY } from './player-lanes';
import { totalPlayerScore } from './score';
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
    moveLaneUpPressed: false,
    moveLaneDownPressed: false,
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

    expect(totalPlayerScore(next.players)).toBe(1);
    expect(next.enemies[0]?.alive).toBe(false);
    expect(next.players[0]?.score).toBe(1);
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
    expect(totalPlayerScore(next.players)).toBe(1);
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
    expect(totalPlayerScore(next.players)).toBe(1);
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
          y: playerLaneWorldY(player.lane),
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
      players: state.players.map((currentPlayer) =>
        currentPlayer.playerIndex === player.playerIndex
          ? {
              ...currentPlayer,
              hitStreak: 2,
              scoreMultiplier: 3
            }
          : currentPlayer
      ),
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

    expect(totalPlayerScore(next.players)).toBe(3);
    expect(next.players[0]?.hitStreak).toBe(3);
    expect(next.players[0]?.scoreMultiplier).toBe(4);
  });

  it('resets bonus multiplier on miss', () => {
    const state = createInitialState(22, 1);
    const player = state.players[0];

    const customState: GameState = {
      ...state,
      phase: 'playing',
      players: state.players.map((currentPlayer) =>
        currentPlayer.playerIndex === player.playerIndex
          ? {
              ...currentPlayer,
              hitStreak: 5,
              scoreMultiplier: 6
            }
          : currentPlayer
      ),
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

    expect(next.players[0]?.hitStreak).toBe(0);
    expect(next.players[0]?.scoreMultiplier).toBe(1);
  });

  it('resets only the hit player bonus multiplier when enemy bullet lands', () => {
    const state = createInitialState(24, 2);
    const firstPlayer = state.players[0];
    const secondPlayer = state.players[1];

    const customState: GameState = {
      ...state,
      phase: 'playing',
      players: state.players.map((player) =>
        player.playerIndex === firstPlayer.playerIndex
          ? {
              ...player,
              hitStreak: 4,
              scoreMultiplier: 5
            }
          : player.playerIndex === secondPlayer.playerIndex
            ? {
                ...player,
                hitStreak: 7,
                scoreMultiplier: 8
              }
            : player
      ),
      bullets: [
        {
          owner: 'enemy',
          playerIndex: null,
          x: secondPlayer.x,
          y: playerLaneWorldY(secondPlayer.lane),
          vy: 0
        }
      ]
    };

    const next = stepState(customState, [emptyInput(), emptyInput()]);

    expect(next.players[1].lives).toBe(2);
    expect(next.players[1]?.hitStreak).toBe(0);
    expect(next.players[1]?.scoreMultiplier).toBe(1);
    expect(next.players[0]?.hitStreak).toBe(4);
    expect(next.players[0]?.scoreMultiplier).toBe(5);
  });

  it('queues defeated rows before respawning them at the top', () => {
    const state = createInitialState(25, 1);
    const rowTarget = state.enemies[0];

    const customState: GameState = {
      ...state,
      phase: 'playing',
      enemies: state.enemies.map((enemy) =>
        enemy.id < ENEMY_COLS && enemy.id !== rowTarget.id
          ? {
              ...enemy,
              alive: false
            }
          : enemy
      ),
      bullets: [
        {
          owner: 'player',
          playerIndex: 0,
          x: rowTarget.x,
          y: rowTarget.y,
          vy: 0
        }
      ]
    };

    const queued = stepState(customState);
    expect(queued.pendingRowRespawns).toHaveLength(1);
    expect(queued.enemies.filter((enemy) => enemy.id < ENEMY_COLS).every((enemy) => !enemy.alive)).toBe(true);

    let next = queued;
    for (let index = 0; index < 40 && next.pendingRowRespawns.length > 0; index += 1) {
      next = stepState(next);
    }

    expect(next.pendingRowRespawns).toHaveLength(0);
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
    expect(totalPlayerScore(afterFirstHit.players)).toBe(0);

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
    expect(totalPlayerScore(afterSecondHit.players)).toBe(0);

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
    expect(totalPlayerScore(afterThirdHit.players)).toBe(ENEMY_UFO_SCORE);
  });

  it('starts gameplay when any player presses fire in explicit ready phase', () => {
    const state: GameState = {
      ...createInitialState(23, 2),
      phase: 'ready'
    };

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

  it('credits score and multiplier to the player who landed the kill', () => {
    const state = createInitialState(44, 2);
    const target = state.enemies[0];

    const customState: GameState = {
      ...state,
      phase: 'playing',
      bullets: [
        {
          owner: 'player',
          playerIndex: 1,
          x: target.x,
          y: target.y,
          vy: 0
        }
      ]
    };

    const next = stepState(customState, [emptyInput(), emptyInput()]);

    expect(next.players[0]?.score).toBe(0);
    expect(next.players[0]?.scoreMultiplier).toBe(1);
    expect(next.players[1]?.score).toBe(1);
    expect(next.players[1]?.scoreMultiplier).toBe(2);
    expect(totalPlayerScore(next.players)).toBe(1);
  });

  it('changes lanes one step at a time and clamps at the top lane', () => {
    const state = createInitialState(45, 1);
    const playingState: GameState = {
      ...state,
      phase: 'playing'
    };

    const midLane = stepState(playingState, [
      {
        ...emptyInput(),
        moveLaneUpPressed: true
      }
    ]);
    expect(midLane.players[0]?.lane).toBe('mid');

    const highLane = stepState(midLane, [
      {
        ...emptyInput(),
        moveLaneUpPressed: true
      }
    ]);
    expect(highLane.players[0]?.lane).toBe('high');

    const clamped = stepState(highLane, [
      {
        ...emptyInput(),
        moveLaneUpPressed: true
      }
    ]);
    expect(clamped.players[0]?.lane).toBe('high');
  });

  it('lets players share x in different lanes without separation', () => {
    const state = createInitialState(46, 2);
    const customState: GameState = {
      ...state,
      phase: 'playing',
      players: state.players.map((player) => ({
        ...player,
        x: 420
      }))
    };

    const next = stepState(customState, [emptyInput(), emptyInput()]);

    expect(next.players[0]?.x).toBe(420);
    expect(next.players[1]?.x).toBe(420);
  });

  it('resolves same-lane overlap by pushing the lower-momentum player farther away', () => {
    const state = createInitialState(47, 2);
    const customState: GameState = {
      ...state,
      phase: 'playing',
      players: [
        {
          ...state.players[0],
          lane: 'mid',
          x: 400,
          recentMovementMomentum: 2
        },
        {
          ...state.players[1],
          lane: 'mid',
          x: 430,
          recentMovementMomentum: 0
        }
      ]
    };

    const next = stepState(customState, [emptyInput(), emptyInput()]);

    expect(Math.abs(next.players[1].x - next.players[0].x)).toBeGreaterThanOrEqual(PLAYER_COLLISION_WIDTH);
    expect(next.players[1].x - 430).toBeGreaterThan(Math.abs(next.players[0].x - 400));
  });

  it('applies friendly fire only upward and only as x pushback', () => {
    const state = createInitialState(48, 2);
    const shooter = state.players[0];
    const target = state.players[1];

    const customState: GameState = {
      ...state,
      phase: 'playing',
      players: [
        {
          ...shooter,
          x: 360,
          lane: 'low'
        },
        {
          ...target,
          x: 360,
          lane: 'high'
        }
      ],
      bullets: [
        {
          owner: 'player',
          playerIndex: shooter.playerIndex,
          x: 360,
          y: playerLaneWorldY('high'),
          vy: 0
        }
      ]
    };

    const next = stepState(customState, [emptyInput(), emptyInput()]);

    expect(next.players[1]?.lives).toBe(target.lives);
    expect(next.players[1].pushbackVelocityX).toBeGreaterThan(0);
    expect(next.bullets).toHaveLength(0);
  });

  it('does not allow friendly fire downward from a higher lane', () => {
    const state = createInitialState(49, 2);
    const shooter = state.players[1];
    const target = state.players[0];

    const customState: GameState = {
      ...state,
      phase: 'playing',
      players: [
        {
          ...target,
          x: 360,
          lane: 'low'
        },
        {
          ...shooter,
          x: 360,
          lane: 'high'
        }
      ],
      bullets: [
        {
          owner: 'player',
          playerIndex: shooter.playerIndex,
          x: 360,
          y: playerLaneWorldY('low'),
          vy: 0
        }
      ]
    };

    const next = stepState(customState, [emptyInput(), emptyInput()]);

    expect(next.players[0]?.pushbackVelocityX).toBe(0);
    expect(next.bullets).toHaveLength(1);
  });
});
