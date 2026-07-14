# War for Crown Turn Order And Investments v0

This document is the implementation spec for the next API-first slice. It
extends `rules-v0.md` and `api-first-plan.md`.

If this document conflicts with `AGENTS.md`, `AGENTS.md` wins. If this document
conflicts with older War for Crown planning notes, this document wins for the
turn-order and investment slice.

For C64-target scope, `c64-scope-notes.md` wins over broad manual-derived
features.

For the current visible flow, see `c64-turn-flow-v1.md`.

## Source Notes

Reference material:

- `/mnt/c/Games/c64/WfC/Krieg_um_die_Krone_2_Manual.txt`

Relevant manual sections:

- remembered C64 new-month summary: month/year, weather, event, and income,
- `7.2.5` attack phase,
- `7.2.7` movement phase,
- `7.2.8` investment phase,
- `4.5.1` village count and village economy,
- `4.5.3` village cost range and interest,
- `4.5.4` max fortification for non-home provinces.

The manual is broader than the C64 target. This slice restores the API shape
needed for the remembered C64 order, but does not import broad manual features
that were not present on C64.

## Scope

Implement in pure game modules first:

- turn substeps,
- new-month summary at turn start,
- player money,
- investment actions,
- province fortification state,
- soldier movement,
- phase-gated action validation,
- player views for the new fields.

Do not implement in this slice:

- supply goods,
- catapults,
- broad manual random-event subsystem,
- variable troop composition,
- title/rank effects,
- royalist AI economy,
- multiplayer transport,
- persistence/replay log.

Simple C64-style event and weather steps are planned separately.

## Turn Step Model

Add a new type:

```ts
export type TurnStep =
  | 'new-month'
  | 'attack'
  | 'movement'
  | 'investment';
```

Store it on `GameState`:

```ts
readonly turnStep: TurnStep;
```

The v0 monthly sequence is:

1. `new-month`
2. `attack`
3. `movement`
4. `investment`

The broad manual also has supply and troop-allocation phases, but these are not
part of the current C64 target. Do not add placeholder phases that silently do
nothing.

After both players select homes, the first active player starts in `new-month`.

## Advance-Step Rules

Add action:

```ts
{ readonly type: 'advance-step' }
```

Rules:

- Only the active player may advance their step.
- `new-month -> attack` collects income into player money exactly once and emits
  the income event.
- `attack -> movement` ends the attack window.
- `movement -> investment` ends the movement window.
- `investment -> new-month` advances to the next player. If the next player is
  `p1`, increment `turnNumber`.
- `end-turn` should remain accepted as a compatibility shortcut for the current
  UI and AI, but internally it must advance to the next player through the same
  state transition as leaving `investment`.

No action may auto-advance the step except `advance-step` and the compatibility
`end-turn`.

## Money Model

`PlayerState` stores money only; there is no free-troop or reserve pool in the
simple C64-target ruleset:

```ts
readonly money: number;
```

v0 config additions:

```ts
readonly startingMoney: number;
readonly soldierCost: number;
readonly villageCost: number;
readonly fortificationUpgradeCost: number;
readonly maxVillages: number;
readonly maxHomeFortificationLevel: FortificationLevel;
readonly maxProvinceFortificationLevel: FortificationLevel;
```

v0 default values:

- `startingMoney: 20`
- `soldierCost: 1`
- `villageCost: 4`
- `fortificationUpgradeCost: 10`
- `maxVillages: 12`
- `maxHomeFortificationLevel: 'citadel'`
- `maxProvinceFortificationLevel: 'watchtower'`

Rationale:

- The manual says one soldier costs one Taler.
- The manual gives village cost as configurable between four and twelve Talers;
  v0 uses the C64 default four.
- The manual does not expose a clear fortification cost in the text file, so v0
  uses an explicit config value and does not claim this is original.
- The current C64-target v0 rules do not expose a starting-fort selector.
  Royalist/Kingsmen provinces start without fortifications. A confirmed player
  home province becomes the player's castle.

## Income Rules

Current `calculateIncome` remains the SSOT for income amount.

On the `new-month -> attack` transition:

- calculate income for the active player,
- add it to `player.money`,
- emit an income event,
- do not add it to any reserve pool.

Do not collect income from direct `end-turn`; direct `end-turn` is a shortcut to
finish the current player's remaining interaction, not a second income trigger.

## Fortification Model

Add:

```ts
export type FortificationLevel =
  | 'none'
  | 'watchtower'
  | 'fort'
  | 'castle'
  | 'stronghold'
  | 'fortress'
  | 'citadel';
```

Add to `ProvinceState`:

```ts
readonly fortificationLevel: FortificationLevel;
readonly upgradedFortificationThisTurn: boolean;
```

v0 order:

```text
none -> watchtower -> fort -> castle -> stronghold -> fortress -> citadel
```

Rules:

- Royalist/Kingsmen provinces start at `none`.
- Confirming a player home province sets its fortification to the fixed player
  castle level.
- Only owned provinces can be upgraded.
- Upgrade is legal only during `investment`.
- Upgrade costs `fortificationUpgradeCost`.
- A province can be upgraded at most once during one owning player's investment
  phase.
- Upgrade cannot exceed `maxHomeFortificationLevel` for home provinces or
  `maxProvinceFortificationLevel` for other provinces.
- Capturing a province keeps its current fortification in this slice. Damage and
  downgrade-on-capture are deferred.

Battle effect v0:

- Fortification multiplies defender strength.
- Multipliers are:
  - `none: 1`
  - `watchtower: 1.15`
  - `fort: 1.35`
  - `castle: 1.6`
  - `stronghold: 1.9`
  - `fortress: 2.3`
  - `citadel: 2.75`

These are v0 readability values, not restored C64 table values.

## Recruiting Soldiers

Add action:

```ts
{ readonly type: 'recruit-soldiers'; readonly soldiers: number }
```

Rules:

- Legal only during `investment`.
- `soldiers` must be a positive integer.
- Cost is `soldiers * soldierCost`.
- Player must have enough money.
- Recruits are added to the player's home province immediately in this slice.

The broad manual describes training delay, but this is not part of the current
C64 target. Recruits are immediately available at the home province in this
slice.

## Movement UI

The Phaser UI mirrors the public movement action without adding hidden state:

- during `movement`, click an owned source province;
- click any other owned target province;
- choose the soldier count with a slider or the `-`, `+`, all, and equalize
  buttons;
- confirm the move through an explicit UI command.

The equalize button chooses the closest legal transfer that balances source and
target soldiers after movement. If the selected direction cannot reduce the
imbalance, the button is disabled.

The UI must submit the same public `move-soldiers` action. Movement is not an
attack and is not restricted to adjacent provinces.

## Building Villages

Add action:

```ts
{ readonly type: 'build-village'; readonly provinceId: ProvinceId }
```

Rules:

- Legal only during `investment`.
- Province must be owned by the acting player.
- Player must have at least `villageCost` money.
- Province `villages` must be below `maxVillages`.
- Building adds exactly one village.

## Moving Soldiers

Add action:

```ts
{
  readonly type: 'move-soldiers';
  readonly fromProvinceId: ProvinceId;
  readonly targetProvinceId: ProvinceId;
  readonly soldiers: number;
}
```

Rules:

- Legal only during `movement`.
- Both provinces must be owned by the acting player.
- `soldiers` must be a positive integer.
- Source must keep at least one soldier.
- Target can be any other province owned by the acting player.

## Attack Rules Update

Attack remains:

```ts
{
  readonly type: 'attack';
  readonly fromProvinceIds: ReadonlyArray<ProvinceId>;
  readonly targetProvinceId: ProvinceId;
}
```

Rules:

- Attack is legal only during `attack`.
- At least one source province is required.
- Every source province must be owned by the active player and adjacent to the
  target.
- Every source province commits all mobile soldiers. Mobile soldiers are all but
  one soldier, preserving the current owned-province garrison invariant.

Battle defender multiplier becomes:

```text
terrain.defenceMultiplier * fortification.defenceMultiplier
```

## Player View Updates

Known province details must include:

```ts
readonly fortificationLevel: FortificationLevel;
readonly upgradedFortificationThisTurn: boolean;
```

Distant province details must not include fortification level for this slice.
This keeps fortification status under the same visibility rule as owner,
soldiers, villages, and income.

The viewing player's public data must include:

```ts
readonly money: number;
```

Opponent money must not be exposed.

## Events

Add events:

```ts
| { readonly type: 'turn-step-advanced'; readonly playerId: PlayerId; readonly from: TurnStep; readonly to: TurnStep }
| { readonly type: 'income-collected'; readonly playerId: PlayerId; readonly money: number }
| { readonly type: 'soldiers-recruited'; readonly playerId: PlayerId; readonly provinceId: ProvinceId; readonly soldiers: number; readonly cost: number }
| { readonly type: 'village-built'; readonly playerId: PlayerId; readonly provinceId: ProvinceId; readonly cost: number }
| { readonly type: 'fortification-upgraded'; readonly playerId: PlayerId; readonly provinceId: ProvinceId; readonly level: FortificationLevel; readonly cost: number }
| { readonly type: 'soldiers-moved'; readonly playerId: PlayerId; readonly fromProvinceId: ProvinceId; readonly targetProvinceId: ProvinceId; readonly soldiers: number }
| { readonly type: 'battle-resolved'; readonly attackerId: PlayerId; readonly defenderId: PlayerId | null; readonly fromProvinceIds: ReadonlyArray<ProvinceId>; readonly targetProvinceId: ProvinceId; readonly attackingSoldiers: number; readonly result: BattleResult }
```

Existing `turn-ended` remains for player switch.

## Acceptance Tests

- After home selection, state enters `turnStep: 'new-month'`.
- `advance-step` moves through `new-month -> attack -> movement -> investment`.
- `advance-step` from `new-month` adds income to `money` once.
- `attack` is rejected outside `attack`.
- `move-soldiers` is rejected outside `movement`.
- `recruit-soldiers`, `build-village`, and `upgrade-fortification` are rejected
  outside `investment`.
- Recruiting soldiers spends money and adds soldiers to the home province.
- Building a village spends money and increments village count.
- Building a village fails at `maxVillages`.
- Upgrading fortification spends money and advances one level.
- Upgrading fortification twice in one investment phase fails.
- Fortification increases defender battle strength.
- `PlayerView` exposes money only to self.
- `PlayerView` exposes fortification only for known provinces.

## Review Notes

- This spec intentionally keeps `end-turn` as a compatibility action. It is not
  the canonical phase flow.
- The removed reserve/free-troop model must not return through UI copy, player
  views, or API actions.
- Training delays, supply goods, catapults, and broad manual-only systems are
  out of C64 scope for now, not hidden fallbacks.
- Connected-path movement is C64-unverified and should not be expanded until
  checked against C64 behavior.
