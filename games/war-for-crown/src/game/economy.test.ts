import { describe, expect, it } from 'vitest';

import { DEFAULT_GAME_CONFIG } from './constants';
import { calculateIncome, calculateProvinceIncome } from './economy';
import { testProvince } from './test-fixtures';
import type { ProvinceMapState, ProvinceState } from './types';

const plainsProvince: ProvinceState = testProvince({
  id: 'plains-home',
  terrainId: 'plains',
  ownerId: 'p1',
  villages: 2,
  soldiers: 100,
  neighbours: []
});

const desertProvince: ProvinceState = testProvince({
  id: 'desert-frontier',
  terrainId: 'desert',
  ownerId: 'p1',
  villages: 3,
  soldiers: 100,
  neighbours: []
});

describe('economy', () => {
  it('calculates province income from villages and terrain', () => {
    expect(calculateProvinceIncome(plainsProvince, DEFAULT_GAME_CONFIG)).toBe(3);
    expect(calculateProvinceIncome(desertProvince, DEFAULT_GAME_CONFIG)).toBe(3);
  });

  it('ignores terrain income modifiers when configured', () => {
    expect(
      calculateProvinceIncome(desertProvince, {
        ...DEFAULT_GAME_CONFIG,
        terrainInfluence: 'combat'
      })
    ).toBe(3);
  });

  it('sums income only for the requested player', () => {
    const map: ProvinceMapState = {
      width: 2,
      height: 2,
      tiles: [],
      provinces: [
        plainsProvince,
        desertProvince,
        testProvince({
          id: 'enemy',
          terrainId: 'plains',
          ownerId: 'p2',
          villages: 5,
          soldiers: 100,
          neighbours: []
        })
      ]
    };

    expect(calculateIncome(map, 'p1', DEFAULT_GAME_CONFIG)).toBe(6);
  });

  it('sums C64 weighted province values before dividing by 100', () => {
    const map: ProvinceMapState = {
      width: 2,
      height: 1,
      tiles: [],
      provinces: [
        testProvince({
          id: 'one',
          terrainId: 'plains',
          ownerId: 'p1',
          villages: 1,
          soldiers: 1,
          neighbours: []
        }),
        testProvince({
          id: 'two',
          terrainId: 'plains',
          ownerId: 'p1',
          villages: 1,
          soldiers: 1,
          neighbours: []
        })
      ]
    };

    expect(calculateProvinceIncome(map.provinces[0], DEFAULT_GAME_CONFIG)).toBe(1);
    expect(calculateProvinceIncome(map.provinces[1], DEFAULT_GAME_CONFIG)).toBe(1);
    expect(calculateIncome(map, 'p1', DEFAULT_GAME_CONFIG)).toBe(3);
  });
});
