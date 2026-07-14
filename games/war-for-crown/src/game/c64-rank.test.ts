import { describe, expect, it } from 'vitest';

import { c64RankThreshold, c64TargetRank, updateC64PlayerRank } from './c64-rank';
import { testGameState, testPlayer, testProvince } from './test-fixtures';

describe('C64 title rank', () => {
  it('derives the recovered fifths thresholds', () => {
    expect([0, 1, 2, 3, 4].map((rank) => c64RankThreshold(30, rank))).toEqual([
      0,
      6,
      12,
      18,
      24
    ]);
    expect(c64TargetRank(30, 17)).toBe(2);
  });

  it('promotes by one rank per check and demotes directly', () => {
    const provinces = Array.from({ length: 30 }, (_, index) => testProvince({
      id: `${index + 1}`,
      terrainId: 'plains',
      ownerId: index < 24 ? 'p1' : 'p2',
      villages: 1,
      soldiers: 1,
      neighbours: []
    }));
    const state = testGameState({
      seed: 1,
      rngState: 1,
      phase: 'turn',
      map: { width: 1, height: 1, tiles: [], provinces },
      players: [
        testPlayer({ id: 'p1', label: 'P1', color: 1, homeProvinceId: '1' }),
        testPlayer({ id: 'p2', label: 'P2', color: 2, homeProvinceId: '30' })
      ],
      activePlayerId: 'p1',
      turnStep: 'new-month',
      turnNumber: 1,
      winnerId: null,
      attackSpentProvinceIds: [],
      battle: null
    });

    const promoted = updateC64PlayerRank(state, 'p1');
    expect(promoted.c64.playerMemory[0]?.rank).toBe(1);
    const rankThree = {
      ...promoted,
      c64: {
        ...promoted.c64,
        playerMemory: promoted.c64.playerMemory.map((memory) =>
          memory.playerId === 'p2' ? { ...memory, rank: 3 } : memory
        )
      }
    };
    expect(updateC64PlayerRank(rankThree, 'p2').c64.playerMemory[1]?.rank).toBe(1);
  });
});
