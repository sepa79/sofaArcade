# War for Crown Status Notifications v0

Superseded by `c64-turn-flow-v1.md`. This file is retained as historical
planning context only.

This document defines the current role of the `title` turn step.

## Decision

`title` remains in the turn order, but it is a status/notification step rather
than an interactive player-action phase.

The step should support:

- checking high-level player status at the start of the active player's turn,
- reporting visible status information to clients,
- later title/rank changes when those rules exist,
- sidebar/log presentation in UI.

The step must not become a hidden no-op. If no title/rank mechanics exist yet,
it still emits an explicit status event with the current ownership summary.

## Current v0 Behavior

On `title -> income`, emit:

```ts
{
  readonly type: 'status-checked';
  readonly playerId: PlayerId;
  readonly ownedProvinceCount: number;
  readonly totalProvinceCount: number;
  readonly title: string;
}
```

For now, `title` is a presentation label derived from owned province count. It
does not change combat, income, action legality, or win rules.

## UI Behavior

The Phaser scene should keep a small sidebar event log. It should show recent
game events such as:

- status checked,
- income collected,
- battle resolved,
- village built,
- soldiers recruited,
- fortification upgraded,
- turn ended.

The sidebar log is a presentation layer. It must consume `WarForCrownEvent`
payloads and must not compute game rules.

## Non-Goals

- No full title/rank progression mechanics in this slice.
- No score system.
- No automatic skip/removal of the `title` step.
- No hidden state changes during status checks.
