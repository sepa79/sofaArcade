import { applyPlayerAction, type WarForCrownAction } from './actions';
import type { WarForCrownEvent } from './events';
import type { GameConfig, GameState, PlayerId } from './types';

export interface WarForCrownJournalEntry {
  readonly index: number;
  readonly playerId: PlayerId;
  readonly action: WarForCrownAction;
  readonly events: ReadonlyArray<WarForCrownEvent>;
  readonly before: GameState;
  readonly after: GameState;
}

export function snapshotJournalValue<T>(value: T): T {
  return structuredClone(value);
}

function assertSameJson(actual: unknown, expected: unknown, label: string): void {
  const actualJson = JSON.stringify(actual);
  const expectedJson = JSON.stringify(expected);
  if (actualJson !== expectedJson) {
    throw new Error(`Journal replay mismatch at ${label}.`);
  }
}

export function createJournalEntry(
  index: number,
  before: GameState,
  playerId: PlayerId,
  action: WarForCrownAction,
  events: ReadonlyArray<WarForCrownEvent>,
  after: GameState
): WarForCrownJournalEntry {
  if (!Number.isInteger(index) || index < 1) {
    throw new Error(`Journal index must be a positive integer, got ${index}.`);
  }

  return {
    index,
    playerId,
    action: snapshotJournalValue(action),
    events: snapshotJournalValue(events),
    before: snapshotJournalValue(before),
    after: snapshotJournalValue(after)
  };
}

export function replayJournal(
  initialState: GameState,
  config: GameConfig,
  entries: ReadonlyArray<WarForCrownJournalEntry>
): GameState {
  let state = snapshotJournalValue(initialState);

  for (const entry of entries) {
    assertSameJson(state, entry.before, `entry ${entry.index} before-state`);
    const result = applyPlayerAction(state, entry.playerId, entry.action, config);
    assertSameJson(result.events, entry.events, `entry ${entry.index} events`);
    assertSameJson(result.state, entry.after, `entry ${entry.index} after-state`);
    state = result.state;
  }

  return state;
}
