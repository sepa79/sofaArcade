import { describe, expect, it } from 'vitest';

import { titleForRank } from './title-copy';

describe('rank titles', () => {
  it('maps promotion ranks through Earl to King', () => {
    expect(titleForRank(1, 'en')).toBe('Earl');
    expect(titleForRank(5, 'pl')).toBe('Krol');
  });
});
