import { describe, expect, it } from 'vitest';

import syncRaw from '../../../shared-assets/src/game-bgm.sync.json';
import { createSyncTrackRuntime } from './validate';

describe('createSyncTrackRuntime', () => {
  it('validates and indexes the bundled track sync file', () => {
    const runtime = createSyncTrackRuntime(syncRaw, 'pixel-bgm-sync');

    expect(runtime.track.schema_version).toBe('1.0');
    expect(runtime.track.track.duration_sec).toBeGreaterThan(180);
    expect(runtime.track.events.length).toBeGreaterThan(1000);
    expect(runtime.beats.length).toBeGreaterThan(300);
    expect(runtime.bars.length).toBeGreaterThan(50);
    expect(runtime.onsets.length).toBeGreaterThan(500);
    expect(runtime.track.curves.samples.length).toBeGreaterThan(9000);
    expect(runtime.track.sections.length).toBeGreaterThan(5);
  });

  it('rejects unsupported schema version', () => {
    const invalid = {
      ...syncRaw,
      schema_version: '2.0'
    };

    expect(() => createSyncTrackRuntime(invalid, 'invalid-sync')).toThrow(
      'invalid-sync.schema_version must be "1.0"'
    );
  });

  it('rejects onset without band', () => {
    const invalid = {
      schema_version: '1.0',
      track: {
        source_file: 'test.mp3',
        duration_sec: 2,
        sample_rate_hz: 44100
      },
      timing: {
        bpm: 120,
        time_signature: '4/4',
        beat_offset_sec: 0
      },
      events: [
        {
          t: 0.5,
          type: 'onset',
          strength: 0.3
        }
      ],
      curves: {
        fps: 2,
        samples: [
          { t: 0, low: 0, mid: 0, high: 0, rms: 0 },
          { t: 0.5, low: 0.2, mid: 0.2, high: 0.2, rms: 0.2 },
          { t: 1, low: 0.4, mid: 0.4, high: 0.4, rms: 0.4 },
          { t: 1.5, low: 0.6, mid: 0.6, high: 0.6, rms: 0.6 },
          { t: 2, low: 0.8, mid: 0.8, high: 0.8, rms: 0.8 }
        ]
      },
      sections: [
        { t: 0, id: 0 },
        { t: 1, id: 1 }
      ]
    };

    expect(() => createSyncTrackRuntime(invalid, 'invalid-sync')).toThrow(
      'invalid-sync.events[0].band must be one of low|mid|high.'
    );
  });
});
