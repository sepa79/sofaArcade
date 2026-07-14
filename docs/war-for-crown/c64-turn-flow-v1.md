# War for Crown C64 Turn Flow v1

This document replaces the visible `STATUS` and `DOCHOD` UI steps.

## Visible Turn Flow

After both players choose home provinces, the active player sees a new-month
overlay:

- month and year,
- weather,
- income from villages,
- event summary when events exist.

Clicking the overlay continues to `ATAK`. There is no separate visible "check
house status" step and no separate "collect money" phase.

The visible phases are:

1. `NOWY MIESIAC`
2. `ATAK`
3. `RUCH`
4. `BUDOWA`

## Internal Turn Step

The game state uses:

```ts
export type TurnStep = 'new-month' | 'attack' | 'movement' | 'investment';
```

`advance-step` from `new-month` calculates and applies income once, emits the
income event, and moves to `attack`.

## Attack Flow

The attack UI is target-first:

1. Player chooses an enemy or neutral target province.
2. Player chooses one or more adjacent owned source provinces.
3. Player confirms the attack.
4. A dedicated battle screen appears.
5. Player chooses another attack or ends the attack phase.

The player does not choose an exact soldier count in v1. Every selected source
province commits all mobile soldiers. For v1, "mobile soldiers" means all but
one soldier from each source province, so the existing invariant that owned
provinces stay garrisoned remains true.

## Command Visibility

The UI shows only commands useful in the current phase and current selection:

- no attack controls outside `ATAK`,
- no disabled attack controls before a valid target/source selection,
- no manual attack plus/minus/max buttons,
- no collect-income button,
- no status-rank prompt.

Clicking water cancels the current map selection. A visible cancel button may
also exist.

## Deferred

- Weather is displayed as a v1 placeholder until C64 values are recovered.
- Event content is displayed as "no event" until the event table is implemented.
- Exact C64 battle randomization still needs a deeper arithmetic pass. See
  `docs/war-for-crown/c64-attack-code-analysis.md`.
