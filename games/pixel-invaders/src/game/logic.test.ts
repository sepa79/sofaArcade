import { describe, expect, it } from 'vitest';
import { createMatchInput } from '@light80/core';

import {
  BULLET_HEIGHT,
  BULLET_WIDTH,
  ENEMY_STANDARD_ACTIVE_HEIGHT,
  ENEMY_STANDARD_ACTIVE_WIDTH,
  ENEMY_UFO_ACTIVE_HEIGHT,
  ENEMY_UFO_ACTIVE_WIDTH,
  ENEMY_UFO_HIT_POINTS,
  ENEMY_UFO_SCORE,
  ENEMY_WIDTH,
  FIXED_TIMESTEP,
  PLAYER_RAPID_FIRE_TAP_SHOOT_COOLDOWN,
  PLAYER_ACTIVE_HEIGHT,
  PLAYER_ACTIVE_WIDTH,
  PLAYER_COLLISION_WIDTH,
  PLAYER_SHOOT_COOLDOWN,
  PLAYER_TAP_SHOOT_COOLDOWN,
  WORLD_WIDTH
} from './constants';
import { createCollisionRuntime, createFilledAlphaMask } from './collision';
import { stepGame } from './logic';
import { playerLaneWorldY } from './player-lanes';
import { totalPlayerScore } from './score';
import { createInitialState } from './state';
import type { FrameInput, GameState } from './types';
import {
  advanceCampaignState,
  CLASSIC_START_ROWS,
  CLASSIC_TOTAL_ROWS,
  enemyFireIntervalForCampaign,
  GALAGA_TOTAL_ROWS,
  spawnGalagaRow
} from './waves';

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
    moveLaneTarget: null,
    moveLaneUpPressed: false,
    moveLaneDownPressed: false,
    firePressed: false,
    fireJustPressed: false,
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

  it('ends the game cleanly when an enemy bullet kills the last living player', () => {
    const state = createInitialState(12, 1);
    const player = state.players[0];

    const customState: GameState = {
      ...state,
      phase: 'playing',
      players: state.players.map((currentPlayer) =>
        currentPlayer.playerIndex === player.playerIndex
          ? {
              ...currentPlayer,
              lives: 1
            }
          : currentPlayer
      ),
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

    expect(next.phase).toBe('lost');
    expect(next.players[0]?.lives).toBe(0);
  });

  it('consumes shield instead of life on enemy bullet hit', () => {
    const state = createInitialState(13, 1);
    const player = state.players[0];

    const customState: GameState = {
      ...state,
      phase: 'playing',
      players: state.players.map((currentPlayer) =>
        currentPlayer.playerIndex === player.playerIndex
          ? {
              ...currentPlayer,
              activePowerups: [
                {
                  kind: 'shield',
                  remainingSec: 10
                }
              ]
            }
          : currentPlayer
      ),
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

    expect(next.players[0]?.lives).toBe(player.lives);
    expect(next.players[0]?.activePowerups).toHaveLength(0);
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

  it('allows another shot while an earlier bullet is still on screen', () => {
    const state = createInitialState(24, 1);
    const player = state.players[0];

    const customState: GameState = {
      ...state,
      phase: 'playing',
      bullets: [
        {
          owner: 'player',
          playerIndex: player.playerIndex,
          x: player.x,
          y: playerLaneWorldY(player.lane) - 100,
          vy: -200
        }
      ]
    };

    const next = stepState(customState, [
      {
        ...emptyInput(),
        firePressed: true,
        fireJustPressed: true
      }
    ]);

    expect(next.bullets.filter((bullet) => bullet.owner === 'player')).toHaveLength(2);
    expect(next.players[0]?.shootTimer).toBe(PLAYER_TAP_SHOOT_COOLDOWN);
  });

  it('lets rapid fire stack shots while earlier bullets are still on screen', () => {
    const state = createInitialState(24, 1);
    const player = state.players[0];

    const customState: GameState = {
      ...state,
      phase: 'playing',
      players: state.players.map((currentPlayer) =>
        currentPlayer.playerIndex === player.playerIndex
          ? {
              ...currentPlayer,
              activePowerups: [
                {
                  kind: 'rapid-fire',
                  remainingSec: 10
                }
              ]
            }
          : currentPlayer
      ),
      bullets: [
        {
          owner: 'player',
          playerIndex: player.playerIndex,
          x: player.x,
          y: playerLaneWorldY(player.lane) - 100,
          vy: -200
        }
      ]
    };

    const next = stepState(customState, [
      {
        ...emptyInput(),
        firePressed: true,
        fireJustPressed: true
      }
    ]);

    expect(next.bullets.filter((bullet) => bullet.owner === 'player')).toHaveLength(2);
    expect(next.players[0]?.shootTimer).toBe(PLAYER_RAPID_FIRE_TAP_SHOOT_COOLDOWN);
  });

  it('uses a shorter cooldown for tap fire than hold fire', () => {
    const state = createInitialState(24, 1);

    const heldShot = stepState(
      {
        ...state,
        phase: 'playing'
      },
      [
        {
          ...emptyInput(),
          firePressed: true
        }
      ]
    );
    const tappedShot = stepState(
      {
        ...state,
        phase: 'playing'
      },
      [
        {
          ...emptyInput(),
          firePressed: true,
          fireJustPressed: true
        }
      ]
    );

    expect(heldShot.players[0]?.shootTimer).toBe(PLAYER_SHOOT_COOLDOWN);
    expect(tappedShot.players[0]?.shootTimer).toBe(PLAYER_TAP_SHOOT_COOLDOWN);
    expect(tappedShot.players[0]?.shootTimer).toBeLessThan(heldShot.players[0]?.shootTimer ?? Number.POSITIVE_INFINITY);
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

  it('counts cleared classic rows and respawns until all ten are spent', () => {
    const state = createInitialState(25, 1);
    const rowTarget = state.enemies[0];

    const customState: GameState = {
      ...state,
      phase: 'playing',
      enemies: state.enemies.map((enemy) =>
        enemy.id !== rowTarget.id
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

    const transitioned = stepState(customState);
    if (transitioned.campaign.phase !== 'classic-endless') {
      throw new Error('Expected classic-endless campaign state.');
    }
    expect(transitioned.phase).toBe('playing');
    expect(transitioned.campaign.rowsCleared).toBe(1);
    expect(transitioned.campaign.rowsSpawned).toBe(CLASSIC_START_ROWS);
    expect(transitioned.pendingRowRespawns).toHaveLength(1);

    let spawned = transitioned;
    for (let index = 0; index < 120 && spawned.pendingRowRespawns.length > 0; index += 1) {
      spawned = stepState(spawned);
    }

    if (spawned.campaign.phase !== 'classic-endless') {
      throw new Error('Expected classic-endless campaign state after respawn.');
    }
    expect(spawned.phase).toBe('playing');
    expect(spawned.pendingRowRespawns).toHaveLength(0);
    expect(spawned.campaign.rowsSpawned).toBe(CLASSIC_START_ROWS + 1);
    expect(spawned.enemies.filter((enemy) => enemy.alive)).toHaveLength(9);
  });

  it('switches from classic endless to galaga rows after the tenth cleared row', () => {
    const state = createInitialState(26, 1);
    const target = state.enemies[0];
    const waveTen: GameState = {
      ...state,
      phase: 'playing',
      campaign: {
        phase: 'classic-endless',
        rowsCleared: CLASSIC_TOTAL_ROWS - 1,
        rowsSpawned: CLASSIC_TOTAL_ROWS,
        rowsTarget: CLASSIC_TOTAL_ROWS,
        startRows: CLASSIC_START_ROWS,
        transitionTimerSec: 0
      },
      pendingRowRespawns: [],
      bullets: [
        {
          owner: 'player',
          playerIndex: 0,
          x: target.x,
          y: target.y,
          vy: 0
        }
      ],
      enemies: state.enemies.map((enemy) =>
        enemy.id === target.id
          ? enemy
          : {
              ...enemy,
              alive: false
            }
      )
    };

    const next = stepState(waveTen);

    expect(next.phase).toBe('playing');
    expect(next.campaign.phase).toBe('galaga-rows');
    if (next.campaign.phase !== 'galaga-rows') {
      throw new Error('Expected galaga-rows campaign state.');
    }
    expect(next.campaign.currentRowNumber).toBe(1);
    expect(next.campaign.transitionTimerSec).toBeGreaterThan(0);
  });

  it('launches dive attacks during galaga rows', () => {
    const state = createInitialState(27, 1);
    const campaign = advanceCampaignState({
      phase: 'classic-endless',
      rowsCleared: CLASSIC_TOTAL_ROWS,
      rowsSpawned: CLASSIC_TOTAL_ROWS,
      rowsTarget: CLASSIC_TOTAL_ROWS,
      startRows: CLASSIC_START_ROWS,
      transitionTimerSec: 0
    });
    if (campaign.phase !== 'galaga-rows') {
      throw new Error('Expected galaga-rows campaign state.');
    }
    const diveWave = spawnGalagaRow(
      {
        ...campaign,
        transitionTimerSec: 0
      },
      false
    );
    let next: GameState = {
      ...state,
      phase: 'playing',
      campaign,
      enemies: diveWave.enemies,
      enemySpeed: diveWave.enemySpeed,
      enemyFireTimer: enemyFireIntervalForCampaign(campaign),
      enemyDiveTimer: FIXED_TIMESTEP,
      pendingRowRespawns: []
    };

    for (let index = 0; index < 180; index += 1) {
      next = stepState(next);
      if (next.enemies.some((enemy) => enemy.motion.kind === 'path' && enemy.motion.path === 'attack')) {
        break;
      }
    }

    expect(next.enemies.some((enemy) => enemy.motion.kind === 'path' && enemy.motion.path === 'attack')).toBe(true);
  });

  it('enters boss-ready state after the final galaga row is cleared', () => {
    const state = createInitialState(28, 1);
    const target = state.enemies[0];
    const finalWave: GameState = {
      ...state,
      phase: 'playing',
      campaign: {
        phase: 'galaga-rows',
        rowsCleared: GALAGA_TOTAL_ROWS - 1,
        currentRowNumber: GALAGA_TOTAL_ROWS,
        rowsTarget: GALAGA_TOTAL_ROWS,
        transitionTimerSec: 0
      },
      pendingRowRespawns: [],
      bullets: [
        {
          owner: 'player',
          playerIndex: 0,
          x: target.x,
          y: target.y,
          vy: 0
        }
      ],
      enemies: state.enemies.map((enemy) =>
        enemy.id === target.id
          ? enemy
          : {
              ...enemy,
              alive: false
            }
      )
    };

    const next = stepState(finalWave);

    expect(next.phase).toBe('boss-ready');
    expect(next.campaign.phase).toBe('boss');
    expect(next.enemies).toHaveLength(0);
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

  it('spawns a pickup when ufo is destroyed', () => {
    const state = createInitialState(62, 1);
    const target = state.enemies[0];
    const player = state.players[0];

    const customState: GameState = {
      ...state,
      phase: 'playing',
      enemies: state.enemies.map((enemy) =>
        enemy.id === target.id
          ? {
              ...enemy,
              kind: 'ufo',
              scoreValue: ENEMY_UFO_SCORE,
              hitPoints: 1
            }
          : enemy
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

    expect(next.pickups).toHaveLength(1);
    expect(next.nextPickupId).toBe(1);
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

  it('does not trigger game over while enemies are only at a higher occupied lane', () => {
    const state = createInitialState(50, 2);
    const highLaneFrontline = playerLaneWorldY('high') - PLAYER_ACTIVE_HEIGHT;
    const lowLaneFrontline = playerLaneWorldY('low') - PLAYER_ACTIVE_HEIGHT;

    const customState: GameState = {
      ...state,
      phase: 'playing',
      players: [
        {
          ...state.players[0],
          lane: 'high'
        },
        {
          ...state.players[1],
          lane: 'low'
        }
      ],
      enemies: state.enemies.map((enemy, index) =>
        index === 0
          ? {
              ...enemy,
              y: highLaneFrontline - ENEMY_STANDARD_ACTIVE_HEIGHT / 2 + 2
            }
          : enemy
      )
    };

    const next = stepState(customState, [emptyInput(), emptyInput()]);

    expect(
      next.enemies[0].y + ENEMY_STANDARD_ACTIVE_HEIGHT / 2
    ).toBeGreaterThanOrEqual(highLaneFrontline);
    expect(
      next.enemies[0].y + ENEMY_STANDARD_ACTIVE_HEIGHT / 2
    ).toBeLessThan(lowLaneFrontline);
    expect(next.phase).toBe('playing');
  });

  it('does not trigger game over when the last living player moves to the high lane and lands a hit', () => {
    const state = createInitialState(51, 1);
    const highLaneFrontline = playerLaneWorldY('high') - PLAYER_ACTIVE_HEIGHT;
    const lowLaneFrontline = playerLaneWorldY('low') - PLAYER_ACTIVE_HEIGHT;
    const survivor = state.enemies[0];
    const shotTarget = state.enemies[1];

    const customState: GameState = {
      ...state,
      phase: 'playing',
      players: state.players.map((player) => ({
        ...player,
        lane: 'high'
      })),
      enemies: state.enemies.map((enemy) =>
        enemy.id === survivor.id
          ? {
              ...enemy,
              y: highLaneFrontline - ENEMY_STANDARD_ACTIVE_HEIGHT / 2 + 2
            }
          : enemy.id === shotTarget.id
            ? enemy
            : {
                ...enemy,
                alive: false
              }
      ),
      bullets: [
        {
          owner: 'player',
          playerIndex: 0,
          x: shotTarget.x,
          y: shotTarget.y,
          vy: 0
        }
      ]
    };

    const next = stepState(customState);

    expect(
      next.enemies[0].y + ENEMY_STANDARD_ACTIVE_HEIGHT / 2
    ).toBeGreaterThanOrEqual(highLaneFrontline);
    expect(
      next.enemies[0].y + ENEMY_STANDARD_ACTIVE_HEIGHT / 2
    ).toBeLessThan(lowLaneFrontline);
    expect(next.enemies[0]?.alive).toBe(true);
    expect(next.enemies[1]?.alive).toBe(false);
    expect(next.phase).toBe('playing');
  });

  it('does not trigger game over from a galaga attacker reaching the player defense line', () => {
    const state = createInitialState(54, 1);
    const defenseLine = playerLaneWorldY('low') - PLAYER_ACTIVE_HEIGHT;
    const attacker = state.enemies[0];
    const campaign = advanceCampaignState({
      phase: 'classic-endless',
      rowsCleared: CLASSIC_TOTAL_ROWS,
      rowsSpawned: CLASSIC_TOTAL_ROWS,
      rowsTarget: CLASSIC_TOTAL_ROWS,
      startRows: CLASSIC_START_ROWS,
      transitionTimerSec: 0
    });
    if (campaign.phase !== 'galaga-rows') {
      throw new Error('Expected galaga-rows campaign state.');
    }

    const customState: GameState = {
      ...state,
      phase: 'playing',
      campaign,
      enemies: state.enemies.map((enemy) =>
        enemy.id === attacker.id
          ? {
              ...enemy,
              y: defenseLine + ENEMY_STANDARD_ACTIVE_HEIGHT / 2 + 6,
              motion: {
                kind: 'path',
                path: 'attack',
                elapsedSec: 0.4,
                durationSec: 1.5,
                startX: enemy.x,
                startY: enemy.y,
                targetX: enemy.x,
                targetY: enemy.y,
                swayAmplitudeX: 60,
                swayCycles: 2,
                loopDepthY: 180
              }
            }
          : {
              ...enemy,
              alive: false
            }
      )
    };

    const next = stepState(customState);

    expect(next.phase).toBe('playing');
  });

  it('respawns a cleared classic row from a safe formation anchor after an empty screen', () => {
    const state = createInitialState(52, 1);

    let next: GameState = {
      ...state,
      phase: 'playing',
      campaign: {
        phase: 'classic-endless',
        rowsCleared: 1,
        rowsSpawned: CLASSIC_START_ROWS,
        rowsTarget: CLASSIC_TOTAL_ROWS,
        startRows: CLASSIC_START_ROWS,
        transitionTimerSec: 0
      },
      enemies: state.enemies.map((enemy) => ({
        ...enemy,
        alive: false,
        x: enemy.x + 800
      })),
      pendingRowRespawns: [
        {
          rowIndex: 0,
          queuedAtTimeSec: 0,
          notBeforeTimeSec: 0
        }
      ]
    };

    next = stepState(next);

    const respawnedRow = next.enemies.filter((enemy) => enemy.alive && enemy.id < 9);
    expect(respawnedRow).toHaveLength(9);
    expect(respawnedRow.every((enemy) => enemy.x >= ENEMY_WIDTH / 2)).toBe(true);
    expect(respawnedRow.every((enemy) => enemy.x <= WORLD_WIDTH - ENEMY_WIDTH / 2)).toBe(true);
    expect(respawnedRow.every((enemy) => enemy.y < 100)).toBe(true);
    expect(next.enemyDirection).toBe(1);
    expect(next.enemySpeed).toBeGreaterThan(0);
    expect(next.phase).toBe('playing');
  });

  it('resets classic formation movement when a respawn returns to an empty screen', () => {
    const state = createInitialState(53, 1);
    const restartedClassic: GameState = {
      ...state,
      phase: 'playing',
      campaign: {
        phase: 'classic-endless',
        rowsCleared: 6,
        rowsSpawned: CLASSIC_START_ROWS + 2,
        rowsTarget: CLASSIC_TOTAL_ROWS,
        startRows: CLASSIC_START_ROWS,
        transitionTimerSec: 0
      },
      enemies: state.enemies.map((enemy) => ({
        ...enemy,
        alive: false
      })),
      enemyDirection: -1,
      enemySpeed: 999,
      enemyFireTimer: 0,
      pendingRowRespawns: [
        {
          rowIndex: 1,
          queuedAtTimeSec: 0,
          notBeforeTimeSec: 0
        }
      ]
    };

    const next = stepState(restartedClassic);

    if (next.campaign.phase !== 'classic-endless') {
      throw new Error('Expected classic-endless campaign state after empty-screen respawn.');
    }
    expect(next.enemyDirection).toBe(1);
    expect(next.enemySpeed).toBeGreaterThan(0);
    expect(next.enemySpeed).toBeLessThan(999);
    expect(next.enemyFireTimer).toBeGreaterThan(0);
    expect(next.enemies.some((enemy) => enemy.alive)).toBe(true);
    expect(next.phase).toBe('playing');
  });
});
