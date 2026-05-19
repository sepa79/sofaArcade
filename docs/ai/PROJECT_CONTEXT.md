# Project Context — SofaArcade

## Purpose

SofaArcade is a TypeScript monorepo for couch-play browser games, shared input/runtime packages, a web portal, and local/network play infrastructure.

## What this project does

The repository contains multiple Phaser/Vite games and shared packages for input profiles, phone controller protocol, runtime helpers, browser persistence, and audio/runtime utilities. `apps/web-portal` is the composition surface for hosting and launching games. `apps/signal-server` provides WebRTC signaling infrastructure. `games/rolnik` is currently a local Phaser prototype and is planned to become the async strategy testbed with backend, web UI, agent HTTP tests, and later Discord integration.

## What this project does not do

- Do not treat Phaser scene code as the source of truth for game rules.
- Do not duplicate input bindings in TypeScript; profile JSON files own bindings.
- Do not add hidden fallback input backends, transports, or config sources.
- Do not add Discord, HTTP, or persistence rules directly into Rolnik core logic.

## Main users / operators

- Local developers building and testing SofaArcade games.
- Players using browser games locally or through SofaArcade web surfaces.
- AI agents contributing code, tests, docs, and future HTTP gameplay validation.

## Main modules

| Module | Purpose | Notes |
|---|---|---|
| `packages/core` | Input actions/profiles/runtime, phone protocol/provider, storage helpers | Contract-heavy shared package |
| `packages/game-sdk` | Shared game runtime/audio helpers | Reused by game packages |
| `apps/web-portal` | Browser portal/composition UI | Future Rolnik WWW client surface |
| `apps/signal-server` | WebRTC signaling service | Runtime config SSOT in `src/config.ts` |
| `games/pixel-invaders` | Existing game package | Current default root dev target |
| `games/artillery-duel` | Existing game package | Phaser/Vite game |
| `games/tunnel-invaders` | Existing game package | Phaser/Vite game |
| `games/rolnik` | Farm strategy prototype | Pure rules under `src/game`, scene wiring under `src/scenes` |
| `msxSync` | Separate nested sync-server workspace | Has its own `AGENTS.md` |

## Runtime model

Current games are Vite browser apps. Shared packages are built and consumed through pnpm workspace dependencies. WebRTC signaling and web portal are separate app packages. Rolnik currently runs in browser memory; planned online async play requires a new `apps/rolnik-service`.

## Deployment model

Current GitHub Pages workflow builds only `pixel-invaders`. Signal server and future Rolnik service are server-side Node processes. Planned Rolnik deployment should use containers for `rolnik-service`, `web-portal`, and PostgreSQL; Discord bot should be a later adapter process.

## Data/storage model

Current browser-side persistence belongs under `packages/core/src/storage`. Phone controller contracts live under `packages/core/src/phone`. Future Rolnik online state should use backend-owned game snapshots plus event logs; the core `GameState` remains the rules SSOT.

## External integrations

- Browser Gamepad/keyboard input through input profiles.
- Phone controller protocol and WebRTC signaling.
- GitHub Pages for current static deployment.
- HiveMind MCP for project memory.
- Planned: Rolnik HTTP API, PostgreSQL, Docker/compose, Discord bot.

## Important risks

- Duplicating game rules across Phaser, backend, Discord, and WWW.
- Adding fallback behavior that hides invalid config or invalid input.
- Letting presentation concerns mutate domain state directly.
- Adding online identity/session logic before `PlayerAction`, `PlayerView`, and `GameEvent` contracts are stable.

## Things AI agents must not guess

- Runtime config schemas.
- Input action IDs, profile format, or bindings.
- Phone protocol shape.
- Rolnik economy/gameplay rules when SSOT docs exist.
- Whether Discord/WWW/backend can own game rules; they cannot.
