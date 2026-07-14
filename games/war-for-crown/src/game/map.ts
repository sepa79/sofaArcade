import { terrainIdForC64TerrainId } from './c64-battle';
import { generateC64MapWithByteRng } from './c64-map-generator';
import { ROYALIST_OWNER_ID } from './owners';
import { nextRngByte, normalizeRngSeed } from './rng';
import type {
  GameConfig,
  ProvinceId,
  ProvinceMapState,
  ProvinceState,
  TileState
} from './types';

const C64_MAP_WIDTH = 20;
const C64_MAP_HEIGHT = 12;
const C64_MIN_PROVINCE_COUNT = 16;
const C64_MAX_PROVINCE_COUNT = 99;

export interface GeneratedProvinceMap {
  readonly map: ProvinceMapState;
  readonly rngState: number;
}

function requireMapConfig(config: GameConfig): void {
  if (config.mapWidth !== C64_MAP_WIDTH || config.mapHeight !== C64_MAP_HEIGHT) {
    throw new Error(
      `C64 map requires ${C64_MAP_WIDTH}x${C64_MAP_HEIGHT}, got ${config.mapWidth}x${config.mapHeight}.`
    );
  }
  if (
    !Number.isInteger(config.provinceCount) ||
    config.provinceCount < C64_MIN_PROVINCE_COUNT ||
    config.provinceCount > C64_MAX_PROVINCE_COUNT
  ) {
    throw new Error(
      `C64 province count must be ${C64_MIN_PROVINCE_COUNT}..${C64_MAX_PROVINCE_COUNT}, got ${config.provinceCount}.`
    );
  }
  if (!Number.isInteger(config.maxVillages) || config.maxVillages < 5 || config.maxVillages > 99) {
    throw new Error(`C64 maximum villages must be 5..99, got ${config.maxVillages}.`);
  }
}

function provinceId(c64ProvinceId: number): ProvinceId {
  return `province-${c64ProvinceId}`;
}

function provinceNumber(id: ProvinceId): number {
  const match = /^province-(\d+)$/.exec(id);
  if (match === null) {
    throw new Error(`C64 map province id has invalid format: ${id}.`);
  }
  return Number(match[1]);
}

function createTiles(values: ReadonlyArray<number>): ReadonlyArray<TileState> {
  return values.map((value, index) => ({
    x: index % C64_MAP_WIDTH,
    y: Math.floor(index / C64_MAP_WIDTH),
    provinceId: value === 0 ? null : provinceId(value)
  }));
}

function neighbourIndexes(index: number): ReadonlyArray<number> {
  const x = index % C64_MAP_WIDTH;
  const y = Math.floor(index / C64_MAP_WIDTH);
  const neighbours: number[] = [];
  if (x > 0) {
    neighbours.push(index - 1);
  }
  if (x < C64_MAP_WIDTH - 1) {
    neighbours.push(index + 1);
  }
  if (y > 0) {
    neighbours.push(index - C64_MAP_WIDTH);
  }
  if (y < C64_MAP_HEIGHT - 1) {
    neighbours.push(index + C64_MAP_WIDTH);
  }
  return neighbours;
}

function buildNeighbourMap(
  tiles: ReadonlyArray<TileState>,
  provinceCount: number
): ReadonlyMap<ProvinceId, ReadonlySet<ProvinceId>> {
  const neighboursByProvince = new Map<ProvinceId, Set<ProvinceId>>();
  for (let id = 1; id <= provinceCount; id += 1) {
    neighboursByProvince.set(provinceId(id), new Set<ProvinceId>());
  }

  for (let index = 0; index < tiles.length; index += 1) {
    const current = tiles[index]?.provinceId;
    if (current === null || current === undefined) {
      continue;
    }
    const neighbours = neighboursByProvince.get(current);
    if (neighbours === undefined) {
      throw new Error(`C64 map tile ${index} references unknown province ${current}.`);
    }
    for (const neighbourIndex of neighbourIndexes(index)) {
      const neighbour = tiles[neighbourIndex]?.provinceId;
      if (neighbour !== null && neighbour !== undefined && neighbour !== current) {
        neighbours.add(neighbour);
      }
    }
  }
  return neighboursByProvince;
}

export function buildMapProvinceTileCounts(
  map: Pick<ProvinceMapState, 'tiles'>
): ReadonlyMap<ProvinceId, number> {
  const tileCounts = new Map<ProvinceId, number>();
  for (const tile of map.tiles) {
    if (tile.provinceId !== null) {
      tileCounts.set(tile.provinceId, (tileCounts.get(tile.provinceId) ?? 0) + 1);
    }
  }
  return tileCounts;
}

export function provinceVillageCap(
  config: Pick<GameConfig, 'maxVillages' | 'maxVillagesMode'>,
  id: ProvinceId,
  tileCounts: ReadonlyMap<ProvinceId, number>
): number {
  if (config.maxVillagesMode === 'per-province') {
    return config.maxVillages;
  }
  if (config.maxVillagesMode !== 'largest-province') {
    config.maxVillagesMode satisfies never;
    throw new Error('Unknown C64 village limit mode.');
  }
  const provinceTileCount = tileCounts.get(id);
  if (provinceTileCount === undefined) {
    throw new Error(`Missing tile count for province ${id}.`);
  }
  const largestProvinceTileCount = Math.max(...tileCounts.values());
  return Math.floor((provinceTileCount * config.maxVillages) / largestProvinceTileCount);
}

function createProvinces(
  config: GameConfig,
  terrainIds: ReadonlyArray<number>,
  neighboursByProvince: ReadonlyMap<ProvinceId, ReadonlySet<ProvinceId>>,
  nextByte: () => number
): ReadonlyArray<ProvinceState> {
  const villages = Array<number>(config.provinceCount + 1).fill(0);
  const soldiers = Array<number>(config.provinceCount + 1).fill(0);
  for (let c64ProvinceId = config.provinceCount; c64ProvinceId >= 1; c64ProvinceId -= 1) {
    villages[c64ProvinceId] = (nextByte() & 0x03) + 2;
    soldiers[c64ProvinceId] = (nextByte() & 0x03) + 3;
  }

  return Array.from({ length: config.provinceCount }, (_, index) => {
    const c64ProvinceId = index + 1;
    const id = provinceId(c64ProvinceId);
    const terrainId = terrainIds[c64ProvinceId];
    const provinceVillages = villages[c64ProvinceId];
    const provinceSoldiers = soldiers[c64ProvinceId];
    const neighbours = neighboursByProvince.get(id);
    if (
      terrainId === undefined ||
      provinceVillages === undefined ||
      provinceSoldiers === undefined ||
      neighbours === undefined
    ) {
      throw new Error(`Missing generated C64 province state for ${id}.`);
    }
    if (terrainId < 1 || terrainId > 7) {
      throw new Error(`C64 province ${id} has invalid terrain id ${terrainId}.`);
    }
    return {
      id,
      terrainId: terrainIdForC64TerrainId(terrainId),
      ownerId: ROYALIST_OWNER_ID,
      villages: provinceVillages,
      soldiers: provinceSoldiers,
      fortificationLevel: 'none',
      upgradedFortificationThisTurn: false,
      neighbours: [...neighbours].sort((left, right) => provinceNumber(left) - provinceNumber(right))
    };
  });
}

export function generateProvinceMapWithRngState(
  config: GameConfig,
  initialRngState: number
): GeneratedProvinceMap {
  requireMapConfig(config);
  let rngState = normalizeRngSeed(initialRngState);
  const nextByte = (): number => {
    const next = nextRngByte(rngState);
    rngState = next.rngState;
    return next.byte;
  };
  const generated = generateC64MapWithByteRng(config.provinceCount, { nextByte });
  const tiles = createTiles(generated.visibleMap);
  const neighboursByProvince = buildNeighbourMap(tiles, config.provinceCount);
  const provinces = createProvinces(config, generated.terrainIds, neighboursByProvince, nextByte);
  return {
    map: {
      width: C64_MAP_WIDTH,
      height: C64_MAP_HEIGHT,
      tiles,
      provinces
    },
    rngState
  };
}

export function generateProvinceMap(config: GameConfig, seed: number): ProvinceMapState {
  return generateProvinceMapWithRngState(config, seed).map;
}
