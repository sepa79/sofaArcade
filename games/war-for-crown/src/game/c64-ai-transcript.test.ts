import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { applyPlayerAction } from './actions';
import { runC64CbaronEconomy } from './c64-cbaron-economy';
import { DEFAULT_GAME_CONFIG } from './constants';
import { ROYALIST_OWNER_ID } from './owners';
import { testGameState, testPlayer, testProvince } from './test-fixtures';
import type { OwnerId } from './owners';
import type { GameState, ProvinceId } from './types';

interface C64AiTranscriptPhaseFixture {
  readonly entry: 'cbaron:$5803' | 'cbaron:$5806' | 'cbaron:$5800';
  readonly observed: {
    readonly selectedTarget?: number;
    readonly battleStarted?: boolean;
    readonly pulledMobileSoldiers?: number;
    readonly defensiveRequirement?: number;
    readonly soldiersByProvince: Readonly<Record<string, number>>;
    readonly villagesByProvince?: Readonly<Record<string, number>>;
    readonly moneyByPlayer?: Readonly<Record<string, number>>;
    readonly rememberedTarget: number;
  };
}

interface C64AiTranscriptFixture {
  readonly fixture: 'cbaron-ai-turn-no-attack-transcript';
  readonly initialState: {
    readonly ownersByProvince: Readonly<Record<string, number>>;
    readonly villagesByProvince: Readonly<Record<string, number>>;
    readonly soldiersByProvince: Readonly<Record<string, number>>;
    readonly moneyByPlayer: Readonly<Record<string, number>>;
  };
  readonly phases: ReadonlyArray<C64AiTranscriptPhaseFixture>;
}

interface C64AiTurnBattleTranscriptFixture {
  readonly fixture:
    | 'cbaron-ai-turn-attacker-retreat-transcript'
    | 'cbaron-ai-turn-branching-underpowered-transcript'
    | 'cbaron-ai-turn-capture-transcript'
    | 'cbaron-ai-turn-defender-retreat-transcript'
    | 'cbaron-ai-turn-l5ea4-transcript';
  readonly initialState: {
    readonly ownersByProvince: Readonly<Record<string, number>>;
    readonly villagesByProvince: Readonly<Record<string, number>>;
    readonly soldiersByProvince: Readonly<Record<string, number>>;
    readonly moneyByPlayer: Readonly<Record<string, number>>;
    readonly homeProvinceByPlayer: Readonly<Record<string, number>>;
    readonly neighboursByProvince?: Readonly<Record<string, ReadonlyArray<number>>>;
  };
  readonly phases: ReadonlyArray<{
    readonly entry: 'cbaron:$5803' | 'cbaron:$5806' | 'cbaron:$5800';
    readonly observed: {
      readonly selectedTarget?: number;
      readonly sourceProvinces?: ReadonlyArray<number>;
      readonly attackerSoldiersAtBattleStart?: number;
      readonly defenderSoldiersAtBattleStart?: number;
      readonly battleResolution?: 'attacker-retreat' | 'capture' | 'defender-retreat';
      readonly rounds?: number;
      readonly roundLosses?: {
        readonly attacker: number;
        readonly defender: number;
      };
      readonly survivors?: {
        readonly attacker: number;
        readonly defender: number;
      };
      readonly pulledMobileSoldiers?: number;
      readonly defensiveRequirement?: number;
      readonly ownersByProvince: Readonly<Record<string, number>>;
      readonly soldiersByProvince: Readonly<Record<string, number>>;
      readonly villagesByProvince?: Readonly<Record<string, number>>;
      readonly moneyByPlayer: Readonly<Record<string, number>>;
      readonly rememberedTarget: number;
      readonly rememberedTargetSoldiers?: number;
    };
  }>;
}

interface C64CbaronBattleFixture {
  readonly fixture:
    | 'cbaron-5803-battle-capture-line'
    | 'cbaron-5803-defender-retreat-line'
    | 'cbaron-5803-attacker-retreat-line';
  readonly initialState: {
    readonly ownersByProvince: Readonly<Record<string, number>>;
    readonly soldiersByProvince: Readonly<Record<string, number>>;
    readonly homeProvinceByPlayer: Readonly<Record<string, number>>;
  };
  readonly observed: {
    readonly selectedTarget: number;
    readonly sourceProvinces: ReadonlyArray<number>;
    readonly attackerSoldiersAtBattleStart: number;
    readonly defenderSoldiersAtBattleStart: number;
    readonly battleResolution?: 'elimination' | 'defender-retreat' | 'attacker-retreat';
    readonly rounds?: number;
    readonly roundLosses?: {
      readonly attacker: number;
      readonly defender: number;
    };
    readonly survivors?: {
      readonly attacker: number;
      readonly defender: number;
    };
    readonly ownersByProvince: Readonly<Record<string, number>>;
    readonly soldiersByProvince: Readonly<Record<string, number>>;
    readonly provinceCountsByOwner: Readonly<Record<string, number>>;
    readonly homeProvinceByPlayer: Readonly<Record<string, number>>;
  };
}

type C64CbaronDefenderRetreatFixture = C64CbaronBattleFixture & {
  readonly fixture: 'cbaron-5803-defender-retreat-line';
  readonly observed: C64CbaronBattleFixture['observed'] & {
    readonly battleResolution: 'defender-retreat';
    readonly roundLosses: {
      readonly attacker: number;
      readonly defender: number;
    };
    readonly survivors: {
      readonly attacker: number;
      readonly defender: number;
    };
  };
};

type C64CbaronAttackerRetreatFixture = C64CbaronBattleFixture & {
  readonly fixture: 'cbaron-5803-attacker-retreat-line';
  readonly observed: C64CbaronBattleFixture['observed'] & {
    readonly battleResolution: 'attacker-retreat';
    readonly rounds: number;
    readonly roundLosses: {
      readonly attacker: number;
      readonly defender: number;
    };
    readonly survivors: {
      readonly attacker: number;
      readonly defender: number;
    };
  };
};

const ownerSlots = [
  { ownerId: ROYALIST_OWNER_ID, isComputer: false },
  { ownerId: 'p1', isComputer: true },
  { ownerId: 'p2', isComputer: true }
] as const;

function loadFixture(): C64AiTranscriptFixture {
  return JSON.parse(
    readFileSync(
      new URL('../../../../docs/war-for-crown/fixtures/cbaron-ai-turn-no-attack-transcript.json', import.meta.url),
      'utf8'
    )
  ) as C64AiTranscriptFixture;
}

function loadTurnBattleFixture(
  fileName: string = 'cbaron-ai-turn-attacker-retreat-transcript.json'
): C64AiTurnBattleTranscriptFixture {
  return JSON.parse(
    readFileSync(
      new URL(`../../../../docs/war-for-crown/fixtures/${fileName}`, import.meta.url),
      'utf8'
    )
  ) as C64AiTurnBattleTranscriptFixture;
}

function loadBattleFixture(fileName: string): C64CbaronBattleFixture {
  return JSON.parse(
    readFileSync(
      new URL(`../../../../docs/war-for-crown/fixtures/${fileName}`, import.meta.url),
      'utf8'
    )
  ) as C64CbaronBattleFixture;
}

function provinceOwner(owner: number): typeof ROYALIST_OWNER_ID | 'p1' | 'p2' {
  if (owner === 0) {
    return ROYALIST_OWNER_ID;
  }
  if (owner === 1) {
    return 'p1';
  }
  if (owner === 2) {
    return 'p2';
  }
  throw new Error(`Unsupported C64 owner id ${owner}.`);
}

function requiredFixtureNumber(
  values: Readonly<Record<string, number>>,
  key: string,
  label: string
): number {
  const value = values[key];
  if (value === undefined) {
    throw new Error(`Missing ${label} fixture value for ${key}.`);
  }
  return value;
}

function requiredPhase(
  fixture: C64AiTranscriptFixture,
  entry: C64AiTranscriptPhaseFixture['entry']
): C64AiTranscriptPhaseFixture {
  const phase = fixture.phases.find((candidate) => candidate.entry === entry);
  if (phase === undefined) {
    throw new Error(`Missing C64 transcript phase ${entry}.`);
  }
  return phase;
}

function requiredTurnBattlePhase(
  fixture: C64AiTurnBattleTranscriptFixture,
  entry: 'cbaron:$5803' | 'cbaron:$5806' | 'cbaron:$5800'
): C64AiTurnBattleTranscriptFixture['phases'][number] {
  const phase = fixture.phases.find((candidate) => candidate.entry === entry);
  if (phase === undefined) {
    throw new Error(`Missing C64 turn battle transcript phase ${entry}.`);
  }
  return phase;
}

function ownerNumber(ownerId: OwnerId): number {
  if (ownerId === ROYALIST_OWNER_ID) {
    return 0;
  }
  if (ownerId === 'p1') {
    return 1;
  }
  if (ownerId === 'p2') {
    return 2;
  }
  throw new Error(`Unsupported owner id ${ownerId}.`);
}

function transcriptState(fixture: C64AiTranscriptFixture): GameState {
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
          ownerId: provinceOwner(requiredFixtureNumber(fixture.initialState.ownersByProvince, '1', 'owner')),
          villages: requiredFixtureNumber(fixture.initialState.villagesByProvince, '1', 'villages'),
          soldiers: requiredFixtureNumber(fixture.initialState.soldiersByProvince, '1', 'soldiers'),
          neighbours: ['2']
        }),
        testProvince({
          id: '2',
          terrainId: 'plains',
          ownerId: provinceOwner(requiredFixtureNumber(fixture.initialState.ownersByProvince, '2', 'owner')),
          villages: requiredFixtureNumber(fixture.initialState.villagesByProvince, '2', 'villages'),
          soldiers: requiredFixtureNumber(fixture.initialState.soldiersByProvince, '2', 'soldiers'),
          neighbours: ['1', '3']
        }),
        testProvince({
          id: '3',
          terrainId: 'plains',
          ownerId: provinceOwner(requiredFixtureNumber(fixture.initialState.ownersByProvince, '3', 'owner')),
          villages: requiredFixtureNumber(fixture.initialState.villagesByProvince, '3', 'villages'),
          soldiers: requiredFixtureNumber(fixture.initialState.soldiersByProvince, '3', 'soldiers'),
          neighbours: ['2']
        })
      ]
    },
    players: [
      testPlayer({
        id: 'p1',
        label: 'P1',
        color: 0xd9534f,
        money: requiredFixtureNumber(fixture.initialState.moneyByPlayer, '1', 'money'),
        homeProvinceId: '1'
      }),
      testPlayer({
        id: 'p2',
        label: 'P2',
        color: 0x3f88c5,
        homeProvinceId: null
      })
    ],
    activePlayerId: 'p1',
    turnStep: 'attack',
    turnNumber: 1,
    winnerId: null,
    attackSpentProvinceIds: [],
    battle: null
  });
}

function turnBattleTranscriptState(fixture: C64AiTurnBattleTranscriptFixture): GameState {
  const provinceIds = Object.keys(fixture.initialState.ownersByProvince).sort(
    (left, right) => Number.parseInt(left, 10) - Number.parseInt(right, 10)
  );
  const neighboursForProvince = (provinceId: string, index: number): ReadonlyArray<string> => {
    if (fixture.initialState.neighboursByProvince !== undefined) {
      const neighbours = fixture.initialState.neighboursByProvince[provinceId];
      if (neighbours === undefined) {
        throw new Error(`Missing transcript neighbours for province ${provinceId}.`);
      }

      return neighbours.map(String);
    }

    if (fixture.fixture === 'cbaron-ai-turn-capture-transcript') {
      if (provinceId === '1') {
        return ['2'];
      }
      if (provinceId === '2') {
        return ['1', '3'];
      }
      if (provinceId === '3') {
        return ['2'];
      }
      if (provinceId === '4') {
        return [];
      }
      throw new Error(`Unsupported capture transcript province ${provinceId}.`);
    }

    return [
      provinceIds[index - 1],
      provinceIds[index + 1]
    ].filter((candidate): candidate is string => candidate !== undefined);
  };

  return testGameState({
    seed: 1,
    rngState: 0x8c,
    phase: 'turn',
    map: {
      width: provinceIds.length,
      height: 1,
      tiles: [],
      provinces: provinceIds.map((provinceId, index) => {
        return testProvince({
          id: provinceId,
          terrainId: 'plains',
          ownerId: provinceOwner(requiredFixtureNumber(fixture.initialState.ownersByProvince, provinceId, 'owner')),
          villages: requiredFixtureNumber(fixture.initialState.villagesByProvince, provinceId, 'villages'),
          soldiers: requiredFixtureNumber(fixture.initialState.soldiersByProvince, provinceId, 'soldiers'),
          neighbours: neighboursForProvince(provinceId, index)
        });
      })
    },
    players: [
      testPlayer({
        id: 'p1',
        label: 'P1',
        color: 0xd9534f,
        homeProvinceId: String(requiredFixtureNumber(fixture.initialState.homeProvinceByPlayer, '1', 'home')),
        money: requiredFixtureNumber(fixture.initialState.moneyByPlayer, '1', 'money')
      }),
      testPlayer({
        id: 'p2',
        label: 'P2',
        color: 0x3f88c5,
        homeProvinceId: String(requiredFixtureNumber(fixture.initialState.homeProvinceByPlayer, '2', 'home')),
        money: requiredFixtureNumber(fixture.initialState.moneyByPlayer, '2', 'money')
      })
    ],
    activePlayerId: 'p1',
    turnStep: 'attack',
    turnNumber: 1,
    winnerId: null,
    attackSpentProvinceIds: [],
    battle: null
  });
}

function battleTranscriptState(fixture: C64CbaronBattleFixture): GameState {
  const provinceIds = Object.keys(fixture.initialState.ownersByProvince).sort(
    (left, right) => Number.parseInt(left, 10) - Number.parseInt(right, 10)
  );

  return testGameState({
    seed: 1,
    rngState: 0x8c,
    phase: 'turn',
    map: {
      width: provinceIds.length,
      height: 1,
      tiles: [],
      provinces: provinceIds.map((provinceId, index) => {
        const neighbours = [
          provinceIds[index - 1],
          provinceIds[index + 1]
        ].filter((candidate): candidate is string => candidate !== undefined);

        return testProvince({
          id: provinceId,
          terrainId: 'plains',
          ownerId: provinceOwner(requiredFixtureNumber(fixture.initialState.ownersByProvince, provinceId, 'owner')),
          villages: 2,
          soldiers: requiredFixtureNumber(fixture.initialState.soldiersByProvince, provinceId, 'soldiers'),
          neighbours
        });
      })
    },
    players: [
      testPlayer({
        id: 'p1',
        label: 'P1',
        color: 0xd9534f,
        homeProvinceId: String(requiredFixtureNumber(fixture.initialState.homeProvinceByPlayer, '1', 'home')),
        money: 20
      }),
      testPlayer({
        id: 'p2',
        label: 'P2',
        color: 0x3f88c5,
        homeProvinceId: String(requiredFixtureNumber(fixture.initialState.homeProvinceByPlayer, '2', 'home')),
        money: 20
      })
    ],
    activePlayerId: 'p1',
    turnStep: 'attack',
    turnNumber: 1,
    winnerId: null,
    attackSpentProvinceIds: [],
    battle: null
  });
}

function provinceOwners(state: GameState): Readonly<Record<ProvinceId, number>> {
  return Object.fromEntries(
    state.map.provinces.map((province) => [province.id, ownerNumber(province.ownerId)])
  );
}

function provinceSoldiers(state: GameState): Readonly<Record<ProvinceId, number>> {
  return Object.fromEntries(
    state.map.provinces.map((province) => [province.id, province.soldiers])
  );
}

function provinceVillages(state: GameState): Readonly<Record<ProvinceId, number>> {
  return Object.fromEntries(
    state.map.provinces.map((province) => [province.id, province.villages])
  );
}

function playerMoney(state: GameState, playerId: string): number {
  const player = state.players.find((candidate) => candidate.id === playerId);
  if (player === undefined) {
    throw new Error(`Missing player ${playerId}.`);
  }
  return player.money;
}

function rememberedTarget(state: GameState, playerId: string): number {
  const memory = state.c64.playerMemory.find((candidate) => candidate.playerId === playerId);
  if (memory === undefined) {
    throw new Error(`Missing C64 memory for ${playerId}.`);
  }
  return memory.rememberedTargetProvinceId === null
    ? 0
    : Number.parseInt(memory.rememberedTargetProvinceId, 10);
}

function rememberedTargetSoldiers(state: GameState, playerId: string): number {
  const memory = state.c64.playerMemory.find((candidate) => candidate.playerId === playerId);
  if (memory === undefined) {
    throw new Error(`Missing C64 memory for ${playerId}.`);
  }
  return memory.rememberedTargetSoldiers;
}

describe('C64 AI phase-chain transcripts', () => {
  it('matches cbaron attack through battle capture transcript', () => {
    const fixture = loadBattleFixture('cbaron-5803-battle-capture-line.json');
    const config = {
      ...DEFAULT_GAME_CONFIG,
      humanPlayerCount: 0,
      aiPlayerCount: 2
    };

    const attack = applyPlayerAction(battleTranscriptState(fixture), 'p1', {
      type: 'run-c64-baron-attack'
    }, config);

    expect(attack.state.battle).toMatchObject({
      attackerId: 'p1',
      defenderId: 'p2',
      fromProvinceIds: fixture.observed.sourceProvinces.map(String).reverse(),
      targetProvinceId: String(fixture.observed.selectedTarget),
      attackerSoldiers: fixture.observed.attackerSoldiersAtBattleStart,
      defenderSoldiers: fixture.observed.defenderSoldiersAtBattleStart
    });

    const resolved = applyPlayerAction(attack.state, 'p1', {
      type: 'run-c64-battle-command'
    }, config);

    expect(resolved.events.map((event) => event.type)).toEqual([
      'battle-round-resolved',
      'battle-resolved',
      'game-won'
    ]);
    expect(resolved.events[1]).toMatchObject({
      type: 'battle-resolved',
      attackerId: 'p1',
      defenderId: 'p2',
      targetProvinceId: String(fixture.observed.selectedTarget),
      result: {
        winner: 'attacker',
        resolution: 'elimination',
        survivingAttackers: fixture.observed.soldiersByProvince[String(fixture.observed.selectedTarget)],
        survivingDefenders: 0
      }
    });
    expect(resolved.state.battle).toBeNull();
    expect(resolved.state.phase).toBe('game-over');
    expect(resolved.state.winnerId).toBe('p1');
    expect(resolved.events[2]).toEqual({
      type: 'game-won',
      winnerId: 'p1'
    });
    expect(provinceOwners(resolved.state)).toMatchObject(fixture.observed.ownersByProvince);
    expect(provinceSoldiers(resolved.state)).toMatchObject(fixture.observed.soldiersByProvince);
    expect(resolved.state.players.find((player) => player.id === 'p2')?.homeProvinceId).toBe(
      String(fixture.observed.homeProvinceByPlayer['2'])
    );
    expect(resolved.state.map.provinces.filter((province) => province.ownerId === 'p1')).toHaveLength(
      fixture.observed.provinceCountsByOwner['1']
    );
    expect(resolved.state.map.provinces.filter((province) => province.ownerId === 'p2')).toHaveLength(
      fixture.observed.provinceCountsByOwner['2']
    );
  });

  it('matches cbaron defender retreat battle transcript', () => {
    const fixture = loadBattleFixture('cbaron-5803-defender-retreat-line.json') as C64CbaronDefenderRetreatFixture;
    const config = {
      ...DEFAULT_GAME_CONFIG,
      humanPlayerCount: 0,
      aiPlayerCount: 2
    };

    const attack = applyPlayerAction(battleTranscriptState(fixture), 'p1', {
      type: 'run-c64-baron-attack'
    }, config);

    expect(attack.state.battle).toMatchObject({
      attackerId: 'p1',
      defenderId: 'p2',
      fromProvinceIds: fixture.observed.sourceProvinces.map(String).reverse(),
      targetProvinceId: String(fixture.observed.selectedTarget),
      attackerSoldiers: fixture.observed.attackerSoldiersAtBattleStart,
      defenderSoldiers: fixture.observed.defenderSoldiersAtBattleStart
    });

    const resolved = applyPlayerAction(attack.state, 'p1', {
      type: 'run-c64-battle-command'
    }, config);

    expect(resolved.events.map((event) => event.type)).toEqual([
      'battle-round-resolved',
      'battle-resolved'
    ]);
    expect(resolved.events[0]).toMatchObject({
      type: 'battle-round-resolved',
      attackerLosses: fixture.observed.roundLosses.attacker,
      defenderLosses: fixture.observed.roundLosses.defender,
      attackerSoldiers: fixture.observed.survivors.attacker,
      defenderSoldiers: fixture.observed.survivors.defender
    });
    expect(resolved.events[1]).toMatchObject({
      type: 'battle-resolved',
      attackerId: 'p1',
      defenderId: 'p2',
      targetProvinceId: String(fixture.observed.selectedTarget),
      result: {
        winner: 'attacker',
        resolution: fixture.observed.battleResolution,
        survivingAttackers: fixture.observed.survivors.attacker,
        survivingDefenders: fixture.observed.survivors.defender
      }
    });
    expect(resolved.state.battle).toBeNull();
    expect(resolved.state.phase).toBe('turn');
    expect(resolved.state.winnerId).toBeNull();
    expect(provinceOwners(resolved.state)).toMatchObject(fixture.observed.ownersByProvince);
    expect(provinceSoldiers(resolved.state)).toMatchObject(fixture.observed.soldiersByProvince);
    expect(resolved.state.players.find((player) => player.id === 'p2')?.homeProvinceId).toBe(
      String(fixture.observed.homeProvinceByPlayer['2'])
    );
    expect(resolved.state.map.provinces.filter((province) => province.ownerId === 'p1')).toHaveLength(
      fixture.observed.provinceCountsByOwner['1']
    );
    expect(resolved.state.map.provinces.filter((province) => province.ownerId === 'p2')).toHaveLength(
      fixture.observed.provinceCountsByOwner['2']
    );
  });

  it('matches cbaron attacker retreat battle transcript', () => {
    const fixture = loadBattleFixture('cbaron-5803-attacker-retreat-line.json') as C64CbaronAttackerRetreatFixture;
    const config = {
      ...DEFAULT_GAME_CONFIG,
      humanPlayerCount: 0,
      aiPlayerCount: 2
    };

    const attack = applyPlayerAction(battleTranscriptState(fixture), 'p1', {
      type: 'run-c64-baron-attack'
    }, config);

    expect(attack.state.battle).toMatchObject({
      attackerId: 'p1',
      defenderId: 'p2',
      fromProvinceIds: fixture.observed.sourceProvinces.map(String).reverse(),
      targetProvinceId: String(fixture.observed.selectedTarget),
      attackerSoldiers: fixture.observed.attackerSoldiersAtBattleStart,
      defenderSoldiers: fixture.observed.defenderSoldiersAtBattleStart
    });

    let current = attack.state;
    let rounds = 0;
    let resolvedEvents: ReturnType<typeof applyPlayerAction>['events'] = [];
    while (current.battle !== null) {
      const result = applyPlayerAction(current, 'p1', {
        type: 'run-c64-battle-command'
      }, config);
      rounds += 1;
      resolvedEvents = result.events;
      current = result.state;
    }

    expect(rounds).toBe(fixture.observed.rounds);
    expect(resolvedEvents.map((event) => event.type)).toEqual([
      'battle-round-resolved',
      'battle-resolved'
    ]);
    expect(resolvedEvents[0]).toMatchObject({
      type: 'battle-round-resolved',
      attackerLosses: fixture.observed.roundLosses.attacker,
      defenderLosses: fixture.observed.roundLosses.defender,
      attackerSoldiers: fixture.observed.survivors.attacker,
      defenderSoldiers: fixture.observed.survivors.defender
    });
    expect(resolvedEvents[1]).toMatchObject({
      type: 'battle-resolved',
      attackerId: 'p1',
      defenderId: 'p2',
      targetProvinceId: String(fixture.observed.selectedTarget),
      result: {
        winner: 'defender',
        resolution: fixture.observed.battleResolution,
        survivingAttackers: fixture.observed.survivors.attacker,
        survivingDefenders: fixture.observed.survivors.defender
      }
    });
    expect(current.battle).toBeNull();
    expect(current.phase).toBe('turn');
    expect(current.winnerId).toBeNull();
    expect(provinceOwners(current)).toMatchObject(fixture.observed.ownersByProvince);
    expect(provinceSoldiers(current)).toMatchObject(fixture.observed.soldiersByProvince);
    expect(current.players.find((player) => player.id === 'p2')?.homeProvinceId).toBe(
      String(fixture.observed.homeProvinceByPlayer['2'])
    );
    expect(current.map.provinces.filter((province) => province.ownerId === 'p1')).toHaveLength(
      fixture.observed.provinceCountsByOwner['1']
    );
    expect(current.map.provinces.filter((province) => province.ownerId === 'p2')).toHaveLength(
      fixture.observed.provinceCountsByOwner['2']
    );
  });

  it('matches cbaron no-attack attack/movement/economy transcript', () => {
    const fixture = loadFixture();
    const attackPhase = requiredPhase(fixture, 'cbaron:$5803');
    const movementPhase = requiredPhase(fixture, 'cbaron:$5806');
    const economyPhase = requiredPhase(fixture, 'cbaron:$5800');

    const attack = applyPlayerAction(transcriptState(fixture), 'p1', {
      type: 'run-c64-baron-attack'
    });

    expect(attack.state.battle).toBeNull();
    expect(attack.state.turnStep).toBe('movement');
    expect(attack.events).toEqual([{
      type: 'turn-step-advanced',
      playerId: 'p1',
      from: 'attack',
      to: 'movement'
    }]);
    expect(attackPhase.observed.selectedTarget).toBe(0);
    expect(attackPhase.observed.battleStarted).toBe(false);
    expect(provinceSoldiers(attack.state)).toMatchObject(attackPhase.observed.soldiersByProvince);
    expect(rememberedTarget(attack.state, 'p1')).toBe(attackPhase.observed.rememberedTarget);

    const movement = applyPlayerAction(attack.state, 'p1', {
      type: 'run-c64-baron-movement'
    });

    expect(movement.state.turnStep).toBe('investment');
    expect(movement.events).toContainEqual({
      type: 'c64-baron-movement-resolved',
      playerId: 'p1',
      pulledMobileSoldiers: movementPhase.observed.pulledMobileSoldiers,
      defensiveRequirement: movementPhase.observed.defensiveRequirement,
      rememberedTargetProvinceId: null
    });
    expect(provinceSoldiers(movement.state)).toMatchObject(movementPhase.observed.soldiersByProvince);
    expect(rememberedTarget(movement.state, 'p1')).toBe(movementPhase.observed.rememberedTarget);

    const economy = runC64CbaronEconomy({
      state: movement.state,
      activePlayerId: 'p1',
      ownerSlots,
      config: DEFAULT_GAME_CONFIG
    });

    expect(provinceSoldiers(economy.state)).toMatchObject(economyPhase.observed.soldiersByProvince);
    if (economyPhase.observed.villagesByProvince === undefined) {
      throw new Error('Missing economy villages fixture.');
    }
    expect(provinceVillages(economy.state)).toMatchObject(economyPhase.observed.villagesByProvince);
    if (economyPhase.observed.moneyByPlayer === undefined) {
      throw new Error('Missing economy money fixture.');
    }
    expect(playerMoney(economy.state, 'p1')).toBe(economyPhase.observed.moneyByPlayer['1']);
    expect(rememberedTarget(economy.state, 'p1')).toBe(economyPhase.observed.rememberedTarget);
  });

  it('matches cbaron no-attack L5EA4 movement-memory transcript', () => {
    const fixture = loadTurnBattleFixture('cbaron-ai-turn-l5ea4-transcript.json');
    const attackPhase = requiredTurnBattlePhase(fixture, 'cbaron:$5803');
    const movementPhase = requiredTurnBattlePhase(fixture, 'cbaron:$5806');
    const economyPhase = requiredTurnBattlePhase(fixture, 'cbaron:$5800');
    const config = {
      ...DEFAULT_GAME_CONFIG,
      humanPlayerCount: 0,
      aiPlayerCount: 2
    };

    const attack = applyPlayerAction(turnBattleTranscriptState(fixture), 'p1', {
      type: 'run-c64-baron-attack'
    }, config);

    expect(attack.state.battle).toBeNull();
    expect(attack.state.turnStep).toBe('movement');
    expect(attack.events).toEqual([{
      type: 'turn-step-advanced',
      playerId: 'p1',
      from: 'attack',
      to: 'movement'
    }]);
    expect(attackPhase.observed.selectedTarget).toBe(0);
    expect(provinceOwners(attack.state)).toMatchObject(attackPhase.observed.ownersByProvince);
    expect(provinceSoldiers(attack.state)).toMatchObject(attackPhase.observed.soldiersByProvince);
    expect(playerMoney(attack.state, 'p1')).toBe(attackPhase.observed.moneyByPlayer['1']);
    expect(rememberedTarget(attack.state, 'p1')).toBe(attackPhase.observed.rememberedTarget);

    const movement = applyPlayerAction(attack.state, 'p1', {
      type: 'run-c64-baron-movement'
    }, config);

    expect(movement.state.turnStep).toBe('investment');
    expect(movement.events).toContainEqual({
      type: 'c64-baron-movement-resolved',
      playerId: 'p1',
      pulledMobileSoldiers: movementPhase.observed.pulledMobileSoldiers,
      defensiveRequirement: movementPhase.observed.defensiveRequirement,
      rememberedTargetProvinceId: String(movementPhase.observed.rememberedTarget)
    });
    expect(provinceOwners(movement.state)).toMatchObject(movementPhase.observed.ownersByProvince);
    expect(provinceSoldiers(movement.state)).toMatchObject(movementPhase.observed.soldiersByProvince);
    if (movementPhase.observed.villagesByProvince === undefined) {
      throw new Error('Missing L5EA4 movement villages fixture.');
    }
    expect(provinceVillages(movement.state)).toMatchObject(movementPhase.observed.villagesByProvince);
    expect(playerMoney(movement.state, 'p1')).toBe(movementPhase.observed.moneyByPlayer['1']);
    expect(rememberedTarget(movement.state, 'p1')).toBe(movementPhase.observed.rememberedTarget);
    if (movementPhase.observed.rememberedTargetSoldiers === undefined) {
      throw new Error('Missing L5EA4 movement remembered target soldiers fixture.');
    }
    expect(rememberedTargetSoldiers(movement.state, 'p1')).toBe(
      movementPhase.observed.rememberedTargetSoldiers
    );

    const economy = runC64CbaronEconomy({
      state: movement.state,
      activePlayerId: 'p1',
      ownerSlots,
      config
    });

    expect(provinceOwners(economy.state)).toMatchObject(economyPhase.observed.ownersByProvince);
    expect(provinceSoldiers(economy.state)).toMatchObject(economyPhase.observed.soldiersByProvince);
    if (economyPhase.observed.villagesByProvince === undefined) {
      throw new Error('Missing L5EA4 economy villages fixture.');
    }
    expect(provinceVillages(economy.state)).toMatchObject(economyPhase.observed.villagesByProvince);
    expect(playerMoney(economy.state, 'p1')).toBe(economyPhase.observed.moneyByPlayer['1']);
    expect(rememberedTarget(economy.state, 'p1')).toBe(economyPhase.observed.rememberedTarget);
    if (economyPhase.observed.rememberedTargetSoldiers === undefined) {
      throw new Error('Missing L5EA4 economy remembered target soldiers fixture.');
    }
    expect(rememberedTargetSoldiers(economy.state, 'p1')).toBe(
      economyPhase.observed.rememberedTargetSoldiers
    );
  });

  it('matches cbaron no-attack branching underpowered movement transcript', () => {
    const fixture = loadTurnBattleFixture('cbaron-ai-turn-branching-underpowered-transcript.json');
    const attackPhase = requiredTurnBattlePhase(fixture, 'cbaron:$5803');
    const movementPhase = requiredTurnBattlePhase(fixture, 'cbaron:$5806');
    const economyPhase = requiredTurnBattlePhase(fixture, 'cbaron:$5800');
    const config = {
      ...DEFAULT_GAME_CONFIG,
      humanPlayerCount: 0,
      aiPlayerCount: 2
    };

    const attack = applyPlayerAction(turnBattleTranscriptState(fixture), 'p1', {
      type: 'run-c64-baron-attack'
    }, config);

    expect(attack.state.battle).toBeNull();
    expect(attack.state.turnStep).toBe('movement');
    expect(attack.events).toEqual([{
      type: 'turn-step-advanced',
      playerId: 'p1',
      from: 'attack',
      to: 'movement'
    }]);
    expect(attackPhase.observed.selectedTarget).toBe(0);
    expect(provinceOwners(attack.state)).toMatchObject(attackPhase.observed.ownersByProvince);
    expect(provinceSoldiers(attack.state)).toMatchObject(attackPhase.observed.soldiersByProvince);
    expect(playerMoney(attack.state, 'p1')).toBe(attackPhase.observed.moneyByPlayer['1']);
    expect(rememberedTarget(attack.state, 'p1')).toBe(attackPhase.observed.rememberedTarget);

    const movement = applyPlayerAction(attack.state, 'p1', {
      type: 'run-c64-baron-movement'
    }, config);

    expect(movement.state.turnStep).toBe('investment');
    expect(movement.events).toContainEqual({
      type: 'c64-baron-movement-resolved',
      playerId: 'p1',
      pulledMobileSoldiers: movementPhase.observed.pulledMobileSoldiers,
      defensiveRequirement: movementPhase.observed.defensiveRequirement,
      rememberedTargetProvinceId: null
    });
    expect(provinceOwners(movement.state)).toMatchObject(movementPhase.observed.ownersByProvince);
    expect(provinceSoldiers(movement.state)).toMatchObject(movementPhase.observed.soldiersByProvince);
    if (movementPhase.observed.villagesByProvince === undefined) {
      throw new Error('Missing branching movement villages fixture.');
    }
    expect(provinceVillages(movement.state)).toMatchObject(movementPhase.observed.villagesByProvince);
    expect(playerMoney(movement.state, 'p1')).toBe(movementPhase.observed.moneyByPlayer['1']);
    expect(rememberedTarget(movement.state, 'p1')).toBe(movementPhase.observed.rememberedTarget);
    if (movementPhase.observed.rememberedTargetSoldiers === undefined) {
      throw new Error('Missing branching movement remembered target soldiers fixture.');
    }
    expect(rememberedTargetSoldiers(movement.state, 'p1')).toBe(
      movementPhase.observed.rememberedTargetSoldiers
    );

    const economy = runC64CbaronEconomy({
      state: movement.state,
      activePlayerId: 'p1',
      ownerSlots,
      config
    });

    expect(provinceOwners(economy.state)).toMatchObject(economyPhase.observed.ownersByProvince);
    expect(provinceSoldiers(economy.state)).toMatchObject(economyPhase.observed.soldiersByProvince);
    if (economyPhase.observed.villagesByProvince === undefined) {
      throw new Error('Missing branching economy villages fixture.');
    }
    expect(provinceVillages(economy.state)).toMatchObject(economyPhase.observed.villagesByProvince);
    expect(playerMoney(economy.state, 'p1')).toBe(economyPhase.observed.moneyByPlayer['1']);
    expect(rememberedTarget(economy.state, 'p1')).toBe(economyPhase.observed.rememberedTarget);
    if (economyPhase.observed.rememberedTargetSoldiers === undefined) {
      throw new Error('Missing branching economy remembered target soldiers fixture.');
    }
    expect(rememberedTargetSoldiers(economy.state, 'p1')).toBe(
      economyPhase.observed.rememberedTargetSoldiers
    );
  });

  it('matches cbaron attacker-retreat attack/movement/economy transcript', () => {
    const fixture = loadTurnBattleFixture();
    const attackPhase = requiredTurnBattlePhase(fixture, 'cbaron:$5803');
    const movementPhase = requiredTurnBattlePhase(fixture, 'cbaron:$5806');
    const economyPhase = requiredTurnBattlePhase(fixture, 'cbaron:$5800');
    const config = {
      ...DEFAULT_GAME_CONFIG,
      humanPlayerCount: 0,
      aiPlayerCount: 2
    };

    const attack = applyPlayerAction(turnBattleTranscriptState(fixture), 'p1', {
      type: 'run-c64-baron-attack'
    }, config);

    if (
      attackPhase.observed.sourceProvinces === undefined ||
      attackPhase.observed.attackerSoldiersAtBattleStart === undefined ||
      attackPhase.observed.defenderSoldiersAtBattleStart === undefined
    ) {
      throw new Error('Missing attacker-retreat attack setup fixture fields.');
    }

    expect(attack.state.battle).toMatchObject({
      attackerId: 'p1',
      defenderId: 'p2',
      fromProvinceIds: attackPhase.observed.sourceProvinces.map(String).reverse(),
      targetProvinceId: String(attackPhase.observed.selectedTarget),
      attackerSoldiers: attackPhase.observed.attackerSoldiersAtBattleStart,
      defenderSoldiers: attackPhase.observed.defenderSoldiersAtBattleStart
    });

    let current = attack.state;
    let rounds = 0;
    let resolvedEvents: ReturnType<typeof applyPlayerAction>['events'] = [];
    while (current.battle !== null) {
      const result = applyPlayerAction(current, 'p1', {
        type: 'run-c64-battle-command'
      }, config);
      rounds += 1;
      resolvedEvents = result.events;
      current = result.state;
    }

    if (
      attackPhase.observed.rounds === undefined ||
      attackPhase.observed.roundLosses === undefined ||
      attackPhase.observed.survivors === undefined ||
      attackPhase.observed.battleResolution === undefined
    ) {
      throw new Error('Missing attacker-retreat battle result fixture fields.');
    }

    expect(rounds).toBe(attackPhase.observed.rounds);
    expect(resolvedEvents[0]).toMatchObject({
      type: 'battle-round-resolved',
      attackerLosses: attackPhase.observed.roundLosses.attacker,
      defenderLosses: attackPhase.observed.roundLosses.defender,
      attackerSoldiers: attackPhase.observed.survivors.attacker,
      defenderSoldiers: attackPhase.observed.survivors.defender
    });
    expect(resolvedEvents[1]).toMatchObject({
      type: 'battle-resolved',
      result: {
        winner: 'defender',
        resolution: attackPhase.observed.battleResolution,
        survivingAttackers: attackPhase.observed.survivors.attacker,
        survivingDefenders: attackPhase.observed.survivors.defender
      }
    });
    expect(provinceOwners(current)).toMatchObject(attackPhase.observed.ownersByProvince);
    expect(provinceSoldiers(current)).toMatchObject(attackPhase.observed.soldiersByProvince);
    expect(playerMoney(current, 'p1')).toBe(attackPhase.observed.moneyByPlayer['1']);
    expect(rememberedTarget(current, 'p1')).toBe(attackPhase.observed.rememberedTarget);

    const movementStep = applyPlayerAction(current, 'p1', {
      type: 'advance-step'
    }, config);
    const movement = applyPlayerAction(movementStep.state, 'p1', {
      type: 'run-c64-baron-movement'
    }, config);

    expect(movement.events).toContainEqual({
      type: 'c64-baron-movement-resolved',
      playerId: 'p1',
      pulledMobileSoldiers: movementPhase.observed.pulledMobileSoldiers,
      defensiveRequirement: movementPhase.observed.defensiveRequirement,
      rememberedTargetProvinceId: null
    });
    expect(provinceOwners(movement.state)).toMatchObject(movementPhase.observed.ownersByProvince);
    expect(provinceSoldiers(movement.state)).toMatchObject(movementPhase.observed.soldiersByProvince);
    if (movementPhase.observed.villagesByProvince === undefined) {
      throw new Error('Missing attacker-retreat movement villages fixture.');
    }
    expect(provinceVillages(movement.state)).toMatchObject(movementPhase.observed.villagesByProvince);
    expect(playerMoney(movement.state, 'p1')).toBe(movementPhase.observed.moneyByPlayer['1']);
    expect(rememberedTarget(movement.state, 'p1')).toBe(movementPhase.observed.rememberedTarget);

    const economy = runC64CbaronEconomy({
      state: movement.state,
      activePlayerId: 'p1',
      ownerSlots,
      config
    });

    expect(provinceOwners(economy.state)).toMatchObject(economyPhase.observed.ownersByProvince);
    expect(provinceSoldiers(economy.state)).toMatchObject(economyPhase.observed.soldiersByProvince);
    if (economyPhase.observed.villagesByProvince === undefined) {
      throw new Error('Missing attacker-retreat economy villages fixture.');
    }
    expect(provinceVillages(economy.state)).toMatchObject(economyPhase.observed.villagesByProvince);
    expect(playerMoney(economy.state, 'p1')).toBe(economyPhase.observed.moneyByPlayer['1']);
    expect(rememberedTarget(economy.state, 'p1')).toBe(economyPhase.observed.rememberedTarget);
  });

  it('matches cbaron defender-retreat attack/movement/economy transcript', () => {
    const fixture = loadTurnBattleFixture('cbaron-ai-turn-defender-retreat-transcript.json');
    const attackPhase = requiredTurnBattlePhase(fixture, 'cbaron:$5803');
    const movementPhase = requiredTurnBattlePhase(fixture, 'cbaron:$5806');
    const economyPhase = requiredTurnBattlePhase(fixture, 'cbaron:$5800');
    const config = {
      ...DEFAULT_GAME_CONFIG,
      humanPlayerCount: 0,
      aiPlayerCount: 2
    };

    const attack = applyPlayerAction(turnBattleTranscriptState(fixture), 'p1', {
      type: 'run-c64-baron-attack'
    }, config);

    if (
      attackPhase.observed.sourceProvinces === undefined ||
      attackPhase.observed.attackerSoldiersAtBattleStart === undefined ||
      attackPhase.observed.defenderSoldiersAtBattleStart === undefined
    ) {
      throw new Error('Missing defender-retreat attack setup fixture fields.');
    }

    expect(attack.state.battle).toMatchObject({
      attackerId: 'p1',
      defenderId: 'p2',
      fromProvinceIds: attackPhase.observed.sourceProvinces.map(String).reverse(),
      targetProvinceId: String(attackPhase.observed.selectedTarget),
      attackerSoldiers: attackPhase.observed.attackerSoldiersAtBattleStart,
      defenderSoldiers: attackPhase.observed.defenderSoldiersAtBattleStart
    });

    const resolved = applyPlayerAction(attack.state, 'p1', {
      type: 'run-c64-battle-command'
    }, config);

    if (
      attackPhase.observed.roundLosses === undefined ||
      attackPhase.observed.survivors === undefined ||
      attackPhase.observed.battleResolution === undefined
    ) {
      throw new Error('Missing defender-retreat battle result fixture fields.');
    }

    expect(resolved.events[0]).toMatchObject({
      type: 'battle-round-resolved',
      attackerLosses: attackPhase.observed.roundLosses.attacker,
      defenderLosses: attackPhase.observed.roundLosses.defender,
      attackerSoldiers: attackPhase.observed.survivors.attacker,
      defenderSoldiers: attackPhase.observed.survivors.defender
    });
    expect(resolved.events[1]).toMatchObject({
      type: 'battle-resolved',
      result: {
        winner: 'attacker',
        resolution: attackPhase.observed.battleResolution,
        survivingAttackers: attackPhase.observed.survivors.attacker,
        survivingDefenders: attackPhase.observed.survivors.defender
      }
    });
    expect(provinceOwners(resolved.state)).toMatchObject(attackPhase.observed.ownersByProvince);
    expect(provinceSoldiers(resolved.state)).toMatchObject(attackPhase.observed.soldiersByProvince);
    expect(playerMoney(resolved.state, 'p1')).toBe(attackPhase.observed.moneyByPlayer['1']);
    expect(rememberedTarget(resolved.state, 'p1')).toBe(attackPhase.observed.rememberedTarget);

    const movementStep = applyPlayerAction(resolved.state, 'p1', {
      type: 'advance-step'
    }, config);
    const movement = applyPlayerAction(movementStep.state, 'p1', {
      type: 'run-c64-baron-movement'
    }, config);

    expect(movement.events).toContainEqual({
      type: 'c64-baron-movement-resolved',
      playerId: 'p1',
      pulledMobileSoldiers: movementPhase.observed.pulledMobileSoldiers,
      defensiveRequirement: movementPhase.observed.defensiveRequirement,
      rememberedTargetProvinceId: String(movementPhase.observed.rememberedTarget)
    });
    expect(provinceOwners(movement.state)).toMatchObject(movementPhase.observed.ownersByProvince);
    expect(provinceSoldiers(movement.state)).toMatchObject(movementPhase.observed.soldiersByProvince);
    if (movementPhase.observed.villagesByProvince === undefined) {
      throw new Error('Missing defender-retreat movement villages fixture.');
    }
    expect(provinceVillages(movement.state)).toMatchObject(movementPhase.observed.villagesByProvince);
    expect(playerMoney(movement.state, 'p1')).toBe(movementPhase.observed.moneyByPlayer['1']);
    expect(rememberedTarget(movement.state, 'p1')).toBe(movementPhase.observed.rememberedTarget);

    const economy = runC64CbaronEconomy({
      state: movement.state,
      activePlayerId: 'p1',
      ownerSlots,
      config
    });

    expect(provinceOwners(economy.state)).toMatchObject(economyPhase.observed.ownersByProvince);
    expect(provinceSoldiers(economy.state)).toMatchObject(economyPhase.observed.soldiersByProvince);
    if (economyPhase.observed.villagesByProvince === undefined) {
      throw new Error('Missing defender-retreat economy villages fixture.');
    }
    expect(provinceVillages(economy.state)).toMatchObject(economyPhase.observed.villagesByProvince);
    expect(playerMoney(economy.state, 'p1')).toBe(economyPhase.observed.moneyByPlayer['1']);
    expect(rememberedTarget(economy.state, 'p1')).toBe(economyPhase.observed.rememberedTarget);
  });

  it('matches cbaron non-home capture attack/movement/economy transcript', () => {
    const fixture = loadTurnBattleFixture('cbaron-ai-turn-capture-transcript.json');
    const attackPhase = requiredTurnBattlePhase(fixture, 'cbaron:$5803');
    const movementPhase = requiredTurnBattlePhase(fixture, 'cbaron:$5806');
    const economyPhase = requiredTurnBattlePhase(fixture, 'cbaron:$5800');
    const config = {
      ...DEFAULT_GAME_CONFIG,
      humanPlayerCount: 0,
      aiPlayerCount: 2
    };

    const attack = applyPlayerAction(turnBattleTranscriptState(fixture), 'p1', {
      type: 'run-c64-baron-attack'
    }, config);

    if (
      attackPhase.observed.sourceProvinces === undefined ||
      attackPhase.observed.attackerSoldiersAtBattleStart === undefined ||
      attackPhase.observed.defenderSoldiersAtBattleStart === undefined
    ) {
      throw new Error('Missing capture attack setup fixture fields.');
    }

    expect(attack.state.battle).toMatchObject({
      attackerId: 'p1',
      defenderId: 'p2',
      fromProvinceIds: attackPhase.observed.sourceProvinces.map(String).reverse(),
      targetProvinceId: String(attackPhase.observed.selectedTarget),
      attackerSoldiers: attackPhase.observed.attackerSoldiersAtBattleStart,
      defenderSoldiers: attackPhase.observed.defenderSoldiersAtBattleStart
    });

    const resolved = applyPlayerAction(attack.state, 'p1', {
      type: 'run-c64-battle-command'
    }, config);

    if (
      attackPhase.observed.roundLosses === undefined ||
      attackPhase.observed.survivors === undefined ||
      attackPhase.observed.battleResolution === undefined
    ) {
      throw new Error('Missing capture battle result fixture fields.');
    }

    expect(attackPhase.observed.battleResolution).toBe('capture');
    expect(resolved.events[0]).toMatchObject({
      type: 'battle-round-resolved',
      attackerLosses: attackPhase.observed.roundLosses.attacker,
      defenderLosses: attackPhase.observed.roundLosses.defender,
      attackerSoldiers: attackPhase.observed.survivors.attacker,
      defenderSoldiers: attackPhase.observed.survivors.defender
    });
    expect(resolved.events[1]).toMatchObject({
      type: 'battle-resolved',
      result: {
        winner: 'attacker',
        resolution: 'elimination',
        survivingAttackers: attackPhase.observed.survivors.attacker,
        survivingDefenders: attackPhase.observed.survivors.defender
      }
    });
    expect(provinceOwners(resolved.state)).toMatchObject(attackPhase.observed.ownersByProvince);
    expect(provinceSoldiers(resolved.state)).toMatchObject(attackPhase.observed.soldiersByProvince);
    expect(playerMoney(resolved.state, 'p1')).toBe(attackPhase.observed.moneyByPlayer['1']);
    expect(rememberedTarget(resolved.state, 'p1')).toBe(attackPhase.observed.rememberedTarget);
    expect(resolved.state.phase).toBe('turn');
    expect(resolved.state.winnerId).toBeNull();

    const movementStep = applyPlayerAction(resolved.state, 'p1', {
      type: 'advance-step'
    }, config);
    const movement = applyPlayerAction(movementStep.state, 'p1', {
      type: 'run-c64-baron-movement'
    }, config);

    expect(movement.events).toContainEqual({
      type: 'c64-baron-movement-resolved',
      playerId: 'p1',
      pulledMobileSoldiers: movementPhase.observed.pulledMobileSoldiers,
      defensiveRequirement: movementPhase.observed.defensiveRequirement,
      rememberedTargetProvinceId: null
    });
    expect(provinceOwners(movement.state)).toMatchObject(movementPhase.observed.ownersByProvince);
    expect(provinceSoldiers(movement.state)).toMatchObject(movementPhase.observed.soldiersByProvince);
    if (movementPhase.observed.villagesByProvince === undefined) {
      throw new Error('Missing capture movement villages fixture.');
    }
    expect(provinceVillages(movement.state)).toMatchObject(movementPhase.observed.villagesByProvince);
    expect(playerMoney(movement.state, 'p1')).toBe(movementPhase.observed.moneyByPlayer['1']);
    expect(rememberedTarget(movement.state, 'p1')).toBe(movementPhase.observed.rememberedTarget);

    const economy = runC64CbaronEconomy({
      state: movement.state,
      activePlayerId: 'p1',
      ownerSlots,
      config
    });

    expect(provinceOwners(economy.state)).toMatchObject(economyPhase.observed.ownersByProvince);
    expect(provinceSoldiers(economy.state)).toMatchObject(economyPhase.observed.soldiersByProvince);
    if (economyPhase.observed.villagesByProvince === undefined) {
      throw new Error('Missing capture economy villages fixture.');
    }
    expect(provinceVillages(economy.state)).toMatchObject(economyPhase.observed.villagesByProvince);
    expect(playerMoney(economy.state, 'p1')).toBe(economyPhase.observed.moneyByPlayer['1']);
    expect(rememberedTarget(economy.state, 'p1')).toBe(economyPhase.observed.rememberedTarget);
  });
});
