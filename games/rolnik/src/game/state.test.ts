import { describe, expect, it } from 'vitest';

import { MAX_BUILDING_SLOTS } from './constants';
import { computeUsedBuildingSlots, createInitialState, getStartingProfileDefinition } from './state';

describe('createInitialState', () => {
  it('creates a playable two-player opening state', () => {
    const state = createInitialState({
      startingProfileIds: ['dairy-start', 'pork-start']
    });

    expect(state.year).toBe(1);
    expect(state.season).toBe('spring');
    expect(state.players).toHaveLength(2);
    expect(state.players[0]?.farm.fields[0]?.cropPlan.length).toBeGreaterThan(0);
  });

  it('rejects player counts outside 2-4', () => {
    expect(() =>
      createInitialState({
        startingProfileIds: ['dairy-start']
      })
    ).toThrowError('Rolnik requires 2 to 4 players, received 1.');
  });
});

describe('starting profiles', () => {
  it('stay within the slot cap', () => {
    const dairy = getStartingProfileDefinition('dairy-start');
    expect(computeUsedBuildingSlots(dairy.buildings)).toBeLessThanOrEqual(MAX_BUILDING_SLOTS);
  });

  it('always provide an active field plan', () => {
    const poultry = getStartingProfileDefinition('poultry-start');
    expect(poultry.fields.some((field) => field.cropPlan.length > 0)).toBe(true);
  });
});
