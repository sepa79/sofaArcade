import { describe, expect, it } from 'vitest';

import { runC64EventModule, runC64RandomEvent } from './c64-events';
import { DEFAULT_GAME_CONFIG } from './constants';
import { nextRngByte } from './rng';
import { testGameState, testPlayer, testProvince } from './test-fixtures';
import type { GameState, PlayerId } from './types';

function rngStateForModulo(max: number, remainder: number): number {
  for (let rngState = 1; rngState < 100_000; rngState += 1) {
    if (nextRngByte(rngState).byte % max === remainder) {
      return rngState;
    }
  }
  throw new Error(`Could not find C64 event RNG state for modulo ${max}/${remainder}.`);
}

function eventState(
  rngState: number,
  activePlayerId: PlayerId = 'p1',
  year: number = 4,
  month: number = 7
): GameState {
  const state = testGameState({
    seed: 1,
    rngState,
    phase: 'turn',
    map: {
      width: 4,
      height: 1,
      tiles: [
        { x: 0, y: 0, provinceId: '1' },
        { x: 1, y: 0, provinceId: '2' },
        { x: 2, y: 0, provinceId: '3' },
        { x: 3, y: 0, provinceId: '4' }
      ],
      provinces: [
        testProvince({
          id: '1',
          terrainId: 'plains',
          ownerId: 'p2',
          villages: 2,
          soldiers: 8,
          neighbours: ['2']
        }),
        testProvince({
          id: '2',
          terrainId: 'forest',
          ownerId: 'p1',
          villages: 4,
          soldiers: 10,
          fortificationLevel: 'fort',
          neighbours: ['1', '3']
        }),
        testProvince({
          id: '3',
          terrainId: 'forest',
          ownerId: 'p1',
          villages: 4,
          soldiers: 100,
          fortificationLevel: 'castle',
          neighbours: ['2', '4']
        }),
        testProvince({
          id: '4',
          terrainId: 'plains',
          ownerId: 'p2',
          villages: 5,
          soldiers: 8,
          neighbours: ['3']
        })
      ]
    },
    players: [
      testPlayer({ id: 'p1', label: 'P1', color: 1, money: 100, homeProvinceId: '2' }),
      testPlayer({ id: 'p2', label: 'P2', color: 2, money: 20, homeProvinceId: '1' })
    ],
    activePlayerId,
    turnStep: 'new-month',
    turnNumber: month,
    winnerId: null,
    attackSpentProvinceIds: [],
    battle: null
  });
  return {
    ...state,
    c64: {
      ...state.c64,
      calendar: {
        ...state.c64.calendar,
        year,
        month,
        monthWeatherPending: false
      }
    }
  };
}

function province(state: GameState, provinceId: string) {
  const value = state.map.provinces.find((candidate) => candidate.id === provinceId);
  if (value === undefined) {
    throw new Error(`Missing event test province ${provinceId}.`);
  }
  return value;
}

describe('C64 random events', () => {
  it('matches the za money-loss helper fixture', () => {
    const result = runC64EventModule(
      eventState(rngStateForModulo(5, 0)),
      'za',
      DEFAULT_GAME_CONFIG
    );

    expect(result.state.players[0]?.money).toBe(93);
    expect(result.resolution).toMatchObject({ effect: 'money-lost', amount: 7 });
  });

  it('matches zf/zg soldier loss and deserter handoff', () => {
    const rngState = rngStateForModulo(5, 3);
    const plague = runC64EventModule(eventState(rngState), 'zf', DEFAULT_GAME_CONFIG);
    expect(province(plague.state, '3').soldiers).toBe(90);
    expect(plague.resolution).toMatchObject({
      effect: 'soldiers-lost',
      amount: 10,
      provinceId: '3'
    });

    const deserters = runC64EventModule(eventState(rngState), 'zg', DEFAULT_GAME_CONFIG);
    expect(deserters.state.c64.deserterSoldiers).toBe(10);
    expect(deserters.state.c64.deserterOwnerId).toBe('p1');
    const transferred = runC64EventModule({
      ...deserters.state,
      activePlayerId: 'p2'
    }, 'zm', DEFAULT_GAME_CONFIG);
    expect(province(transferred.state, '1').soldiers).toBe(18);
    expect(transferred.state.c64.deserterSoldiers).toBe(0);
    expect(transferred.state.c64.deserterOwnerId).toBeNull();
  });

  it('matches zc/zd downward random province selection', () => {
    const rngState = rngStateForModulo(2, 1);
    const village = runC64EventModule(eventState(rngState), 'zc', DEFAULT_GAME_CONFIG);
    expect(province(village.state, '3').villages).toBe(5);
    const fire = runC64EventModule(eventState(rngState), 'zd', DEFAULT_GAME_CONFIG);
    expect(province(fire.state, '3').villages).toBe(3);
  });

  it('matches zy fortified-province selection and dormant event entrypoints', () => {
    const fortFire = runC64EventModule(
      eventState(rngStateForModulo(2, 0)),
      'zy',
      DEFAULT_GAME_CONFIG
    );
    expect(province(fortFire.state, '3').fortificationLevel).toBe('fort');

    for (const eventId of ['zj', 'zl', 'zn'] as const) {
      const dormant = runC64EventModule(eventState(1), eventId, DEFAULT_GAME_CONFIG);
      expect(dormant.state).toEqual(eventState(1));
      expect(dormant.resolution?.effect).toBe('none');
      expect(dormant.rngBytesConsumed).toBe(0);
    }
  });

  it('gates events before month seven and for configured computer slots', () => {
    const beforeStart = runC64RandomEvent(eventState(1, 'p1', 1, 6), DEFAULT_GAME_CONFIG);
    expect(beforeStart.resolution).toBeNull();
    expect(beforeStart.rngBytesConsumed).toBe(0);

    const computer = runC64RandomEvent(eventState(1, 'p2'), {
      ...DEFAULT_GAME_CONFIG,
      humanPlayerCount: 1,
      aiPlayerCount: 1
    });
    expect(computer.resolution).toBeNull();
    expect(computer.rngBytesConsumed).toBe(0);
  });
});
