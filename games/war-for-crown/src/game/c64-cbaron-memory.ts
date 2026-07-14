const C64_MAX_24_BIT = 0xffffff;

export interface C64RememberedTargetPressureInput {
  readonly currentTargetSoldiers: number;
  readonly rememberedTargetSoldiers: number;
  readonly ca61: number;
  readonly ca62: number;
}

export interface C64RememberedTargetPressureResult {
  readonly quotient: number;
  readonly ca61: number;
  readonly ca62: number;
}

function requireByte(value: number, label: string): void {
  if (!Number.isInteger(value) || value < 0 || value > 0xff) {
    throw new Error(`${label} must be a C64 byte, got ${value}.`);
  }
}

function require24Bit(value: number, label: string): void {
  if (!Number.isInteger(value) || value < 0 || value > C64_MAX_24_BIT) {
    throw new Error(`${label} must be a C64 24-bit value, got ${value}.`);
  }
}

export function c64CbaronRememberedTargetPressure(
  input: C64RememberedTargetPressureInput
): C64RememberedTargetPressureResult {
  require24Bit(input.currentTargetSoldiers, 'C64 remembered target current soldiers');
  require24Bit(input.rememberedTargetSoldiers, 'C64 remembered target stored soldiers');
  requireByte(input.ca61, 'C64 $CA61');
  requireByte(input.ca62, 'C64 $CA62');
  if (input.rememberedTargetSoldiers < 1) {
    throw new Error('C64 remembered target stored soldiers must be positive.');
  }

  const quotient = Math.floor(input.currentTargetSoldiers / input.rememberedTargetSoldiers);
  const quotientLow = quotient & 0xff;
  const quotientHigh = Math.floor(quotient / 0x100) & 0xff;
  const pressure = input.ca61 + input.ca62 * 0x100 + quotientLow + quotientHigh * 0x100;
  const foldedPressure = Math.floor((pressure & 0xffff) / 2);

  return {
    quotient,
    ca61: foldedPressure & 0xff,
    ca62: Math.floor(foldedPressure / 0x100) & 0xff
  };
}
