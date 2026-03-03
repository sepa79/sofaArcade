# Game Design Doc — **Space Lords: Worm Tunnel Invaders** (Pseudo‑3D)

Retro arcade shooter in a **pseudo‑3D tunnel**: enemies approach from the depth toward players on the **outer rim**.  
Gameplay is modeled in **(θ, z)** (angle around tunnel + depth), rendered with perspective, pixelated demoscene vibes, and “worm” tunnel motion.

Designed for **paddles (ideal)**, but works with gamepads/keyboard/phone controller.

---

## 1) One‑Sentence Pitch

**Space Invaders meets a tunnel shooter:** orbit the rim, shoot arcing plasma down a twisting worm tunnel, dodge indestructible obstacles, survive escalating waves — up to 4 players.

---

## 2) Core Fantasy & Feel

- **Feel:** fast, responsive, arcade‑clean. Movement is deterministic; effects are juicy.
- **Look:** pixelated/CRT + modern plasma/glow/trails + demoscene “worm tunnel”.
- **Pressure:** enemies “grow” as they approach; near‑plane is dangerous.
- **Party:** quick rounds, instant restarts, readable chaos for 1–4 players.

---

## 3) World Model (Pseudo‑3D)

### Coordinates
Everything important lives in **(θ, z)**:
- `θ` = angle around tunnel (0..2π)
- `z` = depth (0..1), where:
  - `z = 1.0` = far (deep tunnel / near center of screen)
  - `z = 0.0` = near (outer rim / players)

### Screen projection (concept)
- A “screen radius” depends on depth: `r_screen = lerp(r_near, r_far, z)`
  - `r_near`: close to screen edge (player rim)
  - `r_far`: near center (deep tunnel)
- Position:
  - `x = cx + r_screen * cos(θ_render)`
  - `y = cy + r_screen * sin(θ_render)`
- Scale:
  - `scale = lerp(scale_near, scale_far, z)` (near bigger, far smaller)

### Tunnel “worm” motion
The tunnel appears alive via **camera center drift** + **depth twist**:
- **Center drift (safe / primary):** `cx, cy` oscillate (multiple sines) → worm wiggle
- **Twist (depth‑based):** `θ_render = θ + twistAmp * z + twistWave(z,t)` → demoscene spiral

Important: the **game logic remains in (θ,z)** — the worm motion is mostly render‑space, so controls stay crisp.

---

## 4) Controls & Inputs

### Primary controller: Paddle + 2 buttons
- Paddle → **MOVE** around rim (θ)
- Button 1 → **FIRE**
- Button 2 → **JUMP/PHASE** (optional ability, staged)

### Actions (engine‑level)
- `MOVE_X` (float -1..1): orbit speed
- `FIRE_PRIMARY` (bool/hold)
- `JUMP_PHASE` (bool) — stage 6+
- `START/PAUSE`

Phone controller (optional) can map:
- Tilt/slider → `MOVE_X`
- Tap/shake → `FIRE_PRIMARY`

---

## 5) Player Mechanics

### Movement (rim orbit)
- Player lives on **near plane**: `z = 0`
- Angle changes by: `dθ/dt = baseSpeed * MOVE_X`
- Keep near‑instant response (tiny smoothing ok, but no heavy inertia)

### Shooting (arcing plasma down the tunnel)
A bullet is also (θ,z):
- Moves from near to far (decreasing pressure on players): `z += vz * dt` (with `vz > 0`)
- Optional arc: `θ += vθ * dt`
- Visual trail sells the arc

> Convention used here: enemies move **toward** players by decreasing z; bullets move **away** by increasing z.

### Jump / Phase (stage 6+)
Purpose: prevent frustration in multiplayer and add skill.

**Rule (simple):**
- On press: player becomes non‑colliding with other players for ~200 ms (visual hop)
- If hit during jump: still dies (“sorry 😉”)
- Cooldown ~350 ms

---

## 6) Enemies & Waves (Tunnel Invaders)

### Enemy model
Enemies are approaching targets:
- Spawn at `z_spawn` (deep, near center)
- Advance toward players: `z -= v * dt`
- Can drift in θ: `θ += drift * dt`

### Types (staged)
1. **Small invader**
   - 1 HP
   - simple drift pattern
2. **Big invader**
   - multi‑HP (3–8)
   - on hit: gets knockback/rotation in “pseudo‑3D feel” (no Box2D needed)
   - can bump nearby enemies/obstacles (softly)
3. **Shooter invader**
   - fires arcing shots (θ+z motion)

### Approach pressure
- If an enemy reaches **near threshold** (e.g., `z <= z_hit`), it damages/kills a player or triggers a global penalty.

### Wave pacing
- Early: clean, readable
- Later: higher approach speed, more arcs, more obstacles, stronger worm twist

---

## 7) Obstacles (Indestructible Tunnel Objects)

### Purpose
- Force navigation choices and “skill shots”
- Add variety per level

### Representation
Obstacle occupies an area in (θ,z):
- `θ ∈ [θ0, θ1]`
- `z ∈ [z0, z1]`

### Behavior (MVP)
- **Indestructible**
- Bullets: despawn on impact (clear + readable)
- Enemies: can collide/deflect slightly (later)

### Higher levels
- Moving obstacles (slow θ drift)
- Gate obstacles (open/close window)
- Rare “bouncy metal” obstacles (bullets ricochet) as a modifier mode

---

## 8) “Physics Feel” without Box2D

Box2D isn’t a good match for (θ,z) pseudo‑3D. Use **simple impulses** in (θ,z) instead:

- On big enemy hit:
  - Apply small velocity kick: `vθ += kickθ`, `vz += kickz`
  - Apply angular “spin” purely visually (sprite rotation)
- Use strong damping:
  - `vθ *= exp(-damp * dt)`
  - `vz *= exp(-damp * dt)`
- Clamp max speeds to avoid chaos

This yields:
- chunky impact
- controlled bump interactions
- stable gameplay

---

## 9) Rendering Style

### Pixelate zones (staged / “schodkowo”)
Postprocess pixelation is **zoned** by distance to screen center (or by z):
- Zone A (center/deep): `px = 2`
- Zone B (mid): `px = 3`
- Zone C (outer/near): `px = 4` (or 5)

**Critical:** after projection, snap positions to the active pixel grid:
- `x = round(x / px) * px`
- `y = round(y / px) * px`

This removes shimmer and looks demoscene‑authentic.

### Sprites (MVP approach)
- Start with **hi‑res sprites scaled continuously** by depth.
- Optional polish later: LOD sprite swaps by z for extra readability.

### Effects
- Plasma trails
- Hit flash
- Spark bursts on ricochet/impact
- Small screen shake on bar/downbeat (later)

---

## 10) Scoring & Rules

### Lives
- MVP: 3 lives per player (party‑friendly)
- Optional: 1‑hit hardcore mode

### Score
- Kill score + multi‑HP bonus
- Combo multiplier for quick successive kills

### Win/Lose
- Survive waves; game ends when all players are out (or shared team life pool in co‑op mode)

---

# 11) Implementation Stages (MVP → v1 → vNext)

## Stage 0 — Core scaffold (foundation)
**Goal:** minimal playable loop with pseudo‑3D projection.

Deliverables:
- Vite + TS + Phaser setup
- Input actions: `MOVE_X`, `FIRE_PRIMARY`, `START/PAUSE`
- World model in (θ,z)
- Projection to screen (center fixed)
- Player orbit on rim (z=0)
- One enemy type: spawns deep, approaches, dies on hit
- Basic bullets in (θ,z) (no arc yet)
- UI: lives, score, restart

Acceptance:
- Single player can move, shoot, and clear a tiny wave.

---

## Stage 1 — Tunnel identity (pseudo‑3D feel)
**Goal:** it looks like a tunnel shooter, not a ring top‑down.

Deliverables:
- Tunnel background: multiple depth rings/slices
- Depth scaling for enemies/bullets
- Basic parallax / shading to imply depth
- Bullet visuals: trail

Acceptance:
- Approaching enemies clearly “come from depth”.

---

## Stage 2 — Worm tunnel motion + pixel zones
**Goal:** demoscene wow factor without breaking control.

Deliverables:
- Worm center drift: animated `cx,cy`
- Depth twist in render: `θ_render = θ + twistAmp * z`
- Zoned pixelate (2/3/4 px) + pixel snap
- Tuning for readability (cap drift amplitude)

Acceptance:
- No shimmer; tunnel feels alive; gameplay still readable.

---

## Stage 3 — Arcing shots + obstacles (indestructible)
**Goal:** add signature mechanics (arc shots + dodging pillars).

Deliverables:
- Arc bullets: `θ += vθ * dt` (optional slight)
- Indestructible obstacles (θ,z volumes)
- Bullet vs obstacle:
  - MVP: despawn + sparks
- Simple obstacle layouts per level

Acceptance:
- Players can “lead” shots around obstacles; obstacles create real choices.

---

## Stage 4 — Big enemies (multi‑HP) + impact feel
**Goal:** chunky targets that react to hits (controlled).

Deliverables:
- Big enemy with HP (3–8)
- On hit: small kick in `vθ`/`vz` + visual rotation + damping + clamps
- Optional bump: if two big enemies overlap in θ/z, separate gently

Acceptance:
- Big enemies feel heavy and reactive; no pinball chaos.

---

## Stage 5 — Multiplayer 1–4 players
**Goal:** party‑ready.

Deliverables:
- Join flow for 1–4 players (controller detect)
- Balance scaling by player count (enemy count/speed)
- Quick restart loop

Acceptance:
- 4 players can play a full round without confusion.

---

## Stage 6 — Jump/Phase (2nd button) + harder level objects
**Goal:** solve blocking + add skill.

Deliverables:
- `JUMP_PHASE` with duration + cooldown
- Rule: hit during jump still kills
- Higher level obstacles: moving gates / slow drifters
- Optional modifier: rare ricochet obstacles

Acceptance:
- Multiplayer feels fair; advanced levels add spice.

---

## Stage 7 — Music sync (BPM + offset) + beat‑driven pacing (optional)
**Goal:** spawn/tunnel pulses on beat.

Deliverables:
- `MusicSync` module (bpm+offset)
- Beat callbacks drive:
  - small spawns every beat
  - elite every N beats
  - worm “kick” on bars

Acceptance:
- Beats line up, no drift across full track.

---

## Stage 8 — Polish & Meta
Ideas:
- Daily modifiers (pixel zones swapped, twist higher, ricochet mode)
- Async leaderboards
- More enemy archetypes (snipers, splitters, shielders)
- Boss waves (giant invader segments in depth)

---

## 12) Guardrails (what to avoid)

- Don’t make core movement physics‑simulated; keep θ control deterministic.
- Don’t allow unlimited ricochets early; readability > chaos.
- Keep worm drift amplitude modest; cap twist speed.

---

## Appendix — Suggested starting numbers (tune later)

- Depth mapping:
  - `z_spawn = 1.0`, `z_hit = 0.05`
- Speeds:
  - player angular speed: 2.0 rad/s at full input
  - bullet depth speed: +1.5 z/s
  - bullet arc: `vθ` around 0.5–1.2 rad/s (only for special shots or later levels)
  - enemy approach speed: 0.25–0.6 z/s (scales with level)
- Worm:
  - center drift amplitude: 20–40 px (cap)
  - twistAmp: 0.2–0.6 rad (scales with level)
- Pixel zones:
  - center: 2 px, mid: 3 px, outer: 4 px
