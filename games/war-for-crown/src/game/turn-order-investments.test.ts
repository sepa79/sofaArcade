import { describe, expect, it } from 'vitest';

import { ROYALIST_OWNER_ID } from './owners';

import { applyPlayerAction } from './actions';
import { testGameState, testPlayer, testProvince } from './test-fixtures';
import type { GameState, ProvinceMapState, ProvinceState, TurnStep } from './types';

function turnMap(
  targetOverrides: Partial<ProvinceState> = {},
  allyOverrides: Partial<ProvinceState> = {}
): ProvinceMapState {
  return {
    width: 5,
    height: 3,
    tiles: [
      { x: 0, y: 0, provinceId: null },
      { x: 1, y: 0, provinceId: null },
      { x: 2, y: 0, provinceId: null },
      { x: 3, y: 0, provinceId: null },
      { x: 4, y: 0, provinceId: null },
      { x: 0, y: 1, provinceId: null },
      { x: 1, y: 1, provinceId: 'home' },
      { x: 2, y: 1, provinceId: 'ally' },
      { x: 3, y: 1, provinceId: 'target' },
      { x: 4, y: 1, provinceId: null },
      { x: 0, y: 2, provinceId: null },
      { x: 1, y: 2, provinceId: null },
      { x: 2, y: 2, provinceId: 'reserve' },
      { x: 3, y: 2, provinceId: null },
      { x: 4, y: 2, provinceId: 'p2-home' }
    ],
    provinces: [
      testProvince({
        id: 'home',
        terrainId: 'plains',
        ownerId: 'p1',
        villages: 2,
        soldiers: 200,
        neighbours: ['ally']
      }),
      testProvince({
        id: 'ally',
        terrainId: 'plains',
        ownerId: 'p1',
        villages: 1,
        soldiers: 20,
        neighbours: ['home', 'target', 'reserve'],
        ...allyOverrides
      }),
      testProvince({
        id: 'target',
        terrainId: 'plains',
        ownerId: ROYALIST_OWNER_ID,
        villages: 1,
        soldiers: 80,
        neighbours: ['ally'],
        ...targetOverrides
      }),
      testProvince({
        id: 'reserve',
        terrainId: 'plains',
        ownerId: 'p1',
        villages: 0,
        soldiers: 5,
        neighbours: ['ally']
      }),
      testProvince({
        id: 'p2-home',
        terrainId: 'forest',
        ownerId: 'p2',
        villages: 1,
        soldiers: 20,
        neighbours: []
      })
    ]
  };
}

function turnState(turnStep: TurnStep, map: ProvinceMapState = turnMap()): GameState {
  return testGameState({
    seed: 1,
    rngState: 1,
    phase: 'turn',
    map,
    players: [
      testPlayer({
        id: 'p1',
        label: 'P1',
        color: 0xd9534f,
        money: 40,
        homeProvinceId: 'home'
      }),
      testPlayer({
        id: 'p2',
        label: 'P2',
        color: 0x3f88c5,
        money: 20,
        homeProvinceId: 'p2-home'
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

describe('turn order and investments', () => {
  it('advances through the documented v0 turn steps', () => {
    const newMonth = turnState('new-month');
    const attack = applyPlayerAction(newMonth, 'p1', { type: 'advance-step' });
    const movement = applyPlayerAction(attack.state, 'p1', { type: 'advance-step' });
    const investment = applyPlayerAction(movement.state, 'p1', { type: 'advance-step' });
    const nextPlayer = applyPlayerAction(investment.state, 'p1', { type: 'advance-step' });
    const player = attack.state.players.find((candidate) => candidate.id === 'p1');

    expect(attack.state.turnStep).toBe('attack');
    expect(attack.events).toEqual([
      { type: 'turn-step-advanced', playerId: 'p1', from: 'new-month', to: 'attack' },
      { type: 'player-title-changed', playerId: 'p1', previousRank: 0, rank: 1 },
      { type: 'income-collected', playerId: 'p1', money: 4 }
    ]);
    expect(player?.money).toBe(44);
    expect(movement.state.turnStep).toBe('movement');
    expect(investment.state.turnStep).toBe('investment');
    expect(nextPlayer.state.activePlayerId).toBe('p2');
    expect(nextPlayer.state.turnStep).toBe('new-month');
    expect(nextPlayer.state.turnNumber).toBe(1);
  });

  it('rejects actions outside their documented turn steps', () => {
    const newMonth = turnState('new-month');

    expect(() =>
      applyPlayerAction(newMonth, 'p1', {
        type: 'attack',
        fromProvinceIds: ['ally'],
        targetProvinceId: 'target'
      })
    ).toThrow('Cannot attack during turn step "new-month".');
    expect(() =>
      applyPlayerAction(newMonth, 'p1', {
        type: 'move-soldiers',
        fromProvinceId: 'home',
        targetProvinceId: 'ally',
        targetSoldiers: 10
      })
    ).toThrow('Cannot move soldiers during turn step "new-month".');
    expect(() => applyPlayerAction(newMonth, 'p1', { type: 'recruit-soldiers', soldiers: 1 })).toThrow(
      'Cannot recruit soldiers during turn step "new-month".'
    );
    expect(() =>
      applyPlayerAction(newMonth, 'p1', { type: 'build-village', provinceId: 'home' })
    ).toThrow('Cannot build village during turn step "new-month".');
    expect(() =>
      applyPlayerAction(newMonth, 'p1', { type: 'upgrade-fortification', provinceId: 'home' })
    ).toThrow('Cannot upgrade fortification during turn step "new-month".');
  });

  it('recruits soldiers by spending player money at the home province', () => {
    const result = applyPlayerAction(turnState('investment'), 'p1', {
      type: 'recruit-soldiers',
      soldiers: 7
    });
    const home = result.state.map.provinces.find((province) => province.id === 'home');
    const player = result.state.players.find((candidate) => candidate.id === 'p1');

    expect(result.events).toEqual([
      {
        type: 'soldiers-recruited',
        playerId: 'p1',
        provinceId: 'home',
        soldiers: 7,
        cost: 7
      }
    ]);
    expect(home?.soldiers).toBe(207);
    expect(player?.money).toBe(33);
  });

  it('builds villages by spending money and fails at the village cap', () => {
    const built = applyPlayerAction(turnState('investment'), 'p1', {
      type: 'build-village',
      provinceId: 'ally'
    });
    const ally = built.state.map.provinces.find((province) => province.id === 'ally');
    const player = built.state.players.find((candidate) => candidate.id === 'p1');

    expect(built.events).toEqual([
      { type: 'village-built', playerId: 'p1', provinceId: 'ally', cost: 4 }
    ]);
    expect(ally?.villages).toBe(2);
    expect(player?.money).toBe(36);
    expect(() =>
      applyPlayerAction(
        turnState('investment', turnMap({}, { villages: 12 })),
        'p1',
        { type: 'build-village', provinceId: 'ally' }
      )
    ).toThrow('Province ally already has 12 villages.');
  });

  it('upgrades fortifications once per investment phase', () => {
    const upgraded = applyPlayerAction(turnState('investment'), 'p1', {
      type: 'upgrade-fortification',
      provinceId: 'ally'
    });
    const ally = upgraded.state.map.provinces.find((province) => province.id === 'ally');
    const player = upgraded.state.players.find((candidate) => candidate.id === 'p1');

    expect(upgraded.events).toEqual([
      {
        type: 'fortification-upgraded',
        playerId: 'p1',
        provinceId: 'ally',
        level: 'watchtower',
        cost: 10
      }
    ]);
    expect(ally?.fortificationLevel).toBe('watchtower');
    expect(ally?.upgradedFortificationThisTurn).toBe(true);
    expect(player?.money).toBe(30);
    expect(() =>
      applyPlayerAction(upgraded.state, 'p1', {
        type: 'upgrade-fortification',
        provinceId: 'ally'
      })
    ).toThrow('Province ally already upgraded fortification this turn.');
  });

  it('moves soldiers between owned provinces during movement', () => {
    const result = applyPlayerAction(turnState('movement'), 'p1', {
      type: 'move-soldiers',
      fromProvinceId: 'home',
      targetProvinceId: 'ally',
      targetSoldiers: 45
    });
    const home = result.state.map.provinces.find((province) => province.id === 'home');
    const ally = result.state.map.provinces.find((province) => province.id === 'ally');

    expect(result.events).toEqual([
      {
        type: 'soldiers-moved',
        playerId: 'p1',
        fromProvinceId: 'home',
        targetProvinceId: 'ally',
        soldiers: 25
      }
    ]);
    expect(home?.soldiers).toBe(175);
    expect(ally?.soldiers).toBe(45);
  });

  it('moves soldiers to a non-adjacent owned province during movement', () => {
    const result = applyPlayerAction(turnState('movement'), 'p1', {
      type: 'move-soldiers',
      fromProvinceId: 'home',
      targetProvinceId: 'reserve',
      targetSoldiers: 30
    });
    const home = result.state.map.provinces.find((province) => province.id === 'home');
    const reserve = result.state.map.provinces.find((province) => province.id === 'reserve');

    expect(result.events).toEqual([
      {
        type: 'soldiers-moved',
        playerId: 'p1',
        fromProvinceId: 'home',
        targetProvinceId: 'reserve',
        soldiers: 25
      }
    ]);
    expect(home?.soldiers).toBe(175);
    expect(reserve?.soldiers).toBe(30);
  });

  it('rejects movement between disconnected owned components', () => {
    const connectedMap = turnMap();
    const disconnectedMap: ProvinceMapState = {
      ...connectedMap,
      provinces: connectedMap.provinces.map((province) => {
        if (province.id === 'ally') {
          return { ...province, neighbours: province.neighbours.filter((id) => id !== 'reserve') };
        }
        if (province.id === 'reserve') {
          return { ...province, neighbours: [] };
        }
        return province;
      })
    };

    expect(() => applyPlayerAction(turnState('movement', disconnectedMap), 'p1', {
      type: 'move-soldiers',
      fromProvinceId: 'home',
      targetProvinceId: 'reserve',
      targetSoldiers: 30
    })).toThrow('Movement provinces home and reserve are not connected');
  });

  it('uses the C64 final-target-count movement semantics in both directions', () => {
    const result = applyPlayerAction(turnState('movement'), 'p1', {
      type: 'move-soldiers',
      fromProvinceId: 'home',
      targetProvinceId: 'ally',
      targetSoldiers: 5
    });

    expect(result.state.map.provinces.find((province) => province.id === 'home')?.soldiers).toBe(215);
    expect(result.state.map.provinces.find((province) => province.id === 'ally')?.soldiers).toBe(5);
    expect(result.events).toEqual([{
      type: 'soldiers-moved',
      playerId: 'p1',
      fromProvinceId: 'ally',
      targetProvinceId: 'home',
      soldiers: 15
    }]);
  });

  it('includes fortification in defender battle strength', () => {
    const unfortified = applyPlayerAction(
      turnState('attack', turnMap({}, { soldiers: 100 })),
      'p1',
      {
        type: 'attack',
        fromProvinceIds: ['ally'],
        targetProvinceId: 'target'
      }
    );
    const fortified = applyPlayerAction(
      turnState('attack', turnMap({ fortificationLevel: 'castle' }, { soldiers: 100 })),
      'p1',
      {
        type: 'attack',
        fromProvinceIds: ['ally'],
        targetProvinceId: 'target'
      }
    );

    expect(unfortified.events[0]).toMatchObject({
      type: 'battle-started'
    });
    expect(fortified.events[0]).toMatchObject({
      type: 'battle-started'
    });
    expect(unfortified.state.battle?.defenderCombatPercent).toBe(25);
    expect(fortified.state.battle?.defenderCombatPercent).toBe(50);
  });
});
