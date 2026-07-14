import { describe, expect, it } from 'vitest';

import { ROYALIST_OWNER_ID } from './owners';

import { validateGameState } from './invariants';
import { createInitialState } from './state';
import { testGameState, testProvince } from './test-fixtures';
import type { GameState } from './types';

describe('game state invariants', () => {
  it('accepts a generated initial state', () => {
    expect(() => validateGameState(createInitialState(13))).not.toThrow();
  });

  it('rejects asymmetric adjacency', () => {
    const state: GameState = testGameState({
      seed: 1,
      rngState: 1,
      phase: 'turn',
      map: {
        width: 3,
        height: 3,
        tiles: [
          { x: 0, y: 0, provinceId: null },
          { x: 1, y: 0, provinceId: null },
          { x: 2, y: 0, provinceId: null },
          { x: 0, y: 1, provinceId: null },
          { x: 1, y: 1, provinceId: 'home' },
          { x: 2, y: 1, provinceId: 'frontier' },
          { x: 0, y: 2, provinceId: null },
          { x: 1, y: 2, provinceId: null },
          { x: 2, y: 2, provinceId: null }
        ],
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
            ownerId: ROYALIST_OWNER_ID,
            villages: 1,
            soldiers: 10,
            neighbours: []
          })
        ]
      },
      players: [
        { id: 'p1', label: 'P1', color: 0xd9534f, money: 0, homeProvinceId: 'home' },
        { id: 'p2', label: 'P2', color: 0x3f88c5, money: 0, homeProvinceId: null }
      ],
      activePlayerId: 'p1',
      turnStep: 'new-month',
      turnNumber: 1,
      winnerId: null,
      attackSpentProvinceIds: [],
      battle: null
    });

    expect(() => validateGameState(state)).toThrow(
      'Province adjacency is not symmetric: home -> frontier.'
    );
  });

  it('rejects invalid RNG state', () => {
    const state = {
      ...createInitialState(13),
      rngState: -1
    };

    expect(() => validateGameState(state)).toThrow('Game RNG state must be a non-negative integer, got -1.');
  });

  it('rejects duplicate C64 player memory ids', () => {
    const initial = createInitialState(13);
    const firstPlayerMemory = initial.c64.playerMemory[0];
    if (firstPlayerMemory === undefined) {
      throw new Error('Initial test state has no C64 player memory.');
    }
    const state: GameState = {
      ...initial,
      c64: {
        ...initial.c64,
        playerMemory: initial.c64.playerMemory.map((memory, index) =>
          index === 1 ? { ...memory, playerId: firstPlayerMemory.playerId } : memory
        )
      }
    };

    expect(() => validateGameState(state)).toThrow('Duplicate C64 player memory id: p1.');
  });

  it('accepts a defeated player retaining the captured C64 home marker', () => {
    const state: GameState = testGameState({
      seed: 1,
      rngState: 1,
      phase: 'game-over',
      map: {
        width: 3,
        height: 1,
        tiles: [
          { x: 0, y: 0, provinceId: 'p1-home' },
          { x: 1, y: 0, provinceId: 'p2-home' },
          { x: 2, y: 0, provinceId: null }
        ],
        provinces: [
          testProvince({
            id: 'p1-home',
            terrainId: 'plains',
            ownerId: 'p1',
            villages: 1,
            soldiers: 10,
            neighbours: ['p2-home']
          }),
          testProvince({
            id: 'p2-home',
            terrainId: 'plains',
            ownerId: 'p1',
            villages: 1,
            soldiers: 5,
            neighbours: ['p1-home']
          })
        ]
      },
      players: [
        { id: 'p1', label: 'P1', color: 0xd9534f, money: 0, homeProvinceId: 'p1-home' },
        { id: 'p2', label: 'P2', color: 0x3f88c5, money: 0, homeProvinceId: 'p2-home' }
      ],
      activePlayerId: 'p1',
      turnStep: 'attack',
      turnNumber: 1,
      winnerId: 'p1',
      attackSpentProvinceIds: [],
      battle: null
    });

    expect(() => validateGameState(state)).not.toThrow();
  });

  it('rejects a live player whose C64 home marker is owned by someone else', () => {
    const state: GameState = testGameState({
      seed: 1,
      rngState: 1,
      phase: 'turn',
      map: {
        width: 3,
        height: 1,
        tiles: [
          { x: 0, y: 0, provinceId: 'p1-home' },
          { x: 1, y: 0, provinceId: 'p2-home' },
          { x: 2, y: 0, provinceId: 'p1-field' }
        ],
        provinces: [
          testProvince({
            id: 'p1-home',
            terrainId: 'plains',
            ownerId: 'p1',
            villages: 1,
            soldiers: 10,
            neighbours: ['p2-home']
          }),
          testProvince({
            id: 'p2-home',
            terrainId: 'plains',
            ownerId: 'p1',
            villages: 1,
            soldiers: 5,
            neighbours: ['p1-home', 'p1-field']
          }),
          testProvince({
            id: 'p1-field',
            terrainId: 'plains',
            ownerId: 'p2',
            villages: 1,
            soldiers: 3,
            neighbours: ['p2-home']
          })
        ]
      },
      players: [
        { id: 'p1', label: 'P1', color: 0xd9534f, money: 0, homeProvinceId: 'p1-home' },
        { id: 'p2', label: 'P2', color: 0x3f88c5, money: 0, homeProvinceId: 'p2-home' }
      ],
      activePlayerId: 'p1',
      turnStep: 'attack',
      turnNumber: 1,
      winnerId: null,
      attackSpentProvinceIds: [],
      battle: null
    });

    expect(() => validateGameState(state)).toThrow(
      'Player p2 home province p2-home is owned by p1.'
    );
  });

  it('rejects a player winner before continent ownership', () => {
    const state: GameState = testGameState({
      seed: 1,
      rngState: 1,
      phase: 'game-over',
      map: {
        width: 2,
        height: 1,
        tiles: [
          { x: 0, y: 0, provinceId: 'home' },
          { x: 1, y: 0, provinceId: 'royal' }
        ],
        provinces: [
          testProvince({
            id: 'home',
            terrainId: 'plains',
            ownerId: 'p1',
            villages: 1,
            soldiers: 10,
            neighbours: ['royal']
          }),
          testProvince({
            id: 'royal',
            terrainId: 'plains',
            ownerId: ROYALIST_OWNER_ID,
            villages: 1,
            soldiers: 3,
            neighbours: ['home']
          })
        ]
      },
      players: [
        { id: 'p1', label: 'P1', color: 0xd9534f, money: 0, homeProvinceId: 'home' },
        { id: 'p2', label: 'P2', color: 0x3f88c5, money: 0, homeProvinceId: 'royal' }
      ],
      activePlayerId: 'p1',
      turnStep: 'attack',
      turnNumber: 1,
      winnerId: 'p1',
      attackSpentProvinceIds: [],
      battle: null
    });

    expect(() => validateGameState(state)).toThrow(
      'Winner p1 is set before owning every province.'
    );
  });

  it('rejects C64 royalist production buckets outside byte range', () => {
    const initial = createInitialState(13);
    const firstRoyalistMemory = initial.c64.royalistProvinceMemory[0];
    if (firstRoyalistMemory === undefined) {
      throw new Error('Initial test state has no C64 royalist memory.');
    }
    const state: GameState = {
      ...initial,
      c64: {
        ...initial.c64,
        royalistProvinceMemory: initial.c64.royalistProvinceMemory.map((memory, index) =>
          index === 0 ? { ...memory, villageInvestmentBucket: 256 } : memory
        )
      }
    };

    expect(() => validateGameState(state)).toThrow(
      `C64 royalist village bucket for ${firstRoyalistMemory.provinceId} must be an integer from 0 to 255, got 256.`
    );
  });

  it('rejects invalid C64 economy carryover money', () => {
    const initial = createInitialState(13);
    const state: GameState = {
      ...initial,
      c64: {
        ...initial.c64,
        playerMemory: initial.c64.playerMemory.map((memory, index) =>
          index === 0 ? { ...memory, economyCarryoverMoney: -1 } : memory
        )
      }
    };

    expect(() => validateGameState(state)).toThrow(
      'C64 economy carryover money for p1 must be a non-negative integer, got -1.'
    );
  });
});
