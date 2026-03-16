# Monthly loop model

This note collects the current best formal model of one in-game month.

It is deliberately more structural than the narrative notes in `museum_mode_notes.md`.

## High-level loop

The clearest driver found so far is:

```forth
: MAIN-LOOP?
loop:
  TURN-LOOP?
  BRANCH loop
;

: TURN-LOOP?
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
  POLLS-CHECK?
;
```

Best current reading of `TURN-LOOP?`:

1. show the monthly score/summary
2. run the map / oilfield / tank / survey phase
3. run contract offers and contract-sales summary
4. run the spot market
5. run food
6. run gold market
7. run imports
8. run health
9. advance month/year/election/disaster counters
10. show election countdown
11. show opinion polls and check popularity floor

## End-of-month summary chain

The summary wrapper is:

```forth
: TURN-SUMMARY?
  GAME-SCORE-FRAME
  SCORE-COMPUTE?
  GAME-SCORE-SCREEN
  POST-MONTH-ELECTION?
;
```

That means the game computes and displays score before entering the next month,
and only then branches into an election flow if the pending-election flag is set.

## Financial accumulator objects

Several `DOES>` objects around `$8407..$8560` behave like double-cell accumulators.

Current best readings:

- `DOES_8407`
  - current treasury / running national balance
  - evidence:
    - `BOP-SCREEN` prints `current - previous`
    - buying gold lowers it from `10000` to `9950` in `president_afterBuyingGold.vsf`
    - `WORD_b2ac` copies it into `DOES_840f` at end-of-report

- `DOES_840f`
  - previous-turn treasury / comparison baseline
  - evidence:
    - used with `DOES_8407` in `WORD_b182`
    - copied from `DOES_8407` by `WORD_b2ac`

- `DOES_8423`
  - current-month net balance-of-payments delta
  - evidence:
    - `BOP-SCREEN` computes it as `DOES_8407 2@ DOES_840f 2@ D-`
    - then prints it as `BALANCE OF PAYMENTS = K$ ...`

- `DOES_8530`
  - current-month income total
  - evidence:
    - `WORD_b1a2` builds it from:
      - `VAR_850c` oil contract income
      - `VAR_8510` spot-market income
      - `VAR_8514` gold sales income
    - `INCOME-EXPENDITURE` prints it as the total under `INCOME`

- `DOES_8538`
  - current-month expenditure total
  - evidence:
    - `WORD_b1a2` builds it from:
      - `VAR_8508` import costs
      - `VAR_84bf` health costs
      - `VAR_8518` gold purchase costs
    - `INCOME-EXPENDITURE` prints it as the total under `EXPENDITURE`

- `DOES_8558`
  - cumulative total balance of payments
  - evidence:
    - `SCORE-COMPUTE?` adds `DOES_8423` into it each month
    - `GAME-SCORE-SCREEN` prints it as `TOTAL BAL.OF.PAY = K$ ...`

- `DOES_8540`
  - running raw game-score accumulator
  - evidence:
    - `GAME-SCORE-HEADER` prints it as the numeric `GAME SCORE`
    - `SCORE-COMPUTE?` updates it with monthly contributions

- `DOES_8560`
  - running score numerator used for final U.N. judgement
  - evidence:
    - `SCORE-COMPUTE?` updates it each month
    - final rank `VAR_852c` is computed from `DOES_8560 / total_months`

## Monthly financial pipeline

The financial report path is:

```forth
: WORD_b0e0
  WORD_b1a2
  INCOME-EXPENDITURE
  WORD_b16a
  BOP-SCREEN
  WORD_b182
  WORD_b2ac
  WORD_b112
;
```

Best current reading:

1. `WORD_b1a2`
   - compute monthly income total into `DOES_8530`
   - compute monthly expenditure total into `DOES_8538`
2. `INCOME-EXPENDITURE`
   - print detailed breakdown and the monthly income/expenditure totals
3. `BOP-SCREEN`
   - compute `DOES_8423 = DOES_8407 - DOES_840f`
   - print `BALANCE OF PAYMENTS = K$ ...`
4. `WORD_b182`
   - compare current and previous treasury/balance
   - convert the sign of that change into a `+1` or `-1` opinion shift
5. `WORD_b2ac`
   - copy current treasury/balance into previous treasury/balance
6. `WORD_b112`
   - clear all monthly income/cost buckets and zero `DOES_8530` / `DOES_8538`

So the VM is explicitly carrying both:

- persistent running balance state
- one-month transient accounting buckets

## Score computation

`SCORE-COMPUTE?` is not fully named down to every sub-term, but its structure is now fairly clear:

```forth
: SCORE-COMPUTE?
  DOES_8558 2@ DOES_8423 2@ D+ DOES_8558 2!
  DOES_8540 2@ 0 DOES_85ea[0] M+ DOES_8540 2!
  ...
  DOES_8560 2@ D+ DOES_8560 2!
  DOES_8540 2@ D+ DOES_8540 2!
  DOES_8560 2@ total_months / ...
  0..199 clamp
  50 /
  VAR_852c !
;
```

Current best reading:

- `DOES_8558` accumulates the monthly net balance
- the first entry of `DOES_85ea` (`YOUR PARTY`) feeds into the running raw score
- additional clamped terms are derived from:
  - current treasury relative to an initial baseline
  - current gold stocks relative to required gold
- `DOES_8560` is the accumulator that ultimately determines the U.N. judgement rank
- `VAR_852c` is the final 4-step band:
  - `INCOMPETENT`
  - `A TYRANT`
  - `A GOOD LEADER`
  - `A GREAT RULER`

## Election / poll model

The poll table `DOES_85ea` now has strong evidence behind it:

- it is a 3-entry table
- baseline values are `50 / 25 / 25`
- later snapshots show live values such as `47 / 28 / 25` and `45 / 30 / 25`
- nearby labels identify the entries as:
  - `YOUR PARTY`
  - `MODERATE PARTY`
  - `EXTREMIST PARTY`

`POLLS-SCREEN` reads those percentages directly.

The helper `WORD_aee4` appears to apply a signed opinion shift:

- positive deltas call one redistribution helper
- negative deltas call the mirrored helper
- `WORD_b7a0` maps the main party index onto the other two indexes
- redistribution is clamped to the range `1..98`

So the current best reading is:

- the game stores a live 3-way support split,
- economic or gameplay outcomes perturb that split by signed increments,
- elections convert the poll table into regions won and a final pass/fail outcome.

## Failure conditions now visible

Recovered failure / pressure points include:

- hard bankruptcy
  - `YOUR NATION IS BANKRUPT!`

- softer currency crisis
  - `GOLD RESERVES USED-CURRENCY DEVALUED!`

- election loss
  - election result wrapper falls through into `GAME-OVER-LOOP`

- popularity floor
  - `POLLS-CHECK?` prints `YOUR PEOPLE HATE YOU!` when `YOUR PARTY < 10`

This means the run is pressured by both:

- macroeconomics
- and public support
