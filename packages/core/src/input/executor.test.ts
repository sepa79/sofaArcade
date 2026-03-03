import { describe, expect, it } from 'vitest';

import { createActionCatalog } from './actions';
import { applyInputProfile, createInputSourceFrame } from './executor';
import { createInputProfile } from './profile';
import { createInputRuntime } from './runtime';

describe('applyInputProfile', () => {
  it('maps bound sources into runtime state', () => {
    const catalog = createActionCatalog([
      { id: 'MOVE_X', type: 'axis_1d', space: 'relative', domain: 'signed' },
      { id: 'FIRE', type: 'digital' }
    ]);

    const profile = createInputProfile(catalog, {
      id: 'p1',
      playerIndex: 0,
      bindings: [
        {
          id: 'move-kb',
          actionId: 'MOVE_X',
          type: 'axis_1d',
          source: { kind: 'keyboard_axis', code: 'kb.move_x' },
          scale: 1,
          invert: false
        },
        {
          id: 'fire-kb',
          actionId: 'FIRE',
          type: 'digital',
          source: { kind: 'keyboard_key', code: 'kb.fire' }
        }
      ]
    });

    const runtime = createInputRuntime(catalog);
    const frame = createInputSourceFrame({
      digital: {
        'kb.fire': true
      },
      axis: {
        'kb.move_x': -0.5
      }
    });

    applyInputProfile(runtime, profile, frame);

    expect(runtime.readAxisRaw('MOVE_X')).toBe(-0.5);
    expect(runtime.isPressed('FIRE')).toBe(true);
    expect(runtime.wasPressed('FIRE')).toBe(true);
  });

  it('throws when source is missing from frame', () => {
    const catalog = createActionCatalog([{ id: 'FIRE', type: 'digital' }]);
    const profile = createInputProfile(catalog, {
      id: 'p1',
      playerIndex: 0,
      bindings: [
        {
          id: 'fire-kb',
          actionId: 'FIRE',
          type: 'digital',
          source: { kind: 'keyboard_key', code: 'kb.fire' }
        }
      ]
    });

    const runtime = createInputRuntime(catalog);
    const frame = createInputSourceFrame({
      digital: {},
      axis: {}
    });

    expect(() => applyInputProfile(runtime, profile, frame)).toThrowError(
      'Missing digital source in input frame: "kb.fire".'
    );
  });
});
