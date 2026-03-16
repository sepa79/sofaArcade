# Rolnik / Sofa Arcade — Crops and Crop Buildings

This document extends:

- `rolnik_design_ssot.md`

If there is a conflict, the SSOT document wins.

## Core crop set

Keep the crop system very small and readable.

Main crop types:
- **Grain**
- **Potatoes**
- **Roots**
- **Meadow**

This is enough for:
- field planning
- crop rotation
- feed diversity
- seasonal choices
- simple specialization paths

---

## Seasons

### Spring
Available:
- **Grain**
- **Potatoes**
- **Meadow**

### Autumn
Available:
- **Grain**
- **Roots**

Notes:
- Grain is universal and can be planted in **spring or autumn**
- Potatoes are **spring only**
- Roots are **autumn only**
- Meadow is **spring only**

There is no manual harvest action.
Harvest resolution is automatic.

---

## Field flow

Entering **Fields** shows a simple list of fields.

Controls:
- **Up / Down** — select field
- **Left / Right** — move between main sections
- **Click** — open selected field

Each field should show:
- field name / number
- size
- soil quality
- last crop
- small status icon

Opening a field shows:
- soil quality
- crop history
- expected yield
- current season status

If the season allows planting, the field shows:
- **Cultivate**

After pressing **Cultivate**, the player chooses a crop plan.

---

## 3-year crop plan

Field management should support a very simple future plan.

The player can assign:
- year 1 crop
- year 2 crop
- year 3 crop

Repeated clicks can extend the plan for following years.

Purpose:
- keeps controls simple
- supports long-term planning
- makes crop rotation visible
- avoids repetitive seasonal setup

---

## Soil degradation and rotation

Soil quality affects yield.

But not all crops react the same way:
- **Meadow / grass** is the least sensitive
- other crops depend more on soil quality

### Rule
- repeating the same crop too often degrades soil
- changing crop type maintains soil
- good rotation can recover soil back toward starting quality

This gives crop rotation real value without adding complexity.

---

## Sowing cost rule

When planting a crop:

- if the player has stored crop stock, part of it is used as sowing input
- if the player has none, they must **pay money** for sowing
- **Meadow** does not require stored crop input and can always be established freely

This creates useful decisions:
- sell harvest now
- or keep some for future sowing

---

## Animal feed mapping

### Cows
Best feed:
- **Pasture** ++
- **Hay** +
- **Grain** +
- **Roots** +
- **Potatoes** no

### Pigs
Best feed:
- **Potatoes** ++
- **Roots** ++
- **Grain** +
- **Hay** +
- **Pasture** no

### Chickens
Best feed:
- **Grain** ++
- **Potatoes** +
- **Roots** no
- **Hay** no
- **Pasture** no

---

## Meadow options

Meadow has two uses:

### Pasture
- cows only
- stronger feeding value
- not stored as stock

### Hay
- cows and pigs
- weaker than pasture
- can be stored and used later
- can become a sale product

This creates a natural hay-focused farm style.

---

## Feed diversity rule

Feeding is automatic by default.

The game tracks recent feeding history and calculates animal health.

### Diet quality states
- **Poor**
- **OK**
- **Good**
- **Excellent**

### Rule
More than 2 turns of feeding mostly the same thing causes penalties.

Monotony can lead to:
- lower milk / egg production
- no breeding
- slower pig growth
- higher sickness risk

More varied feeding improves health and performance.

---

## Feed override

The player should be allowed to override automatic feed behavior.

This should stay simple:
- not manual item-by-item feeding
- but a lightweight feed policy / ratio control

Examples:
- potatoes 50%
- grain 30%
- hay 20%

Or priority classes:
- Preferred
- Allowed
- Emergency
- Restricted

Purpose:
- save limited stock
- stretch resources over multiple turns
- accept short-term health risk instead of full starvation

### Underfeeding rule
Underfeeding is allowed.

States:
- full feed
- reduced feed
- critical feed
- no feed

It is better to feed too little for 2 turns than to feed normally once and then have nothing.

---

## Land bonuses

Each field should always have one simple terrain bonus.

This makes fields feel different even before buildings.

### Suggested bonuses

#### Stream
- especially good for **cows**
- bonus to meadow / pasture performance

#### Windy Hill
- good for **grain**
- bonus to grain yield

#### Deep Soil
- good for **potatoes** and **roots**
- bonus to root crop yield

#### Dry Ground
- weaker meadow
- but stable non-grass crop output

These should stay very readable and use one icon each.

---

## Crop specialization buildings

Crop buildings should exist separately from animal specializations.

They support field-focused playstyles such as:
- hay farmer
- grain farmer
- root crop farmer
- balanced mixed farm

### Recommendation
Allow:
- **1 animal specialization**
- **1 crop specialization**

This gives choice without locking the player too hard.

The global limit still depends on match setup.

---

## Crop building progression

Normal crop support buildings can be upgraded in 3 levels, similar to animal buildings.

Suggested pattern:
- **Level 1** — base storage / handling
- **Level 2** — efficiency bonus
- **Level 3** — stronger output bonus and unlocks crop specialization if relevant

This keeps systems consistent across the game.

---

## Suggested crop buildings

### Granary
Focus:
- **Grain**

Possible bonuses:
- better grain storage
- lower grain loss
- better grain sale value
- cheaper grain sowing

### Root Cellar
Focus:
- **Potatoes / Roots**

Possible bonuses:
- lower spoilage
- better root crop value
- cheaper root sowing
- more stable winter supply

### Hay Barn / Drying Shed
Focus:
- **Hay / Meadow**

Possible bonuses:
- more hay from meadow
- better hay storage
- higher hay sale value
- better cow feed quality when using hay

### Seed House
Focus:
- **future sowing efficiency**

Possible bonuses:
- cheaper sowing
- more seed return from harvest
- reduced penalty from low stock
- slight soil recovery support

This one may be better as a later addition, not mandatory for the first version.

---

## Crop specialization examples

### Grain specialization
**Mill**
- converts part of grain output into higher-value product
- may later support recipe-style outputs

### Root specialization
**Preserve House / Root Workshop**
- improves processed value of potatoes / roots
- can later support premium products

### Hay specialization
**Feed Depot**
- improves hay value
- improves hay quality as livestock feed
- supports "hay farmer" playstyle directly

---

## Design summary

Crop gameplay should feel like:

**choose field -> set crop plan -> let harvest resolve automatically -> use or sell stock**

Important principles:
- very small crop roster
- no manual harvest clicking
- automatic but adjustable feeding
- soil rotation matters
- sowing uses stock or money
- meadow creates a real pasture / hay choice
- crop buildings enable dedicated farming styles

---

## Hay specialization and Super Feed

Hay should have a strong late-game role, not just basic storage value.

### Feed Mill
A crop specialization building focused on hay processing.

Core rule:
- **Hay + one other crop** can be processed into **Super Feed**

Valid combinations:
- Hay + Grain
- Hay + Potatoes
- Hay + Roots

All of them produce the same result:
- **Super Feed**

### Super Feed effects
Super Feed is a premium universal animal feed.

Properties:
- loved by **cows**
- loved by **pigs**
- loved by **chickens**
- can be fed continuously without monotony penalty
- counts as a fully balanced feed source

Bonuses:
- better health
- supports breeding
- higher milk / egg output
- faster pig growth

### Design purpose
This gives hay a strong identity:
- basic hay remains a normal feed and trade good
- processed hay becomes a top-tier product
- crop-focused farms can become premium feed producers
- "hay farmer" becomes a fully valid strategy

---

## Revised crop building system

The crop-side building system should use a different logic than animal buildings.

### Storage buildings
Storage buildings have **no levels**.
They are one-time infrastructure buildings.

They:
- greatly increase storage for a crop category
- unlock processing / specialization in that field

Recommended storage buildings:
- **Granary** — for Grain
- **Root Storage** — for Potatoes / Roots
- **Hay Barn** — for Hay

This keeps storage simple and readable.

---

## Machinery building

Machinery should be a separate upgrade path.

### Machinery Shed — Level 1
Represents:
- tractor
- core farm machinery

Effects:
- general farm efficiency bonus
- better overall crop handling

### Machinery Shed — Level 2
Unlocks harvest specialization options.

Possible add-ons:
- **Harvester** — improves Grain and Hay harvesting
- **Root Harvester** — improves Potatoes and Roots harvesting

A farm can have both if it has enough free building slots.

This creates a clean mechanization path without turning storage into an upgrade ladder.

---

## Crop processing specializations

Processing buildings should be separate from storage.

Recommended examples:
- **Mill** — Grain -> Flour
- **Feed Mill** — Hay + another crop -> Super Feed
- **Sugar Works** — Roots -> Sugar
- **Potato Processing** — Potatoes -> Fries

Vodka / distillery is intentionally avoided.
Food-chain style processing fits the game better.

---

## Hay role

Hay should support a full farming strategy.

### Basic hay
- normal stored feed
- trade good
- usable by cows and pigs

### Advanced hay
With **Feed Mill**, hay combined with another crop becomes **Super Feed**.

This makes "hay farmer" a fully valid build.

---

## Combo chains

More advanced production chains should be possible, but tighter.

Example:
- chickens
- potatoes
- fries
- chicken fast food outlet

This is intentionally harder to assemble than a mono-crop farm.

### Design rule
- **mono-build** should be easier to complete
- **combo-build** should be tighter, but offer higher payoff

This creates good asymmetry between simple and advanced strategies.

---

## Chicken exception

Chickens should use a shorter development path than cows or pigs.

Reason:
The chicken + fries + fast food combo already needs multiple crop-side buildings.

### Chicken building path
- **Level 1** — Coop
- **Level 2** — Chicken Farm

Level 2 should unlock:
- bigger capacity
- eggs
- chicken sales
- breeding
- chicken specialization path

This keeps the full combo viable inside the building cap.

---

## Fast food chain example

A valid chicken fast-food build can be:

- Chicken Farm
- Root Storage / Potato Storage
- Potato Processing
- Los Pollos Hermanos
- 1 free slot left

This is much healthier than forcing a longer 3-step chicken chain.

---

## Building cap balance

With a default **5 building** limit:

- a pure crop farmer can get close to full optimization
- an animal-focused player can build a strong livestock path
- a combo player has to commit harder and fit pieces carefully

This is desirable.

Design intent:
- mono-specialization = easier to build
- combo specialization = harder to assemble, stronger payoff
