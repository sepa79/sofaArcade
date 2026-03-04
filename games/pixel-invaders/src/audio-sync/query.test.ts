import { describe, expect, it } from 'vitest';

import { SyncClock } from './clock';
import { eventsInRange, sampleCurve, sectionAt } from './query';
import { createSyncTrackRuntime } from './validate';

function createFixtureRuntime() {
  return createSyncTrackRuntime(
    {
      schema_version: '1.0',
      track: {
        source_file: 'fixture.mp3',
        duration_sec: 2,
        sample_rate_hz: 44100
      },
      timing: {
        bpm: 120,
        time_signature: '4/4',
        beat_offset_sec: 0
      },
      events: [
        { t: 0.1, type: 'onset', strength: 0.2, band: 'high' },
        { t: 0.5, type: 'beat', i: 0, strength: 0.3 },
        { t: 1, type: 'bar', i: 0, strength: 0.4 },
        { t: 1.9, type: 'beat', i: 1, strength: 0.5 }
      ],
      curves: {
        fps: 2,
        samples: [
          { t: 0, low: 0, mid: 0, high: 0, rms: 0 },
          { t: 0.5, low: 0.2, mid: 0.4, high: 0.6, rms: 0.8 },
          { t: 1, low: 0.4, mid: 0.6, high: 0.8, rms: 1 },
          { t: 1.5, low: 0.2, mid: 0.4, high: 0.6, rms: 0.8 },
          { t: 2, low: 0, mid: 0, high: 0, rms: 0 }
        ]
      },
      sections: [
        { t: 0, id: 0 },
        { t: 1, id: 1 }
      ]
    },
    'fixture-sync'
  );
}

describe('audio-sync query helpers', () => {
  it('samples curve with linear interpolation', () => {
    const runtime = createFixtureRuntime();
    const sample = sampleCurve(runtime, 0.25);

    expect(sample.low).toBeCloseTo(0.1, 6);
    expect(sample.mid).toBeCloseTo(0.2, 6);
    expect(sample.high).toBeCloseTo(0.3, 6);
    expect(sample.rms).toBeCloseTo(0.4, 6);
  });

  it('queries events in (from, to] range boundaries', () => {
    const runtime = createFixtureRuntime();
    const events = eventsInRange(runtime, 0.5, 1);

    expect(events).toHaveLength(1);
    expect(events[0].type).toBe('bar');
    expect(events[0].t).toBe(1);
  });

  it('returns current section by timestamp', () => {
    const runtime = createFixtureRuntime();

    expect(sectionAt(runtime, 0.9)).toBe(0);
    expect(sectionAt(runtime, 1.1)).toBe(1);
  });

  it('handles loop boundary by querying tail + head ranges', () => {
    const runtime = createFixtureRuntime();
    const clock = new SyncClock(runtime);

    clock.reset(1.8);
    const frame = clock.tick(0.2, 'playing');

    expect(frame.events.map((event) => event.t)).toEqual([1.9, 0.1]);
    expect(frame.beats.map((event) => event.t)).toEqual([1.9]);
    expect(frame.onsets.map((event) => event.t)).toEqual([0.1]);
  });

  it('resets event window while paused', () => {
    const runtime = createFixtureRuntime();
    const clock = new SyncClock(runtime);

    clock.reset(0.2);
    const pausedFrame = clock.tick(1.2, 'paused');
    expect(pausedFrame.events).toHaveLength(0);

    const resumedFrame = clock.tick(1.3, 'playing');
    expect(resumedFrame.events).toHaveLength(0);
  });
});
