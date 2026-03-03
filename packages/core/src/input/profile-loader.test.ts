import { describe, expect, it } from 'vitest';

import { createActionCatalog } from './actions';
import { loadInputProfile, parseInputProfileData } from './profile-loader';

describe('parseInputProfileData', () => {
  it('parses valid profile data', () => {
    const parsed = parseInputProfileData({
      id: 'p1',
      playerIndex: 0,
      bindings: [
        {
          id: 'fire',
          actionId: 'FIRE',
          type: 'digital',
          source: {
            kind: 'keyboard_key',
            code: 'keyboard.fire'
          }
        }
      ]
    });

    expect(parsed.id).toBe('p1');
    expect(parsed.bindings).toHaveLength(1);
  });

  it('fails on invalid profile shape', () => {
    expect(() =>
      parseInputProfileData({
        id: '',
        playerIndex: 0,
        bindings: []
      })
    ).toThrowError('id must be a non-empty string.');
  });

  it('fails on invalid source kind', () => {
    expect(() =>
      parseInputProfileData({
        id: 'p1',
        playerIndex: 0,
        bindings: [
          {
            id: 'fire',
            actionId: 'FIRE',
            type: 'digital',
            source: {
              kind: 'keyboard',
              code: 'keyboard.fire'
            }
          }
        ]
      })
    ).toThrowError('bindings[0].source.kind is invalid: "keyboard".');
  });
});

describe('loadInputProfile', () => {
  it('validates parsed profile against action catalog', () => {
    const catalog = createActionCatalog([{ id: 'FIRE', type: 'digital' }]);

    const profile = loadInputProfile(catalog, {
      id: 'p1',
      playerIndex: 0,
      bindings: [
        {
          id: 'fire',
          actionId: 'FIRE',
          type: 'digital',
          source: {
            kind: 'keyboard_key',
            code: 'keyboard.fire'
          }
        }
      ]
    });

    expect(profile.bindings).toHaveLength(1);
  });

  it('fails when action type mismatches binding type', () => {
    const catalog = createActionCatalog([{ id: 'MOVE_X', type: 'axis_1d', space: 'relative', domain: 'signed' }]);

    expect(() =>
      loadInputProfile(catalog, {
        id: 'p1',
        playerIndex: 0,
        bindings: [
          {
            id: 'bad-binding',
            actionId: 'MOVE_X',
            type: 'digital',
            source: {
              kind: 'keyboard_key',
              code: 'keyboard.fire'
            }
          }
        ]
      })
    ).toThrowError(
      'Binding "bad-binding" type mismatch: action "MOVE_X" is "axis_1d", binding is "digital".'
    );
  });
});
