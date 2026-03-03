import { describe, expect, it } from 'vitest';

import { FIXED_TIMESTEP } from './constants';
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
    const initial = createInitialState();
    const target = initial.enemies[0];

    const base: GameState = {
      ...initial,
      phase: 'playing',
      enemies: initial.enemies.map((enemy, index) =>
        index === 0
          ? {
              ...enemy,
              theta: 1,
              depth: 0.5,
              alive: true
            }
          : {
              ...enemy,
              alive: false
            }
      ),
      bullets: [
        {
          theta: 1,
          depth: 0.5,
          ttl: 1
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
});
