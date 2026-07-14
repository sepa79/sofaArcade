import { describe, expect, it } from 'vitest';

import { applyPlayerAction, type WarForCrownAction } from './actions';
import { DEFAULT_GAME_CONFIG } from './constants';
import { createJournalEntry, replayJournal, type WarForCrownJournalEntry } from './journal';
import { createInitialState } from './state';
import type { GameState, PlayerId } from './types';

function applyJournaledAction(
  entries: ReadonlyArray<WarForCrownJournalEntry>,
  state: GameState,
  playerId: PlayerId,
  action: WarForCrownAction
): { readonly state: GameState; readonly entries: ReadonlyArray<WarForCrownJournalEntry> } {
  const result = applyPlayerAction(state, playerId, action, DEFAULT_GAME_CONFIG);
  return {
    state: result.state,
    entries: [
      ...entries,
      createJournalEntry(entries.length + 1, state, playerId, action, result.events, result.state)
    ]
  };
}

describe('war for crown action journal', () => {
  it('replays accepted public actions from the initial state', () => {
    const initial = createInitialState(1, DEFAULT_GAME_CONFIG);
    let state = initial;
    let entries: ReadonlyArray<WarForCrownJournalEntry> = [];

    ({ state, entries } = applyJournaledAction(entries, state, 'p1', {
      type: 'select-home',
      provinceId: state.map.provinces[0].id
    }));
    ({ state, entries } = applyJournaledAction(entries, state, 'p2', {
      type: 'select-home',
      provinceId: state.map.provinces[1].id
    }));
    ({ state, entries } = applyJournaledAction(entries, state, 'p3', {
      type: 'select-home',
      provinceId: state.map.provinces[2].id
    }));

    expect(replayJournal(initial, DEFAULT_GAME_CONFIG, entries)).toEqual(state);
  });

  it('fails when a replayed entry does not match its before-state snapshot', () => {
    const initial = createInitialState(1, DEFAULT_GAME_CONFIG);
    const result = applyPlayerAction(initial, 'p1', {
      type: 'select-home',
      provinceId: initial.map.provinces[0].id
    });
    const entry = createJournalEntry(1, initial, 'p1', {
      type: 'select-home',
      provinceId: initial.map.provinces[0].id
    }, result.events, result.state);
    const corruptedEntry = {
      ...entry,
      before: {
        ...entry.before,
        turnNumber: 99
      }
    };

    expect(() => replayJournal(initial, DEFAULT_GAME_CONFIG, [corruptedEntry])).toThrow(
      'Journal replay mismatch at entry 1 before-state.'
    );
  });
});
