# Rolnik / Sofa Arcade — Animals Section

This document extends:

- `rolnik_design_ssot.md`

If there is a conflict, the SSOT document wins.

## Core idea
Animal management should stay very simple and mostly automatic.

- no storage for milk or eggs
- milk and eggs are sold automatically
- no buy orders for animals
- animals do not use tenders or auctions in v1
- livestock sale happens during the summer turn at prices locked for that turn
- breeding is automatic once unlocked
- animal menu is for overview and building upgrades, not for micromanagement

---

## Animal menu flow

Entering **Animals** shows a simple vertical list:

- Cows
- Pigs
- Chickens

Controls:
- **Up / Down** — select animal type
- **Left / Right** — move to another main section
- **Click** — open selected animal details

---

## Animal detail screen

Each animal screen should show only the essential data:

- current count
- max capacity
- building level
- income / output
- feed demand
- status icons
- specialization locked / unlocked

### Extra display rules

For **cows** and **pigs**:
- adults
- young
- breeding active / locked

For **chickens**:
- total flock
- breeding active / locked

Chickens stay simplified:
- once breeding is unlocked, new chickens are treated as adult stock
- no separate chick stage

---

## Available actions

The screen should stay minimal.

Actions:
- **Expand / Upgrade**
- **Specialize** *(only if unlocked)*
- **Back**

Not available here:
- direct animal purchase
- direct animal sell order
- animal buy order

Animal sale happens only during **Summer / Q2** and uses visible prices locked for that turn.

---

## Building progression

Animal buildings have **3 levels total**.
The player starts at **Level 1**.

### Level 1
Basic husbandry with a small capacity.

Suggested starting limits:
- cows: **2**
- pigs: **4**
- chickens: **20**

### Level 2
Unlocks:
- **automatic breeding**
- **higher max capacity**

Suggested limits:
- cows: **10**
- pigs: **20**
- chickens: **100**

### Level 3
Unlocks:
- stronger production bonus depending on animal type

Suggested effects:
- cows: **more milk**
- pigs: **faster weight gain / higher sale value per kilo**
- chickens: **more eggs**

Level 3 does **not** add a new management layer.
It improves the existing one.

---

## Breeding rules

Breeding is always automatic.

It works only if:
- building level is **2 or higher**
- there is free capacity
- there is enough feed

### Result by animal type

**Cows / Pigs**
- produce **young**
- young later become sale-ready stock automatically

**Chickens**
- breeding directly increases adult flock size
- no chick management

This keeps the system readable and light.

---

## Specialization

Specialization is **separate from building level**.

Rules:
- available only after reaching **Level 3**
- requires a free building slot
- farm can have **max 5 buildings total**
- only **one specialization building** can exist on the farm

Specialization adds a **new premium product**, not just a stat bonus.

### Cow specialization
**Cheese Dairy**
- part of milk is sold normally
- part of milk is converted into cheese
- player can choose processing split:
  - 0%
  - 25%
  - 50%
  - 75%
  - 100%

### Pig specialization
**Sausage House / Smokehouse**
- adds premium processed pork product
- later can support recipes

### Chicken specialization
**Chicken Bar / Poultry Kitchen**
- adds premium chicken food product
- can later support recipes
- thematic option: a playful fast-food style building

---

## Recipes (future expansion)

Not needed for the first playable version.

For v1:
- each specialization gives **one premium product**

Possible future expansion:
- unlockable recipes
- recipes won in minigames
- seasonal recipe bonuses
- multiple processing types per specialization

---

## Building supplies

Animal building upgrades should require not only money but also simple building resources.

Recommended resources:
- **Wood**
- **Stone**

Purpose:
- makes expansion feel earned
- gives players extra goals
- prevents upgrades from being just a cash click

Possible sources:
- event rewards
- summer market
- seasonal decisions
- auctions / contracts later if needed

---

## Design summary

The animal section should feel like:

**choose animal -> review status -> upgrade building -> unlock specialization later**

It should avoid:
- storage micromanagement
- manual milk / egg selling
- manual breeding actions
- direct everyday animal trading

The result should stay strategic, readable, and very easy to use from a couch / controller setup.
