import { describe, expect, it } from 'vitest';

import { ROYALIST_OWNER_ID } from './owners';

import { createPlayerStatusSummary } from './status';
import { testGameState, testPlayer, testProvince } from './test-fixtures';
import type { GameState } from './types';

function statusState(): GameState {
  return testGameState({
    seed: 1,
    rngState: 1,
    phase: 'turn',
    map: {
      width: 4,
      height: 3,
      tiles: [],
      provinces: [
        testProvince({
          id: 'home',
          terrainId: 'plains',
          ownerId: 'p1',
          villages: 1,
          soldiers: 10,
          neighbours: ['frontier']
        }),
        testProvince({
          id: 'frontier',
          terrainId: 'forest',
          ownerId: 'p1',
          villages: 1,
          soldiers: 10,
          neighbours: ['home', 'distant']
        }),
        testProvince({
          id: 'distant',
          terrainId: 'hills',
          ownerId: ROYALIST_OWNER_ID,
          villages: 1,
          soldiers: 10,
          neighbours: ['frontier']
        })
      ]
    },
    players: [
      testPlayer({ id: 'p1', label: 'P1', color: 0xd9534f, homeProvinceId: 'home' }),
      testPlayer({ id: 'p2', label: 'P2', color: 0x3f88c5, homeProvinceId: null })
    ],
    activePlayerId: 'p1',
    turnStep: 'new-month',
    turnNumber: 1,
    winnerId: null,
    attackSpentProvinceIds: [],
    battle: null
  });
}

describe('player status summary', () => {
  it('summarizes owned provinces for notification events', () => {
    expect(createPlayerStatusSummary(statusState(), 'p1')).toEqual({
      playerId: 'p1',
      ownedProvinceCount: 2,
      totalProvinceCount: 3,
      soldierCount: 20,
      income: 2,
      title: 'Duke'
    });
  });
});
