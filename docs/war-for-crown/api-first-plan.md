# War for Crown API-First Plan

This plan defines the next implementation direction for War for Crown before
larger UI work. The goal is to make the game playable and testable through a
typed API that can later be consumed by SofaArcade multiplayer infrastructure.

## Goals

- Make the pure game module the only source of gameplay state transitions.
- Expose a small action API usable by tests, Phaser UI, bots, and online adapters.
- Expose player-scoped views so clients only receive information they are allowed
  to know.
- Keep online multiplayer outside the game package. The game package consumes
  player actions and returns state/events/views.
- Keep C64-style limited information as a core rule, not a UI convention.

## Non-Goals

- No network transport in `games/war-for-crown`.
- No session/auth/player connection ownership in `games/war-for-crown`.
- No Phaser-specific action contract.
- No full restoration of C64 rules before the API slice is stable.
- No hidden fallback when invalid players, phases, provinces, or actions are sent.

## Target Module Boundaries

- `games/war-for-crown/src/game/actions.ts`
  - Defines `WarForCrownAction`.
  - Applies player actions through `applyPlayerAction`.
- `games/war-for-crown/src/game/events.ts`
  - Defines `WarForCrownEvent`.
  - Keeps event payloads deterministic and transport-neutral.
- `games/war-for-crown/src/game/player-view.ts`
  - Defines `PlayerView`.
  - Produces visibility-limited views for one player.
- `games/war-for-crown/src/game/*`
  - Remains pure game logic with unit tests.
- `games/war-for-crown/src/scenes/*`
  - Consumes the public game API. It must not become a second rules source.
- SofaArcade multiplayer module
  - Owns sessions, transport, player identity, ordering, and delivery.

## Action API

Add one public player-action contract:

```ts
export type WarForCrownAction =
  | { readonly type: 'select-home'; readonly provinceId: ProvinceId }
  | {
      readonly type: 'attack';
      readonly fromProvinceIds: ReadonlyArray<ProvinceId>;
      readonly targetProvinceId: ProvinceId;
    }
  | { readonly type: 'end-turn' };
```

Add one public transition function:

```ts
export interface ApplyPlayerActionResult {
  readonly state: GameState;
  readonly events: ReadonlyArray<WarForCrownEvent>;
}

export function applyPlayerAction(
  state: GameState,
  playerId: PlayerId,
  action: WarForCrownAction
): ApplyPlayerActionResult;
```

Rules:

- Validate action shape and state requirements explicitly.
- Throw clear errors for invalid player, phase, ownership, adjacency, or counts.
- Do not silently recover, clamp, auto-switch, or ignore invalid actions.
- Existing pure functions such as `attackProvince`, `selectHomeProvince`, and
  `endTurn` can remain internal building blocks.
- `ApplyPlayerActionResult.state` is authoritative host/server state. It must not
  be sent to clients that should receive visibility-limited `PlayerView` data.
- If actions arrive from JSON, the transport boundary must parse them into
  `WarForCrownAction` before applying them. Invalid raw messages fail before the
  game transition is attempted.

## Event API

Start with events needed for tests and future clients:

```ts
export type WarForCrownEvent =
  | { readonly type: 'home-selected'; readonly playerId: PlayerId; readonly provinceId: ProvinceId }
  | {
      readonly type: 'battle-resolved';
      readonly attackerId: PlayerId;
      readonly defenderId: PlayerId | null;
      readonly fromProvinceIds: ReadonlyArray<ProvinceId>;
      readonly targetProvinceId: ProvinceId;
      readonly attackingSoldiers: number;
      readonly result: BattleResult;
    }
  | {
      readonly type: 'turn-ended';
      readonly endedPlayerId: PlayerId;
      readonly nextPlayerId: PlayerId;
      readonly turnNumber: number;
    }
  | { readonly type: 'game-won'; readonly winnerId: PlayerId };
```

Events are not a persistence log yet. They are deterministic output from applying
one accepted action.

## Player View API

Add one public visibility contract:

```ts
export interface PlayerView {
  readonly playerId: PlayerId;
  readonly phase: GamePhase;
  readonly activePlayerId: PlayerId;
  readonly turnNumber: number;
  readonly winnerId: PlayerId | null;
  readonly map: PlayerMapView;
  readonly players: ReadonlyArray<PlayerPublicView>;
}
```

Use a discriminated union for province details:

```ts
export type PlayerProvinceView =
  | {
      readonly visibility: 'known';
      readonly id: ProvinceId;
      readonly terrainId: TerrainId;
      readonly neighbours: ReadonlyArray<ProvinceId>;
      readonly ownerId: PlayerId | null;
      readonly soldiers: number;
      readonly villages: number;
      readonly income: number;
    }
  | {
      readonly visibility: 'distant';
      readonly id: ProvinceId;
      readonly terrainId: TerrainId;
      readonly neighbours: ReadonlyArray<ProvinceId>;
    };
```

Visibility rule for v0:

- All clients know the map shape, terrain, province IDs, and adjacency graph.
- A player knows exact owner, soldiers, villages, and income for:
  - provinces they own,
  - provinces adjacent to a province they own.
- Provinces outside that visibility range expose terrain and adjacency only.
- Unknown detail fields must be absent or explicitly represented as unknown by
  one typed shape. Do not use nullable fields for both unknown and real absence.
- During home selection, unowned provinces are selectable but detailed neutral
  troop/village information should still follow the same visibility contract
  unless a later rules document changes this.

This approximates the remembered C64 behavior: the player can understand the
world shape and borders, but exact military/economic information is local.

## Multiplayer Boundary

The game package should export:

```ts
createInitialState(seed, config)
applyPlayerAction(state, playerId, action)
createPlayerView(state, playerId)
```

SofaArcade multiplayer should own:

- lobby/session lifecycle,
- assigning `PlayerId` to connected users/controllers,
- action ordering,
- transport delivery,
- reconnect/session recovery,
- fan-out of each player-specific `PlayerView`.

The game must not import server, WebRTC, storage, or portal modules.

## Implementation Slices

1. Add `WarForCrownAction`, `WarForCrownEvent`, `ApplyPlayerActionResult`, and
   `applyPlayerAction`.
2. Add API-level tests that play a short game sequence only through
   `applyPlayerAction`.
3. Add `PlayerView` and `createPlayerView`.
4. Add visibility tests for owned, adjacent, and distant provinces.
5. Switch Phaser scene command handling to call `applyPlayerAction`.
6. Switch Phaser rendering to use `PlayerView` where practical.
7. Add a minimal headless scripted client test that performs legal actions
   without Phaser.

## Latest Implementation Status

The first API slice has been implemented:

- `applyPlayerAction`,
- `WarForCrownEvent`,
- `createPlayerView`,
- deterministic AI action selection,
- Phaser scene state changes routed through `applyPlayerAction`.

The turn-order and investment slice has been implemented. See
`turn-order-investments-v0.md`.

## Next Rules Slice: Turn Order And Investments

The implemented API slice preserves active-player order and models the first
turn-step sequence. Further C64 alignment should follow `c64-scope-notes.md`.

Current C64 target turn flow is:

1. possible event,
2. weather,
3. village income modified by weather,
4. attack,
5. movement,
6. investment menu: build, hire soldiers, next turn.

The current v0 model supports:

- home selection,
- turn-step advancement,
- income into money,
- attacking one adjacent target during attack,
- soldier movement between owned provinces during movement,
- village building, soldier hiring, and fortification upgrades during investment,
- ending the turn through the compatibility shortcut.

Missing C64-like core concepts:

- possible event step,
- weather step,
- weather-modified village income,
- investment menu shape in UI,
- connected-owned-path movement if C64 behavior confirms it.

Do not implement these from UI state. Add them as pure `src/game` state and
actions first, then let Phaser and future online clients consume the API.

Proposed next action contract extensions:

```ts
type WarForCrownAction =
  | ExistingWarForCrownAction
  | { readonly type: 'advance-step' }
  | { readonly type: 'recruit-soldiers'; readonly soldiers: number }
  | { readonly type: 'build-village'; readonly provinceId: ProvinceId }
  | { readonly type: 'upgrade-fortification'; readonly provinceId: ProvinceId }
  | {
      readonly type: 'move-soldiers';
      readonly fromProvinceId: ProvinceId;
      readonly targetProvinceId: ProvinceId;
      readonly soldiers: number;
    };
```

Before implementing costs, capture v0 defaults explicitly in `GameConfig`; do
not hard-code manual values directly in action handlers.

## Acceptance Tests For The Next Slice

- P1 and P2 can select home provinces through `applyPlayerAction`.
- P1 cannot act during P2's turn.
- A player cannot attack with invalid soldier counts.
- A player cannot attack a non-adjacent province.
- A successful attack emits `battle-started`, commits mobile attacking
  soldiers from source provinces, and stores `GameState.battle`.
- `battle-round` emits `battle-round-resolved`; if either side is eliminated it
  also emits `battle-resolved` and updates province ownership/soldiers.
- Battle retreat actions emit one final `battle-round-resolved`, then
  `battle-resolved` with the matching retreat resolution.
- Advancing from income emits `income-collected` and pays income once.
- A win emits `game-won`.
- `createPlayerView` exposes exact details for owned and adjacent provinces.
- `createPlayerView` hides owner, soldiers, villages, and income for distant
  provinces.

## Acceptance Tests For Turn Order And Investments

- Attack actions are rejected outside the attack phase.
- Movement actions are rejected outside the movement phase.
- Investment actions are rejected outside the investment phase.
- End/advance actions move through the configured phase order deterministically.
- Income creates money/treasury for the active player.
- Recruiting soldiers spends money and adds soldiers to the home province.
- Building a village spends money and increases village count only below the
  configured province cap.
- Upgrading fortification spends money and increases fortification by at most
  one level per province per month.
- `PlayerView` exposes money and fortification only according to the visibility
  rules.

## Plan Review

### Findings

- High: The visibility model must be implemented before multiplayer fan-out.
  If online transport sends raw `GameState`, hidden province data will leak by
  design.
- High: `applyPlayerAction` must become the public transition entry point before
  Phaser is refactored further. Otherwise UI behavior and API behavior will drift.
- Medium: `WarForCrownEvent` should not be treated as durable replay format yet.
  It lacks IDs, timestamps, schema versioning, and idempotency fields.
- Medium: Home selection visibility is currently a rule assumption. It should be
  checked against original material later, but v0 should still pick one explicit
  behavior now.
- Medium: The API currently has no per-turn subphase, so it cannot yet enforce
  the C64 action order. Multiplayer should not treat it as rules-complete.
- Medium: The current economy is a v0 simplification. It has static villages,
  money, village purchases, and fortification upgrades, but no weather
  modifiers yet.
- Low: Current two-player `PlayerId` type is enough for v0 but will need review
  before variants with more houses or spectators.

### Checks

- Scope is API-first and does not expand into online transport.
- Game rules remain under `src/game`.
- Phaser scene remains a consumer of game contracts.
- No duplicate config or profile source is introduced.
- Invalid actions are planned to fail fast.
- Tests are specified before implementation.

## Open Questions

- Should distant province owner be fully hidden, or should ownership be known
  while soldiers/villages stay hidden? Current plan hides owner for stricter
  C64-like uncertainty.
- During home selection, should neutral soldier/village details be visible for
  all provinces to help first placement, or hidden until adjacency exists?
- Should `PlayerView` include battle preview helpers, or should preview remain a
  separate pure function consumed by clients?
- Which v0 costs should be used for soldiers, villages, and fortification before
  the full preset/options system is restored from the original game?
