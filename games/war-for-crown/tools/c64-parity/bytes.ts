import { readFileSync } from 'node:fs';

export function hexByte(value: number): string {
  if (!Number.isInteger(value) || value < 0 || value > 0xff) {
    throw new Error(`Byte must be an integer from 0 to 255, got ${value}.`);
  }
  return value.toString(16).padStart(2, '0');
}

export function hexAddress(value: number): string {
  if (!Number.isInteger(value) || value < 0 || value > 0xffff) {
    throw new Error(`Address must be a uint16, got ${value}.`);
  }
  return value.toString(16).padStart(4, '0');
}

export function readSnapshot(path: string, expectedLength: number): ReadonlyArray<number> {
  if (!Number.isInteger(expectedLength) || expectedLength < 1) {
    throw new Error(`Snapshot length must be a positive integer, got ${expectedLength}.`);
  }
  const bytes = readFileSync(path);
  if (bytes.length !== expectedLength) {
    throw new Error(
      `VICE snapshot ${path} length mismatch: expected ${expectedLength}, got ${bytes.length}.`
    );
  }
  return [...bytes];
}

export function requireEqualBytes(
  label: string,
  actual: ReadonlyArray<number>,
  expected: ReadonlyArray<number>
): void {
  if (actual.length !== expected.length) {
    throw new Error(`${label} length mismatch: C64 ${actual.length}, TypeScript ${expected.length}.`);
  }
  const mismatchIndex = actual.findIndex((value, index) => value !== expected[index]);
  if (mismatchIndex !== -1) {
    throw new Error(
      `${label} mismatch at byte ${mismatchIndex}: C64 0x${hexByte(actual[mismatchIndex])}, ` +
      `TypeScript 0x${hexByte(expected[mismatchIndex] ?? -1)}.`
    );
  }
}
