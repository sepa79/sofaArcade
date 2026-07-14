export interface Rng {
  readonly nextFloat: () => number;
  readonly nextIntInclusive: (min: number, max: number) => number;
  readonly pick: <T>(values: ReadonlyArray<T>) => T;
}

export function normalizeRngSeed(seed: number): number {
  if (!Number.isInteger(seed)) {
    throw new Error(`RNG seed must be an integer, got ${seed}.`);
  }

  const state = seed >>> 0;
  return state === 0 ? 1 : state;
}

export function nextRngState(state: number): number {
  if (!Number.isInteger(state) || state < 0 || state > 0xffffffff) {
    throw new Error(`RNG state must be a uint32 integer, got ${state}.`);
  }

  return (Math.imul(state, 1664525) + 1013904223) >>> 0;
}

export function rngByteFromState(state: number): number {
  if (!Number.isInteger(state) || state < 0 || state > 0xffffffff) {
    throw new Error(`RNG state must be a uint32 integer, got ${state}.`);
  }

  return state & 0xff;
}

export interface NextRngByteResult {
  readonly rngState: number;
  readonly byte: number;
}

export function nextRngByte(state: number): NextRngByteResult {
  const rngState = nextRngState(state);
  return {
    rngState,
    byte: rngByteFromState(rngState)
  };
}

export function createRng(seed: number): Rng {
  let state = normalizeRngSeed(seed);

  function nextUint32(): number {
    state = nextRngState(state);
    return state;
  }

  function nextFloat(): number {
    return nextUint32() / 0x100000000;
  }

  function nextIntInclusive(min: number, max: number): number {
    if (!Number.isInteger(min) || !Number.isInteger(max) || min > max) {
      throw new Error(`Invalid integer range: ${min}..${max}.`);
    }

    return min + Math.floor(nextFloat() * (max - min + 1));
  }

  function pick<T>(values: ReadonlyArray<T>): T {
    if (values.length === 0) {
      throw new Error('Cannot pick from an empty array.');
    }

    return values[nextIntInclusive(0, values.length - 1)];
  }

  return {
    nextFloat,
    nextIntInclusive,
    pick
  };
}
