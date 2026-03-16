# High-memory screen scripts

The first-pass archaeology focused on the main dictionary and runtime around `$4000..$8000`.

That was enough to recover the VM model, but it turned out not to be enough for actual screen flows.

There are also threaded screen scripts living much higher in RAM, often without normal dictionary headers.
They can still be found by scanning for raw `DOCOL` CFA cells.

## Why this matters

This is the first point where the archaeology stops being "just runtime internals" and starts becoming recognizably game-facing.

Recovered examples now include:

- map navigation loop
- `IMPORTS` screen
- `BALANCE OF PAYMENTS` display block
- `OPINION POLLS` display block
- `HEALTH` screen
- gold-market related screens (`BUY REQUIRED GOLD?`, `SELL GOLD?`, stock/price summaries)
- `INCOME / EXPENDITURE` report
- `OIL CONTRACTS` and `SPOT MARKET` flows

## Map control loop

`WORD_5aa6` is now a strong candidate for the main map-navigation loop:

```forth
: WORD_5aa6
  ...
  WORD_5b7c          \ redraw / recompute visible state
loop:
  WORD_5b20          \ read one command
  0BRANCH loop
;
```

`WORD_5b20` dispatches on:

- `Q`
- `S`
- `I`
- `P`
- `RETURN`

and routes them to movement/update helpers:

- `WORD_5adc`
- `WORD_5aee`
- `WORD_5afe`
- `WORD_5b10`

This looks much more like map navigation than a text menu.

## `IMPORTS` screen

Raw high-memory script at `CFA $bd32` decompiles into a readable screen renderer:

```forth
: WORD_bd32
  WORD_bd02
  0 15 AT-XY?  DOES_74f9("IMPORTS") TYPE
  CR
  ...
  DOES_750f("MILITARY HARDWARE") TYPE
  ...
  DOES_73c0("FOOD") TYPE
  ...
  DOES_753a("TOTAL VALUE") TYPE
  DOES_754a("TOTAL COST") TYPE
  DOES_7559("100X(TOTALVALUE)/(CUR.VAL.INDEX)") TYPE
  ...
;
```

Companion word `WORD_bd02` computes the totals for that screen:

```forth
: WORD_bd02
  VAR_84fb @
  VAR_84f7 @
  VAR_8500 @
  +
  +
  VAR_8504 !
  100 VAR_8504 @ WORD_4982
  VAR_84f3 @ /MOD?
  SWAP DROP
  VAR_8508 !
;
```

Interpretation:

- sum three import-related values into `VAR_8504`
- compute a percentage-like derived value into `VAR_8508`
- render the whole report screen from those variables

## `BALANCE OF PAYMENTS`

High-memory script `CFA $b0f4` renders a compact balance display:

```forth
: WORD_b0f4
  DOES_8407 ... WORD_45f7
  DOES_840f ... WORD_45f7
  WORD_611a
  DOES_8423 ... WORD_4605
  DOES_723a("BALANCE OF PAYMENTS = ") TYPE
  DOES_7959("K$ ") TYPE
  DOES_8423 ... WORD_57f8
;
```

`WORD_611a` is:

```forth
: WORD_611a
  DNEGATE
  D+
;
```

So this screen is assembling a signed net result and then printing it.

There is a mirrored copy at `CFA $edae`, which suggests data duplication or a second bank/phase rather than an unrelated word.

## `OPINION POLLS`

High-memory script `CFA $88b3` prints the `OPINION POLLS` title and then iterates through entries:

```forth
: WORD_88b3
  1 WORD_5e28
  DOES_7279("OPINION POLLS") TYPE
  WORD_5e1c
  3 0 2>R?
loop:
  WORD_5e1c
  WORD_510e
  R>
  DOES_872a(...) WORD_576c
  20 WORD_5e28
  R>
  DOES_85ea(...) @
  3 WORD_4ee2
  DOES_7961(...) TYPE
  LOOP?
;
```

The helper tables behind `DOES_872a` and `DOES_85ea` are not named yet, but the shape is already clear:

- print row label
- fetch associated value
- print value with a fixed width

## `HEALTH`

High-memory script `CFA $ac62` is a readable `HEALTH` screen builder:

```forth
: WORD_ac62
  WORD_ae7c
  0 17 AT-XY?  DOES_7175("HEALTH") TYPE
  2CR 2CR
  11 WORD_55c1
  DOES_7180("DISEASE RISK LEVELS") TYPE
  ...
  WORD_acb6
  ...
  WORD_87cf
;
```

The helper `WORD_acb6` prints the four disease rows:

- `CHOLERA`
- `TYPHOID`
- `MALARIA`
- `LEPROSY`

and then shows a trailing line:

- `ON HEALTH AID`

There is also a separate text object:

- `TOTAL HEALTH EXPENDITURE = `

which strongly suggests the bottom of this flow is:

- show current disease-risk levels
- accept or update spending
- print total health expenditure

## Gold-market cluster

The gold flow is split across several high-memory scripts rather than one neat single screen word.

Confirmed pieces:

- `WORD_aa20`
  - prints `BUY REQUIRED GOLD?`
  - branches depending on confirmation / validation helpers
- `WORD_aa88`
  - prints `SELL GOLD?`
  - clamps an entered amount and updates several totals
- `WORD_a842`
  - prints `GOLD PRICE = K$ ... PER BAR`
- `WORD_a87a`
  - prints `GOLD STOCKS = ... BARS`
- `WORD_a8aa`
  - prints `AVG. STOCK COST = K$ ... PER BAR`
- `WORD_a7d4`
  - computes `required_gold - current_gold`
- `WORD_a7e6`
  - multiplies that delta by the current price
- `WORD_a7f6`
  - prints a cost summary:
    - `COST OF REQUIRED`
    - `GOLD AT`
    - either `CURRENT` or `PURCHASE`
    - `PRICE =`
    - `K$ ...`

This suggests the `GOLD MARKET` screen is assembled from several smaller threaded blocks:

- title / frame,
- current price,
- current stock holdings,
- average stock cost,
- buy/sell confirmation prompts.

The title object `GOLD MARKET` is present in RAM, but in the current baseline snapshot its direct threaded reference has not yet been pinned down.

That means the gold screen is now functionally understood even if the exact title-wrapper call site remains unresolved.

## `FOOD`

High-memory script `CFA $bad2` is a readable `FOOD` screen builder:

```forth
: WORD_bad2
  WORD_5014
  ...
  2 17 AT-XY?  DOES_73c0("FOOD") TYPE
  6 1  AT-XY?  12 WORD_55c1  DOES_7383("SUPPLIES") TYPE
  22 WORD_55c1 DOES_7390("DEMAND") TYPE
  WORD_bb4a
  ...
  loop:
    WORD_baaa
  ...
;
```

The row helper `WORD_baaa` prints a label and two numeric fields for each food category:

```forth
: WORD_baaa
  1 WORD_5e28
  DUP DOES_874e(...) WORD_576c
  DOES_796d("=") TYPE
  ...
  DOES_85f6(...) WORD_57ee
  ...
  DOES_8602(...) WORD_57ee
;
```

Interpretation:

- print one food-category label
- print `SUPPLIES`
- print `DEMAND`

So `FOOD` is now in the same bucket as `HEALTH` and `IMPORTS`: a real recovered screen, not just a string.

## `INCOME / EXPENDITURE` report

High-memory script `CFA $b20c` is a broad financial summary screen:

```forth
: WORD_b20c
  WORD_b1e2
  CR
  ...
  DOES_77a4("INCOME") TYPE
  DOES_77c9("OIL CONTRACTS") TYPE
  ...
  DOES_70b9("SPOT MARKET") TYPE
  ...
  DOES_70c9("GOLD") TYPE
  DOES_6d34("SALES") TYPE
  ...
  DOES_77af("EXPENDITURE") TYPE
  DOES_77db("IMPORT COSTS") TYPE
  DOES_77ec("HEALTH COSTS") TYPE
  DOES_77fd("GOLD PURCHASES") TYPE
  ...
;
```

This is effectively the report that ties together several other recovered subsystems:

- oil contracts
- spot-market sales
- gold
- import costs
- health costs

So by this point the archaeology is no longer about isolated screens.
It is beginning to expose the real monthly economic model.

## `OIL CONTRACTS` and `SPOT MARKET`

High-memory script `CFA $a2d6` is a contract-list screen:

```forth
: WORD_a2d6
  ...
  0 1 AT-XY?  DOES_6fee("CONTRACTS:") TYPE
  2 1 AT-XY?  DOES_6d27("COUNTRY:") TYPE
  ...
  DOES_6cf0(" KILOBARRELS") TYPE
  DOES_7959("K$ ") TYPE
  DOES_7944("MONTHS") TYPE
  ...
;
```

This looks like the scrolling contract-offer table, with per-row values for:

- country
- amount
- unit price
- duration

Related screens/helpers:

- `WORD_a47e`
  - confirmation/result banner
  - prints either `----CONTRACT SIGNED----` or `+++CONTRACT REJECTED+++`
- `WORD_a5de`
  - totals screen for contract sales
  - prints `CONTRACT SALES =`, amount in kilobarrels, and `TOTAL INCOME = K$ ...`
- `WORD_a670`
  - entry/helper for the `SPOT MARKET` flow
  - branches into another screen only when stock is available

So the oil economy side is now visible as:

- offer list,
- accept/reject flow,
- sales summary,
- separate spot-market selling path.

## Elections and presidency flow

High-memory script `CFA $c238` is now a strong election-status block:

```forth
: WORD_c238
  2 VAR_843b @ * VAR_84c3 @ - VAR_8528 !
  ...
  VAR_851c @
  0BRANCH next-election
  DOES_78b9("ELECTION COMING UP!......") TYPE
  BRANCH done
next-election:
  DOES_7731("NEXT ELECTION IN ") TYPE
  VAR_8528 ... DOES_7944("MONTHS") TYPE
done:
  WORD_b0e0
  WORD_8857
;
```

Interpretation:

- `VAR_84c3` is a month-style election-cycle counter
- `VAR_8528` is a derived countdown in months
- `VAR_851c` flips the text between:
  - `NEXT ELECTION IN ... MONTHS`
  - `ELECTION COMING UP!......`
- the low-level cadence now looks much clearer:
  - `VAR_843b` is initialized to `12`, and the helper at `$4625` is just `1-`
  - monthly advance compares `VAR_84cf > (12 - 1)`, so one game year is twelve monthly turns
  - election advance compares `VAR_84c7 > (2 - 1)`, so a term appears to last two in-game years

When the election actually fires, `CFA $b374` drives the wrapper flow:

```forth
: WORD_b374
  0 VAR_851c !
  ...
  WORD_b3b2
  WORD_b614
  0BRANCH lost
  WORD_b39c
  BRANCH done
lost:
  WORD_bee4
done:
  EXIT?
;
```

So this path:

- clears the election-pending flag,
- renders the election result table,
- tests a win/lose condition,
- either shows `NEW PRESIDENCY` or drops into the game-over loop.

The result table itself is a real recovered screen script at `CFA $b3bc`:

```forth
: WORD_b3bc
  ...
  DOES_726c("ELECTION") TYPE
  ...
  DOES_74ce("REGION") TYPE
  DOES_74d9("THIS REGION") TYPE
  DOES_74e9("REGIONS WON") TYPE
  ...
;
```

That is already enough to describe a Museum Mode story beat:

- monthly/term counters advance in the background,
- the game warns when an election is near,
- then switches into a region-by-region election report.

The election subsystem now also has some real data-model shape:

- `DOES_85ea(...)` is a 3-entry table used by both:
  - `POLLS-SCREEN`
  - the election simulation words around `$b48a..$b614`
- its baseline values are `50 / 25 / 25`
- later snapshots show it moving to `47 / 28 / 25` and `45 / 30 / 25`
- the party labels recovered from nearby text objects are:
  - `YOUR PARTY`
  - `MODERATE PARTY`
  - `EXTREMIST PARTY`

That makes the reading much stronger:

- `85ea` is the current opinion-poll / vote-share table,
- `863e` is a strong candidate for the election result / regions-won accumulator table used during the tally,
- and the election code converts those percentages into a result table and win/loss test.

## `GAME SCORE` and end-of-run summary

The score path is now fairly well exposed.

`CFA $b988` is the header block:

```forth
: WORD_b988
  ...
  1 13 AT-XY?
  DOES_72c1("GAME SCORE") TYPE
  3 15 AT-XY?
  DOES_8540(...) WORD_57f8
  CR
;
```

`CFA $b9ec` is the actual end-of-run report:

```forth
: WORD_b9ec
  ...
  DOES_7703("THE U.N. THINK YOU ARE ") TYPE
  VAR_852c @ DOES_8760(...) WORD_576c
  ...
  DOES_72d0("LENGTH OF DYNASTY =") TYPE
  VAR_84cb ...
  DOES_794f("YEARS") TYPE
  VAR_84cf ...
  DOES_7944("MONTHS") TYPE
  ...
  DOES_6d27("COUNTRY:") TYPE
  VAR_84e3 @ DOES_8776(...) WORD_576c
  ...
  DOES_72e8("TOTAL BAL.OF.PAY = ") TYPE
  DOES_7959("K$ ") TYPE
  DOES_8558(...) WORD_57f8
;
```

The two key lookup tables are now understandable enough to name semantically:

- `DOES_8760(...)`
  - `INCOMPETENT`
  - `A TYRANT`
  - `A GOOD LEADER`
  - `A GREAT RULER`
- `DOES_8776(...)`
  - `POOR`
  - `MEDIUM`
  - `WEALTHY`

So the score screen combines:

- a U.N. judgement/rank,
- dynasty length in years and months,
- country class,
- total balance of payments.

The score-computation helper behind this, `CFA $b888`, is not fully named yet, but its shape is already useful:

- it updates cumulative double-cell totals with `2@` / `2!`
- it clamps several sub-scores into bounded ranges
- it folds in dynasty length as `years * 12 + months`
- it finally scales the result down into `VAR_852c`, which selects the U.N. rank string

So the current best reading is that the game stores running monthly score components and converts their average-ish combined value into the final four-step judgement.

The wrapper `CFA $bee4` is the end-of-game loop:

```forth
: WORD_bee4
  WORD_b9c0
  WORD_b9ec
  DOES_771f("ANOTHER GAME?") TYPE
  ...
  0BRANCH quit
  WORD_bf04
quit:
  PRIM_60ed
;
```

That makes the whole end-run flow explicit:

- draw score frame,
- print final judgement,
- ask `ANOTHER GAME?`,
- either reset state or exit.

## Bankruptcy versus devaluation

One especially useful discovery is that the financial-collapse path is not a single fail state.
It splits cleanly in two.

`CFA $be20` decides which branch to take:

```forth
: WORD_be20
  VAR_84eb @ VAR_849f @ WORD_4982
  DOES_8407 ... D+
  WORD_8909 WORD_58f2 WORD_58b2
  0BRANCH devalue
  WORD_be46
  BRANCH done
devalue:
  WORD_be6c
done:
  EXIT?
;
```

Interpretation:

- compute some currency/balance shortfall,
- compare it against gold reserves,
- either fall into a hard bankruptcy path,
- or consume reserves and devalue the currency instead.

Hard failure is `CFA $be46`:

- `YOUR NATION IS BANKRUPT!`
- `YOU HAVE BEEN FORCED TO RESIGN`
- `AND IMPRISONED ON CORRUPTION CHARGES!`
- then into `GAME-OVER-LOOP`

The softer failure is `CFA $be6c`:

- computes how much gold must be consumed,
- reduces `VAR_84eb` (`GOLD STOCKS`)
- updates the running balance object,
- prints:
  - `GOLD RESERVES USED-CURRENCY DEVALUED!`
  - `GOLD STOCKS = ... BARS`
- then continues via the regular post-event/report path

So for a modern port this is a concrete design detail, not just flavour text:

- financial collapse can be partially absorbed by gold reserves,
- but only up to a limit,
- after that the player is simply removed.

## Earthquake event and new-game reset

The earthquake notification block is now recovered at `CFA $bf0c`:

```forth
: WORD_bf0c
  ...
  DOES_7810("EARTHQUAKE HITS OILFIELDS-") TYPE
  DOES_782f("-- NO SURFACE DAMAGE --") TYPE
  DOES_784b("CHECK WELLS FOR CHANGES") TYPE
  WORD_bf30
  WORD_8857
;
```

The scheduling hook is visible in `CFA $b860`:

```forth
: WORD_b860
  VAR_84d3 @
  45 +
  10 WORD_5828 +
  VAR_84d3 !
  WORD_bf0c
;
```

Conservative interpretation:

- `VAR_84d3` is a disaster threshold / next-earthquake marker,
- after an earthquake it is pushed forward by roughly `45 + random(10)`,
- then the earthquake event screen is shown.

The reset chain behind `ANOTHER GAME?` is now also visible:

```forth
: WORD_bf04
  WORD_bf5a
  WORD_4dac
;

: WORD_bf5a
  WORD_bf6a
  WORD_bfc6
  WORD_c01e
  WORD_c06e
  WORD_c0bc
  WORD_c132
;
```

Those reset blocks reinitialize distinct parts of game state:

- economy / balances / reserves
- prices
- political counters
- trade values
- score / summary objects
- world and map defaults

So the game-over loop does not merely jump back to the title.
It appears to rebuild a fresh world state in ordered subsystems.

## Main monthly loop

The higher-level turn structure is now visible too.

`CFA $c29a` looks like fresh-game initialization:

```forth
: WORD_c29a
  RESET-STATE?
  ...
  WORD_b112
  WORD_c2ca
;
```

and `CFA $c2ca` is just an infinite driver around `CFA $c2e0`:

```forth
: WORD_c2ca
loop:
  WORD_c2e0
  BRANCH loop
;
```

The turn body itself is now readable:

```forth
: WORD_c2e0
  TURN-SUMMARY?
  WORD_8d6f
  WORD_a14e
  SPOT-MARKET?
  WORD_ba68
  WORD_a78a
  WORD_bcca
  WORD_ab6e
  MONTH-ADVANCE?
  ELECTION-COUNTDOWN
  WORD_af04
;
```

Best current reading of those phases:

- monthly score / summary screen
- map / oilfield / tank / survey phase
- contract-offer and contract-sales phase
- spot market
- food screen
- gold market
- imports screen
- health screen
- advance time counters
- election countdown / possible election trigger
- opinion-poll screen and popularity check

So the game structure is no longer hypothetical.
The threaded VM is clearly running a compact month-loop.

## Popularity floor and another non-financial failure state

The opinion-poll wrapper at `CFA $af04` does more than just display percentages:

```forth
: WORD_af04
  ...
  POLLS-SCREEN
  0 DOES_85ea(...) @
  10 <
  0BRANCH ok
  DOES_7220("YOUR PEOPLE HATE YOU!") TYPE
ok:
  WORD_8857
;
```

So there is another explicit failure pressure besides pure finance:

- if `YOUR PARTY` support drops below `10%`,
- the game raises the `YOUR PEOPLE HATE YOU!` warning/failure path.

This fits very neatly with the election subsystem already recovered from the same `85ea` poll table.

## `PRESS PLAY ...` prompts

High-memory script `WORD_6156` is not economy logic.
It is a media/input prompt:

- positions cursor
- prints `PRESS PLAY THEN ANY KEY`
- loops while building a one-character response buffer

And `WORD_6122` is the sibling prompt:

- `PRESS PLAY AND REC THEN ANY K...`

So not everything in this region is gameplay.
Some of it is save/load or tape/disk UX.
