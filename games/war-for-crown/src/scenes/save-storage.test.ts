import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { DEFAULT_GAME_CONFIG } from '../game/constants';
import { PLAYER_COLOR_CHOICES } from '../game/player-presentation';
import { createInitialState } from '../game/state';
import {
  createWarForCrownSaveSnapshot,
  loadWarForCrownFromBrowser,
  saveWarForCrownToBrowser
} from './save-storage';

describe('War for Crown browser save boundary', () => {
  beforeEach(() => {
    const values = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value)
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('stores and validates a complete browser snapshot', () => {
    const setups = [
      { playerId: 'p1', name: 'P1', colorIndex: 0, crestIndex: 0, controller: 'human' as const },
      { playerId: 'p2', name: 'P2', colorIndex: 1, crestIndex: 1, controller: 'human' as const },
      { playerId: 'p3', name: 'WA', colorIndex: 2, crestIndex: 2, controller: 'ai' as const, aiMode: 'c64-original' as const },
      { playerId: 'p4', name: 'MCZ', colorIndex: 3, crestIndex: 3, controller: 'ai' as const, aiMode: 'c64-original' as const }
    ];
    const initial = createInitialState(1, DEFAULT_GAME_CONFIG);
    const state = {
      ...initial,
      players: initial.players.map((player, index) => {
        const setup = setups[index];
        if (setup === undefined) {
          throw new Error(`Missing setup ${index}.`);
        }
        const color = PLAYER_COLOR_CHOICES[setup.colorIndex];
        if (color === undefined) {
          throw new Error(`Missing color ${setup.colorIndex}.`);
        }
        return { ...player, label: setup.name, color };
      })
    };
    const save = createWarForCrownSaveSnapshot({
      language: 'pl',
      config: DEFAULT_GAME_CONFIG,
      playerSetups: setups,
      state
    });

    saveWarForCrownToBrowser(save);
    expect(loadWarForCrownFromBrowser()).toEqual(save);
  });
});
