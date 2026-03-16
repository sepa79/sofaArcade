# Codex Task: Offline Music → Game Sync Compiler (MP3 → Timeline JSON) + Engine Integration API

> **Goal**: Build an **offline tool** that analyzes an MP3 track and produces a deterministic **timeline file** (events + continuous curves) that a game engine can consume to drive visuals/FX in sync with music.
>
> **Outputs**: `track.sync.json` (+ optional debug artifacts) + minimal **engine-side API** for querying events/curves by time.

---

## 0) Scope & Non-Goals

### In scope
- Offline analysis of **MP3 (and WAV/FLAC)** using `ffmpeg` decode to WAV internally.
- Feature extraction:
  - **Tempo (BPM)** + **beat timestamps**
  - **bar/measure timestamps** (estimated; 4/4 default, configurable)
  - **onsets** (transients)
  - **energy curves** in frequency bands: `low`, `mid`, `high`
  - **loudness** (RMS)
  - Optional: **section boundaries** (coarse “segment changes”)
- Export to a stable JSON schema with versioning and metadata.
- Engine integration layer:
  - Load `.sync.json`
  - Query events in time ranges
  - Sample curves at time `t`
  - Provide “musical clock” helpers (beat index, bar index, phase)

### Out of scope (for v1)
- Real-time BPM tracking for arbitrary live audio.
- Perfect musical structure classification (verse/chorus labels).
- Multi-track stems separation (kick/snare isolation).

---

## 1) Deliverables

1. **CLI tool**: `music-sync-compiler`
   - Input: `track.mp3`
   - Output: `track.sync.json`
   - Optional outputs: debug CSV / PNG plots / beat grid audio click track.
2. **JSON schema** (documented and versioned)
3. **Engine-side runtime module**:
   - `SyncTrack` loader + query functions
   - `SyncClock` synced to audio playback time
   - Example integration sample (visual pulse + section flash)
4. **Docs**: usage, parameters, tuning, and a “how to map to effects” guide.

---

## 2) Proposed Repo Layout

```
/tools/music-sync-compiler/
  pyproject.toml (or requirements.txt)
  music_sync_compiler/
    __init__.py
    cli.py
    decode.py
    features.py
    beats.py
    sections.py
    export.py
    schema.py
    debug.py
  tests/
    test_schema_roundtrip.py
    test_known_track_beats.py
  README.md

/engine/sync/
  sync_track.(gd|cs|cpp|js|...)
  sync_clock.(gd|cs|cpp|js|...)
  sync_effects_demo.(...)
  sync_schema.md
```

> Adjust engine folder to your codebase conventions.

---

## 3) Technology Choices

### Decoding MP3
- Use `ffmpeg`/`ffprobe` to decode MP3 → WAV float32 PCM.
  - pros: robust, supports many formats
  - cons: external dependency

### Analysis library (choose one for v1)
**Option A (recommended): Essentia**
- Great beat/onset/tempo algorithms, mature audio DSP.
- Slightly heavier install.

**Option B: librosa**
- Easy Python stack (numpy/scipy), widely used.
- Beat tracking sometimes less stable than Essentia on some genres.

> For v1, pick **Essentia** if you want better beat reliability; pick **librosa** if you want simpler packaging.

---

## 4) Output Data Model (JSON)

### 4.1 Top-level file
`track.sync.json`
```json
{
  "schema_version": "1.0",
  "track": {
    "title": "optional",
    "artist": "optional",
    "source_file": "track.mp3",
    "duration_sec": 213.42,
    "sample_rate_hz": 44100
  },
  "timing": {
    "bpm": 128.03,
    "time_signature": "4/4",
    "beat_offset_sec": 0.47
  },
  "events": [
    { "t": 0.470, "type": "beat", "i": 0, "strength": 0.62 },
    { "t": 2.350, "type": "bar",  "i": 0, "strength": 0.80 },
    { "t": 31.920, "type": "drop", "strength": 0.90 },
    { "t": 12.340, "type": "onset", "band": "mid", "strength": 0.71 }
  ],
  "curves": {
    "fps": 50,
    "samples": [
      { "t": 0.00, "low": 0.12, "mid": 0.08, "high": 0.02, "rms": 0.05 },
      { "t": 0.02, "low": 0.14, "mid": 0.09, "high": 0.03, "rms": 0.06 }
    ]
  },
  "sections": [
    { "t": 0.00, "id": 0 },
    { "t": 31.92, "id": 1 }
  ]
}
```

### 4.2 Notes
- **events** are sparse markers (beat/bar/onset/segment-change/etc.).
- **curves** are fixed-rate samples, easy to interpolate at runtime.
- Provide `schema_version` so runtime can reject/upgrade older files.
- Use seconds as float, but keep consistent precision (e.g. 3 decimals).

---

## 5) CLI Specification

### 5.1 Command
```
music-sync-compiler input.mp3 -o output.sync.json [options]
```

### 5.2 Options (v1)
- `--time-signature 4/4` (default 4/4)
- `--curve-fps 50` (default 50; common: 25–100)
- `--bands low=20-150,mid=150-2000,high=2000-12000`
- `--beat-algorithm essentia|librosa`
- `--section-detect on|off` (default off for v1 unless stable)
- `--debug-dir ./debug` (write plots/csv/click-track)
- `--normalize on|off` (normalize curves to 0..1)
- `--seed 0` (if any stochastic bits exist; aim to avoid)

### 5.3 Exit codes
- `0` success
- `2` invalid arguments
- `3` decode failure
- `4` analysis failure
- `5` export failure

---

## 6) Offline Pipeline (Implementation Plan)

### Step A: Decode
1. Run `ffprobe` to read duration + metadata.
2. Run `ffmpeg` decode to WAV float32 mono:
   - Convert to mono (or analyze stereo and merge later; v1 mono is OK).
   - Resample to a fixed rate (e.g. 44100 Hz or 48000 Hz).
3. Load WAV into numpy float array.

**Acceptance**: can decode MP3 with correct duration; handles VBR.

### Step B: Preprocessing
- Remove DC offset (high-pass very low cutoff or subtract mean).
- Optional: normalize amplitude (-1..1).
- Optional: trim leading silence detection for better beat offset (store offset).

### Step C: Beat & Tempo
- Compute tempo `bpm` and **beat timestamps**.
- Compute **bar timestamps**:
  - assume 4 beats per bar from time signature
  - bar[i] = beat[i * beats_per_bar]
- Compute beat strength (if available from algo; else derive from onset envelope).

**Acceptance**:
- Beat timestamps monotonic and within duration.
- Reasonable BPM (20–240) or configurable bounds.
- Reproducible output for same input.

### Step D: Onset Detection
- Compute onset envelope + pick peaks → onset timestamps.
- Optionally classify onset by dominant band (`low/mid/high`) using local FFT energy.

**Acceptance**:
- Produces onset list; no extreme spam (apply min distance, threshold).

### Step E: Curves (energy bands + RMS)
- Compute STFT (window e.g. 2048, hop based on curve fps).
- For each hop:
  - `low`, `mid`, `high` band energy (sum magnitudes/power)
  - `rms`
- Normalize each curve:
  - robust normalization: percentile-based (e.g. p5..p95) → clamp 0..1

**Acceptance**:
- Curves match track length; stable 0..1 range; no NaNs.

### Step F: Section Boundaries (optional v1.1)
- Compute novelty curve on MFCC/chroma and detect peaks.
- Export coarse `sections[]` (timestamps only).

**Acceptance**:
- Produces a few boundaries, not dozens. Works on typical EDM/rock.

### Step G: Export JSON
- Populate schema, events, curves, metadata.
- Guarantee deterministic ordering.
- Save with pretty formatting for debugging (or minify for release).

### Step H: Debug outputs (optional)
- Plot wave + onset envelope + beats overlay.
- CSV dumps of curves.
- “Click track” WAV: overlay clicks on beat times.

---

## 7) Engine Integration API

### 7.1 Minimal runtime types
**`SyncTrack`**
- loads `.sync.json`
- stores:
  - `bpm`, `time_signature`, `events[]`, `curves[]`, `sections[]`
  - curve sample rate `fps`

**`SyncClock`**
- binds to audio playback time `t` (seconds)
- exposes:
  - `get_time()`
  - `get_beat_index(t)` / `get_bar_index(t)`
  - `get_beat_phase(t)` (0..1 between beats)
  - `events_in_range(t0, t1, type_filter)`
  - `sample_curve(t)` → `{low, mid, high, rms}` (linear interpolation)

### 7.2 Engine-side responsibilities
- Provide accurate `music_time_sec` from the audio system.
  - MUST be based on audio playback position, not frame time.
  - Handle pause/seek/loop.

### 7.3 Suggested API surface (language-agnostic)
```text
SyncTrack load(path)
float bpm()
int beats_per_bar()

List<Event> events_in_range(float t0, float t1, optional type)
CurveSample sample(float t)

int beat_index(float t)
float beat_phase(float t)  // 0..1
```

### 7.4 Integration example (behavior)
- Every **beat**: scale player sprite + small camera shake.
- Based on **low energy**: background bloom intensity.
- On **section change**: swap palette / spawn new enemy pattern.

---

## 8) Synchronization & Drift Rules

- Runtime should use **audio clock** as source of truth.
- Rendering reads current audio time each frame and queries timeline.
- To avoid missing events due to low FPS:
  - keep `prev_t`, query `events_in_range(prev_t, t)`
- If audio can seek:
  - reset `prev_t` to new position to avoid massive event bursts.

---

## 9) Testing Plan

### Unit tests
- Schema round-trip: load → save → load equivalence.
- Determinism: same input produces identical JSON (within float tolerance).
- Edge cases:
  - very short audio (< 5s)
  - silence / near-silence track
  - variable tempo track (should still output something)

### Golden file tests
- A couple of known tracks (or synthetic signals):
  - synthetic metronome WAV at 120 BPM: beats must match expected timestamps.

### Manual validation
- Debug plot overlay beats/onsets against waveform.
- In-engine: visual metronome indicator + beat count.

---

## 10) Implementation Checklist (Codex-ready)

### Phase 1 — Skeleton
- [ ] Create tool project structure
- [ ] Implement CLI parsing and help
- [ ] Implement ffmpeg decode to float mono WAV
- [ ] Implement JSON export with schema_version

### Phase 2 — Core analysis
- [ ] Implement BPM + beats
- [ ] Implement bars from beats + time signature
- [ ] Implement energy curves (low/mid/high/rms)
- [ ] Implement onset detection + strength

### Phase 3 — Polish
- [ ] Robust normalization
- [ ] Debug outputs (plots/csv/click track)
- [ ] Improve beat stability (bounds, smoothing)
- [ ] Add section detection (optional)

### Phase 4 — Engine module
- [ ] `SyncTrack` loader
- [ ] `SyncClock` with audio-time binding
- [ ] `events_in_range` + interpolation sampling
- [ ] Demo scene showing beats/curves mapped to effects

---

## 11) “Render can react” – what the engine must expose

You need an **Engine Music API** (even if it’s just a thin wrapper) that provides:
- `music_time_sec`: accurate playback position in seconds
- `is_playing`, `is_paused`
- `seek(time_sec)` (optional)
- `play(track)` / `stop()` (optional)
- `latency_compensation_sec` (optional):
  - If your audio backend has known output latency, add an offset so visuals align.

**Contract**:
- `music_time_sec` must be monotonic while playing.
- On seek/stop/play, notify SyncClock to reset windowing.

---

## 12) Versioning & Compatibility

- `schema_version` uses semver-like `"1.0"`.
- Runtime supports:
  - exact version `1.x`
  - rejects `2.0` unless upgraded
- If schema expands, keep backward compatible defaults.

---

## 13) Mapping Cookbook (quick defaults)

- **beat** → quick scale pulse (1.0 → 1.08 → 1.0)
- **bar** → stronger pulse + camera micro-shake
- **low** → vignette/bloom intensity
- **mid** → particle emission rate
- **high** → scanlines/glitch flicker
- **onset(mid/high)** → muzzle flash / hit spark
- **section change** → palette swap / enemy pattern change

---

## 14) Definition of Done

- Given `track.mp3`, tool outputs `track.sync.json` with:
  - bpm + beats (>= 1 beat for >2s tracks)
  - curves covering full duration
  - valid JSON schema versioned
- Engine demo plays audio + renders effects synchronized:
  - beat indicator matches audible beat
  - no missed events at low frame rates
- Tests pass + deterministic output confirmed.

---

## 15) Notes for Packaging

- Document dependencies:
  - `ffmpeg` required in PATH
  - Python deps (essentia/librosa)
- For Windows:
  - bundle ffmpeg or provide install notes
- Consider shipping as:
  - Python CLI (`pipx install`)
  - or a frozen binary (PyInstaller) later

