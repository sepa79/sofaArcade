import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { clearCachedAlphaMasks, getCachedAlphaMaskFromSource } from './alpha-mask-cache';

interface TestSource {
  readonly width: number;
  readonly height: number;
  readonly rgba: Uint8ClampedArray;
  readonly currentSrc?: string;
  readonly src?: string;
}

interface CanvasMockContext {
  clearRect(x: number, y: number, width: number, height: number): void;
  drawImage(source: CanvasImageSource, x: number, y: number, width: number, height: number): void;
  getImageData(x: number, y: number, width: number, height: number): ImageData;
}

interface MutableGlobalDocument {
  document?: Document;
}

function createSource(
  width: number,
  height: number,
  alphaValues: ReadonlyArray<number>,
  currentSrc?: string
): CanvasImageSource & { readonly width: number; readonly height: number } {
  if (alphaValues.length !== width * height) {
    throw new Error(`alphaValues length must be ${width * height}, got ${alphaValues.length}.`);
  }

  const rgba = new Uint8ClampedArray(width * height * 4);
  for (let index = 0; index < alphaValues.length; index += 1) {
    rgba[index * 4 + 3] = alphaValues[index] ?? 0;
  }

  return {
    width,
    height,
    rgba,
    currentSrc
  } as unknown as CanvasImageSource & { readonly width: number; readonly height: number };
}

function installCanvasMock(): { readonly restore: () => void; readonly getCanvasCreateCalls: () => number } {
  const scope = globalThis as unknown as MutableGlobalDocument;
  const previousDocument = scope.document;
  let createCalls = 0;

  const fakeDocument: Document = {
    createElement(tagName: string): HTMLElement {
      if (tagName !== 'canvas') {
        throw new Error(`Unexpected element creation in test mock: ${tagName}.`);
      }

      createCalls += 1;
      let drawnSource: TestSource | null = null;
      const context: CanvasMockContext = {
        clearRect(): void {
          drawnSource = null;
        },
        drawImage(source: CanvasImageSource): void {
          drawnSource = source as unknown as TestSource;
        },
        getImageData(): ImageData {
          if (drawnSource === null) {
            throw new Error('drawImage must be called before getImageData.');
          }

          return {
            data: drawnSource.rgba,
            width: drawnSource.width,
            height: drawnSource.height,
            colorSpace: 'srgb'
          } as unknown as ImageData;
        }
      };

      const canvas = {
        width: 0,
        height: 0,
        getContext(contextId: string): CanvasRenderingContext2D | null {
          if (contextId !== '2d') {
            return null;
          }

          return context as unknown as CanvasRenderingContext2D;
        }
      };

      return canvas as unknown as HTMLElement;
    }
  } as Document;

  scope.document = fakeDocument;

  return {
    restore: (): void => {
      if (previousDocument === undefined) {
        delete scope.document;
        return;
      }

      scope.document = previousDocument;
    },
    getCanvasCreateCalls: (): number => createCalls
  };
}

describe('getCachedAlphaMaskFromSource', () => {
  let restoreDocument: (() => void) | null = null;
  let getCanvasCreateCalls: () => number = () => 0;

  beforeEach(() => {
    clearCachedAlphaMasks();
    const mock = installCanvasMock();
    restoreDocument = mock.restore;
    getCanvasCreateCalls = mock.getCanvasCreateCalls;
  });

  afterEach(() => {
    clearCachedAlphaMasks();
    if (restoreDocument !== null) {
      restoreDocument();
      restoreDocument = null;
    }
  });

  it('creates a binary alpha mask and reuses cache for same source + threshold', () => {
    const source = createSource(2, 2, [0, 9, 10, 255], 'asset://enemy-1');

    const first = getCachedAlphaMaskFromSource(source, 10);
    const second = getCachedAlphaMaskFromSource(source, 10);

    expect(first).toBe(second);
    expect(Array.from(first.alpha)).toEqual([0, 0, 1, 1]);
    expect(getCanvasCreateCalls()).toBe(1);
  });

  it('uses separate cache entries for different thresholds', () => {
    const source = createSource(1, 3, [30, 120, 200], 'asset://enemy-2');

    const lowThreshold = getCachedAlphaMaskFromSource(source, 50);
    const highThreshold = getCachedAlphaMaskFromSource(source, 150);

    expect(lowThreshold).not.toBe(highThreshold);
    expect(Array.from(lowThreshold.alpha)).toEqual([0, 1, 1]);
    expect(Array.from(highThreshold.alpha)).toEqual([0, 0, 1]);
    expect(getCanvasCreateCalls()).toBe(2);
  });

  it('recomputes mask after clearCachedAlphaMasks', () => {
    const source = createSource(1, 2, [255, 0], 'asset://player');

    const beforeClear = getCachedAlphaMaskFromSource(source, 1);
    clearCachedAlphaMasks();
    const afterClear = getCachedAlphaMaskFromSource(source, 1);

    expect(beforeClear).not.toBe(afterClear);
    expect(getCanvasCreateCalls()).toBe(2);
  });

  it('falls back to object identity when source URL is missing', () => {
    const sourceA = createSource(1, 1, [255]);
    const sourceB = createSource(1, 1, [255]);

    const maskA = getCachedAlphaMaskFromSource(sourceA, 1);
    const maskB = getCachedAlphaMaskFromSource(sourceB, 1);

    expect(maskA).not.toBe(maskB);
    expect(getCanvasCreateCalls()).toBe(2);
  });
});
