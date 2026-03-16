import { describe, expect, it } from 'vitest';

import { analyzeAudio } from '../src/audio/analyze';

describe('analyzeAudio sections', () => {
  it('detects at least one section boundary for a signal with large structural change', () => {
    const sampleRateHz = 8000;
    const durationSec = 24;
    const totalSamples = sampleRateHz * durationSec;
    const samples = new Float32Array(totalSamples);

    for (let sampleIndex = 0; sampleIndex < totalSamples; sampleIndex += 1) {
      const t = sampleIndex / sampleRateHz;
      if (t < 8) {
        samples[sampleIndex] = Math.sin(2 * Math.PI * 110 * t) * 0.25;
      } else if (t < 16) {
        samples[sampleIndex] = Math.sin(2 * Math.PI * 620 * t) * 0.2;
      } else {
        const noise = Math.sin(2 * Math.PI * 40 * t) * Math.sin(2 * Math.PI * 900 * t);
        samples[sampleIndex] = noise * 0.3;
      }
    }

    const analyzed = analyzeAudio(samples, {
      sampleRateHz,
      curveFps: 25,
      beatsPerBar: 4,
      durationSec
    });

    expect(analyzed.sections[0]).toEqual({ t: 0, id: 0 });
    expect(analyzed.sections.length).toBeGreaterThan(1);

    const hasBoundaryNearMidpoint = analyzed.sections.some((section) => section.id > 0 && section.t >= 7 && section.t <= 17);
    expect(hasBoundaryNearMidpoint).toBe(true);
  });
});
