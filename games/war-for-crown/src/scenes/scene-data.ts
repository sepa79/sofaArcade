export interface WarForCrownSceneData {
  readonly returnUrl?: string;
  readonly seed?: number;
}

function requireSceneData(rawData: unknown): WarForCrownSceneData {
  if (typeof rawData !== 'object' || rawData === null || Array.isArray(rawData)) {
    throw new Error('War for Crown scene data must be an object.');
  }
  return rawData as WarForCrownSceneData;
}

export function parseWarForCrownSeed(rawData: unknown): number {
  if (rawData === undefined) {
    return 1;
  }
  const seed = requireSceneData(rawData).seed;
  if (seed === undefined) {
    return 1;
  }
  if (!Number.isSafeInteger(seed) || seed < 1) {
    throw new Error(`War for Crown seed must be a positive safe integer, got ${seed}.`);
  }
  return seed;
}

export function parseWarForCrownReturnUrl(rawData: unknown): string | null {
  if (rawData === undefined) {
    return null;
  }
  const returnUrl = requireSceneData(rawData).returnUrl;
  if (returnUrl === undefined) {
    return null;
  }
  if (!returnUrl.startsWith('/') || !returnUrl.endsWith('/')) {
    throw new Error(`War for Crown return URL must start and end with "/": ${returnUrl}`);
  }
  return returnUrl;
}
