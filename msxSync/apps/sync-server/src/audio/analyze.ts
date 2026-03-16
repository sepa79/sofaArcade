import FFT from 'fft.js';

import { createBandBins, DEFAULT_BANDS, type BandConfig } from './bands';
import { robustNormalize } from './normalize';
import type { SyncCurveSample, SyncEvent, SyncOnsetBand, SyncSection } from '../sync/schema';

const FFT_SIZE = 2048;

interface AnalysisOptions {
  readonly sampleRateHz: number;
  readonly curveFps: number;
  readonly beatsPerBar: number;
  readonly durationSec: number;
  readonly bands?: BandConfig;
}

interface FrameFeatures {
  readonly t: number;
  readonly lowEnergy: number;
  readonly midEnergy: number;
  readonly highEnergy: number;
  readonly rms: number;
  readonly flux: number;
  readonly dominantBand: SyncOnsetBand;
}

export interface AnalysisResult {
  readonly bpm: number;
  readonly beatOffsetSec: number;
  readonly curves: ReadonlyArray<SyncCurveSample>;
  readonly events: ReadonlyArray<SyncEvent>;
  readonly sections: ReadonlyArray<SyncSection>;
}

function createHannWindow(size: number): Float32Array {
  const window = new Float32Array(size);
  for (let i = 0; i < size; i += 1) {
    window[i] = 0.5 * (1 - Math.cos((2 * Math.PI * i) / (size - 1)));
  }

  return window;
}

function sumRange(values: Float64Array, start: number, end: number): number {
  let sum = 0;
  for (let i = start; i <= end; i += 1) {
    sum += values[i] ?? 0;
  }

  return sum;
}

function frameDominantBand(lowEnergy: number, midEnergy: number, highEnergy: number): SyncOnsetBand {
  if (lowEnergy >= midEnergy && lowEnergy >= highEnergy) {
    return 'low';
  }

  if (midEnergy >= highEnergy) {
    return 'mid';
  }

  return 'high';
}

function buildFrames(samples: Float32Array, options: AnalysisOptions): ReadonlyArray<FrameFeatures> {
  const hopSize = Math.max(1, Math.round(options.sampleRateHz / options.curveFps));
  const frameCount = Math.max(1, Math.ceil(samples.length / hopSize));
  const fft = new FFT(FFT_SIZE);
  const window = createHannWindow(FFT_SIZE);
  const bandBins = createBandBins(options.bands ?? DEFAULT_BANDS, FFT_SIZE, options.sampleRateHz);

  const inFrame = new Float64Array(FFT_SIZE);
  const spectrum = fft.createComplexArray() as Float64Array;
  const magnitudes = new Float64Array(FFT_SIZE / 2 + 1);
  const previousMagnitudes = new Float64Array(FFT_SIZE / 2 + 1);

  const frames: FrameFeatures[] = [];

  for (let frameIndex = 0; frameIndex < frameCount; frameIndex += 1) {
    const start = frameIndex * hopSize;
    let squareSum = 0;

    for (let i = 0; i < FFT_SIZE; i += 1) {
      const sample = samples[start + i] ?? 0;
      squareSum += sample * sample;
      inFrame[i] = sample * (window[i] ?? 0);
    }

    fft.realTransform(spectrum, inFrame);
    fft.completeSpectrum(spectrum);

    for (let bin = 0; bin <= FFT_SIZE / 2; bin += 1) {
      const re = spectrum[bin * 2] ?? 0;
      const im = spectrum[bin * 2 + 1] ?? 0;
      const mag = Math.hypot(re, im);
      magnitudes[bin] = mag;
    }

    const lowEnergy = sumRange(magnitudes, bandBins.low[0], bandBins.low[1]);
    const midEnergy = sumRange(magnitudes, bandBins.mid[0], bandBins.mid[1]);
    const highEnergy = sumRange(magnitudes, bandBins.high[0], bandBins.high[1]);

    let flux = 0;
    for (let bin = 0; bin <= FFT_SIZE / 2; bin += 1) {
      const current = magnitudes[bin] ?? 0;
      const previous = previousMagnitudes[bin] ?? 0;
      const delta = current - previous;
      if (delta > 0) {
        flux += delta;
      }

      previousMagnitudes[bin] = current;
    }

    frames.push({
      t: start / options.sampleRateHz,
      lowEnergy,
      midEnergy,
      highEnergy,
      rms: Math.sqrt(squareSum / FFT_SIZE),
      flux,
      dominantBand: frameDominantBand(lowEnergy, midEnergy, highEnergy)
    });
  }

  return frames;
}

function mean(values: ReadonlyArray<number>): number {
  if (values.length === 0) {
    throw new Error('Cannot compute mean of empty array.');
  }

  let sum = 0;
  for (const value of values) {
    sum += value;
  }

  return sum / values.length;
}

function standardDeviation(values: ReadonlyArray<number>, avg: number): number {
  if (values.length === 0) {
    throw new Error('Cannot compute std dev of empty array.');
  }

  let sumSq = 0;
  for (const value of values) {
    const delta = value - avg;
    sumSq += delta * delta;
  }

  return Math.sqrt(sumSq / values.length);
}

function detectOnsets(frames: ReadonlyArray<FrameFeatures>, fluxNormalized: ReadonlyArray<number>, curveFps: number): SyncEvent[] {
  const avg = mean(fluxNormalized);
  const std = standardDeviation(fluxNormalized, avg);
  const threshold = avg + std * 0.6;
  const minGapFrames = Math.max(1, Math.round(curveFps * 0.08));

  const events: SyncEvent[] = [];
  let lastOnsetFrame = -minGapFrames;

  for (let i = 1; i < fluxNormalized.length - 1; i += 1) {
    const value = fluxNormalized[i] ?? 0;
    const prev = fluxNormalized[i - 1] ?? 0;
    const next = fluxNormalized[i + 1] ?? 0;

    if (value <= threshold || value < prev || value < next) {
      continue;
    }

    if (i - lastOnsetFrame < minGapFrames) {
      continue;
    }

    const frame = frames[i];
    if (frame === undefined) {
      throw new Error(`Missing frame at onset index ${i}.`);
    }

    events.push({
      t: frame.t,
      type: 'onset',
      strength: value,
      band: frame.dominantBand
    });

    lastOnsetFrame = i;
  }

  return events;
}

function estimateBeatLag(envelope: ReadonlyArray<number>, curveFps: number): number {
  const minLag = Math.max(1, Math.ceil((curveFps * 60) / 240));
  const maxLag = Math.min(envelope.length - 1, Math.floor((curveFps * 60) / 20));
  if (maxLag < minLag) {
    throw new Error(`Not enough envelope samples to estimate beat lag. length=${envelope.length}`);
  }

  let bestLag = minLag;
  let bestScore = Number.NEGATIVE_INFINITY;

  for (let lag = minLag; lag <= maxLag; lag += 1) {
    let score = 0;
    for (let i = lag; i < envelope.length; i += 1) {
      const current = envelope[i] ?? 0;
      const previous = envelope[i - lag] ?? 0;
      score += current * previous;
    }

    if (score > bestScore) {
      bestScore = score;
      bestLag = lag;
    }
  }

  return bestLag;
}

function estimateBeatOffsetSec(envelope: ReadonlyArray<number>, beatLag: number, curveFps: number): number {
  let bestOffset = 0;
  let bestScore = Number.NEGATIVE_INFINITY;

  for (let offset = 0; offset < beatLag; offset += 1) {
    let score = 0;
    for (let i = offset; i < envelope.length; i += beatLag) {
      score += envelope[i] ?? 0;
    }

    if (score > bestScore) {
      bestScore = score;
      bestOffset = offset;
    }
  }

  return bestOffset / curveFps;
}

function buildBeatAndBarEvents(
  envelope: ReadonlyArray<number>,
  curveFps: number,
  durationSec: number,
  beatLag: number,
  beatOffsetSec: number,
  beatsPerBar: number
): SyncEvent[] {
  const beatPeriodSec = beatLag / curveFps;
  const beatEvents: SyncEvent[] = [];

  for (let beatIndex = 0; ; beatIndex += 1) {
    const t = beatOffsetSec + beatIndex * beatPeriodSec;
    if (t > durationSec) {
      break;
    }

    const frameIndex = Math.round(t * curveFps);
    const strength = envelope[frameIndex] ?? 0;

    beatEvents.push({
      t,
      type: 'beat',
      i: beatIndex,
      strength
    });

    if (beatIndex % beatsPerBar === 0) {
      beatEvents.push({
        t,
        type: 'bar',
        i: Math.floor(beatIndex / beatsPerBar),
        strength
      });
    }
  }

  return beatEvents;
}

function buildCurves(
  frames: ReadonlyArray<FrameFeatures>,
  lowNorm: ReadonlyArray<number>,
  midNorm: ReadonlyArray<number>,
  highNorm: ReadonlyArray<number>,
  rmsNorm: ReadonlyArray<number>
): SyncCurveSample[] {
  const curves: SyncCurveSample[] = [];

  for (let i = 0; i < frames.length; i += 1) {
    const frame = frames[i];
    if (frame === undefined) {
      throw new Error(`Missing frame for curve index ${i}.`);
    }

    curves.push({
      t: frame.t,
      low: lowNorm[i] ?? 0,
      mid: midNorm[i] ?? 0,
      high: highNorm[i] ?? 0,
      rms: rmsNorm[i] ?? 0
    });
  }

  return curves;
}

function compareEvents(a: SyncEvent, b: SyncEvent): number {
  if (a.t !== b.t) {
    return a.t - b.t;
  }

  const typeOrder: Record<SyncEvent['type'], number> = {
    beat: 0,
    bar: 1,
    onset: 2
  };

  return typeOrder[a.type] - typeOrder[b.type];
}

function detectSections(
  curves: ReadonlyArray<SyncCurveSample>,
  curveFps: number,
  durationSec: number
): ReadonlyArray<SyncSection> {
  if (curves.length === 0) {
    throw new Error('Cannot detect sections from empty curve list.');
  }

  if (curves.length === 1) {
    return [{ t: 0, id: 0 }];
  }

  const noveltyRaw: number[] = [0];
  for (let i = 1; i < curves.length; i += 1) {
    const previous = curves[i - 1];
    const current = curves[i];
    if (previous === undefined || current === undefined) {
      throw new Error(`Missing curve sample at index ${i}.`);
    }

    const deltaLow = Math.abs(current.low - previous.low);
    const deltaMid = Math.abs(current.mid - previous.mid);
    const deltaHigh = Math.abs(current.high - previous.high);
    const deltaRms = Math.abs(current.rms - previous.rms);
    noveltyRaw.push(deltaLow * 0.25 + deltaMid * 0.35 + deltaHigh * 0.25 + deltaRms * 0.15);
  }

  const novelty = robustNormalize(noveltyRaw);
  const avg = mean(novelty);
  const std = standardDeviation(novelty, avg);
  const threshold = avg + std * 0.9;
  const minGapFrames = Math.max(1, Math.round(curveFps * 8));
  const maxSections = 12;

  const boundaryFrames: number[] = [];
  let lastBoundary = -minGapFrames;
  for (let i = 1; i < novelty.length - 1; i += 1) {
    const current = novelty[i] ?? 0;
    const previous = novelty[i - 1] ?? 0;
    const next = novelty[i + 1] ?? 0;
    if (current < threshold || current < previous || current < next) {
      continue;
    }

    if (i - lastBoundary < minGapFrames) {
      continue;
    }

    const t = i / curveFps;
    if (t < 4 || t > durationSec - 4) {
      continue;
    }

    boundaryFrames.push(i);
    lastBoundary = i;
    if (boundaryFrames.length >= maxSections - 1) {
      break;
    }
  }

  const sections: SyncSection[] = [{ t: 0, id: 0 }];
  for (let i = 0; i < boundaryFrames.length; i += 1) {
    const frame = boundaryFrames[i];
    if (frame === undefined) {
      throw new Error(`Missing section boundary at index ${i}.`);
    }

    sections.push({
      t: frame / curveFps,
      id: i + 1
    });
  }

  return sections;
}

export function analyzeAudio(samples: Float32Array, options: AnalysisOptions): AnalysisResult {
  const frames = buildFrames(samples, options);
  const low = frames.map((frame) => frame.lowEnergy);
  const mid = frames.map((frame) => frame.midEnergy);
  const high = frames.map((frame) => frame.highEnergy);
  const rms = frames.map((frame) => frame.rms);
  const flux = frames.map((frame) => frame.flux);

  const lowNorm = robustNormalize(low);
  const midNorm = robustNormalize(mid);
  const highNorm = robustNormalize(high);
  const rmsNorm = robustNormalize(rms);
  const fluxNorm = robustNormalize(flux);

  const beatLag = estimateBeatLag(fluxNorm, options.curveFps);
  const beatOffsetSec = estimateBeatOffsetSec(fluxNorm, beatLag, options.curveFps);
  const bpm = (60 * options.curveFps) / beatLag;

  const events = [
    ...buildBeatAndBarEvents(fluxNorm, options.curveFps, options.durationSec, beatLag, beatOffsetSec, options.beatsPerBar),
    ...detectOnsets(frames, fluxNorm, options.curveFps)
  ].sort(compareEvents);
  const curves = buildCurves(frames, lowNorm, midNorm, highNorm, rmsNorm);
  const sections = detectSections(curves, options.curveFps, options.durationSec);

  return {
    bpm,
    beatOffsetSec,
    curves,
    events,
    sections
  };
}
