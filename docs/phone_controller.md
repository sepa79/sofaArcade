# Phone Controller (Web) for Light80

MVP: use phone as motion controller (tilt + shake) without native app.

## Goal

`@light80/core` receives phone input over **WebRTC DataChannel**:

- `MOVE_X` via tilt or slider mode
- `FIRE_PRIMARY` via tap/shake
- `START/PAUSE`
- `RECENTER`
- optional `SPECIAL`

## Transport

- Host and phone communicate **directly P2P** over WebRTC.
- `apps/signal-server` is only signaling (session + SDP + ICE exchange), no input relay path.
- Session flow:
  - Host: `POST /session`
  - Host: `POST /session/:id/offer`
  - Phone: `GET /session/:id/offer`
  - Phone: `POST /session/:id/answer`
  - Host: `GET /session/:id/answer`
  - Both: `POST /session/:id/candidate` + `GET /session/:id/candidates`

## Host UI (`apps/web-portal`)

- Create session
- Generate QR:
  - `/controller?sessionId=ABCD&signal=https://...`
- Show status:
  - waiting for offer/answer
  - P2P connected/disconnected

## Phone UI (`/controller`)

- Buttons: `FIRE`, `START`, `RECENTER`, `Enable Motion`
- Mode: `Tilt` / `Slider`
- Wake Lock on user gesture when available

## Motion Mapping

- Tilt -> normalized `moveX` with deadzone and smoothing
- Shake -> short `fire`/`special` pulses
- Send input frames at ~60 Hz through DataChannel

## Acceptance

1. Host creates session and displays QR.
2. Phone opens controller URL and grants motion permission.
3. Input updates ship/paddle on host over P2P.
4. Disconnects are visible in host/controller status.
