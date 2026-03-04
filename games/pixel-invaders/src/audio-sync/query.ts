import type { SyncCurveSample, SyncEvent, SyncEventType, SyncSection, SyncTrackRuntime } from './types';

const TIME_EPSILON_SEC = 0.000_001;

function assertFinite(value: number, context: string): void {
  if (!Number.isFinite(value)) {
    throw new Error(`${context} must be finite, got ${value}.`);
  }
}

function assertTimeInTrackRange(track: SyncTrackRuntime['track'], timeSec: number, context: string): void {
  assertFinite(timeSec, context);
  if (timeSec < -TIME_EPSILON_SEC || timeSec > track.track.duration_sec + TIME_EPSILON_SEC) {
    throw new Error(`${context} must be in [0, ${track.track.duration_sec}], got ${timeSec}.`);
  }
}

function clampTimeSec(track: SyncTrackRuntime['track'], timeSec: number): number {
  return Math.max(0, Math.min(track.track.duration_sec, timeSec));
}

function upperBoundByTime<T extends { readonly t: number }>(items: ReadonlyArray<T>, timeSec: number): number {
  let low = 0;
  let high = items.length;

  while (low < high) {
    const mid = Math.floor((low + high) / 2);
    if (items[mid].t <= timeSec) {
      low = mid + 1;
    } else {
      high = mid;
    }
  }

  return low;
}

function sourceEvents(track: SyncTrackRuntime, type: SyncEventType | undefined): ReadonlyArray<SyncEvent> {
  if (type === undefined) {
    return track.track.events;
  }

  if (type === 'beat') {
    return track.beats;
  }

  if (type === 'bar') {
    return track.bars;
  }

  return track.onsets;
}

function sectionByIndex(sections: ReadonlyArray<SyncSection>, index: number): SyncSection {
  const section = sections[index];
  if (section === undefined) {
    throw new Error(`Section index ${index} is out of range.`);
  }

  return section;
}

export function sectionAt(track: SyncTrackRuntime, timeSec: number): number {
  assertTimeInTrackRange(track.track, timeSec, 'sectionAt.timeSec');
  const clampedTimeSec = clampTimeSec(track.track, timeSec);
  const sections = track.track.sections;
  const upperBound = upperBoundByTime(sections, clampedTimeSec);
  const sectionIndex = Math.max(0, upperBound - 1);

  return sectionByIndex(sections, sectionIndex).id;
}

export function sampleCurve(track: SyncTrackRuntime, timeSec: number): SyncCurveSample {
  assertTimeInTrackRange(track.track, timeSec, 'sampleCurve.timeSec');
  const clampedTimeSec = clampTimeSec(track.track, timeSec);
  const samples = track.track.curves.samples;
  if (samples.length === 0) {
    throw new Error('sampleCurve requires at least one curve sample.');
  }

  const fps = track.track.curves.fps;
  const frame = Math.max(0, Math.min(samples.length - 1, clampedTimeSec * fps));
  const i0 = Math.floor(frame);
  const i1 = Math.min(samples.length - 1, i0 + 1);
  const a = samples[i0];
  const b = samples[i1];
  if (a === undefined || b === undefined) {
    throw new Error(`Curve frame index out of bounds: i0=${i0}, i1=${i1}.`);
  }

  const t = frame - i0;

  return {
    t: clampedTimeSec,
    low: a.low + (b.low - a.low) * t,
    mid: a.mid + (b.mid - a.mid) * t,
    high: a.high + (b.high - a.high) * t,
    rms: a.rms + (b.rms - a.rms) * t
  };
}

export function eventsInRange(
  track: SyncTrackRuntime,
  fromSec: number,
  toSec: number,
  type?: SyncEventType
): ReadonlyArray<SyncEvent> {
  assertTimeInTrackRange(track.track, fromSec, 'eventsInRange.fromSec');
  assertTimeInTrackRange(track.track, toSec, 'eventsInRange.toSec');

  if (toSec + TIME_EPSILON_SEC < fromSec) {
    throw new Error(`eventsInRange requires toSec >= fromSec, got ${fromSec}..${toSec}.`);
  }

  const events = sourceEvents(track, type);
  const startIndex = upperBoundByTime(events, fromSec);
  const endIndex = upperBoundByTime(events, toSec);
  return events.slice(startIndex, endIndex);
}
