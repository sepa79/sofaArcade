import { describe, expect, it } from 'vitest';

import {
  c64CbaronMovementTargetRequirement,
  c64CbaronThreatRequirement,
  c64Divide32,
  c64Multiply32,
  c64SysL9781
} from './c64-arithmetic';

describe('C64 arithmetic helpers', () => {
  it('divides 32-bit values like sys:L9732/L9728', () => {
    expect(c64Divide32(25 * 0x10000, 35)).toEqual({
      quotient: 46811,
      remainder: 15
    });
    expect(c64Divide32(95, 100)).toEqual({
      quotient: 0,
      remainder: 95
    });
    expect(c64Divide32(0x12345678, 0)).toEqual({
      quotient: 0xffffffff,
      remainder: 0x12345678
    });
  });

  it('multiplies 32-bit values like sys:L96E1', () => {
    expect(c64Multiply32(219, 3)).toBe(657);
    expect(c64Multiply32(256, 2)).toBe(512);
    expect(c64Multiply32(0x10000, 0x10000)).toBe(0);
    expect(c64Multiply32(0xffffffff, 2)).toBe(0xfffffffe);
  });

  it('matches sys:L9781 rounded Newton helper values', () => {
    expect(c64SysL9781(0)).toBe(0);
    expect(c64SysL9781(1)).toBe(1);
    expect(c64SysL9781(2)).toBe(2);
    expect(c64SysL9781(4)).toBe(2);
    expect(c64SysL9781(10)).toBe(3);
    expect(c64SysL9781(100)).toBe(10);
    expect(c64SysL9781(1000)).toBe(32);
    expect(c64SysL9781(46811)).toBe(219);
    expect(c64SysL9781(65536)).toBe(256);
  });

  it('matches cbaron:L642F threat requirement arithmetic shape', () => {
    expect(
      c64CbaronThreatRequirement({
        attackerCombatPercent: 25,
        defenderCombatPercent: 25,
        strongestAdjacentMobileSoldiers: 2
      })
    ).toBe(2);
    expect(
      c64CbaronThreatRequirement({
        attackerCombatPercent: 25,
        defenderCombatPercent: 35,
        strongestAdjacentMobileSoldiers: 3
      })
    ).toBe(2);
    expect(
      c64CbaronThreatRequirement({
        attackerCombatPercent: 255,
        defenderCombatPercent: 1,
        strongestAdjacentMobileSoldiers: 0xffffff
      })
    ).toBe(2_321_828);
  });

  it('matches cbaron:L6484 movement target requirement arithmetic shape', () => {
    expect(
      c64CbaronMovementTargetRequirement({
        attackerCombatPercent: 25,
        defenderCombatPercent: 25,
        targetSoldiers: 20,
        pressureWord: 0x0100
      })
    ).toBe(22);
    expect(
      c64CbaronMovementTargetRequirement({
        attackerCombatPercent: 25,
        defenderCombatPercent: 35,
        targetSoldiers: 3,
        pressureWord: 0x00ff
      })
    ).toBe(3);
    expect(
      c64CbaronMovementTargetRequirement({
        attackerCombatPercent: 0,
        defenderCombatPercent: 25,
        targetSoldiers: 80,
        pressureWord: 0
      })
    ).toBe(0);
  });
});
