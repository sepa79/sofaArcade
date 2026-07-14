import { describe, expect, it } from 'vitest';

import { resolvePointerIntent } from './pointer-intent';

const BASE_INPUT = {
  aiActionCueVisible: false,
  battleActive: false,
  battleButton: false,
  battleSummaryVisible: false,
  buttonId: null,
  gameOver: false,
  phaseOverlayVisible: false
};

describe('War for Crown pointer priority', () => {
  it('keeps save and menu buttons interactive above phase overlays', () => {
    expect(resolvePointerIntent({
      ...BASE_INPUT,
      buttonId: 'save-game',
      phaseOverlayVisible: true
    })).toBe('button');
    expect(resolvePointerIntent({
      ...BASE_INPUT,
      battleActive: true,
      buttonId: 'save-game-json'
    })).toBe('button');
  });

  it('uses an uncovered overlay click to advance the overlay', () => {
    expect(resolvePointerIntent({ ...BASE_INPUT, phaseOverlayVisible: true })).toBe('phase-overlay');
  });

  it('blocks unrelated controls while a battle summary is visible', () => {
    expect(resolvePointerIntent({
      ...BASE_INPUT,
      battleSummaryVisible: true,
      buttonId: 'advance-step'
    })).toBe('ignore');
  });
});
