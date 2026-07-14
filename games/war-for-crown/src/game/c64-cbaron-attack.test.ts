import { describe, expect, it } from 'vitest';

import { ROYALIST_OWNER_ID } from './owners';

import {
  chooseC64CbaronAttack,
  c64CbaronL63CECapRequirementByMoney,
  type C64CbaronAttackInput,
  type C64CbaronAttackPlayerSlot
} from './c64-cbaron-attack';
import type { OwnerId } from './owners';
import type { GameConfig, ProvinceId, ProvinceState } from './types';

const baseConfig = {
  terrainInfluence: 'both',
  royalistAttitude: 'neutral',
  royalistAttackCooperation: 'single-source'
} satisfies Pick<GameConfig, 'terrainInfluence' | 'royalistAttitude' | 'royalistAttackCooperation'>;

function province(
  id: ProvinceId,
  ownerId: OwnerId,
  soldiers: number,
  neighbours: ReadonlyArray<ProvinceId>,
  villages = 2
): ProvinceState {
  return {
    id,
    terrainId: 'plains',
    ownerId,
    villages,
    soldiers,
    fortificationLevel: 'none',
    upgradedFortificationThisTurn: false,
    neighbours
  };
}

function attackInput(
  provinces: ReadonlyArray<ProvinceState>,
  playerSlots: ReadonlyArray<C64CbaronAttackPlayerSlot>,
  overrides: Partial<C64CbaronAttackInput> = {}
): C64CbaronAttackInput {
  return {
    provinces,
    activeOwnerId: 'p1',
    activeMoney: 20,
    ownerSlots: [
      { ownerId: ROYALIST_OWNER_ID, isComputer: false },
      { ownerId: 'p1', isComputer: true },
      { ownerId: 'p2', isComputer: true }
    ],
    playerSlots,
    lockedProvinceIds: [],
    rngBytes: [0x7b, 0x7b, 0x7b, 0x7b],
    config: baseConfig,
    ...overrides
  };
}

describe('C64 cbaron attack selection', () => {
  it('matches full $5803 two-source line fixture without pruning the only target', () => {
    const result = chooseC64CbaronAttack(attackInput([
      province('1', 'p1', 50, ['2']),
      province('2', 'p2', 1, ['1', '3']),
      province('3', 'p1', 50, ['2'])
    ], [
      { ownerId: 'p1', homeProvinceId: '1', provinceCount: 2 },
      { ownerId: 'p2', homeProvinceId: '2', provinceCount: 1 }
    ]));

    expect(result?.targetProvinceId).toBe('2');
    expect(result?.sourceProvinceIds).toEqual(['3', '1']);
    expect(result?.attackingSoldiers).toBe(98);
    expect(result?.defenderSoldiers).toBe(1);
    expect(result?.rngBytesConsumed).toBe(1);
    expect(result?.flagsByProvinceId).toMatchObject({
      '1': 0x10,
      '2': 0x00,
      '3': 0x10
    });
  });

  it('matches full $5803 competing-frontier source preservation fixture', () => {
    const result = chooseC64CbaronAttack(attackInput([
      province('1', 'p1', 50, ['2']),
      province('2', 'p2', 1, ['1', '3']),
      province('3', 'p1', 50, ['2', '4']),
      province('4', 'p2', 1, ['3'])
    ], [
      { ownerId: 'p1', homeProvinceId: '1', provinceCount: 2 },
      { ownerId: 'p2', homeProvinceId: '2', provinceCount: 2 }
    ]));

    expect(result?.targetProvinceId).toBe('2');
    expect(result?.sourceProvinceIds).toEqual(['1']);
    expect(result?.attackingSoldiers).toBe(49);
    expect(result?.rngBytesConsumed).toBe(2);
    expect(result?.flagsByProvinceId).toMatchObject({
      '1': 0x10,
      '2': 0x00,
      '3': 0x00,
      '4': 0x02
    });
  });

  it('keeps the lower C64 province id on an equal L6808 score', () => {
    const result = chooseC64CbaronAttack(attackInput([
      province('1', 'p2', 4, ['2']),
      province('2', 'p1', 20, ['1', '3'], 4),
      province('3', 'p2', 4, ['2'])
    ], [
      { ownerId: 'p1', homeProvinceId: '2', provinceCount: 1 },
      { ownerId: 'p2', homeProvinceId: null, provinceCount: 2 }
    ]));

    expect(result?.targetProvinceId).toBe('1');
    expect(result?.rngBytesConsumed).toBe(2);
  });

  it('consumes one L6808 RNG byte for each accepted target candidate', () => {
    const result = chooseC64CbaronAttack(attackInput([
      province('1', 'p2', 4, ['2']),
      province('2', 'p1', 20, ['1', '3'], 4),
      province('3', 'p2', 4, ['2'])
    ], [
      { ownerId: 'p1', homeProvinceId: '2', provinceCount: 1 },
      { ownerId: 'p2', homeProvinceId: null, provinceCount: 2 }
    ], {
      rngBytes: [0x7b, 0x7b]
    }));

    expect(result?.targetProvinceId).toBe('1');
    expect(result?.rngBytesConsumed).toBe(2);
  });

  it('matches the L63CE money cap byte quirk', () => {
    expect(c64CbaronL63CECapRequirementByMoney(10, 4)).toBe(4);
    expect(c64CbaronL63CECapRequirementByMoney(4, 10)).toBe(4);
    expect(c64CbaronL63CECapRequirementByMoney(0x0104, 0x0200)).toBe(0x0101);
  });
});
