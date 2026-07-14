import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { C64_MAP_HEIGHT, C64_MAP_WIDTH, generateC64MapWithByteRng } from './c64-map-generator';

interface C64MapFixture {
  readonly setup: {
    readonly provinceCountC8a1: number;
  };
  readonly expected: {
    readonly rngCounter02fbAfter: string;
    readonly growthPreviousEmptyCounter520a: string;
    readonly growthRetryCounter520b: string;
    readonly mapRowsHex: ReadonlyArray<ReadonlyArray<string>>;
    readonly seedTilesC512ToC530: ReadonlyArray<string>;
    readonly terrainC576ToC594: ReadonlyArray<string>;
  };
}

function loadSequentialMapFixture(): C64MapFixture {
  return JSON.parse(
    readFileSync(
      new URL('../../../../docs/war-for-crown/fixtures/menue-map-generation-sequential-rng.json', import.meta.url),
      'utf8'
    )
  ) as C64MapFixture;
}

function createSequentialByteRng(): { readonly nextByte: () => number } {
  let value = 0;
  return {
    nextByte: () => {
      value = (value + 1) & 0xff;
      return value;
    }
  };
}

function toHexByte(value: number): string {
  return value.toString(16).padStart(2, '0');
}

function toMapRowsHex(values: ReadonlyArray<number>): ReadonlyArray<ReadonlyArray<string>> {
  const rows: string[][] = [];
  for (let y = 0; y < C64_MAP_HEIGHT; y += 1) {
    const row: string[] = [];
    for (let x = 0; x < C64_MAP_WIDTH; x += 1) {
      row.push(toHexByte(values[(y * C64_MAP_WIDTH) + x]));
    }
    rows.push(row);
  }
  return rows;
}

describe('C64 map generator', () => {
  it('matches the C64 sequential-RNG golden fixture byte for byte', () => {
    const fixture = loadSequentialMapFixture();
    const generated = generateC64MapWithByteRng(
      fixture.setup.provinceCountC8a1,
      createSequentialByteRng()
    );

    expect(toHexByte(generated.rngCounterAfter)).toBe(fixture.expected.rngCounter02fbAfter.slice(2));
    expect(toHexByte(generated.growthPreviousEmptyCounter)).toBe(
      fixture.expected.growthPreviousEmptyCounter520a.slice(2)
    );
    expect(toHexByte(generated.growthRetryCounter)).toBe(
      fixture.expected.growthRetryCounter520b.slice(2)
    );
    expect(toMapRowsHex(generated.visibleMap)).toEqual(fixture.expected.mapRowsHex);
    expect(generated.seedTiles.map(toHexByte)).toEqual(fixture.expected.seedTilesC512ToC530);
    expect(generated.terrainIds.map(toHexByte)).toEqual(fixture.expected.terrainC576ToC594);
  });
});
