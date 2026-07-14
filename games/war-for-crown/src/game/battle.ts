import type { BattleInput, BattleResult, BattleRoundInput, BattleRoundResult, BattleThresholdInput } from './types';

function requirePositiveInteger(value: number, label: string): void {
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`${label} must be a positive integer, got ${value}.`);
  }
}

function requirePositiveMultiplier(value: number, label: string): void {
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`${label} must be positive, got ${value}.`);
  }
}

function survivingWinnerCount(soldiers: number, ownStrength: number, enemyStrength: number): number {
  const strengthGap = ownStrength - enemyStrength;
  return Math.max(1, Math.floor((soldiers * strengthGap) / ownStrength));
}

export function resolveBattle(input: BattleInput): BattleResult {
  requirePositiveInteger(input.attackingSoldiers, 'Attacking soldiers');
  requirePositiveInteger(input.defendingSoldiers, 'Defending soldiers');
  requirePositiveMultiplier(input.attackerMultiplier, 'Attacker multiplier');
  requirePositiveMultiplier(input.defenderMultiplier, 'Defender multiplier');

  const attackStrength = input.attackingSoldiers * input.attackerMultiplier;
  const defenceStrength = input.defendingSoldiers * input.defenderMultiplier;

  if (attackStrength > defenceStrength) {
    const survivingAttackers = survivingWinnerCount(
      input.attackingSoldiers,
      attackStrength,
      defenceStrength
    );
    return {
      winner: 'attacker',
      resolution: 'elimination',
      attackerLosses: input.attackingSoldiers - survivingAttackers,
      defenderLosses: input.defendingSoldiers,
      survivingAttackers,
      survivingDefenders: 0,
      attackStrength,
      defenceStrength
    };
  }

  const survivingDefenders = survivingWinnerCount(
    input.defendingSoldiers,
    defenceStrength,
    attackStrength
  );
  return {
    winner: 'defender',
    resolution: 'elimination',
    attackerLosses: input.attackingSoldiers,
    defenderLosses: input.defendingSoldiers - survivingDefenders,
    survivingAttackers: 0,
    survivingDefenders,
    attackStrength,
    defenceStrength
  };
}

function casualties(soldiers: number, combatPercent: number): number {
  requirePositiveInteger(soldiers, 'Battle round soldiers');
  requirePositiveMultiplier(combatPercent, 'Battle round combat percent');
  return Math.max(1, Math.floor((soldiers * combatPercent) / 100));
}

export function resolveBattleRound(input: BattleRoundInput): BattleRoundResult {
  requirePositiveInteger(input.attackerSoldiers, 'Battle round attacker soldiers');
  requirePositiveInteger(input.defenderSoldiers, 'Battle round defender soldiers');
  requirePositiveMultiplier(input.attackerCombatPercent, 'Battle round attacker combat percent');
  requirePositiveMultiplier(input.defenderCombatPercent, 'Battle round defender combat percent');

  const attackerHits = casualties(input.attackerSoldiers, input.attackerCombatPercent);
  const defenderHits = casualties(input.defenderSoldiers, input.defenderCombatPercent);
  const attackerLosses = Math.min(input.attackerSoldiers, defenderHits);
  const initialDefenderLosses = Math.min(input.defenderSoldiers, attackerHits);
  const attackerSoldiers = input.attackerSoldiers - attackerLosses;
  const defenderLosses =
    attackerSoldiers < 1 && input.defenderSoldiers - initialDefenderLosses < 1
      ? input.defenderSoldiers - 1
      : initialDefenderLosses;

  return {
    attackerLosses,
    defenderLosses,
    attackerSoldiers,
    defenderSoldiers: input.defenderSoldiers - defenderLosses,
    attackStrength: input.attackerSoldiers * input.attackerCombatPercent,
    defenceStrength: input.defenderSoldiers * input.defenderCombatPercent
  };
}

export function minimumWinningAttackers(input: BattleThresholdInput): number {
  requirePositiveInteger(input.defendingSoldiers, 'Defending soldiers');
  requirePositiveMultiplier(input.attackerMultiplier, 'Attacker multiplier');
  requirePositiveMultiplier(input.defenderMultiplier, 'Defender multiplier');

  const defenceStrength = input.defendingSoldiers * input.defenderMultiplier;
  return Math.floor(defenceStrength / input.attackerMultiplier) + 1;
}
