# Codex Task — Phone Controller (Web) for Light80

MVP: Use a phone as a **hardcore motion controller** (tilt + shake/swing) for games like **Space Lords / Arkanoid / Pong** — **no native app**, just a web page opened via **QR**.

Key browser constraints:
- iOS requires **user gesture** to request Motion/Orientation permission (and typically needs HTTPS). https://developer.mozilla.org/en-US/docs/Web/API/Device_orientation_events/Detecting_device_orientation
- Keeping the screen awake can be done via **Screen Wake Lock API** where supported. https://developer.mozilla.org/en-US/docs/Web/API/WakeLock

---

## Goal

Add a new `PhoneController` device provider to `@light80/core` that receives input from a phone web page via a WebSocket relay:

- **MOVE_X** via tilt (gyro/orientation) or slider fallback
- **FIRE_PRIMARY** via tap and/or shake gesture
- **START/PAUSE**
- **RECENTER** (calibrate “neutral” tilt)
- (Optional) **SPECIAL** (bigger shake/swing)

This is designed for 1D arcade controls + button(s), not lightgun.

---

## Why a Relay Server?

A browser game running on PC can’t easily act as a WebSocket server.  
For MVP, create a simple **Node.js relay server** (hosted locally or remotely):

- PC connects as `host`
- phone connects as `phone`
- relay forwards `phone -> host` input messages

Later, if you wrap the game in Electron, you can embed the relay.

---

## Deliverables

### 1) `apps/relay-server` (Node.js + `ws`)
Implement:

- `POST /session`  
  Creates a session and returns:
  - `sessionId` (short code like `ABCD`)
  - `wsUrl` (e.g. `wss://.../ws` or `ws://localhost:PORT/ws`)
- WebSocket endpoint `/ws`
- Roles:
  - `host` joins session
  - `phone` joins session
- Relay:
  - forward `input` messages from `phone` to `host`
  - optional: forward `status/ack` from host to phone
- TTL:
  - session expires after e.g. 10 minutes of inactivity

Minimal protocol:

```json
{ "type":"join", "role":"host",  "sessionId":"ABCD" }
{ "type":"join", "role":"phone", "sessionId":"ABCD" }

{ "type":"input", "seq":123, "t":1710000000,
  "axes": { "moveX": 0.12 },
  "btn":  { "fire": 1, "start": 0, "recenter": 0, "special": 0 }
}
```

---

### 2) PC Host UI (`apps/web-portal`)
Add “Add Phone Controller” screen:

- Button: **Create Session**
- Show:
  - **QR code** with URL to the controller page:
    - `/controller?sessionId=ABCD&relay=wss://...`
  - Session code text `ABCD` as fallback
- Status: `waiting / phone connected / lost`

---

### 3) Phone Controller Page (`/controller`)
A touch-friendly UI:

- Big buttons:
  - **FIRE**
  - **START**
  - **RECENTER**
- Mode switch:
  - **Tilt** (motion sensors)
  - **Slider** (always works fallback)
- A required button on iOS:
  - **Enable Motion**
    - on click: request permission (when required), then attach listeners
- Enable **Wake Lock** on user gesture (if supported); if not, show message “Keep screen on”.

---

## Motion Input → Actions (MVP)

### Tilt → MOVE_X
Use `deviceorientation` (or `devicemotion.rotationRate` if preferred):

- On `RECENTER`, store baseline `gamma0` (or chosen axis)
- Map to normalized axis:

```
moveX = clamp((gamma - gamma0) / rangeDegrees, -1, 1)
```

Suggested defaults:
- `rangeDegrees = 25` (tune)
- deadzone ~ `0.05`
- smoothing: `moveX = lerp(prev, raw, alpha)` with `alpha ~ 0.25`

### Gestures (hardcore “machaj łapami”)
Use `devicemotion.acceleration` (without gravity if available):

- compute short-window energy (RMS of accel)
- `SHAKE` trigger when RMS exceeds threshold for ~80–200 ms
- apply cooldown 200–300 ms

Mapping:
- `SHAKE` => send `btn.fire = 1` **as a short pulse** (one frame/tick)

Always include **tap-to-fire** as fallback.

---

## Network Send Rate

From phone → relay → host:

- Send packets at **30–60 Hz**
  - Prefer 60 Hz if stable; else fall back to 30 Hz
- Include `seq` and timestamp `t` for debugging
- Optionally include ping measurement via `status` messages

---

## Core Integration (`@light80/core`)

Add:

- `PhoneControllerProvider` to the input system:
  - maintains per-player state: `moveX`, buttons
  - exposes `getActionValue(Action.MOVE_X, playerIndex)` etc.

Host side:
- WebSocket client subscribes to relay messages
- Map payload to actions:
  - `axes.moveX` -> `Action.MOVE_X`
  - `btn.fire` -> `Action.FIRE_PRIMARY` (pulse or hold)
  - `btn.start` -> `Action.START`
  - `btn.recenter` -> `Action.RECENTER`

---

## Acceptance Criteria (Definition of Done)

1. PC creates a session and shows QR + code.
2. Phone opens `/controller`, taps **Enable Motion**, grants permission on iOS when prompted.
3. Tilt moves ship/paddle via `MOVE_X`.
4. Tap or shake triggers `FIRE_PRIMARY`.
5. Wake Lock keeps screen awake where supported (else visible fallback message).
6. Disconnect/reconnect updates host status correctly.

---

## Known Risks / Notes

- iOS motion permission requires a user gesture; use a dedicated **Enable Motion** button.
- HTTPS is often required for best behavior on mobile browsers.
- Slider mode must remain available if motion is denied/unavailable.
