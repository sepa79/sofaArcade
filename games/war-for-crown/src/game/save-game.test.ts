import { describe, expect, it } from 'vitest';

import { DEFAULT_GAME_CONFIG } from './constants';
import { PLAYER_COLOR_CHOICES } from './player-presentation';
import { createWarForCrownSaveGame, parseWarForCrownSaveGame } from './save-game';
import { createInitialState } from './state';

const PLAYER_SETUPS = [
  { playerId: 'p1', name: 'P1', colorIndex: 0, crestIndex: 0, controller: 'human' as const },
  { playerId: 'p2', name: 'P2', colorIndex: 1, crestIndex: 1, controller: 'human' as const },
  { playerId: 'p3', name: 'WA', colorIndex: 2, crestIndex: 2, controller: 'ai' as const, aiMode: 'c64-original' as const },
  { playerId: 'p4', name: 'MCZ', colorIndex: 3, crestIndex: 3, controller: 'ai' as const, aiMode: 'c64-original' as const }
];

describe('War for Crown save game', () => {
  function validSave(): ReturnType<typeof createWarForCrownSaveGame> {
    const initialState = createInitialState(17, DEFAULT_GAME_CONFIG);
    const state = {
      ...initialState,
      players: initialState.players.map((player, index) => {
        const setup = PLAYER_SETUPS[index];
        const color = setup === undefined ? undefined : PLAYER_COLOR_CHOICES[setup.colorIndex];
        if (setup === undefined || color === undefined) {
          throw new Error(`Missing test player setup ${index + 1}.`);
        }
        return { ...player, label: setup.name, color };
      })
    };
    return createWarForCrownSaveGame({
      language: 'pl',
      config: DEFAULT_GAME_CONFIG,
      playerSetups: PLAYER_SETUPS,
      state
    });
  }

  it('round-trips current game state, config and player control assignments', () => {
    const save = validSave();

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

  it('rejects turn steps outside the game-state model', () => {
    const save = structuredClone(validSave()) as unknown as { state: { turnStep: string } };
    save.state.turnStep = 'bogus';

    expect(() => parseWarForCrownSaveGame(save)).toThrow('Turn step has invalid value: bogus.');
  });

  it('rejects configuration values that fail gameplay preconditions', () => {
    const save = structuredClone(validSave()) as unknown as { config: { villageCost: number } };
    save.config.villageCost = 0;

    expect(() => parseWarForCrownSaveGame(save)).toThrow('Village cost must be a safe integer');
  });

  it('rejects controller order that disagrees with C64 human player slots', () => {
    const save = structuredClone(validSave()) as unknown as {
      playerSetups: Array<{ controller: string; aiMode?: string }>;
    };
    save.playerSetups[0] = { ...save.playerSetups[0], controller: 'ai', aiMode: 'c64-original' };
    save.playerSetups[2] = { ...save.playerSetups[2], controller: 'human' };

    expect(() => parseWarForCrownSaveGame(save)).toThrow(
      'Saved player setup 1 must be human-controlled.'
    );
  });

  it('rejects state dimensions that disagree with the saved config', () => {
    const save = structuredClone(validSave()) as unknown as { state: { map: { width: number } } };
    save.state.map.width = 19;

    expect(() => parseWarForCrownSaveGame(save)).toThrow(
      'Map has 240 tiles; expected 228.'
    );
  });
});
