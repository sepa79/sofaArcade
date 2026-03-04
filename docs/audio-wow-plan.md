# Audio WOW Plan (Tunnel Invaders)

## Goal
- Make arcade audio feel "big" on soundbars and floorstanding speakers.
- Keep retro character, but add modern impact (sub, stereo width, motion).

## Mix Targets
- Master loudness target: around `-16 LUFS` for web playback.
- True peak ceiling: `-1 dBTP`.
- Dedicated sub content for impacts (35-60 Hz region), controlled by limiter.

## Architecture
- Single SFX engine per scene (`RetroSfx`) with:
  - `fx` bus (stereo)
  - `sub` bus (low-passed, mostly mono feel)
  - bus compressor + limiter
- Spatial controls per event:
  - `pan` from tunnel angle (`sin(theta)`)
  - `depth` drives gain/filter darkening
- Continuous motion loop for tunnel orbit movement:
  - pitch and filter from angular speed
  - pan from player angle

## Event -> Preset Map (SSOT)
| Event | Preset | Spatial | Notes |
|---|---|---|---|
| Player shot | `shot.player` | `pan(theta_player)`, shallow depth | Bright, aggressive stereo chirp |
| Enemy shot | `shot.enemy` | `pan(theta_enemy)`, `depth(enemy)` | Darker than player shot |
| Enemy destroyed | `explosion.small` | `pan(theta_enemy)`, `depth(enemy)` | Layered transient + body + sub |
| Large enemy destroyed | `explosion.large` | `pan(theta_enemy)`, `depth(enemy)` | Extra low-end, longer tail |
| Player hit | `hit.player` | `pan(theta_player)` | Heavy down-glide impact |
| Win/Lose | `ui.win` / `ui.lose` | center | Short melodic stingers |
| Orbit movement | `motion.orbit` | `pan(theta_player)` | Continuous wow/engine tone from movement |

## Implementation Phases
1. Phase 1 (now):
- Replace basic beep-only SFX in Tunnel with layered synth presets.
- Add pan/depth parameters to shot and explosion playback.
- Add continuous motion sound tied to orbit movement.

2. Phase 2:
- Add profile presets: `Cinema`, `Arcade`, `LateNight`.
- Expose key mix constants for quick tuning.

3. Phase 3:
- Optional sample-assisted hybrid (synth + short samples) for higher realism.

## Current Status (2026-03-04)
- Plan document: `DONE`
- Phase 1: `DONE`
- Phase 2: `IN PROGRESS` (profiles in engine + debug switching)
- Phase 3: `TODO`
