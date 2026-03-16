# Survey, tank, and map-action notes

This note groups the map-action subsystem recovered from the high-memory threaded scripts.

The core finding is that the map layer is not a loose collection of helper words.
It is a coherent action loop with separate flows for:

- survey
- build / pointer placement
- destroy
- tank import
- tank movement / combat prompts

## Map action menu

`MAP-MENU?` (`CFA $9500`) is the clearest recovered wrapper so far:

```forth
: MAP-MENU?
  0 VAR_84b3 !
  SURVEY-MAP?
  10 VAR_842f !
  18 VAR_8433 !
loop:
  WORD_9441
  WORD_8827
  21 1 AT-XY?  DOES_799e("SURVEY BUILD DESTROY EXIT") TYPE
  ...
  MAP-LOOP?
  ...
  dispatch selected action
;
```

Interpretation:

- initialize map cursor / action state
- draw the action overlay
- run the generic map command loop
- dispatch one of the chosen actions

## Survey flow

`SURVEY-MAP?` (`CFA $95ae`) prints:

- `OILWELL SURVEY MAP REQUIRED?`

and, on confirmation, sets `VAR_84b3 = 1` before calling `SURVEY-SCAN?`.

`SURVEY-SCAN?` (`CFA $95ce`) walks the map grid:

- outer loop over one axis using `CONST_6ad5($000a)`
- inner loop over the other using `CONST_6ad9($0014)`
- calls `WORD_95f2` per cell

`SURVEY-SHOW?` (`CFA $9636`) uses the current cursor location to fetch a map cell and then calls `WORD_9650`, which prints:

- `SURVEY: WELL SIZE = KB `

So the survey subsystem looks like:

1. ask whether survey map is required,
2. scan the map,
3. render discovered well-size values at selected locations.

## Pointer-placement flow

`POINTER-PROMPT` (`CFA $9489`) prints:

- `POSITION THE POINTER`
- ` THEN PRESS <FIRE>`

Then it loops on the shared command reader and dispatches:

- `Q`
- `S`
- `I`
- `P`
- `RETURN`

This appears to be the generic placement/move-cursor UI used before build/destroy actions.

## Cell owner / cell rendering helpers

`TILE-OWNER?` (`CFA $9471`) reads the current cell's owner/property marker from the map tables.

`WORD_967c` and `WORD_968c` redraw the current map cell, with `VAR_84b3` acting as a mode flag:

- normal map-cell rendering when `VAR_84b3 = 0`
- survey/well-size rendering when `VAR_84b3 != 0`

This is one of the stronger confirmations that `VAR_84b3` is a survey-display mode flag.

## Destroy flow

`DESTROY?` (`CFA $9728`) checks the current cell and either:

- proceeds with destroy/update helpers,
- or prints `NOT YOUR PROPERTY!`

That gives a clean interpretation:

- move pointer,
- validate ownership,
- then apply the destroy action.

## Tank movement / combat prompt

`TANK-MOVE?` (`CFA $93b1`) and `TANK-BATTLE-PROMPT` (`CFA $93f5`) form the tank movement/combat UI.

Recovered strings:

- `TANK BATTLE STRENGTH = `
- `SELECT MOVEMENT DIRECTION`
- `OR <FIRE> TO CONTINUE`
- `TARGET SQUARE OCCUPIED`
- `<FIRE> TO CONTINUE`

Interpretation:

- if a target square is occupied, show collision/blocked message
- otherwise show current battle strength and ask for movement direction
- beep/acknowledge with the previously recovered SID helper

## Import tank flow

`IMPORT-TANK?` (`CFA $9fe6`) is the entry point for the tank-import action.

It compares:

- `VAR_8493`
- `VAR_8497`

and only enters the purchase prompt when the limit test passes.

`IMPORT-TANK-PROMPT` (`CFA $a040`) prints:

- `IMPORT NEW TANK?`

and then either:

- updates map/state through the import helpers,
- or exits quietly.

This makes the most likely variable interpretation:

- `VAR_8493` = current tank count
- `VAR_8497` = tank cap or import limit (`10` in all provided snapshots)

## Practical state variables used here

The map-action subsystem gives strong evidence for:

- `VAR_842f` = map cursor X-like coordinate
- `VAR_8433` = map cursor Y-like coordinate
- `VAR_84b3` = survey display mode flag
- `VAR_8493` = current tank count
- `VAR_8497` = tank cap / tank limit
