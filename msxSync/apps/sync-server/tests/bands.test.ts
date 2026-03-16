import { describe, expect, it } from 'vitest';

import { createBandBins, DEFAULT_BANDS } from '../src/audio/bands';

describe('createBandBins', () => {
  it('creates monotonic ranges inside nyquist bins', () => {
    const bins = createBandBins(DEFAULT_BANDS, 2048, 44100);

    expect(bins.low[0]).toBeLessThanOrEqual(bins.low[1]);
    expect(bins.mid[0]).toBeLessThanOrEqual(bins.mid[1]);
    expect(bins.high[0]).toBeLessThanOrEqual(bins.high[1]);
    expect(bins.high[1]).toBeLessThanOrEqual(1024);
  });
});
