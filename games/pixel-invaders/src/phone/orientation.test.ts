import { describe, expect, it } from 'vitest';

import { normalizeOrientationAngle, readOrientationAngle, resolveMoveGamma } from './orientation';

describe('normalizeOrientationAngle', () => {
  it('normalizes valid quarter turns', () => {
    expect(normalizeOrientationAngle(0)).toBe(0);
    expect(normalizeOrientationAngle(90)).toBe(90);
    expect(normalizeOrientationAngle(180)).toBe(180);
    expect(normalizeOrientationAngle(270)).toBe(270);
    expect(normalizeOrientationAngle(-90)).toBe(270);
    expect(normalizeOrientationAngle(450)).toBe(90);
  });

  it('rejects unsupported values', () => {
    expect(() => normalizeOrientationAngle(45)).toThrow('Unsupported orientation angle');
  });
});

describe('readOrientationAngle', () => {
  it('prefers screen.orientation.angle when present', () => {
    expect(
      readOrientationAngle({
        screen: { orientation: { angle: 90 } },
        orientation: 270
      })
    ).toBe(90);
  });

  it('reads legacy window.orientation when screen orientation is unavailable', () => {
    expect(
      readOrientationAngle({
        screen: {},
        orientation: -90
      })
    ).toBe(270);
  });

  it('fails when browser exposes neither orientation source', () => {
    expect(() =>
      readOrientationAngle({
        screen: {}
      })
    ).toThrow('Browser orientation angle API is unavailable.');
  });
});

describe('resolveMoveGamma', () => {
  const sample = {
    gamma: 12,
    beta: 18
  };

  it('keeps portrait mapping', () => {
    expect(resolveMoveGamma(sample, 0)).toBe(12);
    expect(resolveMoveGamma(sample, 180)).toBe(-12);
  });

  it('uses corrected landscape mapping', () => {
    expect(resolveMoveGamma(sample, 90)).toBe(18);
    expect(resolveMoveGamma(sample, 270)).toBe(-18);
  });
});
