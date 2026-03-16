function clamp01(value: number): number {
  if (value <= 0) {
    return 0;
  }

  if (value >= 1) {
    return 1;
  }

  return value;
}

function percentile(values: ReadonlyArray<number>, p: number): number {
  if (values.length === 0) {
    throw new Error('Cannot compute percentile for empty array.');
  }

  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.floor((sorted.length - 1) * p)));
  const value = sorted[idx];
  if (value === undefined) {
    throw new Error(`Percentile index out of range: ${idx}.`);
  }

  return value;
}

export function robustNormalize(values: ReadonlyArray<number>): number[] {
  if (values.length === 0) {
    throw new Error('Cannot normalize empty array.');
  }

  const p05 = percentile(values, 0.05);
  const p95 = percentile(values, 0.95);
  if (p95 <= p05) {
    return values.map(() => 0);
  }

  const scale = p95 - p05;
  return values.map((value) => clamp01((value - p05) / scale));
}
