import { describe, expect, it } from 'vitest';

import { c64CbaronRememberedTargetPressure } from './c64-cbaron-memory';

describe('C64 cbaron remembered target memory', () => {
  it('matches the L65AA remembered-target pressure fixture', () => {
    expect(c64CbaronRememberedTargetPressure({
      currentTargetSoldiers: 12,
      rememberedTargetSoldiers: 4,
      ca61: 0,
      ca62: 0
    })).toEqual({
      quotient: 3,
      ca61: 1,
      ca62: 0
    });
  });

  it('folds the quotient into the existing $CA61/$CA62 word', () => {
    expect(c64CbaronRememberedTargetPressure({
      currentTargetSoldiers: 300,
      rememberedTargetSoldiers: 2,
      ca61: 0x10,
      ca62: 0x01
    })).toEqual({
      quotient: 150,
      ca61: 0xd3,
      ca62: 0x00
    });
  });
});
