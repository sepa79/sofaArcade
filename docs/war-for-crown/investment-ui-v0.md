# War for Crown Investment UI v0

This document defines the first playable Phaser UI for investment actions.

## Scope

Use the existing game API. Do not add new rules in the scene.

Actions exposed by UI:

- province action: build one village,
- province action: upgrade fortification by one level,
- player action: hire soldiers at the home province,
- turn action: advance to next turn/player through the existing step flow.

No supply goods, catapults, or version 2.0 option menus in this slice.

## Province Investment Actions

When the active player is in `investment` and selects one of their provinces,
the province panel shows:

- `BUILD VILLAGE`
- `UPGRADE FORT`

`BUILD VILLAGE` is enabled only when:

- the selected province is owned by the active player,
- the active turn step is `investment`,
- active player money is at least `villageCost`,
- selected province villages are below `maxVillages`.

`UPGRADE FORT` is enabled only when:

- the selected province is owned by the active player,
- the active turn step is `investment`,
- active player money is at least `fortificationUpgradeCost`,
- selected province has not upgraded fortification this turn,
- selected province fortification is below the configured home/province
  fortification limit.

On click, call `applyPlayerAction` with:

```ts
{ type: 'build-village', provinceId }
{ type: 'upgrade-fortification', provinceId }
```

## Player Investment Action

The side panel shows `HIRE` during `investment`.

For this first UI slice, `HIRE` recruits as many soldiers as the active player
can afford:

```ts
Math.floor(player.money / soldierCost)
```

The action is enabled only when:

- active turn step is `investment`,
- active player has a home province,
- active player money is at least `soldierCost`.

On click, call:

```ts
{ type: 'recruit-soldiers', soldiers }
```

## UI Notes

- Disabled buttons should explain the blocker through the existing footer
  message.
- The event log should show `village-built`, `fortification-upgraded`, and
  `soldiers-recruited`.
- The scene may compute button enabled/disabled state from current state for
  presentation, but the game API remains the final validator.
- The player-level hire button must not overlap the selected province panel.
  In investment, keep player actions visually above province actions, with
  enough vertical spacing for four player rows and the hire button.
