import { describe, expect, it } from 'vitest';

import { computeCpuAimPlan } from './ai';
import { CPU_FIRE_DELAY_SEC, FIRE_POWER_MAX, WORLD_HEIGHT } from './constants';
import { stepGame } from './logic';
import { createInitialState } from './state';
import type { FrameInput, GameState } from './types';

const IDLE_INPUT: FrameInput = {
  aimXSigned: 0,
  powerYSigned: 0,
  firePressed: false,
  startPressed: false
};

function withState(state: GameState, patch: Partial<GameState>): GameState {
  return {
    ...state,
    ...patch
  };
}

describe('artillery logic', () => {
  it('starts from ready into aiming on fire', () => {
    const state = createInitialState('hotseat-2p', 4);
    const next = stepGame(state, { ...IDLE_INPUT, firePressed: true }, 1 / 60);

    expect(next.phase).toBe('aiming');
  });

  it('adjusts angle and power during human aiming', () => {
    const started = stepGame(createInitialState('hotseat-2p', 4), { ...IDLE_INPUT, firePressed: true }, 1 / 60);
    const next = stepGame(started, { ...IDLE_INPUT, aimXSigned: 1, powerYSigned: 1 }, 0.5);

    expect(next.players[0].angleDeg).toBeGreaterThan(started.players[0].angleDeg);
    expect(next.players[0].power).toBeGreaterThan(started.players[0].power);
  });

  it('launches projectile when fire is pressed in aiming phase', () => {
    const started = stepGame(createInitialState('hotseat-2p', 4), { ...IDLE_INPUT, firePressed: true }, 1 / 60);
    const next = stepGame(started, { ...IDLE_INPUT, firePressed: true }, 1 / 60);

    expect(next.phase).toBe('projectile');
    expect(next.projectile).not.toBeNull();
  });

  it('does not register direct hit on the firing player', () => {
    const state = withState(createInitialState('hotseat-2p', 1), {
      phase: 'projectile',
      projectile: {
        ownerIndex: 0,
        x: createInitialState('hotseat-2p', 1).players[0].tankX,
        y: createInitialState('hotseat-2p', 1).players[0].tankY - 4,
        velocityX: 0,
        velocityY: 0
      }
    });

    const next = stepGame(state, IDLE_INPUT, 1 / 60);
    expect(next.phase).toBe('projectile');
    expect(next.winnerIndex).toBeNull();
  });

  it('switches turn after projectile leaves bounds without hit', () => {
    const state = withState(createInitialState('hotseat-2p', 1), {
      phase: 'projectile',
      projectile: {
        ownerIndex: 0,
        x: 4,
        y: WORLD_HEIGHT - 40,
        velocityX: -200,
        velocityY: 0
      }
    });

    const next = stepGame(state, IDLE_INPUT, 0.2);
    expect(next.phase).toBe('aiming');
    expect(next.activePlayerIndex).toBe(1);
  });

  it('declares active player winner when explosion reaches opponent', () => {
    const state = withState(createInitialState('hotseat-2p', 1), {
      phase: 'projectile',
      projectile: {
        ownerIndex: 0,
        x: 0,
        y: 0,
        velocityX: 0,
        velocityY: 0
      }
    });

    const opponent = state.players[1];
    const next = stepGame(
      {
        ...state,
        projectile: {
          ownerIndex: 0,
          x: opponent.tankX,
          y: opponent.tankY - 4,
          velocityX: 0,
          velocityY: 0
        }
      },
      IDLE_INPUT,
      1 / 60
    );

    expect(next.phase).toBe('won');
    expect(next.winnerIndex).toBe(0);
  });

  it('restarts to fresh terrain after win on fire', () => {
    const won = withState(createInitialState('hotseat-2p', 1), {
      phase: 'won',
      winnerIndex: 0
    });

    const restarted = stepGame(won, { ...IDLE_INPUT, firePressed: true }, 1 / 60);
    expect(restarted.phase).toBe('ready');
    expect(restarted.seed).toBe(2);
  });

  it('arms cpu turn in solo mode and fires after delay', () => {
    const state = stepGame(createInitialState('solo-ai', 2), { ...IDLE_INPUT, firePressed: true }, 1 / 60);
    const toCpuTurn = withState(state, {
      activePlayerIndex: 1,
      phase: 'aiming',
      turnNumber: 2,
      cpuAimPlan: null,
      cpuFireDelaySec: 0
    });
    const armed = stepGame(toCpuTurn, IDLE_INPUT, 1 / 60);
    const exactPlan = computeCpuAimPlan(armed.players[1], armed.players[0], armed.terrain);

    expect(armed.cpuAimPlan).not.toBeNull();
    expect(armed.cpuFireDelaySec).toBeGreaterThan(0);
    expect(armed.cpuFireDelaySec).toBeLessThanOrEqual(CPU_FIRE_DELAY_SEC);
    expect(armed.cpuAimPlan).not.toEqual(exactPlan);

    const fired = stepGame(armed, IDLE_INPUT, CPU_FIRE_DELAY_SEC + 0.01);
    expect(fired.phase).toBe('projectile');
    expect(fired.projectile).not.toBeNull();
  });

  it('keeps power clamped to max', () => {
    const started = stepGame(createInitialState('hotseat-2p', 4), { ...IDLE_INPUT, firePressed: true }, 1 / 60);
    const maxed = stepGame(started, { ...IDLE_INPUT, powerYSigned: 1 }, 10);

    expect(maxed.players[0].power).toBe(FIRE_POWER_MAX);
  });
});
