import { describe, expect, it } from 'vitest';

import { DEFAULT_GAME_CONFIG } from '../game/constants';
import { generateProvinceMap } from '../game/map';
import type { TileState } from '../game/types';
import { createMapDisplayFrame } from './map-display-frame';

function landBounds(tiles: ReadonlyArray<TileState>): {
  readonly minimumX: number;
  readonly maximumX: number;
  readonly minimumY: number;
  readonly maximumY: number;
} {
  const landTiles = tiles.filter((tile) => tile.provinceId !== null);
  return {
    minimumX: Math.min(...landTiles.map((tile) => tile.x)),
    maximumX: Math.max(...landTiles.map((tile) => tile.x)),
    minimumY: Math.min(...landTiles.map((tile) => tile.y)),
    maximumY: Math.max(...landTiles.map((tile) => tile.y))
  };
}

describe('map display frame', () => {
  it('places exactly one water-cell margin around generated C64 land', () => {
    for (let seed = 1; seed <= 12; seed += 1) {
      const map = generateProvinceMap(DEFAULT_GAME_CONFIG, seed);
      const frame = createMapDisplayFrame(map);
      const bounds = landBounds(map.tiles);

      expect(bounds.minimumX - frame.x).toBe(1);
      expect(frame.x + frame.width - 1 - bounds.maximumX).toBe(1);
      expect(bounds.minimumY - frame.y).toBe(1);
      expect(frame.y + frame.height - 1 - bounds.maximumY).toBe(1);
    }
  });

  it('rejects a map without land', () => {
    expect(() => createMapDisplayFrame({
      tiles: [{ x: 0, y: 0, provinceId: null }]
    })).toThrow('Cannot create a map display frame without land tiles.');
  });
});
