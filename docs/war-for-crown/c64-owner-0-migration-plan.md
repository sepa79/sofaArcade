# War for Crown C64 Owner 0 Migration Plan

This document is the SSOT for the completed replacement of the temporary
`ProvinceState.ownerId === null` royalist model with first-class C64 owner `0`.

If this document conflicts with `AGENTS.md`, `AGENTS.md` wins.

## Reason

C64 uses owner/player slot `0` for Königstreuen/Kingsmen. The TypeScript port
now models that owner explicitly with `ROYALIST_OWNER_ID = 0`. This was required
because `null` already appears elsewhere as a real absence:

- water/no province uses `TileState.provinceId: null`;
- eliminated or not-yet-started players use `PlayerState.homeProvinceId: null`;
- no active battle uses `GameState.battle: null`;
- no winner uses `GameState.winnerId: null`.

Royalist ownership is not absence. It is an active C64 owner with attacks,
production, distribution, battle retreat ownership, castle-capture effects, and
a distinct final result.

## C64 Evidence

| Concern | Evidence | Required port meaning |
| --- | --- | --- |
| turn owner selection | `main:L3312/L337A`, `fixtures/main-l3312-turn-owner-selection.json` | owner `0` gets a world pass between the last player and next round |
| hostile royalist attack | `kampf:L8461`, hostile attack fixtures | source and target scans use owner `0`, not an absent owner |
| royalist production | `main:L5209`, production fixtures | production iterates owner-`0` provinces and saved per-province buckets |
| royalist distribution | `main:L50D3`, distribution fixtures | connected owner-`0` components are redistributed |
| home-castle capture | `main:L4C7A`, `fixtures/main-castle-capture-transfer.json` | a captured home castle eliminates that player and transfers all provinces to the victor owner |
| royalist victory | `main:L339B`, final-loader fixtures | owner `0` owning the continent loads result `TXTWIN2` |

## Active Type Model

Use C64's literal owner slot as the domain value:

```ts
export const ROYALIST_OWNER_ID = 0 as const;
export type RoyalistOwnerId = typeof ROYALIST_OWNER_ID;
export type OwnerId = PlayerId | RoyalistOwnerId;
```

Implemented state changes:

- `ProvinceState.ownerId: OwnerId`;
- `BattleState.defenderId: OwnerId`;
- battle events use `OwnerId` for defenders;
- `GameState.winnerId` can represent owner `0`; a later public API cleanup may
  rename it to `winnerOwnerId`;
- no province on a water tile remains `TileState.provinceId: null`;
- player absence/elimination remains `PlayerState.homeProvinceId: null`.

Do not introduce a string royalist pseudo-player. Königstreuen are not a normal
AI player in the C64 ruleset.

## Behavioral Requirements

Initial generated provinces start as owner `0`. Home selection changes exactly
one owner-`0` province to the player and creates that player's castle there.

Attacking an owner-`0` province records defender owner `0`. Friendly royalists
can join the attacker through the recovered `kampf:L7E76` path; neutral and
hostile royalists use normal battle behavior unless the specific C64 world
phase says otherwise.

Defender retreat works by owner, so owner `0` can retreat to adjacent owner-`0`
land. Royalists never have a home province, so owner `0` is never blocked by
home-castle retreat rules.

When a player home castle is captured, every province owned by the defeated
player transfers to the victorious owner. The victor may be a normal player or
owner `0`.

Victory detection has two distinct outcomes:

- player owner wins -> player final result;
- owner `0` wins -> royalist final result `TXTWIN2`.

## Migration Record

1. Added `owners.ts` with `ROYALIST_OWNER_ID`, `OwnerId`, and small ownership
   predicates.
2. Change province, battle, event, and view owner types from
   `PlayerId | null` to `OwnerId`.
3. Initialize generated provinces with owner `0`, and update home selection to
   require owner `0` instead of `null`.
4. Convert royalist world phase, cbaron threat/attack/economy helpers, and
   reachability helpers from `ownerId === null` to explicit owner predicates.
5. Update home-castle capture so victor owner may be `0`.
6. Update winner detection so owner `0` owning all provinces is a real winner.
7. Updated public view, scene owner labels, journal events, and tests so owner
   `0` is not treated as unknown ownership. Final PL/EN naming polish remains
   in the localization backlog.
8. Replaced tests and fixtures that create royalist provinces with owner `0`.

## Non-Goals

- Do not make royalists a `PlayerState`.
- Do not add a second neutral owner.
- Do not change water representation.
- Do not implement PC "king returns" stalemate intervention in C64 baseline.
- Do not add compatibility fallbacks that accept both `null` and `0` as royalist
  ownership. The migration should fail fast on invalid owner state.

## Acceptance

- No production code checks `province.ownerId === null` or
  `province.ownerId !== null`.
- Generated playable provinces always have a concrete `OwnerId`.
- Royalist attack, production, distribution, defender retreat, castle capture,
  and victory tests use owner `0`.
- Headless C64-original simulations still emit royalist battle events and
  remain legal through long hostile all-AI stalemate runs.
