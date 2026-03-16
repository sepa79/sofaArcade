# One-screen port spec

This is a design spec for a new game inspired by `President`, not a direct 1:1 port.

The goal is:

- one main screen
- continuously presented UI
- underlying logic updated in weekly and monthly ticks
- a 20-30 minute high-score run
- clear separation from the original game's exact screen flow and wording

## Design direction

Keep the mechanical DNA:

- macroeconomic pressure
- public support pressure
- oilfield and map actions
- gold as a reserve / safety valve
- election pressure
- short score-attack structure

Change the presentation:

- no screen-by-screen report flow
- no direct text/menu reproduction
- one live map with a persistent HUD
- modern pause-driven decisions over a continuous-feeling simulation

## Core loop

The player governs a small unstable petro-state.

Time appears continuous, but the simulation runs in:

- weekly ticks
- monthly ticks

Weekly ticks handle:

- food consumption
- disease drift
- oil production
- maintenance / upkeep
- soft support shifts
- map-state updates

Monthly ticks handle:

- contract settlement
- spot-market sales
- import costs
- health costs
- gold buys / sells
- treasury update
- score update
- election countdown
- support floor checks

This preserves the rhythm recovered from the archaeology while making the UI feel modern.

## Main screen layout

### Center

Main strategic map:

- oilfields
- surveyed tiles
- rigs / infrastructure
- tank / security units
- damaged tiles / event markers
- regional shading or overlays

### Top bar

High-priority state:

- `Treasury`
- `Net`
- `Month`
- `Election`
- `Score`
- `Pause / Speed`

### Left panel

Persistent policy controls:

- `Food`
- `Health`
- `Oil`
- `Security`

These are the core sliders.

### Right panel

Action / market panel:

- `Contracts`
- `Spot Market`
- `Gold`
- `Survey`
- `Build`
- `Import Unit`

### Bottom panel

Low-latency feedback:

- support bars
- food status
- disease status
- oil output
- gold reserves
- recent event feed

## The 4 sliders

These should be the always-visible strategic controls.

### `Food`

Represents:

- emergency food imports
- distribution effort

Effects:

- raises food supply
- reduces unrest from shortages
- improves support when shortages are severe
- costs treasury continuously

### `Health`

Represents:

- healthcare spending
- disease prevention
- public sanitation / aid

Effects:

- reduces disease risk
- dampens health-related disasters
- improves support over time
- costs treasury continuously

### `Oil`

Represents:

- oilfield maintenance
- drilling efficiency
- survey / infrastructure support

Effects:

- improves output from active rigs
- reduces breakdown / underproduction risk
- improves long-term treasury growth
- costs treasury continuously

### `Security`

Represents:

- military / police readiness
- unit upkeep
- territorial control

Effects:

- supports tank / map actions
- reduces security-related losses
- can improve short-term stability
- too high can hurt support if overused
- costs treasury continuously

## Slider model

Use one shared allocation pool:

- all four sliders sum to `100%`

Example:

- `Food 30`
- `Health 25`
- `Oil 30`
- `Security 15`

This is cleaner than four unconstrained values and makes tradeoffs obvious.

If you want a softer version:

- let the total exceed `100%`
- but apply escalating treasury drain above the budget line

Recommended first version:

- hard total of `100%`

## Direct actions

Separate one-off actions from the persistent sliders.

### Contracts

Offer temporary deals:

- choose quantity
- choose duration
- accept / reject offer

Effects:

- creates future guaranteed income
- can starve the local economy if overcommitted

### Spot Market

Sell excess oil immediately.

Effects:

- instant cash
- reduces buffer
- can hurt future stability if overused

### Gold

Two actions:

- buy gold
- sell gold

Effects:

- gold acts as reserve protection
- helps absorb financial shocks
- overinvesting in gold harms liquidity

### Survey

Map action:

- reveal probable field quality on a tile

Effects:

- intel for later build decisions
- costs time / money

### Build

Map action:

- place a rig or expand an existing oil site

Effects:

- higher output
- more maintenance burden
- more exposure to disasters / sabotage

### Import Unit

Map action:

- add a tank / security unit

Effects:

- increases map control options
- raises upkeep
- can improve security outcomes

## Persistent state

Core stats always visible:

- `Treasury`
- `Net Monthly Balance`
- `Your Support`
- `Moderates`
- `Extremists`
- `Food Supply`
- `Disease Risk`
- `Oil Output`
- `Gold Reserves`
- `Election Timer`

## Support model

Use three support factions:

- `Your Bloc`
- `Moderates`
- `Extremists`

They should sum to `100`.

This is directly inspired by the recovered poll table, but renamed and reframed.

### Support pressure examples

Positive:

- food stable
- disease low
- treasury improving
- contracts producing income
- gold reserves intact during crisis

Negative:

- shortages
- disease spikes
- falling treasury
- forced devaluation
- excessive security spending

## Time and pacing

Recommended pacing:

- 1 in-game week every 3-5 real seconds on normal speed
- pause at any time
- optional speed levels:
  - `Pause`
  - `1x`
  - `2x`
  - `4x`

Monthly resolution should feel important.

At each month boundary:

- show a compact summary ribbon
- briefly highlight score delta
- flash major support and treasury changes
- surface contract and market outcomes

Do not interrupt with a modal screen unless the player pauses or a major event fires.

## Failure states

Use four main failure pressures:

### Financial collapse

- treasury too low
- no reserve left to stabilize

Result:

- run ends

### Reserve-triggered devaluation

- treasury crisis absorbed by spending gold reserves

Result:

- not instant failure
- support hit
- treasury penalty
- future instability increase

### Election loss

- election occurs while your bloc is too weak

Result:

- run ends

### Popularity collapse

- `Your Bloc < 10%`

Result:

- run ends or enters a final warning state

Recommended first version:

- make this a hard fail, because it is simple and consistent with the archaeology

## Elections

Recommended cadence:

- one election every 24 monthly ticks

This mirrors the recovered `2 years x 12 months` structure.

Election result should depend on:

- current support split
- recent treasury trend
- food and health stability
- event penalties

Keep it legible:

- show forecast in HUD
- show countdown in months
- give a visible danger threshold as elections approach

## Score model

The final score should combine:

- months survived
- treasury health
- cumulative net balance
- support strength
- oil output growth
- reserve management quality

Recommended final bands:

- `Disaster`
- `Strongman`
- `Competent`
- `Legend`

This deliberately avoids copying the original text while preserving the structure of ranked end states.

## Minimal first playable

For a v0 prototype, implement only:

- one map
- the 4 sliders
- support bars
- treasury / net / election / score
- actions:
  - `Contracts`
  - `Gold`
  - `Survey`
  - `Build`
- weekly and monthly ticks
- failures:
  - bankruptcy
  - election loss
  - support below 10

You can defer:

- tanks
- combat
- richer disasters
- complex import categories
- advanced event chains

## Why this version is safer

This direction is legally and creatively safer because it is:

- inspired by the original structure
- not a direct replica of screen flow
- not reusing original wording as core UX
- not preserving the original interface layout
- not depending on one-to-one script recovery for player-facing presentation

It uses the archaeology as:

- mechanical reference
- pacing reference
- systemic reference

not as a blueprint for a clone.
