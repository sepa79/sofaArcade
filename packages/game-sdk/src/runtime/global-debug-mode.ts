const GLOBAL_DEBUG_MODE_KEY = '__light80_global_debug_mode_v1__';

function parseDebugQueryValue(raw: string): boolean {
  if (raw === '1' || raw === 'true' || raw === 'on') {
    return true;
  }
  if (raw === '0' || raw === 'false' || raw === 'off') {
    return false;
  }
  throw new Error(`Invalid debug query parameter value: "${raw}". Use debug=1 or debug=0.`);
}

function initialDebugModeFromEnvironment(): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  const value = new URLSearchParams(window.location.search).get('debug');
  if (value === null) {
    return false;
  }
  return parseDebugQueryValue(value);
}

function debugScope(): Record<string, unknown> {
  return globalThis as Record<string, unknown>;
}

export function getGlobalDebugMode(): boolean {
  const scope = debugScope();
  const current = scope[GLOBAL_DEBUG_MODE_KEY];
  if (typeof current === 'boolean') {
    return current;
  }
  const initial = initialDebugModeFromEnvironment();
  scope[GLOBAL_DEBUG_MODE_KEY] = initial;
  return initial;
}

export function setGlobalDebugMode(enabled: boolean): void {
  debugScope()[GLOBAL_DEBUG_MODE_KEY] = enabled;
}

export function toggleGlobalDebugMode(): boolean {
  const next = !getGlobalDebugMode();
  setGlobalDebugMode(next);
  return next;
}
