export interface BandConfig {
  readonly low: readonly [number, number];
  readonly mid: readonly [number, number];
  readonly high: readonly [number, number];
}

export const DEFAULT_BANDS: BandConfig = {
  low: [20, 150],
  mid: [150, 2_000],
  high: [2_000, 12_000]
};

export interface BandBins {
  readonly low: readonly [number, number];
  readonly mid: readonly [number, number];
  readonly high: readonly [number, number];
}

function hzToBin(hz: number, fftSize: number, sampleRateHz: number): number {
  return Math.floor((hz * fftSize) / sampleRateHz);
}

function clampBin(value: number, maxBinInclusive: number): number {
  return Math.max(0, Math.min(maxBinInclusive, value));
}

function toRange(rangeHz: readonly [number, number], fftSize: number, sampleRateHz: number): readonly [number, number] {
  const maxBin = fftSize / 2;
  const start = clampBin(hzToBin(rangeHz[0], fftSize, sampleRateHz), maxBin);
  const end = clampBin(hzToBin(rangeHz[1], fftSize, sampleRateHz), maxBin);
  if (end < start) {
    throw new Error(`Invalid band frequency range: [${rangeHz[0]}, ${rangeHz[1]}].`);
  }

  return [start, end] as const;
}

export function createBandBins(config: BandConfig, fftSize: number, sampleRateHz: number): BandBins {
  return {
    low: toRange(config.low, fftSize, sampleRateHz),
    mid: toRange(config.mid, fftSize, sampleRateHz),
    high: toRange(config.high, fftSize, sampleRateHz)
  };
}
