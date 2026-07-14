import type { PlayerId, ProvinceId, ProvinceState } from './types';

const C64_FLAG_CLASS = 0x40;
const C64_FLAG_ADJACENT = 0x80;

export interface C64CbaronConnectivityInput {
  readonly provinces: ReadonlyArray<ProvinceState>;
  readonly provinceIndexById: ReadonlyMap<ProvinceId, number>;
  readonly flagsByProvinceIndex: ReadonlyArray<number>;
  readonly activeOwnerId: PlayerId;
  readonly targetProvinceId: ProvinceId;
}

function requireProvinceIndex(
  provinceIndexById: ReadonlyMap<ProvinceId, number>,
  provinceId: ProvinceId
): number {
  const index = provinceIndexById.get(provinceId);
  if (index === undefined) {
    throw new Error(`Missing C64 cbaron L6E2C province order for ${provinceId}.`);
  }
  return index;
}

function requireProvince(
  provinces: ReadonlyArray<ProvinceState>,
  index: number
): ProvinceState {
  const province = provinces[index];
  if (province === undefined) {
    throw new Error(`Missing C64 cbaron L6E2C province at index ${index}.`);
  }
  return province;
}

function requireFlag(flags: ReadonlyArray<number>, index: number): number {
  const flag = flags[index];
  if (flag === undefined) {
    throw new Error(`Missing C64 cbaron L6E2C flag at index ${index}.`);
  }
  return flag;
}

export function c64CbaronConnectivityClass(input: C64CbaronConnectivityInput): number {
  if (input.provinces.length !== input.flagsByProvinceIndex.length) {
    throw new Error(
      `C64 cbaron L6E2C needs one flag per province, got ${input.flagsByProvinceIndex.length} for ${input.provinces.length}.`
    );
  }

  const flags = input.flagsByProvinceIndex.map((flag) => flag & 0x3f);
  const owners = input.provinces.map((province) => province.ownerId);
  const targetIndex = requireProvinceIndex(input.provinceIndexById, input.targetProvinceId);
  let classByte = 0;

  const markAdjacentOnFlags = (province: ProvinceState): void => {
    for (const neighbourId of province.neighbours) {
      flags[requireProvinceIndex(input.provinceIndexById, neighbourId)] |= C64_FLAG_ADJACENT;
    }
  };

  flags[targetIndex] |= C64_FLAG_CLASS;
  markAdjacentOnFlags(requireProvince(input.provinces, targetIndex));

  for (let index = input.provinces.length - 1; index >= 0; index -= 1) {
    if ((requireFlag(flags, index) & C64_FLAG_ADJACENT) === 0) {
      continue;
    }
    if (owners[index] === input.activeOwnerId) {
      flags[index] |= C64_FLAG_CLASS;
      classByte = (classByte + 1) & 0xff;
    }
    flags[index] &= 0x7f;
  }

  owners[targetIndex] = input.activeOwnerId;

  for (let index = input.provinces.length - 1; index >= 0; index -= 1) {
    if ((requireFlag(flags, index) & C64_FLAG_CLASS) === 0) {
      continue;
    }
    markAdjacentOnFlags(requireProvince(input.provinces, index));
    for (let innerIndex = input.provinces.length - 1; innerIndex >= 0; innerIndex -= 1) {
      if ((requireFlag(flags, innerIndex) & C64_FLAG_ADJACENT) === 0) {
        continue;
      }
      flags[innerIndex] &= 0x7f;
      if (owners[innerIndex] !== input.activeOwnerId) {
        classByte = (classByte - 1) & 0xff;
        for (let clearIndex = innerIndex; clearIndex >= 0; clearIndex -= 1) {
          flags[clearIndex] &= 0x7f;
        }
        break;
      }
    }
    flags[index] &= 0xbf;
  }

  const incremented = (classByte + 1) & 0xff;
  return incremented < 6 ? incremented : 6;
}
