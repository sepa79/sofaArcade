import { describe, expect, it } from 'vitest';

import { DEFAULT_GAME_CONFIG } from './constants';
import { createInitialState } from './state';

describe('initial C64 game state', () => {
  it('accepts four total players and rejects a fifth C64 player slot', () => {
    const fourPlayers = createInitialState(11, {
      ...DEFAULT_GAME_CONFIG,
      humanPlayerCount: 0,
      aiPlayerCount: 4
    });

    expect(fourPlayers.players.map((player) => player.id)).toEqual(['p1', 'p2', 'p3', 'p4']);
    expect(() => createInitialState(11, {
      ...DEFAULT_GAME_CONFIG,
      humanPlayerCount: 1,
      aiPlayerCount: 4
    })).toThrow('Total player count must be 2..4, got 5.');
  });
});
