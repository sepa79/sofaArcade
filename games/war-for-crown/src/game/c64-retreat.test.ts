import { readFileSync } from 'node:fs';

import { describe, expect, it } from 'vitest';

import { c64RetreatDistribution } from './c64-retreat';

interface C64RetreatPlacementCaseFixture {
  readonly name: string;
  readonly setup: {
    readonly provinceCountC8A1: number;
    readonly survivorsC9D0C9D2?: number;
    readonly survivorsC9D3C9D5?: number;
    readonly markedProvinces: ReadonlyArray<number>;
  };
  readonly expected: {
    readonly addedByProvince: Readonly<Record<string, number>>;
  };
}

interface C64RetreatPlacementFixture {
  readonly fixture: 'main-retreat-placement-multiple-destinations';
  readonly cases: ReadonlyArray<C64RetreatPlacementCaseFixture>;
}

function loadFixture(): C64RetreatPlacementFixture {
  return JSON.parse(
    readFileSync(
      new URL('../../../../docs/war-for-crown/fixtures/main-retreat-placement-multiple-destinations.json', import.meta.url),
      'utf8'
    )
  ) as C64RetreatPlacementFixture;
}

function survivorCount(testCase: C64RetreatPlacementCaseFixture): number {
  const survivors = testCase.setup.survivorsC9D0C9D2 ?? testCase.setup.survivorsC9D3C9D5;
  if (survivors === undefined) {
    throw new Error(`Missing survivor count for fixture case ${testCase.name}.`);
  }
  return survivors;
}

function provinceIds(provinces: ReadonlyArray<number>): ReadonlyArray<string> {
  return provinces.map((province) => province.toString());
}

function scanOrder(provinceCount: number): ReadonlyArray<string> {
  return Array.from({ length: provinceCount }, (_, index) => (index + 1).toString());
}

describe('C64 retreat placement', () => {
  it.each(loadFixture().cases)('matches recovered C64 distribution for $name', (testCase) => {
    const distribution = c64RetreatDistribution({
      provinceIds: provinceIds(testCase.setup.markedProvinces),
      provinceScanOrder: scanOrder(testCase.setup.provinceCountC8A1),
      survivors: survivorCount(testCase)
    });

    expect(Object.fromEntries(
      distribution.map((addition) => [addition.provinceId, addition.addedSoldiers])
    )).toEqual(
      Object.fromEntries(
        Object.entries(testCase.expected.addedByProvince).map(([provinceId, soldiers]) => [
          provinceId.replace('province', ''),
          soldiers
        ])
      )
    );
  });
});
