import { describe, expect, it } from 'vitest';

import { DEFAULT_GAME_CONFIG } from '../game/constants';
import { cycleWarForCrownConfigOption } from './config-options';

describe('War for Crown config options', () => {
  it('marks map-shape changes for regeneration', () => {
    const result = cycleWarForCrownConfigOption(DEFAULT_GAME_CONFIG, 'map-province-count');
    expect(result.regenerateMap).toBe(true);
    expect(result.config.provinceCount).toBe(16);
  });

  it('keeps rules-only changes on the current map', () => {
    const result = cycleWarForCrownConfigOption(DEFAULT_GAME_CONFIG, 'rules-village-cost');
    expect(result.regenerateMap).toBe(false);
    expect(result.config.villageCost).toBe(8);
  });
});
