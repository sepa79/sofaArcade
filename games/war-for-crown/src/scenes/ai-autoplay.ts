import type { WarForCrownAction } from '../game/actions';
import type { WarForCrownEvent } from '../game/events';
import type { GameState, PlayerId } from '../game/types';

export interface WarForCrownAiAutoplayBoundary {
  readonly applyAction: (
    playerId: PlayerId,
    action: WarForCrownAction
  ) => ReadonlyArray<WarForCrownEvent>;
  readonly battleSummaryVisible: () => boolean;
  readonly chooseAction: (playerId: PlayerId) => WarForCrownAction;
  readonly getState: () => GameState;
  readonly isAiPlayer: (playerId: PlayerId) => boolean;
  readonly onActionApplied: (events: ReadonlyArray<WarForCrownEvent>) => void;
  readonly stepLimit: number;
}

export function runWarForCrownAiAutoplay(boundary: WarForCrownAiAutoplayBoundary): void {
  let steps = 0;
  for (;;) {
    const state = boundary.getState();
    if (
      state.phase === 'game-over' ||
      state.battle !== null ||
      boundary.battleSummaryVisible() ||
      !boundary.isAiPlayer(state.activePlayerId)
    ) {
      return;
    }
    if (steps >= boundary.stepLimit) {
      throw new Error(`AI autoplay exceeded ${boundary.stepLimit} steps.`);
    }
    const playerId = state.activePlayerId;
    const events = boundary.applyAction(playerId, boundary.chooseAction(playerId));
    boundary.onActionApplied(events);
    steps += 1;
  }
}
