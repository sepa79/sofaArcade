import { describe, expect, it } from 'vitest';

import {
  BULLET_DEPTH_SPEED,
  ENEMY_ANGULAR_SPEED,
  ENEMY_BULLET_DEPTH_SPEED,
  ENEMY_DEPTH_SPEED,
  FIXED_TIMESTEP
} from './constants';
import { stepGame } from './logic';
import { createInitialState } from './state';
import type { GameState } from './types';

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
    expect(next.enemies[target.id].alive).toBe(false);
  });

  it('uses dynamic hit arc by enemy depth (same offset hits near, misses far)', () => {
    const initial = createInitialState('spread');
    const thetaBase = 1;
    const angleStep = ENEMY_ANGULAR_SPEED * FIXED_TIMESTEP;
    const finalAngleOffset = 0.011;
    const finalDepthOffset = 0.005;
    const depthStep = (BULLET_DEPTH_SPEED + ENEMY_DEPTH_SPEED) * FIXED_TIMESTEP;

    const runShot = (enemyDepth: number): GameState => {
      const bulletDepth = enemyDepth - depthStep - finalDepthOffset;
      const bulletTheta = thetaBase + angleStep - finalAngleOffset;
      const state: GameState = {
        ...initial,
        phase: 'playing',
        enemies: initial.enemies.map((enemy, index) =>
          index === 1
            ? {
                ...enemy,
                theta: thetaBase,
                depth: enemyDepth,
                alive: true
              }
            : {
                ...enemy,
                alive: false
              }
        ),
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
    };

    const near = runShot(0.08);
    const far = runShot(0.92);

    expect(near.score).toBe(100);
    expect(far.score).toBe(0);
  });

  it('reduces life when enemy reaches edge in player sector', () => {
    const initial = createInitialState();

    const state: GameState = {
      ...initial,
      phase: 'playing',
      enemies: initial.enemies.map((enemy, index) =>
        index === 0
          ? {
              ...enemy,
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

    expect(next.lives).toBe(2);
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

  it('spawns two reinforcements of same class when enemy passes behind player', () => {
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

    const aliveEnemies = next.enemies.filter((enemy) => enemy.alive);
    expect(aliveEnemies).toHaveLength(2);
    expect(aliveEnemies.every((enemy) => enemy.enemyClass === 'large')).toBe(true);
    expect(next.nextEnemyId).toBe(state.nextEnemyId + 2);
  });

  it('enemy bullet can hit player when crossing player depth', () => {
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

    expect(next.lives).toBe(initial.lives - 1);
  });
});
