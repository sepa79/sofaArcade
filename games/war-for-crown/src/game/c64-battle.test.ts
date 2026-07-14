import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { TERRAIN_IDS } from './constants';
import {
  c64BattleFinishSoldiers,
  c64BattleRound,
  c64CombatSetup,
  c64FortificationLevelForFortificationLevel,
  C64_TERRAIN_IDS,
  c64DefenderHitDenominator,
  c64DefenderTerrainCombatAdd,
  c64TerrainIdForTerrainId
} from './c64-battle';
import type { FortificationLevel } from './types';

interface RngPatchFixture {
  readonly bytes: ReadonlyArray<string>;
}

interface C64RoundInputFixture {
  readonly attackerSoldiers: number;
  readonly defenderSoldiers: number;
  readonly attackerCombatPercent?: number;
  readonly defenderCombatPercent?: number;
  readonly attackerHitDenominator?: number;
  readonly defenderHitDenominator?: number;
  readonly c64TerrainId?: 7;
  readonly fortification?: 6;
  readonly rngPatch: RngPatchFixture;
}

interface C64RoundFixture {
  readonly initialState?: C64RoundInputFixture;
  readonly input?: C64RoundInputFixture;
  readonly observed?: {
    readonly attackerSoldiersAfterRound: number;
    readonly defenderSoldiersAfterRound: number;
    readonly defenderHitsAgainstAttacker?: {
      readonly low: number;
    };
    readonly attackerHitsAgainstDefender?: {
      readonly low: number;
    };
  };
  readonly expected?: {
    readonly attackerSoldiersAfterRound: number;
    readonly defenderSoldiersAfterRound: number;
  };
}

interface NormalizedRoundInput {
  readonly attackerSoldiers: number;
  readonly defenderSoldiers: number;
  readonly attackerCombatPercent: number;
  readonly defenderCombatPercent: number;
  readonly attackerHitDenominator: number;
  readonly defenderHitDenominator: number;
  readonly rngPatch: RngPatchFixture;
}

interface NormalizedRoundExpected {
  readonly attackerSoldiersAfterRound: number;
  readonly defenderSoldiersAfterRound: number;
  readonly defenderHitsAgainstAttacker: number | null;
  readonly attackerHitsAgainstDefender: number | null;
}

interface C64CombatSetupFixture {
  readonly initialState: {
    readonly c64TerrainId: 7;
    readonly fortification: 6;
  };
  readonly observed: {
    readonly attackerCombatPercent: number;
    readonly defenderCombatPercent: number;
    readonly attackerHitDenominator: number;
    readonly defenderHitDenominator: number;
  };
}

function loadFixture<T>(fileName: string): T {
  return JSON.parse(
    readFileSync(
      new URL(`../../../../docs/war-for-crown/fixtures/${fileName}`, import.meta.url),
      'utf8'
    )
  ) as T;
}

function parseHexByte(value: string): number {
  return Number.parseInt(value.slice(2), 16);
}

function rngByteFromPatch(rngPatch: RngPatchFixture): number {
  const rngByte = rngPatch.bytes[1];
  if (rngByte === undefined) {
    throw new Error('Fixture RNG patch does not contain an immediate byte.');
  }
  return parseHexByte(rngByte);
}

function normalizeRoundInput(fileName: string, fixture: C64RoundFixture): NormalizedRoundInput {
  const input = fixture.initialState ?? fixture.input;
  if (input === undefined) {
    throw new Error(`Fixture ${fileName} does not contain round input.`);
  }

  if (
    input.attackerCombatPercent !== undefined &&
    input.defenderCombatPercent !== undefined &&
    input.attackerHitDenominator !== undefined &&
    input.defenderHitDenominator !== undefined
  ) {
    return {
      attackerSoldiers: input.attackerSoldiers,
      defenderSoldiers: input.defenderSoldiers,
      attackerCombatPercent: input.attackerCombatPercent,
      defenderCombatPercent: input.defenderCombatPercent,
      attackerHitDenominator: input.attackerHitDenominator,
      defenderHitDenominator: input.defenderHitDenominator,
      rngPatch: input.rngPatch
    };
  }

  if (input.c64TerrainId === undefined || input.fortification === undefined) {
    throw new Error(`Fixture ${fileName} has no direct combat fields or setup fields.`);
  }

  const setup = c64CombatSetup({
    terrainId: input.c64TerrainId,
    fortificationLevel: input.fortification,
    terrainInfluence: 'both',
    attackerFullRuleBonus: 0,
    defenderFullRuleBonus: 0
  });

  return {
    attackerSoldiers: input.attackerSoldiers,
    defenderSoldiers: input.defenderSoldiers,
    attackerCombatPercent: setup.attackerCombatPercent,
    defenderCombatPercent: setup.defenderCombatPercent,
    attackerHitDenominator: setup.attackerHitDenominator,
    defenderHitDenominator: setup.defenderHitDenominator,
    rngPatch: input.rngPatch
  };
}

function normalizeRoundExpected(fileName: string, fixture: C64RoundFixture): NormalizedRoundExpected {
  const expected = fixture.observed ?? fixture.expected;
  if (expected === undefined) {
    throw new Error(`Fixture ${fileName} does not contain round expectations.`);
  }

  return {
    attackerSoldiersAfterRound: expected.attackerSoldiersAfterRound,
    defenderSoldiersAfterRound: expected.defenderSoldiersAfterRound,
    defenderHitsAgainstAttacker: fixture.observed?.defenderHitsAgainstAttacker?.low ?? null,
    attackerHitsAgainstDefender: fixture.observed?.attackerHitsAgainstDefender?.low ?? null
  };
}

describe('c64 battle terrain adapter', () => {
  it('maps current terrain ids to recovered C64 terrain ids', () => {
    expect(TERRAIN_IDS.map((terrainId) => [terrainId, c64TerrainIdForTerrainId(terrainId)])).toEqual([
      ['plains', 1],
      ['desert', 2],
      ['brushland', 3],
      ['forest', 4],
      ['hills', 5],
      ['marshland', 6],
      ['mountains', 7]
    ]);
  });

  it('covers every C64 land terrain id once', () => {
    const c64TerrainIds = TERRAIN_IDS.map(c64TerrainIdForTerrainId);

    expect(c64TerrainIds).toHaveLength(C64_TERRAIN_IDS.length);
    expect(new Set(c64TerrainIds)).toEqual(new Set(C64_TERRAIN_IDS));
  });

  it('maps fortification ids to recovered C64 byte order', () => {
    const fortificationLevels = [
      'none',
      'watchtower',
      'fort',
      'castle',
      'stronghold',
      'fortress',
      'citadel'
    ] satisfies ReadonlyArray<FortificationLevel>;

    expect(fortificationLevels.map((fortificationLevel) =>
      c64FortificationLevelForFortificationLevel(fortificationLevel)
    )).toEqual([0, 1, 2, 3, 4, 5, 6]);
    expect(c64FortificationLevelForFortificationLevel('c64-level-7')).toBe(7);
  });

  it('reads the adjacent C64 memory bytes used by raw fortification level 7', () => {
    expect(c64CombatSetup({
      terrainId: 1,
      fortificationLevel: 7,
      terrainInfluence: 'both',
      attackerFullRuleBonus: 0,
      defenderFullRuleBonus: 0
    })).toMatchObject({
      attackerCombatPercent: 0,
      defenderCombatPercent: 25,
      attackerHitDenominator: 240,
      defenderHitDenominator: 10
    });
  });

  it('reads recovered C64 terrain combat tables through the adapter', () => {
    expect(
      Object.fromEntries(
        TERRAIN_IDS.map((terrainId) => [
          terrainId,
          {
            defenderCombatAdd: c64DefenderTerrainCombatAdd(terrainId),
            defenderHitDenominator: c64DefenderHitDenominator(terrainId)
          }
        ])
      )
    ).toEqual({
      plains: {
        defenderCombatAdd: 25,
        defenderHitDenominator: 10
      },
      desert: {
        defenderCombatAdd: 25,
        defenderHitDenominator: 10
      },
      brushland: {
        defenderCombatAdd: 30,
        defenderHitDenominator: 10
      },
      forest: {
        defenderCombatAdd: 35,
        defenderHitDenominator: 10
      },
      hills: {
        defenderCombatAdd: 40,
        defenderHitDenominator: 10
      },
      marshland: {
        defenderCombatAdd: 45,
        defenderHitDenominator: 15
      },
      mountains: {
        defenderCombatAdd: 50,
        defenderHitDenominator: 15
      }
    });
  });

  it('matches recovered C64 combat setup for high fortification and mountains', () => {
    const fixture = loadFixture<C64CombatSetupFixture>('kampf-round-20v6-terrain7-fort6-rng7b.json');
    const setup = c64CombatSetup({
      terrainId: fixture.initialState.c64TerrainId,
      fortificationLevel: fixture.initialState.fortification,
      terrainInfluence: 'both',
      attackerFullRuleBonus: 0,
      defenderFullRuleBonus: 0
    });

    expect(setup).toMatchObject({
      attackerCombatPercent: fixture.observed.attackerCombatPercent,
      defenderCombatPercent: fixture.observed.defenderCombatPercent,
      attackerHitDenominator: fixture.observed.attackerHitDenominator,
      defenderHitDenominator: fixture.observed.defenderHitDenominator
    });
  });

  it.each([
    'kampf-round-20v6-terrain4-fort0-rng7b.json',
    'kampf-round-1v1-min-hit-rng00.json',
    'kampf-round-20v1-defender-clamp-rng7b.json',
    'kampf-round-20v6-terrain7-fort6-rng7b.json',
    'kampf-round-300v300-multibyte-rng7b.json'
  ])('matches recovered C64 combat round fixture %s', (fileName) => {
    const fixture = loadFixture<C64RoundFixture>(fileName);
    const input = normalizeRoundInput(fileName, fixture);

    const rngByte = rngByteFromPatch(input.rngPatch);
    const round = c64BattleRound({
      attackerSoldiers: input.attackerSoldiers,
      defenderSoldiers: input.defenderSoldiers,
      attackerCombatPercent: input.attackerCombatPercent,
      defenderCombatPercent: input.defenderCombatPercent,
      attackerHitDenominator: input.attackerHitDenominator,
      defenderHitDenominator: input.defenderHitDenominator,
      defenderRngByte: rngByte,
      attackerRngByte: rngByte
    });
    const expected = normalizeRoundExpected(fileName, fixture);

    expect(round.attackerSoldiers).toBe(expected.attackerSoldiersAfterRound);
    expect(round.defenderSoldiers).toBe(expected.defenderSoldiersAfterRound);

    if (expected.defenderHitsAgainstAttacker !== null) {
      expect(round.defenderHitsAgainstAttacker).toBe(expected.defenderHitsAgainstAttacker);
    }
    if (expected.attackerHitsAgainstDefender !== null) {
      expect(round.attackerHitsAgainstDefender).toBe(expected.attackerHitsAgainstDefender);
    }
  });

  it('matches C64 finish behavior when a round removes both armies', () => {
    expect(c64BattleFinishSoldiers({ attackerSoldiers: 0, defenderSoldiers: 0 })).toEqual({
      attackerSoldiers: 0,
      defenderSoldiers: 1
    });
    expect(c64BattleFinishSoldiers({ attackerSoldiers: 3, defenderSoldiers: 0 })).toEqual({
      attackerSoldiers: 3,
      defenderSoldiers: 0
    });
  });
});
