import { describe, expect, it } from 'vitest';

import { DEFAULT_GAME_CONFIG } from '../game/constants';
import { createInitialState } from '../game/state';
import { disabledButtonMessage } from './disabled-button-message';
import type { TurnSelection } from './turn-selection';
import { UI_COPY } from './ui-copy';

const EMPTY_SELECTION: TurnSelection = {
  attackSourceIds: [],
  fromId: null,
  movementTargetSoldiers: null,
  targetId: null
};

describe('War for Crown disabled button messages', () => {
  it('explains that a browser save is missing', () => {
    expect(disabledButtonMessage({
      config: DEFAULT_GAME_CONFIG,
      id: 'main-load',
      language: 'pl',
      selection: EMPTY_SELECTION,
      state: createInitialState(17, DEFAULT_GAME_CONFIG)
    })).toBe(UI_COPY.pl.loadMissing);
  });

  it('explains that attack is available only during the attack step', () => {
    expect(disabledButtonMessage({
      config: DEFAULT_GAME_CONFIG,
      id: 'attack',
      language: 'en',
      selection: EMPTY_SELECTION,
      state: createInitialState(17, DEFAULT_GAME_CONFIG)
    })).toBe(UI_COPY.en.attackStep);
  });
});
