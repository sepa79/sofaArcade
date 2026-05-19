# Architecture — SofaArcade

This file is the starting SSOT for architecture.

Keep it concise. Link to deeper docs/specs when needed.

## Purpose

SofaArcade is a TypeScript monorepo for browser-based couch games and shared runtime infrastructure.

## Architecture principles

- Keep boundaries explicit.
- Keep contracts/specs as SSOT.
- Prefer simple, observable flows.
- Prefer explicit configuration over hidden defaults.
- Avoid hidden synchronous dependencies.
- Avoid fallback chains that hide real failures.
- Keep pure game rules separate from scenes, HTTP, Discord, and rendering.

## System overview

```text
games/*                apps/web-portal
  |                         |
  v                         v
packages/game-sdk      packages/core
        \              /
         v            v
      Browser runtime + shared contracts

apps/signal-server -> WebRTC signaling for phone/controller flows

planned:
SofaArcade WWW / agent / Discord
        |
        v
apps/rolnik-service
        |
        v
games/rolnik/src/game core
```

## Main components

| Component | Responsibility | Notes |
|---|---|---|
| `packages/core` | Input/profile/session/phone/storage contracts and runtime helpers | SSOT for input and phone contracts |
| `packages/game-sdk` | Shared game runtime and audio helpers | No game-specific rules |
| `apps/web-portal` | Web surface for hosting/launching games | Future Rolnik WWW client |
| `apps/signal-server` | WebRTC signaling behavior | Transport behavior SSOT |
| `games/*/src/game` | Pure game logic | Unit tests required for pure logic |
| `games/*/src/scenes` | Phaser scene wiring/render/audio usage | Must not become rules SSOT |
| `games/*/src/profiles` | Game input profile data | Bindings live only in JSON profile files |

## Boundaries

- `packages/core/src/input/*`: actions, polling/runtime, mapping, profiles.
- `packages/core/src/phone/*`: phone input protocol and provider logic.
- `packages/core/src/storage/*`: browser persistence only.
- `packages/game-sdk/src/audio/*`: shared audio engine only.
- `packages/game-sdk/src/runtime/*`: shared runtime toggles/caches only.
- `games/*/src/game/*`: pure game logic, constants, state, tests.
- `games/*/src/scenes/*`: scene wiring, render, audio usage.
- `apps/*/src/*`: composition roots and runtime wiring.

## Data model

Current game state is package-local and in memory. Browser persistence belongs under `packages/core/src/storage`. Planned Rolnik online mode should store backend-owned game snapshots and event logs while keeping `GameState` as the core SSOT.

## APIs / contracts / specs

Canonical specs live under:

- `docs/specs/`
- `AGENTS.md` SSOT map
- Rolnik design docs under `docs/rolnik/`

Do not create duplicate contract definitions without documenting why.

## Runtime / deployment

Local packages run through pnpm workspace scripts. Browser games use Vite. Current GitHub Pages deployment is static and Pixel Invaders focused. Future Rolnik async play needs a Node HTTP service, persistence, container deployment, and later Discord adapter.

## Observability

Current observability is mostly command output, browser console, and tests. Future backend work should add explicit health endpoints, structured errors, and event logs usable by agents.

## Failure modes

- Invalid config must throw clear errors.
- Invalid profile/input/message state must fail fast.
- Missing game/session/player ownership in future Rolnik service must not silently recover.
- Discord/WWW must not bypass Rolnik service/core validation.

## Open architecture questions

- Exact Rolnik backend package shape and HTTP framework.
- SQLite vs PostgreSQL timing for the first online slice.
- Whether Discord bot starts as a module in `rolnik-service` or a separate process.
- Shape of Rolnik `PlayerAction`, `PlayerView`, and `GameEvent` contracts.
