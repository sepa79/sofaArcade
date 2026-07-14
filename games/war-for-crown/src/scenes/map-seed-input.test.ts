import { describe, expect, it } from 'vitest';

import { parseMapSeedInput } from './map-seed-input';

describe('map seed input', () => {
  it('parses the complete uint32 seed range', () => {
    expect(parseMapSeedInput('1')).toBe(1);
    expect(parseMapSeedInput('4294967295')).toBe(0xffffffff);
  });

  it.each(['', '0', '-1', '1.5', 'abc', '4294967296'])(
    'rejects invalid seed input %s',
    (value) => {
      expect(() => parseMapSeedInput(value)).toThrow();
    }
  );
});
