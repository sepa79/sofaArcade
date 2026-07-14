import { describe, expect, it } from 'vitest';

import {
  HUMAN_PLAYER_COUNT_OPTIONS,
  humanSetupButtonCommand,
  humanSetupButtonId
} from './player-setup-controls';

describe('War for Crown player setup controls', () => {
  it('supports one through four human players', () => {
    expect(HUMAN_PLAYER_COUNT_OPTIONS).toEqual([1, 2, 3, 4]);
  });

  it('round-trips every human player control id', () => {
    expect(humanSetupButtonCommand(humanSetupButtonId('crest', 'p4'))).toEqual({
      control: 'crest',
      playerId: 'p4'
    });
  });
});
