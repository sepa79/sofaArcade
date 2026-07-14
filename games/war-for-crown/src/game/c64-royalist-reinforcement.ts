import { c64Divide32, c64Multiply32 } from './c64-arithmetic';
import { isRoyalistOwner } from './owners';
import { fortificationIndex } from './rules';
import type { GameConfig, ProvinceState } from './types';

const C64_24_BIT_MODULO = 0x1000000;
const C64_REINFORCEMENT_FACTOR_BY_MAX_FORTIFICATION: ReadonlyArray<number> = [
  10,
  5,
  3,
  2,
  2,
  1
];

export interface C64RoyalistReinforcementInput {
  readonly provinces: ReadonlyArray<ProvinceState>;
  readonly year: number;
  readonly month: number;
  readonly rngByte: number;
  readonly config: Pick<
    GameConfig,
    'maxProvinceFortificationLevel' | 'maxVillages'
  >;
}

export interface C64RoyalistReinforcementResult {
  readonly provinces: ReadonlyArray<ProvinceState>;
  readonly soldiers: number;
}

function requireByte(value: number, label: string): void {
  if (!Number.isInteger(value) || value < 0 || value > 0xff) {
    throw new Error(`${label} must be a C64 byte, got ${value}.`);
  }
}

function reinforcementFactor(config: C64RoyalistReinforcementInput['config']): number {
  const maxFortificationIndex = fortificationIndex(config.maxProvinceFortificationLevel);
  const factor = C64_REINFORCEMENT_FACTOR_BY_MAX_FORTIFICATION[maxFortificationIndex];
  if (factor === undefined) {
    throw new Error(
      `Missing C64 royalist reinforcement factor for fortification index ${maxFortificationIndex}.`
    );
  }
  return factor;
}

export function c64RoyalistReinforcementSoldiers(
  input: Omit<C64RoyalistReinforcementInput, 'provinces'> & { readonly provinceCount: number }
): number {
  requireByte(input.year, 'C64 reinforcement year');
  requireByte(input.month, 'C64 reinforcement month');
  requireByte(input.rngByte, 'C64 reinforcement RNG byte');
  requireByte(input.provinceCount, 'C64 reinforcement province count');
  requireByte(input.config.maxVillages, 'C64 reinforcement maximum villages');
  if (input.month >= 12) {
    throw new Error(`C64 reinforcement month must be 0..11, got ${input.month}.`);
  }
  if (input.provinceCount < 1) {
    throw new Error('C64 reinforcement province count must be positive.');
  }

  const factor = reinforcementFactor(input.config);
  const elapsedMonths = (c64Multiply32(input.year, 12) + input.month) & 0xff;
  const cappedMonths = c64Multiply32(input.provinceCount, factor);
  const seriesProduct = cappedMonths < 0x100 && cappedMonths < elapsedMonths
    ? c64Multiply32(cappedMonths, elapsedMonths * 2 - cappedMonths + 1)
    : c64Multiply32(elapsedMonths, elapsedMonths + 1);
  const scaled = c64Multiply32(seriesProduct, input.config.maxVillages);
  const base = c64Divide32(scaled, factor * 2).quotient;
  return (base + input.rngByte * 4) % C64_24_BIT_MODULO;
}

export function runC64RoyalistReinforcement(
  input: C64RoyalistReinforcementInput
): C64RoyalistReinforcementResult {
  const royalistIndices = input.provinces
    .map((province, index) => ({ index, province }))
    .filter(({ province }) => isRoyalistOwner(province.ownerId))
    .map(({ index }) => index)
    .sort((left, right) => right - left);
  if (royalistIndices.length === 0) {
    throw new Error('C64 royalist reinforcement requires at least one royalist province.');
  }

  const soldiers = c64RoyalistReinforcementSoldiers({
    provinceCount: input.provinces.length,
    year: input.year,
    month: input.month,
    rngByte: input.rngByte,
    config: input.config
  });
  const distribution = c64Divide32(soldiers, royalistIndices.length);
  let remainder = distribution.remainder;
  const provinces = input.provinces.map((province) => ({ ...province }));

  for (const provinceIndex of royalistIndices) {
    const province = provinces[provinceIndex];
    if (province === undefined) {
      throw new Error(`Missing C64 reinforcement province at index ${provinceIndex}.`);
    }
    const extra = remainder === 0 ? 0 : 1;
    if (remainder !== 0) {
      remainder -= 1;
    }
    provinces[provinceIndex] = {
      ...province,
      soldiers: (province.soldiers + distribution.quotient + extra) % C64_24_BIT_MODULO
    };
  }

  return { provinces, soldiers };
}
