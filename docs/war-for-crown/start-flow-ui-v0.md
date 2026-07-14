# War for Crown Start Flow UI v0

This document replaces the direct-to-map start flow.

## Entry Screen

The game starts on a menu with three commands:

- `NOWA GRA`
- `ZASADY`
- `WCZYTAJ` disabled for now

The map is not interactive on this screen.

A language toggle is visible in the UI:

- `PL`
- `ENG`

This first slice localizes the player-facing start flow, setup flow, and main
turn guidance. Internal API names remain English in code and are not shown as
player copy.

## Rules Screen

The rules screen shows actual configured values from `DEFAULT_GAME_CONFIG`:

- map size in tiles,
- number of provinces,
- player count alive / total for this ruleset,
- starting province soldiers and money,
- income per village,
- initial and maximum village counts,
- village cost,
- soldier cost,
- fortification upgrade cost,
- available fortification levels,
- C64 v0 exclusions: no catapults and no supply goods.

## New Game Flow

`NOWA GRA` starts a guided setup:

1. Generate a map preview from a seed.
2. Player adjusts map-generation parameters in the right panel.
3. Player may reject it and generate another map.
4. Player confirms the map.
5. Player enters player names.
6. Player chooses color and crest for each player.
7. Game enters home selection.
8. Clicking a neutral province only marks it as pending.
9. Player must confirm the selected province.

No one-click start province assignment is allowed.

## Map Setup Panel

Map-generation controls belong to the map selection screen, not the rules
screen.

The right panel should expose map-preview parameters such as:

- seed,
- province/tile count,
- water ratio,
- optional shape/roughness controls once the generator supports them.

Changing these values regenerates or updates the preview before player setup is
accepted. These controls define the chosen continent, not reusable ruleset
configuration.

## Turn Guidance

Every active turn step is presented twice:

- in the top header as the current phase,
- as a temporary centered map overlay when the step begins.

The overlay is used for:

- weather when implemented,
- random events when implemented,
- phase changes now,
- new-month income summaries now.

The player-facing UI must not expose technical step names such as `next step`.
The ruleset has no free-troop or reserve pool; starting soldiers are placed
directly in the confirmed home province.
