# Implementation spec

This document turns the one-screen design into an implementation-oriented v0 spec.

It assumes:

- one main screen
- continuous presentation
- weekly and monthly simulation ticks
- a short score-attack run

This is not a legal or historical reconstruction spec.
It is a practical gameplay systems spec for a new inspired title.

## 1. Core state

Use a single authoritative game state object.

Example shape:

```ts
type GameState = {
  time: {
    week: number
    month: number
    year: number
    totalMonths: number
    speed: 0 | 1 | 2 | 4
    paused: boolean
  }

  budget: {
    foodPct: number
    healthPct: number
    oilPct: number
    securityPct: number
  }

  economy: {
    treasury: number
    previousTreasury: number
    monthlyIncome: number
    monthlyExpense: number
    monthlyNet: number
    totalBalance: number
    currencyIndex: number
  }

  resources: {
    foodSupply: number
    foodDemand: number
    diseaseRisk: number
    oilOutput: number
    oilCapacity: number
    goldBars: number
    goldAvgCost: number
    goldPrice: number
    requiredGold: number
  }

  politics: {
    yourBloc: number
    moderates: number
    extremists: number
    electionCountdownMonths: number
    electionPending: boolean
  }

  map: {
    surveyedTiles: number
    rigs: number
    damagedRigs: number
    securityUnits: number
  }

  markets: {
    contractsIncome: number
    spotIncome: number
    goldSalesIncome: number
    importCost: number
    healthCost: number
    goldPurchaseCost: number
  }

  score: {
    currentScore: number
    scoreAccumulator: number
    totalBalanceAccumulator: number
    finalRankBand: number
  }

  run: {
    gameOver: boolean
    cause: "bankruptcy" | "election" | "support" | "disease" | null
  }
}
```

## 2. Recommended starting values

Good v0 defaults:

```ts
treasury = 10000
previousTreasury = 10000
currencyIndex = 100

foodSupply = 50
foodDemand = 55
diseaseRisk = 20
oilOutput = 18
oilCapacity = 20

goldBars = 0
goldAvgCost = 0
goldPrice = 50
requiredGold = 10

yourBloc = 50
moderates = 25
extremists = 25

electionCountdownMonths = 24
electionPending = false

surveyedTiles = 0
rigs = 1
damagedRigs = 0
securityUnits = 0

currentScore = 0
scoreAccumulator = 0
totalBalanceAccumulator = 0
finalRankBand = 0
```

Default budget:

```ts
foodPct = 30
healthPct = 25
oilPct = 30
securityPct = 15
```

Hard rule:

```ts
foodPct + healthPct + oilPct + securityPct === 100
```

## 3. Tick model

Simulation advances in:

- weekly ticks
- monthly ticks after every 4 weekly ticks

Suggested timing:

- `1x` speed: one week every `4s`
- `2x` speed: one week every `2s`
- `4x` speed: one week every `1s`

## 4. Weekly update

Weekly update should be lightweight and smooth.

Order:

```ts
weeklyUpdate(state) {
  applyBudgetEffects(state)
  consumeFood(state)
  updateDisease(state)
  updateOilOutput(state)
  applyMaintenance(state)
  driftSupport(state)
  updateMapState(state)
  checkImmediateFailures(state)
}
```

### 4.1 Budget effects

Convert budget percentages into weekly effects.

```ts
foodImportPerWeek = lerp(0, 8, foodPct / 100)
healthReductionPerWeek = lerp(0, 3, healthPct / 100)
oilBoostPerWeek = lerp(0, 4, oilPct / 100)
securityStabilityPerWeek = lerp(0, 2, securityPct / 100)
```

### 4.2 Food

```ts
foodSupply += foodImportPerWeek
foodSupply -= foodDemand * 0.25
foodGap = foodSupply - foodDemand
```

Clamp:

```ts
foodSupply = clamp(foodSupply, 0, 200)
```

### 4.3 Disease

Suggested formula:

```ts
diseaseRisk += 0.6
diseaseRisk -= healthReductionPerWeek

if (foodGap < 0) diseaseRisk += abs(foodGap) * 0.08
if (foodGap > 10) diseaseRisk -= 0.25

diseaseRisk = clamp(diseaseRisk, 0, 100)
```

### 4.4 Oil

```ts
activeRigs = max(0, rigs - damagedRigs)
oilOutput = activeRigs * (8 + oilBoostPerWeek)
oilOutput = min(oilOutput, oilCapacity)
```

### 4.5 Maintenance and continuous costs

Weekly cost model:

```ts
weeklyPolicyCost =
  foodPct * 0.8 +
  healthPct * 0.7 +
  oilPct * 0.6 +
  securityPct * 0.9

weeklyUnitCost = securityUnits * 6
weeklyRigCost = rigs * 4

treasury -= weeklyPolicyCost + weeklyUnitCost + weeklyRigCost
```

### 4.6 Support drift

Support should move slowly every week.

```ts
supportDelta = 0

if (foodGap < -10) supportDelta -= 2
else if (foodGap < 0) supportDelta -= 1
else if (foodGap > 10) supportDelta += 0.5

if (diseaseRisk > 70) supportDelta -= 2
else if (diseaseRisk > 40) supportDelta -= 1
else if (diseaseRisk < 20) supportDelta += 0.5

if (securityPct > 40) supportDelta -= 0.5

shiftSupport(state, supportDelta)
```

`shiftSupport` should:

- apply the signed change to `yourBloc`
- redistribute the opposite amount between `moderates` and `extremists`
- keep total exactly `100`
- clamp each bloc to `1..98`

Recommended first version:

```ts
function shiftSupport(state, delta: number) {
  if (delta === 0) return

  const nextYour = clamp(state.politics.yourBloc + delta, 1, 98)
  const applied = nextYour - state.politics.yourBloc
  state.politics.yourBloc = nextYour

  const half = applied / 2
  state.politics.moderates = clamp(state.politics.moderates - half, 1, 98)
  state.politics.extremists = clamp(state.politics.extremists - half, 1, 98)

  normalizeSupport(state)
}
```

## 5. Monthly update

Monthly update is the heavy step.

Order:

```ts
monthlyUpdate(state) {
  beginMonthlyAccounting(state)
  settleContracts(state)
  settleSpotMarket(state)
  settleGold(state)
  settleImports(state)
  settleHealth(state)
  finalizeMonthlyEconomy(state)
  updateScore(state)
  advanceCalendar(state)
  resolveElectionCountdown(state)
  checkPopularityFailure(state)
  maybeTriggerEvents(state)
  clearMonthlyBuckets(state)
}
```

## 6. Monthly economy

### 6.1 Monthly buckets

At month start:

```ts
monthlyIncome = 0
monthlyExpense = 0

contractsIncome = 0
spotIncome = 0
goldSalesIncome = 0
importCost = 0
healthCost = 0
goldPurchaseCost = 0
```

### 6.2 Contracts

Example first-pass formula:

```ts
contractsIncome = activeContracts.reduce(
  (sum, c) => sum + c.monthlyValue,
  0
)
monthlyIncome += contractsIncome
```

### 6.3 Spot market

If player sold oil this month:

```ts
spotIncome = spotSellUnits * spotPrice
monthlyIncome += spotIncome
oilOutput -= spotSellUnits
```

### 6.4 Gold

Buy:

```ts
goldPurchaseCost = goldBoughtThisMonth * goldPrice
monthlyExpense += goldPurchaseCost

if (goldBoughtThisMonth > 0) {
  newBars = goldBars + goldBoughtThisMonth
  goldAvgCost =
    ((goldBars * goldAvgCost) + (goldBoughtThisMonth * goldPrice)) / newBars
  goldBars = newBars
}
```

Sell:

```ts
goldSalesIncome = goldSoldThisMonth * goldPrice
monthlyIncome += goldSalesIncome
goldBars = max(0, goldBars - goldSoldThisMonth)
```

### 6.5 Imports

For v0, simplify imports into food-driven cost:

```ts
importCost =
  max(0, foodDemand - foodSupply) * 2 +
  emergencyImportsThisMonth * 4

monthlyExpense += importCost
```

Optional later:

- split into food / industrial / military import categories

### 6.6 Health

```ts
healthCost = 20 + healthPct * 1.2
monthlyExpense += healthCost
```

### 6.7 Finalize economy

```ts
monthlyNet = monthlyIncome - monthlyExpense
previousTreasury = treasury
treasury += monthlyNet
totalBalance += monthlyNet
```

## 7. Currency and reserves

Use gold as a crisis absorber.

If treasury drops below zero:

```ts
shortfall = abs(treasury)
reserveValue = goldBars * goldPrice
```

If reserves can cover it:

```ts
barsSpent = ceil(shortfall / goldPrice)
goldBars = max(0, goldBars - barsSpent)
treasury += barsSpent * goldPrice
currencyIndex += 3
shiftSupport(state, -4)
addEvent("Reserves spent. Currency devalued.")
```

If not:

```ts
state.run.gameOver = true
state.run.cause = "bankruptcy"
```

## 8. Score update

Score should be readable and tunable.

Use:

```ts
monthlyScoreDelta =
  yourBloc * 0.8 +
  clamp(treasury / 100, 0, 100) * 0.5 +
  clamp(monthlyNet / 20, -20, 20) +
  clamp(oilOutput, 0, 40) * 0.6 -
  clamp(diseaseRisk / 5, 0, 20)
```

Then:

```ts
scoreAccumulator += monthlyScoreDelta
totalBalanceAccumulator += monthlyNet
currentScore = floor(scoreAccumulator)
```

Final rank band:

```ts
averageScore = scoreAccumulator / max(1, totalMonths)

if (averageScore < 20) finalRankBand = 0
else if (averageScore < 40) finalRankBand = 1
else if (averageScore < 60) finalRankBand = 2
else finalRankBand = 3
```

Suggested labels:

- `0 = Disaster`
- `1 = Strongman`
- `2 = Competent`
- `3 = Legend`

## 9. Calendar and elections

At month end:

```ts
totalMonths += 1
month += 1
electionCountdownMonths -= 1
```

If month exceeds 12:

```ts
month = 1
year += 1
```

If election countdown hits zero:

```ts
electionPending = true
runElection(state)
electionCountdownMonths = 24
```

### 9.1 Election resolution

Simple v0 formula:

```ts
electionStrength =
  yourBloc +
  clamp(monthlyNet / 50, -10, 10) +
  clamp((100 - diseaseRisk) / 10, 0, 10)
```

Win threshold:

```ts
if (electionStrength >= 50) {
  addEvent("Election won.")
} else {
  state.run.gameOver = true
  state.run.cause = "election"
}
```

## 10. Popularity failure

At month end:

```ts
if (yourBloc < 10) {
  state.run.gameOver = true
  state.run.cause = "support"
}
```

You may also show a warning before hard fail:

```ts
if (yourBloc < 15) addEvent("Your people are turning against you.")
```

## 11. Events

Keep v0 events sparse.

Suggested event checks once per month:

- oilfield accident
- disease outbreak
- earthquake
- contract opportunity spike

Example earthquake:

```ts
if (random() < earthquakeChance) {
  damaged = min(rigs, 1 + randInt(0, 2))
  damagedRigs += damaged
  shiftSupport(state, -2)
  addEvent("Earthquake damaged oil infrastructure.")
}
```

## 12. One-off actions

These actions modify state immediately, but should usually settle financially at month end.

### `surveyTile(tile)`

```ts
if (!tile.surveyed) {
  tile.surveyed = true
  treasury -= 30
}
```

### `buildRig(tile)`

```ts
if (tile.surveyed && !tile.hasRig) {
  tile.hasRig = true
  rigs += 1
  oilCapacity += 8
  treasury -= 120
}
```

### `importUnit()`

```ts
securityUnits += 1
treasury -= 150
shiftSupport(state, -1)
```

### `buyGold(n)`

```ts
goldBoughtThisMonth += n
```

### `sellGold(n)`

```ts
goldSoldThisMonth += min(n, goldBars)
```

## 13. UI-facing derived values

Useful computed values for HUD:

```ts
foodStatus =
  foodSupply < foodDemand ? "Shortage" :
  foodSupply < foodDemand + 10 ? "Tight" :
  "Stable"

healthStatus =
  diseaseRisk > 70 ? "Critical" :
  diseaseRisk > 40 ? "Risky" :
  "Controlled"

treasuryTrend =
  monthlyNet > 0 ? "Up" :
  monthlyNet < 0 ? "Down" :
  "Flat"
```

## 14. Minimal code architecture

Recommended split:

- `game_state.ts`
  - state types
  - initialization

- `weekly_update.ts`
  - weekly simulation

- `monthly_update.ts`
  - monthly accounting
  - score
  - elections
  - failure checks

- `actions.ts`
  - survey / build / contracts / gold / imports

- `ui_store.ts`
  - derived HUD data

- `event_log.ts`
  - event feed

## 15. First playable target

The first working version is good enough if:

- sliders work
- time advances
- treasury changes
- support changes
- map actions work on at least a few tiles
- one election can happen
- one bankruptcy can happen
- one support-collapse fail can happen
- score updates every month

That is enough to start balancing.

## 16. Balance guidance

For the first balancing pass:

- keep treasury generous
- keep disease pressure moderate
- keep support drift readable, not chaotic
- make gold useful but not dominant
- make elections survivable if the player reacts sensibly

Target feel:

- month 1-3: learning and stabilization
- month 4-12: real tradeoffs
- month 12-24: mounting pressure
- election window: sharp but legible climax
