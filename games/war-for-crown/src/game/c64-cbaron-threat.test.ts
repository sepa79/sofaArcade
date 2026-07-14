import { describe, expect, it } from 'vitest';

import { ROYALIST_OWNER_ID } from './owners';

import { c64CbaronRequiredStrength } from './c64-cbaron-threat';
import type { OwnerId } from './owners';
import type { GameConfig, ProvinceState } from './types';

const baseConfig = {
  terrainInfluence: 'both',
  royalistAttitude: 'hostile',
  royalistAttackCooperation: 'single-source'
} satisfies Pick<GameConfig, 'terrainInfluence' | 'royalistAttitude' | 'royalistAttackCooperation'>;

function province(
  id: string,
  ownerId: OwnerId,
  soldiers: number,
  neighbours: ReadonlyArray<string>
): ProvinceState {
  return {
    id,
    terrainId: 'plains',
    ownerId,
    villages: 2,
    soldiers,
    fortificationLevel: 'none',
    upgradedFortificationThisTurn: false,
    neighbours
  };
}

describe('C64 cbaron required-strength worklist', () => {
  it('selects the strongest adjacent owner through the L634A owner scan', () => {
    const provinces = [
      province('frontier', 'p1', 10, ['p2-source', 'p3-source']),
      province('p2-source', 'p2', 3, ['frontier']),
      province('p3-source', 'p3', 5, ['frontier'])
    ];

    expect(c64CbaronRequiredStrength({
      provinces,
      activeOwnerId: 'p1',
      ownerSlots: [
        { ownerId: ROYALIST_OWNER_ID, isComputer: false },
        { ownerId: 'p1', isComputer: false },
        { ownerId: 'p2', isComputer: false },
        { ownerId: 'p3', isComputer: true }
      ],
      worklistProvinceIds: ['frontier'],
      config: baseConfig
    })).toEqual({
      totalRequiredSoldiers: 4,
      provinceRequirements: [{
        provinceId: 'frontier',
        strongestOwnerSlot: 3,
        strongestOwnerId: 'p3',
        strongestAdjacentMobileSoldiers: 4,
        requiredSoldiers: 4
      }]
    });
  });

  it('uses one strongest royalist source when hostile cooperation is off', () => {
    const provinces = [
      province('frontier', 'p1', 10, ['royal-1', 'royal-2']),
      province('royal-1', ROYALIST_OWNER_ID, 5, ['frontier']),
      province('royal-2', ROYALIST_OWNER_ID, 8, ['frontier'])
    ];

    expect(c64CbaronRequiredStrength({
      provinces,
      activeOwnerId: 'p1',
      ownerSlots: [
        { ownerId: ROYALIST_OWNER_ID, isComputer: false },
        { ownerId: 'p1', isComputer: false }
      ],
      worklistProvinceIds: ['frontier'],
      config: baseConfig
    }).provinceRequirements[0]).toEqual({
      provinceId: 'frontier',
      strongestOwnerSlot: 0,
      strongestOwnerId: ROYALIST_OWNER_ID,
      strongestAdjacentMobileSoldiers: 7,
      requiredSoldiers: 8
    });
  });

  it('sums all adjacent royalist mobile soldiers when hostile cooperation is on', () => {
    const provinces = [
      province('frontier', 'p1', 10, ['royal-1', 'royal-2']),
      province('royal-1', ROYALIST_OWNER_ID, 5, ['frontier']),
      province('royal-2', ROYALIST_OWNER_ID, 8, ['frontier'])
    ];

    const result = c64CbaronRequiredStrength({
      provinces,
      activeOwnerId: 'p1',
      ownerSlots: [
        { ownerId: ROYALIST_OWNER_ID, isComputer: false },
        { ownerId: 'p1', isComputer: false }
      ],
      worklistProvinceIds: ['frontier'],
      config: {
        ...baseConfig,
        royalistAttackCooperation: 'combined-sources'
      }
    });

    expect(result.provinceRequirements[0]?.strongestAdjacentMobileSoldiers).toBe(11);
    expect(result.totalRequiredSoldiers).toBe(12);
  });

  it('treats non-hostile royalists as zero adjacent threat', () => {
    const provinces = [
      province('frontier', 'p1', 10, ['royal']),
      province('royal', ROYALIST_OWNER_ID, 8, ['frontier'])
    ];

    expect(c64CbaronRequiredStrength({
      provinces,
      activeOwnerId: 'p1',
      ownerSlots: [
        { ownerId: ROYALIST_OWNER_ID, isComputer: false },
        { ownerId: 'p1', isComputer: false }
      ],
      worklistProvinceIds: ['frontier'],
      config: {
        ...baseConfig,
        royalistAttitude: 'neutral'
      }
    })).toEqual({
      totalRequiredSoldiers: 0,
      provinceRequirements: [{
        provinceId: 'frontier',
        strongestOwnerSlot: 0,
        strongestOwnerId: ROYALIST_OWNER_ID,
        strongestAdjacentMobileSoldiers: 0,
        requiredSoldiers: 0
      }]
    });
  });

  it('scans marked provinces in descending C64 province order and sums requirements', () => {
    const provinces = [
      province('active-low', 'p1', 10, ['enemy-low']),
      province('enemy-low', 'p2', 3, ['active-low']),
      province('enemy-high', 'p2', 5, ['active-high']),
      province('active-high', 'p1', 10, ['enemy-high'])
    ];

    const result = c64CbaronRequiredStrength({
      provinces,
      activeOwnerId: 'p1',
      ownerSlots: [
        { ownerId: ROYALIST_OWNER_ID, isComputer: false },
        { ownerId: 'p1', isComputer: false },
        { ownerId: 'p2', isComputer: false }
      ],
      worklistProvinceIds: ['active-low', 'active-high'],
      config: baseConfig
    });

    expect(result.totalRequiredSoldiers).toBe(6);
    expect(result.provinceRequirements.map((requirement) => requirement.provinceId)).toEqual([
      'active-high',
      'active-low'
    ]);
  });

  it('wraps the L62BC total requirement as a three-byte C64 value', () => {
    const provinces = [
      province('frontier-low', 'p1', 1, ['enemy-low']),
      province('enemy-low', 'p2', 8000001, ['frontier-low']),
      province('frontier-high', 'p1', 1, ['enemy-high']),
      province('enemy-high', 'p2', 8000001, ['frontier-high'])
    ];

    const result = c64CbaronRequiredStrength({
      provinces,
      activeOwnerId: 'p1',
      ownerSlots: [
        { ownerId: ROYALIST_OWNER_ID, isComputer: false },
        { ownerId: 'p1', isComputer: true },
        { ownerId: 'p2', isComputer: true }
      ],
      worklistProvinceIds: ['frontier-low', 'frontier-high'],
      config: baseConfig
    });

    expect(result.provinceRequirements.map((requirement) => requirement.requiredSoldiers)).toEqual([
      9142857,
      9142857
    ]);
    expect(result.totalRequiredSoldiers).toBe(1508498);
  });

  it('fails on duplicate owner slots instead of guessing C64 slot order', () => {
    const provinces = [
      province('frontier', 'p1', 10, ['enemy']),
      province('enemy', 'p2', 3, ['frontier'])
    ];

    expect(() => c64CbaronRequiredStrength({
      provinces,
      activeOwnerId: 'p1',
      ownerSlots: [
        { ownerId: ROYALIST_OWNER_ID, isComputer: false },
        { ownerId: 'p1', isComputer: false },
        { ownerId: 'p2', isComputer: false },
        { ownerId: 'p2', isComputer: true }
      ],
      worklistProvinceIds: ['frontier'],
      config: baseConfig
    })).toThrow('Duplicate C64 cbaron owner slot for p2.');
  });
});
