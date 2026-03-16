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
- Runtime settings schema: `packages/core/src/config/settings.ts`
- Action catalog: `packages/core/src/input/actions.ts`
- Input binding schema and profile format: `packages/core/src/input/profile.ts`
- Game input profile data: `games/*/src/profiles/*.input-profile.json`
- HTTP transport behavior (leaderboards/services): `packages/net/src/client.ts`

## Module Boundaries
- `packages/core/src/config/*`: validation + typed config only
- `packages/core/src/input/*`: devices, polling, action mapping, profiles
- `packages/core/src/storage/*`: persistence and migrations only
- `packages/core/src/time/*`: fixed timestep and frame timing only
- `packages/game-sdk/src/*`: lifecycle, scenes, and game-facing abstractions
- `games/*/src/*`: pure game logic + assets usage only
- `apps/*/src/*`: composition roots and runtime wiring only

## Quality Bar
- TypeScript strict mode required.
- Lint must pass with zero warnings.
- Unit tests for pure logic modules are mandatory.
- Keep APIs explicit and typed.
- Prefer pure functions over mutable shared state.
