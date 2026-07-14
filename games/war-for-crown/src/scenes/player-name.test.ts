import { describe, expect, it } from 'vitest';

import {
  appendPlayerNameCharacter,
  playerNamesAreComplete,
  removeLastPlayerNameCharacter
} from './player-name';

describe('War for Crown player names', () => {
  it('allows repeated names and names that differ only by case', () => {
    expect(playerNamesAreComplete(['P1', 'P1', 'p1'])).toBe(true);
  });

  it('requires every configured name to contain visible text', () => {
    expect(playerNamesAreComplete(['P1', '   '])).toBe(false);
  });

  it('accepts arbitrary Unicode characters', () => {
    expect(appendPlayerNameCharacter('Żół', 'ć')).toBe('Żółć');
    expect(appendPlayerNameCharacter('Król', '👑')).toBe('Król👑');
  });

  it('removes a complete Unicode code point', () => {
    expect(removeLastPlayerNameCharacter('Anna🙂')).toBe('Anna');
  });
});
