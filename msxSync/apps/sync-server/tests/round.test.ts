import { describe, expect, it } from 'vitest';

import { round } from '../src/sync/round';

describe('round', () => {
  it('rounds to requested precision', () => {
    expect(round(1.23456, 3)).toBe(1.235);
    expect(round(1.23456, 2)).toBe(1.23);
  });
});
