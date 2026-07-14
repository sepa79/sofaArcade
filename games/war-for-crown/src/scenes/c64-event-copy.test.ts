import { describe, expect, it } from 'vitest';

import { c64RandomEventCopy } from './c64-event-copy';

describe('C64 random event copy', () => {
  it('explains the actual consequence and location', () => {
    expect(c64RandomEventCopy({ eventId: 'zf', amount: 7, provinceId: '3', provinceLabel: 'Prowincja 3' }, 'pl'))
      .toBe('Zaraza zabija 7 zolnierzy w Prowincja 3.');
  });

  it('explains when a gated event has no effect', () => {
    expect(c64RandomEventCopy({ eventId: 'zt', amount: 0, provinceId: null, provinceLabel: null }, 'pl'))
      .toBe('Zdarzenie nie przynioslo skutku.');
  });
});
