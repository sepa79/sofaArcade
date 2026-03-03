import { describe, expect, it } from 'vitest';

import { createActionCatalog } from './actions';

describe('createActionCatalog', () => {
  it('rejects empty catalog', () => {
    expect(() => createActionCatalog([])).toThrowError('Action catalog cannot be empty.');
  });

  it('rejects duplicate action id', () => {
    expect(() =>
      createActionCatalog([
        { id: 'FIRE', type: 'digital' },
        { id: 'FIRE', type: 'digital' }
      ])
    ).toThrowError('Action catalog has duplicate id: "FIRE".');
  });

  it('rejects relative axis with non-signed domain', () => {
    expect(() =>
      createActionCatalog([
        {
          id: 'MOVE',
          type: 'axis_1d',
          space: 'relative',
          domain: 'byte'
        }
      ])
    ).toThrowError('Action "MOVE" is invalid: relative axis must use domain "signed".');
  });
});
