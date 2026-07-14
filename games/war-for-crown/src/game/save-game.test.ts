import { describe, expect, it } from 'vitest';

import { DEFAULT_GAME_CONFIG } from './constants';
import { createWarForCrownSaveGame, parseWarForCrownSaveGame } from './save-game';
import { createInitialState } from './state';

const PLAYER_SETUPS = [
  { playerId: 'p1', name: 'P1', colorIndex: 0, crestIndex: 0, controller: 'human' as const },
  { playerId: 'p2', name: 'P2', colorIndex: 1, crestIndex: 1, controller: 'human' as const },
  { playerId: 'p3', name: 'WA', colorIndex: 2, crestIndex: 2, controller: 'ai' as const, aiMode: 'c64-original' as const },
  { playerId: 'p4', name: 'MCZ', colorIndex: 3, crestIndex: 3, controller: 'ai' as const, aiMode: 'c64-original' as const }
];

describe('War for Crown save game', () => {
  it('round-trips current game state, config and player control assignments', () => {
    const save = createWarForCrownSaveGame({
      language: 'pl',
      config: DEFAULT_GAME_CONFIG,
      playerSetups: PLAYER_SETUPS,
      state: createInitialState(17, DEFAULT_GAME_CONFIG)
    });

    expect(parseWarForCrownSaveGame(JSON.parse(JSON.stringify(save)) as unknown)).toEqual(save);
  });

  it('rejects a save from an unsupported version', () => {
    expect(() => parseWarForCrownSaveGame({ format: 'war-for-crown', version: 2 })).toThrow(
      'Unsupported War for Crown save version: 2.'
    );
  });

  it('rejects a state that does not contain map arrays', () => {
    expect(() => parseWarForCrownSaveGame({
      format: 'war-for-crown',
      version: 1,
      language: 'pl',
      config: DEFAULT_GAME_CONFIG,
      playerSetups: PLAYER_SETUPS,
      state: { map: {}, c64: {} }
    })).toThrow('Saved game map tiles and provinces must be arrays.');
  });
});
