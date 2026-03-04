import { describe, expect, it } from 'vitest';

import {
  BULLET_DEPTH_SPEED,
  ENEMY_BULLET_DEPTH_SPEED,
  ENEMY_COUNT,
  ENEMY_LARGE_COUNT,
  FIXED_TIMESTEP
} from './constants';
import { stepGame } from './logic';
import { createInitialState } from './state';
import type { GameState } from './types';

function shortestAngleDelta(fromTheta: number, toTheta: number): number {
  const twoPi = Math.PI * 2;
  const wrapped = ((toTheta - fromTheta) % twoPi + twoPi) % twoPi;
  return wrapped > Math.PI ? wrapped - twoPi : wrapped;
}

describe('stepGame (tunnel invaders depth model)', () => {
  it('starts game from ready on start press', () => {
    const initial = createInitialState();

    const next = stepGame(
      initial,
      {
        moveXSigned: 0,
        fireHeld: false,
        jumpPressed: false,
        pausePressed: false,
        startPressed: true
      },
      FIXED_TIMESTEP
    );

    expect(next.phase).toBe('playing');
  });

  it('moves player angle while playing', () => {
    const base = {
      ...createInitialState(),
      phase: 'playing' as const
    };

    const next = stepGame(
      base,
      {
        moveXSigned: 1,
        fireHeld: false,
        jumpPressed: false,
        pausePressed: false,
        startPressed: false
      },
      FIXED_TIMESTEP
    );

    expect(next.playerTheta).not.toBe(base.playerTheta);
  });

  it('moves enemy formation in X while preserving row spacing', () => {
    const base = {
      ...createInitialState('spread'),
      phase: 'playing' as const
    };

    const next = stepGame(
      base,
      {
        moveXSigned: 0,
        fireHeld: false,
        jumpPressed: false,
        pausePressed: false,
        startPressed: false
      },
      FIXED_TIMESTEP
    );

    expect(next.enemyFormationCenterTheta).not.toBe(base.enemyFormationCenterTheta);
    expect(next.enemyFormationDirection).toBe(base.enemyFormationDirection);

    const baseEnemyA = base.enemies[0];
    const baseEnemyB = base.enemies[1];
    const nextEnemyA = next.enemies[0];
    const nextEnemyB = next.enemies[1];
    const baseSpacing = shortestAngleDelta(baseEnemyA.theta, baseEnemyB.theta);
    const nextSpacing = shortestAngleDelta(nextEnemyA.theta, nextEnemyB.theta);

    expect(nextSpacing).toBeCloseTo(baseSpacing, 4);
    expect(nextEnemyA.depth).toBeLessThan(baseEnemyA.depth);
    expect(nextEnemyB.depth).toBeLessThan(baseEnemyB.depth);
  });

  it('kills enemy and awards score when bullet intersects angle and depth', () => {
    const initial = createInitialState('spread');
    const target = initial.enemies[1];
    const targetTheta = 1;
    const targetDepth = 0.5;
    const movementOnlyState: GameState = {
      ...initial,
      phase: 'playing',
      enemies: initial.enemies.map((enemy, index) =>
        index === 1
          ? {
              ...enemy,
              laneTheta: targetTheta,
              theta: targetTheta,
              depth: targetDepth,
              alive: true
            }
          : {
              ...enemy,
              alive: false
            }
      ),
      bullets: []
    };

    const afterMove = stepGame(
      movementOnlyState,
      {
        moveXSigned: 0,
        fireHeld: false,
        jumpPressed: false,
        pausePressed: false,
        startPressed: false
      },
      FIXED_TIMESTEP
    );
    const movedTarget = afterMove.enemies[target.id];
    const bulletDepthBeforeMove = movedTarget.depth - BULLET_DEPTH_SPEED * FIXED_TIMESTEP;
    const base: GameState = {
      ...movementOnlyState,
      bullets: [
        {
          theta: movedTarget.theta,
          depth: bulletDepthBeforeMove,
          depthVelocity: BULLET_DEPTH_SPEED,
          ttl: 1,
          owner: 'player'
        }
      ]
    };

    const next = stepGame(
      base,
      {
        moveXSigned: 0,
        fireHeld: false,
        jumpPressed: false,
        pausePressed: false,
        startPressed: false
      },
      FIXED_TIMESTEP
    );

    expect(next.score).toBe(100);
    expect(next.enemies).toHaveLength(ENEMY_COUNT + ENEMY_LARGE_COUNT);
    expect(next.enemies.find((enemy) => enemy.id === target.id)).toBeUndefined();
  });

  it('uses dynamic hit arc by enemy depth (same offset hits near, misses far)', () => {
    const initial = createInitialState('spread');
    const thetaBase = 1;
    const finalAngleOffset = 0.011;
    const finalDepthOffset = 0.005;

    const runShot = (enemyDepth: number): GameState => {
      const stateBeforeShot: GameState = {
        ...initial,
        phase: 'playing',
        enemies: initial.enemies.map((enemy, index) =>
          index === 1
            ? {
                ...enemy,
                laneTheta: thetaBase,
                theta: thetaBase,
                depth: enemyDepth,
                alive: true
              }
            : {
                ...enemy,
                alive: false
            }
        ),
        bullets: []
      };

      const projected = stepGame(
        stateBeforeShot,
        {
          moveXSigned: 0,
          fireHeld: false,
          jumpPressed: false,
          pausePressed: false,
          startPressed: false
        },
        FIXED_TIMESTEP
      );
      const movedTarget = projected.enemies[1];

      const bulletDepth = movedTarget.depth - BULLET_DEPTH_SPEED * FIXED_TIMESTEP - finalDepthOffset;
      const bulletTheta = movedTarget.theta - finalAngleOffset;
      const armedState: GameState = {
        ...stateBeforeShot,
        bullets: [
          {
            theta: bulletTheta,
            depth: bulletDepth,
            depthVelocity: BULLET_DEPTH_SPEED,
            ttl: 1,
            owner: 'player'
          }
        ]
      };

      return stepGame(
        armedState,
        {
          moveXSigned: 0,
          fireHeld: false,
          jumpPressed: false,
          pausePressed: false,
          startPressed: false
        },
        FIXED_TIMESTEP
      );
    };

    const near = runShot(0.08);
    const far = runShot(0.92);

    expect(near.score).toBe(100);
    expect(far.score).toBe(0);
  });

  it('reduces shield when enemy reaches edge in player sector', () => {
    const initial = createInitialState();

    const state: GameState = {
      ...initial,
      phase: 'playing',
      enemies: initial.enemies.map((enemy, index) =>
        index === 0
          ? {
              ...enemy,
              laneTheta: 0,
              theta: initial.playerTheta,
              depth: 0.001,
              alive: true
            }
          : {
              ...enemy,
              alive: false
            }
      )
    };

    const next = stepGame(
      state,
      {
        moveXSigned: 0,
        fireHeld: false,
        jumpPressed: false,
        pausePressed: false,
        startPressed: false
      },
      FIXED_TIMESTEP
    );

    expect(next.lives).toBe(initial.lives);
    expect(next.playerShield).toBeLessThan(initial.playerShield);
  });

  it('keeps life when enemy reaches edge during jump phase', () => {
    const initial = createInitialState();

    const state: GameState = {
      ...initial,
      phase: 'playing',
      playerJumpTimer: 0.1,
      enemies: initial.enemies.map((enemy, index) =>
        index === 0
          ? {
              ...enemy,
              laneTheta: 0,
              theta: initial.playerTheta,
              depth: 0.001,
              alive: true
            }
          : {
              ...enemy,
              alive: false
            }
      )
    };

    const next = stepGame(
      state,
      {
        moveXSigned: 0,
        fireHeld: false,
        jumpPressed: false,
        pausePressed: false,
        startPressed: false
      },
      FIXED_TIMESTEP
    );

    expect(next.lives).toBe(initial.lives);
  });

  it('toggles pause on pause press', () => {
    const base = {
      ...createInitialState(),
      phase: 'playing' as const
    };

    const paused = stepGame(
      base,
      {
        moveXSigned: 0,
        fireHeld: false,
        jumpPressed: false,
        pausePressed: true,
        startPressed: false
      },
      FIXED_TIMESTEP
    );

    expect(paused.phase).toBe('paused');

    const resumed = stepGame(
      paused,
      {
        moveXSigned: 0,
        fireHeld: false,
        jumpPressed: false,
        pausePressed: true,
        startPressed: false
      },
      FIXED_TIMESTEP
    );

    expect(resumed.phase).toBe('playing');
  });

  it('spawns a new wave when the last enemy leaves behind the player', () => {
    const initial = createInitialState();
    const state: GameState = {
      ...initial,
      phase: 'playing',
      enemies: [
        {
          ...initial.enemies[0],
          enemyClass: 'large',
          depth: -0.719,
          alive: true,
          shootCooldown: 0
        }
      ]
    };

    const next = stepGame(
      state,
      {
        moveXSigned: 0,
        fireHeld: false,
        jumpPressed: false,
        pausePressed: false,
        startPressed: false
      },
      FIXED_TIMESTEP
    );

    expect(next.phase).toBe('playing');
    expect(next.enemies).toHaveLength(ENEMY_COUNT + ENEMY_LARGE_COUNT);
    expect(next.enemies.every((enemy) => enemy.alive)).toBe(true);
    expect(next.nextEnemyId).toBe(state.nextEnemyId + ENEMY_COUNT + ENEMY_LARGE_COUNT);
  });

  it('enemy bullet can reduce shield when crossing player depth', () => {
    const initial = createInitialState();
    const state: GameState = {
      ...initial,
      phase: 'playing',
      enemies: initial.enemies.map((enemy) => ({
        ...enemy,
        alive: false
      })),
      bullets: [
        {
          theta: initial.playerTheta,
          depth: -0.01,
          depthVelocity: ENEMY_BULLET_DEPTH_SPEED,
          ttl: 1,
          owner: 'enemy'
        }
      ]
    };

    const next = stepGame(
      state,
      {
        moveXSigned: 0,
        fireHeld: false,
        jumpPressed: false,
        pausePressed: false,
        startPressed: false
      },
      FIXED_TIMESTEP
    );

    expect(next.lives).toBe(initial.lives);
    expect(next.playerShield).toBeLessThan(initial.playerShield);
  });
});
