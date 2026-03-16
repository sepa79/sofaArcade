# Rolnik / Sofa Arcade — Design SSOT

## Purpose

This document is the single source of truth for the **v1 playable design**.

If another Rolnik document says something different:

- this document wins
- implementation should follow this document
- older documents should be treated as supporting context only

---

## V1 core loop

The game is a local multiplayer farm strategy game for **2 to 4 players**.

Each player:

- manages a farm
- plants crops
- keeps animals
- upgrades buildings
- sells crop goods through tenders
- sells livestock in Summer Trade
- competes for land in the annual auction

The intended match rhythm is still **seasonal / turn-based**.

### Calendar status

The calendar model is **not fully locked yet**.

Current SSOT:

- the game uses a repeating seasonal cycle
- Summer contains:
  - material purchase
  - livestock sale
  - 3 AI crop tenders
- the annual land auction happens at the end of the year

Open design decision:

- whether the final runtime model uses **4 quarters**
- or a more general **season model** with harvest in Summer and at the end of Winter

Until that is finalized, implementation should keep the calendar logic isolated in one module.

---

## Crop catalog SSOT

The only v1 crop goods are:

- `grain`
- `potatoes`
- `roots`
- `hay`

Rules:

- remove `peas / groch` from v1
- do not split grain into separate runtime goods for spring and autumn
- `meadow` is not a market good
- `meadow` is a field state that can produce:
  - `hay`
  - `pasture`

### Field use

Fields can be assigned to:

- `grain`
- `potatoes`
- `roots`
- `meadow`

### Meadow rule

`Meadow` is a field mode.

It can be used as:

- `hay`
- `pasture`

`Pasture` is only for cows.

`Hay` is the stored trade/feed good.

---

## Goods and units SSOT

The runtime economy needs explicit units.

Use these v1 units:

| Good | Runtime unit |
|---|---|
| `grain` | 1 storage unit |
| `potatoes` | 1 storage unit |
| `roots` | 1 storage unit |
| `hay` | 1 storage unit |
| `wood` | 1 material unit |
| `stone` | 1 material unit |
| `milk` | 1 production unit |
| `eggs` | 1 egg |
| `cow` | 1 animal |
| `chicken` | 1 animal |
| `pig` | 1 kg live weight for price calculation, but ownership stays per animal |

### Trade rule

`Buy Orders` and `Tenders` always operate on:

- one `goodId`
- one `quantity`
- one unit price

Examples:

- `grain x20`
- `hay x12`
- `wood x10`

For pigs:

- inventory tracks pigs as animals
- market price uses `total live weight x pig price per kg x quality modifier`

This is the minimum explicit model needed to keep trade, storage, and pricing coherent.

---

## Buildings SSOT

The building system in v1 uses **real buildable farm buildings**.

These are not only menu abstractions.

### Main player-facing menu buckets

The high-level farm UI should expose:

- `Uprawy`
- `Zwierzeta`
- `Dom / Koniec tury`

These are navigation sections.
They are **not** the full building list.

### Runtime building catalog

The buildable v1 building set is:

- `house`
- `cow-barn`
- `pig-pen`
- `coop`
- `granary`
- `root-storage`
- `hay-barn`
- `machinery-shed`
- `mill`
- `fries-kitchen`
- `sugar-works`
- `feed-mill`
- `cheese-dairy`
- `sausage-house`
- `fast-food-outlet`

Older supporting docs may still call these:

- `potato-processing` -> `fries-kitchen`
- `Los Pollos Hermanos` -> `fast-food-outlet`

### Building slot rule

The farm has:

- `5` building slots total

Rules:

- one placed building uses one slot
- a building level upgrade **does** consume a new slot
- the same building going from `L1` to `L2` to `L3` consumes additional slots over time
- fields do not count as building slots
- `house` is part of the farm and does not consume one of the 5 optional build slots

Example:

- `cow-barn L1` uses 1 slot
- upgrading it to `cow-barn L2` consumes a second slot
- upgrading it to `cow-barn L3` consumes a third slot

### Specialization rule

The farm can have:

- exactly `1` specialization building total in v1

That means:

- not `1 animal specialization + 1 crop specialization`
- just `1` specialization building overall

This is a hard balance rule for v1.

### Upgrade rule

The economy should enforce:

- `1 building action per turn`
- `1 level upgrade per building action`

This includes:

- placing a new building
- upgrading an existing building
- placing the specialization building

---

## Animal system SSOT

Animal management stays simplified.

### Animal types

V1 animals:

- `cow`
- `pig`
- `chicken`

### Animal trade

Animals do **not** use tenders in v1.
Animals do **not** use auctions in v1.

Livestock sale happens only during **Summer Trade**.

Rules:

- sale prices are visible
- sale prices are locked for the current Summer turn
- prices move between years based on the market table
- cows and chickens sell per animal
- pigs sell by live weight

### Animal acquisition

Players start with livestock.

The exact starting herd depends on the selected **starting profile**.

Players can also buy more animals in Summer.

Summer animal purchase should use:

- visible Summer Trade offers
- visible per-animal price
- capacity validation

Animal buying should not be available every turn outside Summer.

### Automatic outputs

Milk and eggs are always auto-sold.

They do not go through:

- storage trading
- tenders
- Summer livestock sale

---

## Starting profile SSOT

The game starts with predefined farm profiles.

A starting profile defines:

- starting cash
- starting livestock
- starting stored goods
- starting materials
- starting building state
- starting field plans
- any already-seeded field state

### V1 requirement

The starting profile must include enough stock to avoid a dead first year.

At minimum each profile should provide:

- some seed stock or sowing cash
- at least one active field plan or already-seeded field
- livestock matching the intended specialization

This removes the early-game soft-lock risk.

---

## Market and trade SSOT

There are only 3 trade layers in v1:

- `Summer Trade`
- `Tender`
- `Land Auction`

### Summer Trade

Available only in Summer.

Purpose:

- buy materials
- buy animals
- sell animals

Rules:

- prices are dynamic between years
- prices are locked for the current Summer turn
- materials use direct purchase
- animals use direct buy/sell

### Tenders

Tenders are the only direct sale path for stored crop goods.

Eligible goods:

- `grain`
- `potatoes`
- `roots`
- `hay`

Rules:

- no direct sale from `House`
- no direct sell orders
- no crop sale through Summer Trade
- no animal tenders in v1
- no material tenders in v1

### Summer AI tender event

At the end of Summer:

- exactly `3` AI tenders are created
- each targets one random eligible crop good

### Land Auction

The annual auction is only for land.

Rules:

- happens once per year
- ascending bid
- no debt
- 1 to 3 lots

---

## Price model SSOT

The price reference table lives in:

- `rolnik_market_tenders_and_auctions.md`

For implementation, mirror that table into one runtime price module.

### Price behavior

Rules:

- prices are dynamic between years
- prices are locked during one Summer turn
- crop tender start prices sit above the visible crop market table
- materials move slowly
- livestock moves with a softer drift model than crops

### Livestock quality

Quality modifies the visible Summer livestock price.

Use:

- `poor`
- `ok`
- `good`
- `very-good`
- `excellent`

The quality modifier table from the market doc is part of the SSOT.

---

## Input and UI SSOT

The high-level section navigation is:

- `Uprawy`
- `Zwierzeta`
- `Dom / Koniec tury`

This should stay couch-friendly and minimal.

### Input principle

The player should be able to:

- select action group from menu

### Input data rule

All controller bindings must live only in:

- `games/rolnik/src/profiles/*.input-profile.json`

No inline action mappings in TypeScript.

---

## Implementation guardrails

Fail fast if:

- crop goods are sold outside tenders
- animals are sold outside Summer Trade
- a building upgrade consumes a new slot
- more than 5 buildings are placed
- more than 1 specialization building exists
- a profile starts without enough stock to play the first year

---

## Resolved decisions

These items are now considered closed for v1:

- crop catalog = `grain / potatoes / roots / hay`
- buildable building system is real and explicit
- menu buckets = `Uprawy / Zwierzeta / Dom / Koniec tury`
- `5` total building slots
- `1` specialization building total
- players start with livestock and seed stock from a starting profile
- players can buy more animals in Summer
- trade units must be explicit in runtime data

---

## Open decision

Still open:

- final seasonal timing for harvest and exact calendar model

Everything else above should be treated as locked unless changed explicitly.
