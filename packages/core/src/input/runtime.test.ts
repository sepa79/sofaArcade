import { describe, expect, it } from 'vitest';

import { createActionCatalog } from './actions';
import { createInputRuntime } from './runtime';

describe('createInputRuntime', () => {
  it('tracks digital pressed and just-pressed state', () => {
    const catalog = createActionCatalog([{ id: 'FIRE', type: 'digital' }]);
    const runtime = createInputRuntime(catalog);

    runtime.beginFrame();
    runtime.writeDigital('FIRE', true);

    expect(runtime.isPressed('FIRE')).toBe(true);
    expect(runtime.wasPressed('FIRE')).toBe(true);

    runtime.beginFrame();
    runtime.writeDigital('FIRE', true);
    expect(runtime.wasPressed('FIRE')).toBe(false);
  });

  it('resets relative axis each frame', () => {
    const catalog = createActionCatalog([
      { id: 'MOVE_X', type: 'axis_1d', space: 'relative', domain: 'signed' }
    ]);
    const runtime = createInputRuntime(catalog);

    runtime.beginFrame();
    runtime.writeAxis('MOVE_X', 0.75);
    expect(runtime.readAxisRaw('MOVE_X')).toBe(0.75);

    runtime.beginFrame();
    expect(runtime.readAxisRaw('MOVE_X')).toBe(0);
  });

  it('converts absolute byte axis to signed and unit ranges', () => {
    const catalog = createActionCatalog([
      { id: 'PADDLE_X', type: 'axis_1d', space: 'absolute', domain: 'byte' }
    ]);
    const runtime = createInputRuntime(catalog);

    runtime.beginFrame();
    runtime.writeAxis('PADDLE_X', 255);

    expect(runtime.readAxisUnit('PADDLE_X')).toBe(1);
    expect(runtime.readAxisSigned('PADDLE_X')).toBe(1);
  });
});
