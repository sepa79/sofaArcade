import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { ROYALIST_OWNER_ID, type OwnerId } from './owners';

import { applyPlayerAction } from './actions';
import { DEFAULT_GAME_CONFIG } from './constants';
import { runRoyalistWorldPhase } from './royalists';
import { fortificationIndex } from './rules';
import { testGameState, testPlayer, testProvince } from './test-fixtures';
import type { FortificationLevel, GameConfig, GameState } from './types';

const HOSTILE_ROYALISTS_CONFIG: GameConfig = {
  ...DEFAULT_GAME_CONFIG,
  royalistAttitude: 'hostile'
};

const C64_HOSTILE_REPEAT_CONFIG: GameConfig = {
  ...HOSTILE_ROYALISTS_CONFIG,
  royalistAttackCooperation: 'single-source',
  royalistAttackThreshold: 'strict',
  royalistDistribution: 'none',
  terrainInfluence: 'none',
  royalistGrowthPercent: 0,
  royalistInvestmentPercent: 50,
  royalistFortificationInvestmentPercent: 50,
  interestRatePercent: 0
};

const C64_HOSTILE_WORLD_PASS_CONFIG: GameConfig = {
  ...HOSTILE_ROYALISTS_CONFIG,
  royalistAttackCooperation: 'single-source',
  royalistAttackThreshold: 'strict',
  royalistDistribution: 'even',
  terrainInfluence: 'income',
  royalistGrowthPercent: 60,
  royalistInvestmentPercent: 0,
  royalistFortificationInvestmentPercent: 0,
  interestRatePercent: 0
};

const FRIENDLY_ROYALISTS_CONFIG: GameConfig = {
  ...DEFAULT_GAME_CONFIG,
  royalistAttitude: 'friendly'
};

const COMBINED_HOSTILE_ROYALISTS_CONFIG: GameConfig = {
  ...HOSTILE_ROYALISTS_CONFIG,
  royalistAttackCooperation: 'combined-sources'
};

const LOOSE_HOSTILE_ROYALISTS_CONFIG: GameConfig = {
  ...HOSTILE_ROYALISTS_CONFIG,
  royalistAttackThreshold: 'loose'
};

const EQUAL_DISTRIBUTION_CONFIG: GameConfig = {
  ...DEFAULT_GAME_CONFIG,
  royalistAttitude: 'neutral',
  royalistDistribution: 'even'
};

const FRONTIER_DISTRIBUTION_CONFIG: GameConfig = {
  ...DEFAULT_GAME_CONFIG,
  royalistAttitude: 'neutral',
  royalistDistribution: 'border'
};

const ROYALIST_PRODUCTION_CONFIG: GameConfig = {
  ...DEFAULT_GAME_CONFIG,
  royalistAttitude: 'neutral',
  royalistGrowthPercent: 60,
  royalistInvestmentPercent: 0,
  royalistFortificationInvestmentPercent: 0,
  royalistDistribution: 'none'
};

const ROYALIST_PRODUCTION_NO_INTEREST_CONFIG: GameConfig = {
  ...ROYALIST_PRODUCTION_CONFIG,
  interestRatePercent: 0
};

const OWNER0_WORLD_PASS_CONFIG: GameConfig = {
  ...ROYALIST_PRODUCTION_CONFIG,
  royalistDistribution: 'even'
};

interface C64HostilePostBattleRepeatFixture {
  readonly fixture: 'kampf-l8461-hostile-post-battle-repeat';
  readonly initialState: C64HostileLineInitialState;
  readonly observed: {
    readonly secondL4C50: {
      readonly ownersC5daToC5de: ReadonlyArray<string>;
      readonly soldiersLowC706ToC70a: ReadonlyArray<string>;
    };
  };
}

interface C64HostileLineInitialState {
  readonly activeOwnerBeforeL3312?: number;
  readonly ownersByProvince: ReadonlyArray<number>;
  readonly soldiersByProvince: ReadonlyArray<number>;
  readonly terrainByProvince: ReadonlyArray<number>;
  readonly player1HomeProvince?: number;
  readonly playerHomeProvinces?: Readonly<Record<string, number>>;
}

interface C64HostileHomeCastleTransferFixture {
  readonly fixture: 'kampf-l8461-hostile-home-castle-transfer';
  readonly initialState: C64HostileLineInitialState;
  readonly observed: {
    readonly afterHomeCastleCapture: {
      readonly ownersC5daToC5de: ReadonlyArray<string>;
      readonly soldiersLowC706ToC70a: ReadonlyArray<string>;
    };
  };
}

interface C64HostileWorldPassInitialState extends C64HostileLineInitialState {
  readonly villagesByProvince: ReadonlyArray<number>;
}

interface C64HostileWorldPassPhase {
  readonly breakpoint: 'main:L5209' | 'main:L50D3' | 'stub:$C003';
  readonly observed: {
    readonly ownersC5daToC5de: ReadonlyArray<string>;
    readonly villagesC6a3ToC6a6: ReadonlyArray<string>;
    readonly soldiersLowC706ToC70a: ReadonlyArray<string>;
    readonly villageBucketsC902ToC906: ReadonlyArray<string>;
    readonly fortBucketsC966ToC96a: ReadonlyArray<string>;
  };
}

interface C64HostileWorldPassFixture {
  readonly fixture:
    | 'main-l337a-hostile-home-castle-world-pass'
    | 'main-l337a-hostile-nonhome-world-pass';
  readonly initialState: C64HostileWorldPassInitialState;
  readonly phases: ReadonlyArray<C64HostileWorldPassPhase>;
}

interface C64HostileTurnOwnerWorldPassPhase {
  readonly breakpoint: 'main:L337A' | C64HostileWorldPassPhase['breakpoint'];
  readonly observed: {
    readonly ownersC5daToC5de: ReadonlyArray<string>;
    readonly villagesC6a3ToC6a6: ReadonlyArray<string>;
    readonly soldiersLowC706ToC70a: ReadonlyArray<string>;
    readonly villageBucketsC902ToC906: ReadonlyArray<string>;
    readonly fortBucketsC966ToC96a: ReadonlyArray<string>;
    readonly resultCodeCA75: string;
  };
}

interface C64HostileTurnOwnerWorldPassFixture {
  readonly fixture:
    | 'main-l3312-hostile-home-castle-world-pass'
    | 'main-l3312-hostile-nonhome-world-pass'
    | 'main-l3312-hostile-home-castle-skip-p1-world-pass';
  readonly initialState: C64HostileWorldPassInitialState;
  readonly phases: ReadonlyArray<C64HostileTurnOwnerWorldPassPhase>;
}

interface C64Owner0WorldPassFixturePhase {
  readonly entry: 'main:$5209' | 'main:$50D3';
  readonly observed: {
    readonly villagesByProvince: Readonly<Record<string, number>>;
    readonly fortificationsByProvince: Readonly<Record<string, number>>;
    readonly soldiersByProvince: Readonly<Record<string, number>>;
    readonly villageBucketsByProvince: Readonly<Record<string, number>>;
    readonly fortBucketsByProvince: Readonly<Record<string, number>>;
    readonly mobileSoldiersPulled?: number;
  };
}

interface C64Owner0WorldPassFixture {
  readonly fixture: 'main-owner0-world-pass-production-distribution';
  readonly initialState: {
    readonly provinceCount: number;
    readonly ownersByProvince: Readonly<Record<string, number>>;
    readonly terrainByProvince: Readonly<Record<string, number>>;
    readonly villagesByProvince: Readonly<Record<string, number>>;
    readonly soldiersByProvince: Readonly<Record<string, number>>;
    readonly villageBucketsByProvince: Readonly<Record<string, number>>;
    readonly fortBucketsByProvince: Readonly<Record<string, number>>;
  };
  readonly phases: ReadonlyArray<C64Owner0WorldPassFixturePhase>;
}

function loadHostilePostBattleRepeatFixture(): C64HostilePostBattleRepeatFixture {
  return JSON.parse(
    readFileSync(
      new URL('../../../../docs/war-for-crown/fixtures/kampf-l8461-hostile-post-battle-repeat.json', import.meta.url),
      'utf8'
    )
  ) as C64HostilePostBattleRepeatFixture;
}

function loadHostileHomeCastleTransferFixture(): C64HostileHomeCastleTransferFixture {
  return JSON.parse(
    readFileSync(
      new URL(
        '../../../../docs/war-for-crown/fixtures/kampf-l8461-hostile-home-castle-transfer.json',
        import.meta.url
      ),
      'utf8'
    )
  ) as C64HostileHomeCastleTransferFixture;
}

function loadHostileWorldPassFixture(
  fileName: string = 'main-l337a-hostile-home-castle-world-pass.json'
): C64HostileWorldPassFixture {
  return JSON.parse(
    readFileSync(
      new URL(
        `../../../../docs/war-for-crown/fixtures/${fileName}`,
        import.meta.url
      ),
      'utf8'
    )
  ) as C64HostileWorldPassFixture;
}

function loadHostileTurnOwnerWorldPassFixture(
  fileName: string = 'main-l3312-hostile-home-castle-world-pass.json'
): C64HostileTurnOwnerWorldPassFixture {
  return JSON.parse(
    readFileSync(
      new URL(
        `../../../../docs/war-for-crown/fixtures/${fileName}`,
        import.meta.url
      ),
      'utf8'
    )
  ) as C64HostileTurnOwnerWorldPassFixture;
}

function loadOwner0WorldPassFixture(): C64Owner0WorldPassFixture {
  return JSON.parse(
    readFileSync(
      new URL(
        '../../../../docs/war-for-crown/fixtures/main-owner0-world-pass-production-distribution.json',
        import.meta.url
      ),
      'utf8'
    )
  ) as C64Owner0WorldPassFixture;
}

function requiredOwner0WorldPassPhase(
  fixture: C64Owner0WorldPassFixture,
  entry: C64Owner0WorldPassFixturePhase['entry']
): C64Owner0WorldPassFixturePhase {
  const phase = fixture.phases.find((candidate) => candidate.entry === entry);
  if (phase === undefined) {
    throw new Error(`Missing owner-0 world-pass fixture phase ${entry}.`);
  }
  return phase;
}

function requiredHostileWorldPassPhase(
  fixture: C64HostileWorldPassFixture,
  breakpoint: C64HostileWorldPassPhase['breakpoint']
): C64HostileWorldPassPhase {
  const phase = fixture.phases.find((candidate) => candidate.breakpoint === breakpoint);
  if (phase === undefined) {
    throw new Error(`Missing hostile world-pass fixture breakpoint ${breakpoint}.`);
  }
  return phase;
}

function requiredHostileTurnOwnerWorldPassPhase(
  fixture: C64HostileTurnOwnerWorldPassFixture,
  breakpoint: C64HostileTurnOwnerWorldPassPhase['breakpoint']
): C64HostileTurnOwnerWorldPassPhase {
  const phase = fixture.phases.find((candidate) => candidate.breakpoint === breakpoint);
  if (phase === undefined) {
    throw new Error(`Missing hostile turn-owner world-pass fixture breakpoint ${breakpoint}.`);
  }
  return phase;
}

function requiredFixtureNumber(
  values: Readonly<Record<string, number>>,
  key: string,
  label: string
): number {
  const value = values[key];
  if (value === undefined) {
    throw new Error(`Missing ${label} for fixture key ${key}.`);
  }
  return value;
}

function parseHexByte(value: string): number {
  return Number.parseInt(value.slice(2), 16);
}

function c64Owner(owner: number): OwnerId {
  if (owner === 0) {
    return ROYALIST_OWNER_ID;
  }
  if (owner < 1) {
    throw new Error(`Unsupported fixture owner ${owner}.`);
  }
  return `p${owner}` as OwnerId;
}

function terrainFromC64Id(terrainId: number): 'plains' | 'desert' {
  if (terrainId === 1) {
    return 'plains';
  }
  if (terrainId === 2) {
    return 'desert';
  }
  throw new Error(`Unsupported fixture terrain ${terrainId}.`);
}

function c64LineNeighboursInProvinceCount(
  provinceId: string,
  provinceCount: number
): ReadonlyArray<string> {
  const numericProvinceId = Number.parseInt(provinceId, 10);
  if (!Number.isInteger(numericProvinceId) || numericProvinceId < 1 || numericProvinceId > provinceCount) {
    throw new Error(`Unsupported line fixture province ${provinceId}.`);
  }

  const neighbours: string[] = [];
  if (numericProvinceId > 1) {
    neighbours.push((numericProvinceId - 1).toString());
  }
  if (numericProvinceId < provinceCount) {
    neighbours.push((numericProvinceId + 1).toString());
  }
  return neighbours;
}

function hostileLineState(
  initialState: C64HostileLineInitialState,
  villagesByProvince: ReadonlyArray<number> = initialState.ownersByProvince.map(() => 2)
): GameState {
  const playerNumbers = [...new Set(initialState.ownersByProvince.filter((owner) => owner > 0))]
    .sort((left, right) => left - right);
  const activeOwner = initialState.activeOwnerBeforeL3312 ?? 1;
  return testGameState({
    seed: 1,
    rngState: 1,
    phase: 'turn',
    map: {
      width: initialState.ownersByProvince.length,
      height: 1,
      tiles: [],
      provinces: initialState.ownersByProvince.map((owner, index) => {
        const provinceId = (index + 1).toString();
        const soldiers = initialState.soldiersByProvince[index];
        const terrainId = initialState.terrainByProvince[index];
        const villages = villagesByProvince[index];
        if (soldiers === undefined || terrainId === undefined || villages === undefined) {
          throw new Error(`Missing hostile line fixture province ${provinceId}.`);
        }

        return testProvince({
          id: provinceId,
          terrainId: terrainFromC64Id(terrainId),
          ownerId: c64Owner(owner),
          villages,
          soldiers,
          neighbours: c64LineNeighboursInProvinceCount(
            provinceId,
            initialState.ownersByProvince.length
          )
        });
      })
    },
    players: playerNumbers.map((playerNumber) => {
      const playerKey = playerNumber.toString();
      const homeProvince =
        initialState.playerHomeProvinces?.[playerKey] ??
        (playerNumber === 1 ? initialState.player1HomeProvince ?? 2 : undefined);
      if (homeProvince === undefined) {
        throw new Error(`Missing home province for fixture player ${playerNumber}.`);
      }
      return testPlayer({
        id: `p${playerNumber}`,
        label: `P${playerNumber}`,
        color: playerNumber === 1 ? 0xd9534f : 0x3f88c5,
        homeProvinceId: homeProvince.toString()
      });
    }),
    activePlayerId: `p${activeOwner}`,
    turnStep: 'investment',
    turnNumber: 1,
    winnerId: null,
    attackSpentProvinceIds: [],
    battle: null
  });
}

function hostilePostBattleRepeatState(fixture: C64HostilePostBattleRepeatFixture): GameState {
  return hostileLineState(fixture.initialState);
}

function hostileHomeCastleTransferState(fixture: C64HostileHomeCastleTransferFixture): GameState {
  return hostileLineState(fixture.initialState);
}

function hostileWorldPassState(
  fixture: { readonly initialState: C64HostileWorldPassInitialState }
): GameState {
  return hostileLineState(fixture.initialState, fixture.initialState.villagesByProvince);
}

function owner0WorldPassState(fixture: C64Owner0WorldPassFixture): GameState {
  const provinceIds = Array.from(
    { length: fixture.initialState.provinceCount },
    (_, index) => (index + 1).toString()
  );
  const state = testGameState({
    seed: 1,
    rngState: 1,
    phase: 'turn',
    map: {
      width: fixture.initialState.provinceCount,
      height: 1,
      tiles: [],
      provinces: provinceIds.map((provinceId) =>
        testProvince({
          id: provinceId,
          terrainId: terrainFromC64Id(
            requiredFixtureNumber(fixture.initialState.terrainByProvince, provinceId, 'terrain')
          ),
          ownerId: c64Owner(
            requiredFixtureNumber(fixture.initialState.ownersByProvince, provinceId, 'owner')
          ),
          villages: requiredFixtureNumber(
            fixture.initialState.villagesByProvince,
            provinceId,
            'villages'
          ),
          soldiers: requiredFixtureNumber(
            fixture.initialState.soldiersByProvince,
            provinceId,
            'soldiers'
          ),
          neighbours: c64LineNeighboursInProvinceCount(
            provinceId,
            fixture.initialState.provinceCount
          )
        })
      )
    },
    players: [
      testPlayer({ id: 'p1', label: 'P1', color: 0xd9534f, homeProvinceId: '3' })
    ],
    activePlayerId: 'p1',
    turnStep: 'investment',
    turnNumber: 1,
    winnerId: null,
    attackSpentProvinceIds: [],
    battle: null
  });

  return {
    ...state,
    c64: {
      ...state.c64,
      royalistProvinceMemory: state.c64.royalistProvinceMemory.map((memory) => ({
        ...memory,
        villageInvestmentBucket: requiredFixtureNumber(
          fixture.initialState.villageBucketsByProvince,
          memory.provinceId,
          'village bucket'
        ),
        fortificationInvestmentBucket: requiredFixtureNumber(
          fixture.initialState.fortBucketsByProvince,
          memory.provinceId,
          'fort bucket'
        )
      }))
    }
  };
}

function expectedOwnersByProvince(
  ownersC5daToC5de: ReadonlyArray<string>
): Readonly<Record<string, OwnerId>> {
  return Object.fromEntries(
    ownersC5daToC5de.slice(1).map((value, index) => [
      (index + 1).toString(),
      c64Owner(parseHexByte(value))
    ])
  );
}

function expectedSoldiersByProvince(
  soldiersLowC706ToC70a: ReadonlyArray<string>
): Readonly<Record<string, number>> {
  return Object.fromEntries(
    soldiersLowC706ToC70a.slice(1).map((value, index) => [
      (index + 1).toString(),
      parseHexByte(value)
    ])
  );
}

function expectedProvinceValuesFromHex(
  valuesByProvince1To4: ReadonlyArray<string>
): Readonly<Record<string, number>> {
  return Object.fromEntries(
    valuesByProvince1To4.map((value, index) => [
      (index + 1).toString(),
      parseHexByte(value)
    ])
  );
}

function expectedProvinceValuesFromHexWithDummyZero(
  valuesByProvince0To4: ReadonlyArray<string>
): Readonly<Record<string, number>> {
  return expectedProvinceValuesFromHex(valuesByProvince0To4.slice(1));
}

function royalistState(activePlayerId: string = 'p1', turnNumber: number = 1): GameState {
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
          id: 'royalist-source',
          terrainId: 'plains',
          ownerId: ROYALIST_OWNER_ID,
          villages: 2,
          soldiers: 8,
          neighbours: ['baron-target']
        }),
        testProvince({
          id: 'baron-target',
          terrainId: 'plains',
          ownerId: 'p1',
          villages: 2,
          soldiers: 3,
          neighbours: ['royalist-source']
        }),
        testProvince({
          id: 'p2-home',
          terrainId: 'plains',
          ownerId: 'p2',
          villages: 2,
          soldiers: 20,
          neighbours: []
        })
      ]
    },
    players: [
      testPlayer({ id: 'p1', label: 'P1', color: 0xd9534f, homeProvinceId: 'baron-target' }),
      testPlayer({ id: 'p2', label: 'P2', color: 0x3f88c5, homeProvinceId: 'p2-home' })
    ],
    activePlayerId,
    turnStep: 'investment',
    turnNumber,
    winnerId: null,
    attackSpentProvinceIds: [],
    battle: null
  });
}

function royalistDistributionState(): GameState {
  return testGameState({
    ...royalistState(),
    map: {
      width: 4,
      height: 1,
      tiles: [],
      provinces: [
        testProvince({
          id: 'r1',
          terrainId: 'plains',
          ownerId: ROYALIST_OWNER_ID,
          villages: 0,
          soldiers: 1,
          neighbours: ['r2']
        }),
        testProvince({
          id: 'r2',
          terrainId: 'plains',
          ownerId: ROYALIST_OWNER_ID,
          villages: 0,
          soldiers: 4,
          neighbours: ['r1', 'r3']
        }),
        testProvince({
          id: 'r3',
          terrainId: 'plains',
          ownerId: ROYALIST_OWNER_ID,
          villages: 0,
          soldiers: 7,
          neighbours: ['r2', 'p1-land']
        }),
        testProvince({
          id: 'p1-land',
          terrainId: 'plains',
          ownerId: 'p1',
          villages: 2,
          soldiers: 1,
          neighbours: ['r3']
        })
      ]
    },
    players: [
      testPlayer({ id: 'p1', label: 'P1', color: 0xd9534f, homeProvinceId: 'p1-land' }),
      testPlayer({ id: 'p2', label: 'P2', color: 0x3f88c5, homeProvinceId: 'p2-home' })
    ]
  });
}

function royalistMultiComponentDistributionState(): GameState {
  return testGameState({
    ...royalistState(),
    map: {
      width: 5,
      height: 1,
      tiles: [],
      provinces: [
        testProvince({
          id: 'r1',
          terrainId: 'plains',
          ownerId: ROYALIST_OWNER_ID,
          villages: 0,
          soldiers: 1,
          neighbours: ['r2']
        }),
        testProvince({
          id: 'r2',
          terrainId: 'plains',
          ownerId: ROYALIST_OWNER_ID,
          villages: 0,
          soldiers: 4,
          neighbours: ['r1', 'p1-land']
        }),
        testProvince({
          id: 'p1-land',
          terrainId: 'plains',
          ownerId: 'p1',
          villages: 2,
          soldiers: 1,
          neighbours: ['r2', 'r4']
        }),
        testProvince({
          id: 'r4',
          terrainId: 'plains',
          ownerId: ROYALIST_OWNER_ID,
          villages: 0,
          soldiers: 7,
          neighbours: ['p1-land', 'r5']
        }),
        testProvince({
          id: 'r5',
          terrainId: 'plains',
          ownerId: ROYALIST_OWNER_ID,
          villages: 0,
          soldiers: 10,
          neighbours: ['r4']
        })
      ]
    },
    players: [
      testPlayer({ id: 'p1', label: 'P1', color: 0xd9534f, homeProvinceId: 'p1-land' }),
      testPlayer({ id: 'p2', label: 'P2', color: 0x3f88c5, homeProvinceId: 'p2-home' })
    ]
  });
}

function royalistCooperationState(): GameState {
  return testGameState({
    ...royalistState(),
    map: {
      width: 3,
      height: 1,
      tiles: [],
      provinces: [
        testProvince({
          id: 'royalist-low',
          terrainId: 'plains',
          ownerId: ROYALIST_OWNER_ID,
          villages: 2,
          soldiers: 7,
          neighbours: ['baron-target']
        }),
        testProvince({
          id: 'baron-target',
          terrainId: 'plains',
          ownerId: 'p1',
          villages: 2,
          soldiers: 5,
          neighbours: ['royalist-low', 'royalist-high']
        }),
        testProvince({
          id: 'royalist-high',
          terrainId: 'plains',
          ownerId: ROYALIST_OWNER_ID,
          villages: 2,
          soldiers: 4,
          neighbours: ['baron-target']
        })
      ]
    },
    players: [
      testPlayer({ id: 'p1', label: 'P1', color: 0xd9534f, homeProvinceId: 'baron-target' }),
      testPlayer({ id: 'p2', label: 'P2', color: 0x3f88c5, homeProvinceId: null })
    ]
  });
}

function royalistThresholdState(): GameState {
  return testGameState({
    ...royalistState(),
    map: {
      width: 2,
      height: 1,
      tiles: [],
      provinces: [
        testProvince({
          id: 'royalist-source',
          terrainId: 'plains',
          ownerId: ROYALIST_OWNER_ID,
          villages: 2,
          soldiers: 10,
          neighbours: ['baron-target']
        }),
        testProvince({
          id: 'baron-target',
          terrainId: 'plains',
          ownerId: 'p1',
          villages: 2,
          soldiers: 8,
          neighbours: ['royalist-source']
        })
      ]
    },
    players: [
      testPlayer({ id: 'p1', label: 'P1', color: 0xd9534f, homeProvinceId: 'baron-target' }),
      testPlayer({ id: 'p2', label: 'P2', color: 0x3f88c5, homeProvinceId: null })
    ]
  });
}

function soldiersByProvince(state: GameState): Readonly<Record<string, number>> {
  return Object.fromEntries(state.map.provinces.map((province) => [province.id, province.soldiers]));
}

function villagesByProvince(state: GameState): Readonly<Record<string, number>> {
  return Object.fromEntries(state.map.provinces.map((province) => [province.id, province.villages]));
}

function fortificationsByProvince(state: GameState): Readonly<Record<string, number>> {
  return Object.fromEntries(
    state.map.provinces.map((province) => [province.id, fortificationIndex(province.fortificationLevel)])
  );
}

function royalistVillageBucketsByProvince(state: GameState): Readonly<Record<string, number>> {
  return Object.fromEntries(
    state.c64.royalistProvinceMemory.map((memory) => [
      memory.provinceId,
      memory.villageInvestmentBucket
    ])
  );
}

function royalistFortBucketsByProvince(state: GameState): Readonly<Record<string, number>> {
  return Object.fromEntries(
    state.c64.royalistProvinceMemory.map((memory) => [
      memory.provinceId,
      memory.fortificationInvestmentBucket
    ])
  );
}

function provinceById(state: GameState, provinceId: string) {
  const province = state.map.provinces.find((candidate) => candidate.id === provinceId);
  if (province === undefined) {
    throw new Error(`Missing test province ${provinceId}.`);
  }

  return province;
}

function royalistProductionState(): GameState {
  const state = testGameState({
    seed: 1,
    rngState: 1,
    phase: 'turn',
    map: {
      width: 2,
      height: 1,
      tiles: [],
      provinces: [
        testProvince({
          id: 'r1',
          terrainId: 'plains',
          ownerId: ROYALIST_OWNER_ID,
          villages: 2,
          soldiers: 1,
          neighbours: []
        }),
        testProvince({
          id: 'r2',
          terrainId: 'plains',
          ownerId: ROYALIST_OWNER_ID,
          villages: 2,
          soldiers: 1,
          neighbours: []
        })
      ]
    },
    players: [testPlayer({ id: 'p1', label: 'P1', color: 0xd9534f, homeProvinceId: null })],
    activePlayerId: 'p1',
    turnStep: 'investment',
    turnNumber: 1,
    winnerId: null,
    attackSpentProvinceIds: [],
    battle: null
  });

  return {
    ...state,
    c64: {
      ...state.c64,
      royalistProvinceMemory: state.c64.royalistProvinceMemory.map((memory) =>
        memory.provinceId === 'r1'
          ? { ...memory, villageInvestmentBucket: 3 }
          : memory.provinceId === 'r2'
            ? { ...memory, fortificationInvestmentBucket: 19 }
            : memory
      )
    }
  };
}

function royalistFortProductionState(fortificationLevel: FortificationLevel): GameState {
  const state = testGameState({
    seed: 1,
    rngState: 1,
    phase: 'turn',
    map: {
      width: 1,
      height: 1,
      tiles: [],
      provinces: [
        testProvince({
          id: 'r1',
          terrainId: 'plains',
          ownerId: ROYALIST_OWNER_ID,
          villages: 2,
          soldiers: 1,
          fortificationLevel,
          neighbours: []
        })
      ]
    },
    players: [testPlayer({ id: 'p1', label: 'P1', color: 0xd9534f, homeProvinceId: null })],
    activePlayerId: 'p1',
    turnStep: 'investment',
    turnNumber: 1,
    winnerId: null,
    attackSpentProvinceIds: [],
    battle: null
  });

  return {
    ...state,
    c64: {
      ...state.c64,
      royalistProvinceMemory: state.c64.royalistProvinceMemory.map((memory) => ({
        ...memory,
        fortificationInvestmentBucket: 20
      }))
    }
  };
}

describe('C64 royalist world phase', () => {
  it('does nothing when royalists are friendly', () => {
    const result = runRoyalistWorldPhase(royalistState(), FRIENDLY_ROYALISTS_CONFIG);

    expect(result.events).toEqual([]);
    expect(result.state).toEqual(royalistState());
  });

  it('matches C64 hostile royalist post-battle repeat fixture', () => {
    const fixture = loadHostilePostBattleRepeatFixture();
    const result = runRoyalistWorldPhase(
      hostilePostBattleRepeatState(fixture),
      C64_HOSTILE_REPEAT_CONFIG
    );

    expect(result.events.map((event) => event.type)).toEqual([
      'royalist-battle-resolved',
      'royalist-battle-resolved',
      'game-won'
    ]);
    expect(result.events[0]).toMatchObject({
      type: 'royalist-battle-resolved',
      fromProvinceIds: ['3'],
      targetProvinceId: '4',
      attackingSoldiers: 49
    });
    expect(result.events[1]).toMatchObject({
      type: 'royalist-battle-resolved',
      fromProvinceIds: ['3'],
      targetProvinceId: '2',
      attackingSoldiers: 23
    });
    expect(Object.fromEntries(
      result.state.map.provinces.map((province) => [province.id, province.ownerId])
    )).toEqual(expectedOwnersByProvince(fixture.observed.secondL4C50.ownersC5daToC5de));
    expect(soldiersByProvince(result.state)).toEqual(
      expectedSoldiersByProvince(fixture.observed.secondL4C50.soldiersLowC706ToC70a)
    );
    expect(result.state.phase).toBe('game-over');
    expect(result.state.winnerId).toBe(ROYALIST_OWNER_ID);
    expect(result.state.players.find((player) => player.id === 'p1')?.homeProvinceId).toBe('2');
  });

  it('matches C64 hostile royalist home-castle transfer fixture', () => {
    const fixture = loadHostileHomeCastleTransferFixture();
    const result = runRoyalistWorldPhase(
      hostileHomeCastleTransferState(fixture),
      C64_HOSTILE_REPEAT_CONFIG
    );

    expect(result.events.map((event) => event.type)).toEqual([
      'royalist-battle-resolved',
      'game-won'
    ]);
    expect(result.events[0]).toMatchObject({
      type: 'royalist-battle-resolved',
      fromProvinceIds: ['1'],
      targetProvinceId: '2',
      attackingSoldiers: 49,
      result: { winner: 'attacker' }
    });
    expect(Object.fromEntries(
      result.state.map.provinces.map((province) => [province.id, province.ownerId])
    )).toEqual(
      expectedOwnersByProvince(
        fixture.observed.afterHomeCastleCapture.ownersC5daToC5de
      )
    );
    expect(soldiersByProvince(result.state)).toEqual(
      expectedSoldiersByProvince(
        fixture.observed.afterHomeCastleCapture.soldiersLowC706ToC70a
      )
    );
    expect(result.state.phase).toBe('game-over');
    expect(result.state.winnerId).toBe(ROYALIST_OWNER_ID);
    expect(result.state.players.find((player) => player.id === 'p1')?.homeProvinceId).toBe('2');
  });

  it('matches C64 main:L337A hostile home-castle world-pass fixture', () => {
    const fixture = loadHostileWorldPassFixture();
    const finalPhase = requiredHostileWorldPassPhase(fixture, 'stub:$C003');
    const result = runRoyalistWorldPhase(
      hostileWorldPassState(fixture),
      C64_HOSTILE_WORLD_PASS_CONFIG
    );

    expect(result.events.map((event) => event.type)).toEqual([
      'royalist-battle-resolved',
      'game-won'
    ]);
    expect(result.events[0]).toMatchObject({
      type: 'royalist-battle-resolved',
      fromProvinceIds: ['1'],
      targetProvinceId: '2',
      attackingSoldiers: 49,
      result: { winner: 'attacker' }
    });
    expect(Object.fromEntries(
      result.state.map.provinces.map((province) => [province.id, province.ownerId])
    )).toEqual(expectedOwnersByProvince(finalPhase.observed.ownersC5daToC5de));
    expect(soldiersByProvince(result.state)).toEqual(
      expectedSoldiersByProvince(finalPhase.observed.soldiersLowC706ToC70a)
    );
    expect(villagesByProvince(result.state)).toEqual(
      expectedProvinceValuesFromHex(finalPhase.observed.villagesC6a3ToC6a6)
    );
    expect(royalistVillageBucketsByProvince(result.state)).toEqual(
      expectedProvinceValuesFromHexWithDummyZero(finalPhase.observed.villageBucketsC902ToC906)
    );
    expect(royalistFortBucketsByProvince(result.state)).toEqual(
      expectedProvinceValuesFromHexWithDummyZero(finalPhase.observed.fortBucketsC966ToC96a)
    );
    expect(result.state.phase).toBe('game-over');
    expect(result.state.winnerId).toBe(ROYALIST_OWNER_ID);
    expect(result.state.players.find((player) => player.id === 'p1')?.homeProvinceId).toBe('2');
  });

  it('matches C64 main:L337A hostile non-home world-pass fixture', () => {
    const fixture = loadHostileWorldPassFixture('main-l337a-hostile-nonhome-world-pass.json');
    const finalPhase = requiredHostileWorldPassPhase(fixture, 'stub:$C003');
    const result = runRoyalistWorldPhase(
      hostileWorldPassState(fixture),
      C64_HOSTILE_WORLD_PASS_CONFIG
    );

    expect(result.events.map((event) => event.type)).toEqual([
      'royalist-battle-resolved'
    ]);
    expect(result.events[0]).toMatchObject({
      type: 'royalist-battle-resolved',
      fromProvinceIds: ['1'],
      targetProvinceId: '2',
      attackingSoldiers: 49,
      result: { winner: 'attacker' }
    });
    expect(Object.fromEntries(
      result.state.map.provinces.map((province) => [province.id, province.ownerId])
    )).toEqual(expectedOwnersByProvince(finalPhase.observed.ownersC5daToC5de));
    expect(soldiersByProvince(result.state)).toEqual(
      expectedSoldiersByProvince(finalPhase.observed.soldiersLowC706ToC70a)
    );
    expect(villagesByProvince(result.state)).toEqual(
      expectedProvinceValuesFromHex(finalPhase.observed.villagesC6a3ToC6a6)
    );
    expect(royalistVillageBucketsByProvince(result.state)).toEqual(
      expectedProvinceValuesFromHexWithDummyZero(finalPhase.observed.villageBucketsC902ToC906)
    );
    expect(royalistFortBucketsByProvince(result.state)).toEqual(
      expectedProvinceValuesFromHexWithDummyZero(finalPhase.observed.fortBucketsC966ToC96a)
    );
    expect(result.state.phase).toBe('turn');
    expect(result.state.winnerId).toBeNull();
    expect(result.state.players.find((player) => player.id === 'p1')?.homeProvinceId).toBe('4');
  });

  it('matches C64 main:L3312 hostile home-castle world-pass fixture', () => {
    const fixture = loadHostileTurnOwnerWorldPassFixture();
    const finalPhase = requiredHostileTurnOwnerWorldPassPhase(fixture, 'stub:$C003');
    const result = applyPlayerAction(
      hostileWorldPassState(fixture),
      'p1',
      { type: 'advance-step' },
      C64_HOSTILE_WORLD_PASS_CONFIG
    );

    expect(result.events.map((event) => event.type)).toEqual([
      'turn-step-advanced',
      'turn-ended',
      'royalist-battle-resolved',
      'game-won'
    ]);
    expect(finalPhase.observed.resultCodeCA75).toBe('0x02');
    expect(result.events[2]).toMatchObject({
      type: 'royalist-battle-resolved',
      fromProvinceIds: ['1'],
      targetProvinceId: '2',
      attackingSoldiers: 49,
      result: { winner: 'attacker' }
    });
    expect(Object.fromEntries(
      result.state.map.provinces.map((province) => [province.id, province.ownerId])
    )).toEqual(expectedOwnersByProvince(finalPhase.observed.ownersC5daToC5de));
    expect(soldiersByProvince(result.state)).toEqual(
      expectedSoldiersByProvince(finalPhase.observed.soldiersLowC706ToC70a)
    );
    expect(villagesByProvince(result.state)).toEqual(
      expectedProvinceValuesFromHex(finalPhase.observed.villagesC6a3ToC6a6)
    );
    expect(royalistVillageBucketsByProvince(result.state)).toEqual(
      expectedProvinceValuesFromHexWithDummyZero(finalPhase.observed.villageBucketsC902ToC906)
    );
    expect(royalistFortBucketsByProvince(result.state)).toEqual(
      expectedProvinceValuesFromHexWithDummyZero(finalPhase.observed.fortBucketsC966ToC96a)
    );
    expect(result.state.phase).toBe('game-over');
    expect(result.state.winnerId).toBe(ROYALIST_OWNER_ID);
    expect(result.state.players.find((player) => player.id === 'p1')?.homeProvinceId).toBe('2');
  });

  it('matches C64 main:L3312 hostile non-home world-pass fixture', () => {
    const fixture = loadHostileTurnOwnerWorldPassFixture('main-l3312-hostile-nonhome-world-pass.json');
    const finalPhase = requiredHostileTurnOwnerWorldPassPhase(fixture, 'stub:$C003');
    const result = applyPlayerAction(
      hostileWorldPassState(fixture),
      'p1',
      { type: 'advance-step' },
      C64_HOSTILE_WORLD_PASS_CONFIG
    );

    expect(result.events.map((event) => event.type)).toEqual([
      'turn-step-advanced',
      'turn-ended',
      'royalist-battle-resolved'
    ]);
    expect(finalPhase.observed.resultCodeCA75).toBe('0x00');
    expect(result.events[2]).toMatchObject({
      type: 'royalist-battle-resolved',
      fromProvinceIds: ['1'],
      targetProvinceId: '2',
      attackingSoldiers: 49,
      result: { winner: 'attacker' }
    });
    expect(Object.fromEntries(
      result.state.map.provinces.map((province) => [province.id, province.ownerId])
    )).toEqual(expectedOwnersByProvince(finalPhase.observed.ownersC5daToC5de));
    expect(soldiersByProvince(result.state)).toEqual(
      expectedSoldiersByProvince(finalPhase.observed.soldiersLowC706ToC70a)
    );
    expect(villagesByProvince(result.state)).toEqual(
      expectedProvinceValuesFromHex(finalPhase.observed.villagesC6a3ToC6a6)
    );
    expect(royalistVillageBucketsByProvince(result.state)).toEqual(
      expectedProvinceValuesFromHexWithDummyZero(finalPhase.observed.villageBucketsC902ToC906)
    );
    expect(royalistFortBucketsByProvince(result.state)).toEqual(
      expectedProvinceValuesFromHexWithDummyZero(finalPhase.observed.fortBucketsC966ToC96a)
    );
    expect(result.state.phase).toBe('turn');
    expect(result.state.winnerId).toBeNull();
    expect(result.state.activePlayerId).toBe('p1');
    expect(result.state.players.find((player) => player.id === 'p1')?.homeProvinceId).toBe('4');
  });

  it('matches C64 main:L3312 hostile home-castle skip-eliminated-player fixture', () => {
    const fixture = loadHostileTurnOwnerWorldPassFixture(
      'main-l3312-hostile-home-castle-skip-p1-world-pass.json'
    );
    const finalPhase = requiredHostileTurnOwnerWorldPassPhase(fixture, 'stub:$C003');
    const result = applyPlayerAction(
      hostileWorldPassState(fixture),
      'p2',
      { type: 'advance-step' },
      C64_HOSTILE_WORLD_PASS_CONFIG
    );

    expect(result.events.map((event) => event.type)).toEqual([
      'turn-step-advanced',
      'turn-ended',
      'royalist-battle-resolved'
    ]);
    expect(finalPhase.observed.resultCodeCA75).toBe('0x00');
    expect(result.events[2]).toMatchObject({
      type: 'royalist-battle-resolved',
      defenderId: 'p1',
      fromProvinceIds: ['1'],
      targetProvinceId: '2',
      attackingSoldiers: 49,
      result: { winner: 'attacker' }
    });
    expect(Object.fromEntries(
      result.state.map.provinces.map((province) => [province.id, province.ownerId])
    )).toEqual(expectedOwnersByProvince(finalPhase.observed.ownersC5daToC5de));
    expect(soldiersByProvince(result.state)).toEqual(
      expectedSoldiersByProvince(finalPhase.observed.soldiersLowC706ToC70a)
    );
    expect(villagesByProvince(result.state)).toEqual(
      expectedProvinceValuesFromHex(finalPhase.observed.villagesC6a3ToC6a6)
    );
    expect(royalistVillageBucketsByProvince(result.state)).toEqual(
      expectedProvinceValuesFromHexWithDummyZero(finalPhase.observed.villageBucketsC902ToC906)
    );
    expect(royalistFortBucketsByProvince(result.state)).toEqual(
      expectedProvinceValuesFromHexWithDummyZero(finalPhase.observed.fortBucketsC966ToC96a)
    );
    expect(result.state.phase).toBe('turn');
    expect(result.state.winnerId).toBeNull();
    expect(result.state.activePlayerId).toBe('p2');
    expect(result.state.players.find((player) => player.id === 'p1')?.homeProvinceId).toBe('2');
    expect(result.state.players.find((player) => player.id === 'p2')?.homeProvinceId).toBe('5');
  });

  it('matches C64 main:$5209 bucket production and post-pass interest fixture', () => {
    const result = runRoyalistWorldPhase(royalistProductionState(), ROYALIST_PRODUCTION_CONFIG);

    expect(provinceById(result.state, 'r1')).toMatchObject({ villages: 3, soldiers: 3 });
    expect(provinceById(result.state, 'r2')).toMatchObject({ villages: 2, soldiers: 4 });
    expect(result.state.c64.royalistProvinceMemory).toEqual([
      { provinceId: 'r1', villageInvestmentBucket: 0, fortificationInvestmentBucket: 0 },
      { provinceId: 'r2', villageInvestmentBucket: 1, fortificationInvestmentBucket: 19 }
    ]);
  });

  it('matches C64 owner-0 production then distribution world-pass transcript', () => {
    const fixture = loadOwner0WorldPassFixture();
    const finalPhase = requiredOwner0WorldPassPhase(fixture, 'main:$50D3');
    const result = runRoyalistWorldPhase(
      owner0WorldPassState(fixture),
      OWNER0_WORLD_PASS_CONFIG
    );

    expect(result.events).toEqual([]);
    expect(soldiersByProvince(result.state)).toMatchObject(finalPhase.observed.soldiersByProvince);
    expect(villagesByProvince(result.state)).toMatchObject(finalPhase.observed.villagesByProvince);
    expect(fortificationsByProvince(result.state)).toMatchObject(
      finalPhase.observed.fortificationsByProvince
    );
    expect(result.state.c64.royalistProvinceMemory).toEqual(
      Object.keys(finalPhase.observed.villageBucketsByProvince).map((provinceId) => ({
        provinceId,
        villageInvestmentBucket: requiredFixtureNumber(
          finalPhase.observed.villageBucketsByProvince,
          provinceId,
          'final village bucket'
        ),
        fortificationInvestmentBucket: requiredFixtureNumber(
          finalPhase.observed.fortBucketsByProvince,
          provinceId,
          'final fort bucket'
        )
      }))
    );
  });

  it('matches C64 main:$5209 first fort upgrade fixture', () => {
    const result = runRoyalistWorldPhase(
      royalistFortProductionState('none'),
      ROYALIST_PRODUCTION_NO_INTEREST_CONFIG
    );

    expect(provinceById(result.state, 'r1')).toMatchObject({
      fortificationLevel: 'watchtower',
      soldiers: 3
    });
    expect(result.state.c64.royalistProvinceMemory).toEqual([
      { provinceId: 'r1', villageInvestmentBucket: 1, fortificationInvestmentBucket: 0 }
    ]);
  });

  it('matches C64 main:$5209 blocked max fort bucket conversion fixture', () => {
    const result = runRoyalistWorldPhase(
      royalistFortProductionState('watchtower'),
      ROYALIST_PRODUCTION_NO_INTEREST_CONFIG
    );

    expect(provinceById(result.state, 'r1')).toMatchObject({
      fortificationLevel: 'watchtower',
      soldiers: 23
    });
    expect(result.state.c64.royalistProvinceMemory).toEqual([
      { provinceId: 'r1', villageInvestmentBucket: 1, fortificationInvestmentBucket: 0 }
    ]);
  });

  it('matches C64 main:$5209 equality-only max check for a captured citadel', () => {
    const result = runRoyalistWorldPhase(
      royalistFortProductionState('citadel'),
      ROYALIST_PRODUCTION_NO_INTEREST_CONFIG
    );

    expect(provinceById(result.state, 'r1')).toMatchObject({
      fortificationLevel: 'c64-level-7'
    });
    expect(result.state.c64.royalistProvinceMemory).toEqual([
      { provinceId: 'r1', villageInvestmentBucket: 1, fortificationInvestmentBucket: 20 }
    ]);
  });

  it('attacks player provinces from adjacent owner-0 C64 royalist provinces', () => {
    const result = runRoyalistWorldPhase(royalistState(), HOSTILE_ROYALISTS_CONFIG);
    const source = result.state.map.provinces.find((province) => province.id === 'royalist-source');
    const target = result.state.map.provinces.find((province) => province.id === 'baron-target');

    expect(source?.soldiers).toBe(4);
    expect(target?.ownerId).toBe(ROYALIST_OWNER_ID);
    expect(target?.soldiers).toBeGreaterThan(0);
    expect(result.state.phase).toBe('turn');
    expect(result.state.activePlayerId).toBe('p2');
    expect(result.state.winnerId).toBeNull();
    expect(result.state.players.find((player) => player.id === 'p1')?.homeProvinceId).toBe('baron-target');
    expect(result.events).toHaveLength(1);
    expect(result.events[0]).toMatchObject({
      type: 'royalist-battle-resolved',
      defenderId: 'p1',
      fromProvinceIds: ['royalist-source'],
      targetProvinceId: 'baron-target',
      attackingSoldiers: 7,
      result: { winner: 'attacker' }
    });
  });

  it('transfers every defeated player province to owner 0 after royalist home-castle capture', () => {
    const base = royalistState();
    const result = runRoyalistWorldPhase(
      testGameState({
        ...base,
        map: {
          ...base.map,
          provinces: [
            testProvince({
              id: 'royalist-source',
              terrainId: 'plains',
              ownerId: ROYALIST_OWNER_ID,
              villages: 2,
              soldiers: 8,
              neighbours: ['baron-target']
            }),
            testProvince({
              id: 'baron-target',
              terrainId: 'plains',
              ownerId: 'p1',
              villages: 2,
              soldiers: 3,
              fortificationLevel: 'castle',
              neighbours: ['royalist-source', 'p1-field']
            }),
            testProvince({
              id: 'p1-field',
              terrainId: 'forest',
              ownerId: 'p1',
              villages: 4,
              soldiers: 11,
              fortificationLevel: 'watchtower',
              neighbours: ['baron-target']
            }),
            testProvince({
              id: 'p2-home',
              terrainId: 'plains',
              ownerId: 'p2',
              villages: 2,
              soldiers: 20,
              neighbours: []
            })
          ]
        }
      }),
      HOSTILE_ROYALISTS_CONFIG
    );
    const target = result.state.map.provinces.find((province) => province.id === 'baron-target');
    const field = result.state.map.provinces.find((province) => province.id === 'p1-field');

    expect(result.state.players.find((player) => player.id === 'p1')?.homeProvinceId).toBe('baron-target');
    expect(target?.ownerId).toBe(ROYALIST_OWNER_ID);
    expect(field?.ownerId).toBe(ROYALIST_OWNER_ID);
    expect(field?.soldiers).toBe(15);
    expect(field?.fortificationLevel).toBe('watchtower');
    expect(result.state.phase).toBe('turn');
    expect(result.state.activePlayerId).toBe('p2');
    expect(result.state.winnerId).toBeNull();
    expect(result.events.map((event) => event.type)).toEqual([
      'royalist-battle-resolved'
    ]);
  });

  it('runs after the last player before the next round starts', () => {
    const result = applyPlayerAction(
      royalistState('p2'),
      'p2',
      { type: 'advance-step' },
      HOSTILE_ROYALISTS_CONFIG
    );
    const target = result.state.map.provinces.find((province) => province.id === 'baron-target');

    expect(result.state.phase).toBe('turn');
    expect(result.state.activePlayerId).toBe('p2');
    expect(result.state.winnerId).toBeNull();
    expect(result.state.turnNumber).toBe(2);
    expect(target?.ownerId).toBe(ROYALIST_OWNER_ID);
    expect(result.events.map((event) => event.type)).toEqual([
      'turn-step-advanced',
      'turn-ended',
      'royalist-battle-resolved'
    ]);
  });

  it('uses C64 royalist cooperation option to collect one or all adjacent sources', () => {
    const singleSource = runRoyalistWorldPhase(
      royalistCooperationState(),
      HOSTILE_ROYALISTS_CONFIG
    );
    const combinedSources = runRoyalistWorldPhase(
      royalistCooperationState(),
      COMBINED_HOSTILE_ROYALISTS_CONFIG
    );

    expect(singleSource.events).toEqual([]);
    expect(combinedSources.events[0]).toMatchObject({
      type: 'royalist-battle-resolved',
      fromProvinceIds: ['royalist-high', 'royalist-low'],
      attackingSoldiers: 9
    });
  });

  it('uses C64 royalist threshold option for loose versus strict attack acceptance', () => {
    const strict = runRoyalistWorldPhase(royalistThresholdState(), HOSTILE_ROYALISTS_CONFIG);
    const loose = runRoyalistWorldPhase(royalistThresholdState(), LOOSE_HOSTILE_ROYALISTS_CONFIG);

    expect(strict.events).toEqual([]);
    expect(loose.events[0]).toMatchObject({
      type: 'royalist-battle-resolved',
      attackingSoldiers: 9
    });
  });

  it('redistributes royalist soldiers equally over each connected component', () => {
    const result = runRoyalistWorldPhase(royalistDistributionState(), EQUAL_DISTRIBUTION_CONFIG);

    expect(result.events).toEqual([]);
    expect(soldiersByProvince(result.state)).toEqual({
      r1: 4,
      r2: 4,
      r3: 4,
      'p1-land': 1
    });
  });

  it('redistributes royalist soldiers only to frontier provinces in border mode', () => {
    const result = runRoyalistWorldPhase(royalistDistributionState(), FRONTIER_DISTRIBUTION_CONFIG);

    expect(result.events).toEqual([]);
    expect(soldiersByProvince(result.state)).toEqual({
      r1: 1,
      r2: 1,
      r3: 10,
      'p1-land': 1
    });
  });

  it('processes disconnected royalist components independently', () => {
    const result = runRoyalistWorldPhase(
      royalistMultiComponentDistributionState(),
      EQUAL_DISTRIBUTION_CONFIG
    );

    expect(result.events).toEqual([]);
    expect(soldiersByProvince(result.state)).toEqual({
      r1: 2,
      r2: 3,
      'p1-land': 1,
      r4: 8,
      r5: 9
    });
  });
});
