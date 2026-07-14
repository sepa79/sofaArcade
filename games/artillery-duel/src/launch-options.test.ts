import { describe, expect, it } from 'vitest';

import { ARTILLERY_LAUNCH_OPTIONS, artilleryLaunchData } from './launch-options';

describe('Artillery Duel standalone launch options', () => {
  it('exposes solo and two-player hotseat modes', () => {
    expect(ARTILLERY_LAUNCH_OPTIONS.map((option) => option.id)).toEqual(['solo-ai', 'hotseat-2p']);
    expect(artilleryLaunchData('hotseat-2p').matchMode).toBe('hotseat-2p');
  });
});
