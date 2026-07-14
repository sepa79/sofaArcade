import { c64ReachableOwnedProvinceIds } from './c64-reachability';
import type { PlayerId, ProvinceId, ProvinceMapState, ProvinceState } from './types';

export interface C64HumanMovementRange {
  readonly initialTargetSoldiers: number;
  readonly maximumTargetSoldiers: number;
  readonly minimumTargetSoldiers: 1;
}

function requireProvince(map: ProvinceMapState, provinceId: ProvinceId): ProvinceState {
  const province = map.provinces.find((candidate) => candidate.id === provinceId);
  if (province === undefined) {
    throw new Error(`Unknown movement province: ${provinceId}.`);
  }
  return province;
}

export function c64HumanMovementTargetIds(
  map: ProvinceMapState,
  playerId: PlayerId,
  sourceProvinceId: ProvinceId
): ReadonlySet<ProvinceId> {
  const reachable = c64ReachableOwnedProvinceIds(map.provinces, playerId, sourceProvinceId);
  return new Set([...reachable].filter((provinceId) => provinceId !== sourceProvinceId));
}

export function c64HumanMovementRange(
  source: ProvinceState,
  target: ProvinceState
): C64HumanMovementRange {
  const totalSoldiers = source.soldiers + target.soldiers;
  if (!Number.isSafeInteger(totalSoldiers) || totalSoldiers < 2) {
    throw new Error(
      `Movement provinces ${source.id}/${target.id} must contain at least two soldiers in total.`
    );
  }

  return {
    minimumTargetSoldiers: 1,
    maximumTargetSoldiers: totalSoldiers - 1,
    initialTargetSoldiers: target.soldiers
  };
}

export function requireC64HumanMovementTarget(
  map: ProvinceMapState,
  playerId: PlayerId,
  sourceProvinceId: ProvinceId,
  targetProvinceId: ProvinceId
): { readonly source: ProvinceState; readonly target: ProvinceState } {
  if (sourceProvinceId === targetProvinceId) {
    throw new Error('Move source and target provinces must be different.');
  }

  const source = requireProvince(map, sourceProvinceId);
  const target = requireProvince(map, targetProvinceId);
  if (source.ownerId !== playerId) {
    throw new Error(`Province ${sourceProvinceId} is not owned by ${playerId}.`);
  }
  if (target.ownerId !== playerId) {
    throw new Error(`Province ${targetProvinceId} is not owned by ${playerId}.`);
  }
  if (!c64HumanMovementTargetIds(map, playerId, sourceProvinceId).has(targetProvinceId)) {
    throw new Error(
      `Movement provinces ${sourceProvinceId} and ${targetProvinceId} are not connected through provinces owned by ${playerId}.`
    );
  }

  return { source, target };
}
