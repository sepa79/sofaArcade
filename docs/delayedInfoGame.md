# Delayed Information Strategy — concept notes

## Core idea

A strategy game where **information is physical** and propagates through the world at a limited speed.

The player does **not** control the empire instantly everywhere.
Only the **current capital** lives in the present.
Everything else operates on:
- delayed reports,
- previously received orders,
- local doctrine,
- and partial or outdated knowledge.

### Core pitch line

> It is a war over which reality the distant systems believe.

Polish variant:

> To wojna o to, w którą rzeczywistość uwierzą odległe systemy.

---

## Two skins for the same core system

### 1. Medieval / Caravan Wars style
- news travels by horse, caravan, courier
- mirrors, smoke, beacon towers, signal systems
- moving court / moving capital
- local lords, governors, marches, frontier autonomy

### 2. Space / MOO-like
- star map like original Master of Orion 1
- radio, directional radio, lasers, relays, courier ships
- capital world as seat of command
- delayed reports from distant colonies
- possible FTL travel, but communication remains constrained by infrastructure

The same underlying rule applies in both versions:
**there is no magical instant control outside the capital.**

---

## Fundamental design rule

This is not just a feature. It is the law of the world.

### Rule
Only the capital can be managed "now".
Outside the capital, any change of priorities, doctrine, production, or emergency stance must travel as an order or directive.

That means:
- no instant empire-wide slider changes,
- no instant crisis reaction on distant worlds,
- no omniscient ruler gameplay,
- no fully synchronized empire.

The state emits **will**, and that will travels physically.

A useful formulation:

> The capital does not directly control the empire. It emits the will of the state, and that will spreads through space with limited speed.

---

## MOO-like prototype direction

A small, turn-based, couch-friendly strategy game inspired by **Master of Orion 1**, but centered on delayed information.

### Minimal prototype assumptions
- turn-based, not RTS
- simple star map
- planets as key nodes
- simple fleets with ETA
- combat resolved automatically at first
- no detailed tactical battles in early prototype
- a few resource priorities / production modes
- focus on information age, trust, and command reach

### Planet gameplay concept
At first, planets may use simple production / priority modes similar to MOO-like colony logic, but importantly:
- nearby worlds may allow more direct control,
- distant worlds primarily respond to directives,
- not to instant slider manipulation.

---

## Orders vs directives

Distance from the capital changes **what kind of control is possible**.

### Close worlds
Within a short information travel threshold, the player may issue direct orders or near-direct management.
Examples:
- specific production shifts,
- fleet launch,
- local build decisions,
- detailed control.

### Distant worlds
Farther away, the player does not issue precise operational control. Instead, they issue:
- directives,
- doctrine changes,
- standing policies,
- strategic priorities.

Examples:
- Prioritise Military
- Prioritise Survival
- Prioritise Industry
- Hold Current Doctrine
- Enter Radio Silence
- Accept Only Secure Commands
- Fall Back to Local Autonomy

### UI implication
The UI itself should teach the world rule.

The farther a planet is from the capital, the higher-level the options become.
For example:
- nearby world: direct control / sliders / detailed options
- far world: right-click shows doctrine and directives rather than precise orders

This creates a visible gradient of control:
- direct governance zone
- administrative reach
- remote governance

---

## Capital as a real strategic node

The capital is not decorative.
It is:
- the main seat of command,
- the source of political legitimacy,
- a communication hub,
- the point from which direct control radiates.

Because information has travel time, moving the capital becomes strategically meaningful.

### Why move the capital?
- a new frontier becomes more important
- trade routes shift
- the old center is too far from the real crisis zone
- the empire expanded asymmetrically
- communication delays from the current capital are too costly

### Effects of moving the capital
- some worlds become easier to govern directly
- others fall out of direct reach
- political legitimacy may shift
- old elites may resist
- sectors may detach, drift, or reinterpret authority

This works in both skins:
- medieval: the court moves
- space: the capital world or mobile command center relocates

---

## Mobile capital / “Space Air Force One”

A mobile seat of power makes sense in this system.

It can act as:
- a mobile capital,
- an emergency command hub,
- a secure communication center,
- an evacuation platform for government,
- a temporary legitimacy anchor.

### Strategic questions
- keep it safe in the rear or send it closer to the crisis?
- use it to shorten command delays?
- risk destruction or interception?
- conceal its true location?

The same concept maps to medieval form as a moving royal court.

---

## Losing the capital should not mean game over

A key idea: loss of the main command center should not simply end the game.
Instead, it should shift the player’s point of view.

### After capital loss
- the player may “respawn” on another loyal planet / colony / command ship
- but with different and incomplete information
- some sectors may no longer be known accurately
- some worlds may still follow old orders
- some may not yet know the capital fell
- some may not accept the new center

This creates a new phase of play:
- exile phase,
- reconstitution,
- reintegration,
- or imperial fragmentation.

### Dramatic version
The government evacuates on a fleeing ship toward a colony that *used to be* loyal.
But the last confirmed report is years old.
The key question becomes:

> You are not asking whether you will arrive. You are asking what you will arrive to.

---

## Delayed information as world identity

The game becomes about:
- command delay,
- stale reports,
- trust in channels,
- and asymmetric knowledge.

This is not just fog of war.
It is **fog of time**.

You do not ask:
- “What is there now?”

You ask:
- “What was there when the message was sent?”
- “How old is my knowledge?”
- “Which reports can I trust?”
- “What does this distant colony believe is true?”

---

## Information channels

A major system should be the taxonomy and economy of communication channels.

### Example table dimensions
Each channel may differ by:
- medium
- speed
- secrecy
- capacity
- build cost
- upkeep
- interception risk
- vulnerability to jamming/disruption
- relay compatibility
- routing flexibility
- trust level / authentication strength

### Candidate channel types

#### Open radio / broadcast
- cheap
- broad
- fast at light speed
- easy to intercept
- useful for alarms, propaganda, distress calls

#### Directional radio
- more focused than broadcast
- still vulnerable in principle
- somewhat more private
- useful for targeted communication

#### Interstellar laser links
- also light speed only
- hard to intercept
- expensive
- precise
- often require geometry, line of sight, or relay networks
- allow routing around hostile space through relay chains

Important note:
Radio and laser are both limited by light speed.
The difference is not raw speed, but topology, secrecy, and route structure.

#### Courier ships
- secure
- can carry large data payloads, codes, archives, legal authority
- slower than ideal channels
- vulnerable to interception/destruction
- useful for sealed orders and succession legitimacy

#### Wormhole / FTL data links
- late-game / endgame infrastructure
- near-instant over limited range (e.g. 1 ly, 3 ly, 5 ly)
- extremely expensive to build and maintain
- good for linking capital to major governors
- not practical for every planet

This is important:
endgame should not remove the core system by making all communication instant everywhere.
Instead, it should create **selective instant backbones** between major nodes.

---

## Relays and routing

Relays are excellent because they exist in both skins.

### Medieval equivalents
- mirror towers
- smoke towers
- beacon systems
- line-of-sight signal infrastructure

### Space equivalents
- laser relays
- directional radio relays
- communication stations
- relay buoys

### Design value of relays
Relays are not just range extenders.
They create:
- communication corridors,
- strategic choke points,
- routes that can avoid hostile systems,
- secure but expensive paths,
- alternate topologies of truth.

This enables interesting choices:
- short and risky broadcast route
- long but secure laser route through relays
- courier route with high trust but long delay

The player is not breaking physics.
They are optimizing the **geometry of information flow**.

---

## Information warfare / spoofing / deception

A big layer of gameplay can come from **trust and deception**.

### Example concept
Send a secure directive first:
- ignore all subsequent radio messages until receiving authenticated code X

Then:
- enemy radio deception starts flooding the region
- true follow-up orders travel along a longer but secure path

This creates warfare not only over movement and planets, but over:
- protocol trust,
- authentication chains,
- which channels are believed,
- how distant governors filter reality.

### Types of message trust
Possible message classes:
- Open
- Signed
- Trusted Route
- Courier-Sealed
- Codeword Locked

### Example communication directives
- Ignore open radio until counter-order
- Accept commands only from capital relay chain
- Switch to wartime authentication
- Disregard distress calls without code
- Fall back to local autonomy if conflicting orders arrive

This means orders can affect not only behavior, but how future orders are interpreted.

That is a very strong system.

---

## Command radius and control tiers

A useful UI and rules abstraction is to define control zones based on communication delay from the capital.

### Example tiers

#### Tier 0 — Capital
- full immediacy
- everything local and current

#### Tier 1 — Near worlds
- short information delay
- direct control possible
- detailed orders and near-sliders if desired

#### Tier 2 — Mid-range worlds
- simplified priorities
- presets
- more reliance on local interpretation

#### Tier 3 — Remote worlds
- directives only
- standing doctrine
- partial information
- high autonomy

When the capital moves, these tiers shift dynamically.
That means moving the capital changes not only stats, but the actual structure of interaction in the UI.

---

## Governors, autonomy, and clusters

Naively, each planet could act like its own governor.
That may become too complex if simulated in full detail.

A strong refinement is to introduce **regional clusters**.

### Local autonomy through communication infrastructure
Once the player gains technologies like **FTL Data**, sectors or clusters of nearby planets can form regions of near-instant communication.
Within such a cluster:
- a local governor can operate with fresher shared information,
- local policy can be smarter,
- the region acts semi-coherently,
- this becomes the practical meaning of local autonomy.

### Why this helps
- reduces simulation complexity
- creates meaningful sector governors
- strengthens political structure
- provides a natural progression path
- avoids each planet needing a full separate “brain”

In that model:
- planets have local doctrine,
- clusters have governors,
- the capital issues strategic will,
- sectors interpret and apply it according to their own conditions.

---

## Races and governments modifying communication behavior

A later layer could make this system truly unique.
Different races and government types do not just differ in bonuses.
They differ in **how they obey, interpret, resist, or drift from delayed orders**.

### Key parameters for faction behavior
- order fidelity
- local autonomy
- doctrine drift over time
- willingness to reinterpret stale orders
- attachment to the legitimacy of the capital
- tendency toward reintegration after isolation
- tolerance for contradictory authority

### Examples

#### Humans (possible direction)
Not “always united”, but rather:
- more inclined toward federation and reintegration,
- tolerant of local autonomy,
- capable of rebuilding common structures after separation,
- less literal with old orders.

#### Meklars
- highly literal
- execute instructions precisely
- even when context has changed
- strong obedience, low flexibility

#### Hive mind
A particularly strong concept:
- when cut off from the central mind, a new mind can emerge,
- effectively a new faction,
- not necessarily hostile, but not necessarily willing to reintegrate.

This is excellent because isolation does not merely produce a revolt modifier.
It produces a **new political entity**.

#### Government examples
- Democracy / Republic: more local reinterpretation, less rigid obedience
- Authoritarian empire: greater order compliance, but more catastrophic collapse on center loss
- Technocracy: stronger policy consistency under uncertainty
- Hive / machine governance: perfect obedience when linked, dangerous rigidity or divergence when cut off

This turns delayed communication into something more than logistics.
It becomes cultural and political identity.

---

## Reintegration after isolation

A powerful consequence of this system:
cut-off sectors should not remain static.
Over time, they may become politically or culturally different.

That means reintegration becomes meaningful gameplay.

### Examples
- humans may prefer negotiated reintegration / federation
- a hive sector may become a distinct mind
- Meklar colonies may follow old doctrine with terrifying persistence
- feudal / clan-based worlds may develop local dynasties

This is stronger than a simple rebellion mechanic.
It creates **new identities born from isolation**.

---

## Why this is strong

This concept is not just “delayed fog of war”.
It ties together:
- communication,
- command,
- trust,
- legitimacy,
- sector autonomy,
- capital movement,
- military planning,
- and political fragmentation.

It also creates a strong emotional and narrative space:
- evacuation,
- delayed truth,
- stale loyalty,
- contradictory authority,
- and war over belief, not only territory.

That is what makes it feel like more than a standard 4X or RTS variation.

---

## Strong phrases worth preserving

- **It is a war over which reality the distant systems believe.**
- **To wojna o to, w którą rzeczywistość uwierzą odległe systemy.**
- **The capital does not directly control the empire. It emits the will of the state, and that will spreads through space with limited speed.**
- **The empire survives, but certainty does not.**
- **You are not asking whether you will arrive. You are asking what you will arrive to.**

---

## Sensible next design artifact

One very good next step would be a structured table of communication media:
- channel type
- speed
- secrecy
- interception risk
- capacity
- cost
- upkeep
- routing / relay behavior
- trust / authentication strength
- gameplay role

That table would help define:
- economy of information,
- military doctrine,
- UI presentation,
- governor behavior,
- and technology progression.

