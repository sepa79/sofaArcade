import { describe, expect, it, vi } from 'vitest';

import { DEFAULT_GAME_CONFIG } from '../game/constants';
import { createInitialState } from '../game/state';
import { resumeLoadedGame } from './loaded-game-resume';

describe('War for Crown loaded-game resume', () => {
  it('runs AI before restoring a human new-month overlay', () => {
    let state = createInitialState(17, DEFAULT_GAME_CONFIG);
    const showCurrentPhaseOverlay = vi.fn();
    const markCurrentPhaseAnnounced = vi.fn();

    resumeLoadedGame({
      battleSummaryVisible: () => false,
      getState: () => state,
      markCurrentPhaseAnnounced,
      playAiUntilHumanTurn: () => {
        state = { ...state, phase: 'turn', turnStep: 'new-month' };
      },
      showCurrentPhaseOverlay
    });

    expect(showCurrentPhaseOverlay).toHaveBeenCalledOnce();
    expect(markCurrentPhaseAnnounced).not.toHaveBeenCalled();
  });

  it('marks non-month phases without showing a blocking overlay', () => {
    const state = {
      ...createInitialState(17, DEFAULT_GAME_CONFIG),
      phase: 'turn' as const,
      turnStep: 'attack' as const
    };
    const showCurrentPhaseOverlay = vi.fn();
    const markCurrentPhaseAnnounced = vi.fn();

    resumeLoadedGame({
      battleSummaryVisible: () => false,
      getState: () => state,
      markCurrentPhaseAnnounced,
      playAiUntilHumanTurn: () => undefined,
      showCurrentPhaseOverlay
    });

    expect(markCurrentPhaseAnnounced).toHaveBeenCalledOnce();
    expect(showCurrentPhaseOverlay).not.toHaveBeenCalled();
  });
});
