# Rolnik / Sofa Arcade — Market, Tenders and Auctions

This document extends:

- `rolnik_design_ssot.md`

If there is a conflict, the SSOT document wins.

## Core idea

Trade should feel:

- public
- seasonal
- fast
- readable from the couch

It should not become an always-open spreadsheet layer.

The market should use **3 clearly different systems**:

- **Summer Trade** = turn-locked prices with market drift between turns
- **Tender** = descending-price AI buy contract
- **Auction** = ascending bid for rare assets

Each mode should have one job and one clear rule set.

---

## Trade layers overview

| Mode | Main use | Timing | Interaction | Best for |
|---|---|---|---|---|
| **Summer Trade** | turn-locked seasonal trade | during **Summer / Q2 turn** | direct buy / direct sell | materials and livestock |
| **Tender** | selling stored goods into active buy orders | end of **Summer / Q2** | descending price, last leader wins | random crop contracts |
| **Auction** | rare high-value assets | mainly **Winter / Q4** | ascending bids | land, special lots |

---

## No direct sale rule

There should be **no direct sale action** for stored crop goods outside tenders.

Rules:

- the player cannot sell stock instantly from the **House**
- the player cannot create direct **sell orders**
- stored crop goods leave inventory only by winning a **Tender**
- animals are still not sold from the **House**
- livestock sale in v1 happens only during **Summer Trade**

Purpose:

- demand must matter
- price discovery stays public
- stock pressure becomes a strategic problem
- the economy keeps one SSOT for player-driven selling

If the selling loop feels too tight, the fix should be:

- more AI buy orders
- larger contract volume
- better seasonal tender timing

not:

- fallback direct sale
- emergency House trade
- parallel sell-order systems

---

## Market

The core summer market should be a short trading phase with prices locked for the current turn.

It should feel like:

- a busy seasonal fair
- visible stalls
- limited lots
- fast decision pressure

This is the best place for:

- building materials
- livestock sale
- simple seasonal opportunities

### Timing

Preferred v1 timing:

- during the active **Summer / Q2** turn
- before the end-of-turn tender event

### Core rules

- every stall sells a **full lot**
- the price is **locked for the current turn**
- buying is **instant**
- animal sale is **instant**
- no partial purchase
- no bargaining
- sold-out stalls disappear immediately

### Trade card fields

Each lot should show:

- item
- quantity
- total price
- trade type

Trade type can be:

- material purchase
- livestock sale

### Materials

Rules:

- wood and stone can be bought directly here
- prices are locked for the whole Summer turn
- no tender is needed
- this should stay quick and predictable

This gives building progression a reliable source of materials.

### Livestock sale

Livestock should **not** use tenders or auctions in v1.

Rules:

- cows, pigs, and chickens are sold directly during **Summer Trade**
- prices are visible and locked for the current Summer turn
- price depends on animal type and **quality / health**
- pigs should use a **price per kilo**
- the sale is immediate once confirmed

This keeps animal trade short and readable.

### Seasonal market drift

Prices should be dynamic across turns and years.

Rule:

- each Summer turn uses one visible market price table
- that table stays unchanged until the turn ends
- the next year's table can move up or down based on previous supply

Example:

- if players flood the market with grain in Year 1
- grain prices should be slightly lower in Year 2

This keeps the interface stable during play while still letting the economy react over time.

### V1 reference prices

These values should be the single design reference for v1 economy tuning.

They are based on real Polish market price ratios, but compressed into game-scale cash values.

| Good | Real-world anchor | V1 base price | Drift band | Notes |
|---|---|---:|---|---|
| **Grain** | wheat around **77.90 zl/dt** | **12** | 8 to 16 | main crop reference |
| **Potatoes** | potatoes around **55.15 zl/dt** | **9** | 6 to 13 | about 70 to 75% of grain |
| **Roots** | inferred below potatoes | **8** | 5 to 12 | sugar/root crop stand-in |
| **Hay** | inferred low-value feed crop | **7** | 4 to 11 | cheap but useful |
| **Wood** | gameplay-compressed material | **3** | 2 to 4 | kept low so building costs still work |
| **Stone** | gameplay-compressed material | **4** | 3 to 5 | slightly above wood |
| **Cow** | beef cattle priced above pigs | **120 / head** | 96 to 144 | sold in Summer Trade |
| **Pig** | pork around **6.47 zl/kg** | **0.14 / kg** | 0.11 to 0.17 | live-weight sale |
| **Chicken** | low-value small livestock | **2 / bird** | 1.6 to 2.4 | simple flat sale |
| **Milk** | milk around **223.47 zl/hl** | **2.4 / unit** | 2.0 to 2.8 | auto-sold income |
| **Eggs** | eggs around **74.10 zl / 100 pcs** | **0.8 / egg** | 0.6 to 1.0 | auto-sold income |

### Livestock quality modifiers

The quoted Summer Trade livestock price should be:

**market price x quality modifier**

| Quality | Modifier |
|---|---:|
| **Poor** | x0.75 |
| **OK** | x0.90 |
| **Good** | x1.00 |
| **Very Good** | x1.10 |
| **Excellent** | x1.25 |

For pigs, apply the modifier after weight pricing.

### Tender start prices

AI Summer tenders should start above the visible market table.

Recommended rule:

- start price = current crop price **+2** for weak demand
- start price = current crop price **+3** for normal demand
- start price = current crop price **+4** for strong demand
- descent step = **-1**

Example:

- current grain price = **12**
- strong AI grain order starts at **16**
- if the last accepted click happened at **14**, the contract clears at **14**

### Year-to-year drift rule

Use a simple annual step model in v1.

For each crop after the year ends:

- if yearly sold volume is **very high**, next year's price goes **-2**
- if yearly sold volume is **high**, next year's price goes **-1**
- if yearly sold volume is **low**, next year's price goes **+1**
- if yearly sold volume is **very low**, next year's price goes **+2**
- otherwise, price stays unchanged

Clamp the result to the drift band.

Materials should move rarely.
Livestock can use a softer version of the same table.

### Sources

Real-world anchors used here:

- GUS, *Ceny produktów rolnych we wrześniu 2025 r.*  
  https://stat.gov.pl/files/gfx/portalinformacyjny/pl/defaultaktualnosci/5465/4/161/1/ceny_produktow_rolnych_we_wrzesniu_2025_r..pdf
- MRiRW / ZSRIR, egg market quotations, **30 March 2025**  
  https://www.gov.pl/attachment/a585da19-61bf-4790-bc8d-4522a7b7f620

### Recommended Summer Trade goods in v1

- wood
- stone
- cows
- pigs
- chickens

### Goods not sold through Summer Trade in v1

- milk
- eggs
- grain
- potatoes
- roots
- hay
- land

Milk and eggs remain automatic income.
Stored crop goods belong to the **Tender** layer.
Land belongs to the **Auction** layer.

---

## Tender

A **Tender** is a public AI buy contract.

One buyer wants a specific quantity.
Multiple sellers can fight to fulfill it for a lower price.

This should be the shared rule for:

- player **buy orders**
- AI seasonal demand

That gives one SSOT for crop-contract trading.

### Tender data

Each tender should have:

- buyer
- good
- quantity
- max unit price
- price step
- countdown per price step

### Eligible goods

Tender goods should be:

- storable
- measurable
- easy to compare

Recommended v1 set:

- grain
- potatoes
- roots
- hay

Not eligible in v1:

- animals
- land
- milk
- eggs
- wood
- stone

### Core tender flow

1. Buyer creates a tender with quantity and max unit price.
2. If the buyer is a player, the required cash is reserved immediately.
3. The tender price starts at the buyer's max unit price.
4. Eligible sellers can press confirm to take the lead at the current price.
5. When a seller takes the lead, the required goods are locked.
6. The price drops to the next step.
7. Another seller may take over at the lower price.
8. If one full step passes with no new bid, the current leader wins at the last accepted price.
9. If nobody accepts the first price, the tender expires with no sale.

This means:

- the first click does **not** end the tender
- the lowest accepted price wins
- the winner is the last seller still leading when the next lower step gets no response

### Entry rule

To enter a tender, a seller must have the **full required quantity** available.

No partial fulfillment in v1.

That keeps the event readable and avoids messy split contracts.

### Why descending price fits

This creates:

- pressure
- readable competition
- a clear timing skill test
- easy controller input

It also matches the earlier design goal:

**last leader wins**

instead of

**first click wins**

### Player buy orders

The player-facing version should live in the **House**.

Recommended v1 limits:

- **1 buy order per player per quarter**
- only one active player tender at a time
- cash is reserved while the tender is active

This prevents spam and keeps the system legible in 4P.

### Summer tender event

The Summer event should stay short.

Recommended v1 rule:

- exactly **3** AI tenders at the end of **Q2**
- each tender targets **1 random crop good**
- no animal tenders
- no material tenders

Best tender pool:

- grain
- potatoes
- roots
- hay

This prevents the event from dragging and keeps each Summer distinct.

---

## Auction

An **Auction** is for scarce, high-impact assets.

It should feel:

- rarer
- slower
- more dramatic

This is where direct bidding makes sense.

### v1 scope

Recommended v1 auction uses:

- annual **land auction** only

If the trade model works well, more auctions can be added later.
They should not be part of v1.

### Core rules

- one lot is shown at a time
- the lot has a visible starting price
- bids go **up**
- each valid bid must beat the current price by at least the minimum raise
- a short countdown resets after each valid bid
- when the countdown ends, the highest bidder wins

### Land auction

The land auction should happen:

- at the end of **Winter / Q4**
- after yearly farm resolution

Each land lot should show:

- size
- soil class
- terrain bonus
- whether it is empty or pre-developed

Recommended yearly volume:

- **1 to 3 land lots**

That is enough to create drama without dragging the year-end flow.

### Cash rule

A player can only bid if they currently have enough cash.

No debt.
No hidden financing.

This keeps the auction clear and brutal in the right way.

### Why land belongs here

Land has:

- long-term strategic value
- denial value
- catch-up value

It deserves a more dramatic layer than the regular market.

---

## Controller and UI flow

All 3 systems should reuse the same shared presentation ideas:

- central world timer
- very large lot cards
- one highlighted selection per player
- clear ownership colors

### Summer Trade controls

- **Left / Right** — move between visible stalls
- **Up / Down** — move between rows if needed
- **Confirm** — buy or sell selected lot

### Tender controls

- **Left / Right** — switch active tender
- **Confirm** — take the lead at current price

The current leader should always be shown clearly.

### Auction controls

- **Left / Right** — adjust bid by the current step
- **Confirm** — submit bid

The active highest bidder and current price must stay visible at all times.

---

## Balance guidelines

The trade layer should create decisions, not replace farm planning.

Recommended balance rules:

- no direct baseline sale exists for stored goods
- Summer Trade gives reliable material access and safe livestock sale
- Tenders are the only direct way to convert stored crop goods into cash
- Auctions should be risky cash commitments with long-term upside

If crop monetization feels too slow, tune tender supply.
Do not add direct-sale shortcuts.

### Building resources

Wood and stone should be meaningfully present here.

Best sources:

- Summer Trade stalls
- event rewards

This supports the building economy without adding another subsystem.

---

## Design summary

Final recommended structure:

- **House** = quarterly buy order creation only
- **Summer Trade** = turn-locked materials and livestock trade during Q2, with market drift between years
- **Tender** = 3 short AI crop contracts at the end of Q2 and the only direct sale path for stored crop goods
- **Auction** = ascending bids for land at the end of the year

This gives the game:

- a readable public economy
- seasonal spikes of tension
- direct player interaction
- different trade rhythms for cheap goods, bulk contracts, and premium assets

Most importantly, each trade mode feels different without adding unnecessary accounting.
