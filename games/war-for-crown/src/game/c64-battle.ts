import type {
  BattleRoundResult,
  FortificationLevel,
  GameConfig,
  TerrainId,
  TerrainInfluence
} from './types';
import { fortificationIndex } from './rules';

export type C64TerrainId = 1 | 2 | 3 | 4 | 5 | 6 | 7;
export type C64FortificationLevel = number;

export const C64_TERRAIN_IDS: ReadonlyArray<C64TerrainId> = [1, 2, 3, 4, 5, 6, 7];
export const C64_FORTIFICATION_LEVELS: ReadonlyArray<C64FortificationLevel> = [0, 1, 2, 3, 4, 5, 6];

export const C64_TERRAIN_ID_BY_TERRAIN_ID: Readonly<Record<TerrainId, C64TerrainId>> = {
  plains: 1,
  desert: 2,
  brushland: 3,
  forest: 4,
  hills: 5,
  marshland: 6,
  mountains: 7
};

const TERRAIN_ID_BY_C64_TERRAIN_ID: Readonly<Record<C64TerrainId, TerrainId>> = {
  1: 'plains',
  2: 'desert',
  3: 'brushland',
  4: 'forest',
  5: 'hills',
  6: 'marshland',
  7: 'mountains'
};

export const C64_FORTIFICATION_LEVEL_BY_FORTIFICATION_LEVEL: Readonly<
  Partial<Record<FortificationLevel, C64FortificationLevel>>
> = {
  none: 0,
  watchtower: 1,
  fort: 2,
  castle: 3,
  stronghold: 4,
  fortress: 5,
  citadel: 6
};

export const C64_ATTACKER_COMBAT_PERCENT_BY_FORTIFICATION_LEVEL: Readonly<
  Record<C64FortificationLevel, number>
> = {
  0: 25,
  1: 18,
  2: 16,
  3: 14,
  4: 12,
  5: 10,
  6: 8,
  7: 0
};

export const C64_DEFENDER_COMBAT_PERCENT_BY_FORTIFICATION_LEVEL: Readonly<
  Record<C64FortificationLevel, number>
> = {
  0: 0,
  1: 12,
  2: 18,
  3: 25,
  4: 37,
  5: 50,
  6: 75,
  7: 0
};

export const C64_DEFENDER_TERRAIN_COMBAT_ADD_BY_TERRAIN_ID: Readonly<
  Record<C64TerrainId, number>
> = {
  1: 25,
  2: 25,
  3: 30,
  4: 35,
  5: 40,
  6: 45,
  7: 50
};

export const C64_DEFENDER_HIT_DENOMINATOR_BY_TERRAIN_ID: Readonly<
  Record<C64TerrainId, number>
> = {
  1: 10,
  2: 10,
  3: 10,
  4: 10,
  5: 10,
  6: 15,
  7: 15
};

export const C64_ATTACKER_HIT_DENOMINATOR_ADD_BY_FORTIFICATION_LEVEL: Readonly<
  Record<C64FortificationLevel, number>
> = {
  0: 0,
  1: 5,
  2: 10,
  3: 15,
  4: 20,
  5: 25,
  6: 30,
  7: 230
};

export interface C64CombatSetupInput {
  readonly terrainId: C64TerrainId;
  readonly fortificationLevel: C64FortificationLevel;
  readonly terrainInfluence: TerrainInfluence;
  readonly attackerFullRuleBonus: number;
  readonly defenderFullRuleBonus: number;
}

export interface C64CombatSetup {
  readonly attackerCombatPercent: number;
  readonly defenderCombatPercent: number;
  readonly attackerHitDenominator: number;
  readonly defenderHitDenominator: number;
  readonly c64TerrainId: C64TerrainId;
  readonly c64FortificationLevel: C64FortificationLevel;
}

export interface C64BattleRoundInput {
  readonly attackerSoldiers: number;
  readonly defenderSoldiers: number;
  readonly attackerCombatPercent: number;
  readonly defenderCombatPercent: number;
  readonly attackerHitDenominator: number;
  readonly defenderHitDenominator: number;
  readonly defenderRngByte: number;
  readonly attackerRngByte: number;
}

export interface C64BattleRoundResult extends BattleRoundResult {
  readonly defenderHitsAgainstAttacker: number;
  readonly attackerHitsAgainstDefender: number;
}

export interface C64BattleFinishSoldiers {
  readonly attackerSoldiers: number;
  readonly defenderSoldiers: number;
}

function requirePositiveInteger(value: number, label: string): void {
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`${label} must be a positive integer, got ${value}.`);
  }
}

function requireNonNegativeInteger(value: number, label: string): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative integer, got ${value}.`);
  }
}

function requireByte(value: number, label: string): void {
  if (!Number.isInteger(value) || value < 0 || value > 0xff) {
    throw new Error(`${label} must be an integer from 0 to 255, got ${value}.`);
  }
}

export function c64TerrainIdForTerrainId(terrainId: TerrainId): C64TerrainId {
  const c64TerrainId = C64_TERRAIN_ID_BY_TERRAIN_ID[terrainId];
  if (c64TerrainId === undefined) {
    throw new Error(`Missing C64 terrain mapping for terrain ${terrainId}.`);
  }
  return c64TerrainId;
}

export function terrainIdForC64TerrainId(c64TerrainId: number): TerrainId {
  if (!C64_TERRAIN_IDS.includes(c64TerrainId as C64TerrainId)) {
    throw new Error(`C64 terrain id must be 1..7, got ${c64TerrainId}.`);
  }
  return TERRAIN_ID_BY_C64_TERRAIN_ID[c64TerrainId as C64TerrainId];
}

export function c64FortificationLevelForFortificationLevel(
  fortificationLevel: FortificationLevel
): C64FortificationLevel {
  const c64FortificationLevel = C64_FORTIFICATION_LEVEL_BY_FORTIFICATION_LEVEL[fortificationLevel];
  if (c64FortificationLevel !== undefined) {
    return c64FortificationLevel;
  }
  return fortificationIndex(fortificationLevel);
}

export function c64DefenderTerrainCombatAdd(terrainId: TerrainId): number {
  return C64_DEFENDER_TERRAIN_COMBAT_ADD_BY_TERRAIN_ID[c64TerrainIdForTerrainId(terrainId)];
}

export function c64DefenderHitDenominator(terrainId: TerrainId): number {
  return C64_DEFENDER_HIT_DENOMINATOR_BY_TERRAIN_ID[c64TerrainIdForTerrainId(terrainId)];
}

export function c64RandomModuloPlusTwo(max: number, rngByte: number): number {
  requirePositiveInteger(max, 'C64 random modulo max');
  requireByte(rngByte, 'C64 RNG byte');
  return (rngByte % max) + 2;
}

export function c64CombatSetup(input: C64CombatSetupInput): C64CombatSetup {
  requireNonNegativeInteger(input.attackerFullRuleBonus, 'C64 attacker full-rule battle bonus');
  requireNonNegativeInteger(input.defenderFullRuleBonus, 'C64 defender full-rule battle bonus');

  const terrainIndex = input.terrainInfluence === 'combat' || input.terrainInfluence === 'both'
    ? input.terrainId
    : 1;
  const defenderHitDenominator = C64_DEFENDER_HIT_DENOMINATOR_BY_TERRAIN_ID[terrainIndex];
  const attackerCombatPercent =
    C64_ATTACKER_COMBAT_PERCENT_BY_FORTIFICATION_LEVEL[input.fortificationLevel];
  const defenderFortificationCombatPercent =
    C64_DEFENDER_COMBAT_PERCENT_BY_FORTIFICATION_LEVEL[input.fortificationLevel];
  const attackerHitDenominatorAdd =
    C64_ATTACKER_HIT_DENOMINATOR_ADD_BY_FORTIFICATION_LEVEL[input.fortificationLevel];
  if (
    attackerCombatPercent === undefined ||
    defenderFortificationCombatPercent === undefined ||
    attackerHitDenominatorAdd === undefined
  ) {
    throw new Error(
      `Missing recovered C64 combat bytes for fortification level ${input.fortificationLevel}.`
    );
  }
  const attackerHitDenominator = defenderHitDenominator + attackerHitDenominatorAdd;

  return {
    attackerCombatPercent:
      attackerCombatPercent + input.attackerFullRuleBonus,
    defenderCombatPercent:
      defenderFortificationCombatPercent +
      C64_DEFENDER_TERRAIN_COMBAT_ADD_BY_TERRAIN_ID[terrainIndex] +
      input.defenderFullRuleBonus,
    attackerHitDenominator,
    defenderHitDenominator,
    c64TerrainId: terrainIndex,
    c64FortificationLevel: input.fortificationLevel
  };
}

export function c64CombatSetupForProvince(
  province: {
    readonly terrainId: TerrainId;
    readonly fortificationLevel: FortificationLevel;
  },
  config: Pick<GameConfig, 'terrainInfluence'>
): C64CombatSetup {
  return c64CombatSetup({
    terrainId: c64TerrainIdForTerrainId(province.terrainId),
    fortificationLevel: c64FortificationLevelForFortificationLevel(province.fortificationLevel),
    terrainInfluence: config.terrainInfluence,
    attackerFullRuleBonus: 0,
    defenderFullRuleBonus: 0
  });
}

export function c64BattleHits(
  soldiers: number,
  combatPercent: number,
  hitDenominator: number,
  rngByte: number
): number {
  requirePositiveInteger(soldiers, 'C64 battle soldiers');
  requirePositiveInteger(combatPercent, 'C64 battle combat percent');
  requirePositiveInteger(hitDenominator, 'C64 battle hit denominator');
  const roll = c64RandomModuloPlusTwo(combatPercent, rngByte);
  const randomPart = roll * hitDenominator;
  const factor = 100 + randomPart;
  return Math.max(1, Math.floor(Math.floor((soldiers * factor) / hitDenominator) / 100));
}

export function c64BattleRound(input: C64BattleRoundInput): C64BattleRoundResult {
  requirePositiveInteger(input.attackerSoldiers, 'C64 battle attacker soldiers');
  requirePositiveInteger(input.defenderSoldiers, 'C64 battle defender soldiers');

  const defenderHitsAgainstAttacker = Math.min(
    input.attackerSoldiers,
    c64BattleHits(
      input.defenderSoldiers,
      input.defenderCombatPercent,
      input.defenderHitDenominator,
      input.defenderRngByte
    )
  );
  const attackerHitsAgainstDefender = Math.min(
    input.defenderSoldiers,
    c64BattleHits(
      input.attackerSoldiers,
      input.attackerCombatPercent,
      input.attackerHitDenominator,
      input.attackerRngByte
    )
  );
  const attackerSoldiers = input.attackerSoldiers - defenderHitsAgainstAttacker;
  const defenderSoldiers = input.defenderSoldiers - attackerHitsAgainstDefender;

  return {
    attackerLosses: defenderHitsAgainstAttacker,
    defenderLosses: attackerHitsAgainstDefender,
    attackerSoldiers,
    defenderSoldiers,
    attackStrength: input.attackerSoldiers * input.attackerCombatPercent,
    defenceStrength: input.defenderSoldiers * input.defenderCombatPercent,
    defenderHitsAgainstAttacker,
    attackerHitsAgainstDefender
  };
}

export function c64BattleFinishSoldiers(input: C64BattleFinishSoldiers): C64BattleFinishSoldiers {
  requireNonNegativeInteger(input.attackerSoldiers, 'C64 battle finish attacker soldiers');
  requireNonNegativeInteger(input.defenderSoldiers, 'C64 battle finish defender soldiers');

  if (input.attackerSoldiers < 1 && input.defenderSoldiers < 1) {
    return {
      attackerSoldiers: input.attackerSoldiers,
      defenderSoldiers: 1
    };
  }

  return input;
}
