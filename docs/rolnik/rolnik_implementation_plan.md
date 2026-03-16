# Rolnik / Sofa Arcade — Implementation Plan

## Goal

Build a first playable **2–4 player local prototype** with:

- seasonal farm loop
- walking farmer + building entry
- crop planning and harvest
- simple animal management
- Summer Trade
- 3 AI crop tenders in Summer
- annual land auction at the end of the year

The first implementation should optimize for:

- pure game logic in small tested modules
- one clear state machine
- no hidden fallback trade paths
- a playable vertical slice before content breadth

Design SSOT for implementation:

- `docs/rolnik/rolnik_design_ssot.md`

---

## Recommended repo layout

Create a new game package:

- `games/rolnik/package.json`
- `games/rolnik/tsconfig.json`
- `games/rolnik/eslint.config.js`
- `games/rolnik/vite.config.ts`
- `games/rolnik/index.html`
- `games/rolnik/src/main.ts`
- `games/rolnik/src/index.ts`
- `games/rolnik/src/style.css`

Keep code split like existing games:

- `games/rolnik/src/game/*` = pure rules and state
- `games/rolnik/src/scenes/*` = Phaser scene wiring and rendering
- `games/rolnik/src/profiles/*.input-profile.json` = controller bindings only

---

## Target module map

### Core game state

- `games/rolnik/src/game/types.ts`
- `games/rolnik/src/game/constants.ts`
- `games/rolnik/src/game/state.ts`
- `games/rolnik/src/game/logic.ts`
- `games/rolnik/src/game/logic.test.ts`

Purpose:

- top-level `GameState`
- quarter phase and event phase
- player turn completion
- end-of-turn resolution

### Calendar and phase flow

- `games/rolnik/src/game/calendar.ts`
- `games/rolnik/src/game/calendar.test.ts`
- `games/rolnik/src/game/phases.ts`
- `games/rolnik/src/game/phases.test.ts`

Purpose:

- `spring -> summer -> autumn -> winter`
- seasonal permissions
- event selection
- year rollover

### Economy pricing

- `games/rolnik/src/game/economy/prices.ts`
- `games/rolnik/src/game/economy/prices.test.ts`
- `games/rolnik/src/game/economy/market-drift.ts`
- `games/rolnik/src/game/economy/market-drift.test.ts`

Purpose:

- v1 price table SSOT
- turn-locked summer prices
- annual market drift
- livestock quality multipliers

### Trade systems

- `games/rolnik/src/game/economy/summer-trade.ts`
- `games/rolnik/src/game/economy/summer-trade.test.ts`
- `games/rolnik/src/game/economy/tender.ts`
- `games/rolnik/src/game/economy/tender.test.ts`
- `games/rolnik/src/game/economy/land-auction.ts`
- `games/rolnik/src/game/economy/land-auction.test.ts`

Purpose:

- material purchase in Summer turn
- livestock sale in Summer turn
- 3 AI tenders in Q2 end event
- yearly land auction in Q4

### Fields and crops

- `games/rolnik/src/game/fields.ts`
- `games/rolnik/src/game/fields.test.ts`
- `games/rolnik/src/game/crops.ts`
- `games/rolnik/src/game/crops.test.ts`

Purpose:

- field identity and ownership
- soil class and terrain bonus
- 3-year crop plan
- sowing permissions
- automatic harvest resolution

### Animals and feed

- `games/rolnik/src/game/animals.ts`
- `games/rolnik/src/game/animals.test.ts`
- `games/rolnik/src/game/feed.ts`
- `games/rolnik/src/game/feed.test.ts`

Purpose:

- animal counts and capacity
- breeding unlocks
- pig weight growth
- health / quality state
- auto-sale of milk and eggs

### Buildings

- `games/rolnik/src/game/buildings.ts`
- `games/rolnik/src/game/buildings.test.ts`

Purpose:

- building slots
- slot consumption by upgrades
- upgrade costs
- animal building levels
- crop storage and processing unlock prerequisites

### Input

- `games/rolnik/src/game/input.ts`
- `games/rolnik/src/profiles/rolnik.shared-keyboard-gamepad.input-profile.json`
- `games/rolnik/src/profiles/rolnik.keyboard-only.input-profile.json`

Purpose:

- menu navigation
- walking
- confirm / cancel
- end-turn confirm

Action ids should stay local to the game input catalog.
Bindings must stay only in profile JSON files.

### Scene layer

- `games/rolnik/src/scenes/rolnik-scene.ts`
- `games/rolnik/src/scenes/rolnik-launcher-scene.ts`

Purpose:

- farm rendering
- player HUD
- building entry
- event overlays
- central world bar

---

## State model to lock early

The following types should be defined before scene work gets deep:

- `SeasonId = 'spring' | 'summer' | 'autumn' | 'winter'`
- `GamePhase = 'planning' | 'turn-timer' | 'resolution' | 'summer-tender-event' | 'land-auction' | 'game-over'`
- `GoodId = 'grain' | 'potatoes' | 'roots' | 'hay' | 'wood' | 'stone' | 'milk' | 'eggs'`
- `AnimalType = 'cow' | 'pig' | 'chicken'`
- `AnimalQuality = 'poor' | 'ok' | 'good' | 'very-good' | 'excellent'`
- `BuildingId = 'house' | 'cow-barn' | 'pig-pen' | 'coop' | 'granary' | 'root-storage' | 'hay-barn' | 'machinery-shed' | 'mill' | 'fries-kitchen' | 'sugar-works' | 'feed-mill' | 'cheese-dairy' | 'sausage-house' | 'fast-food-outlet'`
- `TradeCardType = 'material-purchase' | 'livestock-sale'`
- `TenderState`
- `LandAuctionState`

Fail fast if:

- a player tries to submit a buy order without reserved cash
- a seller enters a tender without full quantity
- a livestock sale exceeds owned animals
- a building upgrade is allowed without a free slot
- a land bid exceeds current cash

---

## Milestone plan

## Milestone 1 — Game scaffold

Deliverables:

- new `games/rolnik` package boots in Phaser
- one bootstrap scene + one main scene
- one working input profile
- launch data parser with strict validation

Verification:

- app boots
- scene loads
- one player can move and open a placeholder menu

## Milestone 2 — Domain skeleton

Deliverables:

- `GameState` shape
- quarter calendar
- player/farm/field/animal/building data models
- initial state factory

Verification:

- unit tests for state creation
- invalid config throws explicit errors

## Milestone 3 — Fields and seasons

Deliverables:

- field list and field detail model
- sowing rules for the planting seasons only
- 3-year crop plan
- harvest resolution
- soil degradation and recovery

Verification:

- unit tests for rotation
- unit tests for sowing restrictions
- unit tests for harvest yield changes

## Milestone 4 — Animals and baseline economy

Deliverables:

- animal counts, capacity, breeding gates
- pig weight growth
- milk and egg auto-sale
- feed quality states

Verification:

- unit tests for breeding unlock at building level 2
- unit tests for pig sale valuation by weight
- unit tests for health impact from bad feed

## Milestone 5 — Summer Trade

Deliverables:

- Q2-only material purchase
- Summer-only livestock sale
- turn-locked price table for current Summer
- quality-based livestock pricing

Verification:

- unit tests for purchase validation
- unit tests for livestock sale price quoting
- unit tests confirming prices stay unchanged during one Summer turn

## Milestone 6 — Buy Orders and Summer tenders

Deliverables:

- player buy order entry from `House`
- reserved-cash validation
- 3 AI tenders generated at end of Summer
- descending-price last-leader-wins resolution

Verification:

- unit tests for tender winner resolution
- unit tests for no partial fulfillment
- unit tests for exactly 3 Summer tenders

## Milestone 7 — Land auction

Deliverables:

- yearly land lot generation
- ascending bid flow
- cash validation
- field transfer on win

Verification:

- unit tests for invalid bids
- unit tests for auction close and ownership transfer

## Milestone 8 — Scene vertical slice

Deliverables:

- split-screen farm view for 2P first
- central world bar
- building entry and simple menus
- end-turn flow
- event overlays for Summer tenders and land auction

Verification:

- manual playable loop from Q1 to Q4
- no dead-end states in menus

## Milestone 9 — 4P compression

Deliverables:

- 4P layout pass
- HUD simplification
- reduced on-screen text

Verification:

- 4P remains readable at couch distance

---

## Suggested implementation order inside logic

Build pure logic in this order:

1. `types.ts`
2. `constants.ts`
3. `calendar.ts`
4. `state.ts`
5. `fields.ts`
6. `crops.ts`
7. `animals.ts`
8. `buildings.ts`
9. `economy/prices.ts`
10. `economy/market-drift.ts`
11. `economy/summer-trade.ts`
12. `economy/tender.ts`
13. `economy/land-auction.ts`
14. `logic.ts`
15. scene files

This keeps pure rules ahead of presentation.

---

## Price SSOT

Use the design SSOT first:

- `docs/rolnik/rolnik_design_ssot.md`

Use the v1 price table in:

- `docs/rolnik/rolnik_market_tenders_and_auctions.md`

Implementation should mirror that doc in one runtime module:

- `games/rolnik/src/game/economy/prices.ts`

Do not duplicate price constants across scene code, event code, and building code.

---

## Minimal first playable scope

Ship the first internal playable with:

- 2 players only
- 2 fields per player
- cows, pigs, chickens
- grain, potatoes, roots, hay
- Summer Trade
- 3 Summer AI tenders
- end-of-year land auction

Do not block first playable on:

- 4P support
- processing chains
- minigames
- advanced AI personalities
- recipe unlocks

---

## Exit criteria for v1 prototype

The prototype is ready for balance iteration when:

- one full year can be played without soft locks
- crop goods can only be sold through tenders
- livestock can only be sold in Summer Trade
- land changes hands only through the annual auction
- price drift visibly reacts to last year's over-supply
- all pure logic modules have unit tests
