import { describe, expect, it } from 'vitest';

import { minimumWinningAttackers, resolveBattle, resolveBattleRound } from './battle';
import { TERRAIN_DEFINITIONS } from './constants';

describe('battle', () => {
  it('lets the defender win strength ties', () => {
    const result = resolveBattle({
      attackingSoldiers: 170,
      defendingSoldiers: 200,
      attackerMultiplier: 1,
      defenderMultiplier: TERRAIN_DEFINITIONS.desert.defenceMultiplier
    });

    expect(result.winner).toBe('defender');
    expect(result.survivingDefenders).toBeGreaterThan(0);
  });

  it('lets a small numerical edge win in weak terrain', () => {
    const result = resolveBattle({
      attackingSoldiers: 171,
      defendingSoldiers: 200,
      attackerMultiplier: 1,
      defenderMultiplier: TERRAIN_DEFINITIONS.desert.defenceMultiplier
    });

    expect(result.winner).toBe('attacker');
    expect(result.survivingAttackers).toBe(1);
  });

  it('makes mountains safe against a larger but insufficient force', () => {
    const result = resolveBattle({
      attackingSoldiers: 300,
      defendingSoldiers: 170,
      attackerMultiplier: 1,
      defenderMultiplier: TERRAIN_DEFINITIONS.mountains.defenceMultiplier
    });

    expect(result.winner).toBe('defender');
    expect(result.survivingDefenders).toBeGreaterThan(0);
  });

  it('rejects invalid soldier counts', () => {
    expect(() =>
      resolveBattle({
        attackingSoldiers: 0,
        defendingSoldiers: 20,
        attackerMultiplier: 1,
        defenderMultiplier: 1
      })
    ).toThrow('Attacking soldiers must be a positive integer');
  });

  it('keeps one defender alive when a round would eliminate both sides', () => {
    const result = resolveBattleRound({
      attackerSoldiers: 1,
      defenderSoldiers: 1,
      attackerCombatPercent: 25,
      defenderCombatPercent: 25
    });

    expect(result).toMatchObject({
      attackerLosses: 1,
      defenderLosses: 0,
      attackerSoldiers: 0,
      defenderSoldiers: 1
    });
  });

  it('calculates the smallest force that can beat terrain defence', () => {
    expect(
      minimumWinningAttackers({
        defendingSoldiers: 200,
        attackerMultiplier: 1,
        defenderMultiplier: TERRAIN_DEFINITIONS.desert.defenceMultiplier
      })
    ).toBe(171);

    expect(
      minimumWinningAttackers({
        defendingSoldiers: 170,
        attackerMultiplier: 1,
        defenderMultiplier: TERRAIN_DEFINITIONS.mountains.defenceMultiplier
      })
    ).toBe(315);
  });
});
