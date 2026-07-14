import { describe, expect, it } from 'vitest';

import { ROYALIST_OWNER_ID } from './owners';

import { createPlayerView } from './player-view';
import { testGameState, testPlayer, testProvince } from './test-fixtures';
import type { GameState, ProvinceMapState } from './types';

function visibilityMap(): ProvinceMapState {
  return {
    width: 6,
    height: 3,
    tiles: [
      { x: 0, y: 0, provinceId: null },
      { x: 1, y: 0, provinceId: null },
      { x: 2, y: 0, provinceId: null },
      { x: 3, y: 0, provinceId: null },
      { x: 4, y: 0, provinceId: null },
      { x: 5, y: 0, provinceId: null },
      { x: 0, y: 1, provinceId: null },
      { x: 1, y: 1, provinceId: 'home' },
      { x: 2, y: 1, provinceId: 'frontier' },
      { x: 3, y: 1, provinceId: 'far' },
      { x: 4, y: 1, provinceId: 'enemy' },
      { x: 5, y: 1, provinceId: null },
      { x: 0, y: 2, provinceId: null },
      { x: 1, y: 2, provinceId: null },
      { x: 2, y: 2, provinceId: null },
      { x: 3, y: 2, provinceId: null },
      { x: 4, y: 2, provinceId: null },
      { x: 5, y: 2, provinceId: null }
    ],
    provinces: [
      testProvince({
        id: 'home',
        terrainId: 'plains',
        ownerId: 'p1',
        villages: 2,
        soldiers: 200,
        fortificationLevel: 'castle',
        neighbours: ['frontier']
      }),
      testProvince({
        id: 'frontier',
        terrainId: 'desert',
        ownerId: ROYALIST_OWNER_ID,
        villages: 1,
        soldiers: 80,
        fortificationLevel: 'watchtower',
        neighbours: ['far', 'home']
      }),
      testProvince({
        id: 'far',
        terrainId: 'forest',
        ownerId: ROYALIST_OWNER_ID,
        villages: 4,
        soldiers: 160,
        fortificationLevel: 'stronghold',
        neighbours: ['enemy', 'frontier']
      }),
      testProvince({
        id: 'enemy',
        terrainId: 'mountains',
        ownerId: 'p2',
        villages: 5,
        soldiers: 300,
        fortificationLevel: 'citadel',
        neighbours: ['far']
      })
    ]
  };
}

function visibilityState(): GameState {
  return testGameState({
    seed: 1,
    rngState: 1,
    phase: 'turn',
    map: visibilityMap(),
    players: [
      testPlayer({ id: 'p1', label: 'P1', color: 0xd9534f, money: 31, homeProvinceId: 'home' }),
      testPlayer({ id: 'p2', label: 'P2', color: 0x3f88c5, money: 44, homeProvinceId: 'enemy' })
    ],
    activePlayerId: 'p1',
    turnStep: 'new-month',
    turnNumber: 1,
    winnerId: null,
    attackSpentProvinceIds: [],
    battle: null
  });
}

function homeSelectionState(): GameState {
  return testGameState({
    ...visibilityState(),
    phase: 'home-selection',
    map: {
      ...visibilityMap(),
      provinces: visibilityMap().provinces.map((province) => ({
        ...province,
        ownerId: ROYALIST_OWNER_ID
      }))
    },
    players: [
      testPlayer({ id: 'p1', label: 'P1', color: 0xd9534f, homeProvinceId: null }),
      testPlayer({ id: 'p2', label: 'P2', color: 0x3f88c5, homeProvinceId: null })
    ],
    activePlayerId: 'p1',
    winnerId: null,
    attackSpentProvinceIds: [],
    battle: null
  });
}

describe('player view', () => {
  it('exposes exact province details only for owned and adjacent provinces', () => {
    const view = createPlayerView(visibilityState(), 'p1');
    const home = view.map.provinces.find((province) => province.id === 'home');
    const frontier = view.map.provinces.find((province) => province.id === 'frontier');
    const far = view.map.provinces.find((province) => province.id === 'far');
    const enemy = view.map.provinces.find((province) => province.id === 'enemy');

    expect(home).toMatchObject({
      visibility: 'known',
      ownerId: 'p1',
      soldiers: 200,
      villages: 2,
      fortificationLevel: 'castle',
      upgradedFortificationThisTurn: false,
      income: 3
    });
    expect(frontier).toMatchObject({
      visibility: 'known',
      ownerId: ROYALIST_OWNER_ID,
      soldiers: 80,
      villages: 1,
      fortificationLevel: 'watchtower',
      upgradedFortificationThisTurn: false,
      income: 1
    });
    expect(far).toEqual({
      visibility: 'distant',
      id: 'far',
      terrainId: 'forest',
      neighbours: ['enemy', 'frontier']
    });
    expect(enemy).toEqual({
      visibility: 'distant',
      id: 'enemy',
      terrainId: 'mountains',
      neighbours: ['far']
    });
    expect(far !== undefined && 'soldiers' in far).toBe(false);
    expect(enemy !== undefined && 'ownerId' in enemy).toBe(false);
    expect(far !== undefined && 'fortificationLevel' in far).toBe(false);
  });

  it('exposes setup province details while players select their homes', () => {
    const view = createPlayerView(homeSelectionState(), 'p1');

    expect(view.map.tiles).toHaveLength(18);
    expect(view.map.provinces.every((province) => province.visibility === 'known')).toBe(true);
    expect(view.selectableHomeProvinceIds).toEqual(['home', 'frontier', 'far', 'enemy']);
  });

  it('exposes only currently selectable home province ids during home selection', () => {
    const state = testGameState({
      ...homeSelectionState(),
      map: {
        ...visibilityMap(),
        provinces: visibilityMap().provinces.map((province) =>
          province.id === 'home' ? { ...province, ownerId: 'p1' as const } : province
        )
      },
      players: [
        testPlayer({ id: 'p1' as const, label: 'P1', color: 0xd9534f, homeProvinceId: 'home' }),
        testPlayer({ id: 'p2' as const, label: 'P2', color: 0x3f88c5, homeProvinceId: null })
      ],
      activePlayerId: 'p2' as const
    });
    const view = createPlayerView(state, 'p2');

    expect(view.selectableHomeProvinceIds).toEqual(['frontier', 'far']);
  });

  it('exposes money only to the viewing player', () => {
    const view = createPlayerView(visibilityState(), 'p1');

    expect(view.players).toEqual([
      {
        visibility: 'self',
        id: 'p1',
        label: 'P1',
        color: 0xd9534f,
        money: 31,
        homeProvinceId: 'home',
        provinceCount: 1
      },
      {
        visibility: 'opponent',
        id: 'p2',
        label: 'P2',
        color: 0x3f88c5,
        homeProvinceId: 'enemy',
        provinceCount: 1
      }
    ]);
  });

  it('rejects unknown viewer ids', () => {
    expect(() => createPlayerView(visibilityState(), 'p3' as never)).toThrow(
      'Unknown player id: p3.'
    );
  });
});
