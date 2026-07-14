import { describe, expect, it } from 'vitest';

import { runC64PlayerIncome } from './c64-income';
import { DEFAULT_GAME_CONFIG } from './constants';
import { nextRngByte } from './rng';
import { testGameState, testPlayer, testProvince } from './test-fixtures';

function incomeState(rngState: number, flags: number) {
  const state = testGameState({
    seed: 1,
    rngState,
    phase: 'turn',
    map: {
      width: 1,
      height: 1,
      tiles: [],
      provinces: [
        testProvince({
          id: 'home',
          terrainId: 'plains',
          ownerId: 'p1',
          villages: 10,
          soldiers: 1,
          neighbours: []
        })
      ]
    },
    players: [
      testPlayer({ id: 'p1', label: 'P1', color: 1, money: 20, homeProvinceId: 'home' }),
      testPlayer({ id: 'p2', label: 'P2', color: 2, money: 20, homeProvinceId: null })
    ],
    activePlayerId: 'p1',
    turnStep: 'new-month',
    turnNumber: 1,
    winnerId: null,
    attackSpentProvinceIds: [],
    battle: null
  });
  const ca61Bytes = [...state.c64.ca61Bytes];
  ca61Bytes[1] = flags;
  return {
    ...state,
    c64: {
      ...state.c64,
      ca61Bytes
    }
  };
}

function seedForByte(predicate: (byte: number) => boolean): number {
  for (let seed = 1; seed < 10_000; seed += 1) {
    if (predicate(nextRngByte(seed).byte)) {
      return seed;
    }
  }
  throw new Error('Could not find C64 income test RNG byte.');
}

describe('C64 player income event modifiers', () => {
  it('halves and clears the delayed $10 flag after a successful RNG gate', () => {
    const result = runC64PlayerIncome(
      incomeState(seedForByte((byte) => byte >= 0x80), 0x10),
      'p1',
      DEFAULT_GAME_CONFIG
    );

    expect(result.income).toBe(7);
    expect(result.state.players[0]?.money).toBe(27);
    expect(result.state.c64.ca61Bytes[1]).toBe(0);
    expect(result.rngBytesConsumed).toBe(1);
  });

  it('consumes both gates in order and clears $10/$20 while preserving other bits', () => {
    const result = runC64PlayerIncome(incomeState(1, 0x39), 'p1', DEFAULT_GAME_CONFIG);

    expect(result.rngBytesConsumed).toBe(2);
    expect(result.state.c64.ca61Bytes[1]).toBe(0x09);
  });
});
