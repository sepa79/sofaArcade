import { describe, expect, it } from 'vitest';

import { ROYALIST_OWNER_ID } from './owners';

import {
  c64CbaronEconomyDecision,
  c64CbaronVillagePurchases,
  runC64CbaronEconomy
} from './c64-cbaron-economy';
import { DEFAULT_GAME_CONFIG } from './constants';
import { testGameState, testPlayer, testProvince } from './test-fixtures';
import type { C64AiPlayerMemory, GameState } from './types';

const ownerSlots = [
  { ownerId: ROYALIST_OWNER_ID, isComputer: false },
  { ownerId: 'p1', isComputer: true },
  { ownerId: 'p2', isComputer: true }
] as const;

function withMemory(
  state: GameState,
  playerId: string,
  update: Partial<C64AiPlayerMemory>
): GameState {
  return {
    ...state,
    c64: {
      ...state.c64,
      playerMemory: state.c64.playerMemory.map((memory) =>
        memory.playerId === playerId
          ? {
              ...memory,
              ...update
            }
          : memory
      )
    }
  };
}

function economyFixtureState(): GameState {
  return testGameState({
    seed: 1,
    rngState: 1,
    phase: 'turn',
    map: {
      width: 3,
      height: 1,
      tiles: [],
      provinces: [
        testProvince({
          id: 'home',
          terrainId: 'plains',
          ownerId: 'p1',
          villages: 2,
          soldiers: 10,
          neighbours: ['front']
        }),
        testProvince({
          id: 'front',
          terrainId: 'plains',
          ownerId: 'p1',
          villages: 2,
          soldiers: 10,
          neighbours: ['home', 'enemy']
        }),
        testProvince({
          id: 'enemy',
          terrainId: 'plains',
          ownerId: 'p2',
          villages: 2,
          soldiers: 3,
          neighbours: ['front']
        })
      ]
    },
    players: [
      testPlayer({ id: 'p1', label: 'P1', color: 0xd9534f, money: 100, homeProvinceId: 'home' }),
      testPlayer({ id: 'p2', label: 'P2', color: 0x3f88c5, money: 20, homeProvinceId: 'enemy' })
    ],
    activePlayerId: 'p1',
    turnStep: 'investment',
    turnNumber: 1,
    winnerId: null,
    attackSpentProvinceIds: [],
    battle: null
  });
}

function economyFixtureStateWithOwnedVillageCaps(): GameState {
  const state = economyFixtureState();
  return {
    ...state,
    map: {
      ...state.map,
      provinces: state.map.provinces.map((province) =>
        province.ownerId === 'p1'
          ? {
              ...province,
              villages: 12
            }
          : province
      )
    }
  };
}

describe('C64 cbaron economy decision', () => {
  it('matches L5990 debt underflow interest branch', () => {
    const state = withMemory(
      {
        ...economyFixtureState(),
        players: [
          testPlayer({ id: 'p1', label: 'P1', color: 0xd9534f, money: 50, homeProvinceId: 'home' }),
          testPlayer({ id: 'p2', label: 'P2', color: 0x3f88c5, money: 20, homeProvinceId: 'enemy' })
        ]
      },
      'p1',
      { economyCarryoverMoney: 80 }
    );

    expect(c64CbaronEconomyDecision({
      state,
      activePlayerId: 'p1',
      ownerSlots,
      config: DEFAULT_GAME_CONFIG
    })).toEqual({
      branch: 'carryover-underflow',
      adjustedMoney: 54,
      adjustedCarryoverMoney: 54
    });
  });

  it('matches L5990 base recruitment branch through the fixture stop point', () => {
    expect(c64CbaronEconomyDecision({
      state: economyFixtureState(),
      activePlayerId: 'p1',
      ownerSlots,
      config: DEFAULT_GAME_CONFIG
    })).toEqual({
      branch: 'recruitment',
      activeOwnerSlot: 1,
      availableMoney: 100,
      mobileFrontierSoldiers: 9,
      requiredFrontierSoldiers: 2,
      surplusSoldiers: 7,
      surplusDiscount: 4,
      baseRecruitBudget: 20,
      moneyCap: 95,
      pressureUsed: false,
      pressureHire: 0,
      hiredSoldiers: 20,
      homeProvinceId: 'home'
    });
  });

  it('treats neutral royalist borders as economy frontier without hostile threat', () => {
    const state = testGameState({
      seed: 1,
      rngState: 1,
      phase: 'turn',
      map: {
        width: 3,
        height: 1,
        tiles: [],
        provinces: [
          testProvince({
            id: 'home',
            terrainId: 'plains',
            ownerId: 'p1',
            villages: 2,
            soldiers: 1,
            neighbours: ['front']
          }),
          testProvince({
            id: 'front',
            terrainId: 'plains',
            ownerId: 'p1',
            villages: 2,
            soldiers: 10,
            neighbours: ['home', 'neutral']
          }),
          testProvince({
            id: 'neutral',
            terrainId: 'plains',
            ownerId: ROYALIST_OWNER_ID,
            villages: 12,
            soldiers: 32,
            neighbours: ['front']
          })
        ]
      },
      players: [
        testPlayer({ id: 'p1', label: 'P1', color: 0xd9534f, money: 20, homeProvinceId: 'home' }),
        testPlayer({ id: 'p2', label: 'P2', color: 0x3f88c5, money: 20, homeProvinceId: null })
      ],
      activePlayerId: 'p1',
      turnStep: 'investment',
      turnNumber: 1,
      winnerId: null,
      attackSpentProvinceIds: [],
      battle: null
    });

    expect(c64CbaronEconomyDecision({
      state,
      activePlayerId: 'p1',
      ownerSlots,
      config: DEFAULT_GAME_CONFIG
    })).toMatchObject({
      branch: 'recruitment',
      availableMoney: 20,
      mobileFrontierSoldiers: 9,
      requiredFrontierSoldiers: 0,
      baseRecruitBudget: 4,
      pressureUsed: false,
      hiredSoldiers: 4,
      homeProvinceId: 'home'
    });
  });

  it('still recruits base budget when the active player has no economy frontier', () => {
    const state = testGameState({
      seed: 1,
      rngState: 1,
      phase: 'turn',
      map: {
        width: 4,
        height: 1,
        tiles: [],
        provinces: [
          testProvince({
            id: 'home',
            terrainId: 'plains',
            ownerId: 'p1',
            villages: 2,
            soldiers: 1,
            neighbours: ['rear']
          }),
          testProvince({
            id: 'rear',
            terrainId: 'plains',
            ownerId: 'p1',
            villages: 2,
            soldiers: 1,
            neighbours: ['home']
          }),
          testProvince({
            id: 'enemy',
            terrainId: 'plains',
            ownerId: 'p2',
            villages: 2,
            soldiers: 20,
            neighbours: []
          })
        ]
      },
      players: [
        testPlayer({ id: 'p1', label: 'P1', color: 0xd9534f, money: 20, homeProvinceId: 'home' }),
        testPlayer({ id: 'p2', label: 'P2', color: 0x3f88c5, money: 20, homeProvinceId: 'enemy' })
      ],
      activePlayerId: 'p1',
      turnStep: 'investment',
      turnNumber: 1,
      winnerId: null,
      attackSpentProvinceIds: [],
      battle: null
    });

    expect(c64CbaronEconomyDecision({
      state,
      activePlayerId: 'p1',
      ownerSlots,
      config: DEFAULT_GAME_CONFIG
    })).toEqual({
      branch: 'recruitment',
      activeOwnerSlot: 1,
      availableMoney: 20,
      mobileFrontierSoldiers: 0,
      requiredFrontierSoldiers: 0,
      surplusSoldiers: 0,
      surplusDiscount: 0,
      baseRecruitBudget: 4,
      moneyCap: 19,
      pressureUsed: false,
      pressureHire: 0,
      hiredSoldiers: 4,
      homeProvinceId: 'home'
    });
  });

  it('matches L5990 adjacent previous-hire pressure recruitment branch', () => {
    const state = withMemory(economyFixtureState(), 'p2', { hiredSoldiers: 50 });

    expect(c64CbaronEconomyDecision({
      state,
      activePlayerId: 'p1',
      ownerSlots,
      config: DEFAULT_GAME_CONFIG
    })).toMatchObject({
      branch: 'recruitment',
      surplusDiscount: 4,
      baseRecruitBudget: 20,
      moneyCap: 95,
      pressureUsed: true,
      pressureHire: 50,
      hiredSoldiers: 46
    });
  });

  it('matches L5BC6 iterative village purchase target and amount', () => {
    const result = c64CbaronVillagePurchases({
      state: {
        ...economyFixtureState(),
        map: {
          width: 3,
          height: 1,
          tiles: [],
          provinces: [
            testProvince({
              id: 'home',
              terrainId: 'plains',
              ownerId: 'p1',
              villages: 12,
              soldiers: 10,
              neighbours: ['front']
            }),
            testProvince({
              id: 'front',
              terrainId: 'plains',
              ownerId: 'p1',
              villages: 4,
              soldiers: 5,
              neighbours: ['home', 'enemy']
            }),
            testProvince({
              id: 'enemy',
              terrainId: 'plains',
              ownerId: 'p2',
              villages: 2,
              soldiers: 3,
              neighbours: ['front']
            })
          ]
        }
      },
      activePlayerId: 'p1',
      money: 20,
      config: DEFAULT_GAME_CONFIG
    });

    expect(result.remainingMoney).toBe(0);
    expect(result.purchases).toEqual([{
      provinceId: 'front',
      villagesBought: 5,
      cost: 20
    }]);
    expect(result.map.provinces.find((province) => province.id === 'front')?.villages).toBe(9);
  });

  it('matches L5914 late-date rejection of non-home frontier village purchases', () => {
    const state = economyFixtureState();
    const result = c64CbaronVillagePurchases({
      state: {
        ...state,
        turnNumber: 9,
        map: {
          ...state.map,
          provinces: state.map.provinces.map((province) =>
            province.id === 'home'
              ? { ...province, villages: 12 }
              : province
          )
        }
      },
      activePlayerId: 'p1',
      money: 20,
      config: DEFAULT_GAME_CONFIG
    });

    expect(result.remainingMoney).toBe(20);
    expect(result.purchases).toEqual([]);
  });

  it('runs L5990 recruitment and final L59C0 carryover update', () => {
    const result = runC64CbaronEconomy({
      state: economyFixtureStateWithOwnedVillageCaps(),
      activePlayerId: 'p1',
      ownerSlots,
      config: DEFAULT_GAME_CONFIG
    });
    const player = result.state.players.find((candidate) => candidate.id === 'p1');
    const memory = result.state.c64.playerMemory.find((candidate) => candidate.playerId === 'p1');
    const home = result.state.map.provinces.find((province) => province.id === 'home');

    expect(result.decision).toMatchObject({
      branch: 'recruitment',
      hiredSoldiers: 20
    });
    expect(result.villagePurchases).toEqual([]);
    expect(result.moneyBeforeFinalCarryover).toBe(80);
    expect(result.finalMoney).toBe(86);
    expect(player?.money).toBe(86);
    expect(memory?.hiredSoldiers).toBe(20);
    expect(memory?.economyCarryoverMoney).toBe(86);
    expect(home?.soldiers).toBe(30);
  });

  it('runs L5990 debt underflow branch into state money and carryover', () => {
    const state = withMemory(
      {
        ...economyFixtureStateWithOwnedVillageCaps(),
        players: [
          testPlayer({ id: 'p1', label: 'P1', color: 0xd9534f, money: 50, homeProvinceId: 'home' }),
          testPlayer({ id: 'p2', label: 'P2', color: 0x3f88c5, money: 20, homeProvinceId: 'enemy' })
        ]
      },
      'p1',
      { economyCarryoverMoney: 80 }
    );

    const result = runC64CbaronEconomy({
      state,
      activePlayerId: 'p1',
      ownerSlots,
      config: DEFAULT_GAME_CONFIG
    });
    const player = result.state.players.find((candidate) => candidate.id === 'p1');
    const memory = result.state.c64.playerMemory.find((candidate) => candidate.playerId === 'p1');

    expect(result.decision).toEqual({
      branch: 'carryover-underflow',
      adjustedMoney: 54,
      adjustedCarryoverMoney: 54
    });
    expect(result.finalMoney).toBe(54);
    expect(player?.money).toBe(54);
    expect(memory?.economyCarryoverMoney).toBe(54);
  });
});
