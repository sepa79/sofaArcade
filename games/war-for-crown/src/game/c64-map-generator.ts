export const C64_MAP_WIDTH = 20;
export const C64_MAP_HEIGHT = 12;
export const C64_VISIBLE_TILE_COUNT = 0xf0;
export const C64_MAP_BUFFER_SIZE = 0x104;

const C64_EMPTY_TILE = 0xff;
const C64_WATER_TILE = 0x00;
const C64_PENDING_OWNER_FLAG = 0x80;
const C64_SCAN_START = 0x15;
const C64_SCAN_END = 0xf0;
const C64_DIRECTION_OFFSETS: ReadonlyArray<number> = [0x01, -0x01, 0x14, -0x14];

export interface C64ByteRng {
  readonly nextByte: () => number;
}

export interface C64GeneratedMap {
  readonly visibleMap: ReadonlyArray<number>;
  readonly seedTiles: ReadonlyArray<number>;
  readonly terrainIds: ReadonlyArray<number>;
  readonly rngCounterAfter: number;
  readonly growthPreviousEmptyCounter: number;
  readonly growthRetryCounter: number;
}

interface GenerationAttemptResult {
  readonly map: C64GeneratedMap | null;
}

function requireProvinceCount(provinceCount: number): void {
  if (!Number.isInteger(provinceCount) || provinceCount < 1 || provinceCount >= C64_PENDING_OWNER_FLAG) {
    throw new Error(`C64 province count must be an integer from 1 to 127, got ${provinceCount}.`);
  }
}

function requireByte(value: number): void {
  if (!Number.isInteger(value) || value < 0 || value > 0xff) {
    throw new Error(`C64 RNG byte must be an integer from 0 to 255, got ${value}.`);
  }
}

function hasC64Neighbour(buffer: ReadonlyArray<number>, index: number): boolean {
  return (
    buffer[index - 1] !== C64_WATER_TILE ||
    buffer[index + 1] !== C64_WATER_TILE ||
    buffer[index + C64_MAP_WIDTH] !== C64_WATER_TILE ||
    buffer[index - C64_MAP_WIDTH] !== C64_WATER_TILE
  );
}

function placeSetupWater(buffer: Array<number>, nextRandomByte: () => number): void {
  for (let index = 0x14; index <= 0xff; index += 1) {
    buffer[index] = C64_EMPTY_TILE;
  }

  for (let index = 0x13; index >= 0; index -= 1) {
    buffer[index] = C64_WATER_TILE;
    buffer[0xf0 + index] = C64_WATER_TILE;

    if ((nextRandomByte() & 0x01) === 0) {
      buffer[0x14 + index] = C64_WATER_TILE;
    }

    if ((nextRandomByte() & 0x01) === 0) {
      buffer[0xdc + index] = C64_WATER_TILE;
    }
  }

  let rowStart = 0x14;
  for (let row = 0x0b; row >= 0; row -= 1) {
    buffer[rowStart] = C64_WATER_TILE;
    buffer[rowStart + 0x13] = C64_WATER_TILE;

    if ((nextRandomByte() & 0x01) === 0) {
      buffer[rowStart + 0x01] = C64_WATER_TILE;
    }

    if ((nextRandomByte() & 0x01) === 0) {
      buffer[rowStart + 0x12] = C64_WATER_TILE;
    }

    rowStart += C64_MAP_WIDTH;
  }

  for (let remaining = 0x08; remaining >= 0; remaining -= 1) {
    let index = nextRandomByte();
    while (buffer[index] !== C64_EMPTY_TILE) {
      index = nextRandomByte();
    }
    buffer[index] = C64_WATER_TILE;
  }

  for (let index = C64_SCAN_START; index < C64_SCAN_END; index += 1) {
    if (!hasC64Neighbour(buffer, index)) {
      buffer[index] = C64_WATER_TILE;
    }
  }
}

function placeProvinceSeeds(
  provinceCount: number,
  buffer: Array<number>,
  seedTiles: Array<number>,
  terrainIds: Array<number>,
  nextRandomByte: () => number
): void {
  for (let province = provinceCount; province > 0; province -= 1) {
    let index = nextRandomByte();
    do {
      index = (index + 1) & 0xff;
    } while (buffer[index] !== C64_EMPTY_TILE);

    buffer[index] = province;
    seedTiles[province] = index;

    let terrainId = nextRandomByte() & 0x07;
    while (terrainId === 0) {
      terrainId = nextRandomByte() & 0x07;
    }
    terrainIds[province] = terrainId;
  }
}

function tryGrowProvinceTile(
  buffer: Array<number>,
  sourceIndex: number,
  nextRandomByte: () => number
): number {
  let retryCounter = 0x04;
  let directionIndex = nextRandomByte() & 0x03;

  while (retryCounter > 0) {
    const targetIndex = sourceIndex + C64_DIRECTION_OFFSETS[directionIndex];
    if (buffer[targetIndex] === C64_EMPTY_TILE) {
      buffer[targetIndex] = buffer[sourceIndex] | C64_PENDING_OWNER_FLAG;
      return retryCounter;
    }

    directionIndex = (directionIndex - 1) & 0x03;
    retryCounter -= 1;
  }

  return retryCounter;
}

function runGrowth(
  buffer: Array<number>,
  nextRandomByte: () => number
): {
  readonly completed: boolean;
  readonly growthPreviousEmptyCounter: number;
  readonly growthRetryCounter: number;
} {
  let previousEmptyCounter = 0;
  let growthPreviousEmptyCounter = 0;
  let growthRetryCounter = 0;

  for (;;) {
    growthPreviousEmptyCounter = previousEmptyCounter;

    for (let index = C64_SCAN_START; index < C64_SCAN_END; index += 1) {
      const value = buffer[index];
      if (value >= C64_PENDING_OWNER_FLAG || value === C64_WATER_TILE) {
        continue;
      }

      growthRetryCounter = tryGrowProvinceTile(buffer, index, nextRandomByte);
    }

    let emptyCounter = 0;
    for (let index = C64_SCAN_START; index < C64_SCAN_END; index += 1) {
      const value = buffer[index];
      if (value < C64_PENDING_OWNER_FLAG) {
        continue;
      }

      if (value === C64_EMPTY_TILE) {
        emptyCounter += 1;
      } else {
        buffer[index] = value & 0x7f;
      }
    }

    if (emptyCounter === growthPreviousEmptyCounter) {
      return {
        completed: false,
        growthPreviousEmptyCounter,
        growthRetryCounter
      };
    }

    if (emptyCounter === 0) {
      return {
        completed: true,
        growthPreviousEmptyCounter,
        growthRetryCounter
      };
    }

    previousEmptyCounter = emptyCounter;
  }
}

function runGenerationAttempt(
  provinceCount: number,
  nextRandomByte: () => number,
  rngCounterAfter: number
): GenerationAttemptResult {
  const buffer = Array<number>(C64_MAP_BUFFER_SIZE).fill(C64_WATER_TILE);
  const seedTiles = Array<number>(provinceCount + 1).fill(0);
  const terrainIds = Array<number>(provinceCount + 1).fill(0);

  placeSetupWater(buffer, nextRandomByte);
  placeProvinceSeeds(provinceCount, buffer, seedTiles, terrainIds, nextRandomByte);

  const growth = runGrowth(buffer, nextRandomByte);
  if (!growth.completed) {
    return {
      map: null
    };
  }

  return {
    map: {
      visibleMap: buffer.slice(0, C64_VISIBLE_TILE_COUNT),
      seedTiles,
      terrainIds,
      rngCounterAfter,
      growthPreviousEmptyCounter: growth.growthPreviousEmptyCounter,
      growthRetryCounter: growth.growthRetryCounter
    }
  };
}

export function generateC64MapWithByteRng(
  provinceCount: number,
  rng: C64ByteRng
): C64GeneratedMap {
  requireProvinceCount(provinceCount);

  let rngCounterAfter = 0;
  const nextRandomByte = (): number => {
    const value = rng.nextByte();
    requireByte(value);
    rngCounterAfter = (rngCounterAfter + 1) & 0xff;
    return value;
  };

  for (;;) {
    const result = runGenerationAttempt(provinceCount, nextRandomByte, rngCounterAfter);
    if (result.map !== null) {
      return {
        ...result.map,
        rngCounterAfter
      };
    }
  }
}
