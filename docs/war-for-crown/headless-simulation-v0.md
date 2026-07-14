# War for Crown Headless Simulation v0

This document is the implementation spec for the headless simulation slice. It
extends `api-first-plan.md` and `turn-order-investments-v0.md`.

If this document conflicts with `AGENTS.md`, `AGENTS.md` wins.

## Goal

Add a deterministic, non-Phaser match runner that can execute War for Crown
through the public game API:

```ts
createInitialState(seed, config)
createPlayerView(state, playerId)
applyPlayerAction(state, playerId, action)
```

The runner exists so AI clients, future SofaArcade multiplayer adapters, and
tests can exercise the same API path without reading or mutating private game
state.

## Non-Goals

- No network transport.
- No SofaArcade session, lobby, controller, or reconnect logic.
- No persistence format for production replays.
- No Phaser dependency.
- No alternative rules engine.
- No hidden action recovery when a client submits an invalid action.

## Module Boundaries

Add pure game modules:

- `games/war-for-crown/src/game/invariants.ts`
  - Validates structural game-state invariants.
  - Throws clear errors on invalid state.
- `games/war-for-crown/src/game/simulation.ts`
  - Owns headless stepping and transcript creation.
  - Calls `createPlayerView` before asking a client for an action.
  - Calls `applyPlayerAction` for every returned action.
  - Calls `validateGameState` before and after every accepted action.

Do not put simulation logic in Phaser scenes.

The package root API used by headless tests must not import Phaser. Scene exports
belong behind an explicit Phaser entrypoint so Node simulations can import the
game API without browser globals such as `navigator`.

## Client Contract

Use one client function per player:

```ts
export type SimulationClient = (view: PlayerView) => WarForCrownAction;

export interface SimulationClients {
  readonly p1: SimulationClient;
  readonly p2: SimulationClient;
}
```

Rules:

- The client receives only `PlayerView`.
- The client returns exactly one `WarForCrownAction`.
- The runner never passes full `GameState` to clients.
- If the client returns an illegal action, `applyPlayerAction` throws and the
  simulation fails. Do not substitute a fallback action.
- If a client is missing or not a function at runtime, throw before running.

## Runner API

Add:

```ts
export interface RunMatchInput {
  readonly seed: number;
  readonly clients: SimulationClients;
  readonly maxSteps: number;
  readonly config?: GameConfig;
}

export interface SimulationRuntime {
  readonly state: GameState;
  readonly clients: SimulationClients;
  readonly transcript: MatchTranscript;
}

export function createSimulation(input: RunMatchInput): SimulationRuntime;
export function stepMatch(runtime: SimulationRuntime): SimulationRuntime;
export function runMatch(input: RunMatchInput): SimulationRuntime;
```

Rules:

- `seed` must be a positive integer.
- `maxSteps` must be a positive integer.
- `runMatch` stops when `state.phase === 'game-over'` or exactly `maxSteps`
  accepted actions have been applied.
- Reaching `maxSteps` is an explicit transcript status, not an exception.
- Invalid input, invalid state, or invalid client action throws.

## Transcript

The transcript is a deterministic debug artifact, not production persistence.
For bug reports from the Phaser scene, the game also keeps an action journal
with state snapshots before and after each public action. The journal exists so
a suspicious attack or movement can be replayed from the same seed/config and
audited province-by-province.

```ts
export type MatchTranscriptStatus = 'running' | 'game-over' | 'step-limit-reached';

export interface MatchTranscriptStep {
  readonly stepNumber: number;
  readonly playerId: PlayerId;
  readonly turnNumber: number;
  readonly phase: GamePhase;
  readonly turnStep: TurnStep;
  readonly action: WarForCrownAction;
  readonly events: ReadonlyArray<WarForCrownEvent>;
  readonly before: MatchTranscriptStateSnapshot;
  readonly after: MatchTranscriptStateSnapshot;
}

export interface MatchTranscript {
  readonly seed: number;
  readonly maxSteps: number;
  readonly status: MatchTranscriptStatus;
  readonly winnerId: PlayerId | null;
  readonly finalTurnNumber: number;
  readonly steps: ReadonlyArray<MatchTranscriptStep>;
}
```

Transcript rules:

- Store the action chosen by the active player.
- Store events returned by `applyPlayerAction`.
- Store pre-action phase, turn step, and turn number for the step row.
- Store compact state snapshots before and after each action.
- Do not store full hidden `GameState` per step.
- `winnerId` and `finalTurnNumber` always mirror the final state.

Transcript state snapshots are for deterministic AI/debug comparison, not save
files. They intentionally include every province in game province order, because
attack, movement, owner-`0` behavior, and C64 player memory all depend on those
values. They intentionally exclude map tiles, renderer/UI state, and generated
asset state.

```ts
export interface MatchTranscriptStateSnapshot {
  readonly rngState: number;
  readonly activePlayerId: PlayerId;
  readonly phase: GamePhase;
  readonly turnStep: TurnStep;
  readonly turnNumber: number;
  readonly winnerId: OwnerId | null;
  readonly attackSpentProvinceIds: ReadonlyArray<ProvinceId>;
  readonly battle: BattleState | null;
  readonly players: ReadonlyArray<MatchTranscriptPlayerSnapshot>;
  readonly owners: ReadonlyArray<MatchTranscriptOwnerSnapshot>;
  readonly provinces: ReadonlyArray<MatchTranscriptProvinceSnapshot>;
  readonly c64: C64CompatibilityState;
}
```

The owner summary is the same information the side panel needs for quick
inspection: owner id, province count, soldier count, and current income under
the active config. Owner `0` has income `0` in this summary; royalist production
is audited through province rows and C64 royalist buckets.

## Action Journal

The Phaser scene must record every accepted public action, human and AI, through
the same `applyPlayerAction` path:

```ts
export interface WarForCrownJournalEntry {
  readonly index: number;
  readonly playerId: PlayerId;
  readonly action: WarForCrownAction;
  readonly events: ReadonlyArray<WarForCrownEvent>;
  readonly before: GameState;
  readonly after: GameState;
}
```

Rules:

- The journal is append-only for a match.
- A new generated map or a new match starts a new journal.
- Entries store full state snapshots before and after the action; do not infer
  move/attack provenance from current map labels.
- The scene exposes the current journal for debugging through a browser global
  function. It must return a JSON-serializable object containing seed, config,
  player setup, current state, and entries.
- Replay code must apply the journal actions from `initialState` and fail fast
  when any replayed state or event diverges.

Browser extraction during a local playtest:

```js
JSON.stringify(window.warForCrownJournal(), null, 2)
```

For an impossible-looking attack, inspect the `attack` entry and its `before`
snapshot. The source provinces in `before.map.provinces` show the actual army
available before the attack removed mobile soldiers and left one garrison in
each source.

## State Invariants

`validateGameState` should cover structural invariants needed by API tests:

- active player id exists in `players`,
- player ids are unique,
- province ids are unique,
- every tile province id is null or references an existing province,
- every neighbour id references an existing province,
- adjacency is symmetric,
- province soldier count is a non-negative integer,
- owned provinces must have at least one soldier after home selection begins,
- villages are non-negative integers,
- player money is a non-negative integer,
- if a player has `homeProvinceId`, that province exists; it may be owned by a
  victor only after that player has zero owned provinces, matching C64 `$C8FB`,
- `winnerId` is null unless phase is `game-over`,
- `game-over` with a winner means one owner controls every province.

These checks are not gameplay fallbacks. They fail fast when the state is
invalid.

## Acceptance Tests

- `validateGameState` accepts a generated initial state.
- `validateGameState` rejects asymmetric adjacency.
- `stepMatch` asks only the active player's client for an action.
- `stepMatch` records action and events in the transcript.
- `runMatch` with deterministic AI clients leaves home selection.
- `runMatch` with deterministic AI clients records income/investment events.
- `runMatch` with deterministic AI clients returns `step-limit-reached` when no
  winner appears inside the step budget.
- Invalid client actions are not recovered; they throw through the runner.

## Review Notes

- This slice deliberately does not make AI strong. It makes AI/API execution
  deterministic and inspectable.
- Multiplayer ordering remains outside this game package. SofaArcade can later
  call the same `stepMatch`-style loop with remote actions instead of AI
  clients.

## Playtest Notes 2026-07-07

Headless API playtest:

- `runMatch` with 1 human slot and 3 deterministic AI clients executes legal
  public actions and records home selection, income, battles, villages,
  fortifications, and recruitment.
- Long deterministic AI runs now reach game over after the movement-phase debug
  AI learned to push soldiers toward frontiers through `{ type: 'move-soldiers' }`.
- The next AI restoration slice should replace gameplay use of workbench AI
  with a C64-original mode described in `c64-ai-analysis.md`; do not add hidden
  state access or scene-only behavior.
- Victory is C64-style player elimination: capturing a rival home castle removes
  that rival and transfers their remaining provinces and soldiers. The AI must
  be able to reach it through the same public action API as humans.

AI strategy update:

- `c64-workbench` is the current playable AI mode through the pluggable strategy
  interface in `ai-strategy-interface-v0.md`. It is not accepted as C64 parity.
- The former deterministic AI remains available as `deterministic-debug`.
- Headless smoke run with `c64-workbench` reached `game-over` within 2000 steps for
  seeds `1`, `2`, `3`, `4`, `5`, `11`, `42`, and `99`.
- `c64-original` is now registered and runs through the same public action API.
  A smoke run with `c64-original` reached `game-over` within 2500 steps for
  seeds `1`, `2`, `3`, `4`, `5`, `11`, `42`, and `99`.
- With `royalistAttitude: hostile`, `c64-original` smoke runs are treated as
  royalist-activity/stability tests, not mandatory all-AI victory tests. Seed
  `1` runs through a 1200-step budget with `royalist-battle-resolved` events and
  remains in a legal turn state; longer all-computer games can stalemate.
