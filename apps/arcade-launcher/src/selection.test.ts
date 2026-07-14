import { describe, expect, it } from 'vitest';

import { createLauncherSelection, moveLauncherSelection } from './selection';

describe('arcade launcher selection', () => {
  it('wraps in both directions', () => {
    expect(moveLauncherSelection(createLauncherSelection(), -1, 4)).toEqual({ gameIndex: 3 });
    expect(moveLauncherSelection({ gameIndex: 3 }, 1, 4)).toEqual({ gameIndex: 0 });
  });

  it('fails fast for an invalid catalog size', () => {
    expect(() => moveLauncherSelection(createLauncherSelection(), 1, 0)).toThrow(
      'Launcher game count must be a positive integer'
    );
  });
});
