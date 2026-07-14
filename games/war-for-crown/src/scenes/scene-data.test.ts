import { describe, expect, it } from 'vitest';

import { parseWarForCrownReturnUrl, parseWarForCrownSeed } from './scene-data';

describe('War for Crown scene data', () => {
  it('parses deployment return paths and explicit seeds', () => {
    expect(parseWarForCrownSeed({ seed: 17 })).toBe(17);
    expect(parseWarForCrownReturnUrl({ returnUrl: '/sofaArcade/' })).toBe('/sofaArcade/');
  });

  it('rejects external or relative return URLs', () => {
    expect(() => parseWarForCrownReturnUrl({ returnUrl: 'https://example.com/' })).toThrow(
      'must start and end with "/"'
    );
  });
});
