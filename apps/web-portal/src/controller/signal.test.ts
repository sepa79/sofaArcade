import { describe, expect, it } from 'vitest';

import {
  createInitialShakeState,
  createInitialTiltState,
  recenterTilt,
  updateShake,
  updateTilt
} from './signal';

describe('tilt signal', () => {
  it('recenters and maps gamma to moveX', () => {
    const base = recenterTilt(createInitialTiltState(), 10);
    const next = updateTilt(base, 35, {
      rangeDegrees: 25,
      deadzone: 0,
      smoothingAlpha: 1
    });

    expect(next.smoothedMoveX).toBe(1);
  });

  it('applies deadzone', () => {
    const base = createInitialTiltState();
    const next = updateTilt(base, 1, {
      rangeDegrees: 25,
      deadzone: 0.2,
      smoothingAlpha: 1
    });

    expect(next.smoothedMoveX).toBe(0);
  });
});

describe('shake signal', () => {
  it('triggers fire above threshold', () => {
    const next = updateShake(
      createInitialShakeState(),
      20,
      1000,
      {
        energyAlpha: 1,
        fireThreshold: 10,
        specialThreshold: 16,
        cooldownMs: 250
      }
    );

    expect(next.fire).toBe(true);
    expect(next.special).toBe(true);
  });

  it('respects cooldown', () => {
    const first = updateShake(
      createInitialShakeState(),
      12,
      1000,
      {
        energyAlpha: 1,
        fireThreshold: 10,
        specialThreshold: 16,
        cooldownMs: 250
      }
    );

    const second = updateShake(
      first.state,
      12,
      1100,
      {
        energyAlpha: 1,
        fireThreshold: 10,
        specialThreshold: 16,
        cooldownMs: 250
      }
    );

    expect(second.fire).toBe(false);
  });
});
