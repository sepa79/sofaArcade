import { describe, expect, it } from 'vitest';

import { ROYALIST_OWNER_ID } from './owners';

import { applyPlayerAction } from './actions';
import {
  chooseAiAction,
  chooseC64OriginalAiAction,
  chooseC64WorkbenchAiAction,
  chooseDeterministicAiAction,
  createAiClient
} from './ai';
import { createPlayerView } from './player-view';
import { createInitialState } from './state';
import { testGameState, testPlayer, testProvince } from './test-fixtures';
import type { GameState } from './types';

function movementState(): GameState {
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
          id: 'home',
          terrainId: 'plains',
          ownerId: 'p1',
          villages: 2,
          soldiers: 30,
          neighbours: ['road']
        }),
        testProvince({
          id: 'road',
          terrainId: 'plains',
          ownerId: 'p1',
          villages: 1,
          soldiers: 1,
          neighbours: ['home', 'front']
        }),
        testProvince({
          id: 'front',
          terrainId: 'forest',
          ownerId: 'p1',
          villages: 1,
          soldiers: 1,
          neighbours: ['road', 'neutral']
        }),
        testProvince({
          id: 'neutral',
          terrainId: 'hills',
          ownerId: ROYALIST_OWNER_ID,
          villages: 1,
          soldiers: 5,
          neighbours: ['front']
        })
      ]
    },
    players: [
      testPlayer({ id: 'p1', label: 'P1', color: 0xd9534f, homeProvinceId: 'home' }),
      testPlayer({ id: 'p2', label: 'P2', color: 0x3f88c5, homeProvinceId: null })
    ],
    activePlayerId: 'p1',
    turnStep: 'movement',
    turnNumber: 1,
    winnerId: null,
    attackSpentProvinceIds: [],
    battle: null
  });
}

function multiSourceAttackState(): GameState {
  return testGameState({
    seed: 1,
    rngState: 1,
    phase: 'turn',
    map: {
      width: 3,
      height: 2,
      tiles: [],
      provinces: [
        testProvince({
          id: 'left',
          terrainId: 'plains',
          ownerId: 'p1',
          villages: 1,
          soldiers: 6,
          neighbours: ['right', 'target']
        }),
        testProvince({
          id: 'right',
          terrainId: 'plains',
          ownerId: 'p1',
          villages: 1,
          soldiers: 6,
          neighbours: ['left', 'target']
        }),
        testProvince({
          id: 'target',
          terrainId: 'plains',
          ownerId: ROYALIST_OWNER_ID,
          villages: 1,
          soldiers: 8,
          neighbours: ['left', 'right']
        })
      ]
    },
    players: [
      testPlayer({ id: 'p1', label: 'P1', color: 0xd9534f, homeProvinceId: 'left' }),
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

function disconnectedSourceAttackState(): GameState {
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
          id: 'left',
          terrainId: 'plains',
          ownerId: 'p1',
          villages: 1,
          soldiers: 6,
          neighbours: ['target']
        }),
        testProvince({
          id: 'right',
          terrainId: 'plains',
          ownerId: 'p1',
          villages: 1,
          soldiers: 6,
          neighbours: ['target']
        }),
        testProvince({
          id: 'target',
          terrainId: 'plains',
          ownerId: ROYALIST_OWNER_ID,
          villages: 1,
          soldiers: 8,
          neighbours: ['left', 'right']
        })
      ]
    },
    players: [
      testPlayer({ id: 'p1', label: 'P1', color: 0xd9534f, homeProvinceId: 'left' }),
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

function competingFrontierAttackState(): GameState {
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
          id: 'source-a',
          terrainId: 'plains',
          ownerId: 'p1',
          villages: 1,
          soldiers: 50,
          neighbours: ['home-target']
        }),
        testProvince({
          id: 'home-target',
          terrainId: 'plains',
          ownerId: 'p2',
          villages: 1,
          soldiers: 1,
          neighbours: ['source-a', 'source-b']
        }),
        testProvince({
          id: 'source-b',
          terrainId: 'plains',
          ownerId: 'p1',
          villages: 1,
          soldiers: 50,
          neighbours: ['home-target', 'front-target']
        }),
        testProvince({
          id: 'front-target',
          terrainId: 'plains',
          ownerId: 'p2',
          villages: 1,
          soldiers: 1,
          neighbours: ['source-b']
        })
      ]
    },
    players: [
      testPlayer({ id: 'p1', label: 'P1', color: 0xd9534f, homeProvinceId: 'source-a' }),
      testPlayer({ id: 'p2', label: 'P2', color: 0x3f88c5, homeProvinceId: 'home-target' })
    ],
    activePlayerId: 'p1',
    turnStep: 'attack',
    turnNumber: 1,
    winnerId: null,
    attackSpentProvinceIds: [],
    battle: null
  });
}

function threatenedInvestmentState(): GameState {
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
          id: 'home',
          terrainId: 'plains',
          ownerId: 'p1',
          villages: 2,
          soldiers: 3,
          neighbours: ['target']
        }),
        testProvince({
          id: 'target',
          terrainId: 'plains',
          ownerId: ROYALIST_OWNER_ID,
          villages: 1,
          soldiers: 8,
          neighbours: ['home']
        })
      ]
    },
    players: [
      testPlayer({ id: 'p1', label: 'P1', color: 0xd9534f, homeProvinceId: 'home', money: 20 }),
      testPlayer({ id: 'p2', label: 'P2', color: 0x3f88c5, homeProvinceId: null })
    ],
    activePlayerId: 'p1',
    turnStep: 'investment',
    turnNumber: 1,
    winnerId: null,
    attackSpentProvinceIds: [],
    battle: null
  });
}

function lostHomeInvestmentState(): GameState {
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
          id: 'home',
          terrainId: 'plains',
          ownerId: 'p2',
          villages: 2,
          soldiers: 3,
          neighbours: ['field']
        }),
        testProvince({
          id: 'field',
          terrainId: 'plains',
          ownerId: 'p1',
          villages: 12,
          soldiers: 2,
          neighbours: ['home']
        })
      ]
    },
    players: [
      testPlayer({ id: 'p1', label: 'P1', color: 0xd9534f, homeProvinceId: 'home', money: 20 }),
      testPlayer({ id: 'p2', label: 'P2', color: 0x3f88c5, homeProvinceId: null })
    ],
    activePlayerId: 'p1',
    turnStep: 'investment',
    turnNumber: 1,
    winnerId: null,
    attackSpentProvinceIds: [],
    battle: null
  });
}

describe('deterministic AI client', () => {
  it('plays accepted actions using only player views and the action API', () => {
    let state = createInitialState(11);
    const eventTypes: string[] = [];

    for (let step = 0; step < 80 && state.phase !== 'game-over'; step += 1) {
      const view = createPlayerView(state, state.activePlayerId);
      const action = chooseDeterministicAiAction(view);
      const result = applyPlayerAction(state, state.activePlayerId, action);
      state = result.state;
      eventTypes.push(...result.events.map((event) => event.type));
    }

    expect(eventTypes).toContain('home-selected');
    expect(eventTypes).toContain('turn-step-advanced');
    expect(eventTypes).toContain('income-collected');
    expect(eventTypes).toContain('turn-ended');
    expect(
      eventTypes.some((eventType) =>
        ['battle-resolved', 'soldiers-recruited', 'village-built'].includes(eventType)
      )
    ).toBe(true);
    expect(state.phase).not.toBe('home-selection');
  });

  it('rejects choosing for an inactive player view', () => {
    const state = createInitialState(3);
    const view = createPlayerView(state, 'p2');

    expect(() => chooseDeterministicAiAction(view)).toThrow(
      'Cannot choose an AI action for inactive player p2.'
    );
  });

  it('moves mobile soldiers toward the nearest frontier during movement', () => {
    const state = movementState();
    const view = createPlayerView(state, 'p1');
    const action = chooseDeterministicAiAction(view);

    expect(action).toEqual({
      type: 'move-soldiers',
      fromProvinceId: 'home',
      targetProvinceId: 'road',
      targetSoldiers: 15
    });

    const result = applyPlayerAction(state, 'p1', action);
    expect(result.events).toEqual([
      {
        type: 'soldiers-moved',
        playerId: 'p1',
        fromProvinceId: 'home',
        targetProvinceId: 'road',
        soldiers: 14
      }
    ]);
  });
});

describe('War for Crown AI strategies', () => {
  it('uses c64-original as the default AI mode', () => {
    const state = multiSourceAttackState();
    const view = createPlayerView(state, 'p1');

    expect(chooseAiAction(view)).toEqual(chooseC64OriginalAiAction(view));
  });

  it('creates pluggable AI clients for headless runners', () => {
    const state = movementState();
    const view = createPlayerView(state, 'p1');
    const client = createAiClient('deterministic-debug');

    expect(client(view)).toEqual(chooseDeterministicAiAction(view));
  });

  it('creates a c64-original AI client', () => {
    const state = movementState();
    const view = createPlayerView(state, 'p1');
    const client = createAiClient('c64-original');

    expect(client(view)).toEqual(chooseC64OriginalAiAction(view));
  });

  it('selects multiple C64 attack sources when one province cannot win alone', () => {
    const state = multiSourceAttackState();
    const view = createPlayerView(state, 'p1');
    const action = chooseC64WorkbenchAiAction(view);

    expect(action).toEqual({
      type: 'attack',
      fromProvinceIds: ['left', 'right'],
      targetProvinceId: 'target'
    });
  });

  it('does not select one-soldier provinces as attack sources', () => {
    const state = testGameState({
      ...multiSourceAttackState(),
      map: {
        ...multiSourceAttackState().map,
        provinces: multiSourceAttackState().map.provinces.map((province) =>
          province.id === 'left'
            ? { ...province, soldiers: 1 }
            : province.id === 'right'
              ? { ...province, soldiers: 12 }
            : province
        )
      }
    });
    const view = createPlayerView(state, 'p1');

    expect(chooseC64WorkbenchAiAction(view)).toEqual({
      type: 'attack',
      fromProvinceIds: ['right'],
      targetProvinceId: 'target'
    });
    expect(chooseC64OriginalAiAction(view)).toEqual({
      type: 'run-c64-baron-attack'
    });
  });

  it('selects connected c64-original attack sources through the C64 worklist', () => {
    const state = multiSourceAttackState();
    const view = createPlayerView(state, 'p1');

    expect(chooseC64OriginalAiAction(view)).toEqual({
      type: 'run-c64-baron-attack'
    });
  });

  it('combines disconnected c64-original sources when they both border the selected target', () => {
    const state = disconnectedSourceAttackState();
    const view = createPlayerView(state, 'p1');

    expect(chooseC64WorkbenchAiAction(view)).toEqual({
      type: 'attack',
      fromProvinceIds: ['left', 'right'],
      targetProvinceId: 'target'
    });
    expect(chooseC64OriginalAiAction(view)).toEqual({
      type: 'run-c64-baron-attack'
    });
  });

  it('keeps a competing-frontier source out of the selected c64-original attack', () => {
    const state = competingFrontierAttackState();
    const view = createPlayerView(state, 'p1');

    expect(chooseC64OriginalAiAction(view)).toEqual({
      type: 'run-c64-baron-attack'
    });
  });

  it('moves c64-original mobile soldiers toward the C64 frontier target', () => {
    const state = movementState();
    const view = createPlayerView(state, 'p1');

    expect(chooseC64OriginalAiAction(view)).toEqual({
      type: 'run-c64-baron-movement'
    });
  });

  it('recruits into the home province when frontier pressure is higher than mobile army', () => {
    const state = threatenedInvestmentState();
    const view = createPlayerView(state, 'p1');
    const action = chooseC64WorkbenchAiAction(view);

    expect(action).toEqual({
      type: 'recruit-soldiers',
      soldiers: 8
    });

    const result = applyPlayerAction(state, 'p1', action);
    const home = result.state.map.provinces.find((province) => province.id === 'home');
    expect(home?.soldiers).toBe(11);
  });

  it('moves all mobile soldiers one owned edge toward the C64 frontier target', () => {
    const state = movementState();
    const view = createPlayerView(state, 'p1');
    const action = chooseC64WorkbenchAiAction(view);

    expect(action).toEqual({
      type: 'move-soldiers',
      fromProvinceId: 'home',
      targetProvinceId: 'road',
      targetSoldiers: 30
    });
  });

  it('does not recruit when the home province has been lost', () => {
    const state = lostHomeInvestmentState();
    const view = createPlayerView(state, 'p1');

    expect(chooseC64WorkbenchAiAction(view).type).toBe('upgrade-fortification');
  });
});
