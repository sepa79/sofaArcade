import { describe, expect, it } from 'vitest';

import { ROYALIST_OWNER_ID } from './owners';

import {
  runC64CbaronL6A64Cleanup,
  runC64CbaronL6207FortCompensation,
  runC64CbaronL6BC5TargetMarking,
  runC64CbaronL6AC3SurplusRedistribution,
  runC64CbaronL6C49Placement,
  runC64CbaronL6DFAFallback,
  runC64CbaronMovement
} from './c64-cbaron-movement';
import type { OwnerId } from './owners';
import type { FortificationLevel, GameConfig, ProvinceId, ProvinceState } from './types';

const baseConfig = {
  terrainInfluence: 'both',
  royalistAttitude: 'neutral',
  royalistAttackCooperation: 'single-source'
} satisfies Pick<GameConfig, 'terrainInfluence' | 'royalistAttitude' | 'royalistAttackCooperation'>;

const ownerSlots = [
  { ownerId: ROYALIST_OWNER_ID, isComputer: false },
  { ownerId: 'p1', isComputer: true },
  { ownerId: 'p2', isComputer: true }
] as const;

const friendlyPlacementConfig = {
  terrainInfluence: 'both',
  royalistAttitude: 'friendly'
} satisfies Pick<GameConfig, 'terrainInfluence' | 'royalistAttitude'>;

const neutralPlacementConfig = {
  terrainInfluence: 'both',
  royalistAttitude: 'neutral'
} satisfies Pick<GameConfig, 'terrainInfluence' | 'royalistAttitude'>;

function province(
  id: ProvinceId,
  ownerId: OwnerId,
  soldiers: number,
  neighbours: ReadonlyArray<ProvinceId>,
  villages = 2,
  fortificationLevel: FortificationLevel = 'none'
): ProvinceState {
  return {
    id,
    terrainId: 'plains',
    ownerId,
    villages,
    soldiers,
    fortificationLevel,
    upgradedFortificationThisTurn: false,
    neighbours
  };
}

function movementSoldiers(provinces: ReadonlyArray<ProvinceState>): Readonly<Record<ProvinceId, number>> {
  return Object.fromEntries(provinces.map((candidate) => [candidate.id, candidate.soldiers]));
}

function movementOwners(provinces: ReadonlyArray<ProvinceState>): Readonly<Record<ProvinceId, OwnerId>> {
  return Object.fromEntries(provinces.map((candidate) => [candidate.id, candidate.ownerId]));
}

describe('C64 cbaron movement', () => {
  it('matches the full $5806 surplus simple-return fixture', () => {
    const result = runC64CbaronMovement({
      provinces: [
        province('1', 'p1', 5, ['2']),
        province('2', 'p1', 6, ['1', '3']),
        province('3', 'p2', 3, ['2'])
      ],
      activeOwnerId: 'p1',
      activeHomeProvinceId: '1',
      activeMoney: 0,
      turnNumber: 1,
      ownerSlots,
      rememberedTargetProvinceId: null,
      ca61: 0x00,
      ca62: 0x00,
      maxHomeFortificationLevel: 'citadel',
      maxProvinceFortificationLevel: 'watchtower',
      config: baseConfig
    });

    expect(result.finalMoney).toBe(0);
    expect(result.fortificationUpgrades).toEqual([]);
    expect(result.pulledMobileSoldiers).toBe(9);
    expect(result.defensiveRequirement).toBe(2);
    expect(movementSoldiers(result.provinces)).toEqual({
      '1': 1,
      '2': 10,
      '3': 3
    });
    expect(result.rememberedTargetProvinceId).toBe('3');
    expect(result.rememberedTargetSoldiers).toBe(3);
    expect(result.flagsByProvinceId).toMatchObject({
      '1': 0x00,
      '2': 0x00,
      '3': 0x00
    });
  });

  it('matches the full $5806 underpowered single-front fixture', () => {
    const result = runC64CbaronMovement({
      provinces: [
        province('1', 'p1', 2, ['2']),
        province('2', 'p2', 20, ['1'])
      ],
      activeOwnerId: 'p1',
      activeHomeProvinceId: '1',
      activeMoney: 0,
      turnNumber: 1,
      ownerSlots,
      rememberedTargetProvinceId: null,
      ca61: 0x00,
      ca62: 0x00,
      maxHomeFortificationLevel: 'citadel',
      maxProvinceFortificationLevel: 'watchtower',
      config: baseConfig
    });

    expect(result.finalMoney).toBe(0);
    expect(result.fortificationUpgrades).toEqual([]);
    expect(result.pulledMobileSoldiers).toBe(1);
    expect(result.defensiveRequirement).toBe(21);
    expect(movementSoldiers(result.provinces)).toEqual({
      '1': 2,
      '2': 20
    });
    expect(result.rememberedTargetProvinceId).toBeNull();
    expect(result.flagsByProvinceId).toMatchObject({
      '1': 0x00,
      '2': 0x00
    });
  });

  it('matches the full $5806 underpowered single-home money fixture', () => {
    const result = runC64CbaronMovement({
      provinces: [
        province('1', 'p1', 2, ['2']),
        province('2', 'p2', 20, ['1'])
      ],
      activeOwnerId: 'p1',
      activeHomeProvinceId: '1',
      activeMoney: 5,
      turnNumber: 1,
      ownerSlots,
      rememberedTargetProvinceId: null,
      ca61: 0x00,
      ca62: 0x00,
      maxHomeFortificationLevel: 'citadel',
      maxProvinceFortificationLevel: 'watchtower',
      config: baseConfig
    });

    expect(result.finalMoney).toBe(0);
    expect(result.fortificationUpgrades).toEqual([]);
    expect(result.pulledMobileSoldiers).toBe(1);
    expect(result.defensiveRequirement).toBe(21);
    expect(movementSoldiers(result.provinces)).toEqual({
      '1': 7,
      '2': 20
    });
    expect(result.rememberedTargetProvinceId).toBeNull();
    expect(result.flagsByProvinceId).toMatchObject({
      '1': 0x00,
      '2': 0x00
    });
  });

  it('moves every pulled soldier to a lone non-home frontier through $5FD2', () => {
    const result = runC64CbaronMovement({
      provinces: [
        province('1', 'p1', 1, ['2']),
        province('2', 'p1', 2, ['1', '3']),
        province('3', 'p2', 20, ['2'])
      ],
      activeOwnerId: 'p1',
      activeHomeProvinceId: '1',
      activeMoney: 0,
      turnNumber: 1,
      ownerSlots,
      rememberedTargetProvinceId: null,
      ca61: 0x00,
      ca62: 0x00,
      maxHomeFortificationLevel: 'citadel',
      maxProvinceFortificationLevel: 'watchtower',
      config: baseConfig
    });

    expect(result.finalMoney).toBe(0);
    expect(result.pulledMobileSoldiers).toBe(1);
    expect(result.defensiveRequirement).toBe(21);
    expect(movementSoldiers(result.provinces)).toEqual({
      '1': 1,
      '2': 2,
      '3': 20
    });
  });

  it('uses the C64 player-slot index when $5FD2 rolls back a fort upgrade', () => {
    const result = runC64CbaronMovement({
      provinces: [
        province('1', 'p1', 1, []),
        province('2', 'p2', 2, ['3', '4']),
        province('3', 'p2', 2, ['2']),
        province('4', 'p1', 20, ['2'])
      ],
      activeOwnerId: 'p2',
      activeHomeProvinceId: '3',
      activeMoney: 20,
      turnNumber: 25,
      ownerSlots,
      rememberedTargetProvinceId: null,
      ca61: 0x00,
      ca62: 0x00,
      maxHomeFortificationLevel: 'citadel',
      maxProvinceFortificationLevel: 'citadel',
      config: baseConfig
    });

    expect(result.finalMoney).toBe(20);
    expect(result.fortificationUpgrades).toEqual([]);
    expect(result.pulledMobileSoldiers).toBe(2);
    expect(result.defensiveRequirement).toBe(16);
    expect(movementSoldiers(result.provinces)).toEqual({
      '1': 1,
      '2': 3,
      '3': 1,
      '4': 20
    });
    expect(result.provinces[1]?.fortificationLevel).toBe('none');
  });

  it('matches the full $5806 underpowered multifront fixture', () => {
    const result = runC64CbaronMovement({
      provinces: [
        province('1', 'p2', 20, ['2']),
        province('2', 'p1', 2, ['1', '3']),
        province('3', 'p1', 2, ['2', '4']),
        province('4', 'p2', 20, ['3'])
      ],
      activeOwnerId: 'p1',
      activeHomeProvinceId: '2',
      activeMoney: 0,
      turnNumber: 1,
      ownerSlots,
      rememberedTargetProvinceId: null,
      ca61: 0x00,
      ca62: 0x00,
      maxHomeFortificationLevel: 'citadel',
      maxProvinceFortificationLevel: 'watchtower',
      config: baseConfig
    });

    expect(result.finalMoney).toBe(0);
    expect(result.fortificationUpgrades).toEqual([]);
    expect(result.pulledMobileSoldiers).toBe(2);
    expect(result.defensiveRequirement).toBe(42);
    expect(movementSoldiers(result.provinces)).toEqual({
      '1': 20,
      '2': 3,
      '3': 1,
      '4': 20
    });
    expect(result.rememberedTargetProvinceId).toBeNull();
    expect(result.flagsByProvinceId).toMatchObject({
      '1': 0x00,
      '2': 0x00,
      '3': 0x04,
      '4': 0x00
    });
  });

  it('matches the full $5806 L5EA4 two-candidate fixture', () => {
    const result = runC64CbaronMovement({
      provinces: [
        province('1', 'p2', 1, ['2']),
        province('2', 'p1', 2, ['1', '3']),
        province('3', 'p1', 2, ['2', '4']),
        province('4', 'p1', 2, ['3', '5']),
        province('5', 'p2', 20, ['4'])
      ],
      activeOwnerId: 'p1',
      activeHomeProvinceId: '3',
      activeMoney: 0,
      turnNumber: 1,
      ownerSlots,
      rememberedTargetProvinceId: null,
      ca61: 0x00,
      ca62: 0x00,
      maxHomeFortificationLevel: 'citadel',
      maxProvinceFortificationLevel: 'watchtower',
      config: baseConfig
    });

    expect(result.finalMoney).toBe(0);
    expect(result.fortificationUpgrades).toEqual([]);
    expect(result.pulledMobileSoldiers).toBe(3);
    expect(result.defensiveRequirement).toBe(21);
    expect(movementSoldiers(result.provinces)).toEqual({
      '1': 1,
      '2': 4,
      '3': 1,
      '4': 1,
      '5': 20
    });
    expect(result.rememberedTargetProvinceId).toBe('1');
    expect(result.rememberedTargetSoldiers).toBe(1);
    expect(result.flagsByProvinceId).toMatchObject({
      '1': 0x00,
      '2': 0x00,
      '3': 0x00,
      '4': 0x04,
      '5': 0x00
    });
  });

  it('runs the L5E5D fort-compensation spending loop during movement', () => {
    const result = runC64CbaronMovement({
      provinces: [
        province('1', 'p2', 30, ['2']),
        province('2', 'p1', 2, ['1', '3']),
        province('3', 'p1', 2, ['2', '4']),
        province('4', 'p2', 20, ['3'])
      ],
      activeOwnerId: 'p1',
      activeHomeProvinceId: '2',
      activeMoney: 20,
      turnNumber: 25,
      ownerSlots,
      rememberedTargetProvinceId: null,
      ca61: 0x00,
      ca62: 0x00,
      maxHomeFortificationLevel: 'citadel',
      maxProvinceFortificationLevel: 'citadel',
      config: baseConfig
    });

    const fortificationByProvince = Object.fromEntries(
      result.provinces.map((candidate) => [candidate.id, candidate.fortificationLevel])
    );

    expect(result.finalMoney).toBe(0);
    expect(result.fortificationUpgrades).toEqual([]);
    expect(result.pulledMobileSoldiers).toBe(2);
    expect(result.defensiveRequirement).toBe(54);
    expect(movementSoldiers(result.provinces)).toEqual({
      '1': 30,
      '2': 23,
      '3': 1,
      '4': 20
    });
    expect(fortificationByProvince).toMatchObject({
      '2': 'none',
      '3': 'none'
    });
    expect(result.flagsByProvinceId).toMatchObject({
      '2': 0x00,
      '3': 0x04
    });
  });

  it('matches the direct L6C49 friendly target placement fixture', () => {
    const result = runC64CbaronL6C49Placement({
      provinces: [
        province('1', ROYALIST_OWNER_ID, 1, ['2']),
        province('2', 'p1', 1, ['1', '3']),
        province('3', ROYALIST_OWNER_ID, 1, ['2', '4']),
        province('4', 'p1', 1, ['3', '5']),
        province('5', ROYALIST_OWNER_ID, 1, ['4'], 8)
      ],
      activeOwnerId: 'p1',
      flagsByProvinceId: {
        '1': 0x00,
        '2': 0x01,
        '3': 0x08,
        '4': 0x01,
        '5': 0x00
      },
      surplusSoldiers: 5,
      rememberedTargetProvinceId: null,
      ca61: 0xff,
      ca62: 0x00,
      config: friendlyPlacementConfig
    });

    expect(result.selectedTargetProvinceId).toBe('3');
    expect(result.selectedStagingProvinceId).toBe('4');
    expect(result.selectedAmount).toBe(1);
    expect(result.remainingSurplusSoldiers).toBe(4);
    expect(movementSoldiers(result.provinces)).toEqual({
      '1': 1,
      '2': 1,
      '3': 1,
      '4': 2,
      '5': 1
    });
    expect(result.flagsByProvinceId).toEqual({
      '1': 0x00,
      '2': 0x01,
      '3': 0x00,
      '4': 0x01,
      '5': 0x00
    });
    expect(result.rememberedTargetProvinceId).toBe('3');
    expect(result.rememberedTargetSoldiers).toBe(1);
  });

  it('matches the direct L6C49 low-16 placement score overflow fixture', () => {
    const result = runC64CbaronL6C49Placement({
      provinces: [
        province('1', ROYALIST_OWNER_ID, 1, ['4'], 255),
        province('2', ROYALIST_OWNER_ID, 1, ['4'], 255),
        province('3', ROYALIST_OWNER_ID, 1, ['4'], 255),
        province('4', 'p1', 1, ['1', '2', '3', '5']),
        province('5', ROYALIST_OWNER_ID, 1, ['4', '6'], 255),
        province('6', 'p1', 1, ['5', '7', '8', '9']),
        province('7', ROYALIST_OWNER_ID, 1, ['6'], 1),
        province('8', ROYALIST_OWNER_ID, 1, ['6'], 1),
        province('9', ROYALIST_OWNER_ID, 1, ['6'], 1)
      ],
      activeOwnerId: 'p1',
      flagsByProvinceId: {
        '1': 0x00,
        '2': 0x00,
        '3': 0x00,
        '4': 0x01,
        '5': 0x08,
        '6': 0x01,
        '7': 0x00,
        '8': 0x00,
        '9': 0x00
      },
      surplusSoldiers: 5,
      rememberedTargetProvinceId: null,
      ca61: 0xff,
      ca62: 0x00,
      config: friendlyPlacementConfig,
      connectivityClassOverrideByTargetId: {
        '5': 6
      }
    });

    expect(result.selectedTargetProvinceId).toBe('5');
    expect(result.selectedStagingProvinceId).toBe('4');
    expect(result.selectedAmount).toBe(1);
    expect(result.remainingSurplusSoldiers).toBe(4);
    expect(movementSoldiers(result.provinces)).toMatchObject({
      '4': 2,
      '6': 1
    });
    expect(result.flagsByProvinceId).toMatchObject({
      '4': 0x01,
      '5': 0x00,
      '6': 0x01
    });
    expect(result.rememberedTargetProvinceId).toBe('5');
    expect(result.rememberedTargetSoldiers).toBe(1);
  });

  it('uses L6484 target requirement arithmetic for non-royalist L6C49 targets', () => {
    const result = runC64CbaronL6C49Placement({
      provinces: [
        province('1', 'p1', 1, ['2']),
        province('2', 'p2', 20, ['1'])
      ],
      activeOwnerId: 'p1',
      flagsByProvinceId: {
        '1': 0x01,
        '2': 0x08
      },
      surplusSoldiers: 30,
      rememberedTargetProvinceId: null,
      ca61: 0x00,
      ca62: 0x01,
      config: neutralPlacementConfig
    });

    expect(result.selectedTargetProvinceId).toBe('2');
    expect(result.selectedStagingProvinceId).toBe('1');
    expect(result.selectedAmount).toBe(22);
    expect(result.remainingSurplusSoldiers).toBe(8);
    expect(movementSoldiers(result.provinces)).toEqual({
      '1': 23,
      '2': 20
    });
    expect(result.rememberedTargetProvinceId).toBe('2');
    expect(result.rememberedTargetSoldiers).toBe(20);
  });

  it('places the full L6C49 surplus when target need equals surplus', () => {
    const result = runC64CbaronL6C49Placement({
      provinces: [
        province('1', 'p1', 1, ['2']),
        province('2', 'p2', 20, ['1'])
      ],
      activeOwnerId: 'p1',
      flagsByProvinceId: {
        '1': 0x01,
        '2': 0x08
      },
      surplusSoldiers: 22,
      rememberedTargetProvinceId: null,
      ca61: 0x00,
      ca62: 0x01,
      config: neutralPlacementConfig
    });

    expect(result.selectedTargetProvinceId).toBe('2');
    expect(result.selectedStagingProvinceId).toBe('1');
    expect(result.selectedAmount).toBe(22);
    expect(result.remainingSurplusSoldiers).toBe(0);
    expect(movementSoldiers(result.provinces)).toEqual({
      '1': 23,
      '2': 20
    });
  });

  it('marks L6BC5 targets when remaining need is below surplus', () => {
    const result = runC64CbaronL6BC5TargetMarking({
      provinces: [
        province('1', 'p1', 3, ['2']),
        province('2', 'p2', 20, ['1'])
      ],
      activeOwnerId: 'p1',
      flagsByProvinceId: {
        '1': 0x01,
        '2': 0x10
      },
      surplusSoldiers: 21,
      ca61: 0x00,
      ca62: 0x01,
      config: neutralPlacementConfig
    });

    expect(result.candidateCount).toBe(1);
    expect(result.targetNeedsByProvinceId).toEqual({
      '2': 20
    });
    expect(result.flagsByProvinceId).toEqual({
      '1': 0x01,
      '2': 0x18
    });
  });

  it('accepts L6BC5 targets when remaining need equals surplus', () => {
    const result = runC64CbaronL6BC5TargetMarking({
      provinces: [
        province('1', 'p1', 3, ['2']),
        province('2', 'p2', 20, ['1'])
      ],
      activeOwnerId: 'p1',
      flagsByProvinceId: {
        '1': 0x01,
        '2': 0x10
      },
      surplusSoldiers: 20,
      ca61: 0x00,
      ca62: 0x01,
      config: neutralPlacementConfig
    });

    expect(result.candidateCount).toBe(1);
    expect(result.targetNeedsByProvinceId).toEqual({
      '2': 20
    });
    expect(result.flagsByProvinceId).toEqual({
      '1': 0x01,
      '2': 0x18
    });
  });

  it('matches the direct L6AC3 post-L63B9 local requirement fixture', () => {
    const result = runC64CbaronL6AC3SurplusRedistribution({
      provinces: [
        province('1', 'p1', 1, ['2']),
        province('2', 'p1', 10, ['1', '3']),
        province('3', 'p2', 3, ['2'])
      ],
      activeOwnerId: 'p1',
      ownerSlots,
      flagsByProvinceId: {
        '1': 0x00,
        '2': 0x20,
        '3': 0x00
      },
      rememberedTargetProvinceId: null,
      ca61: 0x00,
      ca62: 0x00,
      config: baseConfig
    });

    expect(result.selectedProvinceId).toBe('2');
    expect(result.localRequirement).toBe(2);
    expect(result.initialSurplusSoldiers).toBe(7);
  });

  it('matches the direct L6AC3 surplus-marker redistribution fixture', () => {
    const result = runC64CbaronL6AC3SurplusRedistribution({
      provinces: [
        province('1', 'p1', 1, ['2']),
        province('2', 'p1', 10, ['1', '3']),
        province('3', 'p2', 3, ['2'])
      ],
      activeOwnerId: 'p1',
      ownerSlots,
      flagsByProvinceId: {
        '1': 0x00,
        '2': 0x20,
        '3': 0x00
      },
      rememberedTargetProvinceId: null,
      ca61: 0x00,
      ca62: 0x00,
      config: baseConfig
    });

    expect(result.scratchSurplusSoldiers).toBe(6);
    expect(movementSoldiers(result.provinces)).toEqual({
      '1': 1,
      '2': 10,
      '3': 3
    });
    expect(result.rememberedTargetProvinceId).toBe('3');
    expect(result.rememberedTargetSoldiers).toBe(3);
    expect(result.flagsByProvinceId).toEqual({
      '1': 0x00,
      '2': 0x00,
      '3': 0x00
    });
  });

  it('returns L6DF2 remainder to the first remembered staging province', () => {
    const result = runC64CbaronL6AC3SurplusRedistribution({
      provinces: [
        province('1', 'p1', 30, ['2', '3']),
        province('2', 'p1', 1, ['1', '4']),
        province('3', 'p1', 1, ['1', '5']),
        province('4', 'p2', 3, ['2']),
        province('5', 'p2', 4, ['3'])
      ],
      activeOwnerId: 'p1',
      ownerSlots,
      flagsByProvinceId: {
        '1': 0x20,
        '2': 0x00,
        '3': 0x00,
        '4': 0x00,
        '5': 0x00
      },
      rememberedTargetProvinceId: null,
      ca61: 0x00,
      ca62: 0x01,
      config: baseConfig
    });

    expect(result.initialSurplusSoldiers).toBe(29);
    expect(result.scratchSurplusSoldiers).toBe(22);
    expect(result.rememberedTargetProvinceId).toBe('4');
    expect(movementSoldiers(result.provinces)).toEqual({
      '1': 1,
      '2': 26,
      '3': 5,
      '4': 3,
      '5': 4
    });
  });

  it('matches the direct L6DFA fallback frontier distribution fixture', () => {
    const result = runC64CbaronL6DFAFallback({
      provinces: [
        province('1', 'p1', 1, ['2']),
        province('2', 'p1', 1, ['1', '3']),
        province('3', 'p2', 1, ['2'])
      ],
      activeOwnerId: 'p1',
      flagsByProvinceId: {
        '1': 0x01,
        '2': 0x01,
        '3': 0x00
      },
      surplusSoldiers: 5
    });

    expect(result.distributedSoldiers).toBe(5);
    expect(movementSoldiers(result.provinces)).toEqual({
      '1': 1,
      '2': 6,
      '3': 1
    });
    expect(result.flagsByProvinceId).toEqual({
      '1': 0x01,
      '2': 0x91,
      '3': 0x00
    });
  });

  it('matches the direct L6A64 cleanup-marker restore fixture', () => {
    const result = runC64CbaronL6A64Cleanup({
      provinces: [
        province('1', 'p1', 0, ['2']),
        province('2', 'p2', 3, ['1'])
      ],
      activeOwnerId: 'p1',
      ownerSlots,
      flagsByProvinceId: {
        '1': 0x04,
        '2': 0x00
      },
      rememberedTargetProvinceId: null,
      ca61: 0x00,
      ca62: 0x00,
      config: baseConfig
    });

    expect(result.cleanupRequirementsByProvinceId).toEqual({
      '1': 2
    });
    expect(movementSoldiers(result.provinces)).toEqual({
      '1': 1,
      '2': 3
    });
    expect(movementOwners(result.provinces)).toEqual({
      '1': 'p1',
      '2': 'p2'
    });
    expect(result.flagsByProvinceId).toEqual({
      '1': 0x04,
      '2': 0x00
    });
  });

  it('runs L6AC3 through the direct L6A64 surplus-marker loop', () => {
    const result = runC64CbaronL6A64Cleanup({
      provinces: [
        province('1', 'p1', 1, ['2']),
        province('2', 'p1', 10, ['1', '3']),
        province('3', 'p2', 3, ['2'])
      ],
      activeOwnerId: 'p1',
      ownerSlots,
      flagsByProvinceId: {
        '1': 0x00,
        '2': 0x20,
        '3': 0x00
      },
      rememberedTargetProvinceId: null,
      ca61: 0x00,
      ca62: 0x00,
      config: baseConfig
    });

    expect(movementSoldiers(result.provinces)).toEqual({
      '1': 1,
      '2': 10,
      '3': 3
    });
    expect(result.rememberedTargetProvinceId).toBe('3');
    expect(result.rememberedTargetSoldiers).toBe(3);
    expect(result.flagsByProvinceId).toEqual({
      '1': 0x00,
      '2': 0x00,
      '3': 0x00
    });
  });

  it('matches the direct L6207 fort-compensation choice fixture', () => {
    const result = runC64CbaronL6207FortCompensation({
      provinces: [
        province('1', 'p2', 30, ['2']),
        province('2', 'p1', 2, ['1', '3']),
        province('3', 'p1', 2, ['2', '4']),
        province('4', 'p2', 20, ['3'])
      ],
      activeOwnerId: 'p1',
      activeHomeProvinceId: '2',
      ownerSlots,
      flagsByProvinceId: {
        '1': 0x00,
        '2': 0x10,
        '3': 0x10,
        '4': 0x00
      },
      money: 20,
      maxHomeFortificationLevel: 'citadel',
      maxProvinceFortificationLevel: 'citadel',
      config: baseConfig
    });

    expect(result).toEqual({
      selectedProvinceId: '2',
      strengthReduction: 9,
      upgradeCost: 20
    });
  });
});
