import { describe, expect, it } from 'vitest';

import { changeHireSelection, selectedHireSoldiers } from './hire-selection';

describe('hire selection', () => {
  it('keeps a partial selection instead of forcing the affordable maximum', () => {
    expect(selectedHireSoldiers(3, 12)).toBe(3);
  });

  it('clamps a stale selection after money is spent', () => {
    expect(selectedHireSoldiers(8, 5)).toBe(5);
  });

  it('changes the selection inside the affordable range', () => {
    expect(changeHireSelection(3, 5, -1)).toBe(2);
    expect(changeHireSelection(5, 5, 1)).toBe(5);
  });
});
