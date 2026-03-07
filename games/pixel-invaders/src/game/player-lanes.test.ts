import { describe, expect, it } from 'vitest';

import { applyLaneInput, defaultPlayerLaneForIndex, playerLaneWorldY } from './player-lanes';
import type { FrameInput } from './types';

function emptyInput(): FrameInput {
  return {
    moveAxisSigned: 0,
    moveAbsoluteUnit: null,
    moveLaneTarget: null,
    moveLaneUpPressed: false,
    moveLaneDownPressed: false,
    firePressed: false,
    restartPressed: false
  };
}

describe('player lanes', () => {
  it('assigns default lanes in the intended couch order', () => {
    expect(defaultPlayerLaneForIndex(0)).toBe('low');
    expect(defaultPlayerLaneForIndex(1)).toBe('high');
    expect(defaultPlayerLaneForIndex(2)).toBe('mid');
  });

  it('moves one lane per press and ignores contradictory input', () => {
    expect(applyLaneInput('low', { ...emptyInput(), moveLaneUpPressed: true })).toBe('mid');
    expect(applyLaneInput('mid', { ...emptyInput(), moveLaneDownPressed: true })).toBe('low');
    expect(
      applyLaneInput('mid', {
        ...emptyInput(),
        moveLaneUpPressed: true,
        moveLaneDownPressed: true
      })
    ).toBe('mid');
  });

  it('maps higher lanes to lower world y values', () => {
    expect(playerLaneWorldY('high')).toBeLessThan(playerLaneWorldY('mid'));
    expect(playerLaneWorldY('mid')).toBeLessThan(playerLaneWorldY('low'));
  });

  it('accepts direct lane target selection', () => {
    expect(applyLaneInput('low', { ...emptyInput(), moveLaneTarget: 'high' })).toBe('high');
  });
});
