# Variable map for the 84xx/85xx cluster

This note records the first defensible names for the `84xx/85xx` variables.

The standard used here is conservative:

- only name a variable when a recovered screen or action flow gives strong evidence,
- otherwise leave it tentative with `?`.

All values below refer to the variable body at `CFA+2`, not the `DOVAR` CFA itself.

## Map / action variables

- `VAR_842f` - map cursor X-like coordinate
  - evidence:
    - initialized in `MAP-MENU?`
    - read by pointer-placement and survey/tile-render helpers
    - value changes between map-oriented snapshots

- `VAR_8433` - map cursor Y-like coordinate
  - same evidence as `VAR_842f`

- `VAR_84b3` - survey display mode flag
  - evidence:
    - explicitly cleared at map-menu start
    - set by `SURVEY-MAP?`
    - switches `WORD_968c` between normal and survey rendering
  - observed:
    - `1` in `president_map_tankBought_surveyMode.vsf`

- `VAR_8493` - current tank count
  - evidence:
    - compared against `VAR_8497` in `IMPORT-TANK?`
    - increments around tank-import flows

- `VAR_8497` - tank cap / tank import limit
  - evidence:
    - constant `10` across all snapshots
    - used only in tank-import limit logic

## Gold-market variables

- `VAR_849f` - gold price per bar
  - evidence:
    - printed by `GOLD-PRICE-SCREEN`
  - observed:
    - `0x0032 = 50`

- `VAR_84a7` - required gold amount
  - evidence:
    - used with the current stock variable in the required-gold cost path
    - participates in `gold delta` logic before purchase

- `VAR_84ab` - gold bars to buy
  - evidence:
    - added directly into `VAR_84eb` after confirming `BUY REQUIRED GOLD?`
    - used as the multiplicand for `price * bars`

- `VAR_84af` - gold pricing mode flag
  - evidence:
    - selects between `CURRENT` and `PURCHASE` in the gold cost summary

- `VAR_84e7` - average stock cost of held gold
  - evidence:
    - printed by `AVG-GOLD-COST-SCREEN`

- `VAR_84eb` - gold stocks (bars held)
  - evidence:
    - printed by `GOLD-STOCKS-SCREEN`
    - incremented by `gold bars to buy`

- `VAR_8518` - gold purchase costs
  - evidence:
    - updated by the buy-gold flow
    - displayed in the `INCOME / EXPENDITURE` report under expenditure

- `VAR_8514` - gold sales income
  - evidence:
    - displayed under `INCOME` in the same report as `GOLD` `SALES`

## Import / expenditure variables

- `VAR_84f3` - currency value index
  - evidence:
    - used as the denominator in the `IMPORTS` formula
    - shown elsewhere as `CURRENCY VALUE INDEX =`
  - observed:
    - `100` in baseline snapshot
    - `103` after gold-buying / later-turn snapshots

- `VAR_84fb` - oil production equipment imports
  - evidence:
    - printed by `IMPORTS-SCREEN` next to `OIL PRODUCTION EQUIP.`

- `VAR_84f7` - military hardware imports
  - evidence:
    - printed by `IMPORTS-SCREEN` next to `MILITARY HARDWARE`

- `VAR_8500` - food imports
  - evidence:
    - printed by `IMPORTS-SCREEN` next to `FOOD`

- `VAR_8504` - total import value
  - evidence:
    - computed by `WORD_bd02` as the sum of import categories
    - displayed as `TOTAL VALUE`

- `VAR_8508` - total import cost
  - evidence:
    - computed by `WORD_bd02` as `100 * total_value / currency_value_index`
    - displayed in the `IMPORTS` screen as the formula result
    - reused in `INCOME / EXPENDITURE` under `IMPORT COSTS`

- `VAR_84bf` - health costs
  - evidence:
    - displayed directly in `INCOME / EXPENDITURE` next to `HEALTH COSTS`

## Election / score / disaster variables

- `VAR_84c3` - election-cycle month counter
  - evidence:
    - incremented by `ADVANCE-MONTH?`
    - used by `ELECTION-COUNTDOWN` to compute `NEXT ELECTION IN ... MONTHS`
    - reset when the election cycle rolls over
  - current best reading:
    - it rolls inside a two-year term built from twelve monthly turns per year

- `VAR_84c7` - years-since-election / term-year counter
  - evidence:
    - incremented by `ADVANCE-YEAR?`
    - when it crosses its threshold, the game sets `VAR_851c`
    - reset when the election wrapper starts
  - current best reading:
    - the threshold is `2`, so elections appear to happen every two in-game years

- `VAR_84cb` - dynasty years
  - evidence:
    - incremented by `ADVANCE-YEAR?`
    - printed by `GAME-SCORE-SCREEN` next to `LENGTH OF DYNASTY =`
    - shown with the literal label `YEARS`

- `VAR_84cf` - current dynasty year month counter
  - evidence:
    - incremented monthly by `ADVANCE-MONTH?`
    - reset when `ADVANCE-YEAR?` rolls the year
    - printed by `GAME-SCORE-SCREEN` next to `MONTHS`
  - current best reading:
    - `VAR_843b = 12`, so one game year appears to be twelve monthly turns

- `VAR_84d3` - next-earthquake threshold / disaster schedule marker
  - evidence:
    - initialized to `25`
    - compared against the advancing dynasty counter
    - after an earthquake, `EARTHQUAKE-TRIGGER?` adds `45 + random(10)` and stores it back

- `VAR_84e3` - country wealth class
  - evidence:
    - printed by `GAME-SCORE-SCREEN` after `COUNTRY:`
    - indexes a recovered table containing:
      - `POOR`
      - `MEDIUM`
      - `WEALTHY`
  - observed:
    - baseline snapshot starts at `2`, which fits the third table entry

- `VAR_851c` - election pending flag
  - evidence:
    - set when the term counter rolls over
    - read by `ELECTION-COUNTDOWN`
    - cleared by `ELECTION-RESULTS?`
    - read by the post-month wrapper that decides whether to enter the election flow

- `VAR_8528` - months until next election
  - evidence:
    - explicitly written by `ELECTION-COUNTDOWN`
    - printed immediately after `NEXT ELECTION IN `
  - observed:
    - `23` in `president_turn2.vsf`

- `VAR_852c` - U.N. judgement / score rank
  - evidence:
    - printed by `GAME-SCORE-SCREEN` after `THE U.N. THINK YOU ARE `
    - indexes a recovered table containing:
      - `INCOMPETENT`
      - `A TYRANT`
      - `A GOOD LEADER`
      - `A GREAT RULER`
  - observed:
    - `3` in `president_turn2.vsf`
  - current best reading:
    - this is the final scaled rank, not a raw score accumulator
    - the accumulator logic lives in `SCORE-COMPUTE?`

## Income variables

- `VAR_850c` - oil contract income
  - evidence:
    - displayed under `INCOME` next to `OIL CONTRACTS`

- `VAR_8510` - spot-market income
  - evidence:
    - displayed under `INCOME` next to `SPOT MARKET`

## Contract / oil-sales variables

- `VAR_844b` - contract sales amount (kilobarrels)
  - evidence:
    - accumulated in `CONTRACT-SALES-SUMMARY`
    - printed next to `CONTRACT SALES =` and `KILOBARRELS`

- `VAR_844f` - contract sales income
  - evidence:
    - accumulated in the same summary word
    - printed next to `TOTAL INCOME = K$`

- `VAR_8457` - spot-market availability flag or aggregate stock-available flag
  - evidence:
    - `SPOT-MARKET?` ORs ten per-entry values and then ORs `VAR_8457`
    - used only as a gate into the selling flow
  - still slightly tentative:
    - exact meaning could be `any stock in storage` rather than a pure boolean

## Snapshot sanity checks

Observed values line up well with the recovered screen semantics.

Examples:

- `president_afterBuyingGold.vsf`
  - `VAR_84e7 = 50`
  - `VAR_84eb = 1`
  - `VAR_8518 = 50`
  - `VAR_84f3 = 103`

- `president_afterFoodScreen.vsf`
  - `VAR_84fb = 50`
  - `VAR_84f7 = 50`
  - `VAR_8500 = 20`

- `president_map_tankBought_surveyMode.vsf`
  - `VAR_84b3 = 1`
  - cursor values differ from the baseline map position

## Open questions

Still worth revisiting later:

- whether `VAR_84a7` is strictly `required gold` or a more general target/threshold amount
- whether `VAR_84af` is a boolean `purchase-vs-current price` selector or a slightly richer state code
- whether `VAR_8457` is a true boolean or a cached stock-total indicator
- the exact election cadence implied by `VAR_84c3`, `VAR_84c7`, and the still-unnamed compare helper used in those paths
