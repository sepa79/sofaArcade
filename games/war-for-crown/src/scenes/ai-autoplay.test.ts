import { describe, expect, it, vi } from 'vitest';

import type { GameState } from '../game/types';
import { runWarForCrownAiAutoplay } from './ai-autoplay';

describe('War for Crown AI autoplay boundary', () => {
  it('runs AI actions until control reaches a human', () => {
    let state = {
      phase: 'turn',
      battle: null,
      activePlayerId: 'p2'
    } as GameState;
    const applyAction = vi.fn(() => {
      state = { ...state, activePlayerId: 'p1' };
      return [];
    });

    runWarForCrownAiAutoplay({
      applyAction,
      battleSummaryVisible: () => false,
      chooseAction: () => ({ type: 'advance-step' }),
      getState: () => state,
      isAiPlayer: (playerId) => playerId === 'p2',
      onActionApplied: () => undefined,
      stepLimit: 4
    });

    expect(applyAction).toHaveBeenCalledTimes(1);
  });
});
