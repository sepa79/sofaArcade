import { describe, expect, it } from 'vitest';

import { loadPersistentNonNegativeInt, savePersistentNonNegativeInt } from './persistence';

class MemoryStorage {
  private readonly map = new Map<string, string>();

  getItem(key: string): string | null {
    return this.map.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.map.set(key, value);
  }
}

function setLocalStorageMock(value: unknown): void {
  Object.defineProperty(globalThis, 'localStorage', {
    value,
    configurable: true,
    writable: true
  });
}

describe('persistence', () => {
  it('saves and loads non-negative integer', () => {
    setLocalStorageMock(new MemoryStorage());

    savePersistentNonNegativeInt('score.key', 123);
    expect(loadPersistentNonNegativeInt('score.key')).toBe(123);
  });

  it('returns null for missing value', () => {
    setLocalStorageMock(new MemoryStorage());

    expect(loadPersistentNonNegativeInt('missing.key')).toBeNull();
  });

  it('throws on invalid stored value', () => {
    const storage = new MemoryStorage();
    storage.setItem('score.key', 'abc');
    setLocalStorageMock(storage);

    expect(() => loadPersistentNonNegativeInt('score.key')).toThrow(
      'Stored value for key "score.key" must be a non-negative integer string.'
    );
  });

  it('throws on invalid input value', () => {
    setLocalStorageMock(new MemoryStorage());

    expect(() => savePersistentNonNegativeInt('score.key', -1)).toThrow(
      'Persistent integer value for key "score.key" must be non-negative safe integer.'
    );
  });
});
