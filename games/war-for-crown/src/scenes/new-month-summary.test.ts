import { describe, expect, it } from 'vitest';

import { newMonthEventLabel } from './new-month-summary';

describe('War for Crown new-month summary', () => {
  it('describes random events instead of exposing internal event codes', () => {
    const label = newMonthEventLabel({
      type: 'c64-random-event',
      playerId: 'p1',
      eventId: 'zf',
      effect: 'soldiers-lost',
      amount: 7,
      provinceId: 'province-3'
    }, 'pl');

    expect(label).toBe('Zaraza zabija 7 zolnierzy w prow. 3.');
    expect(label).not.toContain('zf');
    expect(label).not.toContain('soldiers-lost');
  });
});
