import type { BattleState } from './types';
import { c64Divide32, c64Multiply32 } from './c64-arithmetic';

export type C64BattleDecision = 'fight-round' | 'retreat-attacker' | 'retreat-defender';

export const C64_AI_ATTACKER_RETREAT_THRESHOLD = 0x00e6;
export const C64_AI_DEFENDER_RETREAT_THRESHOLD = 0x01b3;
export const C64_BARON_ATTACK_THRESHOLD = 0x014d;
export const C64_ROYALIST_ATTACK_THRESHOLD_LOOSE = 0x0100;
export const C64_ROYALIST_ATTACK_THRESHOLD_STRICT = 0x014d;

export interface C64BattleStrengthRatioInput {
  readonly attackerSoldiers: number;
  readonly defenderSoldiers: number;
  readonly attackerCombatPercent: number;
  readonly defenderCombatPercent: number;
}

export interface MinimumC64AttackersForThresholdInput {
  readonly defenderSoldiers: number;
  readonly attackerCombatPercent: number;
  readonly defenderCombatPercent: number;
  readonly threshold: number;
}

export interface C64BattleDecisionInput {
  readonly battle: BattleState;
  readonly attackerIsAi: boolean;
  readonly defenderIsAi: boolean;
  readonly defenderCanRetreat: boolean;
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

export function c64BattleStrengthRatio(input: C64BattleStrengthRatioInput): number {
  requirePositiveInteger(input.attackerSoldiers, 'C64 ratio attacker soldiers');
  requirePositiveInteger(input.defenderSoldiers, 'C64 ratio defender soldiers');
  requireNonNegativeInteger(input.attackerCombatPercent, 'C64 ratio attacker combat percent');
  requireNonNegativeInteger(input.defenderCombatPercent, 'C64 ratio defender combat percent');

  const soldierRatio = c64Divide32(
    c64Multiply32(input.attackerSoldiers, 0x100),
    input.defenderSoldiers
  ).quotient;
  const squaredRatio = c64Multiply32(soldierRatio, soldierRatio);
  const combatAdjusted = c64Multiply32(
    c64Divide32(squaredRatio, input.defenderCombatPercent).quotient,
    input.attackerCombatPercent
  );
  return Math.floor(combatAdjusted / 256);
}

export function c64BattleMeetsThreshold(
  input: C64BattleStrengthRatioInput,
  threshold: number
): boolean {
  requirePositiveInteger(threshold, 'C64 battle threshold');
  return c64BattleStrengthRatio(input) >= threshold;
}

export function minimumC64AttackersForThreshold(
  input: MinimumC64AttackersForThresholdInput
): number {
  requirePositiveInteger(input.threshold, 'C64 battle threshold');
  requirePositiveInteger(input.defenderSoldiers, 'C64 threshold defender soldiers');
  requirePositiveInteger(input.attackerCombatPercent, 'C64 threshold attacker combat percent');
  requirePositiveInteger(input.defenderCombatPercent, 'C64 threshold defender combat percent');

  let attackerSoldiers = 1;
  for (;;) {
    if (
      c64BattleMeetsThreshold({
        attackerSoldiers,
        defenderSoldiers: input.defenderSoldiers,
        attackerCombatPercent: input.attackerCombatPercent,
        defenderCombatPercent: input.defenderCombatPercent
      }, input.threshold)
    ) {
      return attackerSoldiers;
    }
    attackerSoldiers += 1;
  }
}

export function chooseC64BattleDecision(input: C64BattleDecisionInput): C64BattleDecision {
  const ratio = c64BattleStrengthRatio(input.battle);

  if (
    input.defenderIsAi &&
    input.defenderCanRetreat &&
    ratio >= C64_AI_DEFENDER_RETREAT_THRESHOLD
  ) {
    return 'retreat-defender';
  }

  if (input.attackerIsAi && ratio < C64_AI_ATTACKER_RETREAT_THRESHOLD) {
    return 'retreat-attacker';
  }

  return 'fight-round';
}
