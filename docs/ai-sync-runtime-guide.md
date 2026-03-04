# AI Runtime Integration Guide: `track.sync.json`

## Goal
Use `track.sync.json` at runtime to drive game effects in sync with music playback.

This guide defines the runtime contract for `light80` integration.

## Integration Contract
1. Use audio playback time (`musicTimeSec`) as the single source of truth.
2. Reject invalid sync files immediately (fail fast).
3. Keep one typed runtime object per loaded track.
4. Keep event queries stateless and deterministic.
5. Do not add fallback schemas, fallback clocks, or implicit auto-recovery.

## File Contract (Schema `1.0`)
Required fields:
- `schema_version` must be `"1.0"`.
- `track.duration_sec`
- `timing.bpm`, `timing.beat_offset_sec`, `timing.time_signature`
- `events[]` with `type` in: `beat | bar | onset`
- `curves.fps`, `curves.samples[]` with `low | mid | high | rms`
- `sections[]` as `{ t, id }`

Validation requirements (strict):
- `events`, `curves.samples`, and `sections` must be sorted ascending by `t`.
- Every `t` must be within `[0, track.duration_sec]`.
- `curves.fps > 0`, arrays must be non-empty.
- `onset` requires `band`; `beat`/`bar` require integer `i`.
- Curves must be normalized to `[0, 1]`.

If any required field is missing or invalid, throw with full context path.

## Runtime Query Rules
- Event window is `(fromSec, toSec]`.
- Loop handling: when `nowSec < lastTimeSec`, process `(lastTimeSec, duration]` and `(0, nowSec]`.
- Range lookups should use binary-search index bounds (`upperBound`) for predictable performance.
- Use a small epsilon only for floating-point comparisons on boundaries.

## Curve Sampling Rules
- Runtime samples curves by `fps` frame index with linear interpolation.
- `curves.samples[i].t` is validated against the FPS grid and treated as contract integrity, not as dynamic lookup source.

## Playback State Rules
- `playing`: advance event window.
- `paused`: do not emit events, reset `lastTimeSec = nowSec`.
- `seeked`: same as pause-reset behavior, then continue normally.

## Recommended Effect Mapping
- `low` -> background pulse / bloom amount.
- `mid` -> grid/lane glow.
- `high` -> sparkles/stars intensity.
- `beat` -> short hard pulse.
- `bar` -> larger accent.
- `onset(low|mid|high)` -> band-specific accents.

## Project Wiring (Current)
- Runtime module: `games/pixel-invaders/src/audio-sync/*`
- Sync asset used by Pixel Invaders: `games/pixel-invaders/src/assets/game-bgm.sync.json`
- Scene integration: `games/pixel-invaders/src/scenes/pixel-invaders-scene.ts`

## Acceptance Checklist
- Sync reacts to real audio position (pause/seek/loop verified).
- No drift after long playback (5+ minutes).
- Beat/bar triggers deterministic on repeated runs.
- Curve interpolation is smooth.
- Loop boundary does not drop or duplicate bursts.
