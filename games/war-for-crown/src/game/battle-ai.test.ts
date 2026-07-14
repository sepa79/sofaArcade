import { describe, expect, it } from 'vitest';

import {
  C64_BARON_ATTACK_THRESHOLD,
  C64_ROYALIST_ATTACK_THRESHOLD_LOOSE,
  chooseC64BattleDecision,
  c64BattleMeetsThreshold,
  c64BattleStrengthRatio,
  minimumC64AttackersForThreshold
} from './battle-ai';
import type { BattleState } from './types';

function battle(overrides: Partial<BattleState> = {}): BattleState {
  return {
    attackerId: 'attacker',
    defenderId: 'defender',
    fromProvinceIds: ['source'],
    targetProvinceId: 'target',
    attackerSoldiers: 100,
    defenderSoldiers: 100,
    attackerInitialSoldiers: 100,
    defenderInitialSoldiers: 100,
    attackerCombatPercent: 25,
    defenderCombatPercent: 25,
    attackerHitDenominator: 10,
    defenderHitDenominator: 10,
    round: 0,
    retreatSide: null,
    ...overrides
  };
}

describe('c64 battle AI', () => {
  it('matches the recovered equal-strength ratio scale', () => {
    expect(c64BattleStrengthRatio(battle())).toBe(255);
    expect(c64BattleStrengthRatio(battle({ attackerCombatPercent: 0 }))).toBe(0);
  });

  it('retreats the attacker AI below the recovered low threshold', () => {
    expect(chooseC64BattleDecision({
      battle: battle({ attackerSoldiers: 80, defenderSoldiers: 100 }),
      attackerIsAi: true,
      defenderIsAi: false,
      defenderCanRetreat: false
    })).toBe('retreat-attacker');
  });

  it('retreats the defender AI at the recovered high threshold when retreat is legal', () => {
    expect(chooseC64BattleDecision({
      battle: battle({ attackerSoldiers: 140, defenderSoldiers: 100 }),
      attackerIsAi: false,
      defenderIsAi: true,
      defenderCanRetreat: true
    })).toBe('retreat-defender');
  });

  it('lets defender AI priority win before attacker AI retreat', () => {
    expect(chooseC64BattleDecision({
      battle: battle({ attackerSoldiers: 140, defenderSoldiers: 100 }),
      attackerIsAi: true,
      defenderIsAi: true,
      defenderCanRetreat: true
    })).toBe('retreat-defender');
  });

  it('continues the battle when neither recovered retreat condition applies', () => {
    expect(chooseC64BattleDecision({
      battle: battle(),
      attackerIsAi: true,
      defenderIsAi: true,
      defenderCanRetreat: true
    })).toBe('fight-round');
  });

  it('checks recovered map-attack thresholds through the C64 ratio helper', () => {
    const equalStrength = battle();
    const winningMapAttack = {
      attackerSoldiers: 7,
      defenderSoldiers: 6,
      attackerCombatPercent: 25,
      defenderCombatPercent: 25
    };

    expect(c64BattleMeetsThreshold(equalStrength, C64_ROYALIST_ATTACK_THRESHOLD_LOOSE)).toBe(false);
    expect(c64BattleMeetsThreshold(winningMapAttack, C64_BARON_ATTACK_THRESHOLD)).toBe(true);
  });

  it('finds minimum attackers for a recovered threshold', () => {
    expect(minimumC64AttackersForThreshold({
      defenderSoldiers: 6,
      attackerCombatPercent: 25,
      defenderCombatPercent: 25,
      threshold: C64_BARON_ATTACK_THRESHOLD
    })).toBe(7);
  });
});
