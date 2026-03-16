import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import * as path from 'node:path';

import { describe, expect, it } from 'vitest';

interface GoldenFingerprint {
  readonly source_mp3_path: string;
  readonly source_mp3_sha256: string;
  readonly fingerprint: {
    readonly schema_version: '1.0';
    readonly bpm: number;
    readonly beat_offset_sec: number;
    readonly events_len: number;
    readonly curves_len: number;
    readonly sections_len: number;
    readonly first_events: ReadonlyArray<Record<string, unknown>>;
    readonly first_curve: Record<string, unknown>;
    readonly first_sections: ReadonlyArray<Record<string, unknown>>;
  };
}

const GOLDEN_PATH = path.resolve(import.meta.dirname, 'fixtures', 'pixel-invaders.golden.json');

async function loadGolden(): Promise<GoldenFingerprint> {
  const raw = await readFile(GOLDEN_PATH, 'utf8');
  return JSON.parse(raw) as GoldenFingerprint;
}

describe('golden fingerprint (real MP3 from light80)', () => {
  it('matches MP3 hash and expected sync fingerprint snapshot', async () => {
    const golden = await loadGolden();

    expect(existsSync(golden.source_mp3_path)).toBe(true);
    const sourceBuffer = await readFile(golden.source_mp3_path);
    const sha256 = createHash('sha256').update(sourceBuffer).digest('hex');
    expect(sha256).toBe(golden.source_mp3_sha256);

    expect(golden.fingerprint.schema_version).toBe('1.0');
    expect(golden.fingerprint.bpm).toBe(125);
    expect(golden.fingerprint.beat_offset_sec).toBe(0.34);
    expect(golden.fingerprint.events_len).toBe(1599);
    expect(golden.fingerprint.curves_len).toBe(9430);
    expect(golden.fingerprint.sections_len).toBe(12);

    expect(golden.fingerprint.first_events).toEqual([
      { t: 0.34, type: 'beat', i: 0, strength: 0 },
      { t: 0.34, type: 'bar', i: 0, strength: 0 },
      { t: 0.36, type: 'onset', strength: 0.4476, band: 'mid' },
      { t: 0.82, type: 'beat', i: 1, strength: 0 },
      { t: 1.3, type: 'beat', i: 2, strength: 0 },
      { t: 1.78, type: 'beat', i: 3, strength: 0 },
      { t: 2.26, type: 'beat', i: 4, strength: 0 },
      { t: 2.26, type: 'bar', i: 1, strength: 0 }
    ]);

    expect(golden.fingerprint.first_curve).toEqual({
      t: 0,
      low: 0.0314,
      mid: 1,
      high: 0.4763,
      rms: 0.3581
    });

    expect(golden.fingerprint.first_sections).toEqual([
      { t: 0, id: 0 },
      { t: 4.36, id: 1 },
      { t: 12.7, id: 2 },
      { t: 20.8, id: 3 },
      { t: 29.04, id: 4 },
      { t: 37.14, id: 5 }
    ]);
  });
});
