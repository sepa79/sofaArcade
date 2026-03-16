# Rolnik / Sofa Arcade — Field Bonuses and Building Chains

This document extends:

- `rolnik_design_ssot.md`

If there is a conflict, the SSOT document wins.

## Field model

Each field should have 3 main properties:

- **Size**
- **Soil Class**
- **Terrain Bonus**

This is enough to create meaningful variety without adding too much complexity.

---

## Field Size

| Size | Yield | Sowing Cost | Notes |
|---|---:|---:|---|
| Small | x0.75 | x0.75 | cheap and flexible |
| Medium | x1.00 | x1.00 | standard |
| Large | x1.50 | x1.50 | powerful but more expensive |

---

## Soil Class

| Soil | Yield | Degradation Sensitivity | Notes |
|---|---:|---:|---|
| Poor | -20% | low | already weak, little room to degrade further |
| Normal | 0% | medium | standard |
| Rich | +20% | high | very productive, but easier to wear down if overused |

### Soil rule
Higher-quality fields should degrade faster when abused.
Poor fields already sit near the bottom and cannot degrade much further.

This means:
- **Rich** soil gives the best yields
- but repeated monoculture hurts it more
- good rotation matters most on strong land

---

## Terrain Bonuses

Each field should have **one** clear terrain bonus.

Recommended v1 set:

| Bonus | Best For | Effect |
|---|---|---|
| **Stream** | Meadow / Pasture | +25% pasture value, +10% hay |
| **Deep Soil** | Potatoes / Roots | +20% yield |
| **Open Plain** | Grain | +20% yield |
| **Sheltered Field** | All crops | smaller weather penalty, more stable yield |

Optional later additions:

| Bonus | Best For | Effect |
|---|---|---|
| **Sunny Patch** | Spring crops | +10% spring crop yield |
| **Dry Ground** | Grain | +10% grain, -15% meadow |

### Design rule
Terrain bonuses should encourage a style, not force it.
They should be noticeable but not overwhelming.

---

## Animal Buildings -> Feed Storage Bonus

Animal buildings should increase storage for feed their animals prefer.

Rules:
- large bonus to favorite feed storage
- small bonus to acceptable feed storage
- no anti-spoil bonus
- weaker than dedicated crop storage buildings

### Suggested storage bonus map

| Building | Big Bonus | Small Bonus |
|---|---|---|
| **Cow Barn** | Hay / Meadow stock | Grain, Roots |
| **Pig Pen** | Potatoes | Grain, Hay, Roots |
| **Chicken Farm** | Grain | Potatoes |

Example scale:
- dedicated crop storage: **+200**
- favorite-feed animal building bonus: **+80**
- secondary-feed bonus: **+30**

---

## Crop Buildings

Crop-side buildings should use a different logic than animal buildings.

### Storage Buildings
Storage buildings have **no levels**.
They are one-time infrastructure buildings.

| Building | Cost | Upkeep | Gives | Unlocks |
|---|---:|---:|---|---|
| **Granary** | 120 cash + 20 wood + 10 stone | 2 / turn | +200 Grain storage | **Mill** |
| **Root Storage** | 140 cash + 25 wood + 15 stone | 2 / turn | +200 Potatoes / Roots storage | potato / root processing |
| **Hay Barn** | 100 cash + 30 wood + 5 stone | 1 / turn | +250 Hay storage | **Feed Mill** |

---

## Machinery Building

Machinery should be a separate upgrade path.

### Machinery Shed

| Level | Cost | Upkeep | Gives |
|---|---:|---:|---|
| **Level 1** | 180 cash + 35 wood + 25 stone | 3 / turn | general crop efficiency bonus |
| **Level 2** | 220 cash + 30 wood + 35 stone | 4 / turn | unlocks harvest specialization add-ons |

### Harvest Add-ons

| Add-on | Requires | Cost | Upkeep | Gives |
|---|---|---:|---:|---|
| **Harvester** | Machinery Shed L2 | 160 cash + 20 wood + 20 stone | 2 / turn | +15% Grain, +20% Hay |
| **Root Harvester** | Machinery Shed L2 | 170 cash + 15 wood + 25 stone | 2 / turn | +20% Potatoes, +20% Roots |

A farm can have both add-ons if it has enough building slots.

---

## Crop Processing Chains

### Grain Chain

| Chain | Requires | Input | Output | Bonus |
|---|---|---|---|---|
| **Granary -> Mill** | Granary | Grain | Flour | premium grain product |

| Building | Cost | Upkeep |
|---|---:|---:|
| **Mill** | 180 cash + 20 wood + 25 stone | 3 / turn |

### Potato Chain

| Chain | Requires | Input | Output | Bonus |
|---|---|---|---|---|
| **Root Storage -> Potato Processing** | Root Storage | Potatoes | Fries | premium food component |

| Building | Cost | Upkeep |
|---|---:|---:|
| **Potato Processing** | 200 cash + 25 wood + 20 stone | 3 / turn |

### Root Chain

| Chain | Requires | Input | Output | Bonus |
|---|---|---|---|---|
| **Root Storage -> Sugar Works** | Root Storage | Roots | Sugar | premium trade good |

| Building | Cost | Upkeep |
|---|---:|---:|
| **Sugar Works** | 210 cash + 20 wood + 30 stone | 3 / turn |

### Hay Chain

| Chain | Requires | Input | Output | Bonus |
|---|---|---|---|---|
| **Hay Barn -> Feed Mill** | Hay Barn | Hay + Grain / Potatoes / Roots | Super Feed | top universal animal feed |

| Building | Cost | Upkeep |
|---|---:|---:|
| **Feed Mill** | 190 cash + 25 wood + 20 stone | 3 / turn |

---

## Super Feed

**Super Feed** is produced from:

- Hay + Grain
- Hay + Potatoes
- Hay + Roots

All of them create the same product.

### Effects
- loved by cows
- loved by pigs
- loved by chickens
- can be fed continuously without monotony penalty
- counts as fully balanced feed
- boosts health, breeding, milk / eggs, and pig growth

This makes hay a valid premium-farming path, not just filler.

---

## Animal Buildings

## Cows

| Level | Cost | Upkeep | Capacity | Bonus |
|---|---:|---:|---:|---|
| **Barn L1** | start | 1 / turn | 2 | milk, small hay storage bonus |
| **Barn L2** | 160 cash + 25 wood + 20 stone | 2 / turn | 10 | breeding, bigger feed-storage bonus |
| **Barn L3** | 220 cash + 30 wood + 30 stone | 3 / turn | 10 | more milk |

### Cow Chain

| Chain | Requires | Output |
|---|---|---|
| **Barn L3 -> Cheese Dairy** | Cow Barn L3 | Cheese |

| Building | Cost | Upkeep |
|---|---:|---:|
| **Cheese Dairy** | 220 cash + 20 wood + 35 stone | 3 / turn |

## Pigs

| Level | Cost | Upkeep | Capacity | Bonus |
|---|---:|---:|---:|---|
| **Pig Pen L1** | start | 1 / turn | 4 | pig sales, potato storage bonus |
| **Pig Pen L2** | 150 cash + 20 wood + 20 stone | 2 / turn | 20 | breeding, bigger feed-storage bonus |
| **Pig Pen L3** | 210 cash + 30 wood + 25 stone | 3 / turn | 20 | faster growth / better sale value |

### Pig Chain

| Chain | Requires | Output |
|---|---|---|
| **Pig Pen L3 -> Sausage House** | Pig Pen L3 | Sausages |

| Building | Cost | Upkeep |
|---|---:|---:|
| **Sausage House** | 210 cash + 20 wood + 30 stone | 3 / turn |

## Chickens

| Level | Cost | Upkeep | Capacity | Bonus |
|---|---:|---:|---:|---|
| **Coop L1** | start | 1 / turn | 20 | eggs, grain storage bonus |
| **Chicken Farm L2** | 140 cash + 20 wood + 15 stone | 2 / turn | 100 | breeding, chicken sales |

### Chicken Combo Chain

| Chain | Requires | Output |
|---|---|---|
| **Chicken Farm + Potato Processing -> Los Pollos Hermanos** | Chicken Farm L2 + Potato Processing | Fast Food |

| Building | Cost | Upkeep |
|---|---:|---:|
| **Los Pollos Hermanos** | 260 cash + 25 wood + 25 stone | 4 / turn |

---

## Example Builds

### Hay Farmer
- Hay Barn
- Feed Mill
- Machinery Shed L1
- Harvester
- 1 free slot

### Grain Farmer
- Granary
- Mill
- Machinery Shed L1
- Harvester
- 1 free slot

### Cow Cheese Farm
- Cow Barn L2
- Cow Barn L3
- Cheese Dairy
- Hay Barn
- 1 free slot

### Fast Food Build
- Chicken Farm
- Root Storage
- Potato Processing
- Los Pollos Hermanos
- 1 free slot

---

## Building Cap Balance

With a default **5 building** limit:
- mono-crop farmers can get close to full optimization
- livestock players can build a strong animal chain
- combo players must commit harder and fit pieces carefully

Design intent:
- **mono-specialization** = easier to build
- **combo specialization** = harder to assemble, stronger payoff
