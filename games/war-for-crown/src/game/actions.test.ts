import { describe, expect, it } from 'vitest';

import { ROYALIST_OWNER_ID } from './owners';

import { applyPlayerAction } from './actions';
import { DEFAULT_GAME_CONFIG } from './constants';
import { testGameState, testPlayer, testProvince } from './test-fixtures';
import type { GameState, ProvinceMapState } from './types';

function actionMap(): ProvinceMapState {
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
      { x: 2, y: 1, provinceId: 'target' },
      { x: 3, y: 1, provinceId: 'enemy-home' },
      { x: 4, y: 1, provinceId: null },
      { x: 0, y: 2, provinceId: null },
      { x: 1, y: 2, provinceId: null },
      { x: 2, y: 2, provinceId: null },
      { x: 3, y: 2, provinceId: null },
      { x: 4, y: 2, provinceId: null }
    ],
    provinces: [
      testProvince({
        id: 'home',
        terrainId: 'plains',
        ownerId: ROYALIST_OWNER_ID,
        villages: 2,
        soldiers: 120,
        neighbours: ['target']
      }),
      testProvince({
        id: 'target',
        terrainId: 'desert',
        ownerId: ROYALIST_OWNER_ID,
        villages: 1,
        soldiers: 8,
        neighbours: ['enemy-home', 'home']
      }),
      testProvince({
        id: 'enemy-home',
        terrainId: 'forest',
        ownerId: ROYALIST_OWNER_ID,
        villages: 3,
        soldiers: 160,
        neighbours: ['target']
      })
    ]
  };
}

function homeSelectionState(): GameState {
  return testGameState({
    seed: 1,
    rngState: 1,
    phase: 'home-selection',
    map: actionMap(),
    players: [
      testPlayer({ id: 'p1', label: 'P1', color: 0xd9534f, homeProvinceId: null }),
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

function readyState(): GameState {
  const afterP1 = applyPlayerAction(homeSelectionState(), 'p1', {
    type: 'select-home',
    provinceId: 'home'
  }).state;
  return applyPlayerAction(afterP1, 'p2', {
    type: 'select-home',
    provinceId: 'enemy-home'
  }).state;
}

function attackStepState(): GameState {
  return applyPlayerAction(readyState(), 'p1', { type: 'advance-step' }).state;
}

function finishBattle(state: GameState): GameState {
  let current = state;
  for (let round = 0; round < 32; round += 1) {
    const result = applyPlayerAction(current, current.activePlayerId, { type: 'battle-round' });
    current = result.state;
    if (current.battle === null) {
      return current;
    }
  }

  throw new Error('Test battle did not resolve within 32 rounds.');
}

function winningState(): GameState {
  return testGameState({
    seed: 1,
    rngState: 1,
    phase: 'turn',
    map: {
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
          neighbours: ['target']
        }),
        testProvince({
          id: 'target',
          terrainId: 'desert',
          ownerId: ROYALIST_OWNER_ID,
          villages: 1,
          soldiers: 80,
          neighbours: ['home']
        })
      ]
    },
    players: [
      testPlayer({ id: 'p1', label: 'P1', color: 0xd9534f, homeProvinceId: 'home' }),
      testPlayer({ id: 'p2', label: 'P2', color: 0x3f88c5, homeProvinceId: null })
    ],
    activePlayerId: 'p1',
    turnStep: 'attack',
    turnNumber: 1,
    winnerId: null,
    attackSpentProvinceIds: [],
    battle: null
  });
}

function c64BaronAttackState(): GameState {
  return testGameState({
    seed: 1,
    rngState: 0x8c,
    phase: 'turn',
    map: {
      width: 3,
      height: 1,
      tiles: [],
      provinces: [
        testProvince({
          id: '1',
          terrainId: 'plains',
          ownerId: 'p1',
          villages: 2,
          soldiers: 50,
          neighbours: ['2']
        }),
        testProvince({
          id: '2',
          terrainId: 'plains',
          ownerId: 'p2',
          villages: 2,
          soldiers: 1,
          neighbours: ['1', '3']
        }),
        testProvince({
          id: '3',
          terrainId: 'plains',
          ownerId: 'p1',
          villages: 2,
          soldiers: 50,
          neighbours: ['2']
        })
      ]
    },
    players: [
      testPlayer({ id: 'p1', label: 'P1', color: 0xd9534f, homeProvinceId: '1' }),
      testPlayer({ id: 'p2', label: 'P2', color: 0x3f88c5, homeProvinceId: '2' })
    ],
    activePlayerId: 'p1',
    turnStep: 'attack',
    turnNumber: 1,
    winnerId: null,
    attackSpentProvinceIds: [],
    battle: null
  });
}

function c64BattleCommandState(): GameState {
  return testGameState({
    seed: 1,
    rngState: 1,
    phase: 'turn',
    map: {
      width: 4,
      height: 1,
      tiles: [],
      provinces: [
        testProvince({
          id: 'p1-home',
          terrainId: 'plains',
          ownerId: 'p1',
          villages: 2,
          soldiers: 10,
          neighbours: ['target']
        }),
        testProvince({
          id: 'target',
          terrainId: 'plains',
          ownerId: 'p1',
          villages: 2,
          soldiers: 10,
          neighbours: ['p1-home', 'p2-home', 'royal-retreat']
        }),
        testProvince({
          id: 'p2-home',
          terrainId: 'plains',
          ownerId: 'p2',
          villages: 2,
          soldiers: 10,
          neighbours: ['target']
        }),
        testProvince({
          id: 'royal-retreat',
          terrainId: 'plains',
          ownerId: ROYALIST_OWNER_ID,
          villages: 2,
          soldiers: 4,
          neighbours: ['target']
        })
      ]
    },
    players: [
      testPlayer({ id: 'p1', label: 'P1', color: 0xd9534f, homeProvinceId: 'p1-home' }),
      testPlayer({ id: 'p2', label: 'P2', color: 0x3f88c5, homeProvinceId: 'p2-home' })
    ],
    activePlayerId: 'p1',
    turnStep: 'attack',
    turnNumber: 1,
    winnerId: null,
    attackSpentProvinceIds: [],
    battle: null
  });
}

function c64BaronMovementState(): GameState {
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
          id: '1',
          terrainId: 'plains',
          ownerId: 'p1',
          villages: 2,
          soldiers: 5,
          neighbours: ['2']
        }),
        testProvince({
          id: '2',
          terrainId: 'plains',
          ownerId: 'p1',
          villages: 2,
          soldiers: 6,
          neighbours: ['1', '3']
        }),
        testProvince({
          id: '3',
          terrainId: 'plains',
          ownerId: 'p2',
          villages: 2,
          soldiers: 3,
          neighbours: ['2']
        })
      ]
    },
    players: [
      testPlayer({ id: 'p1', label: 'P1', color: 0xd9534f, homeProvinceId: '1' }),
      testPlayer({ id: 'p2', label: 'P2', color: 0x3f88c5, homeProvinceId: '3' })
    ],
    activePlayerId: 'p1',
    turnStep: 'movement',
    turnNumber: 1,
    winnerId: null,
    attackSpentProvinceIds: [],
    battle: null
  });
}

function c64BaronMovementFortCompensationState(): GameState {
  return testGameState({
    seed: 1,
    rngState: 1,
    phase: 'turn',
    map: {
      width: 4,
      height: 1,
      tiles: [],
      provinces: [
        testProvince({
          id: '1',
          terrainId: 'plains',
          ownerId: 'p2',
          villages: 2,
          soldiers: 30,
          neighbours: ['2']
        }),
        testProvince({
          id: '2',
          terrainId: 'plains',
          ownerId: 'p1',
          villages: 2,
          soldiers: 2,
          neighbours: ['1', '3']
        }),
        testProvince({
          id: '3',
          terrainId: 'plains',
          ownerId: 'p1',
          villages: 2,
          soldiers: 2,
          neighbours: ['2', '4']
        }),
        testProvince({
          id: '4',
          terrainId: 'plains',
          ownerId: 'p2',
          villages: 2,
          soldiers: 20,
          neighbours: ['3']
        })
      ]
    },
    players: [
      testPlayer({ id: 'p1', label: 'P1', color: 0xd9534f, homeProvinceId: '2', money: 20 }),
      testPlayer({ id: 'p2', label: 'P2', color: 0x3f88c5, homeProvinceId: '1' })
    ],
    activePlayerId: 'p1',
    turnStep: 'movement',
    turnNumber: 1,
    winnerId: null,
    attackSpentProvinceIds: [],
    battle: null
  });
}

function c64BaronMovementSingleHomeMoneyState(): GameState {
  return testGameState({
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
          ownerId: 'p1',
          villages: 2,
          soldiers: 2,
          neighbours: ['2']
        }),
        testProvince({
          id: '2',
          terrainId: 'plains',
          ownerId: 'p2',
          villages: 2,
          soldiers: 20,
          neighbours: ['1']
        })
      ]
    },
    players: [
      testPlayer({ id: 'p1', label: 'P1', color: 0xd9534f, homeProvinceId: '1', money: 5 }),
      testPlayer({ id: 'p2', label: 'P2', color: 0x3f88c5, homeProvinceId: '2' })
    ],
    activePlayerId: 'p1',
    turnStep: 'movement',
    turnNumber: 1,
    winnerId: null,
    attackSpentProvinceIds: [],
    battle: null
  });
}

function c64BaronMovementL5EA4State(): GameState {
  return testGameState({
    seed: 1,
    rngState: 1,
    phase: 'turn',
    map: {
      width: 5,
      height: 1,
      tiles: [],
      provinces: [
        testProvince({
          id: '1',
          terrainId: 'plains',
          ownerId: 'p2',
          villages: 2,
          soldiers: 1,
          neighbours: ['2']
        }),
        testProvince({
          id: '2',
          terrainId: 'plains',
          ownerId: 'p1',
          villages: 2,
          soldiers: 2,
          neighbours: ['1', '3']
        }),
        testProvince({
          id: '3',
          terrainId: 'plains',
          ownerId: 'p1',
          villages: 2,
          soldiers: 2,
          neighbours: ['2', '4']
        }),
        testProvince({
          id: '4',
          terrainId: 'plains',
          ownerId: 'p1',
          villages: 2,
          soldiers: 2,
          neighbours: ['3', '5']
        }),
        testProvince({
          id: '5',
          terrainId: 'plains',
          ownerId: 'p2',
          villages: 2,
          soldiers: 20,
          neighbours: ['4']
        })
      ]
    },
    players: [
      testPlayer({ id: 'p1', label: 'P1', color: 0xd9534f, homeProvinceId: '3', money: 0 }),
      testPlayer({ id: 'p2', label: 'P2', color: 0x3f88c5, homeProvinceId: '5' })
    ],
    activePlayerId: 'p1',
    turnStep: 'movement',
    turnNumber: 1,
    winnerId: null,
    attackSpentProvinceIds: [],
    battle: null
  });
}

describe('war for crown action API', () => {
  it('selects both home provinces through the player action API', () => {
    const afterP1 = applyPlayerAction(homeSelectionState(), 'p1', {
      type: 'select-home',
      provinceId: 'home'
    });
    const afterP2 = applyPlayerAction(afterP1.state, 'p2', {
      type: 'select-home',
      provinceId: 'enemy-home'
    });

    expect(afterP1.events).toEqual([
      { type: 'home-selected', playerId: 'p1', provinceId: 'home' }
    ]);
    expect(afterP2.events).toEqual([
      { type: 'home-selected', playerId: 'p2', provinceId: 'enemy-home' }
    ]);
    expect(afterP2.state.phase).toBe('turn');
    expect(afterP2.state.activePlayerId).toBe('p1');
    expect(afterP2.state.turnStep).toBe('new-month');
  });

  it('rejects an inactive player ending the current turn', () => {
    expect(() => applyPlayerAction(readyState(), 'p2', { type: 'end-turn' })).toThrow(
      'active player is p1'
    );
  });

  it('rejects attacks without source provinces through existing rule validation', () => {
    expect(() =>
      applyPlayerAction(attackStepState(), 'p1', {
        type: 'attack',
        fromProvinceIds: [],
        targetProvinceId: 'target'
      })
    ).toThrow('Attack must include at least one source province.');
  });

  it('starts a battle for accepted attacks', () => {
    const result = applyPlayerAction(attackStepState(), 'p1', {
      type: 'attack',
      fromProvinceIds: ['home'],
      targetProvinceId: 'target'
    });
    const home = result.state.map.provinces.find((province) => province.id === 'home');

    expect(result.events).toHaveLength(1);
    expect(result.events[0]).toMatchObject({
      type: 'battle-started',
      attackerId: 'p1',
      defenderId: ROYALIST_OWNER_ID,
      fromProvinceIds: ['home'],
      targetProvinceId: 'target',
      attackingSoldiers: 19,
      defendingSoldiers: 8
    });
    expect(result.state.battle).toMatchObject({
      attackerId: 'p1',
      defenderId: ROYALIST_OWNER_ID,
      fromProvinceIds: ['home'],
      targetProvinceId: 'target',
      attackerSoldiers: 19,
      defenderSoldiers: 8,
      round: 0
    });
    expect(home?.soldiers).toBe(1);
  });

  it('runs the C64 baron attack entrypoint from full state', () => {
    const result = applyPlayerAction(c64BaronAttackState(), 'p1', {
      type: 'run-c64-baron-attack'
    });
    const sourceOne = result.state.map.provinces.find((province) => province.id === '1');
    const sourceThree = result.state.map.provinces.find((province) => province.id === '3');

    expect(result.events).toEqual([
      {
        type: 'battle-started',
        attackerId: 'p1',
        defenderId: 'p2',
        fromProvinceIds: ['3', '1'],
        targetProvinceId: '2',
        attackingSoldiers: 98,
        defendingSoldiers: 1
      }
    ]);
    expect(result.state.battle).toMatchObject({
      attackerId: 'p1',
      defenderId: 'p2',
      fromProvinceIds: ['3', '1'],
      targetProvinceId: '2',
      attackerSoldiers: 98,
      defenderSoldiers: 1
    });
    expect(result.state.attackSpentProvinceIds).toEqual(['3', '1']);
    expect(sourceOne?.soldiers).toBe(1);
    expect(sourceThree?.soldiers).toBe(1);
    expect(result.state.rngState).not.toBe(0x8c);
  });

  it('consumes C64 remembered attack target memory before target scanning', () => {
    const state = c64BaronAttackState();
    const rememberedState: GameState = {
      ...state,
      map: {
        ...state.map,
        provinces: state.map.provinces.map((province) =>
          province.id === '2'
            ? {
                ...province,
                soldiers: 12
              }
            : province
        )
      },
      c64: {
        ...state.c64,
        playerMemory: state.c64.playerMemory.map((memory) =>
          memory.playerId === 'p1'
            ? {
                ...memory,
                rememberedTargetProvinceId: '2',
                rememberedTargetSoldiers: 4
              }
            : memory
        )
      }
    };
    const result = applyPlayerAction(rememberedState, 'p1', {
      type: 'run-c64-baron-attack'
    });
    const memory = result.state.c64.playerMemory.find((candidate) => candidate.playerId === 'p1');

    expect(result.state.c64.ca61Bytes.slice(0, 2)).toEqual([1, 0]);
    expect(memory).toMatchObject({
      rememberedTargetProvinceId: null,
      rememberedTargetSoldiers: 4
    });
  });

  it('resolves an attacker retreat after one final battle round', () => {
    const started = applyPlayerAction(attackStepState(), 'p1', {
      type: 'attack',
      fromProvinceIds: ['home'],
      targetProvinceId: 'target'
    });
    const result = applyPlayerAction(started.state, 'p1', { type: 'battle-retreat-attacker' });
    const home = result.state.map.provinces.find((province) => province.id === 'home');
    const target = result.state.map.provinces.find((province) => province.id === 'target');

    expect(result.events.map((event) => event.type)).toEqual([
      'battle-round-resolved',
      'battle-resolved'
    ]);
    expect(result.events[1]).toMatchObject({
      type: 'battle-resolved',
      result: {
        winner: 'defender',
        resolution: 'attacker-retreat'
      }
    });
    expect(result.state.battle).toBeNull();
    expect(home?.soldiers).toBe(19);
    expect(target?.ownerId).toBe(ROYALIST_OWNER_ID);
    expect(target?.soldiers).toBe(3);
  });

  it('requires defender retreat to be issued by the defender side', () => {
    const state: GameState = testGameState({
      ...attackStepState(),
      map: {
        ...attackStepState().map,
        provinces: attackStepState().map.provinces.map((province) =>
          province.id === 'target'
            ? { ...province, ownerId: 'p2' as const, soldiers: 30 }
            : province.id === 'enemy-home'
              ? { ...province, ownerId: 'p2' as const, soldiers: 20 }
              : province
          )
      }
    });
    const started = applyPlayerAction(state, 'p1', {
      type: 'attack',
      fromProvinceIds: ['home'],
      targetProvinceId: 'target'
    });

    expect(() =>
      applyPlayerAction(started.state, 'p1', { type: 'battle-retreat-defender' })
    ).toThrow('Defender retreat must be issued by defender p2.');

    const result = applyPlayerAction(started.state, 'p2', { type: 'battle-retreat-defender' });

    expect(result.events.map((event) => event.type)).toEqual([
      'battle-round-resolved',
      'battle-resolved'
    ]);
    expect(result.events[1]).toMatchObject({
      type: 'battle-resolved',
      result: {
        winner: 'attacker',
        resolution: 'defender-retreat'
      }
    });
  });

  it('runs the C64 battle command as attacker retreat for a weak AI attacker', () => {
    const config = {
      ...DEFAULT_GAME_CONFIG,
      humanPlayerCount: 1,
      aiPlayerCount: 1
    };
    const attackState = {
      ...c64BattleCommandState(),
      activePlayerId: 'p2' as const
    };
    const started = applyPlayerAction(attackState, 'p2', {
      type: 'attack',
      fromProvinceIds: ['p2-home'],
      targetProvinceId: 'target'
    }, config);
    const result = applyPlayerAction(started.state, 'p2', {
      type: 'run-c64-battle-command'
    }, config);

    expect(result.events.map((event) => event.type)).toEqual([
      'battle-round-resolved',
      'battle-resolved'
    ]);
    expect(result.events[1]).toMatchObject({
      type: 'battle-resolved',
      result: {
        winner: 'defender',
        resolution: 'attacker-retreat'
      }
    });
  });

  it('runs the C64 battle command as royalist defender retreat', () => {
    const state = {
      ...c64BattleCommandState(),
      map: {
        ...c64BattleCommandState().map,
        provinces: c64BattleCommandState().map.provinces.map((province) =>
          province.id === 'target'
            ? { ...province, ownerId: ROYALIST_OWNER_ID, soldiers: 10 }
            : province.id === 'p1-home'
              ? { ...province, soldiers: 15 }
              : province
        )
      }
    };
    const started = applyPlayerAction(state, 'p1', {
      type: 'attack',
      fromProvinceIds: ['p1-home'],
      targetProvinceId: 'target'
    });
    const result = applyPlayerAction(started.state, 'p1', {
      type: 'run-c64-battle-command'
    });

    expect(result.events.map((event) => event.type)).toEqual([
      'battle-round-resolved',
      'battle-resolved'
    ]);
    expect(result.events[1]).toMatchObject({
      type: 'battle-resolved',
      defenderId: ROYALIST_OWNER_ID,
      result: {
        winner: 'attacker',
        resolution: 'defender-retreat'
      }
    });
  });

  it('runs the C64 baron movement entrypoint from full state', () => {
    const result = applyPlayerAction(c64BaronMovementState(), 'p1', {
      type: 'run-c64-baron-movement'
    });
    const soldiersByProvince = Object.fromEntries(
      result.state.map.provinces.map((province) => [province.id, province.soldiers])
    );
    const memory = result.state.c64.playerMemory.find((candidate) => candidate.playerId === 'p1');

    expect(result.events).toEqual([
      {
        type: 'c64-baron-movement-resolved',
        playerId: 'p1',
        pulledMobileSoldiers: 9,
        defensiveRequirement: 2,
        rememberedTargetProvinceId: '3'
      },
      {
        type: 'turn-step-advanced',
        playerId: 'p1',
        from: 'movement',
        to: 'investment'
      }
    ]);
    expect(result.state.turnStep).toBe('investment');
    expect(soldiersByProvince).toEqual({
      '1': 1,
      '2': 10,
      '3': 3
    });
    expect(memory).toMatchObject({
      rememberedTargetProvinceId: '3',
      rememberedTargetSoldiers: 3
    });
  });

  it('rolls back multifront fort compensation before L5FD2 home money conversion', () => {
    const result = applyPlayerAction(c64BaronMovementFortCompensationState(), 'p1', {
      type: 'run-c64-baron-movement'
    });
    const player = result.state.players.find((candidate) => candidate.id === 'p1');
    const province = result.state.map.provinces.find((candidate) => candidate.id === '2');

    expect(result.events).toEqual([
      {
        type: 'c64-baron-movement-resolved',
        playerId: 'p1',
        pulledMobileSoldiers: 2,
        defensiveRequirement: 54,
        rememberedTargetProvinceId: null
      },
      {
        type: 'turn-step-advanced',
        playerId: 'p1',
        from: 'movement',
        to: 'investment'
      }
    ]);
    expect(player?.money).toBe(0);
    expect(province).toMatchObject({
      fortificationLevel: 'none',
      upgradedFortificationThisTurn: false,
      soldiers: 23
    });
  });

  it('converts C64 baron movement home money through L5FD2', () => {
    const result = applyPlayerAction(c64BaronMovementSingleHomeMoneyState(), 'p1', {
      type: 'run-c64-baron-movement'
    });
    const player = result.state.players.find((candidate) => candidate.id === 'p1');
    const province = result.state.map.provinces.find((candidate) => candidate.id === '1');

    expect(result.events).toEqual([
      {
        type: 'c64-baron-movement-resolved',
        playerId: 'p1',
        pulledMobileSoldiers: 1,
        defensiveRequirement: 21,
        rememberedTargetProvinceId: null
      },
      {
        type: 'turn-step-advanced',
        playerId: 'p1',
        from: 'movement',
        to: 'investment'
      }
    ]);
    expect(player?.money).toBe(0);
    expect(province?.soldiers).toBe(7);
  });

  it('writes C64 baron movement remembered target through L5EA4', () => {
    const result = applyPlayerAction(c64BaronMovementL5EA4State(), 'p1', {
      type: 'run-c64-baron-movement'
    });
    const soldiersByProvince = Object.fromEntries(
      result.state.map.provinces.map((province) => [province.id, province.soldiers])
    );
    const memory = result.state.c64.playerMemory.find((candidate) => candidate.playerId === 'p1');

    expect(result.events).toEqual([
      {
        type: 'c64-baron-movement-resolved',
        playerId: 'p1',
        pulledMobileSoldiers: 3,
        defensiveRequirement: 21,
        rememberedTargetProvinceId: '1'
      },
      {
        type: 'turn-step-advanced',
        playerId: 'p1',
        from: 'movement',
        to: 'investment'
      }
    ]);
    expect(result.state.turnStep).toBe('investment');
    expect(soldiersByProvince).toEqual({
      '1': 1,
      '2': 4,
      '3': 1,
      '4': 1,
      '5': 20
    });
    expect(memory).toMatchObject({
      rememberedTargetProvinceId: '1',
      rememberedTargetSoldiers: 1
    });
  });

  it('advances from new month into attack and emits income once', () => {
    const result = applyPlayerAction(readyState(), 'p1', { type: 'advance-step' });
    const player = result.state.players.find((candidate) => candidate.id === 'p1');

    expect(result.events).toEqual([
      { type: 'turn-step-advanced', playerId: 'p1', from: 'new-month', to: 'attack' },
      { type: 'player-title-changed', playerId: 'p1', previousRank: 0, rank: 1 },
      { type: 'income-collected', playerId: 'p1', money: 3 }
    ]);
    expect(result.state.turnStep).toBe('attack');
    expect(player?.money).toBe(23);
  });

  it('ends turns through the player action API without collecting income', () => {
    const result = applyPlayerAction(readyState(), 'p1', { type: 'end-turn' });
    const player = result.state.players.find((candidate) => candidate.id === 'p1');

    expect(result.events).toEqual([
      { type: 'turn-ended', endedPlayerId: 'p1', nextPlayerId: 'p2', turnNumber: 1 }
    ]);
    expect(result.state.activePlayerId).toBe('p2');
    expect(result.state.turnStep).toBe('new-month');
    expect(player?.money).toBe(20);
  });

  it('emits game-won when an attack claims the final province', () => {
    const started = applyPlayerAction(winningState(), 'p1', {
      type: 'attack',
      fromProvinceIds: ['home'],
      targetProvinceId: 'target'
    });
    const state = finishBattle(started.state);

    expect(state.phase).toBe('game-over');
    expect(state.winnerId).toBe('p1');
  });
});
