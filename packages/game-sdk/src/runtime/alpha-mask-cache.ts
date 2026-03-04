export interface CachedAlphaMask {
  readonly width: number;
  readonly height: number;
  readonly alpha: Uint8Array;
}

type AlphaMaskSource = CanvasImageSource & { readonly width: number; readonly height: number };

const alphaMaskCache = new Map<string, CachedAlphaMask>();
let sourceObjectIds = new WeakMap<object, number>();
let nextSourceObjectId = 1;

function sourceIdentity(source: AlphaMaskSource): string {
  const sourceWithUrl = source as unknown as { readonly currentSrc?: unknown; readonly src?: unknown };
  if (typeof sourceWithUrl.currentSrc === 'string' && sourceWithUrl.currentSrc.length > 0) {
    return `src:${sourceWithUrl.currentSrc}`;
  }
  if (typeof sourceWithUrl.src === 'string' && sourceWithUrl.src.length > 0) {
    return `src:${sourceWithUrl.src}`;
  }

  if (typeof source !== 'object' || source === null) {
    throw new Error('Alpha mask source must be an object.');
  }

  const existingId = sourceObjectIds.get(source);
  if (existingId !== undefined) {
    return `obj:${existingId}`;
  }

  const nextId = nextSourceObjectId;
  nextSourceObjectId += 1;
  sourceObjectIds.set(source, nextId);
  return `obj:${nextId}`;
}

function createMask(source: AlphaMaskSource, width: number, height: number, alphaThreshold: number): CachedAlphaMask {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext('2d');
  if (context === null) {
    throw new Error('Failed to create 2D context for alpha mask extraction.');
  }

  context.clearRect(0, 0, width, height);
  context.drawImage(source, 0, 0, width, height);
  const imageData = context.getImageData(0, 0, width, height);
  const alpha = new Uint8Array(width * height);
  for (let i = 0; i < alpha.length; i += 1) {
    alpha[i] = imageData.data[i * 4 + 3] >= alphaThreshold ? 1 : 0;
  }

  return {
    width,
    height,
    alpha
  };
}

export function getCachedAlphaMaskFromSource(source: AlphaMaskSource, alphaThreshold = 1): CachedAlphaMask {
  if (!Number.isFinite(source.width) || !Number.isFinite(source.height)) {
    throw new Error('Alpha mask source dimensions must be finite numbers.');
  }

  const width = Math.floor(source.width);
  const height = Math.floor(source.height);
  if (width <= 0 || height <= 0) {
    throw new Error(`Alpha mask source dimensions must be positive, got ${width}x${height}.`);
  }
  if (!Number.isFinite(alphaThreshold) || alphaThreshold < 0 || alphaThreshold > 255) {
    throw new Error(`Alpha mask threshold must be in [0, 255], got ${String(alphaThreshold)}.`);
  }

  const key = `${sourceIdentity(source)}|${width}x${height}|a${alphaThreshold}`;
  const cached = alphaMaskCache.get(key);
  if (cached !== undefined) {
    return cached;
  }

  const created = createMask(source, width, height, alphaThreshold);
  alphaMaskCache.set(key, created);
  return created;
}

export function clearCachedAlphaMasks(): void {
  alphaMaskCache.clear();
  sourceObjectIds = new WeakMap<object, number>();
  nextSourceObjectId = 1;
}
