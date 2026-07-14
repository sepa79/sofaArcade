import { describe, expect, it } from 'vitest';

import { DEFAULT_GAME_CONFIG } from './constants';
import { runC64MonthStart } from './c64-month-start';
import {
  c64RoyalistReinforcementSoldiers,
  runC64RoyalistReinforcement
} from './c64-royalist-reinforcement';
import { testGameState, testPlayer, testProvince } from './test-fixtures';

describe('C64 timed royalist reinforcement', () => {
  it('matches the $372A reinforcement amount and descending remainder distribution', () => {
    expect(c64RoyalistReinforcementSoldiers({
      provinceCount: 30,
      year: 4,
      month: 1,
      rngByte: 7,
      config: DEFAULT_GAME_CONFIG
    })).toBe(2_968);

    const result = runC64RoyalistReinforcement({
      provinces: [
        testProvince({
          id: '1',
          terrainId: 'plains',
          ownerId: 0,
          villages: 1,
          soldiers: 10,
          neighbours: []
        }),
        testProvince({
          id: '2',
          terrainId: 'plains',
          ownerId: 'p1',
          villages: 1,
          soldiers: 20,
          neighbours: []
        }),
        testProvince({
          id: '3',
          terrainId: 'plains',
          ownerId: 0,
          villages: 1,
          soldiers: 30,
          neighbours: []
        })
      ],
      year: 4,
      month: 1,
      rngByte: 7,
      config: DEFAULT_GAME_CONFIG
    });

    expect(result.soldiers).toBe(1_540);
    expect(result.provinces.map((province) => province.soldiers)).toEqual([780, 20, 800]);
  });

  it('runs the two-month $C8B0 pending sequence without changing weather', () => {
    const base = testGameState({
      seed: 1,
      rngState: 1,
      phase: 'turn',
      map: {
        width: 2,
        height: 1,
        tiles: [],
        provinces: [
          testProvince({
            id: '1',
            terrainId: 'plains',
            ownerId: 0,
            villages: 1,
            soldiers: 10,
            neighbours: ['2']
          }),
          testProvince({
            id: '2',
            terrainId: 'plains',
            ownerId: 'p1',
            villages: 1,
            soldiers: 20,
            neighbours: ['1']
          })
        ]
      },
      players: [testPlayer({ id: 'p1', label: 'P1', color: 1, homeProvinceId: '2' })],
      activePlayerId: 'p1',
      turnStep: 'new-month',
      turnNumber: 37,
      winnerId: null,
      attackSpentProvinceIds: [],
      battle: null
    });
    const state = {
      ...base,
      c64: {
        ...base.c64,
        calendar: {
          ...base.c64.calendar,
          year: 4,
          month: 0,
          weatherIndex: 4,
          weatherFactor: 103,
          weatherDerived: 73
        },
        royalistReinforcementTimer: 4
      }
    };

    const announced = runC64MonthStart(state, DEFAULT_GAME_CONFIG);
    expect(announced.c64.calendar).toMatchObject({
      year: 4,
      month: 1,
      weatherIndex: 4,
      weatherFactor: 103,
      weatherDerived: 73
    });
    expect(announced.c64.royalistReinforcementTimer).toBe(0xff);
    expect(announced.rngState).toBe(1_015_568_748);

    const pending = {
      ...announced,
      c64: {
        ...announced.c64,
        calendar: {
          ...announced.c64.calendar,
          monthWeatherPending: true
        }
      }
    };
    const reinforced = runC64MonthStart(pending, DEFAULT_GAME_CONFIG);
    expect(reinforced.c64.calendar).toMatchObject({
      year: 4,
      month: 2,
      weatherIndex: 4,
      weatherFactor: 103,
      weatherDerived: 73
    });
    expect(reinforced.c64.royalistReinforcementTimer).toBe(0);
    expect(reinforced.map.provinces[0]?.soldiers).toBeGreaterThan(10);
  });
});
