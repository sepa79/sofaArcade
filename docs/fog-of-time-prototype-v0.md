# Fog of Time: False Horizons — Prototype Ruleset v0

## 1) One-Sentence Pitch

Turn-based space strategy where the player does not control an empire instantly; they emit orders from the capital, and those orders arrive late into a world that may already have changed.

---

## 2) Purpose of This Document

This is the first implementation-facing ruleset for the `Fog of Time: False Horizons` prototype.

Its job is to define:
- the smallest playable loop,
- the simulation SSOT,
- the time model,
- the message and command model,
- the minimum planet state,
- and the UI abstractions needed for a playable `v0`.

This is not a lore doc and not a full 4X spec.
It is a constrained prototype ruleset.

### Working title note
`Fog of Time` names the core mechanic.
`False Horizons` names the fantasy: distant systems, frontier expectations, and strategic pictures that look stable until delayed reality proves otherwise.

---

## 3) Prototype Goal

The prototype must prove one thing:

> Delayed information and delayed command are enough to create meaningful strategy without requiring a large 4X content scope.

### Success condition
The player should repeatedly face this decision:
- act now with low-trust or stale information,
- wait for better information,
- or issue high-level doctrine and accept loss of direct control.

---

## 4) Scope of v0

### Included
- turn-based play
- one star map on one screen
- 12 to 18 star systems
- 2 factions total
- 1 player empire
- 1 AI empire
- planets as the only economic nodes
- fleets with ETA
- automatic combat resolution
- delayed reports
- delayed orders
- 3 communication channel types
- 3 control tiers
- capital relocation
- capital loss without instant game over
- fixed technology baseline, no research

### Explicitly excluded
- tactical combat
- diplomacy with more than one opponent
- espionage agents
- research system
- race-specific asymmetry
- procedural events
- character systems
- detailed trade model
- local governors as named characters

---

## 5) Core World Rule

Only the current capital has fully current information and full immediate control.

Every other system is governed through:
- the latest report that reached the capital,
- the latest valid order that reached the system,
- local doctrine,
- and local reality, which may already have diverged.

This implies:
- the player never sees raw omniscient game state,
- the player sees a report model,
- and command is a message in transit, not an instant effect.

---

## 6) Simulation SSOT

There must be one authoritative simulation state.

### SSOT layers
1. `world state`
   - true current state of all systems, fleets, routes, messages, and ownership
2. `capital knowledge state`
   - what the current player capital knows, with timestamps
3. `local system state`
   - what each system currently believes and which standing doctrine it follows

The player UI renders from `capital knowledge state`, not from `world state`, except for the active seat of government itself.

This is a hard rule for the prototype.

---

## 7) Time Model

### Turn scale
- 1 turn = 1 year

### Prototype session length
- target: 60 to 90 turns

### Travel assumptions
- fleets take multiple turns to travel
- reports take multiple turns to travel
- orders take multiple turns to travel
- maximum ship speed is `0.1c`
- radio and relay data travel at `1c`

Time is discrete.
Arrival always happens at turn boundaries.

### Distance interpretation
- map distances are measured in light-years
- at `0.1c`, a ship needs 10 turns to cross 1 light-year
- fleet travel time is therefore derived from distance, not hand-waved
- open radio travel time is `ceil(distance in light-years)`
- relay travel time is `ceil(total relay path length in light-years)`

---

## 8) Map Model

### Star systems
Each star system is a node with:
- unique id
- name
- position on map
- owner
- population
- industry
- defense level
- shipyard level
- doctrine
- communication infrastructure
- local stockpile
- unrest

### Routes
Each pair of connected systems has:
- distance
- fleet travel time
- radio travel time
- relay travel time if a valid relay path exists
- courier travel time

For `v0`:
- fleet and courier travel time are derived from distance
- open radio travel time is derived from direct source-to-destination distance at `1c`
- relay travel time is derived from the total length of the chosen relay path at `1c`

Relay routes are not automatic.
They are built by the player as explicit data corridors.

### Relay topology
- relay nodes must be anchored in star systems
- in `v0`, that means relay nodes live on planets or orbital infrastructure tied to planets
- the player defines which systems are connected into the relay network
- messages may use relay only if there is a continuous valid path from source to destination
- the route may bend through any number of owned or valid relay nodes
- each relay leg contributes its own physical distance to total delivery time
- example: a direct relay leg of `1.4 ly` takes `2 turns`
- example: route `A -> C -> B` with legs `1.0 ly` and `1.8 ly` takes `3 turns`

---

## 9) Faction Model

Each faction has:
- capital system id
- list of owned systems
- fleet list
- message queue
- legitimacy value
- default empire doctrine

### Prototype simplification
`v0` uses exactly 2 faction behaviors:
- player faction: controlled from UI through delayed orders
- AI faction: follows the same travel and message rules

The AI must not cheat on information timing.

---

## 10) Minimum Planet State

Each system must track only the minimum needed for the prototype.

### System state
- `owner`
- `population`
- `industry`
- `defense`
- `shipyard`
- `stockpile`
- `doctrine`
- `stability`
- `lastLocalUpdateTurn`

### Derived outputs each turn
- production points generated
- defense recovery
- ship construction progress
- unrest change

### Production modes
Each system can be in one of 4 production priorities:
- `BALANCED`
- `INDUSTRY`
- `MILITARY`
- `SURVIVAL`

These are mutually exclusive and form the production SSOT.
No sliders in `v0`.

---

## 11) Control Tiers

Distance from the capital determines what the player can issue.

### Tier 0: Capital
- full current information
- instant local management
- can queue local construction directly this turn

### Tier 1: Near systems
- report delay: 1 to 2 turns
- order delay: 1 to 2 turns
- player may issue direct orders

Allowed actions:
- set production priority
- queue ship build
- launch fleet
- raise emergency defense

### Tier 2: Mid-range systems
- report delay: 3 to 5 turns
- order delay: 3 to 5 turns
- player may issue constrained directives

Allowed actions:
- set production priority
- set doctrine
- allow or forbid fleet aggression
- declare fallback posture

### Tier 3: Remote systems
- report delay: 6+ turns
- order delay: 6+ turns
- player may issue doctrine only

Allowed actions:
- set standing doctrine
- set communication policy
- set autonomy posture

This tier system is UI-facing and rules-facing.
If the capital moves, tiers must recompute immediately.

---

## 12) Orders, Directives, and Doctrine

There are three command classes in `v0`.

### Order
Precise operational instruction.

Examples:
- build 2 corvettes
- launch fleet to system X
- switch to `MILITARY`
- fortify immediately

### Directive
High-level behavior change with room for local interpretation.

Examples:
- prioritize survival
- avoid offensive action
- reinforce nearest threatened ally
- conserve shipyard output

### Doctrine
Standing local policy used when no fresh order is present or when conflicting information exists.

Examples:
- `HOLD`
- `FORTIFY`
- `EXPAND`
- `PRESERVE_FLEET`
- `LOCAL_AUTONOMY`

### Rule priority
1. latest valid local emergency rule
2. latest arrived order
3. latest arrived directive
4. current doctrine
5. faction default

This is the only resolution order for `v0`.

---

## 13) Message Model

Messages are physical simulation objects.

Each message has:
- message id
- sender faction
- origin system
- destination system or region
- message class
- payload
- channel type
- dispatch turn
- arrival turn
- authentication class

### Message classes
- `REPORT`
- `ORDER`
- `DIRECTIVE`
- `DOCTRINE_UPDATE`
- `CAPITAL_RELOCATION_NOTICE`

### Authentication classes
- `OPEN`
- `SIGNED`
- `SEALED`

For `v0`, authentication affects trust rules but does not require crypto simulation.

---

## 14) Communication Channels

The prototype uses exactly 3 channels.

### 1. Open Broadcast
- fastest widely available channel
- low cost
- vulnerable to interception and spoofing
- used for alerts and generic reports
- travels at `1c`
- spreads in a directional cone, so hostile listeners in that space can eavesdrop

Rules:
- can carry `REPORT`, `DIRECTIVE`, `ORDER`
- trust level is low
- delivery time is `ceil(direct distance in light-years)`

### 2. Relay Link
- requires a player-built relay route
- moderate cost
- more secure
- used for regular government traffic
- travels at `1c` across the chosen relay path

Rules:
- can carry all message classes
- trust level is medium
- only available if a continuous relay path is intact from source to destination
- routing can follow any player-defined relay chain anchored in systems
- delivery time is `ceil(sum of relay leg distances in light-years)`

### 3. Courier Ship
- slowest channel
- high trust
- limited capacity in `v0` only by cost and time
- used for sealed orders, legitimacy transfers, capital notices
- follows ship travel rules at `0.1c`

Rules:
- can carry all message classes
- trust level is high
- vulnerable to interception through map conflict, if modeled later
- needs `10 turns` to cross `1 light-year`

### Prototype simplification
In `v0`, interception is abstracted:
- open broadcast can be spoofed during war by enemy action
- relay and courier cannot be spoofed in the first implementation

---

## 15) Reports and Knowledge

The player does not see the true current state of remote systems.

### Each capital-side known system record stores
- last known owner
- last known population
- last known industry
- last known defenses
- last known fleets present
- report origin turn
- report arrival turn
- knowledge age in turns
- source channel

### UI rule
Every non-capital system shown to the player must display:
- current knowledge age
- source of latest report
- confidence level

### Confidence levels
- `HIGH`: sealed courier or relay report with low age
- `MEDIUM`: signed report with moderate age
- `LOW`: open report or very old report

This is the minimum readable UX for the prototype.

---

## 16) Local Autonomy Rules

Remote systems cannot wait forever for the capital.

Each system therefore runs one local policy loop each turn.

### Local policy inputs
- local doctrine
- known local threat
- stockpile
- defense level
- last valid order
- communication policy

### Local policy outputs
- choose production priority if none is actively ordered
- decide whether to keep fleet in system
- decide whether to retreat
- decide whether to request help

### Fail-fast rule
If a system has no valid doctrine, that is invalid state.
The simulation should throw, not invent fallback behavior.

---

## 17) Fleet Model

Fleets are abstract military groups.

Each fleet has:
- owner
- source system
- destination system
- strength
- ETA
- mission type
- last confirmed order id

### Mission types
- `DEFEND`
- `ATTACK`
- `REINFORCE`
- `RETREAT`

### Prototype combat rule
When hostile fleets and defenses meet in a system at turn end:
- resolve automatically from strength values,
- apply defense bonus to the owner,
- update ownership if defenders collapse.

The goal is not combat richness.
The goal is to create new information states and delayed consequences.

---

## 18) Turn Sequence

This sequence should be the single rules order for `v0`.

### Phase 1: Apply arrivals
- fleets arrive
- messages arrive
- capital relocation completes if due

### Phase 2: Update local knowledge
- each system updates its local view from arrived messages
- each capital updates its knowledge state from arrived reports

### Phase 3: Local execution
- each system resolves standing doctrine
- production advances
- local emergency reactions resolve

### Phase 4: Combat resolution
- all contested systems resolve battles
- ownership changes apply immediately to world state

### Phase 5: Report generation
- systems create new reports based on current local reality
- outgoing reports are queued into channels

### Phase 6: Player command phase
- player inspects map through capital knowledge
- player issues available orders, directives, or doctrine updates
- new messages are queued with computed arrival turns

### Phase 7: AI command phase
- AI does the same under the same timing rules

### Phase 8: Advance turn
- increment turn counter

No other sequence should exist in prototype code.

---

## 19) Smallest Playable Loop

The smallest playable loop is:

1. receive stale report from frontier,
2. inspect its age and trust level,
3. choose whether to send a direct order, a doctrine update, or nothing,
4. wait several turns while fleets and messages travel,
5. receive consequences that may no longer match the original picture.

If the prototype does not create this loop reliably, it has failed.

---

## 20) Capital Relocation

Capital relocation is included in `v0` because it proves that command geometry is strategic.

### Capital move rules
- player selects owned destination system
- relocation takes exactly as many turns as ship travel from the current capital to the new capital
- the government immediately embarks on `Space Force One`, which becomes the mobile capital for the full duration of the relocation
- during relocation, the mobile capital can send and receive information only through baseline radio
- during relocation, the mobile capital cannot produce ships, defenses, or industry output
- `Space Force One` may travel with fleet escort
- on completion, control tiers recompute from new capital
- all systems receive `CAPITAL_RELOCATION_NOTICE` by normal message travel

### Prototype number
- relocation duration is route-derived, not fixed

### Design purpose
Capital movement must let the player trade:
- better access to one frontier,
- for weaker access elsewhere.

---

## 21) Capital Loss

Capital loss does not end the game immediately.

### On capital loss
- player loses instant present-view access
- legitimacy drops
- all current command tiers become invalid
- player must designate a successor capital from a loyal owned system if one exists

### Temporary exile state
Until a new capital is established:
- the surviving government is treated like an emergency `Space Force One` scenario
- for exactly 3 turns, it receives radio traffic but sends nothing
- relay and courier dispatch are unavailable during those 3 turns
- no new direct orders can be emitted during those 3 turns
- after the radio-silence window ends, the government may designate a successor capital if one exists
- knowledge updates are limited to already incoming reports and any radio traffic received during the silence period

### Loss condition
The game ends only if:
- the player has no owned systems, or
- no valid successor capital can be established

---

## 22) AI Rules for v0

The AI should be intentionally simple.

### AI behavior priorities
- defend capital first
- reinforce threatened near systems
- attack weak isolated systems
- prefer relay-secured orders when available
- switch threatened remote systems to `SURVIVAL` doctrine

### Important constraint
The AI must operate from its own delayed knowledge state.
It must not inspect player hidden truth directly for decisions.

---

## 23) UI Requirements

The UI must teach the rule of the world, not conceal it.

### Required map presentation
- every system displays owner color
- every system displays knowledge age badge from player capital perspective
- stale information must look stale
- actual unknown current state must never be rendered as certainty

### Required player interactions
- select system
- inspect latest known report
- inspect travel times by channel from capital
- inspect relay route availability and path
- issue command allowed by current control tier
- inspect all messages in transit

### Required panel fields
- system name
- last confirmed status
- report age
- current doctrine
- communication channels available
- estimated order arrival
- estimated fleet arrival

---

## 24) Recommended Starting Numbers

These are initial balancing values, not final truth.

### Map
- 14 systems
- average route distance: 0.3 to 1.0 light-years
- average fleet travel time: 3 to 10 turns
- broadcast delay: usually 1 to 2 turns on the prototype map
- relay delay: usually 1 to 3 turns depending on total path length
- courier delay: same as ship travel time on the chosen route

### Starting positions
- player: 5 systems
- AI: 5 systems
- neutral: 4 systems

### Economy
- starting population per homeworld: 6
- starting industry per homeworld: 5
- frontier worlds: 2 to 4

### Military
- home fleet strength: 8
- frontier defense: 2 to 4
- capital defense bonus: +4

---

## 25) First Technology Slice

`v0` has no research system.

All factions begin with the same fixed `Level 1` technology baseline.

### Level 1 baseline
- maximum ship speed: `0.1c`
- baseline radio communication
- baseline relay compatibility where infrastructure exists
- baseline courier capability
- no FTL travel
- no FTL data links
- no mid-session tech progression

Technology in `v0` is world setup, not a player progression system.

---

## 26) Victory Conditions for Prototype

The prototype needs a short and concrete win path.

### Win
- hold more than 60 percent of systems at turn 72, or
- capture the enemy capital and prevent successor restoration for 6 turns

### Lose
- lose all systems, or
- fail to restore capital authority after capital loss within 6 turns

---

## 27) Acceptance Criteria

The prototype is successful if all of the following are true:

- the player can win or lose without ever seeing omniscient remote truth
- at least one battle outcome is learned only after it is already old news
- at least one order arrives too late to matter
- moving the capital changes what the player can directly command
- losing the capital shifts play into a degraded but still playable state
- UI clearly shows age and trust of information

---

## 28) Best Next Artifact After This

The next design artifact should be a structured data table for communication media and message trust.

Minimum columns:
- channel
- allowed message classes
- trust level
- speed
- cost
- route requirement
- spoof risk
- UI icon

After that, the next artifact should be:
- a `system-state schema`,
- a `message schema`,
- and a 14-system reference map for the first playable scenario.
