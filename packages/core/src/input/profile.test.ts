import { describe, expect, it } from 'vitest';

import { createActionCatalog } from './actions';
import { createInputProfile } from './profile';

describe('createInputProfile', () => {
  it('rejects binding with mismatched action type', () => {
    const catalog = createActionCatalog([
      { id: 'FIRE', type: 'digital' },
      { id: 'MOVE_X', type: 'axis_1d', space: 'relative', domain: 'signed' }
    ]);

    expect(() =>
      createInputProfile(catalog, {
        id: 'player-1',
        playerIndex: 0,
        bindings: [
          {
            id: 'b1',
            actionId: 'FIRE',
            type: 'axis_1d',
            source: {
              kind: 'keyboard_axis',
              code: 'ArrowLeft+ArrowRight'
            },
            scale: 1,
            invert: false
          }
        ]
      })
    ).toThrowError(
      'Binding "b1" type mismatch: action "FIRE" is "digital", binding is "axis_1d".'
    );
  });

  it('accepts valid profile', () => {
    const catalog = createActionCatalog([
      { id: 'FIRE', type: 'digital' },
      { id: 'PADDLE_X', type: 'axis_1d', space: 'absolute', domain: 'byte' }
    ]);

    const profile = createInputProfile(catalog, {
      id: 'player-1',
      playerIndex: 0,
      bindings: [
        {
          id: 'fire-space',
          actionId: 'FIRE',
          type: 'digital',
          source: {
            kind: 'keyboard_key',
            code: 'Space'
          }
        },
        {
          id: 'paddle-mouse',
          actionId: 'PADDLE_X',
          type: 'axis_1d',
          source: {
            kind: 'mouse_position_x',
            code: 'MouseX'
          },
          scale: 1,
          invert: false
        }
      ]
    });

    expect(profile.id).toBe('player-1');
    expect(profile.bindings).toHaveLength(2);
  });

  it('accepts mouse Y absolute binding', () => {
    const catalog = createActionCatalog([
      { id: 'PADDLE_Y', type: 'axis_1d', space: 'absolute', domain: 'byte' }
    ]);

    const profile = createInputProfile(catalog, {
      id: 'player-1',
      playerIndex: 0,
      bindings: [
        {
          id: 'paddle-mouse-y',
          actionId: 'PADDLE_Y',
          type: 'axis_1d',
          source: {
            kind: 'mouse_position_y',
            code: 'MouseY'
          },
          scale: 1,
          invert: false
        }
      ]
    });

    expect(profile.bindings[0]?.source.kind).toBe('mouse_position_y');
  });

  it('rejects multiple absolute bindings for one action', () => {
    const catalog = createActionCatalog([
      { id: 'PADDLE_X', type: 'axis_1d', space: 'absolute', domain: 'byte' }
    ]);

    expect(() =>
      createInputProfile(catalog, {
        id: 'player-1',
        playerIndex: 0,
        bindings: [
          {
            id: 'paddle-mouse',
            actionId: 'PADDLE_X',
            type: 'axis_1d',
            source: {
              kind: 'mouse_position_x',
              code: 'MouseX'
            },
            scale: 1,
            invert: false
          },
          {
            id: 'paddle-hid',
            actionId: 'PADDLE_X',
            type: 'axis_1d',
            source: {
              kind: 'hid_axis',
              code: 'HidPaddleX'
            },
            scale: 1,
            invert: false
          }
        ]
      })
    ).toThrowError(
      'Profile "player-1" has multiple absolute axis bindings for action "PADDLE_X".'
    );
  });
});
