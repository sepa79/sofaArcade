import { describe, expect, it } from 'vitest';

import { ROYALIST_OWNER_ID } from './owners';

import { DEFAULT_GAME_CONFIG, PLAYER_HOME_FORTIFICATION_LEVEL } from './constants';
import { advanceTurnStep, attackProvince, endTurn, fightBattleRound, selectHomeProvince } from './logic';
import { createInitialState } from './state';
import { testGameState, testPlayer, testProvince } from './test-fixtures';
import type { GameState, ProvinceMapState } from './types';

const TWO_PLAYER_CONFIG = {
  ...DEFAULT_GAME_CONFIG,
  aiPlayerCount: 0
};

function testMap(): ProvinceMapState {
  return {
    width: 4,
    height: 3,
    tiles: [
      { x: 0, y: 0, provinceId: null },
      { x: 1, y: 0, provinceId: null },
      { x: 2, y: 0, provinceId: null },
      { x: 3, y: 0, provinceId: null },
      { x: 0, y: 1, provinceId: null },
      { x: 1, y: 1, provinceId: 'home' },
      { x: 2, y: 1, provinceId: 'target' },
      { x: 3, y: 1, provinceId: null },
      { x: 0, y: 2, provinceId: null },
      { x: 1, y: 2, provinceId: null },
      { x: 2, y: 2, provinceId: 'enemy-home' },
      { x: 3, y: 2, provinceId: null }
    ],
    provinces: [
      testProvince({
        id: 'home',
        terrainId: 'plains',
        ownerId: 'p1',
        villages: 2,
        soldiers: 220,
        neighbours: ['target']
      }),
      testProvince({
        id: 'target',
        terrainId: 'desert',
        ownerId: ROYALIST_OWNER_ID,
        villages: 1,
        soldiers: 80,
        neighbours: ['home']
      }),
      testProvince({
        id: 'enemy-home',
        terrainId: 'forest',
        ownerId: 'p2',
        villages: 1,
        soldiers: 20,
        neighbours: []
      })
    ]
  };
}

function turnState(
  map: ProvinceMapState = testMap(),
  turnStep: GameState['turnStep'] = 'attack'
): GameState {
  return testGameState({
    seed: 1,
    rngState: 1,
    phase: 'turn',
    map,
    players: [
      testPlayer({
        id: 'p1',
        label: 'Blue House',
        color: 0x4a90e2,
        homeProvinceId: 'home'
      }),
      testPlayer({
        id: 'p2',
        label: 'Red House',
        color: 0xd95f5f,
        homeProvinceId: 'enemy-home'
      })
    ],
    activePlayerId: 'p1',
    turnStep,
    turnNumber: 1,
    winnerId: null,
    attackSpentProvinceIds: [],
    battle: null
  });
}

function fightUntilResolved(state: GameState): GameState {
  let current = state;
  for (let round = 0; round < 32; round += 1) {
    current = fightBattleRound(current, current.activePlayerId).state;
    if (current.battle === null) {
      return current;
    }
  }

  throw new Error('Test battle did not resolve within 32 rounds.');
}

describe('war for crown logic', () => {
  it('moves from home selection into the first turn after both players choose provinces', () => {
    const initial = createInitialState(5, TWO_PLAYER_CONFIG);
    const firstProvince = initial.map.provinces[0].id;
    const secondProvince = initial.map.provinces[1].id;
    const afterP1 = selectHomeProvince(initial, 'p1', firstProvince, TWO_PLAYER_CONFIG);
    const afterP2 = selectHomeProvince(afterP1, 'p2', secondProvince, TWO_PLAYER_CONFIG);

    expect(afterP1.phase).toBe('home-selection');
    expect(afterP1.activePlayerId).toBe('p2');
    expect(afterP2.phase).toBe('turn');
    expect(afterP2.activePlayerId).toBe('p1');
    expect(afterP2.turnStep).toBe('new-month');
    expect(afterP2.map.provinces.find((province) => province.id === firstProvince)?.ownerId).toBe(
      'p1'
    );
    expect(afterP2.map.provinces.find((province) => province.id === secondProvince)?.ownerId).toBe(
      'p2'
    );
    expect(afterP1.map.provinces.find((province) => province.id === firstProvince)?.fortificationLevel).toBe(
      PLAYER_HOME_FORTIFICATION_LEVEL
    );
    expect(afterP2.map.provinces.find((province) => province.id === secondProvince)?.fortificationLevel).toBe(
      PLAYER_HOME_FORTIFICATION_LEVEL
    );
  });

  it('starts a battle when the attacker commits enough soldiers', () => {
    const next = attackProvince(turnState(), 'p1', ['home'], 'target');
    const home = next.map.provinces.find((province) => province.id === 'home');

    expect(home?.soldiers).toBe(1);
    expect(next.attackSpentProvinceIds).toEqual(['home']);
    expect(next.battle).toMatchObject({
      attackerId: 'p1',
      defenderId: ROYALIST_OWNER_ID,
      fromProvinceIds: ['home'],
      targetProvinceId: 'target',
      attackerSoldiers: 219,
      defenderSoldiers: 80
    });
  });

  it('captures weak terrain after battle rounds resolve', () => {
    const next = fightUntilResolved(attackProvince(turnState(), 'p1', ['home'], 'target'));
    const target = next.map.provinces.find((province) => province.id === 'target');

    expect(next.battle).toBeNull();
    expect(target?.ownerId).toBe('p1');
    expect(target?.soldiers).toBeGreaterThan(0);
    expect(next.attackSpentProvinceIds).toEqual(['home', 'target']);
  });

  it('eliminates a player and transfers all remaining provinces after capturing their home castle', () => {
    const map: ProvinceMapState = {
      width: 4,
      height: 3,
      tiles: [
        { x: 0, y: 0, provinceId: null },
        { x: 1, y: 0, provinceId: null },
        { x: 2, y: 0, provinceId: null },
        { x: 3, y: 0, provinceId: null },
        { x: 0, y: 1, provinceId: null },
        { x: 1, y: 1, provinceId: 'home' },
        { x: 2, y: 1, provinceId: 'enemy-home' },
        { x: 3, y: 1, provinceId: 'enemy-field' },
        { x: 0, y: 2, provinceId: null },
        { x: 1, y: 2, provinceId: null },
        { x: 2, y: 2, provinceId: null },
        { x: 3, y: 2, provinceId: null }
      ],
      provinces: [
        testProvince({
          id: 'home',
          terrainId: 'plains',
          ownerId: 'p1',
          villages: 2,
          soldiers: 220,
          neighbours: ['enemy-home']
        }),
        testProvince({
          id: 'enemy-home',
          terrainId: 'desert',
          ownerId: 'p2',
          villages: 1,
          soldiers: 10,
          fortificationLevel: PLAYER_HOME_FORTIFICATION_LEVEL,
          neighbours: ['home', 'enemy-field']
        }),
        testProvince({
          id: 'enemy-field',
          terrainId: 'forest',
          ownerId: 'p2',
          villages: 3,
          soldiers: 7,
          neighbours: ['enemy-home']
        })
      ]
    };
    const next = fightUntilResolved(attackProvince(turnState(map), 'p1', ['home'], 'enemy-home'));
    const defeated = next.players.find((player) => player.id === 'p2');
    const enemyHome = next.map.provinces.find((province) => province.id === 'enemy-home');
    const enemyField = next.map.provinces.find((province) => province.id === 'enemy-field');

    expect(next.phase).toBe('game-over');
    expect(next.winnerId).toBe('p1');
    expect(defeated?.homeProvinceId).toBe('enemy-home');
    expect(enemyHome?.ownerId).toBe('p1');
    expect(enemyHome?.soldiers).toBeGreaterThan(0);
    expect(enemyField?.ownerId).toBe('p1');
    expect(enemyField?.soldiers).toBe(7);
    expect(next.attackSpentProvinceIds).toEqual(['home', 'enemy-home']);
  });

  it('rejects chain attacks from a province captured by the same attacking army', () => {
    const baseMap = testMap();
    const home = baseMap.provinces.find((province) => province.id === 'home');
    const target = baseMap.provinces.find((province) => province.id === 'target');
    const enemyHome = baseMap.provinces.find((province) => province.id === 'enemy-home');
    if (home === undefined || target === undefined || enemyHome === undefined) {
      throw new Error('Test map is missing home, target, or enemy-home province.');
    }

    const map: ProvinceMapState = {
      ...baseMap,
      tiles: [
        ...baseMap.tiles,
        { x: 3, y: 1, provinceId: 'next' }
      ],
      provinces: [
        {
          ...home,
          neighbours: ['target']
        },
        {
          ...target,
          soldiers: 10,
          neighbours: ['home', 'next']
        },
        testProvince({
          id: 'next',
          terrainId: 'plains',
          ownerId: ROYALIST_OWNER_ID,
          villages: 1,
          soldiers: 1,
          neighbours: ['target']
        }),
        enemyHome
      ]
    };
    const afterCapture = fightUntilResolved(attackProvince(turnState(map), 'p1', ['home'], 'target'));

    expect(() => attackProvince(afterCapture, 'p1', ['target'], 'next')).toThrow(
      'Province target has already committed soldiers this attack phase.'
    );
  });

  it('clears attack-spent provinces after the attack phase ends', () => {
    const baseMap = testMap();
    const target = baseMap.provinces.find((province) => province.id === 'target');
    if (target === undefined) {
      throw new Error('Test map is missing target province.');
    }

    const map: ProvinceMapState = {
      ...baseMap,
      tiles: [
        ...baseMap.tiles,
        { x: 3, y: 1, provinceId: 'next' }
      ],
      provinces: [
        ...baseMap.provinces.map((province) =>
          province.id === 'target'
            ? { ...province, soldiers: 10, neighbours: ['home', 'next'] }
            : province
        ),
        testProvince({
          id: 'next',
          terrainId: 'plains',
          ownerId: ROYALIST_OWNER_ID,
          villages: 1,
          soldiers: 1,
          neighbours: ['target']
        })
      ]
    };
    const started = attackProvince(turnState(map), 'p1', ['home'], 'target');
    const resolved = fightUntilResolved(started);
    const next = advanceTurnStep(resolved, 'p1');

    expect(resolved.attackSpentProvinceIds.length).toBeGreaterThan(0);
    expect(next.state.turnStep).toBe('movement');
    expect(next.state.attackSpentProvinceIds).toEqual([]);
  });

  it('keeps the defender alive on mountains against insufficient force', () => {
    const map = {
      ...testMap(),
      provinces: testMap().provinces.map((province) =>
        province.id === 'target'
          ? { ...province, terrainId: 'mountains' as const, soldiers: 220 }
          : province
      )
    };
    const next = fightUntilResolved(attackProvince(turnState(map), 'p1', ['home'], 'target'));
    const target = next.map.provinces.find((province) => province.id === 'target');

    expect(next.battle).toBeNull();
    expect(target?.ownerId).toBe(ROYALIST_OWNER_ID);
    expect(target?.soldiers).toBeGreaterThan(0);
  });

  it('rejects attacks from provinces without mobile soldiers', () => {
    const map = {
      ...testMap(),
      provinces: testMap().provinces.map((province) =>
        province.id === 'home' ? { ...province, soldiers: 1 } : province
      )
    };

    expect(() => attackProvince(turnState(map), 'p1', ['home'], 'target')).toThrow(
      'Province home has no mobile soldiers for attack.'
    );
  });

  it('passes the turn without collecting income', () => {
    const next = endTurn(turnState(undefined, 'investment'));
    const player = next.players.find((candidate) => candidate.id === 'p1');

    expect(next.activePlayerId).toBe('p2');
    expect(next.turnStep).toBe('new-month');
    expect(next.turnNumber).toBe(1);
    expect(player?.money).toBe(20);
  });
});
