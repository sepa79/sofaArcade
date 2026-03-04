import type {
  SyncCurveSample,
  SyncEvent,
  SyncEventType,
  SyncOnsetBand,
  SyncSection,
  SyncTrack,
  SyncTrackRuntime
} from './types';

const SUPPORTED_SCHEMA_VERSION = '1.0';
const TIME_EPSILON_SEC = 0.000_001;

function requireObject(value: unknown, context: string): Record<string, unknown> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`${context} must be an object.`);
  }

  return value as Record<string, unknown>;
}

function requireFiniteNumber(value: unknown, context: string): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    throw new Error(`${context} must be a finite number.`);
  }

  return value;
}

function requireNonNegativeFiniteNumber(value: unknown, context: string): number {
  const parsed = requireFiniteNumber(value, context);
  if (parsed < 0) {
    throw new Error(`${context} must be >= 0, got ${parsed}.`);
  }

  return parsed;
}

function requireUnitIntervalNumber(value: unknown, context: string): number {
  const parsed = requireFiniteNumber(value, context);
  if (parsed < 0 || parsed > 1) {
    throw new Error(`${context} must be in [0, 1], got ${parsed}.`);
  }

  return parsed;
}

function requirePositiveFiniteNumber(value: unknown, context: string): number {
  const parsed = requireFiniteNumber(value, context);
  if (parsed <= 0) {
    throw new Error(`${context} must be > 0, got ${parsed}.`);
  }

  return parsed;
}

function requireNonEmptyString(value: unknown, context: string): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw new Error(`${context} must be a non-empty string.`);
  }

  return value;
}

function requireInteger(value: unknown, context: string): number {
  const parsed = requireFiniteNumber(value, context);
  if (!Number.isInteger(parsed)) {
    throw new Error(`${context} must be an integer.`);
  }

  return parsed;
}

function assertInRange(value: number, min: number, max: number, context: string): void {
  if (value < min - TIME_EPSILON_SEC || value > max + TIME_EPSILON_SEC) {
    throw new Error(`${context} must be in [${min}, ${max}], got ${value}.`);
  }
}

function parseEventType(value: unknown, context: string): SyncEventType {
  if (value === 'beat' || value === 'bar' || value === 'onset') {
    return value;
  }

  throw new Error(`${context} must be one of beat|bar|onset.`);
}

function parseOnsetBand(value: unknown, context: string): SyncOnsetBand {
  if (value === 'low' || value === 'mid' || value === 'high') {
    return value;
  }

  throw new Error(`${context} must be one of low|mid|high.`);
}

function requireArray(value: unknown, context: string): ReadonlyArray<unknown> {
  if (!Array.isArray(value)) {
    throw new Error(`${context} must be an array.`);
  }

  return value;
}

function assertSortedByTime<T extends { readonly t: number }>(
  items: ReadonlyArray<T>,
  context: string
): void {
  for (let index = 1; index < items.length; index += 1) {
    const previous = items[index - 1];
    const current = items[index];
    if (current.t + TIME_EPSILON_SEC < previous.t) {
      throw new Error(`${context} must be sorted by t ascending.`);
    }
  }
}

function parseEvents(value: unknown, durationSec: number, context: string): ReadonlyArray<SyncEvent> {
  const rawEvents = requireArray(value, context);
  const events = rawEvents.map((item, index) => {
    const eventContext = `${context}[${index}]`;
    const raw = requireObject(item, eventContext);
    const t = requireNonNegativeFiniteNumber(raw.t, `${eventContext}.t`);
    assertInRange(t, 0, durationSec, `${eventContext}.t`);

    const type = parseEventType(raw.type, `${eventContext}.type`);
    const strength = requireUnitIntervalNumber(raw.strength, `${eventContext}.strength`);

    if (type === 'onset') {
      if (raw.i !== undefined) {
        throw new Error(`${eventContext}.i must be undefined for onset events.`);
      }

      return {
        t,
        type,
        strength,
        band: parseOnsetBand(raw.band, `${eventContext}.band`)
      } satisfies SyncEvent;
    }

    if (raw.band !== undefined) {
      throw new Error(`${eventContext}.band must be undefined for ${type} events.`);
    }

    const i = requireInteger(raw.i, `${eventContext}.i`);
    if (i < 0) {
      throw new Error(`${eventContext}.i must be >= 0, got ${i}.`);
    }

    return {
      t,
      type,
      i,
      strength
    } satisfies SyncEvent;
  });

  assertSortedByTime(events, context);
  return events;
}

function parseCurveSamples(
  value: unknown,
  durationSec: number,
  fps: number,
  context: string
): ReadonlyArray<SyncCurveSample> {
  const rawSamples = requireArray(value, context);
  if (rawSamples.length === 0) {
    throw new Error(`${context} must not be empty.`);
  }

  const expectedStep = 1 / fps;
  const samples = rawSamples.map((item, index) => {
    const sampleContext = `${context}[${index}]`;
    const raw = requireObject(item, sampleContext);
    const t = requireNonNegativeFiniteNumber(raw.t, `${sampleContext}.t`);
    assertInRange(t, 0, durationSec, `${sampleContext}.t`);

    return {
      t,
      low: requireUnitIntervalNumber(raw.low, `${sampleContext}.low`),
      mid: requireUnitIntervalNumber(raw.mid, `${sampleContext}.mid`),
      high: requireUnitIntervalNumber(raw.high, `${sampleContext}.high`),
      rms: requireUnitIntervalNumber(raw.rms, `${sampleContext}.rms`)
    } satisfies SyncCurveSample;
  });

  assertSortedByTime(samples, context);

  for (let index = 0; index < samples.length; index += 1) {
    const expectedTime = index * expectedStep;
    const delta = Math.abs(samples[index].t - expectedTime);
    if (delta > expectedStep + TIME_EPSILON_SEC) {
      throw new Error(
        `${context}[${index}].t (${samples[index].t}) diverges from fps grid (${expectedTime}).`
      );
    }
  }

  return samples;
}

function parseSections(value: unknown, durationSec: number, context: string): ReadonlyArray<SyncSection> {
  const rawSections = requireArray(value, context);
  if (rawSections.length === 0) {
    throw new Error(`${context} must not be empty.`);
  }

  const sections = rawSections.map((item, index) => {
    const sectionContext = `${context}[${index}]`;
    const raw = requireObject(item, sectionContext);
    const t = requireNonNegativeFiniteNumber(raw.t, `${sectionContext}.t`);
    assertInRange(t, 0, durationSec, `${sectionContext}.t`);

    const id = requireInteger(raw.id, `${sectionContext}.id`);
    if (id < 0) {
      throw new Error(`${sectionContext}.id must be >= 0, got ${id}.`);
    }

    return {
      t,
      id
    } satisfies SyncSection;
  });

  assertSortedByTime(sections, context);

  if (Math.abs(sections[0].t) > TIME_EPSILON_SEC) {
    throw new Error(`${context}[0].t must start at 0, got ${sections[0].t}.`);
  }

  return sections;
}

export function createSyncTrackRuntime(rawValue: unknown, sourceLabel: string): SyncTrackRuntime {
  const sourceContext = requireNonEmptyString(sourceLabel, 'sourceLabel');
  const raw = requireObject(rawValue, sourceContext);

  if (raw.schema_version !== SUPPORTED_SCHEMA_VERSION) {
    throw new Error(
      `${sourceContext}.schema_version must be "${SUPPORTED_SCHEMA_VERSION}", got ${String(raw.schema_version)}.`
    );
  }

  const trackRaw = requireObject(raw.track, `${sourceContext}.track`);
  const durationSec = requirePositiveFiniteNumber(trackRaw.duration_sec, `${sourceContext}.track.duration_sec`);
  const sourceFile = requireNonEmptyString(trackRaw.source_file, `${sourceContext}.track.source_file`);
  const sampleRateHz = requirePositiveFiniteNumber(
    trackRaw.sample_rate_hz,
    `${sourceContext}.track.sample_rate_hz`
  );

  const timingRaw = requireObject(raw.timing, `${sourceContext}.timing`);
  const bpm = requirePositiveFiniteNumber(timingRaw.bpm, `${sourceContext}.timing.bpm`);
  const beatOffsetSec = requireNonNegativeFiniteNumber(
    timingRaw.beat_offset_sec,
    `${sourceContext}.timing.beat_offset_sec`
  );
  assertInRange(beatOffsetSec, 0, durationSec, `${sourceContext}.timing.beat_offset_sec`);
  const timeSignature = requireNonEmptyString(
    timingRaw.time_signature,
    `${sourceContext}.timing.time_signature`
  );

  const curvesRaw = requireObject(raw.curves, `${sourceContext}.curves`);
  const curveFps = requirePositiveFiniteNumber(curvesRaw.fps, `${sourceContext}.curves.fps`);

  const track: SyncTrack = {
    schema_version: '1.0',
    track: {
      source_file: sourceFile,
      duration_sec: durationSec,
      sample_rate_hz: sampleRateHz
    },
    timing: {
      bpm,
      time_signature: timeSignature,
      beat_offset_sec: beatOffsetSec
    },
    events: parseEvents(raw.events, durationSec, `${sourceContext}.events`),
    curves: {
      fps: curveFps,
      samples: parseCurveSamples(curvesRaw.samples, durationSec, curveFps, `${sourceContext}.curves.samples`)
    },
    sections: parseSections(raw.sections, durationSec, `${sourceContext}.sections`)
  };

  return {
    track,
    beats: track.events.filter((event) => event.type === 'beat'),
    bars: track.events.filter((event) => event.type === 'bar'),
    onsets: track.events.filter((event) => event.type === 'onset')
  };
}
