import { describe, expect, it } from 'vitest';

import { deformTerrain, generateTerrain, sampleTerrainHeight, tankPositionX } from './terrain';

describe('terrain', () => {
  it('generates deterministic heights for same seed', () => {
    expect(generateTerrain(7)).toEqual(generateTerrain(7));
  });

  it('creates flat plateaus for both tanks', () => {
    const terrain = generateTerrain(3);
    const left = sampleTerrainHeight(terrain, tankPositionX(0));
    const right = sampleTerrainHeight(terrain, tankPositionX(1));

    expect(Math.abs(left - sampleTerrainHeight(terrain, tankPositionX(0) - 5))).toBeLessThanOrEqual(2);
    expect(Math.abs(right - sampleTerrainHeight(terrain, tankPositionX(1) + 5))).toBeLessThanOrEqual(2);
  });

  it('keeps adjacent samples smooth enough for rolling hills', () => {
    const terrain = generateTerrain(11);
    const maxAdjacentDelta = terrain.heights.reduce((maxDelta, height, index, heights) => {
      if (index === 0) {
        return maxDelta;
      }

      return Math.max(maxDelta, Math.abs(height - heights[index - 1]));
    }, 0);

    expect(maxAdjacentDelta).toBeLessThanOrEqual(6);
  });

  it('deforms terrain downward near impact point', () => {
    const terrain = generateTerrain(9);
    const x = tankPositionX(0) + 20;
    const before = sampleTerrainHeight(terrain, x);
    const after = sampleTerrainHeight(deformTerrain(terrain, x, 14, 12), x);

    expect(after).toBeGreaterThan(before);
  });
});
