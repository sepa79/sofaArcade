import { describe, expect, it } from 'vitest';

import { DEFAULT_GAME_CONFIG } from '../game/constants';
import { createInitialState } from '../game/state';
import { attackTargetIds, mobileAttackSoldiers } from './turn-selection';

describe('War for Crown turn selection', () => {
  it('does not expose attack targets outside the attack step', () => {
    expect(attackTargetIds(createInitialState(17, DEFAULT_GAME_CONFIG))).toEqual([]);
  });

  it('keeps one soldier in every attack source', () => {
    const state = createInitialState(17, DEFAULT_GAME_CONFIG);
    const province = { ...state.map.provinces[0], ownerId: state.activePlayerId, soldiers: 20 };
    expect(mobileAttackSoldiers(state, province)).toBe(19);
  });
});
