import type { GameState } from '../game/types';

export interface LoadedGameResumeBoundary {
  readonly battleSummaryVisible: () => boolean;
  readonly getState: () => GameState;
  readonly markCurrentPhaseAnnounced: () => void;
  readonly playAiUntilHumanTurn: () => void;
  readonly showCurrentPhaseOverlay: () => void;
}

export function resumeLoadedGame(boundary: LoadedGameResumeBoundary): void {
  boundary.playAiUntilHumanTurn();
  const state = boundary.getState();
  if (
    state.phase === 'turn' &&
    state.turnStep === 'new-month' &&
    state.battle === null &&
    !boundary.battleSummaryVisible()
  ) {
    boundary.showCurrentPhaseOverlay();
    return;
  }
  boundary.markCurrentPhaseAnnounced();
}
