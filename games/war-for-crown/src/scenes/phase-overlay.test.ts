import { describe, expect, it } from 'vitest';

import { DEFAULT_GAME_CONFIG } from '../game/constants';
import { createInitialState } from '../game/state';
import { createPhaseOverlay, phaseKey, phaseOverlayAllowed } from './phase-overlay';

describe('War for Crown phase overlay model', () => {
  it('only identifies phases while the game scene is active', () => {
    const state = createInitialState(17, DEFAULT_GAME_CONFIG);
    expect(phaseKey('main-menu', state)).toBeNull();
    expect(phaseKey('game', state)).toBe('p1:home-selection:new-month:1');
  });

  it('blocks overlays during battles and keeps new-month overlays persistent', () => {
    const state = {
      ...createInitialState(17, DEFAULT_GAME_CONFIG),
      phase: 'turn' as const,
      turnStep: 'new-month' as const
    };
    expect(phaseOverlayAllowed(true, false)).toBe(false);
    expect(createPhaseOverlay({ language: 'pl', nowMs: 100, state, subtitle: 'test' }).hideAtMs)
      .toBeNull();
  });
});
