const MAXIMUM_MAP_SEED = 0xffffffff;

export function parseMapSeedInput(value: string): number {
  if (!/^[0-9]+$/.test(value)) {
    throw new Error('Map seed must contain digits only.');
  }

  const seed = Number(value);
  if (!Number.isSafeInteger(seed) || seed < 1 || seed > MAXIMUM_MAP_SEED) {
    throw new Error(`Map seed must be an integer from 1 to ${MAXIMUM_MAP_SEED}.`);
  }

  return seed;
}
