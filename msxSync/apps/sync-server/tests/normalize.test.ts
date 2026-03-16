import { describe, expect, it } from 'vitest';

import { robustNormalize } from '../src/audio/normalize';

describe('robustNormalize', () => {
  it('keeps value count and clamps values into 0..1 range', () => {
    const normalized = robustNormalize([0, 1, 2, 3, 4, 100]);
    expect(normalized).toHaveLength(6);
    for (const value of normalized) {
      expect(value).toBeGreaterThanOrEqual(0);
      expect(value).toBeLessThanOrEqual(1);
    }
  });

  it('returns all zeros when all inputs are equal', () => {
    expect(robustNormalize([5, 5, 5])).toEqual([0, 0, 0]);
  });
});
