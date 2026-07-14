import type { OwnerId } from './owners';
import type { ProvinceId, ProvinceState } from './types';

export const C64_REACHABLE_FLAG = 0x40;
export const C64_FRONTIER_FLAG = 0x80;
export const C64_REACHABILITY_MASK = C64_REACHABLE_FLAG | C64_FRONTIER_FLAG;

export type C64ProvinceFlags = ReadonlyMap<ProvinceId, number>;

type C64ReachabilityProvince = Pick<ProvinceState, 'id' | 'ownerId' | 'neighbours'>;

function requireProvince(
  provinces: ReadonlyArray<C64ReachabilityProvince>,
  provinceId: ProvinceId
): C64ReachabilityProvince {
  const province = provinces.find((candidate) => candidate.id === provinceId);
  if (province === undefined) {
    throw new Error(`Unknown C64 reachability province: ${provinceId}.`);
  }
  return province;
}

function requireFlag(flags: C64ProvinceFlags, provinceId: ProvinceId): number {
  const flag = flags.get(provinceId);
  if (flag === undefined) {
    throw new Error(`Missing C64 province flag for ${provinceId}.`);
  }
  return flag;
}

function requireOwner(province: C64ReachabilityProvince, ownerId: OwnerId): void {
  if (province.ownerId !== ownerId) {
    throw new Error(`Province ${province.id} is not owned by ${ownerId}.`);
  }
}

export function createC64ProvinceFlags(
  provinces: ReadonlyArray<C64ReachabilityProvince>
): C64ProvinceFlags {
  return new Map(provinces.map((province) => [province.id, 0]));
}

export function maskC64ProvinceFlags(
  provinces: ReadonlyArray<C64ReachabilityProvince>,
  flags: C64ProvinceFlags,
  mask: number
): C64ProvinceFlags {
  return new Map(provinces.map((province) => [
    province.id,
    requireFlag(flags, province.id) & mask
  ]));
}

export function markC64AdjacentProvinces(
  provinces: ReadonlyArray<C64ReachabilityProvince>,
  flags: C64ProvinceFlags,
  sourceProvinceId: ProvinceId
): C64ProvinceFlags {
  const source = requireProvince(provinces, sourceProvinceId);
  const nextFlags = new Map(flags);

  for (const neighbourId of source.neighbours) {
    requireProvince(provinces, neighbourId);
    nextFlags.set(neighbourId, requireFlag(flags, neighbourId) | C64_FRONTIER_FLAG);
  }

  return nextFlags;
}

export function clearC64ReachabilityForOtherOwners(
  provinces: ReadonlyArray<C64ReachabilityProvince>,
  flags: C64ProvinceFlags,
  ownerId: OwnerId
): C64ProvinceFlags {
  return new Map(provinces.map((province) => [
    province.id,
    province.ownerId === ownerId
      ? requireFlag(flags, province.id)
      : requireFlag(flags, province.id) & ~C64_REACHABILITY_MASK
  ]));
}

export function promoteNextC64FrontierProvince(
  provinces: ReadonlyArray<C64ReachabilityProvince>,
  flags: C64ProvinceFlags
): { readonly provinceId: ProvinceId; readonly flags: C64ProvinceFlags } | null {
  for (let index = provinces.length - 1; index >= 0; index -= 1) {
    const province = provinces[index];
    if (province === undefined) {
      throw new Error(`Missing C64 province at index ${index}.`);
    }

    const flag = requireFlag(flags, province.id);
    if ((flag & C64_REACHABILITY_MASK) !== C64_FRONTIER_FLAG) {
      continue;
    }

    const nextFlags = new Map(flags);
    nextFlags.set(province.id, flag | C64_REACHABILITY_MASK);
    return {
      provinceId: province.id,
      flags: nextFlags
    };
  }

  return null;
}

export function c64ReachableOwnedProvinceIds(
  provinces: ReadonlyArray<C64ReachabilityProvince>,
  ownerId: OwnerId,
  startProvinceId: ProvinceId
): ReadonlySet<ProvinceId> {
  const start = requireProvince(provinces, startProvinceId);
  requireOwner(start, ownerId);

  let flags = maskC64ProvinceFlags(provinces, createC64ProvinceFlags(provinces), ~C64_REACHABILITY_MASK);
  flags = new Map(flags).set(startProvinceId, C64_REACHABILITY_MASK);
  let currentProvinceId = startProvinceId;

  for (;;) {
    flags = markC64AdjacentProvinces(provinces, flags, currentProvinceId);
    flags = clearC64ReachabilityForOtherOwners(provinces, flags, ownerId);

    const promoted = promoteNextC64FrontierProvince(provinces, flags);
    if (promoted === null) {
      return new Set(
        provinces
          .filter((province) => (requireFlag(flags, province.id) & C64_REACHABLE_FLAG) !== 0)
          .map((province) => province.id)
      );
    }

    currentProvinceId = promoted.provinceId;
    flags = promoted.flags;
  }
}
