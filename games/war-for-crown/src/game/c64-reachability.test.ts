import { describe, expect, it } from 'vitest';

import { ROYALIST_OWNER_ID } from './owners';

import {
  C64_FRONTIER_FLAG,
  C64_REACHABILITY_MASK,
  c64ReachableOwnedProvinceIds,
  clearC64ReachabilityForOtherOwners,
  createC64ProvinceFlags,
  markC64AdjacentProvinces,
  maskC64ProvinceFlags,
  promoteNextC64FrontierProvince
} from './c64-reachability';

const provinces = [
  { id: 'a', ownerId: 'p1', neighbours: ['b', 'c'] },
  { id: 'b', ownerId: 'p1', neighbours: ['a', 'd'] },
  { id: 'c', ownerId: 'p1', neighbours: ['a'] },
  { id: 'd', ownerId: 'p2', neighbours: ['b', 'e'] },
  { id: 'e', ownerId: 'p1', neighbours: ['d'] }
] as const;

describe('C64 province reachability worklist', () => {
  it('masks province flags like kernal:$2253', () => {
    const flags = new Map(createC64ProvinceFlags(provinces)).set('a', 0xff).set('b', 0xc3);

    expect(maskC64ProvinceFlags(provinces, flags, 0x3f)).toEqual(
      new Map([
        ['a', 0x3f],
        ['b', 0x03],
        ['c', 0x00],
        ['d', 0x00],
        ['e', 0x00]
      ])
    );
  });

  it('marks adjacent provinces with the C64 frontier bit', () => {
    const flags = markC64AdjacentProvinces(provinces, createC64ProvinceFlags(provinces), 'a');

    expect(flags.get('a')).toBe(0);
    expect(flags.get('b')).toBe(C64_FRONTIER_FLAG);
    expect(flags.get('c')).toBe(C64_FRONTIER_FLAG);
    expect(flags.get('d')).toBe(0);
    expect(flags.get('e')).toBe(0);
  });

  it('clears reachability bits from provinces not owned by the active owner', () => {
    const flags = new Map(createC64ProvinceFlags(provinces))
      .set('a', C64_REACHABILITY_MASK)
      .set('d', C64_REACHABILITY_MASK | 0x08);

    const cleared = clearC64ReachabilityForOtherOwners(provinces, flags, 'p1');

    expect(cleared.get('a')).toBe(C64_REACHABILITY_MASK);
    expect(cleared.get('d')).toBe(0x08);
  });

  it('promotes the next frontier province in descending C64 province order', () => {
    const flags = new Map(createC64ProvinceFlags(provinces))
      .set('b', C64_FRONTIER_FLAG)
      .set('c', C64_FRONTIER_FLAG);

    const promoted = promoteNextC64FrontierProvince(provinces, flags);

    expect(promoted).toEqual({
      provinceId: 'c',
      flags: new Map(flags).set('c', C64_REACHABILITY_MASK)
    });
  });

  it('finds the connected owned component without crossing other owners', () => {
    expect(c64ReachableOwnedProvinceIds(provinces, 'p1', 'a')).toEqual(
      new Set(['a', 'b', 'c'])
    );
  });

  it('fails when the start province is not owned by the active owner', () => {
    expect(() => c64ReachableOwnedProvinceIds(provinces, 'p1', 'd')).toThrow(
      'Province d is not owned by p1.'
    );
  });

  it('supports C64 owner 0 for royalist-owned provinces', () => {
    const unclaimed = [
      { id: 'a', ownerId: ROYALIST_OWNER_ID, neighbours: ['b'] },
      { id: 'b', ownerId: ROYALIST_OWNER_ID, neighbours: ['a'] }
    ] as const;

    expect(c64ReachableOwnedProvinceIds(unclaimed, ROYALIST_OWNER_ID, 'a')).toEqual(
      new Set(['a', 'b'])
    );
  });
});
