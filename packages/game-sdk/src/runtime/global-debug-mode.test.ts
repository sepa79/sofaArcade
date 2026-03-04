import { beforeEach, describe, expect, it } from 'vitest';

import { getGlobalDebugMode, setGlobalDebugMode, toggleGlobalDebugMode } from './global-debug-mode';

describe('global debug mode', () => {
  beforeEach(() => {
    setGlobalDebugMode(false);
  });

  it('defaults to false', () => {
    expect(getGlobalDebugMode()).toBe(false);
  });

  it('can be toggled', () => {
    expect(toggleGlobalDebugMode()).toBe(true);
    expect(getGlobalDebugMode()).toBe(true);
    expect(toggleGlobalDebugMode()).toBe(false);
    expect(getGlobalDebugMode()).toBe(false);
  });

  it('can be set directly', () => {
    setGlobalDebugMode(true);
    expect(getGlobalDebugMode()).toBe(true);
    setGlobalDebugMode(false);
    expect(getGlobalDebugMode()).toBe(false);
  });
});
