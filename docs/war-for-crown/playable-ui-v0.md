# War for Crown Playable UI v0

This document defines the first player-facing UI pass. It replaces the current
debug-style control surface with a turn-state interface.

## Problems To Fix

- The UI must not show a free-troop or reserve pool. The simple C64-target
  ruleset places the configured starting soldiers directly in the home province.
- The player must not see a generic `NEXT STEP` command. The button label must
  name the current turn transition.
- The start of the match must be explicit. During home selection the main state
  is `P1: WYBIERZ STOLICE` or `P2: WYBIERZ STOLICE`.
- The side panel must not show every command at once. It shows commands for the
  current step only.

## Turn-State Copy

Home selection:

- title: `WYBOR STOLICY`
- instruction: `Kliknij neutralna prowincje dla P1.`
- primary command: disabled until the required homes are selected

New month:

- title: `NOWY MIESIAC`
- instruction: show month/year, weather, income, and event summary in one overlay
- primary command: click overlay / `DALEJ`

Attack:

- title: `ATAK`
- instruction: `Kliknij cel, potem wybierz swoje sasiednie prowincje.`
- primary command: `KONIEC ATAKU`

Movement:

- title: `RUCH`
- instruction: `Przesun wojsko miedzy swoimi prowincjami.`
- primary command: `KONIEC RUCHU`

Investment:

- title: `BUDOWA`
- instruction: `Buduj w wybranej prowincji albo najmij wojsko.`
- primary command: `KONIEC TURY`

Game over:

- title: `KONIEC GRY`
- primary command: restart through `NOWA MAPA` / `RESTART`

## Command Visibility

- `NAJMIJ` is shown only during `investment`.
- Province build commands are shown only during `investment` and only for a
  selected owned province.
- Attack commands are shown only during `ATAK` after selecting a target and at
  least one valid source province.
- Movement commands are shown only during `movement` and only after selecting an
  owned source province and another owned target province.
- The footer has one contextual primary turn command. The previous separate
  `END TURN` button is not part of this UI slice.

The scene may compute button visibility and enabled state for presentation. The
game API remains the final validator for action legality.
