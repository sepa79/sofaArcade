# Light80 Framework — Retro Remakes Core (Web-first)

> Goal: **write controller + platform plumbing once**, then ship multiple small retro-inspired games (remakes + “modern twist”) as thin modules.
>
> Targets: **Web (primary)**, **Windows/Linux desktop** via wrapper, and later **TV/kiosk** scenarios.

---

## 1) Design Principles

- **Web-first**: one codebase runs as a static site.
- **Controller-agnostic**: support *anything* the OS exposes (gamepads, keyboards, mice, custom USB-HID adapters).
- **Action-based input**: games never read raw buttons/axes; they consume **Actions** (e.g., `MOVE_X`, `FIRE`, `START`).
- **Small game modules**: each game is a package that depends on the core and implements only gameplay + assets.
- **Deterministic-ish loop**: fixed timestep for physics + stable feel across devices.
- **Fast boot to fun**: “plug → play in 30 seconds” UX, minimal menus.

---

## 2) Recommended Tech Stack

### Core (recommended)
- **TypeScript**
- **Vite** (fast dev server + builds)
- **Phaser 3** (2D scenes, sprites, audio, cameras)
- **planck.js** (Box2D-style physics in JS)

### Alternative (if you insist on “real Box2D”)
- **PixiJS** + **Box2D compiled to WASM** (Emscripten)  
  More integration work; keep as phase 2.

### Desktop packaging
- Phase 1: **Electron** (lowest risk, kiosk-friendly)
- Optional later: **Tauri** (smaller footprint)

---

## 3) Repository Layout (Monorepo)

Use **pnpm** workspaces (or npm/yarn if you prefer).

```
light80/
  packages/
    core/                # input, config, profiles, calibration, net, persistence
    game-sdk/            # game lifecycle, scenes, helpers, shared UI
    ui/                  # optional shared UI kit (menus, remap, settings)
    net/                 # optional HTTP client + schemas
  games/
    space-lords/         # MVP game (your first target)
    pong-chaos/
    arkanoid-neo/
    op-wolf-80/
  apps/
    web-portal/          # launcher site, game selection, docs
    desktop-shell/       # electron wrapper (later)
  docs/
```

---

## 4) Core Modules (what you build once)

### 4.1 Input System (the most important part)
**Purpose:** unify keyboard/mouse/gamepad/custom HID into Actions.

**Concepts**
- **Devices**: `Keyboard`, `Mouse`, `Gamepad`, `HIDAdapter` (still appears as Gamepad/Joystick to browser)
- **Bindings**: map device events to Actions
- **Profiles**: per-player, per-game presets (and auto-detected “best guess”)
- **Remap UI**: “Press a button to bind”
- **Deadzones & curves**: per-axis tuning
- **Hotplug**: add/remove controllers without restart

**Action examples**
- `MOVE_X`, `MOVE_Y`
- `AIM_X`, `AIM_Y`
- `FIRE_PRIMARY`, `FIRE_SECONDARY`
- `START`, `BACK`, `PAUSE`
- `MENU_UP/DOWN/LEFT/RIGHT`, `MENU_OK`

**Implementation notes (Web)**
- Use **Gamepad API** polling each frame.
- Keyboard via `keydown/keyup`.
- Mouse via pointer events; optionally `Pointer Lock` for aiming games.

---

### 4.2 Calibration (for future lightgun / pointer mode)
Even if lightgun comes later, prepare the abstraction now.

- **Pointer modes**:
  - `RELATIVE` (mouse-like)
  - `ABSOLUTE` (screen mapping; later from IR camera)
- **Calibration data**:
  - 4-point corner calibration stored per “display profile”
- **Smoothing**:
  - simple exponential smoothing + optional “snap” thresholds

---

### 4.3 Persistence
- `localStorage` for quick saves (profiles, bindings)
- `IndexedDB` for larger payloads (replays, assets, cached leaderboards)
- Versioned schema migrations.

---

### 4.4 Online Highscores (async-first)
Keep it simple for MVP:
- Submit score with:
  - `game_id`, `version`, `score`, `seed`, `timestamp`, `player_tag`
- Query leaderboards:
  - global + daily/weekly
- Anti-spam:
  - rate limits, basic signature token (server-side)

> Avoid real-time multiplayer in v1.  
> Add “async ghost / challenge links” later.

---

## 5) Game SDK (how games plug in)

### 5.1 Lifecycle
Each game implements:

- `loadAssets()`
- `init(core: CoreContext)`
- `update(dt: number)`
- `render()` (usually Phaser handles it)
- `dispose()`

### 5.2 Fixed Timestep
Physics should use a stable step (e.g., 60 Hz):
- accumulate `dt`
- step physics in fixed increments
- render interpolated transforms if needed

### 5.3 Shared Scenes
Provide ready-made scenes in `game-sdk`:
- `BootScene` (device detect, warm-up)
- `MainMenuScene` (play/options/remap)
- `RemapScene`
- `GameScene` (game-owned)
- `ResultsScene` (score submit, retry)

---

## 6) MVP Plan — “Space Lords” (quick win)

### MVP scope (fast)
- 1 game module: `games/space-lords`
- Inputs:
  - keyboard
  - any gamepad (Gamepad API)
  - your DB9→USB adapter (appears as joystick/gamepad)
- Features:
  - local score
  - basic settings (volume, sensitivity)
  - one remap screen
- No online yet (or stub endpoint).

### Suggested core Actions for Space Lords
- `MOVE_X` (ship left/right)
- `FIRE_PRIMARY`
- `START/PAUSE`

### Build targets
- Web: `dist/` static files
- Desktop later: wrap the web build in Electron.

---

## 7) Deployment

### Web
- Host as static site (GitHub Pages / Cloudflare Pages / Netlify)
- Version by folder:
  - `/v0.1/space-lords/`
  - `/latest/`

### Desktop (later)
- Electron loads local `file://` build or embedded assets
- Provide “kiosk mode” flag:
  - fullscreen
  - disable devtools
  - auto-start last game

---

## 8) Coding Conventions (keep it fast)

- One global **CoreContext** passed to games:
  - `input`, `audio`, `storage`, `net`, `time`, `ui`
- Games must be **pure** about input:
  - only call `input.getActionValue(Action.MOVE_X, playerIndex)`
- Keep assets minimal; prefer sprite sheets and simple audio.

---

## 9) Next Steps (after MVP)

- Add **replays/ghosts** (store inputs + RNG seed)
- Add **online highscores**
- Add **TV mode**:
  - kiosk UI
  - large-font menus
  - controller-only navigation
- Later: **lightgun** module:
  - ABS pointer mode + calibration + “Operation Wolf” clone

---

## 10) Quick Checklist (Definition of Done for the Core)

- [ ] Gamepad API polling + hotplug
- [ ] Keyboard input
- [ ] Action mapping + profiles
- [ ] Remap UI
- [ ] Fixed timestep helper
- [ ] Basic menus (play/options)
- [ ] Local persistence of settings
- [ ] Game module template

---

### Appendix: Minimal “CoreContext” shape (pseudo)

```ts
export interface CoreContext {
  input: InputSystem;
  audio: AudioSystem;
  storage: StorageSystem;
  net?: NetClient;
  ui: UiSystem;
  time: TimeSystem;
  version: string;
}
```
