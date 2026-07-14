const UINT32_MAX = 0xffffffff;

export interface C64DivideResult {
  readonly quotient: number;
  readonly remainder: number;
}

export interface C64CbaronThreatRequirementInput {
  readonly attackerCombatPercent: number;
  readonly defenderCombatPercent: number;
  readonly strongestAdjacentMobileSoldiers: number;
}

export interface C64CbaronMovementTargetRequirementInput {
  readonly attackerCombatPercent: number;
  readonly defenderCombatPercent: number;
  readonly targetSoldiers: number;
  readonly pressureWord: number;
}

function requireUint32(value: number, label: string): void {
  if (!Number.isInteger(value) || value < 0 || value > UINT32_MAX) {
    throw new Error(`${label} must be an unsigned 32-bit integer, got ${value}.`);
  }
}

function uint32Low(value: number): number {
  return value >>> 0;
}

export function c64Divide32(dividend: number, divisor: number): C64DivideResult {
  requireUint32(dividend, 'C64 dividend');
  requireUint32(divisor, 'C64 divisor');

  if (divisor === 0) {
    return {
      quotient: UINT32_MAX,
      remainder: dividend
    };
  }

  const bigDividend = BigInt(dividend);
  const bigDivisor = BigInt(divisor);

  return {
    quotient: Number(bigDividend / bigDivisor),
    remainder: Number(bigDividend % bigDivisor)
  };
}

export function c64Multiply32(left: number, right: number): number {
  requireUint32(left, 'C64 multiply left operand');
  requireUint32(right, 'C64 multiply right operand');

  let multiplicand = uint32Low(left);
  let multiplier = uint32Low(right);
  let product = 0;

  while (multiplier !== 0) {
    const shouldAdd = (multiplier & 1) !== 0;
    multiplier = Math.floor(multiplier / 2);

    if (shouldAdd) {
      const nextProduct = product + multiplicand;
      product = uint32Low(nextProduct);
      if (nextProduct > UINT32_MAX) {
        return product;
      }
    }

    multiplicand = uint32Low(multiplicand * 2);
  }

  return product;
}

function c64ShiftRightRounded(value: number, count: number): number {
  requireUint32(value, 'C64 rounded shift input');
  if (!Number.isInteger(count) || count < 0) {
    throw new Error(`C64 rounded shift count must be a non-negative integer, got ${count}.`);
  }

  if (count === 0) {
    return value;
  }

  let result = value;
  let carry = 0;
  for (let index = 0; index < count; index += 1) {
    carry = result & 1;
    result = Math.floor(result / 2);
  }

  return carry === 0 ? result : uint32Low(result + 1);
}

function c64HighestBitScanIndex(value: number): number | null {
  requireUint32(value, 'C64 highest-bit scan input');

  const byte3 = Math.floor(value / 0x1000000) & 0xff;
  const byte2 = Math.floor(value / 0x10000) & 0xff;
  const byte1 = Math.floor(value / 0x100) & 0xff;
  const byte0 = value & 0xff;

  let index: number;
  let byte: number;
  if (byte3 !== 0) {
    index = 0x20;
    byte = byte3;
  } else if (byte2 !== 0) {
    index = 0x18;
    byte = byte2;
  } else if (byte1 !== 0) {
    index = 0x10;
    byte = byte1;
  } else if (byte0 !== 0) {
    index = 0x08;
    byte = byte0;
  } else {
    return null;
  }

  for (;;) {
    index -= 1;
    const carry = (byte & 0x80) !== 0;
    byte = (byte << 1) & 0xff;
    if (carry) {
      return index;
    }
  }
}

export function c64SysL9781(value: number): number {
  requireUint32(value, 'C64 L9781 input');

  const bitIndex = c64HighestBitScanIndex(value);
  if (bitIndex === null) {
    return 0;
  }

  let divisor = c64ShiftRightRounded(value, Math.floor(bitIndex / 2));
  if (bitIndex % 2 === 1) {
    divisor = c64ShiftRightRounded(divisor, 1);
  }

  const quotient = c64Divide32(value, divisor).quotient;
  const sum = uint32Low(divisor + quotient);
  return c64ShiftRightRounded(sum, 1);
}

export function c64CbaronThreatRequirement(input: C64CbaronThreatRequirementInput): number {
  requireUint32(input.attackerCombatPercent, 'C64 cbaron attacker combat percent');
  requireUint32(input.defenderCombatPercent, 'C64 cbaron defender combat percent');
  requireUint32(
    input.strongestAdjacentMobileSoldiers,
    'C64 cbaron strongest adjacent mobile soldiers'
  );

  const combatRatioQ16 = c64Divide32(
    c64Multiply32(input.attackerCombatPercent, 0x10000),
    input.defenderCombatPercent
  ).quotient;
  const root = c64SysL9781(combatRatioQ16);
  const weightedThreat = c64Multiply32(root, input.strongestAdjacentMobileSoldiers);
  return c64Divide32(weightedThreat, 0xe0).quotient % 0x1000000;
}

export function c64CbaronMovementTargetRequirement(
  input: C64CbaronMovementTargetRequirementInput
): number {
  requireUint32(input.attackerCombatPercent, 'C64 cbaron target attacker combat percent');
  requireUint32(input.defenderCombatPercent, 'C64 cbaron target defender combat percent');
  requireUint32(input.targetSoldiers, 'C64 cbaron target soldiers');
  requireUint32(input.pressureWord, 'C64 cbaron movement pressure word');

  const combatRatioQ16 = c64Divide32(
    c64Multiply32(input.defenderCombatPercent, 0x10000),
    input.attackerCombatPercent
  ).quotient;
  const root = c64SysL9781(combatRatioQ16);
  const baseRequirement = c64Divide32(c64Multiply32(root, input.targetSoldiers), 0xe0).quotient;
  const weightedRequirement = c64Multiply32(baseRequirement, input.pressureWord);
  return Math.floor(weightedRequirement / 0x100) % 0x1000000;
}
