interface BrowserStorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function requireStorageKey(key: string): string {
  if (key.trim().length === 0) {
    throw new Error('Storage key must be non-empty.');
  }

  return key;
}

function requireBrowserStorage(): BrowserStorageLike {
  const localStorageCandidate = (globalThis as { readonly localStorage?: unknown }).localStorage;
  if (typeof localStorageCandidate !== 'object' || localStorageCandidate === null) {
    throw new Error('Browser localStorage is required for persistence.');
  }

  const storage = localStorageCandidate as Partial<BrowserStorageLike>;
  if (typeof storage.getItem !== 'function' || typeof storage.setItem !== 'function') {
    throw new Error('Browser localStorage must implement getItem/setItem methods.');
  }

  return {
    getItem: storage.getItem.bind(localStorageCandidate),
    setItem: storage.setItem.bind(localStorageCandidate)
  };
}

export function loadPersistentNonNegativeInt(key: string): number | null {
  const storageKey = requireStorageKey(key);
  const storage = requireBrowserStorage();
  const rawValue = storage.getItem(storageKey);
  if (rawValue === null) {
    return null;
  }

  if (!/^\d+$/.test(rawValue)) {
    throw new Error(`Stored value for key "${storageKey}" must be a non-negative integer string. Got "${rawValue}".`);
  }

  const parsed = Number.parseInt(rawValue, 10);
  if (!Number.isSafeInteger(parsed)) {
    throw new Error(`Stored value for key "${storageKey}" is outside safe integer range: "${rawValue}".`);
  }

  return parsed;
}

export function savePersistentNonNegativeInt(key: string, value: number): void {
  const storageKey = requireStorageKey(key);
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`Persistent integer value for key "${storageKey}" must be non-negative safe integer. Got ${value}.`);
  }

  const storage = requireBrowserStorage();
  storage.setItem(storageKey, String(value));
}

export function hasPersistentValue(key: string): boolean {
  const storageKey = requireStorageKey(key);
  return requireBrowserStorage().getItem(storageKey) !== null;
}

export function loadPersistentJson(key: string): unknown {
  const storageKey = requireStorageKey(key);
  const rawValue = requireBrowserStorage().getItem(storageKey);
  if (rawValue === null) {
    return null;
  }

  try {
    return JSON.parse(rawValue) as unknown;
  } catch (error) {
    throw new Error(`Stored JSON for key "${storageKey}" is invalid.`, { cause: error });
  }
}

export function savePersistentJson(key: string, value: unknown): void {
  const storageKey = requireStorageKey(key);
  const serialized = JSON.stringify(value);
  if (serialized === undefined) {
    throw new Error(`Value for key "${storageKey}" is not JSON-serializable.`);
  }

  requireBrowserStorage().setItem(storageKey, serialized);
}
