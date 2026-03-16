# AI Runtime Integration Guide: `track.sync.json`

## Goal
Use `track.sync.json` at runtime to drive game effects in sync with music playback.

This guide is for AI coding agents implementing integration in a game project (for example `~/light80`).

## Integration Contract
1. Use audio playback time (`musicTimeSec`) as the single source of truth.
2. Reject invalid sync files immediately (fail fast). Do not add fallback schemas or fallback clocks.
3. Keep one typed runtime object per loaded track.
4. Keep event queries stateless and deterministic.

## File Contract (Schema `1.0`)
Required fields:
- `schema_version` must be `"1.0"`.
- `track.duration_sec`
- `timing.bpm`, `timing.beat_offset_sec`, `timing.time_signature`
- `events[]` with `type` in: `beat | bar | onset`
- `curves.fps`, `curves.samples[]` with `low | mid | high | rms`
- `sections[]` as `{ t, id }`

If any required field is missing or invalid, throw an error with context.

## Runtime Flow
1. Load and validate JSON.
2. Pre-index arrays:
   - `beats = events where type=beat`
   - `bars = events where type=bar`
   - `onsets = events where type=onset`
3. On music start:
   - `lastTimeSec = musicTimeSec`
   - `currentSectionId = sectionAt(musicTimeSec)`
4. Every update tick:
   - Read `nowSec` from audio engine (not frame timer).
   - Sample curve at `nowSec` with linear interpolation.
   - Query events in `(lastTimeSec, nowSec]`.
   - Drive effects from curve values and event hits.
   - Update `lastTimeSec = nowSec`.
5. Handle pause/seek/loop explicitly:
   - Pause: stop advancing logic.
   - Seek: reset `lastTimeSec = nowSec`, recompute section from timestamp.
   - Loop (`nowSec < lastTimeSec`): process `(lastTimeSec, duration]` and `(0, nowSec]`.

## Effect Mapping (Recommended Defaults)
- `low` -> background pulse / bloom amount.
- `mid` -> grid cell glow / lane activity.
- `high` -> sparkles/stars intensity.
- `beat` event -> hard pulse trigger.
- `bar` event -> bigger accent (camera punch / color swap).
- `onset` event:
  - `band=low` -> kick accent
  - `band=mid` -> synth/percussion accent
  - `band=high` -> hi-hat/spark accent

## Minimal TypeScript Reference
```ts
export type SyncEventType = 'beat' | 'bar' | 'onset';
export type SyncOnsetBand = 'low' | 'mid' | 'high';

export interface SyncEvent {
  t: number;
  type: SyncEventType;
  i?: number;
  strength: number;
  band?: SyncOnsetBand;
}

export interface SyncCurveSample {
  t: number;
  low: number;
  mid: number;
  high: number;
  rms: number;
}

export interface SyncSection {
  t: number;
  id: number;
}

export interface SyncTrack {
  schema_version: '1.0';
  track: { source_file: string; duration_sec: number; sample_rate_hz: number };
  timing: { bpm: number; time_signature: string; beat_offset_sec: number };
  events: SyncEvent[];
  curves: { fps: number; samples: SyncCurveSample[] };
  sections: SyncSection[];
}

export function sampleCurve(track: SyncTrack, timeSec: number): SyncCurveSample {
  const samples = track.curves.samples;
  if (samples.length === 0) throw new Error('SyncTrack has no curve samples.');

  const fps = track.curves.fps;
  if (!Number.isFinite(fps) || fps <= 0) throw new Error(`Invalid curves.fps: ${fps}`);

  const frame = Math.max(0, Math.min(samples.length - 1, timeSec * fps));
  const i0 = Math.floor(frame);
  const i1 = Math.min(samples.length - 1, i0 + 1);
  const a = samples[i0];
  const b = samples[i1];
  const t = frame - i0;

  return {
    t: timeSec,
    low: a.low + (b.low - a.low) * t,
    mid: a.mid + (b.mid - a.mid) * t,
    high: a.high + (b.high - a.high) * t,
    rms: a.rms + (b.rms - a.rms) * t
  };
}

export function eventsInRange(events: SyncEvent[], fromSec: number, toSec: number, type?: SyncEventType): SyncEvent[] {
  if (toSec < fromSec) throw new Error(`Invalid event range: ${fromSec}..${toSec}`);
  return events.filter((e) => e.t > fromSec && e.t <= toSec && (type === undefined || e.type === type));
}
```

## AI Implementation Brief (Copy/Paste)
Use this prompt with an AI coding agent in your game repository:

```text
Implement runtime integration for msxSync track.sync.json (schema 1.0).
Requirements:
- Strictly validate file shape; throw on any invalid state.
- Use audio playback time as SSOT (no frame-time clock fallback).
- Add SyncTrack loader + helpers:
  - sampleCurve(timeSec) with linear interpolation
  - eventsInRange(fromSec, toSec, optionalType)
  - sectionAt(timeSec)
- Handle pause, seek, and loop correctly.
- Add one demo scene/system that maps:
  - low -> background pulse
  - mid -> grid glow
  - high -> sparkles
  - beat/bar/onset -> discrete triggers
- Keep modules small and single-purpose.
- Add unit tests for pure helper logic.
Output:
- New runtime module(s)
- Updated wiring in app/game composition root
- Tests passing
```

## Acceptance Checklist
- Sync reacts to real audio position (verified with seek and pause).
- No drift after 5+ minutes playback.
- Beat/bar triggers are stable and deterministic.
- Curves interpolate smoothly (no frame-step jitter spikes).
- On loop boundary, no lost or duplicated trigger burst.
