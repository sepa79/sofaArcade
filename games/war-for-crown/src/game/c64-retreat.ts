import type { ProvinceId } from './types';

export interface C64RetreatDistributionInput {
  readonly provinceIds: ReadonlyArray<ProvinceId>;
  readonly provinceScanOrder: ReadonlyArray<ProvinceId>;
  readonly survivors: number;
}

export interface C64RetreatDistribution {
  readonly provinceId: ProvinceId;
  readonly addedSoldiers: number;
}

function requireNonNegativeInteger(value: number, label: string): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative integer, got ${value}.`);
  }
}

export function c64RetreatDistribution(
  input: C64RetreatDistributionInput
): ReadonlyArray<C64RetreatDistribution> {
  requireNonNegativeInteger(input.survivors, 'C64 retreat survivors');

  if (input.provinceIds.length < 1) {
    throw new Error('C64 retreat distribution requires at least one destination province.');
  }

  const destinationIds = new Set(input.provinceIds);
  if (destinationIds.size !== input.provinceIds.length) {
    throw new Error('C64 retreat destination provinces must be unique.');
  }

  const scanIds = new Set(input.provinceScanOrder);
  for (const provinceId of destinationIds) {
    if (!scanIds.has(provinceId)) {
      throw new Error(`C64 retreat destination ${provinceId} is missing from province scan order.`);
    }
  }

  const baseShare = Math.floor(input.survivors / input.provinceIds.length);
  let remainder = input.survivors % input.provinceIds.length;
  const addedByProvince = new Map<ProvinceId, number>(
    input.provinceIds.map((provinceId) => [provinceId, baseShare])
  );

  for (let index = input.provinceScanOrder.length - 1; index >= 0 && remainder > 0; index -= 1) {
    const provinceId = input.provinceScanOrder[index];
    if (provinceId !== undefined && destinationIds.has(provinceId)) {
      const current = addedByProvince.get(provinceId);
      if (current === undefined) {
        throw new Error(`C64 retreat destination ${provinceId} has no initialized share.`);
      }
      addedByProvince.set(provinceId, current + 1);
      remainder -= 1;
    }
  }

  if (remainder !== 0) {
    throw new Error(`C64 retreat distribution left ${remainder} unassigned soldiers.`);
  }

  return input.provinceIds.map((provinceId) => {
    const addedSoldiers = addedByProvince.get(provinceId);
    if (addedSoldiers === undefined) {
      throw new Error(`C64 retreat destination ${provinceId} has no assigned soldiers.`);
    }

    return {
      provinceId,
      addedSoldiers
    };
  });
}
