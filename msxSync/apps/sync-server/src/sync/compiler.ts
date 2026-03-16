import { readFile, writeFile } from 'node:fs/promises';

import { decodeAudioFile } from '../audio/decode';
import { analyzeAudio } from '../audio/analyze';
import { round } from './round';
import type { SyncTrack } from './schema';

export interface CompileOptions {
  readonly inputPath: string;
  readonly outputPath: string;
  readonly sourceFileName: string;
  readonly sampleRateHz: number;
  readonly curveFps: number;
  readonly beatsPerBar: number;
}

function quantizeTrack(track: SyncTrack): SyncTrack {
  return {
    schema_version: track.schema_version,
    track: {
      source_file: track.track.source_file,
      duration_sec: round(track.track.duration_sec, 3),
      sample_rate_hz: track.track.sample_rate_hz
    },
    timing: {
      bpm: round(track.timing.bpm, 3),
      time_signature: track.timing.time_signature,
      beat_offset_sec: round(track.timing.beat_offset_sec, 3)
    },
    events: track.events.map((event) => ({
      ...event,
      t: round(event.t, 3),
      strength: round(event.strength, 4)
    })),
    curves: {
      fps: track.curves.fps,
      samples: track.curves.samples.map((sample) => ({
        t: round(sample.t, 3),
        low: round(sample.low, 4),
        mid: round(sample.mid, 4),
        high: round(sample.high, 4),
        rms: round(sample.rms, 4)
      }))
    },
    sections: track.sections.map((section) => ({
      t: round(section.t, 3),
      id: section.id
    }))
  };
}

export async function compileTrack(options: CompileOptions): Promise<SyncTrack> {
  const decoded = await decodeAudioFile(options.inputPath, options.sampleRateHz);
  const analyzed = analyzeAudio(decoded.samples, {
    sampleRateHz: options.sampleRateHz,
    curveFps: options.curveFps,
    beatsPerBar: options.beatsPerBar,
    durationSec: decoded.durationSec
  });

  const track = quantizeTrack({
    schema_version: '1.0',
    track: {
      source_file: options.sourceFileName,
      duration_sec: decoded.durationSec,
      sample_rate_hz: decoded.sampleRateHz
    },
    timing: {
      bpm: analyzed.bpm,
      time_signature: `${options.beatsPerBar}/4`,
      beat_offset_sec: analyzed.beatOffsetSec
    },
    events: analyzed.events,
    curves: {
      fps: options.curveFps,
      samples: analyzed.curves
    },
    sections: analyzed.sections
  });

  await writeFile(options.outputPath, `${JSON.stringify(track, null, 2)}\n`, 'utf8');
  return track;
}

export async function loadCompiledTrack(outputPath: string): Promise<SyncTrack> {
  const raw = await readFile(outputPath, 'utf8');
  return JSON.parse(raw) as SyncTrack;
}
