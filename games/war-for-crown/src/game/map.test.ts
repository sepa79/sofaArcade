import { describe, expect, it } from 'vitest';

import { DEFAULT_GAME_CONFIG, TERRAIN_IDS } from './constants';
import { generateProvinceMap } from './map';
import { ROYALIST_OWNER_ID } from './owners';
import type { ProvinceMapState } from './types';

function tileIndex(map: ProvinceMapState, x: number, y: number): number {
  return y * map.width + x;
}

function sameProvinceNeighbours(
  map: ProvinceMapState,
  provinceId: string,
  tileIndexValue: number
): ReadonlyArray<number> {
  const tile = map.tiles[tileIndexValue];
  const neighbours: number[] = [];

  if (tile.x > 0) {
    neighbours.push(tileIndex(map, tile.x - 1, tile.y));
  }
  if (tile.x < map.width - 1) {
    neighbours.push(tileIndex(map, tile.x + 1, tile.y));
  }
  if (tile.y > 0) {
    neighbours.push(tileIndex(map, tile.x, tile.y - 1));
  }
  if (tile.y < map.height - 1) {
    neighbours.push(tileIndex(map, tile.x, tile.y + 1));
  }

  return neighbours.filter((neighbour) => map.tiles[neighbour].provinceId === provinceId);
}

describe('province map', () => {
  it('generates deterministic maps from the same seed', () => {
    expect(generateProvinceMap(DEFAULT_GAME_CONFIG, 1234)).toEqual(
      generateProvinceMap(DEFAULT_GAME_CONFIG, 1234)
    );
  });

  it('keeps the C64 water border and creates internal water', () => {
    const map = generateProvinceMap(DEFAULT_GAME_CONFIG, 7);
    let internalWaterCount = 0;

    for (const tile of map.tiles) {
      const isBorder =
        tile.x === 0 || tile.y === 0 || tile.x === map.width - 1 || tile.y === map.height - 1;

      if (!isBorder && tile.provinceId === null) {
        internalWaterCount += 1;
      }
    }

    expect(map.tiles.filter((tile) => tile.y === 0).every((tile) => tile.provinceId === null)).toBe(true);
    expect(map.tiles.filter((tile) => tile.x === 0).every((tile) => tile.provinceId === null)).toBe(true);
    expect(
      map.tiles.filter((tile) => tile.x === map.width - 1).every((tile) => tile.provinceId === null)
    ).toBe(true);
    expect(internalWaterCount).toBeGreaterThanOrEqual(9);
  });

  it('creates the configured number of provinces', () => {
    const map = generateProvinceMap(DEFAULT_GAME_CONFIG, 17);
    const provinceIds = new Set(map.provinces.map((province) => province.id));

    expect(map.provinces).toHaveLength(DEFAULT_GAME_CONFIG.provinceCount);
    expect(provinceIds.size).toBe(DEFAULT_GAME_CONFIG.provinceCount);
  });

  it('uses every land terrain type when the map has enough provinces', () => {
    const map = generateProvinceMap(DEFAULT_GAME_CONFIG, 19);
    const terrainIds = new Set(map.provinces.map((province) => province.terrainId));

    expect(terrainIds).toEqual(new Set(TERRAIN_IDS));
  });

  it('starts unclaimed provinces with recovered C64 villages, soldiers, and no fortifications', () => {
    const map = generateProvinceMap(DEFAULT_GAME_CONFIG, 23);

    expect(map.provinces.every((province) => province.ownerId === ROYALIST_OWNER_ID)).toBe(true);
    expect(map.provinces.every((province) => province.villages >= 2 && province.villages <= 5)).toBe(
      true
    );
    expect(map.provinces.every((province) => province.soldiers >= 3 && province.soldiers <= 6)).toBe(
      true
    );
    expect(map.provinces.every((province) => province.fortificationLevel === 'none')).toBe(true);
  });

  it('stores symmetric province adjacency', () => {
    const map = generateProvinceMap(DEFAULT_GAME_CONFIG, 29);
    const provincesById = new Map(map.provinces.map((province) => [province.id, province]));

    for (const province of map.provinces) {
      for (const neighbourId of province.neighbours) {
        const neighbour = provincesById.get(neighbourId);

        expect(neighbour).not.toBeUndefined();
        expect(neighbour?.neighbours).toContain(province.id);
      }
    }
  });

  it('creates one connected playable continent', () => {
    const map = generateProvinceMap(DEFAULT_GAME_CONFIG, 31);
    const provincesById = new Map(map.provinces.map((province) => [province.id, province]));
    const visited = new Set<string>();
    const queue = [map.provinces[0].id];

    for (let cursor = 0; cursor < queue.length; cursor += 1) {
      const provinceId = queue[cursor];
      if (visited.has(provinceId)) {
        continue;
      }

      visited.add(provinceId);
      const province = provincesById.get(provinceId);
      if (province === undefined) {
        throw new Error(`Missing province ${provinceId}.`);
      }
      queue.push(...province.neighbours);
    }

    expect(visited.size).toBe(DEFAULT_GAME_CONFIG.provinceCount);
  });

  it('keeps each province as one connected tile cluster', () => {
    const map = generateProvinceMap(DEFAULT_GAME_CONFIG, 41);

    for (const province of map.provinces) {
      const provinceTileIndexes = map.tiles
        .map((tile, index) => ({ tile, index }))
        .filter(({ tile }) => tile.provinceId === province.id)
        .map(({ index }) => index);

      expect(provinceTileIndexes.length).toBeGreaterThan(0);

      const visited = new Set<number>();
      const queue = [provinceTileIndexes[0]];

      for (let cursor = 0; cursor < queue.length; cursor += 1) {
        const current = queue[cursor];
        if (visited.has(current)) {
          continue;
        }

        visited.add(current);
        queue.push(...sameProvinceNeighbours(map, province.id, current));
      }

      expect(visited.size).toBe(provinceTileIndexes.length);
    }
  });
});
