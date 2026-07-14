# War for Crown C64 Rules Decompile

This document is the working SSOT for the exact C64 compatibility target. A rule
can be implemented in `c64-original` only when it has either a recovered C64
address/routine, a manual citation, or a directly observed C64 behavior noted
here. Unknowns stay explicit; no guessed behavior is promoted to parity.

The execution roadmap for completing the full decompile is
`c64-full-decompile-plan.md`.

The current end-to-end recovered flow is
`c64-game-logic-walkthrough.md`.

The current detailed computer baron map-AI decompile is
`c64-cbaron-map-ai-decompile.md`.

The current battle arithmetic decompile is
`c64-battle-arithmetic-decompile.md`.

The current economy, weather, and random event decompile is
`c64-economy-weather-events-decompile.md`.

The current human movement decompile is
`c64-human-movement-decompile.md`.

The current human investment decompile is
`c64-human-investment-decompile.md`.

The 1989 BASIC disk comparison is documented in
`c64-kriegudk-1989-baseline.md`.

The VICE fixture workflow and current ROM blocker are documented in
`c64-vice-fixture-workflow.md`.

The recovered start-option defaults, ranges, and royalist normalization are in
`c64-start-options-v0.md`.

The current full-port status matrix is
`c64-port-completeness-matrix.md`.

The recovered C64 text/status/title corpus is
`c64-text-status-decompile.md`.

The recovered `$C832` scratch-flag semantics are
`c64-c832-flags-decompile.md`.

## Source Corpus

- Manual: `/mnt/c/Games/c64/WfC/Krieg_um_die_Krone_2_Manual.txt`
- Main disk target: `/mnt/c/Games/c64/WfC/ERBENT1A.D64`
- Legacy 1989 BASIC disk: `/mnt/c/Games/c64/WfC/KRIEGUDK.D64`
  - checked as a separate rules branch, not the current `c64-original`
    baseline.
- Important modules already inspected:
  - `cbaron`, load `$5800`: computer baron economy, attack, movement, cleanup.
  - `kampf`, load `$7E00`: battle screen, battle loop, retreat commands.
  - `sys`, load `$9400`: battle AI strength-ratio helper and retreat checks.
  - `menue`: setup, map generation, and neutral province initialization.
  - `za..zz`, load `$5500`: 26 random event modules.

## Confirmed Rules

### Starting Land

Evidence: `menue:$30D6..$30E5`, documented in
`c64-ai-analysis.md`.

- Every generated non-water province starts as owner `0`
  (Königstreuen/Kingsmen).
- Neutral villages are `(rnd & 3) + 2`, so `2..5`.
- Neutral soldiers are `(rnd & 3) + 3`, so `3..6`.
- Neutral fortification level starts at `0`.

### Home Castles

Evidence: `c64-ai-analysis.md` state fields and start-state notes.

- `$C8FB + player` stores the player's home province.
- Confirming a home province sets its owner to that player.
- Confirming a home province sets soldiers to `$C8BA`, default `20`.
- Confirming a home province sets fortification to `$C8AD`, the configured
  player home castle level.
- A home castle cannot be used as a defender retreat origin.

### Player Elimination

Evidence: `main:L4C7A` and
`fixtures/main-castle-capture-transfer.json`.

- Capturing a player home castle eliminates that player.
- The eliminated player no longer receives turns.
- Every province and soldier still owned by that player transfers to the
  attacker.
- The captured home province contains the surviving attacking soldiers from the
  battle.
- Non-home transferred provinces keep their current soldiers and fortification
  levels.
- `$C8FB + eliminatedPlayer` is not cleared; turn skipping relies on the
  eliminated player's `$C8B5` province count being zero.
- `$C9FB/$CA00/$CA05 + eliminatedPlayer` stat counters are zeroed.
- Eliminating the last rival baron is not sufficient for victory while owner
  `0` still owns provinces. Victory is continent ownership.

Implementation note: transferred armies are newly acquired during the attack
phase and must not become fresh attack sources until the next attack phase.

TypeScript parity note: domain tests must cover both fixture-backed
`main-castle-capture-transfer` owner cases: a normal player capturing another
player's home castle, and owner `0` capturing a player's home castle through the
royalist world phase. The latter is required after first-class
`ROYALIST_OWNER_ID` migration so royalist victory cannot regress back into "no
owner" semantics.

### Victory State

Evidence: `main:L3312`, `main:L3384`, `main:L339B`,
`fixtures/main-code-final-screen-loader.json`, and
`c64-final-loader-bridge-analysis.md`.

- A non-royalist player owning every province enters `main:L3384`.
- `main:L3384` sets the winner's `$C8CF,x` title/rank field to `5`.
- `$CA75 = 3` means a human player owns the continent.
- `$CA75 = 1` means an AI player owns the continent.
- `$CA75 = 2` means royalists own the continent.
- `main:L33A0` restores `$1D50..$1D52` to the original text-stream reader
  prefix `A0 00 B1`; this is not a final loader jump.
- `fixtures/kampf-l8461-hostile-post-battle-repeat.json` confirms that a
  hostile owner-`0` pass continues attacking after reducing player ownership to
  a single remaining province; no player victory is declared at that point.
- `fixtures/kampf-l8461-hostile-home-castle-transfer.json` confirms that the
  hostile owner-`0` attack path can capture a player's home province and
  transfer that player's remaining provinces through `main:L4C7A` without
  additional battles.
- `fixtures/main-l337a-hostile-home-castle-world-pass.json` confirms that this
  capture does not stop `main:L337A`; royalist production still runs before the
  caller-level win path is reached.
- `fixtures/main-l3312-hostile-home-castle-world-pass.json` confirms the full
  caller path: `main:L3312` wraps into owner `0`, runs the real `main:L337A`,
  calls post-world display/status and month/weather, then reaches `$CA75 = 02`
  after skipping the eliminated player.
- If royalists eliminate the last player by home-castle capture, `main:L4C7A`
  performs the transfer first; `main:L3312` reaches the royalist win path after
  zero-province players are skipped and owner `0` wraps with all provinces.
- Final screen text is selected through the loader path documented in
  `c64-text-status-decompile.md`: `$CA75 = 1` loads `txtwin1`, `$CA75 = 2`
  loads `txtwin2`, and `$CA75 = 3` loads `txtwin3`.
- `code:L5960` calls `code:L5305 -> code:L5297` before reading `$4DF5`; that
  page swap moves `$CA75` to `$4DF5`.
- Title text is generated from `$C8CF + $C8CA`; ranks are Baron/Graf/Herzog/
  Fürst/Kurfürst/König and their female variants. Full victory forces the
  winner to rank `5`.

### Player Attack Setup

Evidence: `c64-attack-code-analysis.md`, manual sections `7.2.5` and `7.2.6`.

- Target is selected first.
- Adjacent owned source provinces are toggled after the target.
- Each selected source commits all soldiers except one garrison soldier.
- Selecting the target again starts the battle.
- Source provinces used in an attack are spent for the current attack phase.
- A newly captured target is also spent for the current attack phase.

### Battle Flow

Evidence: `kampf:$7E64` loop, input routine around `$83C4`, `main:L4F49`,
`main:L4FA7`, and
`fixtures/main-retreat-placement-multiple-destinations.json`.

- Battle opens a dedicated battle screen.
- One input advances exactly one battle round unless it requests retreat.
- A retreat command still resolves one final simultaneous round.
- A combat round consumes RNG for attacker hits first, then defender hits.
- Attacker retreat command value is `2`.
- Defender retreat command value is `1`.
- Defender retreat is legal only when an adjacent owned retreat province exists
  and the defended province is not the home castle.
- Attacker retreat/failure distributes surviving attackers over provinces
  marked with `$C832 & $10`.
- Defender retreat distributes surviving defenders over provinces marked with
  `$C832 & $80`.
- Retreat distribution is even division plus remainder; remainder soldiers go
  to the highest-numbered marked provinces first because the scan runs from
  `$C8A1` down to `1`.

### Battle AI Retreat

Evidence: `sys:$9426`, `sys:$946F`, `sys:$9486`, and `kampf` threshold data.

- Defender AI retreat check runs before attacker AI retreat check.
- Strength ratio:

```text
floor(((attackerSoldiers * 256 / defenderSoldiers) ^ 2 / defenderCombatPercent * attackerCombatPercent) / 256)
```

- Attacker AI retreats when the ratio is below `$00E6` (`230`).
- Defender AI retreats when the ratio is at least `$01B3` (`435`) and legal
  retreat exists.

### Player Movement

Evidence: `main:L33B3..L3546`, `sys:L984B..L99FF`,
`fixtures/main-human-movement-connected-transfer.json`, documented in
`c64-human-movement-decompile.md`.

- Movement selects two different active-owned provinces.
- The provinces must be in the same connected active-owned component.
- Movement is not restricted to direct adjacency.
- The C64 chooser sets the final soldier count in the destination province.
- Minimum destination count is `1`.
- Maximum destination count is `source + destination - 1`.
- Initial destination count is the destination's current soldier count.
- Source receives the remaining soldiers.
- Movement does not mark provinces spent; the player can make another legal
  move in the same movement phase.

### Player Investment

Evidence: `main:L4196..L479D`, `fixtures/main-human-investment-actions.json`,
`fixtures/main-screen-action-indices.json`, documented in
`c64-human-investment-decompile.md`.

- Recruiting soldiers costs one taler per soldier.
- Recruited soldiers go directly to the home province.
- Village purchase cost is `$C900`.
- Village cap is calculated by `sys:L9A2A`.
- Fortification upgrade cost is `main:L300F[currentFortLevel]`.
- A province can be upgraded only once per investment phase via `$C832 & $20`.
- End investment applies `$C901` percent interest to current money.
- Supplies/catapults branches in this menu are disabled/no-op in simple mode.
- Menu choice indices are fixture-confirmed: `0` recruit, `1` villages, `2`
  fortification, `3` catapult branch, `4` full-rules stock transfer selector,
  `5` end investment.

### Computer Baron Structure

Evidence: `cbaron` jump table and `main` callers, documented in
`c64-ai-analysis.md`.

- `$5800`: computer economy/investment.
- `$5803`: computer attack phase.
- `$5806`: computer movement and redistribution.
- `$5809/$6A64`: post-action cleanup/consolidation helper.
- Computer barons use temporary province flags at `$C832`.
- Attack selection is target/frontier oriented and can aggregate multiple source
  provinces.
- Movement uses reachable owned-province worklists and remembered target/threat
  state in `$C9DE/$C9E2/$C9E6/$C9EA`.
- Recruitment goes directly to the home province. There is no free-troop or
  reserve pool.

### Income, Weather, And Events

Evidence: `c64-economy-weather-events-decompile.md`.

- Base income is `floor(sum(villages * terrainPercent) / 100)` over owned
  provinces.
- Terrain income coefficients are `0,150,100,140,130,120,100,110`.
- Delayed event flags can halve or double one income collection with a 50% RNG
  gate.
- Weather is generated from the recovered 4-by-7 weighted table at
  `main:L3DB1`.
- Random events are loaded from modules `za..zz`; code begins at `$5504` after
  two text-range pointers.
- Supplies/catapult-only events must be disabled or no-op in the simple
  ruleset.

### Königstreuen / Kingsmen Structure

Evidence: `c64-ai-analysis.md`.

- Owner/player `0` is the royalist/Kingsmen side, not a normal player slot.
- Royalist behavior runs between player rounds as a world phase.
- Hostile royalist attacks enter through `kampf:$7E03 -> $8461`.
- After a resolved hostile royalist battle, `main:L4C50` can dispatch back
  through `main:L487E -> $3009 -> kampf:L8461`, so royalists may continue
  attacking during the same world pass.
- Royalist production/investment is handled through `main:$5209`.
- Royalist distribution/pressure is handled through `main:$50D3`.
- Friendly royalist provinces join the attacker instead of fighting when
  attacked (`kampf:L7E76`,
  `fixtures/kampf-l7e76-friendly-royalist-join.json`).
- Neutral royalists do not launch hostile attacks and do not join attackers.
- `$C8A8` controls royalist distribution: `0` none, `1` full connected
  component, `2` frontier/border provinces.
- Royalist production uses per-province village and fortification buckets, not a
  player-style money pool.

## Not Yet Byte-Exact

The following items are required before claiming full C64 parity:

- TypeScript comparison test for the recovered C64 map generator; the
  sequential-RNG golden map dump, `kernal:L216B` cleanup fixture, and terrain
  retry fixture are already captured;
- PL/EN localization keys for the recovered C64 text templates.

Until those are recovered, implemented behavior may be playable and tested, but
must be labeled as workbench or partial C64 compatibility.
