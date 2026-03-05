# AGENTS.md

## Core Rules (Non-Negotiable)
- No defensive coding.
- No fallbacks.
- One SSOT per concern.
- Functional separation into small modules with single responsibility.
- Fail fast on invalid input and invalid state.

## Engineering Contract
- Do not silently recover from errors.
- Do not auto-switch input backend, transport, or command strategy.
- Do not add duplicate config or profile sources.
- Input bindings/mappings must live in profile data files (`*.input-profile.json`), never inline in TypeScript code.
- If required data is missing, throw a clear error with context.
- Keep side effects at module boundaries.

## SSOT Map
- Signaling runtime config schema: `apps/signal-server/src/config.ts`
- Web portal runtime config schema: `apps/web-portal/src/config.ts`
- Action catalog: `packages/core/src/input/actions.ts`
- Input binding schema and profile format: `packages/core/src/input/profile.ts`
- Game input profile data: `games/*/src/profiles/*.input-profile.json`
- Phone input message contract: `packages/core/src/phone/protocol.ts`
- WebRTC signaling transport behavior: `apps/signal-server/src/server.ts`

## Module Boundaries
- `packages/core/src/input/*`: actions, polling/runtime, mapping, profiles
- `packages/core/src/phone/*`: phone input protocol + provider logic
- `packages/core/src/storage/*`: browser persistence only
- `packages/game-sdk/src/audio/*`: shared audio engine only
- `packages/game-sdk/src/runtime/*`: shared runtime toggles/caches only
- `games/*/src/game/*`: pure game logic, constants, state, tests
- `games/*/src/scenes/*`: scene wiring, render, audio usage
- `apps/*/src/*`: composition roots and runtime wiring only

## Quality Bar
- TypeScript strict mode required.
- Lint must pass with zero warnings.
- Unit tests for pure logic modules are mandatory.
- Keep APIs explicit and typed.
- Prefer pure functions over mutable shared state.
